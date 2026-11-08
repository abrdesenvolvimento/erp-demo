export const DELIVERY_PLATFORMS = ["IFOOD", "99FOOD", "PROPRIO", "OUTRO"] as const;
export type DeliveryPlatform = (typeof DELIVERY_PLATFORMS)[number];
export const DELIVERY_PLATFORM_FILTERS = [...DELIVERY_PLATFORMS, "NAO_INFORMADO"] as const;
export type DeliveryPlatformFilter = (typeof DELIVERY_PLATFORM_FILTERS)[number];

export const DELIVERY_PLATFORM_LABELS: Record<DeliveryPlatform, string> = {
  IFOOD: "iFood",
  "99FOOD": "99Food",
  PROPRIO: "Próprio",
  OUTRO: "Outro",
};

export function isDeliveryPlatform(value: unknown): value is DeliveryPlatform {
  return typeof value === "string" && (DELIVERY_PLATFORMS as readonly string[]).includes(value);
}

export function formatDeliveryPlatform(value: unknown): string {
  return isDeliveryPlatform(value) ? DELIVERY_PLATFORM_LABELS[value] : "Não informada";
}

export const IFOOD_ORDER_UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

/** Only explicit, scoped import evidence can identify a legacy sale. Never infer from channel/code/notes. */
export function resolveDeliveryPlatform(
  sale: { id: number; companyId: number; saleType: string; deliveryPlatform?: string | null },
  imports: ReadonlyArray<{ saleId: number | null; companyId: number | null; ifoodOrderId: string }>,
): DeliveryPlatform | null {
  if (sale.saleType !== "DELIVERY") return null;
  if (sale.deliveryPlatform != null) return isDeliveryPlatform(sale.deliveryPlatform) ? sale.deliveryPlatform : null;
  const uuid = new RegExp(IFOOD_ORDER_UUID_PATTERN);
  return imports.some(row => row.companyId === sale.companyId && row.saleId === sale.id && uuid.test(row.ifoodOrderId))
    ? "IFOOD" : null;
}

/** undefined is a backward-compatible patch: preserve stored origin. Non-delivery always clears it. */
export function deliveryPlatformForWrite(
  saleType: string,
  platform: DeliveryPlatform | null | undefined,
): DeliveryPlatform | null | undefined {
  return saleType === "DELIVERY" ? platform : null;
}
