import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { DELIVERY_PLATFORM_FILTERS, formatDeliveryPlatform } from "../shared/deliveryPlatforms";

const salesSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/AnáliseVendas.tsx"), "utf8");
const deliverySource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/AnaliseDelivery.tsx"), "utf8");
const compilerOptions = { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext };
const parse = (source: string) => ts.createSourceFile("Page.tsx", source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);
function nodes<T extends ts.Node>(source: string, predicate: (node: ts.Node) => node is T): T[] {
  const found: T[] = [];
  function visit(node: ts.Node) { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }
  visit(parse(source));
  return found;
}
function evaluateMemo(source: string, name: string, environment: Record<string, unknown>) {
  const declaration = nodes(source, ts.isVariableDeclaration).find(node => node.name.getText() === name)!;
  expect(declaration).toBeDefined();
  const call = declaration.initializer as ts.CallExpression;
  expect(call.expression.getText()).toBe("useMemo");
  const callback = call.arguments[0].getText();
  const code = ts.transpileModule(`const payload = (${callback})(); payload;`, { compilerOptions }).outputText;
  return runInNewContext(code, environment);
}
function clearingHandler(source: string, label: string) {
  const button = nodes(source, ts.isJsxElement).find(node =>
    node.openingElement.tagName.getText() === "Button" && node.children.some(child => ts.isJsxText(child) && child.getText().includes(label)))!;
  expect(button).toBeDefined();
  const attribute = button.openingElement.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText() === "onClick") as ts.JsxAttribute;
  return (attribute.initializer as ts.JsxExpression).expression!.getText();
}
function callHandler(handler: string, environment: Record<string, unknown>) {
  const code = ts.transpileModule(`(${handler})();`, { compilerOptions }).outputText;
  runInNewContext(code, environment);
}
const from = new Date("2026-11-01T12:00:00Z");
const to = new Date("2026-11-08T12:00:00Z");
const fallbackDate = new Date("2026-01-01T12:00:00Z");
const selectedProductIds = [7, 8];
const salesEnvironment = {
  activeCompanyId: 1, selectedProductIds, selectedSubcategoryId: 4,
  selectedChannels: ["BALCAO", "DELIVERY"], selectedPaymentMethod: "PIX", selectedDeliveryPlatform: "all",
};

