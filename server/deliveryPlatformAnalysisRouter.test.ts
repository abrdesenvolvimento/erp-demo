import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getSalesAnalysisSummary: vi.fn(), getSalesCountByChannel: vi.fn(), getSalesAnalysisByValue: vi.fn(),
  getSalesAnalysisByQuantity: vi.fn(), getSalesAnalysisByCategoryValue: vi.fn(), getSalesAnalysisByDay: vi.fn(),
  getSalesAnalysisByWeek: vi.fn(), getSalesAnalysisByMonth: vi.fn(), getSalesByProductAndDate: vi.fn(),
  getDeliveryProductAnalysis: vi.fn(), active: vi.fn(),
}));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...mocks }));
vi.mock("./operatorSecurity", async importOriginal => ({ ...(await importOriginal<typeof import("./operatorSecurity")>()), assertOperatorActive: mocks.active }));
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context = (companyId = 1, role = "admin"): TrpcContext => ({
  user: { id: "admin-unit", name: "Administrador teste", role } as TrpcContext["user"],
  req: {} as TrpcContext["req"], res: {} as TrpcContext["res"], activeCompanyId: companyId,
  activeBranchId: 2, operatorSessionId: "test-session",
});
const dates = { startDate: new Date("2026-11-01T12:00:00Z"), endDate: new Date("2026-11-08T12:00:00Z") };
const filters = { productIds: [7, 8], subcategoryId: 4, channels: ["DELIVERY"], paymentMethod: "PIX" };
const routes = [
  ["summary", "getSalesAnalysisSummary"], ["countByChannel", "getSalesCountByChannel"],
  ["byValue", "getSalesAnalysisByValue"], ["byQuantity", "getSalesAnalysisByQuantity"],
  ["byCategoryValue", "getSalesAnalysisByCategoryValue"], ["byDay", "getSalesAnalysisByDay"],
  ["byWeek", "getSalesAnalysisByWeek"], ["byMonth", "getSalesAnalysisByMonth"],
  ["byProductAndDate", "getSalesByProductAndDate"],
] as const;
const period1 = dates;
const period2 = { startDate: new Date("2025-11-01T12:00:00Z"), endDate: new Date("2025-11-08T12:00:00Z") };
const compareInput = { period1, period2, ...filters };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.active.mockResolvedValue(undefined);
  for (const [, helper] of routes) mocks[helper].mockResolvedValue([]);
  mocks.getSalesAnalysisSummary.mockResolvedValue({ totalRevenue: 100, totalSales: 3, totalCost: 40 });
  mocks.getDeliveryProductAnalysis.mockResolvedValue({ products: [], channelInfo: null });
});

