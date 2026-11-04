import { describe, expect, it } from "vitest";
import {
  beginOperatorStatusCheck, effectiveOperatorState, finishOperatorStatusCheck,
  initialOperatorUiSnapshot, operatorIdentitySignature, operatorUiServerNow,
  type OperatorUiSnapshot,
} from "../client/src/hooks/operatorSecurityRuntime";
import type { OperatorSessionStatus } from "../shared/sessionSecurity";

const now = Date.parse("2026-11-15T12:00:00-03:00");
const session = (overrides: Partial<OperatorSessionStatus> = {}): OperatorSessionStatus => ({
  state: "ACTIVE", user: { id: "a", name: "A", avatarUrl: null }, company: null,
  sessionRef: "session-a", idleMinutes: 1, serverNow: now, lastActivityAt: now,
  expiresAt: Date.parse("2026-11-16T04:00:00-03:00"), retryAfterSeconds: 0, hasPin: true, ...overrides,
});
const accepted = (status = session()) => finishOperatorStatusCheck(initialOperatorUiSnapshot(), 0, status, now);
const refresh = (snapshot: OperatorUiSnapshot, status: OperatorSessionStatus, receivedAt = now) => {
  const checking = beginOperatorStatusCheck(snapshot);
  return finishOperatorStatusCheck(checking, checking.epoch, status, receivedAt);
};

