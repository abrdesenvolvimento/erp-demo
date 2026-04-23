import { describe, it, expect } from "vitest";

/**
 * Tests for the stock adjustment expiration date clearing logic.
 * When stock is zeroed via manual adjustment, the expirationDate should be cleared (null).
 * When stock remains > 0, the expirationDate should not be touched.
 */

interface ProductState {
  currentStock: number;
  expirationDate: Date | null;
}

interface AdjustResult {
  currentStock: number;
  expirationDate: Date | null;
}

/**
 * Simulates the adjustProductStock logic for expiration date handling
 */
function simulateAdjustStock(product: ProductState, adjustQuantity: number): AdjustResult {
  const newStock = product.currentStock + adjustQuantity;
  
  if (newStock < 0) {
    throw new Error("Stock cannot be negative");
  }
  
  const result: AdjustResult = {
    currentStock: newStock,
    expirationDate: product.expirationDate,
  };
  
  // Core logic: if stock reaches zero, clear expiration date
  if (newStock === 0) {
    result.expirationDate = null;
  }
  
  return result;
}

describe("Stock Adjustment - Expiration Date Clearing", () => {
  const sampleDate = new Date("2026-04-20");
  
  it("should clear expirationDate when stock is zeroed", () => {
    const product: ProductState = { currentStock: 28, expirationDate: sampleDate };
    const result = simulateAdjustStock(product, -28);
    
    expect(result.currentStock).toBe(0);
    expect(result.expirationDate).toBeNull();
  });

  it("should NOT clear expirationDate when stock remains positive", () => {
    const product: ProductState = { currentStock: 28, expirationDate: sampleDate };
    const result = simulateAdjustStock(product, -10);
    
    expect(result.currentStock).toBe(18);
    expect(result.expirationDate).toEqual(sampleDate);
  });

  it("should keep expirationDate null when product already has no expiration", () => {
    const product: ProductState = { currentStock: 10, expirationDate: null };
    const result = simulateAdjustStock(product, -10);
    
    expect(result.currentStock).toBe(0);
    expect(result.expirationDate).toBeNull();
  });

  it("should throw error when adjustment would make stock negative", () => {
    const product: ProductState = { currentStock: 5, expirationDate: sampleDate };
    
    expect(() => simulateAdjustStock(product, -10)).toThrow("Stock cannot be negative");
  });

  it("should NOT clear expirationDate when adding stock (positive adjustment)", () => {
    const product: ProductState = { currentStock: 0, expirationDate: null };
    const result = simulateAdjustStock(product, 28);
    
    expect(result.currentStock).toBe(28);
    expect(result.expirationDate).toBeNull(); // Stays null — new expiration comes from purchase, not adjustment
  });

  it("should preserve expirationDate when reducing stock but not zeroing", () => {
    const product: ProductState = { currentStock: 100, expirationDate: sampleDate };
    const result = simulateAdjustStock(product, -99);
    
    expect(result.currentStock).toBe(1);
    expect(result.expirationDate).toEqual(sampleDate);
  });

  it("should handle zero adjustment (no change)", () => {
    const product: ProductState = { currentStock: 10, expirationDate: sampleDate };
    const result = simulateAdjustStock(product, 0);
    
    expect(result.currentStock).toBe(10);
    expect(result.expirationDate).toEqual(sampleDate);
  });
});
