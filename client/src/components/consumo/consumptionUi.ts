import { parseDateBR, toDateStringBR } from "../../lib/dateUtils";

export type ConsumptionScope = { companyId: number; branchId: number };
export type ConsumptionProduct = {
  id: number;
  name: string;
  uom: string;
  currentStock: string | number | null;
  avgCost: string | number | null;
  isComposite: boolean;
  branchId: number | null;
};
export type ConsumptionDraftItem = {
  product: ConsumptionProduct;
  quantity: string;
};
export type ConsumptionPayload = ConsumptionScope & {
  employeeId: number;
  reason: string;
  items: { productId: number; quantity: number }[];
};
export type RequestAttempt = { fingerprint: string; requestKey: string };

export function currentConsumptionMonth(now = new Date()) {
  const month = toDateStringBR(now).slice(0, 7);
  const first = parseDateBR(`${month}-01`);
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 15)
  );
  return { startDate: `${month}-01`, endDate: toDateStringBR(last) };
}

export function validConsumptionPeriod(startDate: string, endDate: string) {
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(parseDateBR(value).getTime()) &&
    toDateStringBR(parseDateBR(value)) === value;
  return (
    (!startDate || validDate(startDate)) &&
    (!endDate || validDate(endDate)) &&
    (!startDate || !endDate || startDate <= endDate)
  );
}

export function consumptionPermissions(role: string | null | undefined) {
  return {
    canView: role === "admin" || role === "operacional" || role === "consultor",
    canCreate: role === "admin" || role === "operacional",
    isAdmin: role === "admin",
  };
}

export function positiveIntegerQuantity(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) &&
    quantity > 0 &&
    quantity <= 2147483647
    ? quantity
    : null;
}

export function validateConsumptionDraft(
  employeeId: number | null,
  employeeActive: boolean,
  reason: string,
  items: ConsumptionDraftItem[]
) {
  if (!employeeId || !employeeActive) return "Selecione um funcionário ativo.";
  if (reason.trim().length < 3)
    return "Informe um motivo com pelo menos 3 caracteres.";
  if (!items.length) return "Adicione pelo menos um produto.";
  if (items.length > 100) return "Registre no máximo 100 produtos por consumo.";
  if (new Set(items.map(item => item.product.id)).size !== items.length)
    return "Há produtos repetidos nos itens.";
  for (const item of items) {
    const quantity = positiveIntegerQuantity(item.quantity);
    if (quantity === null)
      return `Informe uma quantidade inteira positiva para ${item.product.name}.`;
    // Compostos baixam ingredientes: o saldo do produto-pai não é disponibilidade.
    if (
      !item.product.isComposite &&
      quantity > Number(item.product.currentStock ?? 0)
    ) {
      return `Estoque insuficiente para ${item.product.name}.`;
    }
  }
  return null;
}

/** Apenas previsão visual; o servidor calcula e persiste o custo definitivo. */
export function estimatedConsumptionCost(items: ConsumptionDraftItem[]) {
  return items.reduce(
    (sum, item) => {
      const quantity = positiveIntegerQuantity(item.quantity);
      const cost =
        item.product.avgCost === null ? NaN : Number(item.product.avgCost);
      if (
        sum === null ||
        item.product.isComposite ||
        quantity === null ||
        !Number.isFinite(cost) ||
        cost < 0
      )
        return null;
      return sum + quantity * cost;
    },
    0 as number | null
  );
}

export function consumptionFingerprint(payload: ConsumptionPayload) {
  return JSON.stringify({
    ...payload,
    reason: payload.reason.trim(),
    items: [...payload.items].sort((a, b) => a.productId - b.productId),
  });
}

/** Reutiliza a chave após falha ambígua; um payload diferente inicia outra tentativa. */
export function getConsumptionAttempt(
  previous: RequestAttempt | null,
  payload: ConsumptionPayload,
  uuid: () => string = () => globalThis.crypto.randomUUID()
): RequestAttempt {
  const fingerprint = consumptionFingerprint(payload);
  return previous?.fingerprint === fingerprint
    ? previous
    : { fingerprint, requestKey: uuid() };
}

export function consumptionCurrency(value: string | number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value)))
    return "—";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function consumptionNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value)))
    return "—";
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

export function consumptionDateTime(
  value: string | number | Date | null | undefined
) {
  if (value === null || value === undefined) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
}