describe("Origem nas análises — contrato tRPC com helpers mockados", () => {
  it.each([undefined, "IFOOD", "99FOOD", "PROPRIO", "OUTRO", "NAO_INFORMADO"] as const)("todos os endpoints recebem %s, empresa ativa e os demais filtros", async deliveryPlatform => {
    const caller = appRouter.createCaller(context(2));
    for (const [route, helper] of routes) {
      await caller.salesAnalysis[route]({ ...dates, ...filters, deliveryPlatform, companyId: 2 });
      expect(mocks[helper]).toHaveBeenCalledWith(dates.startDate, dates.endDate, 2, { ...filters, deliveryPlatform });
    }
    await caller.dashboard.deliveryProductAnalysis({ startDate: "2026-11-01", endDate: "2026-11-08", categoryId: 4, channelId: 9, deliveryPlatform, companyId: 2 });
    expect(mocks.getDeliveryProductAnalysis).toHaveBeenCalledWith("2026-11-01", "2026-11-08", 4, 2, 9, deliveryPlatform);
  });

  it.each(["value", "quantity"] as const)("comparação %s filtra os dois períodos e os dois totais com a mesma origem", async comparisonType => {
    const caller = appRouter.createCaller(context(2));
    const result = await caller.salesAnalysis.comparePeriods({ ...compareInput, comparisonType, deliveryPlatform: "99FOOD", companyId: 2 });
    const helper = comparisonType === "value" ? mocks.getSalesAnalysisByValue : mocks.getSalesAnalysisByQuantity;
    for (const [index, period] of [period1, period2].entries()) {
      expect(helper).toHaveBeenNthCalledWith(index + 1, period.startDate, period.endDate, 2, { ...filters, deliveryPlatform: "99FOOD" });
      expect(mocks.getSalesAnalysisSummary).toHaveBeenNthCalledWith(index + 1, period.startDate, period.endDate, 2, { ...filters, deliveryPlatform: "99FOOD" });
    }
    expect(result.period1Total).toEqual({ revenue: 100, sales: 3 });
    expect(result.period2Total).toEqual({ revenue: 100, sales: 3 });
  });

  it("callers antigos continuam válidos sem companyId/origem; padrão de período delivery é mantido", async () => {
    const caller = appRouter.createCaller(context());
    for (const [route, helper] of routes) {
      await caller.salesAnalysis[route](dates);
      expect(mocks[helper]).toHaveBeenCalledWith(dates.startDate, dates.endDate, 1, expect.objectContaining({ deliveryPlatform: undefined }));
    }
    await caller.salesAnalysis.comparePeriods({ period1, period2 });
    await caller.dashboard.deliveryProductAnalysis();
    const call = mocks.getDeliveryProductAnalysis.mock.lastCall!;
    expect(call[0]).toMatch(/^\d{4}-\d{2}-01$/);
    expect(call[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(call.slice(2)).toEqual([undefined, 1, undefined, undefined]);
  });

  it.each([undefined, 0, -1, 1.5, NaN])("rejeita empresa ativa inválida %s em todos os caminhos antes dos helpers", async companyId => {
    const ctx = context(); ctx.activeCompanyId = companyId;
    const caller = appRouter.createCaller(ctx);
    for (const [route] of routes) await expect(caller.salesAnalysis[route](dates)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller.salesAnalysis.comparePeriods(compareInput)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller.dashboard.deliveryProductAnalysis()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    for (const [, helper] of routes) expect(mocks[helper]).not.toHaveBeenCalled();
    expect(mocks.getDeliveryProductAnalysis).not.toHaveBeenCalled();
  });

  it("companyId só segrega cache: input divergente não autoriza outra empresa nem devolve cache cruzado", async () => {
    const caller = appRouter.createCaller(context(1));
    for (const [route] of routes) await expect(caller.salesAnalysis[route]({ ...dates, companyId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.salesAnalysis.comparePeriods({ ...compareInput, companyId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.dashboard.deliveryProductAnalysis({ companyId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const [, helper] of routes) expect(mocks[helper]).not.toHaveBeenCalled();
    expect(mocks.getDeliveryProductAnalysis).not.toHaveBeenCalled();
  });

  it.each([null, "HACK", "99food", ""])("origem inválida %s é rejeitada pelo schema em todas as rotas", async deliveryPlatform => {
    const caller = appRouter.createCaller(context());
    for (const [route] of routes) await expect(caller.salesAnalysis[route]({ ...dates, deliveryPlatform } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.salesAnalysis.comparePeriods({ ...compareInput, deliveryPlatform } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.dashboard.deliveryProductAnalysis({ deliveryPlatform } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    for (const [, helper] of routes) expect(mocks[helper]).not.toHaveBeenCalled();
    expect(mocks.getDeliveryProductAnalysis).not.toHaveBeenCalled();
  });

  it("mantém permissão administrativa das análises de vendas e proteção de autenticação", async () => {
    for (const [route] of routes) await expect(appRouter.createCaller(context(1, "operacional")).salesAnalysis[route](dates)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const ctx = context(); ctx.user = null;
    await expect(appRouter.createCaller(ctx).dashboard.deliveryProductAnalysis()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
