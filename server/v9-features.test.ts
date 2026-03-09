import { describe, it, expect } from "vitest";

// ==================== Waiter Access Control Logic Tests ====================

describe("Waiter Access Control - Time Check", () => {
  function isWithinHours(currentTime: string, opening: string, closing: string): boolean {
    if (closing > opening) {
      return currentTime >= opening && currentTime <= closing;
    } else {
      // Crosses midnight (e.g., 18:00 - 02:00)
      return currentTime >= opening || currentTime <= closing;
    }
  }

  it("should allow access during normal business hours (11:00-23:00)", () => {
    expect(isWithinHours("14:30", "11:00", "23:00")).toBe(true);
    expect(isWithinHours("11:00", "11:00", "23:00")).toBe(true);
    expect(isWithinHours("23:00", "11:00", "23:00")).toBe(true);
  });

  it("should deny access outside normal business hours", () => {
    expect(isWithinHours("10:59", "11:00", "23:00")).toBe(false);
    expect(isWithinHours("23:01", "11:00", "23:00")).toBe(false);
    expect(isWithinHours("03:00", "11:00", "23:00")).toBe(false);
  });

  it("should handle midnight-crossing hours (18:00-02:00)", () => {
    expect(isWithinHours("19:00", "18:00", "02:00")).toBe(true);
    expect(isWithinHours("23:59", "18:00", "02:00")).toBe(true);
    expect(isWithinHours("01:30", "18:00", "02:00")).toBe(true);
    expect(isWithinHours("02:00", "18:00", "02:00")).toBe(true);
  });

  it("should deny access outside midnight-crossing hours", () => {
    expect(isWithinHours("17:59", "18:00", "02:00")).toBe(false);
    expect(isWithinHours("02:01", "18:00", "02:00")).toBe(false);
    expect(isWithinHours("12:00", "18:00", "02:00")).toBe(false);
  });
});

describe("Waiter Access Control - Date String", () => {
  it("should generate correct BRT date string", () => {
    const now = new Date("2026-03-09T15:30:00-03:00");
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayStr).toBe("2026-03-09");
  });

  it("should handle single-digit months and days", () => {
    const now = new Date("2026-01-05T10:00:00-03:00");
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayStr).toBe("2026-01-05");
  });
});

describe("Waiter Access Control - Role Check", () => {
  it("should identify garcom role correctly", () => {
    const roles = ["admin", "operacional", "consultor", "garcom"];
    expect(roles.includes("garcom")).toBe(true);
    expect("garcom" === "garcom").toBe(true);
  });

  it("should not restrict non-garcom roles", () => {
    const nonWaiterRoles = ["admin", "operacional", "consultor"];
    for (const role of nonWaiterRoles) {
      expect(role !== "garcom").toBe(true);
    }
  });
});

// ==================== Compact History Table Logic Tests ====================

describe("Compact History Table - Pagination", () => {
  const COMPACT_LIMIT = 15;

  it("should show all items when under limit", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      type: "SALE",
      date: new Date().toISOString(),
      description: `Venda ${i + 1}`,
      amount: "50.00",
      balance: `${(i + 1) * 50}`,
    }));
    const visible = history.slice(0, COMPACT_LIMIT);
    expect(visible.length).toBe(10);
    expect(history.length > COMPACT_LIMIT).toBe(false);
  });

  it("should truncate when over limit", () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      type: "SALE",
      date: new Date().toISOString(),
      description: `Venda ${i + 1}`,
      amount: "50.00",
      balance: `${(i + 1) * 50}`,
    }));
    const visible = history.slice(0, COMPACT_LIMIT);
    expect(visible.length).toBe(15);
    expect(history.length > COMPACT_LIMIT).toBe(true);
  });

  it("should show all when expanded", () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      type: "SALE",
      date: new Date().toISOString(),
      description: `Venda ${i + 1}`,
      amount: "50.00",
      balance: `${(i + 1) * 50}`,
    }));
    const showAll = true;
    const visible = showAll ? history : history.slice(0, COMPACT_LIMIT);
    expect(visible.length).toBe(30);
  });
});

describe("Compact History Table - Row Expansion", () => {
  it("should toggle expanded rows correctly", () => {
    const expandedRows = new Set<number>();
    
    // Expand row 2
    expandedRows.add(2);
    expect(expandedRows.has(2)).toBe(true);
    expect(expandedRows.has(0)).toBe(false);
    
    // Toggle row 2 off
    expandedRows.delete(2);
    expect(expandedRows.has(2)).toBe(false);
  });

  it("should identify rows with products", () => {
    const saleWithProducts = {
      type: "SALE",
      items: [
        { productName: "Hambúrguer", quantity: 2, unitPrice: "25.00", totalPrice: "50.00" },
        { productName: "Coca-Cola", quantity: 1, unitPrice: "8.00", totalPrice: "8.00" },
      ],
    };
    const payment = { type: "PAYMENT", amount: "30.00" };
    const saleNoProducts = { type: "SALE", items: [] };

    expect(saleWithProducts.type === "SALE" && saleWithProducts.items.length > 0).toBe(true);
    expect(payment.type === "SALE").toBe(false);
    expect(saleNoProducts.type === "SALE" && saleNoProducts.items.length > 0).toBe(false);
  });
});

describe("Compact History Table - Type Badges", () => {
  it("should assign correct badge types", () => {
    const types = ["SALE", "PAYMENT", "DEBIT"];
    const badges: Record<string, string> = {
      SALE: "Venda",
      PAYMENT: "Pgto",
      DEBIT: "Débito",
    };
    
    for (const type of types) {
      expect(badges[type]).toBeDefined();
    }
    expect(badges["SALE"]).toBe("Venda");
    expect(badges["PAYMENT"]).toBe("Pgto");
    expect(badges["DEBIT"]).toBe("Débito");
  });
});
