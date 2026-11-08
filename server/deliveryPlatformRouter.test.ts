import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getSales: vi.fn(), getSalesStats: vi.fn(), getSalesForExport: vi.fn(), getSale: vi.fn(), getSaleItems: vi.fn(), getSalesChannel: vi.fn(),
  createSale: vi.fn(), updateSale: vi.fn(), createAuditLog: vi.fn(), updateProductStock: vi.fn(), deleteSaleItems: vi.fn(), createSaleItem: vi.fn(), active: vi.fn(),
}));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()),
  getSales: mocks.getSales, getSalesStats: mocks.getSalesStats, getSalesForExport: mocks.getSalesForExport,
  getSale: mocks.getSale, getSaleItems: mocks.getSaleItems, getSalesChannel: mocks.getSalesChannel,
  createSale: mocks.createSale, updateSale: mocks.updateSale,
  createAuditLog: mocks.createAuditLog, updateProductStock: mocks.updateProductStock,
  deleteSaleItems: mocks.deleteSaleItems, createSaleItem: mocks.createSaleItem,
}));
vi.mock("./operatorSecurity", async importOriginal => ({ ...(await importOriginal<typeof import("./operatorSecurity")>()), assertOperatorActive: mocks.active }));
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getNowInBrazil } from "../shared/dateUtils";

const context = (companyId: number | undefined = 1, role = "admin"): TrpcContext => ({
  user: { id: "admin-unit", name: "Administrador teste", role } as TrpcContext["user"],
  req: {} as TrpcContext["req"], res: {} as TrpcContext["res"], activeCompanyId: companyId, activeBranchId: 2, operatorSessionId: "test-session",
});
const create = { saleType: "DELIVERY" as const, channelId: 2, platformOrderId: "67890", subtotal: "10.00", finalAmount: "10.00", paymentMethod: "PIX", items: [{ productId: 1, quantity: 1, unitPrice: "10.00", totalPrice: "10.00" }] };
const channel = { id: 2, companyId: 1, code: "DELIVERY", name: "Delivery 99Food", type: "DELIVERY" };
const oldSale = { id: 12, companyId: 1, branchId: 4, saleType: "DELIVERY", deliveryPlatform: null, effectiveDeliveryPlatform: "IFOOD", saleDate: "2025-01-01 12:00:00", platformOrderId: "67890", channelId: 2, finalAmount: "99.00", status: "ACTIVE" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.active.mockResolvedValue(undefined);
  mocks.getSales.mockResolvedValue([]); mocks.getSalesStats.mockResolvedValue({}); mocks.getSalesForExport.mockResolvedValue([]);
  mocks.getSalesChannel.mockResolvedValue({ ...channel });
  mocks.createSale.mockResolvedValue(99); mocks.getSale.mockResolvedValue({ ...oldSale }); mocks.getSaleItems.mockResolvedValue([]);
  mocks.updateSale.mockResolvedValue(undefined); mocks.createAuditLog.mockResolvedValue(undefined);
});

function expectNoWrites() {
  for (const fn of [mocks.createSale, mocks.updateSale, mocks.createAuditLog, mocks.updateProductStock, mocks.deleteSaleItems, mocks.createSaleItem]) expect(fn).not.toHaveBeenCalled();
}

