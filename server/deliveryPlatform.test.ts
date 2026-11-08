import { describe, expect, it } from "vitest";
import { deliveryPlatformForWrite, formatDeliveryPlatform, resolveDeliveryPlatform } from "../shared/deliveryPlatforms";

const uuid = "8c2186f0-1420-4eb8-b891-ea2c57ac50d7";
const sale = { id: 10, companyId: 1, saleType: "DELIVERY", deliveryPlatform: null };
const proof = { saleId: 10, companyId: 1, ifoodOrderId: uuid };

describe("Plataforma delivery — resolução pura sem reclassificação histórica", () => {
  it.each(["IFOOD", "99FOOD", "PROPRIO", "OUTRO"] as const)("origem salva %s prevalece sobre evidência iFood", platform => {
    expect(resolveDeliveryPlatform({ ...sale, deliveryPlatform: platform }, [proof])).toBe(platform);
  });
  it("reconhece somente UUID vinculado à venda da mesma empresa", () => {
    expect(resolveDeliveryPlatform(sale, [proof])).toBe("IFOOD");
    expect(resolveDeliveryPlatform(sale, [{ ...proof, companyId: 2 }])).toBeNull();
    expect(resolveDeliveryPlatform(sale, [{ ...proof, saleId: 11 }])).toBeNull();
    expect(resolveDeliveryPlatform(sale, [{ ...proof, companyId: null }])).toBeNull();
    expect(resolveDeliveryPlatform(sale, [{ ...proof, saleId: null }])).toBeNull();
  });
  it.each(["67890", "IFOOD-67890", "", "99-12345", "not-a-uuid"])("pedido curto/texto %s não é evidência", ifoodOrderId => {
    expect(resolveDeliveryPlatform(sale, [{ ...proof, ifoodOrderId }])).toBeNull();
  });
  it("não presume 99Food, nem infere de canal/nome/observações", () => {
    const legacy = { ...sale, channelId: 2, channelName: "iFood", platformOrderId: "99-12345", notes: "Importado iFood" };
    expect(resolveDeliveryPlatform(legacy, [])).toBeNull();
    expect(formatDeliveryPlatform(resolveDeliveryPlatform(legacy, []))).toBe("Não informada");
  });
  it("saleType não delivery sempre é NULL e valor salvo desconhecido não cai no fallback", () => {
    expect(resolveDeliveryPlatform({ ...sale, saleType: "SALAO", deliveryPlatform: "IFOOD" }, [proof])).toBeNull();
    expect(resolveDeliveryPlatform({ ...sale, deliveryPlatform: "INVALIDO" }, [proof])).toBeNull();
  });
  it("não modifica registros, valores, datas, canais ou evidência durante a resolução", () => {
    const frozen = Object.freeze({ ...sale, finalAmount: "100.00", saleDate: "2026-01-10", channelId: 2, platformOrderId: "67890" });
    expect(resolveDeliveryPlatform(frozen, Object.freeze([Object.freeze(proof)]))).toBe("IFOOD");
    expect(frozen.deliveryPlatform).toBeNull();
    expect(frozen.finalAmount).toBe("100.00");
    expect(frozen.platformOrderId).toBe("67890");
  });
  it("patch ausente preserva delivery; mudança não delivery limpa NULL", () => {
    expect(deliveryPlatformForWrite("DELIVERY", undefined)).toBeUndefined();
    expect(deliveryPlatformForWrite("DELIVERY", null)).toBeNull();
    expect(deliveryPlatformForWrite("DELIVERY", "99FOOD")).toBe("99FOOD");
    for (const type of ["BALCAO", "A_PRAZO", "SALAO"]) {
      expect(deliveryPlatformForWrite(type, "IFOOD")).toBeNull();
      expect(deliveryPlatformForWrite(type, undefined)).toBeNull();
    }
  });
});
