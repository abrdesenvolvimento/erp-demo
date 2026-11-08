import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { deliveryPlatformFromChannelCode, formatDeliveryPlatform } from "../shared/deliveryPlatforms";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Vendas.tsx"), "utf8");
const details = readFileSync(resolve(import.meta.dirname, "../client/src/components/SaleDetailsModal.tsx"), "utf8");
const ifood = readFileSync(resolve(import.meta.dirname, "routers/ifoodImport.ts"), "utf8");
const compilerOptions = { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext };
const tree = ts.createSourceFile("Vendas.tsx", source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);
function handler(name: string) {
  let result: ts.VariableDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) result = node;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  expect(result).toBeDefined();
  return result!.initializer!.getText(tree);
}
function callHandler(name: string, env: Record<string, any>, value?: string) {
  const code = ts.transpileModule(`(${handler(name)})(${value === undefined ? "" : JSON.stringify(value)});`, { compilerOptions }).outputText;
  runInNewContext(code, env);
}
function form(overrides: Record<string, unknown> = {}) {
  const env: Record<string, any> = {
    saleType: "DELIVERY", channelId: "", deliveryPlatform: "", deliveryPlatformManuallySelected: false,
    channels: [
      { id: 2, companyId: 1, code: "IFOOD", name: "Canal iFood", type: "DELIVERY" },
      { id: 3, companyId: 1, code: "99FOOD", name: "Delivery 99Food", type: "DELIVERY" },
      { id: 4, companyId: 1, code: "DELIVERY", name: "iFood 99 delivery próprio", type: "DELIVERY" },
    ],
    deliveryPlatformFromChannelCode, formatDeliveryPlatform,
    toast: { error: vi.fn(), info: vi.fn() }, createSale: { mutate: vi.fn() },
    customerId: "", platformOrderId: "Pedido-99", subtotal: 10, discount: 0, surcharge: 0, total: 10,
    paymentMethod: "PIX", notes: "", saleItems: [{ productId: 1, productName: "Produto", quantity: 1, unitPrice: "10.00", totalPrice: "10.00", currentStock: 10 }],
    console: { log: vi.fn(), error: vi.fn() },
    ...overrides,
  };
  for (const [setter, field] of [["setChannelId", "channelId"], ["setDeliveryPlatform", "deliveryPlatform"], ["setDeliveryPlatformManuallySelected", "deliveryPlatformManuallySelected"], ["setSaleItems", "saleItems"], ["setProductSearch", "productSearch"], ["setSelectedProduct", "selectedProduct"], ["setQuantity", "quantity"]]) {
    env[setter] = vi.fn((value: unknown) => { env[field] = value; });
  }
  return env;
}

