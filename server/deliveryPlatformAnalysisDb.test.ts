import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { resolveDeliveryPlatform, type DeliveryPlatformFilter } from "../shared/deliveryPlatforms";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => ({ execute: mocks.execute }) }));
import {
  getSalesAnalysisByValue, getSalesAnalysisByQuantity, getSalesAnalysisByCategoryValue,
  getSalesAnalysisByDay, getSalesAnalysisByWeek, getSalesAnalysisByMonth, getSalesByProductAndDate,
  getSalesAnalysisSummary, getSalesCountByChannel, getDeliveryProductAnalysis, deliveryPlatformFilterSql,
} from "./db";

const dialect = new MySqlDialect();
const queries: string[] = [];
const dates = [new Date("2026-11-01T12:00:00Z"), new Date("2026-11-08T12:00:00Z")] as const;
const aggregates = [
  ["valor", getSalesAnalysisByValue], ["quantidade", getSalesAnalysisByQuantity],
  ["categoria", getSalesAnalysisByCategoryValue], ["dia", getSalesAnalysisByDay],
  ["semana", getSalesAnalysisByWeek], ["mês", getSalesAnalysisByMonth], ["matriz", getSalesByProductAndDate],
] as const;
const platforms = [undefined, "IFOOD", "99FOOD", "PROPRIO", "OUTRO", "NAO_INFORMADO"] as const;
const filters = { productIds: [7, 8], subcategoryId: 4, channels: ["DELIVERY"], paymentMethod: "PIX" };
const uuid = "8c2186f0-1420-4eb8-b891-ea2c57ac50d7";
const imports = [
  { saleId: 2, companyId: 1, ifoodOrderId: uuid },
  { saleId: 2, companyId: 1, ifoodOrderId: uuid }, // repeated evidence is one sale
  { saleId: 3, companyId: 2, ifoodOrderId: uuid }, // not evidence for company 1
  { saleId: 4, companyId: 1, ifoodOrderId: "67890" },
  { saleId: 5, companyId: 1, ifoodOrderId: uuid }, // stored 99Food wins
];
const sales = [
  { id: 1, companyId: 1, saleType: "DELIVERY", deliveryPlatform: "IFOOD", finalAmount: 10, status: "ACTIVE" },
  { id: 2, companyId: 1, saleType: "DELIVERY", deliveryPlatform: null, finalAmount: 20, status: "ACTIVE" },
  { id: 3, companyId: 1, saleType: "DELIVERY", deliveryPlatform: null, finalAmount: 30, status: "ACTIVE" },
  { id: 4, companyId: 1, saleType: "DELIVERY", deliveryPlatform: null, finalAmount: 40, status: "ACTIVE" },
  { id: 5, companyId: 1, saleType: "DELIVERY", deliveryPlatform: "99FOOD", finalAmount: 50, status: "ACTIVE" },
  { id: 6, companyId: 1, saleType: "BALCAO", deliveryPlatform: null, finalAmount: 60, status: "ACTIVE" },
  { id: 7, companyId: 2, saleType: "DELIVERY", deliveryPlatform: "99FOOD", finalAmount: 700, status: "ACTIVE" },
  { id: 8, companyId: 1, saleType: "DELIVERY", deliveryPlatform: "IFOOD", finalAmount: 80, status: "CANCELLED" },
];

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mysql://unit-test-no-network");
  queries.length = 0;
  mocks.execute.mockReset().mockImplementation(async query => {
    queries.push(dialect.sqlToQuery(query).sql);
    return [[], []];
  });
});

function expectScopedPredicate(query: string, platform: DeliveryPlatformFilter | undefined, alias: "s" | "sales" = "s") {
  expect(query).toMatch(/(?:s\.)?companyId = 1/);
  expect(query).not.toMatch(/branchId\s*=|JOIN ifoodImportedOrders|\bUPDATE\b|\bINSERT\b|\bDELETE\b/);
  expect(query).toMatch(/^\s*SELECT/);
  expect(query).toContain("status != 'CANCELLED'");
  if (platform) {
    expect(query).toContain(deliveryPlatformFilterSql(platform, alias));
    expect(query).toContain(`io.saleId = ${alias}.id AND io.companyId = ${alias}.companyId`);
    expect(query).toContain("io.ifoodOrderId REGEXP");
    expect(query).toContain(`WHEN ${alias}.deliveryPlatform IS NOT NULL`);
  } else {
    expect(query).not.toContain("ifoodImportedOrders");
    expect(query).not.toContain("deliveryPlatform");
  }
}

