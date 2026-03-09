import { describe, it, expect } from "vitest";

// ==================== Waiter Access Control Logic Tests ====================
// Tests the priority: check-in active > schedule restriction

type AccessResult = {
  allowed: boolean;
  reason: string | null;
  outsideHours?: boolean;
  needsCheckIn?: boolean;
};

function checkWaiterAccess(params: {
  isGarcom: boolean;
  accessControlEnabled: boolean;
  requireCheckIn: boolean;
  hasActiveCheckIn: boolean;
  withinHours: boolean;
  openingTime: string;
  closingTime: string;
}): AccessResult {
  // Not a waiter → always allowed
  if (!params.isGarcom) return { allowed: true, reason: null };

  // Access control disabled → always allowed
  if (!params.accessControlEnabled) return { allowed: true, reason: null };

  // FIRST: check-in active overrides schedule
  if (params.hasActiveCheckIn) {
    return { allowed: true, reason: null };
  }

  // No active check-in: check schedule
  if (!params.withinHours) {
    if (params.requireCheckIn) {
      return {
        allowed: false,
        reason: `Fora do horário (${params.openingTime} - ${params.closingTime}). Solicite liberação ao gerente.`,
        outsideHours: true,
        needsCheckIn: true,
      };
    }
    return {
      allowed: false,
      reason: `Acesso permitido apenas entre ${params.openingTime} e ${params.closingTime}`,
      outsideHours: true,
    };
  }

  // Within hours: check if check-in required
  if (params.requireCheckIn) {
    return {
      allowed: false,
      reason: 'Aguardando liberação do administrador. Solicite o check-in ao gerente.',
      needsCheckIn: true,
    };
  }

  return { allowed: true, reason: null };
}

describe("Waiter Access Control - Check-in overrides schedule", () => {
  it("should allow access when check-in is active even OUTSIDE operating hours", () => {
    const result = checkWaiterAccess({
      isGarcom: true,
      accessControlEnabled: true,
      requireCheckIn: true,
      hasActiveCheckIn: true,
      withinHours: false, // 00:14 - outside 11:00-23:00
      openingTime: "11:00",
      closingTime: "23:00",
    });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("should allow access when check-in is active and WITHIN operating hours", () => {
    const result = checkWaiterAccess({
      isGarcom: true,
      accessControlEnabled: true,
      requireCheckIn: true,
      hasActiveCheckIn: true,
      withinHours: true,
      openingTime: "11:00",
      closingTime: "23:00",
    });
    expect(result.allowed).toBe(true);
  });

  it("should BLOCK when no check-in and outside hours (with requireCheckIn)", () => {
    const result = checkWaiterAccess({
      isGarcom: true,
      accessControlEnabled: true,
      requireCheckIn: true,
      hasActiveCheckIn: false,
      withinHours: false,
      openingTime: "11:00",
      closingTime: "23:00",
    });
    expect(result.allowed).toBe(false);
    expect(result.outsideHours).toBe(true);
    expect(result.needsCheckIn).toBe(true);
    expect(result.reason).toContain("Solicite liberação");
  });

  it("should BLOCK when no check-in and outside hours (without requireCheckIn)", () => {
    const result = checkWaiterAccess({
      isGarcom: true,
      accessControlEnabled: true,
      requireCheckIn: false,
      hasActiveCheckIn: false,
      withinHours: false,
      openingTime: "11:00",
      closingTime: "23:00",
    });
    expect(result.allowed).toBe(false);
    expect(result.outsideHours).toBe(true);
    expect(result.needsCheckIn).toBeUndefined();
  });

  it("should BLOCK when within hours but no check-in and requireCheckIn is true", () => {
    const result = checkWaiterAccess({
      isGarcom: true,
      accessControlEnabled: true,
      requireCheckIn: true,
      hasActiveCheckIn: false,
      withinHours: true,
      openingTime: "11:00",
      closingTime: "23:00",
    });
    expect(result.allowed).toBe(false);
    expect(result.needsCheckIn).toBe(true);
    expect(result.reason).toContain("Aguardando liberação");
  });

  it("should ALLOW when within hours and requireCheckIn is false", () => {
    const result = checkWaiterAccess({
      isGarcom: true,
      accessControlEnabled: true,
      requireCheckIn: false,
      hasActiveCheckIn: false,
      withinHours: true,
      openingTime: "11:00",
      closingTime: "23:00",
    });
    expect(result.allowed).toBe(true);
  });

  it("should always allow non-garcom users", () => {
    const result = checkWaiterAccess({
      isGarcom: false,
      accessControlEnabled: true,
      requireCheckIn: true,
      hasActiveCheckIn: false,
      withinHours: false,
      openingTime: "11:00",
      closingTime: "23:00",
    });
    expect(result.allowed).toBe(true);
  });

  it("should allow when access control is disabled", () => {
    const result = checkWaiterAccess({
      isGarcom: true,
      accessControlEnabled: false,
      requireCheckIn: true,
      hasActiveCheckIn: false,
      withinHours: false,
      openingTime: "11:00",
      closingTime: "23:00",
    });
    expect(result.allowed).toBe(true);
  });
});

describe("Waiter Access Control - Schedule boundary", () => {
  function isWithinHours(currentTime: string, opening: string, closing: string): boolean {
    if (closing > opening) {
      return currentTime >= opening && currentTime <= closing;
    } else {
      // Crosses midnight (e.g., 18:00 - 02:00)
      return currentTime >= opening || currentTime <= closing;
    }
  }

  it("should handle normal range (11:00-23:00)", () => {
    expect(isWithinHours("15:00", "11:00", "23:00")).toBe(true);
    expect(isWithinHours("00:14", "11:00", "23:00")).toBe(false);
    expect(isWithinHours("10:59", "11:00", "23:00")).toBe(false);
    expect(isWithinHours("23:01", "11:00", "23:00")).toBe(false);
  });

  it("should handle midnight-crossing range (18:00-02:00)", () => {
    expect(isWithinHours("19:00", "18:00", "02:00")).toBe(true);
    expect(isWithinHours("01:30", "18:00", "02:00")).toBe(true);
    expect(isWithinHours("15:00", "18:00", "02:00")).toBe(false);
    expect(isWithinHours("03:00", "18:00", "02:00")).toBe(false);
  });
});
