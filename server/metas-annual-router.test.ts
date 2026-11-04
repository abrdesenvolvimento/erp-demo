import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), aggregate: vi.fn(), active: vi.fn(), access: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getAnnualRevenueGoalProgress: mocks.aggregate }));
vi.mock("./operatorSecurity", () => ({ assertOperatorActive: mocks.active }));
import { router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { annualGoalsProgressProcedure } from "./routers/goalsAnnual";

const testRouter = router({ annualProgress: annualGoalsProgressProcedure });
const dialect = new MySqlDialect();
const queryParts: { join?: { sql: string; params: unknown[] }; where?: { sql: string; params: unknown[] } } = {};
const ctx = (companyId: number | undefined = 1, branchId: number | undefined = 1): TrpcContext => ({
  user: { id: "operator-one", role: "admin" } as TrpcContext["user"],
  req: {} as TrpcContext["req"], res: {} as TrpcContext["res"], activeCompanyId: companyId, activeBranchId: branchId, operatorSessionId: "valid-session",
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.active.mockResolvedValue(undefined);
  mocks.aggregate.mockResolvedValue({ year: 2026, months: [], series: [] });
  mocks.access.mockResolvedValue([{ id: 1 }]);
  const chain = { from: vi.fn(() => chain), innerJoin: vi.fn((_table, condition) => { queryParts.join = dialect.sqlToQuery(condition); return chain; }), where: vi.fn(condition => { queryParts.where = dialect.sqlToQuery(condition); return chain; }), limit: mocks.access };
  mocks.getDb.mockResolvedValue({ select: vi.fn(() => chain) });
});

describe("Metas — endpoint anual protegido e sem dados de outra empresa", () => {
  it("usa apenas empresa/filial do contexto e valida sessão e vínculo antes do agregado", async () => {
    const result = await testRouter.createCaller(ctx(2, 3)).annualProgress({ year: 2026 });
    expect(result.year).toBe(2026);
    expect(mocks.active).toHaveBeenCalledWith(expect.objectContaining({ id: "operator-one" }), "valid-session", 2);
    expect(mocks.aggregate).toHaveBeenCalledWith(2026, 2, 3);
    expect(queryParts.where?.params).toEqual(["operator-one", 2, 3]);
    expect(queryParts.where?.sql).toContain('"userCompanies"."branchId" is null'.replaceAll('"', '`'));
    expect(queryParts.join?.params).toEqual([3, 2, true]);
    expect(mocks.access.mock.invocationCallOrder[0]).toBeLessThan(mocks.aggregate.mock.invocationCallOrder[0]);
  });
  it("nega filial sem vínculo e não consulta metas/receita", async () => {
    mocks.access.mockResolvedValue([]);
    await expect(testRouter.createCaller(ctx(1, 9)).annualProgress({ year: 2026 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
  it("nega empresa ou filial ausente/inválida antes de ler dados", async () => {
    for (const [companyId, branchId] of [[0, 1], [1, 0], [-1, 1], [1, -1], [1.5, 1]]) {
      await expect(testRouter.createCaller(ctx(companyId, branchId)).annualProgress({ year: 2026 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }
    const context = ctx(); context.activeBranchId = undefined;
    await expect(testRouter.createCaller(context).annualProgress({ year: 2026 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
  it("rejeita tentativas de forçar outra empresa/filial via input", async () => {
    await expect(testRouter.createCaller(ctx()).annualProgress({ year: 2026, companyId: 99 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(testRouter.createCaller(ctx()).annualProgress({ year: 2026, branchId: 99 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
  it("rejeita anos não inteiros ou fora do intervalo", async () => {
    for (const year of [2026.5, 1999, 2101]) await expect(testRouter.createCaller(ctx()).annualProgress({ year })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
  it("continua exigindo autenticação e respeitando sessão bloqueada", async () => {
    const context = ctx(); context.user = null;
    await expect(testRouter.createCaller(context).annualProgress({ year: 2026 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    mocks.active.mockRejectedValue(new Error("Sessão bloqueada"));
    await expect(testRouter.createCaller(ctx()).annualProgress({ year: 2026 })).rejects.toThrow("Sessão bloqueada");
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
  it("falha claramente sem banco disponível, sem responder receita zero falsa", async () => {
    mocks.getDb.mockResolvedValue(null);
    await expect(testRouter.createCaller(ctx()).annualProgress({ year: 2026 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
});
