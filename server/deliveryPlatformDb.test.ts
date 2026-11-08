import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { resolveDeliveryPlatform, type DeliveryPlatformFilter } from "../shared/deliveryPlatforms";
const mocks = vi.hoisted(() => ({ execute: vi.fn(), set: vi.fn(), where: vi.fn(), update: vi.fn() }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => ({ execute: mocks.execute, update: mocks.update }) }));
import { getSales, getSale, getSalesStats, getSalesForExport, updateSale, deliveryPlatformFilterSql, effectiveDeliveryPlatformSql } from "./db";

const dialect = new MySqlDialect();
const queries: { sql: string; params: unknown[] }[] = [];
const uuid = "8c2186f0-1420-4eb8-b891-ea2c57ac50d7";
const imports = [
  { saleId: 2, companyId: 1, ifoodOrderId: uuid },
  { saleId: 2, companyId: 1, ifoodOrderId: "4c2186f0-1420-4eb8-b891-ea2c57ac50d7" }, // duplicate proof must not multiply sales
  { saleId: 3, companyId: 2, ifoodOrderId: uuid }, // wrong company
  { saleId: 4, companyId: 1, ifoodOrderId: "67890" }, // short code
  { saleId: 5, companyId: 1, ifoodOrderId: uuid }, // stored 99Food takes precedence
];
const channels = [
  { id: 2, companyId: 1, code: "IFOOD" },
  { id: 3, companyId: 1, code: "99FOOD" },
  { id: 9, companyId: 2, code: "99FOOD" }, // cannot identify company 1 sale
];
const rows = [
  { id: 1, companyId: 1, branchId: 1, channelId: 3, saleType: "DELIVERY", deliveryPlatform: "IFOOD", finalAmount: "10.00", status: "ACTIVE" },
  { id: 2, companyId: 1, branchId: 2, channelId: 3, saleType: "DELIVERY", deliveryPlatform: null, finalAmount: "20.00", status: "ACTIVE" },
  { id: 3, companyId: 1, branchId: 1, channelId: 9, saleType: "DELIVERY", deliveryPlatform: null, finalAmount: "30.00", status: "ACTIVE" },
  { id: 4, companyId: 1, branchId: 2, channelId: 3, saleType: "DELIVERY", deliveryPlatform: null, finalAmount: "40.00", status: "ACTIVE" },
  { id: 5, companyId: 1, branchId: 1, channelId: 2, saleType: "DELIVERY", deliveryPlatform: "99FOOD", finalAmount: "50.00", status: "ACTIVE" },
  { id: 6, companyId: 1, branchId: 1, channelId: 3, saleType: "BALCAO", deliveryPlatform: null, finalAmount: "60.00", status: "ACTIVE" },
  { id: 7, companyId: 2, branchId: 1, saleType: "DELIVERY", deliveryPlatform: "99FOOD", finalAmount: "700.00", status: "ACTIVE" },
  { id: 8, companyId: 1, branchId: 1, saleType: "DELIVERY", deliveryPlatform: "IFOOD", finalAmount: "80.00", status: "CANCELLED" },
];

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mysql://unit-test-no-network");
  queries.length = 0;
  mocks.where.mockReset().mockResolvedValue(undefined);
  mocks.set.mockReset().mockImplementation(() => ({ where: mocks.where }));
  mocks.update.mockReset().mockImplementation(() => ({ set: mocks.set }));
  mocks.execute.mockReset().mockImplementation(async query => {
    const parsed = dialect.sqlToQuery(query); queries.push(parsed);
    const company = Number(parsed.sql.match(/(?:s\.)?companyId = (\d+)/)?.[1]);
    let selected = rows.filter(row => row.companyId === company);
    if (parsed.sql.includes("status != 'CANCELLED'")) selected = selected.filter(row => row.status !== "CANCELLED");
    const platform = parsed.sql.match(/ELSE NULL END\) (= '(IFOOD|99FOOD|PROPRIO|OUTRO)'|IS NULL)/)?.[2];
    if (/AND (?:sales|s)\.saleType = 'DELIVERY'/.test(parsed.sql)) {
      selected = selected.filter(row => row.saleType === "DELIVERY" && resolveDeliveryPlatform(row, imports, channels) === (platform ?? null));
    }
    const id = parsed.sql.match(/WHERE s\.id = (\d+)/)?.[1];
    if (id) selected = selected.filter(row => row.id === Number(id));
    if (parsed.sql.includes("GROUP BY saleType")) {
      const groups = new Map<string, { saleType: string; count: number; total: string }>();
      for (const row of selected) {
        const group = groups.get(row.saleType) ?? { saleType: row.saleType, count: 0, total: "0.00" };
        group.count++; group.total = (Number(group.total) + Number(row.finalAmount)).toFixed(2); groups.set(row.saleType, group);
      }
      return [[...groups.values()], []];
    }
    return [selected.map(row => ({ ...row, effectiveDeliveryPlatform: resolveDeliveryPlatform(row, imports, channels) })), []];
  });
});