describe("Operator UI response generations and fail-closed transitions", () => {
  it("keeps an already ACTIVE identity and deadline untouched while ordinary refresh is pending", () => {
    const before = accepted();
    const pending = beginOperatorStatusCheck(before);
    expect(pending.status).toBe(before.status);
    expect(pending.receivedAt).toBe(before.receivedAt);
    expect(pending.block).toBe(null);
    expect(pending.awaitingRelease).toBe(false);
    expect(effectiveOperatorState(pending.status!, operatorUiServerNow(pending, now + 60_000))).toBe("LOCKED");
  });
  it("company/policy updates preserve identity but a genuinely shortened policy can lock", () => {
    const before = accepted(session({ idleMinutes: 5 }));
    const after = refresh(before, session({ serverNow: now + 90_000, company: { id: 2, name: "B", logoUrl: null } }), now + 90_000);
    expect(operatorIdentitySignature(after.status!)).toBe(operatorIdentitySignature(before.status!));
    expect(effectiveOperatorState(after.status!, operatorUiServerNow(after, now + 90_000))).toBe("LOCKED");
  });
  it.each(["lock", "logout"] as const)("%s conceals immediately and ignores a pre-signal ACTIVE response", signal => {
    const pending = beginOperatorStatusCheck(accepted());
    const blocked = beginOperatorStatusCheck(pending, signal);
    expect(blocked.block).toBe(signal === "lock" ? "LOCKED" : "LOGIN_REQUIRED");
    expect(finishOperatorStatusCheck(blocked, pending.epoch, session(), now)).toBe(blocked);
  });
  it("a lock mutation starting before server commit cannot be undone by a fresh ACTIVE status", () => {
    const locked = beginOperatorStatusCheck(accepted(), "lock");
    const after = finishOperatorStatusCheck(locked, locked.epoch, session({ serverNow: now + 10 }), now + 10);
    expect(after.block).toBe("LOCKED");
    const serverLocked = refresh(after, session({ state: "LOCKED", serverNow: now + 20 }), now + 20);
    expect(refresh(serverLocked, session({ serverNow: now + 30 }), now + 30).block).toBe("LOCKED");
  });
  it("PIN success stays VERIFYING for stale LOCKED status, then only fresh ACTIVE releases", () => {
    const before = accepted(session({ state: "LOCKED" }));
    const pending = beginOperatorStatusCheck(before, "unlocked");
    expect(pending.block).toBe("VERIFYING");
    expect(pending.awaitingRelease).toBe(true);
    const stale = finishOperatorStatusCheck(pending, pending.epoch, session({ state: "LOCKED" }), now);
    expect(stale.block).toBe("VERIFYING");
    expect(stale.awaitingRelease).toBe(true);
    const fresh = refresh(stale, session({ serverNow: now + 100, lastActivityAt: now + 100 }), now + 100);
    expect(fresh.block).toBe(null);
    expect(fresh.awaitingRelease).toBe(false);
    // The gate additionally requires auth.me hydration, covered by the mocked gate tests.
  });
  it("stale LOCKED response cannot overwrite post-PIN ACTIVE", () => {
    const old = beginOperatorStatusCheck(accepted(session({ state: "LOCKED" })));
    const pin = beginOperatorStatusCheck(old, "unlocked");
    const fresh = finishOperatorStatusCheck(pin, pin.epoch, session({ serverNow: now + 100 }), now + 100);
    expect(finishOperatorStatusCheck(fresh, old.epoch, session({ state: "LOCKED" }), now + 200)).toBe(fresh);
  });
  it("server timestamps never move backwards and client receipt/input cannot extend idle", () => {
    const fresh = accepted(session({ serverNow: now + 100, lastActivityAt: now + 100 }));
    const checking = beginOperatorStatusCheck(fresh);
    expect(finishOperatorStatusCheck(checking, checking.epoch, session(), now + 300)).toBe(checking);
    expect(effectiveOperatorState(fresh.status!, operatorUiServerNow(fresh, now + 60_000))).toBe("LOCKED");
  });
  it("only acknowledged server activity extends idle, never expiry/cutoff", () => {
    const before = accepted();
    const after = refresh(before, session({ serverNow: now + 30_000, lastActivityAt: now + 30_000 }), now + 30_000);
    expect(effectiveOperatorState(after.status!, operatorUiServerNow(after, now + 60_000))).toBe("ACTIVE");
    expect(after.status!.expiresAt).toBe(before.status!.expiresAt);
  });
  it("04h is fixed for the session even if an ACTIVE response arrives after cutoff", () => {
    const cutoff = Date.parse("2026-11-16T04:00:00-03:00");
    for (const expiresAt of [null, cutoff + 86_400_000]) {
      const before = accepted(session({ serverNow: cutoff - 10_000, lastActivityAt: cutoff - 10_000, expiresAt }));
      const after = refresh(before, session({ serverNow: cutoff + 1000, lastActivityAt: cutoff + 1000, expiresAt: cutoff + 86_400_000 }), now + 11_000);
      expect(after.status!.expiresAt).toBe(cutoff);
      expect(effectiveOperatorState(after.status!, operatorUiServerNow(after, now + 11_000))).toBe("LOGIN_REQUIRED");
    }
  });
  it("network errors stay fail-closed without treating cache as PIN rejection or permission", () => {
    const pin = beginOperatorStatusCheck(accepted(session({ state: "LOCKED" })), "unlocked");
    const failed = finishOperatorStatusCheck(pin, pin.epoch, undefined, now + 100, true);
    expect(failed.unavailable).toBe(true);
    expect(failed.block).toBe("VERIFYING");
    expect(failed.awaitingRelease).toBe(true);
    expect(failed.status!.state).toBe("LOCKED");
    const retried = refresh(failed, session({ serverNow: now + 200 }), now + 200);
    expect(retried.unavailable).toBe(false);
    expect(retried.block).toBe(null);
  });
  it("fresh LOGIN_REQUIRED takes precedence over waiting for PIN release", () => {
    const pin = beginOperatorStatusCheck(accepted(session({ state: "LOCKED" })), "unlocked");
    const expired = finishOperatorStatusCheck(pin, pin.epoch, session({ state: "LOGIN_REQUIRED" }), now);
    expect(expired.block).toBe("LOGIN_REQUIRED");
    expect(expired.awaitingRelease).toBe(false);
  });
  it("a delayed snapshot cannot move the estimated server clock backwards and revive idle access", () => {
    const before = accepted();
    const after = refresh(before, session({ serverNow: now + 5000 }), now + 60_000);
    expect(operatorUiServerNow(after, now + 60_000)).toBe(now + 60_000);
    expect(effectiveOperatorState(after.status!, operatorUiServerNow(after, now + 60_000))).toBe("LOCKED");
  });
  it("lock before initial response remains closed; a genuinely different operator can hydrate", () => {
    const locked = beginOperatorStatusCheck(initialOperatorUiSnapshot(), "lock");
    const current = finishOperatorStatusCheck(locked, locked.epoch, session(), now);
    expect(current.block).toBe("LOCKED");
    const changed = refresh(current, session({ sessionRef: "new-session", user: { id: "b", name: "B", avatarUrl: null } }));
    expect(changed.block).toBe(null);
    expect(operatorIdentitySignature(changed.status!)).not.toBe(operatorIdentitySignature(current.status!));
  });
});