describe("Origem delivery — handlers frontend avaliados sem browser", () => {
  it("formulário começa sem plataforma padrão e impede finalizar DELIVERY sem seleção", () => {
    expect(source).toContain('useState<DeliveryPlatform | "">("")');
    expect(source).toContain('placeholder="Selecione a plataforma"');
    expect(source).not.toMatch(/setDeliveryPlatform\("IFOOD"\)/);
    const env = form({ channelId: "4" });
    callHandler("handleFinalizeSale", env);
    expect(env.toast.error).toHaveBeenCalledWith("Selecione a plataforma do delivery");
    expect(env.createSale.mutate).not.toHaveBeenCalled();
  });
  it.each([["2", "IFOOD"], ["3", "99FOOD"]] as const)("selecionar canal %s preenche %s visível e persiste com o mesmo canal e Pedido", (channelId, platform) => {
    const env = form();
    callHandler("handleSelectChannel", env, channelId);
    expect(env.channelId).toBe(channelId);
    expect(env.deliveryPlatform).toBe(platform);
    expect(env.toast.info).toHaveBeenCalledWith(`Plataforma preenchida pelo canal: ${formatDeliveryPlatform(platform)}`);
    callHandler("handleFinalizeSale", env);
    expect(env.createSale.mutate).toHaveBeenCalledWith(expect.objectContaining({ channelId: Number(channelId), deliveryPlatform: platform, platformOrderId: "Pedido-99" }));
    expect(source).toContain('onValueChange={handleSelectChannel}');
    expect(source).toContain('onValueChange={handleSelectDeliveryPlatform}');
  });
  it("seleção manual posterior não é sobrescrita silenciosamente; conflito recebe feedback e impede finalizar", () => {
    const env = form();
    callHandler("handleSelectChannel", env, "3");
    callHandler("handleSelectDeliveryPlatform", env, "PROPRIO");
    expect(env.deliveryPlatform).toBe("PROPRIO");
    expect(env.deliveryPlatformManuallySelected).toBe(true);
    expect(env.toast.error).toHaveBeenCalled();
    env.setDeliveryPlatform.mockClear();
    callHandler("handleSelectChannel", env, "2");
    expect(env.deliveryPlatform).toBe("PROPRIO");
    expect(env.setDeliveryPlatform).not.toHaveBeenCalled();
    callHandler("handleFinalizeSale", env);
    expect(env.toast.error).toHaveBeenLastCalledWith("A plataforma selecionada não corresponde ao canal de venda");
    expect(env.createSale.mutate).not.toHaveBeenCalled();
  });
  it("canal não identificável não infere por nome e mantém escolha manual", () => {
    const env = form();
    callHandler("handleSelectChannel", env, "3");
    callHandler("handleSelectChannel", env, "4");
    expect(env.deliveryPlatform).toBe("");
    callHandler("handleSelectDeliveryPlatform", env, "OUTRO");
    callHandler("handleSelectChannel", env, "4");
    expect(env.deliveryPlatform).toBe("OUTRO");
    callHandler("handleFinalizeSale", env);
    expect(env.createSale.mutate).toHaveBeenCalledWith(expect.objectContaining({ channelId: 4, deliveryPlatform: "OUTRO" }));
  });
  it("autopreenchimento não muda canal de preço: produto usa channelId 3 mesmo com preços diferentes", () => {
    const env = form({ saleItems: [], quantity: "2", selectedProduct: { id: 1, name: "Produto", currentStock: 10 },
      selectedProductWithPrices: { prices: [{ channelId: 2, price: "14.00" }, { channelId: 3, price: "19.99" }] }, setTimeout: vi.fn() });
    callHandler("handleSelectChannel", env, "3");
    callHandler("handleAddProduct", env);
    expect(env.channelId).toBe("3");
    expect(env.deliveryPlatform).toBe("99FOOD");
    expect(env.saleItems).toEqual([expect.objectContaining({ productId: 1, unitPrice: "19.99", totalPrice: (19.99 * 2).toFixed(2), quantity: 2 })]);
  });
  it("listagem, indicadores e Excel enviam o mesmo filtro e distinguem Pedido e Plataforma", () => {
    expect(source.match(/deliveryPlatform: filterDeliveryPlatform === "all" \? undefined : filterDeliveryPlatform/g)).toHaveLength(3);
    expect(source).toContain('<SelectItem value="NAO_INFORMADO">Não informada</SelectItem>');
    expect(source).toContain('<TableHead>Plataforma</TableHead>');
    expect(source).toContain('<TableHead>Pedido</TableHead>');
    expect(source).toContain('<Label htmlFor="platformOrderId">Pedido</Label>');
    expect(source).toContain("'Plataforma': row.channel === 'DELIVERY' ? formatDeliveryPlatform(row.effectiveDeliveryPlatform)");
    expect(source).toContain("'Pedido': row.orderNumber || '-'");
    expect(source).toContain('formatDeliveryPlatform(sale.effectiveDeliveryPlatform)');
    expect(source).toContain('setFilterDeliveryPlatform("all")');
    expect(source).toContain("period: 'all'");
  });
  it("escolha somente na criação: sem botão, coluna de ações, modal ou mutation de edição de plataforma", () => {
    expect(source).not.toMatch(/platformEditSale|editedDeliveryPlatform|updateDeliveryPlatform|Editar plataforma|Salvar plataforma|<TableHead>Ações<\/TableHead>/);
    expect(details).toContain('trpc.sales.update.useMutation');
    expect(details).not.toContain('deliveryPlatform:');
    expect(details).toContain("platformOrderId: editedPlatformOrderId");
  });
  it("importador mantém somente insert de novas vendas iFood, UUID e código de Pedido inalterados", () => {
    const insert = ifood.slice(ifood.indexOf('await db.insert(sales).values({'), ifood.indexOf('const saleId = saleResult.insertId;'));
    expect(insert).toContain('deliveryPlatform: "IFOOD"');
    expect(insert).toContain('platformOrderId: order.ifoodOrderCode');
    expect(insert).toContain('channelId: IFOOD_CHANNEL_ID');
    expect(ifood).toContain('if (existing) {\n            continue; // Pular se já importado');
    expect(ifood).not.toMatch(/update\(sales\)/);
  });
  it("JSX atualizado transpila sem erros sintáticos", () => {
    const result = ts.transpileModule(source, { fileName: "Vendas.tsx", reportDiagnostics: true, compilerOptions });
    expect((result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)).toEqual([]);
  });
});
