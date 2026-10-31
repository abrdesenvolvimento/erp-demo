import { describe, expect, it } from "vitest";
import { centsToNumber, normalizeIfoodOrderPricing } from "./ifoodPricing";

describe("normalizeIfoodOrderPricing", () => {
  it.each([
    ["2531", [{ quantidade: 13, valor: 38.87 }, { quantidade: 0, valor: 2.99 }], 38.87, 13, 299],
    ["9723", [{ quantidade: 15, valor: 46.35 }, { quantidade: 0, valor: 3.09 }], 46.35, 15, 309],
    ["6098", [{ quantidade: 24, valor: 105.36 }, { quantidade: 0, valor: 4.39 }], 105.36, 24, 439],
    ["0372", [{ quantidade: 2, valor: 95.88, quantidadeMultiplicadora: 6 }], 95.88, 12, 799],
    ["7579", [{ quantidade: 2, valor: 95.88, quantidadeMultiplicadora: 6 }], 95.88, 12, 799],
  ])("normaliza o pedido %s sem multiplicar novamente um total de linha", (_code, items, total, expectedQuantity, expectedUnitCents) => {
    const result = normalizeIfoodOrderPricing(items, total);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      quantity: expectedQuantity,
      unitPriceCents: expectedUnitCents,
      lineTotalCents: Math.round(total * 100),
      priceMode: "LINE_TOTAL",
    });
    expect(centsToNumber(result.officialTotalCents)).toBe(total);
  });

  it("preserva uma linha unitária e normaliza apenas a linha totalizada do pedido misto 9128", () => {
    const result = normalizeIfoodOrderPricing([
      { quantidade: 0, valor: 5.49 },
      { quantidade: 2, valor: 10.98 },
      { quantidade: 1, valor: 9.19 },
      { quantidade: 12, valor: 65.88 },
    ], 97.03);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.items.map(item => ({
      quantity: item.quantity,
      unitPrice: centsToNumber(item.unitPriceCents),
      total: centsToNumber(item.lineTotalCents),
      mode: item.priceMode,
    }))).toEqual([
      { quantity: 2, unitPrice: 10.98, total: 21.96, mode: "UNIT" },
      { quantity: 1, unitPrice: 9.19, total: 9.19, mode: "LINE_TOTAL" },
      { quantity: 12, unitPrice: 5.49, total: 65.88, mode: "LINE_TOTAL" },
    ]);
  });

  it("ignora quantidade zero, sem criar unidade fantasma nem total de venda", () => {
    const result = normalizeIfoodOrderPricing([
      { quantidade: 0, valor: 8.29 },
      { quantidade: 6, valor: 49.74 },
    ], 49.74);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(6);
    expect(centsToNumber(result.items[0].lineTotalCents)).toBe(49.74);
  });

  it("normaliza o combo 8 de Amstel em 16 unidades de estoque", () => {
    const result = normalizeIfoodOrderPricing([
      { quantidade: 2, valor: 70.24, quantidadeMultiplicadora: 8 },
    ], 70.24);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.items[0]).toMatchObject({
      sourceQuantity: 2,
      quantityMultiplier: 8,
      quantity: 16,
      unitPriceCents: 439,
      lineTotalCents: 7024,
    });
  });

  it("recusa pedido sem interpretação única em vez de gravar uma suposição", () => {
    const result = normalizeIfoodOrderPricing([
      { quantidade: 2, valor: 10 },
      { quantidade: 2, valor: 10 },
    ], 30);

    expect(result).toEqual({
      ok: false,
      reason: "O pedido possui mais de uma interpretação de preço possível e exige revisão manual.",
    });
  });

  it("recusa total que não gera preço unitário inteiro em centavos", () => {
    const result = normalizeIfoodOrderPricing([{ quantidade: 3, valor: 10 }], 10);

    expect(result).toEqual({
      ok: false,
      reason: "Linha 1 não possui preço unitário exato em centavos.",
    });
  });
});