describe("Origem delivery — contrato tRPC mockado sem database", () => {
  it("nova manual delivery exige plataforma mesmo com canal identificável e rejeita sentinela/valor inválido", async () => {
    const caller = appRouter.createCaller(context());
    mocks.getSalesChannel.mockResolvedValue({ ...channel, code: "99FOOD" });
    for (const deliveryPlatform of [undefined, null, "NAO_INFORMADO", "HACK"]) {
      await expect(caller.sales.create({ ...create, deliveryPlatform } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(mocks.getSalesChannel).not.toHaveBeenCalled();
    expectNoWrites();
  });
  it.each(["IFOOD", "99FOOD", "PROPRIO", "OUTRO"] as const)("criação em canal genérico envia %s e preserva canal e Pedido", async deliveryPlatform => {
    mocks.getSalesChannel.mockResolvedValue({ ...channel, companyId: 2 });
    await appRouter.createCaller(context(2)).sales.create({ ...create, deliveryPlatform });
    expect(mocks.getSalesChannel).toHaveBeenCalledWith(2);
    expect(mocks.createSale).toHaveBeenCalledWith(expect.objectContaining({ deliveryPlatform, companyId: 2, branchId: 2, channelId: 2, platformOrderId: "67890" }), create.items);
  });
  it.each(["IFOOD", "99FOOD"] as const)("criação persiste %s quando plataforma corresponde ao código exato do canal", async deliveryPlatform => {
    mocks.getSalesChannel.mockResolvedValue({ ...channel, code: deliveryPlatform });
    await appRouter.createCaller(context()).sales.create({ ...create, deliveryPlatform });
    expect(mocks.createSale).toHaveBeenCalledWith(expect.objectContaining({ deliveryPlatform, channelId: 2, platformOrderId: "67890" }), create.items);
  });
  it.each(["IFOOD", "99FOOD"] as const)("canal %s rejeita todas as plataformas contraditórias antes de qualquer escrita", async code => {
    mocks.getSalesChannel.mockResolvedValue({ ...channel, code });
    for (const deliveryPlatform of ["IFOOD", "99FOOD", "PROPRIO", "OUTRO"] as const) {
      if (deliveryPlatform === code) continue;
      await expect(appRouter.createCaller(context()).sales.create({ ...create, deliveryPlatform })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "A plataforma selecionada não corresponde ao canal de venda" });
    }
    expectNoWrites();
  });
  it.each(["99food", "ifood", "PROPRIO", "OUTRO", "DELIVERY_99FOOD"])("código não enumerado %s não bloqueia escolha manual por nome parecido", async code => {
    mocks.getSalesChannel.mockResolvedValue({ ...channel, code });
    await appRouter.createCaller(context()).sales.create({ ...create, deliveryPlatform: "PROPRIO" });
    expect(mocks.createSale).toHaveBeenCalledWith(expect.objectContaining({ deliveryPlatform: "PROPRIO" }), create.items);
  });
  it.each(["DELIVERY", "BALCAO", "SALAO", "A_PRAZO"] as const)("criação %s rejeita canal ausente no cadastro ou de outra empresa antes de writes", async saleType => {
    const caller = appRouter.createCaller(context());
    for (const invalidChannel of [undefined, { ...channel, companyId: 2 }]) {
      mocks.getSalesChannel.mockResolvedValue(invalidChannel);
      await expect(caller.sales.create({ ...create, saleType, deliveryPlatform: "IFOOD" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expectNoWrites();
  });
  it.each([0, -1, 1.5])("criação rejeita channelId inválido %s antes do helper", async channelId => {
    await expect(appRouter.createCaller(context()).sales.create({ ...create, channelId, deliveryPlatform: "IFOOD" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.getSalesChannel).not.toHaveBeenCalled(); expectNoWrites();
  });
  it("caller antigo não delivery continua válido e limpa NULL na criação, sem exigir plataforma", async () => {
    const caller = appRouter.createCaller(context());
    await caller.sales.create({ ...create, saleType: "BALCAO", channelId: undefined });
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
  it("API metadata-only de edição de plataforma foi removida completamente", async () => {
    expect(appRouter._def.procedures).not.toHaveProperty("sales.updateDeliveryPlatform");
    await expect((appRouter.createCaller(context()).sales as any).updateDeliveryPlatform({ saleId: 12, deliveryPlatform: "99FOOD" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expectNoWrites();
  });
  it.each([null, "IFOOD", "99FOOD", "PROPRIO", "OUTRO"] as const)("edição geral rejeita plataforma explícita %s antes de ler/processar estoque", async deliveryPlatform => {
    await expect(appRouter.createCaller(context()).sales.update({ saleId: 12, items: create.items, deliveryPlatform })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "A plataforma só pode ser escolhida ao criar a venda" });
    expect(mocks.getSale).not.toHaveBeenCalled(); expectNoWrites();
  });
  it("edição normal preserva metadata ausente/undefined, itens, valores, Pedido e escopo existentes", async () => {
    const caller = appRouter.createCaller(context());
    for (const deliveryPlatform of [null, "99FOOD"]) {
      mocks.getSale.mockResolvedValue({ ...oldSale, saleDate: getNowInBrazil().toISOString(), deliveryPlatform });
      mocks.getSaleItems.mockResolvedValue([{ productId: 3, quantity: 2 }]);
      await caller.sales.update({ saleId: 12, items: create.items, platformOrderId: "Pedido-alterado", deliveryPlatform: undefined });
      expect(mocks.updateSale).toHaveBeenLastCalledWith(12, { subtotal: "10.00", discountAmount: "0.00", surchargeAmount: "0.00", finalAmount: "10.00", platformOrderId: "Pedido-alterado" }, 1);
      expect(mocks.updateProductStock).toHaveBeenCalledWith(3, 2);
      expect(mocks.updateProductStock).toHaveBeenCalledWith(1, -1);
      expect(mocks.deleteSaleItems).toHaveBeenCalledWith(12);
      expect(mocks.createSaleItem).toHaveBeenCalledWith(expect.objectContaining({ saleId: 12, companyId: 1, branchId: 2, productId: 1 }));
    }
    mocks.getSale.mockResolvedValue({ ...oldSale, saleType: "BALCAO", saleDate: getNowInBrazil().toISOString(), deliveryPlatform: "IFOOD" });
    await caller.sales.update({ saleId: 12, items: create.items });
    expect(mocks.updateSale.mock.lastCall![1]).not.toHaveProperty("deliveryPlatform");
    expect(mocks.updateSale.mock.lastCall![1]).not.toHaveProperty("platformOrderId");
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });
  it("edição normal mantém restrições de empresa, 24 horas e administrador", async () => {
    const caller = appRouter.createCaller(context());
    mocks.getSale.mockResolvedValue(null);
    await expect(caller.sales.update({ saleId: 12, items: create.items })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getSale).toHaveBeenCalledWith(12, 1);
    mocks.getSale.mockResolvedValue({ ...oldSale });
    await expect(caller.sales.update({ saleId: 12, items: create.items })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(appRouter.createCaller(context(1, "operacional")).sales.update({ saleId: 12, items: create.items })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expectNoWrites();
  });
  it("listagem, stats, export e create negam empresa ausente antes de helpers", async () => {
    const ctx = context(); ctx.activeCompanyId = undefined;
    const caller = appRouter.createCaller(ctx);
    for (const promise of [caller.sales.list(), caller.sales.stats(), caller.sales.exportSales(), caller.sales.create({ ...create, deliveryPlatform: "IFOOD" })]) {
      await expect(promise).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }
    expect(mocks.getSales).not.toHaveBeenCalled(); expect(mocks.getSalesStats).not.toHaveBeenCalled();
    expect(mocks.getSalesForExport).not.toHaveBeenCalled(); expect(mocks.getSalesChannel).not.toHaveBeenCalled(); expectNoWrites();
  });
});
