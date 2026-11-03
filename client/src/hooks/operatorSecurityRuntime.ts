import {
  nextDailyLoginCutoff,
  type OperatorSessionState,
  type OperatorSessionStatus,
} from "../../../shared/sessionSecurity";

export const OPERATOR_ACTIVITY_THROTTLE_MS = 15_000;
export const OPERATOR_STATUS_POLL_MS = 15_000;
export const OPERATOR_SIGNAL_CHANNEL = "abrwf-operator-security-v1";
export const OPERATOR_SIGNAL_STORAGE_KEY = "abrwf-operator-security-signal";
export type OperatorSignalType = "lock" | "logout" | "status";
export type OperatorSignal = { type: OperatorSignalType; nonce: string };

export function isOperatorSignal(value: unknown): value is OperatorSignal {
  if (!value || typeof value !== "object") return false;
  const signal = value as Partial<OperatorSignal>;
  return ["lock", "logout", "status"].includes(signal.type ?? "") &&
    typeof signal.nonce === "string" && signal.nonce.length <= 100;
}

/** Activity comes exclusively from browser-generated discrete input events. */
export function isTrustedOperatorActivity(event: Pick<Event, "isTrusted" | "type">): boolean {
  return event.isTrusted && ["pointerdown", "keydown", "touchstart"].includes(event.type);
}

export function isValidOperatorPin(pin: string): boolean {
  return /^[0-9]{6}$/.test(pin);
}

export function operatorDeadline(status: OperatorSessionStatus): number {
  const idleDeadline = status.lastActivityAt == null
    ? status.serverNow
    : status.lastActivityAt + status.idleMinutes * 60_000;
  const dailyDeadline = nextDailyLoginCutoff(status.serverNow);
  return Math.min(idleDeadline, status.expiresAt ?? dailyDeadline, dailyDeadline);
}

export function effectiveOperatorState(
  status: OperatorSessionStatus,
  estimatedServerNow: number,
): OperatorSessionState {
  if (status.state !== "ACTIVE") return status.state;
  const dailyDeadline = Math.min(
    status.expiresAt ?? Number.POSITIVE_INFINITY,
    nextDailyLoginCutoff(status.serverNow),
  );
  if (estimatedServerNow >= dailyDeadline) return "LOGIN_REQUIRED";
  if (estimatedServerNow >= operatorDeadline(status)) return "LOCKED";
  return "ACTIVE";
}

/**
 * The non-secret sessionRef separates browser sessions without exposing raw sid.
 * Legacy responses use identity + cutoff as a conservative fallback; only a
 * server-provided fingerprint distinguishes same-operator sessions reliably.
 */
export function operatorIdentitySignature(status: OperatorSessionStatus): string {
  if (!status.user) return "signed-out";
  return JSON.stringify([
    status.user.id,
    status.sessionRef ?? status.expiresAt ?? null,
  ]);
}

/** All other queries, including personal security history, are operator-scoped. */
export function isOperatorStatusQuery(queryKey: readonly unknown[]): boolean {
  const path = queryKey[0];
  return Array.isArray(path) && path.length === 2 &&
    path[0] === "operatorSecurity" && path[1] === "status";
}

export function remainingCooldownSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