describe("Origem delivery — queries mockadas e somente escopos empresariais", () => {
  it("usa CASE armazenado > UUID/empresa > código exato de canal/empresa, nunca JOIN/nome/pedido", () => {
    const sql = effectiveDeliveryPlatformSql("s");
    expect(sql).toContain("WHEN s.deliveryPlatform IS NOT NULL");
    expect(sql).toContain("io.saleId = s.id AND io.companyId = s.companyId");
    expect(sql).toContain("io.ifoodOrderId REGEXP");
    expect(sql).toContain("dpc.id = s.channelId AND dpc.companyId = s.companyId");
    expect(sql).toContain("BINARY dpc.code = 'IFOOD'");
    expect(sql).toContain("BINARY dpc.code = '99FOOD'");
    expect(sql.indexOf("WHEN s.deliveryPlatform IS NOT NULL")).toBeLessThan(sql.indexOf("FROM ifoodImportedOrders"));
    expect(sql.indexOf("FROM ifoodImportedOrders")).toBeLessThan(sql.indexOf("FROM salesChannels"));
    expect(sql).not.toMatch(/JOIN|platformOrderId|ifoodOrderCode|notes|\.name|LIKE|saleDate|dpc\.type/);
    expect(deliveryPlatformFilterSql("NAO_INFORMADO", "s")).toContain("IS NULL");
    expect(deliveryPlatformFilterSql(undefined)).toBe("");
    expect(() => deliveryPlatformFilterSql("INJETAR'" as any)).toThrow("Plataforma inválida");
  });
  it.each([undefined, "IFOOD", "99FOOD", "PROPRIO", "OUTRO", "NAO_INFORMADO"] as const)("lista/indicadores/exportação reutilizam filtro %s e companyId sem limitação artificial por filial", async platform => {
    await getSales({ companyId: 1, deliveryPlatform: platform, dateFrom: "2026-11-01", dateTo: "2026-11-08" });
    await getSalesStats("all", "2026-11-01", "2026-11-08", undefined, 1, platform);
    await getSalesForExport({ companyId: 1, deliveryPlatform: platform, startDate: new Date("2026-11-01T12:00:00Z"), endDate: new Date("2026-11-08T12:00:00Z") });
    expect(queries).toHaveLength(3);
    for (const [index, query] of queries.entries()) {
      expect(query.sql).toMatch(/(?:s\.)?companyId = 1/);
      expect(query.sql).toContain("03:00:00");
      expect(query.sql).not.toMatch(/branchId\s*=/);
      expect(query.sql).not.toMatch(/JOIN (?:ifoodImportedOrders|salesChannels)/);
      expect(query.sql).toMatch(/^\s*SELECT/);
      if (platform) expect(query.sql).toContain(deliveryPlatformFilterSql(platform, index === 2 ? "s" : "sales"));
    }
  });
  it("listagem com e sem datas tem o mesmo campo efetivo e mesmo filtro", async () => {
    const withDates = await getSales({ companyId: 1, deliveryPlatform: "IFOOD", dateFrom: "2026-11-01" });
    const withoutDates = await getSales({ companyId: 1, deliveryPlatform: "IFOOD" });
    expect(withDates).toEqual(withoutDates);
    expect(withDates.map(row => row.id)).toEqual([1, 2, 8]);
    expect(withDates[1].deliveryPlatform).toBeNull();
    expect(withDates[1].effectiveDeliveryPlatform).toBe("IFOOD");
    expect(queries.every(query => query.sql.includes("as effectiveDeliveryPlatform"))).toBe(true);
  });
  it("totais não duplicam evidências e excluem canceladas conforme regra existente", async () => {
    const ifood = await getSalesStats("all", undefined, undefined, undefined, 1, "IFOOD");
    expect(ifood.total).toEqual({ count: 2, total: "30.00" });
    const unknown = await getSalesStats("all", undefined, undefined, undefined, 1, "NAO_INFORMADO");
    expect(unknown.total).toEqual({ count: 1, total: "30.00" });
    const food99 = await getSalesStats("all", undefined, undefined, undefined, 1, "99FOOD");
    expect(food99.total).toEqual({ count: 2, total: "90.00" });
    expect(rows[1].deliveryPlatform).toBeNull();
  });
  it("canal 99FOOD aparece em lista/detalhe/export mesmo com plataforma armazenada NULL, sem writes", async () => {
    const before = JSON.stringify(rows);
    const list = await getSales({ companyId: 1, deliveryPlatform: "99FOOD" });
    expect(list.map(row => row.id)).toEqual([4, 5]);
    expect(list[0]).toMatchObject({ channelId: 3, deliveryPlatform: null, effectiveDeliveryPlatform: "99FOOD" });
    expect(await getSale(4, 1)).toMatchObject({ channelId: 3, deliveryPlatform: null, effectiveDeliveryPlatform: "99FOOD" });
    const exported = await getSalesForExport({ companyId: 1, deliveryPlatform: "99FOOD" });
    expect(exported[0]).toMatchObject({ deliveryPlatform: null, effectiveDeliveryPlatform: "99FOOD" });
    expect(JSON.stringify(rows)).toBe(before);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("empresa 2 não recebe venda/evidência da empresa 1 e detalhe é scoped", async () => {
    const list = await getSales({ companyId: 2, deliveryPlatform: "99FOOD" });
    expect(list.map(row => row.id)).toEqual([7]);
    expect(await getSale(2, 2)).toBeUndefined();
    expect((await getSale(2, 1))?.effectiveDeliveryPlatform).toBe("IFOOD");
    expect(queries.at(-1)?.sql).toContain("AND s.companyId = 1");
  });
  it("rejeita empresa vazia, plataforma ou data inválida sem consulta SQL", async () => {
    for (const companyId of [0, -1, 1.5, NaN]) {
      await expect(getSales({ companyId })).rejects.toThrow();
      await expect(getSalesStats("all", undefined, undefined, undefined, companyId)).rejects.toThrow();
      await expect(getSalesForExport({ companyId })).rejects.toThrow();
    }
    await expect(getSales({ companyId: 1, deliveryPlatform: "HACK" as DeliveryPlatformFilter })).rejects.toThrow();
    await expect(getSales({ companyId: 1, dateFrom: "2026-01-01';DELETE" })).rejects.toThrow();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("patch sem origem a preserva e aplica companyId; origem explícita é rejeitada antes de write", async () => {
    await updateSale(2, { platformOrderId: "Pedido-2" }, 1);
    expect(mocks.set).toHaveBeenLastCalledWith({ platformOrderId: "Pedido-2" });
    const where = dialect.sqlToQuery(mocks.where.mock.lastCall![0]);
    expect(where.sql).toContain("`sales`.`companyId` = ?");
    expect(where.params).toEqual([2, 1]);
    for (const deliveryPlatform of ["IFOOD", "99FOOD", "PROPRIO", "OUTRO", null] as const) {
      await expect(updateSale(2, { deliveryPlatform }, 1)).rejects.toThrow("A plataforma só pode ser escolhida ao criar a venda");
    }
    await updateSale(2, { finalAmount: "100.00", deliveryPlatform: undefined }, 1);
    expect(mocks.set).toHaveBeenLastCalledWith({ finalAmount: "100.00" });
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
