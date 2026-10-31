export type IfoodPriceMode = "UNIT" | "LINE_TOTAL";

export interface RawIfoodItemForPricing {
  quantidade?: unknown;
  valor?: unknown;
  quantidadeMultiplicadora?: unknown;
}

export interface NormalizedIfoodItem {
  sourceIndex: number;
  sourceQuantity: number;
  quantityMultiplier: number;
  quantity: number;
  sourceValueCents: number;
  unitPriceCents: number;
  lineTotalCents: number;
  priceMode: IfoodPriceMode;
}

export type IfoodPricingResult =
  | {
      ok: true;
      officialTotalCents: number;
      items: NormalizedIfoodItem[];
    }
  | {
      ok: false;
      reason: string;
    };

const MAX_PRICING_CANDIDATES = 12;
const MAX_PRICING_COMBINATIONS = 4096;

/** Converte um valor monetário decimal em centavos de forma determinística. */
export function toCents(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const normalized = String(value).trim().replace(",", ".");
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2)) * (Number(whole) < 0 ? -1 : 1);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function centsToNumber(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function parseStrictPositiveInt(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Normaliza um pedido cuja exportação do iFood pode misturar, linha a linha,
 * preço unitário e total da linha. O cabeçalho valor_total_dos_itens é a
 * âncora oficial. Linhas com quantidade zero não são faturáveis.
 */
export function normalizeIfoodOrderPricing(
  rawItems: RawIfoodItemForPricing[],
  officialItemsTotal: unknown,
): IfoodPricingResult {
  const officialTotalCents = toCents(officialItemsTotal);
  if (officialTotalCents === null || officialTotalCents < 0) {
    return { ok: false, reason: "O pedido não possui um total oficial de itens válido." };
  }

  const candidates: Array<{
    sourceIndex: number;
    sourceQuantity: number;
    quantityMultiplier: number;
    quantity: number;
    sourceValueCents: number;
  }> = [];

  for (let sourceIndex = 0; sourceIndex < rawItems.length; sourceIndex += 1) {
    const rawItem = rawItems[sourceIndex];
    const sourceQuantityNumber = Number(rawItem.quantidade ?? 0);

    // Itens indisponíveis e desistências do iFood chegam como quantidade zero.
    // Eles não podem virar uma unidade por fallback.
    if (!Number.isInteger(sourceQuantityNumber) || sourceQuantityNumber <= 0) continue;

    const sourceValueCents = toCents(rawItem.valor);
    if (sourceValueCents === null || sourceValueCents < 0) {
      return { ok: false, reason: `Linha ${sourceIndex + 1} possui valor inválido.` };
    }

    const quantityMultiplier = parseStrictPositiveInt(rawItem.quantidadeMultiplicadora, 1);
    if (!quantityMultiplier) {
      return { ok: false, reason: `Linha ${sourceIndex + 1} possui multiplicador de combo inválido.` };
    }

    const quantity = sourceQuantityNumber * quantityMultiplier;
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { ok: false, reason: `Linha ${sourceIndex + 1} possui quantidade normalizada inválida.` };
    }

    candidates.push({
      sourceIndex,
      sourceQuantity: sourceQuantityNumber,
      quantityMultiplier,
      quantity,
      sourceValueCents,
    });
  }

  if (candidates.length === 0) {
    return { ok: false, reason: "O pedido não possui itens faturáveis com quantidade positiva." };
  }

  const pricingCandidates = candidates.filter(item => item.sourceQuantity > 1);
  if (pricingCandidates.length > MAX_PRICING_CANDIDATES) {
    return { ok: false, reason: "O pedido excede o limite seguro de linhas para normalização automática." };
  }

  const combinations = 2 ** pricingCandidates.length;
  if (combinations > MAX_PRICING_COMBINATIONS) {
    return { ok: false, reason: "O pedido excede o limite seguro de combinações de preço." };
  }

  const validSolutions: Array<Map<number, IfoodPriceMode>> = [];

  for (let mask = 0; mask < combinations; mask += 1) {
    const modes = new Map<number, IfoodPriceMode>();
    let totalCents = 0;

    for (const item of candidates) {
      const candidateIndex = pricingCandidates.findIndex(candidate => candidate.sourceIndex === item.sourceIndex);
      const mode: IfoodPriceMode = candidateIndex >= 0 && ((mask >> candidateIndex) & 1) === 1
        ? "UNIT"
        : "LINE_TOTAL";

      // Para quantidade 1, os dois modos são equivalentes; fixamos LINE_TOTAL
      // para que a solução permaneça determinística.
      const lineTotalCents = mode === "UNIT"
        ? item.sourceValueCents * item.sourceQuantity
        : item.sourceValueCents;

      totalCents += lineTotalCents;
      modes.set(item.sourceIndex, mode);
    }

    if (totalCents === officialTotalCents) validSolutions.push(modes);
  }

  if (validSolutions.length === 0) {
    return {
      ok: false,
      reason: "Não foi possível conciliar os itens com o total oficial do pedido sem adivinhação.",
    };
  }

  const semanticKeys = new Set(
    validSolutions.map(solution => candidates
      .map(item => `${item.sourceIndex}:${solution.get(item.sourceIndex)}`)
      .join("|")),
  );

  if (semanticKeys.size !== 1) {
    return {
      ok: false,
      reason: "O pedido possui mais de uma interpretação de preço possível e exige revisão manual.",
    };
  }

  const solution = validSolutions[0];
  const normalizedItems: NormalizedIfoodItem[] = [];

  for (const item of candidates) {
    const priceMode = solution.get(item.sourceIndex)!;
    const lineTotalCents = priceMode === "UNIT"
      ? item.sourceValueCents * item.sourceQuantity
      : item.sourceValueCents;

    // O ERP armazena preço unitário com duas casas. Recusar qualquer fração
    // evita criar uma venda cujo total não seja igual a quantidade × preço.
    if (lineTotalCents % item.quantity !== 0) {
      return {
        ok: false,
        reason: `Linha ${item.sourceIndex + 1} não possui preço unitário exato em centavos.`,
      };
    }

    normalizedItems.push({
      sourceIndex: item.sourceIndex,
      sourceQuantity: item.sourceQuantity,
      quantityMultiplier: item.quantityMultiplier,
      quantity: item.quantity,
      sourceValueCents: item.sourceValueCents,
      unitPriceCents: lineTotalCents / item.quantity,
      lineTotalCents,
      priceMode,
    });
  }

  return {
    ok: true,
    officialTotalCents,
    items: normalizedItems,
  };
}