describe("Origem nas análises — SQL compilado e mockado, sem conexão", () => {
  it.each(platforms)("aplica %s em valores, quantidades/mix, categoria, séries e matriz preservando filtros", async deliveryPlatform => {
    for (const [, aggregate] of aggregates) {
      await aggregate(...dates, 1, { ...filters, deliveryPlatform });
      const query = queries.at(-1)!;
      expectScopedPredicate(query, deliveryPlatform);
      expect(query).toContain("p.id IN (7,8)");
      expect(query).toContain("p.subcategoryId = 4");
      expect(query).toContain("s.saleType IN ('DELIVERY')");
      expect(query).toContain("s.paymentMethod = 'PIX'");
      expect(query).toContain("2026-11-01 03:00:00");
      expect(query).toContain("2026-11-09 03:00:00");
      expect(query).toContain("SUM(si.quantity");
      expect(query).toContain("si.totalPrice");
      if (aggregate === getSalesAnalysisByQuantity) {
        const subqueryPredicate = deliveryPlatformFilterSql(deliveryPlatform, "s").replace(/\bs\./g, "s2.");
        expect(query).toContain(subqueryPredicate);
        expect(query).toContain("s2.companyId = 1");
        expect(query).toContain("p2.id IN (7,8)");
        expect(query).toContain("p2.subcategoryId = 4");
        expect(query).toContain("s2.saleType IN ('DELIVERY')");
        expect(query).toContain("s2.paymentMethod = 'PIX'");
      } else {
        expect(query).toMatch(/(?:SUM\(si.quantity \* p.avgCost\)|SUM\(si.quantity \* COALESCE\(p.avgCost, 0\)\))/);
      }
    }
    expect(queries).toHaveLength(7);
  });

  it.each(platforms)("resumo %s usa finalAmount sem produto e totalPrice/custo com produto ou subcategoria", async deliveryPlatform => {
    for (const productFilter of [{}, { productIds: [7] }, { subcategoryId: 4 }]) {
      await getSalesAnalysisSummary(...dates, 1, { channels: ["DELIVERY"], paymentMethod: "PIX", deliveryPlatform, ...productFilter });
      const query = queries.at(-1)!;
      const hasProduct = Object.keys(productFilter).length > 0;
      expectScopedPredicate(query, deliveryPlatform, hasProduct ? "s" : "sales");
      expect(query).toContain("saleType IN ('DELIVERY')");
      expect(query).toContain("paymentMethod = 'PIX'");
      expect(query).toContain(hasProduct ? "SUM(si.totalPrice)" : "SUM(finalAmount)");
      expect(query).toContain(hasProduct ? "COUNT(DISTINCT s.id)" : "COUNT(*)");
      if (hasProduct) expect(query).toContain("SUM(si.quantity * p.avgCost)");
    }
  });

  it.each(platforms)("contador por canal %s aplica origem em todas as três bases e preserva canal/pagamento", async deliveryPlatform => {
    for (const productFilter of [{}, { productIds: [7] }, { subcategoryId: 4 }]) {
      await getSalesCountByChannel(...dates, 1, { channels: ["DELIVERY"], paymentMethod: "PIX", deliveryPlatform, ...productFilter });
      const query = queries.at(-1)!;
      expectScopedPredicate(query, deliveryPlatform);
      expect(query).toContain("s.saleType IN ('DELIVERY')");
      expect(query).toContain("s.paymentMethod = 'PIX'");
      expect(query).toMatch(/GROUP BY (?:s\.)?saleType/);
    }
  });

  it.each(platforms)("produtos e pedidos de delivery %s têm mesmo recorte; canal pertence à empresa ativa", async deliveryPlatform => {
    await getDeliveryProductAnalysis("2026-11-01", "2026-11-08", 4, 1, 9, deliveryPlatform);
    expect(queries).toHaveLength(3);
    expect(queries[0]).toContain("FROM salesChannels WHERE id = 9 AND companyId = 1");
    for (const query of queries.slice(1)) {
      expectScopedPredicate(query, deliveryPlatform);
      expect(query).toContain("s.channelId = 9");
      expect(query).toContain("s.saleType = 'DELIVERY'");
    }
    expect(queries[1]).toContain("COUNT(DISTINCT s.id)");
    expect(queries[1]).not.toContain("p.categoryId"); // existing fixed-fee allocation convention
    expect(queries[2]).toContain("p.categoryId = 4");
  });

  it("mock de resumo comprova precedência, UUID/empresa, não informada e ausência de duplicação/backfill", async () => {
    mocks.execute.mockImplementation(async query => {
      const text = dialect.sqlToQuery(query).sql; queries.push(text);
      const company = Number(text.match(/(?:s\.)?companyId = (\d+)/)?.[1]);
      const platform = text.match(/ELSE NULL END\) (= '(IFOOD|99FOOD|PROPRIO|OUTRO)'|IS NULL)/)?.[2];
      const selected = sales.filter(row => row.companyId === company && row.status !== "CANCELLED" &&
        (!text.includes("sales.saleType = 'DELIVERY'") || (row.saleType === "DELIVERY" && resolveDeliveryPlatform(row, imports) === (platform ?? null))));
      return [[{ totalRevenue: selected.reduce((sum, row) => sum + row.finalAmount, 0), totalSales: selected.length }], []];
    });
    expect(await getSalesAnalysisSummary(...dates, 1, { deliveryPlatform: "IFOOD" })).toMatchObject({ totalRevenue: 30, totalSales: 2 });
    expect(await getSalesAnalysisSummary(...dates, 1, { deliveryPlatform: "NAO_INFORMADO" })).toMatchObject({ totalRevenue: 70, totalSales: 2 });
    expect(await getSalesAnalysisSummary(...dates, 1, { deliveryPlatform: "99FOOD" })).toMatchObject({ totalRevenue: 50, totalSales: 1 });
    expect(await getSalesAnalysisSummary(...dates, 2, { deliveryPlatform: "99FOOD" })).toMatchObject({ totalRevenue: 700, totalSales: 1 });
    expect(await getSalesAnalysisSummary(...dates, 1)).toMatchObject({ totalRevenue: 210, totalSales: 6 });
    expect(sales[1].deliveryPlatform).toBeNull();
    expect(queries.every(q => /^\s*SELECT/.test(q))).toBe(true);
  });

  it("rateio e margens continuam por canal: origem filtra pedidos/produtos, não escolhe taxa", async () => {
    mocks.execute.mockImplementation(async query => {
      const text = dialect.sqlToQuery(query).sql; queries.push(text);
      if (text.includes("FROM salesChannels")) return [[{ name: "Canal comercial", commissionPercent: "10", fixedFeePerOrder: "2" }], []];
      if (text.includes("as totalOrders")) return [[{ totalOrders: 2 }], []];
      return [[{ productId: 7, productName: "Produto", totalQuantity: "3", totalRevenue: "100", totalCost: "40" }], []];
    });
    for (const deliveryPlatform of ["IFOOD", "99FOOD", "NAO_INFORMADO"] as const) {
      const result = await getDeliveryProductAnalysis("2026-11-01", "2026-11-08", undefined, 1, 9, deliveryPlatform);
      expect(result.products[0]).toMatchObject({ revenue: "100.00", cost: "40.00", grossProfit: "60.00", grossMarginPercent: "60.0", ifoodFee: "14.00", netProfit: "46.00", netMarginPercent: "46.0" });
      expect(result.channelInfo).toMatchObject({ commissionPercent: "10.00", fixedFeePerOrder: "2.00", totalOrders: 2, totalFixedFees: "4.00" });
    }
    const fallback = await getDeliveryProductAnalysis("2026-11-01", "2026-11-08", undefined, 1, undefined, "99FOOD");
    expect(fallback.channelInfo).toMatchObject({ commissionPercent: "7.00", fixedFeePerOrder: "0.00" });
    expect(fallback.products[0].ifoodFee).toBe("7.00");
  });

  it("combinação com BALCAO não substitui o filtro existente nem transforma origem em canal", async () => {
    await getSalesAnalysisByValue(...dates, 1, { deliveryPlatform: "99FOOD", channels: ["BALCAO"] });
    expect(queries[0]).toContain("s.saleType IN ('BALCAO')");
    expect(queries[0]).toContain("AND s.saleType = 'DELIVERY'");
    expect(queries[0]).not.toContain("channelId");
  });

  it("nega empresa ausente ou inválida em todos os helpers antes de SQL, sem fallback global", async () => {
    for (const companyId of [undefined, 0, -1, 1.5, NaN]) {
      for (const [, aggregate] of aggregates) await expect(aggregate(...dates, companyId)).rejects.toThrow("companyId válido");
      await expect(getSalesAnalysisSummary(...dates, companyId)).rejects.toThrow("companyId válido");
      await expect(getSalesCountByChannel(...dates, companyId)).rejects.toThrow("companyId válido");
      await expect(getDeliveryProductAnalysis("2026-11-01", "2026-11-08", undefined, companyId)).rejects.toThrow("companyId válido");
    }
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
