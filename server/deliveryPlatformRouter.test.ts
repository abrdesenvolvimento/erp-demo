import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getSales: vi.fn(), getSalesStats: vi.fn(), getSalesForExport: vi.fn(), getSale: vi.fn(), getSaleItems: vi.fn(),
  createSale: vi.fn(), updateSale: vi.fn(), createAuditLog: vi.fn(), updateProductStock: vi.fn(), deleteSaleItems: vi.fn(), createSaleItem: vi.fn(), active: vi.fn(),
}));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()),
  getSales: mocks.getSales, getSalesStats: mocks.getSalesStats, getSalesForExport: mocks.getSalesForExport,
  getSale: mocks.getSale, getSaleItems: mocks.getSaleItems, createSale: mocks.createSale, updateSale: mocks.updateSale,
  createAuditLog: mocks.createAuditLog, updateProductStock: mocks.updateProductStock,
  deleteSaleItems: mocks.deleteSaleItems, createSaleItem: mocks.createSaleItem,
}));
vi.mock("./operatorSecurity", async importOriginal => ({ ...(await importOriginal<typeof import("./operatorSecurity")>()), assertOperatorActive: mocks.active }));
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context = (companyId: number | undefined = 1, role = "admin"): TrpcContext => ({
  user: { id: "admin-unit", name: "Administrador teste", role } as TrpcContext["user"],
  req: {} as TrpcContext["req"], res: {} as TrpcContext["res"], activeCompanyId: companyId, activeBranchId: 2, operatorSessionId: "test-session",
});
const create = { saleType: "DELIVERY" as const, channelId: 2, platformOrderId: "67890", subtotal: "10.00", finalAmount: "10.00", paymentMethod: "PIX", items: [{ productId: 1, quantity: 1, unitPrice: "10.00", totalPrice: "10.00" }] };
const oldSale = { id: 12, companyId: 1, branchId: 4, saleType: "DELIVERY", deliveryPlatform: null, effectiveDeliveryPlatform: "IFOOD", saleDate: "2025-01-01 12:00:00", platformOrderId: "67890", channelId: 2, finalAmount: "99.00", status: "ACTIVE" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.active.mockResolvedValue(undefined);
  mocks.getSales.mockResolvedValue([]); mocks.getSalesStats.mockResolvedValue({}); mocks.getSalesForExport.mockResolvedValue([]);
  mocks.createSale.mockResolvedValue(99); mocks.getSale.mockResolvedValue({ ...oldSale }); mocks.getSaleItems.mockResolvedValue([]);
  mocks.updateSale.mockResolvedValue(undefined); mocks.createAuditLog.mockResolvedValue(undefined);
});