describe("Origem nas análises — payloads memoizados avaliados e contratos JSX, sem browser", () => {
  it.each(["all", ...DELIVERY_PLATFORM_FILTERS])("payload %s preserva período, produto, subcategoria, canal e pagamento em todas as análises", selectedDeliveryPlatform => {
    const analysisFilters = evaluateMemo(salesSource, "analysisFilters", { ...salesEnvironment, selectedDeliveryPlatform });
    const payload = evaluateMemo(salesSource, "analysisQueryParams", { analysisFilters, dateRange: { from, to }, fallbackDate });
    expect(payload).toEqual({ startDate: from, endDate: to, companyId: 1, productIds: selectedProductIds, subcategoryId: 4,
      channels: ["BALCAO", "DELIVERY"], paymentMethod: "PIX", deliveryPlatform: selectedDeliveryPlatform === "all" ? undefined : selectedDeliveryPlatform });
    const queryCalls = nodes(salesSource, ts.isCallExpression).filter(node => /^trpc\.salesAnalysis\.(?!comparePeriods).*\.useQuery$/.test(node.expression.getText()));
    expect(queryCalls.map(call => call.expression.getText())).toEqual([
      "trpc.salesAnalysis.byValue.useQuery", "trpc.salesAnalysis.byQuantity.useQuery", "trpc.salesAnalysis.byCategoryValue.useQuery",
      "trpc.salesAnalysis.summary.useQuery", "trpc.salesAnalysis.byDay.useQuery", "trpc.salesAnalysis.byWeek.useQuery",
      "trpc.salesAnalysis.byProductAndDate.useQuery", "trpc.salesAnalysis.byMonth.useQuery",
    ]);
    for (const call of queryCalls) {
      expect(call.arguments[0].getText()).toBe("analysisQueryParams");
      expect(call.arguments[1].getText()).toContain("canQueryAnalysis");
    }
  });

  it.each(["value", "quantity"])("comparação %s compartilha os mesmos filtros sem alterar datas", comparisonType => {
    const analysisFilters = evaluateMemo(salesSource, "analysisFilters", { ...salesEnvironment, selectedDeliveryPlatform: "99FOOD" });
    const compareFrom = new Date("2025-11-01T12:00:00Z");
    const compareTo = new Date("2025-11-08T12:00:00Z");
    const payload = evaluateMemo(salesSource, "comparisonQueryParams", { analysisFilters, comparisonPeriods: {
      current: { from, to }, compare: { from: compareFrom, to: compareTo },
    }, comparisonType, fallbackDate });
    expect(payload).toEqual({ ...analysisFilters, comparisonType, period1: { startDate: from, endDate: to }, period2: { startDate: compareFrom, endDate: compareTo } });
    const call = nodes(salesSource, ts.isCallExpression).find(n => n.expression.getText() === "trpc.salesAnalysis.comparePeriods.useQuery")!;
    expect(call.arguments[0].getText()).toBe("comparisonQueryParams");
    expect(call.arguments[1].getText()).toContain("canQueryAnalysis");
  });

  it("datas de fallback permanecem estáveis e limpar origem não injeta iFood nem altera tipo/canal", () => {
    const handler = clearingHandler(salesSource, "Limpar Todos os Filtros");
    const calls: Record<string, unknown> = {};
    const setters = Object.fromEntries(["setSelectedProductIds", "setSelectedSubcategoryId", "setSelectedChannels", "setSelectedPaymentMethod", "setSelectedDeliveryPlatform", "setProductSearch", "setSubcategorySearch"].map(name => [name, (value: unknown) => { calls[name] = value; }]));
    callHandler(handler, setters);
    expect(calls.setSelectedDeliveryPlatform).toBe("all");
    expect(salesSource).toContain('selectedDeliveryPlatform !== "all"');
    expect(salesSource).not.toMatch(/setSelectedDeliveryPlatform\("IFOOD"\)/);
    const analysisFilters = evaluateMemo(salesSource, "analysisFilters", { ...salesEnvironment, selectedDeliveryPlatform: "all" });
    const payload = evaluateMemo(salesSource, "analysisQueryParams", { analysisFilters, dateRange: null, fallbackDate });
    expect(payload.startDate).toBe(fallbackDate);
    expect(payload.endDate).toBe(fallbackDate);
  });

  it.each(["all", ...DELIVERY_PLATFORM_FILTERS])("delivery %s mantém categoria, canal e datas no payload único dos produtos/cards", deliveryPlatform => {
    const payload = evaluateMemo(deliverySource, "queryParams", { activeCompanyId: 2, startDate: "2026-11-01", endDate: "2026-11-08", categoryId: 4, channelId: 9, deliveryPlatform });
    expect(payload).toEqual({ companyId: 2, startDate: "2026-11-01", endDate: "2026-11-08", categoryId: 4, channelId: 9,
      deliveryPlatform: deliveryPlatform === "all" ? undefined : deliveryPlatform });
    const call = nodes(deliverySource, ts.isCallExpression).find(n => n.expression.getText() === "trpc.dashboard.deliveryProductAnalysis.useQuery")!;
    expect(call.arguments[0].getText()).toBe("queryParams");
    expect(call.arguments[1].getText()).toContain("!!activeCompanyId && !switching");
    expect(deliverySource).toContain("const products = analysisData?.products");
    expect(deliverySource).toContain("deliveryRevenue: products.reduce");
    expect(deliverySource).toContain("totalFee: products.reduce");
    expect(deliverySource).not.toMatch(/trpc\.dashboard\.(overview|deliveryNetMargin|weekly)/);
  });

  it("limpeza delivery restaura origem/canal/categoria/período e não altera comissão", () => {
    const calls: Record<string, unknown> = {};
    const setters = Object.fromEntries(["setStartDate", "setEndDate", "setCategoryId", "setChannelId", "setDeliveryPlatform", "setMarginStatus", "setSearchTerm"].map(name => [name, (value: unknown) => { calls[name] = value; }]));
    callHandler(clearingHandler(deliverySource, "Limpar Filtros"), setters);
    expect(calls).toEqual({ setStartDate: "", setEndDate: "", setCategoryId: undefined, setChannelId: undefined, setDeliveryPlatform: "all", setMarginStatus: "all", setSearchTerm: "" });
    const payload = evaluateMemo(deliverySource, "queryParams", { activeCompanyId: 1, startDate: "", endDate: "", categoryId: undefined, channelId: undefined, deliveryPlatform: "all" });
    expect(payload).toEqual({ companyId: 1, deliveryPlatform: undefined });
    expect(deliverySource).toContain(": \'Taxa Canal (7%)\'");
    expect(deliverySource).not.toMatch(/setDeliveryPlatform\("IFOOD"\)/);
  });

  it("as chaves dos dois módulos mudam com a empresa e não permitem consulta sem empresa ativa", () => {
    const sales1 = evaluateMemo(salesSource, "analysisFilters", salesEnvironment);
    const sales2 = evaluateMemo(salesSource, "analysisFilters", { ...salesEnvironment, activeCompanyId: 2 });
    expect(sales1.companyId).toBe(1); expect(sales2.companyId).toBe(2);
    const env = { startDate: "", endDate: "", categoryId: undefined, channelId: undefined, deliveryPlatform: "all" };
    const delivery1 = evaluateMemo(deliverySource, "queryParams", { ...env, activeCompanyId: 1 });
    const delivery2 = evaluateMemo(deliverySource, "queryParams", { ...env, activeCompanyId: 2 });
    expect(delivery1.companyId).toBe(1); expect(delivery2.companyId).toBe(2);
    expect(salesSource).toContain("const canQueryAnalysis = isAdmin && !!activeCompanyId && !switching");
    expect(salesSource).toContain("[activeCompanyId, selectedProductIds, selectedSubcategoryId, selectedChannels, selectedPaymentMethod, selectedDeliveryPlatform]");
    expect(deliverySource).toContain("[startDate, endDate, categoryId, channelId, deliveryPlatform, activeCompanyId]");
  });

  it("rótulos tratam origem separadamente do canal, inclusive Não informada", () => {
    expect(DELIVERY_PLATFORM_FILTERS.map(formatDeliveryPlatform)).toEqual(["iFood", "99Food", "Próprio", "Outro", "Não informada"]);
    for (const source of [salesSource, deliverySource]) {
      expect(source).toContain("Origem do delivery");
      expect(source).toContain("Todas as origens");
      expect(source).toContain("DELIVERY_PLATFORM_FILTERS.map");
      expect(source).toContain("formatDeliveryPlatform(platform)");
      expect(source).toContain("canal nem suas taxas");
    }
  });

  it.each([["AnáliseVendas.tsx", salesSource], ["AnaliseDelivery.tsx", deliverySource]])("%s transpila JSX sem erro sintático", (fileName, source) => {
    const result = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions });
    expect((result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)).toEqual([]);
  });
});
