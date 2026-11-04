import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => ({ execute }) }));
import { getAnnualRevenueGoalProgress, getRevenueGoalProgress } from "./db";

const dialect = new MySqlDialect();
const queries: { sql: string; params: unknown[] }[] = [];
const goals = [
  { id: 1, companyId: 1, branchId: null, year: 2026, month: 1, channelId: null, targetAmount: "100", channelName: "Geral", channelCode: "ALL" },
  { id: 2, companyId: 1, branchId: 1, year: 2026, month: 1, channelId: 1, targetAmount: "100", channelName: "iFood", channelCode: "IFOOD" },
  { id: 3, companyId: 1, branchId: 2, year: 2026, month: 2, channelId: 1, targetAmount: "100", channelName: "iFood", channelCode: "IFOOD" },
  { id: 4, companyId: 2, branchId: 2, year: 2026, month: 1, channelId: null, targetAmount: "1000", channelName: "Geral", channelCode: "ALL" },
];
const sales = [
  { companyId: 1, branchId: 1, month: 1, channelId: 1, finalAmount: 125, status: "ACTIVE" },
  { companyId: 1, branchId: 2, month: 1, channelId: 2, finalAmount: 75, status: "ACTIVE" },
  { companyId: 1, branchId: 1, month: 1, channelId: 1, finalAmount: 10000, status: "CANCELLED" },
  { companyId: 2, branchId: 2, month: 1, channelId: 1, finalAmount: 9000, status: "ACTIVE" },
];

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mysql://unit-test-no-network");
  queries.length = 0;
  execute.mockReset().mockImplementation(async query => {
    const parsed = dialect.sqlToQuery(query);
    queries.push(parsed);
    if (parsed.sql.includes("FROM revenueGoals")) {
      const companyId = Number(parsed.params[0] ?? parsed.sql.match(/rg\.companyId = (\d+)/)?.[1]);
      const month = parsed.sql.match(/rg\.month = (\d+)/)?.[1];
      return [goals.filter(row => row.companyId === companyId && (!month || row.month === Number(month))), []];
    }
    const companyId = Number(parsed.params[0] ?? parsed.sql.match(/s\.companyId = (\d+)/)?.[1]);
    const rows = new Map<string, { month: number; channelId: number; totalRevenue: number }>();
    for (const sale of sales.filter(row => row.companyId === companyId && row.status === "ACTIVE")) {
      const key = `${sale.month}-${sale.channelId}`;
      const row = rows.get(key) ?? { month: sale.month, channelId: sale.channelId, totalRevenue: 0 };
      row.totalRevenue += sale.finalAmount;
      rows.set(key, row);
    }
    return [[...rows.values()], []];
  });
});

describe("Metas — integração anual com consultas isoladas (sem banco real)", () => {
  it("reutiliza ACTIVE/finalAmount/saleDate/Brasília e coincide com o progresso mensal", async () => {
    const annual = await getAnnualRevenueGoalProgress(2026, 1, 1);
    const monthly = await getRevenueGoalProgress(2026, 1, 1);
    expect(annual.months[0].goals).toEqual(monthly?.goals);
    expect(annual.months[0].totalRevenue).toBe(monthly?.totalRevenue);
    expect(queries[1].sql).toContain("s.status = 'ACTIVE'");
    expect(queries[1].sql).toContain("SUM(s.finalAmount)");
    expect(queries[1].sql).toContain("MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00'))");
    expect(queries[1].sql).toContain("s.saleDate >= '2026-01-01 03:00:00'");
    expect(queries[1].sql).toContain("s.saleDate < '2027-01-01 03:00:00'");
    expect(queries.every(query => /^\s*SELECT/.test(query.sql))).toBe(true);
  });
  it("inclui metas com branchId NULL e todas as filiais como a regra mensal empresarial", async () => {
    const branch1 = await getAnnualRevenueGoalProgress(2026, 1, 1);
    const branch2 = await getAnnualRevenueGoalProgress(2026, 1, 2);
    expect(branch1.months).toEqual(branch2.months);
    expect(branch1.months[0].goals.map(goal => goal.id)).toEqual([1, 2]);
    expect(branch1.months[1].goals.map(goal => goal.id)).toEqual([3]);
    expect(branch1.months[0].totalRevenue).toBe(200);
    expect(queries.every(query => !query.sql.includes("rg.branchId =") && !query.sql.includes("s.branchId ="))).toBe(true);
  });
  it("isola a empresa em ambas as consultas, não soma Geral + canais e faz só duas leituras", async () => {
    const company1 = await getAnnualRevenueGoalProgress(2026, 1, 1);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(queries[0].sql).toContain("rg.companyId = ?");
    expect(queries[1].sql).toContain("s.companyId = ?");
    expect(company1.months[0].goals[0].progress).toBe(200);
    expect(company1.months[0].goals[1].progress).toBe(125);
    const company2 = await getAnnualRevenueGoalProgress(2026, 2, 2);
    expect(company2.months[0].goals.map(goal => goal.id)).toEqual([4]);
    expect(company2.months[0].totalRevenue).toBe(9000);
  });
  it("nega escopos vazios ou inválidos antes de consultar dados", async () => {
    await expect(getAnnualRevenueGoalProgress(2026, 0, 1)).rejects.toThrow();
    await expect(getAnnualRevenueGoalProgress(2026, 1, 0)).rejects.toThrow();
    await expect(getAnnualRevenueGoalProgress(2026.5, 1, 1)).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});
