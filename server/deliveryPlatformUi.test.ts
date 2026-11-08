import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Vendas.tsx"), "utf8");
const ifood = readFileSync(resolve(import.meta.dirname, "routers/ifoodImport.ts"), "utf8");

describe("Origem delivery — contrato frontend sem browser", () => {
  it("formulário começa sem plataforma padrão e impede finalizar DELIVERY sem seleção", () => {
    expect(source).toContain('useState<DeliveryPlatform | "">("")');
    expect(source).toContain('if (saleType === "DELIVERY" && !deliveryPlatform)');
    expect(source).toContain('toast.error("Selecione a plataforma do delivery")');
    expect(source).toContain('placeholder="Selecione a plataforma"');
    expect(source).not.toMatch(/setDeliveryPlatform\("IFOOD"\)/);
    expect(source).toContain('deliveryPlatform: saleType === "DELIVERY" ? (deliveryPlatform as DeliveryPlatform) : null');
  });
  it("listagem, indicadores e Excel enviam o mesmo filtro e os rótulos distinguem Pedido e Plataforma", () => {
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
  it("edição abre a plataforma armazenada, mantém legado NULL e chama metadata-only auditada", () => {
    expect(source).toContain('setEditedDeliveryPlatform(sale.deliveryPlatform ?? "NAO_INFORMADO")');
    expect(source).not.toContain('setEditedDeliveryPlatform(sale.effectiveDeliveryPlatform');
    expect(source).toContain('trpc.sales.updateDeliveryPlatform.useMutation');
    expect(source).toContain('deliveryPlatform: editedDeliveryPlatform === "NAO_INFORMADO" ? null : editedDeliveryPlatform');
    expect(source).toContain('permissions.sales.canEdit');
    expect(source).toContain('event.stopPropagation()');
    expect(source).toContain('Pedido, canal, datas, valores e estoque não serão alterados');
  });
  it("importador marca somente o insert de novas vendas iFood sem mexer no UUID ou código de Pedido", () => {
    const insert = ifood.slice(ifood.indexOf('await db.insert(sales).values({'), ifood.indexOf('const saleId = saleResult.insertId;'));
    expect(insert).toContain('deliveryPlatform: "IFOOD"');
    expect(insert).toContain('platformOrderId: order.ifoodOrderCode');
    expect(insert).toContain('channelId: IFOOD_CHANNEL_ID');
    expect(ifood).toContain('if (existing) {\n            continue; // Pular se já importado');
    expect(ifood).not.toMatch(/update\(sales\)/);
  });
  it("o JSX atualizado transpila sem erros sintáticos", () => {
    const result = ts.transpileModule(source, { fileName: "Vendas.tsx", reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
    expect((result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)).toEqual([]);
  });
});