describe("Origem delivery — contrato tRPC mockado sem database", () => {
  it("nova manual delivery exige escolha explícita, não default iFood, e rejeita sentinela/valor inválido", async () => {
    const caller = appRouter.createCaller(context());
    for (const deliveryPlatform of [undefined, null, "NAO_INFORMADO", "HACK"]) {
      await expect(caller.sales.create({ ...create, deliveryPlatform } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(mocks.createSale).not.toHaveBeenCalled();
  });
  it.each(["IFOOD", "99FOOD", "PROPRIO", "OUTRO"] as const)("criação envia %s e preserva canal e Pedido", async deliveryPlatform => {
    await appRouter.createCaller(context(2)).sales.create({ ...create, deliveryPlatform });
    expect(mocks.createSale).toHaveBeenCalledWith(expect.objectContaining({ deliveryPlatform, companyId: 2, branchId: 2, channelId: 2, platformOrderId: "67890" }), create.items);
  });
  it("caller antigo não delivery continua válido e limpa NULL, sem exigir plataforma", async () => {
    const caller = appRouter.createCaller(context());
    await caller.sales.create({ ...create, saleType: "BALCAO" });
    expect(mocks.createSale).toHaveBeenLastCalledWith(expect.objectContaining({ saleType: "BALCAO", deliveryPlatform: null }), create.items);
    await caller.sales.create({ ...create, saleType: "SALAO", deliveryPlatform: "IFOOD" });
    expect(mocks.createSale).toHaveBeenLastCalledWith(expect.objectContaining({ saleType: "SALAO", deliveryPlatform: null }), create.items);
  });
  it.each(["IFOOD", "99FOOD", "PROPRIO", "OUTRO", "NAO_INFORMADO"] as const)("filtro %s segue para listagem, indicadores e export por empresa ativa", async deliveryPlatform => {
    const caller = appRouter.createCaller(context(2));
    await caller.sales.list({ deliveryPlatform });
    await caller.sales.stats({ period: "all", deliveryPlatform });
    await caller.sales.exportSales({ deliveryPlatform });
    expect(mocks.getSales).toHaveBeenCalledWith(expect.objectContaining({ companyId: 2, deliveryPlatform }));
    expect(mocks.getSalesStats).toHaveBeenCalledWith("all", undefined, undefined, undefined, 2, deliveryPlatform);
    expect(mocks.getSalesForExport).toHaveBeenCalledWith(expect.objectContaining({ companyId: 2, deliveryPlatform }));
  });
  it("metadata-only altera somente plataforma, auditada e scoped, até em venda antiga, sem valores/datas/estoque", async () => {
    await appRouter.createCaller(context()).sales.updateDeliveryPlatform({ saleId: 12, deliveryPlatform: "99FOOD" });
    expect(mocks.getSale).toHaveBeenCalledWith(12, 1);
    expect(mocks.updateSale).toHaveBeenCalledWith(12, { deliveryPlatform: "99FOOD" }, 1);
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ companyId: 1, branchId: 4, entityId: 12, action: "EDICAO", userId: "admin-unit", changes: [{ field: "deliveryPlatform", label: "Plataforma", oldValue: null, newValue: "99FOOD" }] }));
    for (const fn of [mocks.getSaleItems, mocks.updateProductStock, mocks.deleteSaleItems, mocks.createSaleItem]) expect(fn).not.toHaveBeenCalled();
    expect(oldSale.finalAmount).toBe("99.00");
    expect(oldSale.saleDate).toBe("2025-01-01 12:00:00");
  });
  it("manter NULL legado não grava origem derivada nem gera auditoria falsa", async () => {
    await appRouter.createCaller(context()).sales.updateDeliveryPlatform({ saleId: 12, deliveryPlatform: null });
    expect(mocks.updateSale).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });
  it("edição normal sem campo plataforma preserva legado NULL ou origem explícita", async () => {
    const { getNowInBrazil } = await import("../shared/dateUtils");
    const caller = appRouter.createCaller(context());
    for (const deliveryPlatform of [null, "99FOOD"]) {
      mocks.getSale.mockResolvedValue({ ...oldSale, saleDate: getNowInBrazil().toISOString(), deliveryPlatform });
      await caller.sales.update({ saleId: 12, items: create.items, platformOrderId: "Pedido-alterado" });
      const patch = mocks.updateSale.mock.lastCall![1];
      expect(patch).not.toHaveProperty("deliveryPlatform");
      expect(patch.platformOrderId).toBe("Pedido-alterado");
      expect(mocks.updateSale.mock.lastCall![2]).toBe(1);
    }
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });
  it("edição normal com plataforma explícita envia patch e auditoria, e não delivery limpa NULL", async () => {
    const { getNowInBrazil } = await import("../shared/dateUtils");
    const caller = appRouter.createCaller(context());
    mocks.getSale.mockResolvedValue({ ...oldSale, saleDate: getNowInBrazil().toISOString() });
    await caller.sales.update({ saleId: 12, items: create.items, deliveryPlatform: "PROPRIO" });
    expect(mocks.updateSale).toHaveBeenLastCalledWith(12, expect.objectContaining({ deliveryPlatform: "PROPRIO" }), 1);
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ changes: [{ field: "deliveryPlatform", label: "Plataforma", oldValue: null, newValue: "PROPRIO" }] }));
    mocks.getSale.mockResolvedValue({ ...oldSale, saleType: "BALCAO", saleDate: getNowInBrazil().toISOString(), deliveryPlatform: "IFOOD" });
    await caller.sales.update({ saleId: 12, items: create.items });
    expect(mocks.updateSale).toHaveBeenLastCalledWith(12, expect.objectContaining({ deliveryPlatform: null }), 1);
  });
  it("nega edição de outro company/nonDelivery/não admin sem escrita", async () => {
    const caller = appRouter.createCaller(context());
    mocks.getSale.mockResolvedValue(null);
    await expect(caller.sales.updateDeliveryPlatform({ saleId: 12, deliveryPlatform: "IFOOD" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    mocks.getSale.mockResolvedValue({ ...oldSale, saleType: "BALCAO" });
    await expect(caller.sales.updateDeliveryPlatform({ saleId: 12, deliveryPlatform: "IFOOD" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(appRouter.createCaller(context(1, "operacional")).sales.updateDeliveryPlatform({ saleId: 12, deliveryPlatform: "IFOOD" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.updateSale).not.toHaveBeenCalled();
  });
  it("listagem, stats, export e create negam empresa ausente antes de helpers", async () => {
    const ctx = context(); ctx.activeCompanyId = undefined;
    const caller = appRouter.createCaller(ctx);
    for (const promise of [caller.sales.list(), caller.sales.stats(), caller.sales.exportSales(), caller.sales.create({ ...create, deliveryPlatform: "IFOOD" })]) {
      await expect(promise).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }
    expect(mocks.getSales).not.toHaveBeenCalled(); expect(mocks.getSalesStats).not.toHaveBeenCalled();
    expect(mocks.getSalesForExport).not.toHaveBeenCalled(); expect(mocks.createSale).not.toHaveBeenCalled();
  });
});
