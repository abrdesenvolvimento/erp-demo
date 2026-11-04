import {
  nextDailyLoginCutoff,
  type OperatorSessionState,
  type OperatorSessionStatus,
} from "../../../shared/sessionSecurity";

export const OPERATOR_ACTIVITY_THROTTLE_MS = 5_000;
export const OPERATOR_STATUS_POLL_MS = 15_000;
export const OPERATOR_SIGNAL_CHANNEL = "abrwf-operator-security-v1";
export const OPERATOR_SIGNAL_STORAGE_KEY = "abrwf-operator-security-signal";
export type OperatorSignalType = "lock" | "logout" | "status" | "unlocked";
export type OperatorSignal = { type: OperatorSignalType; nonce: string };

export function isOperatorSignal(value: unknown): value is OperatorSignal {
  if (!value || typeof value !== "object") return false;
  const signal = value as Partial<OperatorSignal>;
  return ["lock", "logout", "status", "unlocked"].includes(signal.type ?? "") &&
    typeof signal.nonce === "string" && signal.nonce.length > 0 && signal.nonce.length <= 100;
}

// Scroll can be trusted even when caused by script. Movement/focus/polls are not activity.
export const OPERATOR_ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel", "input"] as const;
export function isTrustedOperatorActivity(event: Pick<Event, "isTrusted" | "type">): boolean {
  return event.isTrusted && (OPERATOR_ACTIVITY_EVENTS as readonly string[]).includes(event.type);
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

/** Non-secret sessionRef separates sessions; a company change is not an operator change. */
export function operatorIdentitySignature(status: OperatorSessionStatus): string {
  if (!status.user) return "signed-out";
  return JSON.stringify([status.user.id, status.sessionRef ?? status.expiresAt ?? null]);
}

export type OperatorUiSnapshot = {
  epoch: number;
  status?: OperatorSessionStatus;
  receivedAt: number;
  block: "LOCKED" | "LOGIN_REQUIRED" | "VERIFYING" | null;
  awaitingRelease: boolean;
  unavailable: boolean;
};

export function initialOperatorUiSnapshot(): OperatorUiSnapshot {
  return { epoch: 0, receivedAt: 0, block: null, awaitingRelease: false, unavailable: false };
}

/** One generation owns each response. An ordinary refresh never conceals an active screen. */
export function beginOperatorStatusCheck(snapshot: OperatorUiSnapshot, signal: OperatorSignalType = "status"): OperatorUiSnapshot {
  return {
    ...snapshot,
    epoch: snapshot.epoch + 1,
    block: signal === "lock" ? "LOCKED" : signal === "logout" ? "LOGIN_REQUIRED"
      : signal === "unlocked" ? "VERIFYING" : snapshot.block,
    awaitingRelease: signal === "unlocked" ? true : signal === "status" ? snapshot.awaitingRelease : false,
  };
}

export function finishOperatorStatusCheck(
  snapshot: OperatorUiSnapshot,
  epoch: number,
  status: OperatorSessionStatus | undefined,
  receivedAt: number,
  error = false,
): OperatorUiSnapshot {
  if (snapshot.epoch !== epoch) return snapshot;
  if (error || !status) return { ...snapshot, unavailable: true };
  if (snapshot.status?.state === "ACTIVE" && !snapshot.awaitingRelease &&
    effectiveOperatorState(snapshot.status, operatorUiServerNow(snapshot, receivedAt)) === "LOGIN_REQUIRED") {
    snapshot = { ...snapshot, block: "LOGIN_REQUIRED" };
  }
  const sameIdentity = snapshot.status && operatorIdentitySignature(snapshot.status) === operatorIdentitySignature(status);
  // Do not roll the accepted clock/activity backwards or allow 04h to roll into tomorrow.
  if (sameIdentity && status.serverNow < snapshot.status!.serverNow) return snapshot;
  const dailyLimit = Math.min(status.expiresAt ?? Infinity, nextDailyLoginCutoff(status.serverNow),
    sameIdentity ? Math.min(snapshot.status!.expiresAt ?? Infinity, nextDailyLoginCutoff(snapshot.status!.serverNow)) : Infinity);
  const accepted = { ...status, expiresAt: status.user ? dailyLimit : status.expiresAt };
  const clockNow = sameIdentity ? Math.max(status.serverNow, operatorUiServerNow(snapshot, receivedAt)) : status.serverNow;
  const clockReceipt = receivedAt - (clockNow - status.serverNow);
  const freshActive = effectiveOperatorState(accepted, clockNow) === "ACTIVE";
  // A lock signal can precede the server mutation. ACTIVE cannot clear its latch.
  // Successful PIN stays disabled through stale LOCKED data and auth hydration.
  const terminal = ["LOGIN_REQUIRED", "SIGNED_OUT"].includes(effectiveOperatorState(accepted, clockNow));
  const block = terminal ? snapshot.block === "LOGIN_REQUIRED" || accepted.state === "LOGIN_REQUIRED" ? "LOGIN_REQUIRED" : null
    : snapshot.awaitingRelease ? freshActive ? null : "VERIFYING"
    : (!snapshot.status || sameIdentity) && (snapshot.block === "LOCKED" || snapshot.block === "LOGIN_REQUIRED") ? snapshot.block : null;
  return { ...snapshot, status: accepted, receivedAt: clockReceipt, block,
    awaitingRelease: snapshot.awaitingRelease && !freshActive && !terminal, unavailable: false };
}

export function operatorUiServerNow(snapshot: OperatorUiSnapshot, now: number): number {
  return snapshot.status ? snapshot.status.serverNow + Math.max(0, now - snapshot.receivedAt) : now;
}

/** All other queries, including personal security history, are operator-scoped. */
export function isOperatorStatusQuery(queryKey: readonly unknown[]): boolean {
  const path = queryKey[0];
  return Array.isArray(path) && path.length === 2 && path[0] === "operatorSecurity" && path[1] === "status";
}

export function remainingCooldownSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
