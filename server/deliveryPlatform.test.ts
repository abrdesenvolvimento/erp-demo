import { describe, expect, it } from "vitest";
import { deliveryPlatformForWrite, deliveryPlatformFromChannelCode, formatDeliveryPlatform, resolveDeliveryPlatform } from "../shared/deliveryPlatforms";

const uuid = "8c2186f0-1420-4eb8-b891-ea2c57ac50d7";
const sale = { id: 10, companyId: 1, saleType: "DELIVERY", deliveryPlatform: null, channelId: 3 };
const proof = { saleId: 10, companyId: 1, ifoodOrderId: uuid };
const channel = { id: 3, companyId: 1, code: "99FOOD", type: "DELIVERY" };

describe("Plataforma delivery — resolução pura sem reclassificação histórica", () => {
  it.each(["IFOOD", "99FOOD", "PROPRIO", "OUTRO"] as const)("origem salva %s prevalece sobre importação e canal contraditórios", platform => {
    expect(resolveDeliveryPlatform({ ...sale, deliveryPlatform: platform }, [proof], [channel])).toBe(platform);
  });
  it("reconhece somente UUID vinculado à venda da mesma empresa e mantém dois argumentos compatíveis", () => {
    expect(resolveDeliveryPlatform(sale, [proof])).toBe("IFOOD");
    expect(resolveDeliveryPlatform(sale, [{ ...proof, companyId: 2 }])).toBeNull();
    expect(resolveDeliveryPlatform(sale, [{ ...proof, saleId: 11 }])).toBeNull();
    expect(resolveDeliveryPlatform(sale, [{ ...proof, companyId: null }])).toBeNull();
    expect(resolveDeliveryPlatform(sale, [{ ...proof, saleId: null }])).toBeNull();
    expect(resolveDeliveryPlatform(sale, [proof], [channel])).toBe("IFOOD");
  });
  it.each(["67890", "IFOOD-67890", "", "99-12345", "not-a-uuid"])("pedido curto/texto %s não é evidência de importação", ifoodOrderId => {
    expect(resolveDeliveryPlatform(sale, [{ ...proof, ifoodOrderId }])).toBeNull();
    expect(resolveDeliveryPlatform(sale, [{ ...proof, ifoodOrderId }], [channel])).toBe("99FOOD");
  });
  it.each(["IFOOD", "99FOOD"] as const)("somente código exato %s do canal vinculado e mesma empresa é evidência", code => {
    expect(resolveDeliveryPlatform(sale, [], [{ ...channel, code }])).toBe(code);
    expect(resolveDeliveryPlatform(sale, [], [{ ...channel, code, companyId: 2 }])).toBeNull();
    expect(resolveDeliveryPlatform(sale, [], [{ ...channel, code, companyId: null }])).toBeNull();
    expect(resolveDeliveryPlatform(sale, [], [{ ...channel, code, id: 4 }])).toBeNull();
    expect(resolveDeliveryPlatform({ ...sale, channelId: null }, [], [{ ...channel, code }])).toBeNull();
    expect(resolveDeliveryPlatform({ ...sale, channelId: undefined }, [], [{ ...channel, code }])).toBeNull();
    expect(deliveryPlatformFromChannelCode(code)).toBe(code);
  });
  it.each(["DELIVERY", "PROPRIO", "OUTRO", "99food", "ifood", "IFOOD-1", "DELIVERY_99FOOD", " 99FOOD", "IFOOD ", ""])("código genérico/parecido %s não permite inferência", code => {
    expect(deliveryPlatformFromChannelCode(code)).toBeNull();
    const namedChannel = { ...channel, code, name: "Delivery 99Food iFood" };
    expect(resolveDeliveryPlatform(sale, [], [namedChannel])).toBeNull();
  });
  it("oito vendas do canal 99FOOD exibem 99Food sem backfill: sete NULL e uma explícita permanecem intactas", () => {
    const sales = Object.freeze(Array.from({ length: 8 }, (_, index) => Object.freeze({
      ...sale, id: 216900001 + index, branchId: 1,
      deliveryPlatform: index === 7 ? "99FOOD" : null,
      saleDate: "2026-11-08", finalAmount: "10.00",
    })));
    expect(sales.map(row => resolveDeliveryPlatform(row, [], [channel]))).toEqual(Array(8).fill("99FOOD"));
    expect(sales.slice(0, 7).every(row => row.deliveryPlatform === null)).toBe(true);
    expect(sales[7].deliveryPlatform).toBe("99FOOD");
    expect(sales.every(row => row.channelId === 3 && row.companyId === 1 && row.branchId === 1)).toBe(true);
  });
  it("não presume plataforma por nome, pedido, observações ou datas", () => {
    const legacy = { ...sale, channelName: "iFood", platformOrderId: "99-12345", notes: "Importado iFood", saleDate: "2026-11-08" };
    expect(resolveDeliveryPlatform(legacy, [])).toBeNull();
    expect(formatDeliveryPlatform(resolveDeliveryPlatform(legacy, []))).toBe("Não informada");
  });
  it("saleType não delivery sempre é NULL e valor salvo desconhecido não cai no fallback", () => {
    expect(resolveDeliveryPlatform({ ...sale, saleType: "SALAO", deliveryPlatform: "IFOOD" }, [proof], [channel])).toBeNull();
    expect(resolveDeliveryPlatform({ ...sale, deliveryPlatform: "INVALIDO" }, [proof], [channel])).toBeNull();
  });
  it("não modifica registros, valores, datas, canais ou evidência durante a resolução", () => {
    const frozen = Object.freeze({ ...sale, finalAmount: "100.00", saleDate: "2026-01-10", platformOrderId: "67890" });
    const channels = Object.freeze([Object.freeze(channel)]);
    expect(resolveDeliveryPlatform(frozen, Object.freeze([Object.freeze(proof)]), channels)).toBe("IFOOD");
    expect(resolveDeliveryPlatform(frozen, [], channels)).toBe("99FOOD");
    expect(frozen.deliveryPlatform).toBeNull();
    expect(frozen.finalAmount).toBe("100.00");
    expect(frozen.platformOrderId).toBe("67890");
    expect(frozen.channelId).toBe(3);
    expect(channels[0].code).toBe("99FOOD");
  });
  it("escrita na criação preserva delivery; não delivery limpa NULL", () => {
    expect(deliveryPlatformForWrite("DELIVERY", undefined)).toBeUndefined();
    expect(deliveryPlatformForWrite("DELIVERY", null)).toBeNull();
    expect(deliveryPlatformForWrite("DELIVERY", "99FOOD")).toBe("99FOOD");
    for (const type of ["BALCAO", "A_PRAZO", "SALAO"]) {
      expect(deliveryPlatformForWrite(type, "IFOOD")).toBeNull();
      expect(deliveryPlatformForWrite(type, undefined)).toBeNull();
    }
  });
});
