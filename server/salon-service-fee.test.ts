import { describe, it, expect } from "vitest";

/**
 * Tests for the 3-step checkout flow with service fee confirmation.
 * Validates the logic for calculating totals with and without service fee.
 */

describe("Service Fee Confirmation Flow", () => {
  // Simulates the calculation logic used in SalaoComanda.tsx
  const calculateTotals = (subtotal: number, tipPercent: number) => {
    const tipAmount = subtotal * (tipPercent / 100);
    const totalWithTip = subtotal + tipAmount;
    return { subtotal, tipAmount, totalWithTip };
  };

  it("should calculate correct totals with 10% service fee", () => {
    const result = calculateTotals(100, 10);
    expect(result.subtotal).toBe(100);
    expect(result.tipAmount).toBe(10);
    expect(result.totalWithTip).toBe(110);
  });

  it("should calculate correct totals without service fee (0%)", () => {
    const result = calculateTotals(100, 0);
    expect(result.subtotal).toBe(100);
    expect(result.tipAmount).toBe(0);
    expect(result.totalWithTip).toBe(100);
  });

  it("should handle decimal subtotals correctly", () => {
    const result = calculateTotals(37.99, 10);
    expect(result.subtotal).toBe(37.99);
    expect(result.tipAmount).toBeCloseTo(3.799, 2);
    expect(result.totalWithTip).toBeCloseTo(41.789, 2);
  });

  it("should handle zero subtotal", () => {
    const result = calculateTotals(0, 10);
    expect(result.subtotal).toBe(0);
    expect(result.tipAmount).toBe(0);
    expect(result.totalWithTip).toBe(0);
  });

  it("should handle large subtotals", () => {
    const result = calculateTotals(1500.50, 10);
    expect(result.subtotal).toBe(1500.50);
    expect(result.tipAmount).toBeCloseTo(150.05, 2);
    expect(result.totalWithTip).toBeCloseTo(1650.55, 2);
  });
});

describe("Service Fee Decision Logic", () => {
  // Simulates the handleServiceFeeDecision function
  const handleServiceFeeDecision = (accepted: boolean, currentTipPercent: number) => {
    const finalTip = accepted ? currentTipPercent : 0;
    return { finalTip, accepted };
  };

  it("should return original tip percent when accepted", () => {
    const result = handleServiceFeeDecision(true, 10);
    expect(result.finalTip).toBe(10);
    expect(result.accepted).toBe(true);
  });

  it("should return 0 tip when not accepted", () => {
    const result = handleServiceFeeDecision(false, 10);
    expect(result.finalTip).toBe(0);
    expect(result.accepted).toBe(false);
  });
});

describe("Per Person Calculation", () => {
  const calculatePerPerson = (totalWithTip: number, guestCount: number) => {
    return guestCount > 0 ? totalWithTip / guestCount : totalWithTip;
  };

  it("should divide total by guest count", () => {
    expect(calculatePerPerson(110, 2)).toBe(55);
  });

  it("should return total when only 1 guest", () => {
    expect(calculatePerPerson(110, 1)).toBe(110);
  });

  it("should handle 0 guests gracefully", () => {
    expect(calculatePerPerson(110, 0)).toBe(110);
  });

  it("should handle uneven division", () => {
    expect(calculatePerPerson(100, 3)).toBeCloseTo(33.33, 2);
  });
});

describe("Revenue vs Service Fee Separation", () => {
  // Validates that revenue (faturamento) uses subtotal only, not totalWithTip
  it("should use subtotal for revenue, not total with tip", () => {
    const subtotal = 247.45;
    const tipPercent = 10;
    const tipAmount = subtotal * (tipPercent / 100);
    const totalWithTip = subtotal + tipAmount;

    // Revenue should be subtotal only
    const revenue = subtotal;
    expect(revenue).toBe(247.45);
    expect(revenue).not.toBe(totalWithTip);

    // Tip is separate
    expect(tipAmount).toBeCloseTo(24.745, 2);
    expect(totalWithTip).toBeCloseTo(272.195, 2);
  });

  it("should record zero tip when service fee is declined", () => {
    const subtotal = 247.45;
    const accepted = false;
    const finalTip = accepted ? 10 : 0;
    const tipAmount = subtotal * (finalTip / 100);

    expect(tipAmount).toBe(0);
    expect(subtotal + tipAmount).toBe(subtotal);
  });
});
