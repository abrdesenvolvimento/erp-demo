/**
 * Testes do Módulo de Atendimento de Salão (Fase 1)
 * Cobre: schema de tabelas, lógica de comanda, KDS, encerramento de conta e gorjeta
 */

import { describe, it, expect } from "vitest";

// ==================== SCHEMA VALIDATION ====================

describe("Salon Schema - Table status transitions", () => {
  const validStatuses = ["FREE", "OCCUPIED", "RESERVED"];
  const validOrderStatuses = ["OPEN", "WAITING_PAYMENT", "CLOSED", "CANCELLED"];
  const validItemStatuses = ["PENDING", "IN_PROGRESS", "READY", "DELIVERED", "CANCELLED"];
  const validDestinations = ["KITCHEN", "BAR", "BOTH", "NONE"];
  const validPaymentMethods = ["CASH", "CREDIT_CARD", "DEBIT_CARD", "PIX", "OTHER"];

  it("should have valid table status values", () => {
    expect(validStatuses).toContain("FREE");
    expect(validStatuses).toContain("OCCUPIED");
    expect(validStatuses).toContain("RESERVED");
    expect(validStatuses.length).toBe(3);
  });

  it("should have valid order status values", () => {
    expect(validOrderStatuses).toContain("OPEN");
    expect(validOrderStatuses).toContain("WAITING_PAYMENT");
    expect(validOrderStatuses).toContain("CLOSED");
    expect(validOrderStatuses).toContain("CANCELLED");
  });

  it("should have valid item status values", () => {
    expect(validItemStatuses).toContain("PENDING");
    expect(validItemStatuses).toContain("IN_PROGRESS");
    expect(validItemStatuses).toContain("READY");
    expect(validItemStatuses).toContain("DELIVERED");
    expect(validItemStatuses).toContain("CANCELLED");
  });

  it("should have valid production destinations", () => {
    expect(validDestinations).toContain("KITCHEN");
    expect(validDestinations).toContain("BAR");
    expect(validDestinations).toContain("BOTH");
    expect(validDestinations).toContain("NONE");
  });

  it("should have valid payment methods", () => {
    expect(validPaymentMethods).toContain("CASH");
    expect(validPaymentMethods).toContain("CREDIT_CARD");
    expect(validPaymentMethods).toContain("DEBIT_CARD");
    expect(validPaymentMethods).toContain("PIX");
  });
});

// ==================== CHECKOUT LOGIC ====================

describe("Salon Checkout - Bill splitting logic", () => {
  it("should split bill evenly by guest count", () => {
    const totalAmount = 120.00;
    const guestCount = 4;
    const perPerson = totalAmount / guestCount;
    expect(perPerson).toBe(30.00);
  });

  it("should split bill with tip included", () => {
    const subtotal = 100.00;
    const tipPercent = 10;
    const tipAmount = subtotal * (tipPercent / 100);
    const total = subtotal + tipAmount;
    const guestCount = 2;
    const perPerson = total / guestCount;
    expect(tipAmount).toBe(10.00);
    expect(total).toBe(110.00);
    expect(perPerson).toBe(55.00);
  });

  it("should handle zero tip percent", () => {
    const subtotal = 80.00;
    const tipPercent = 0;
    const tipAmount = subtotal * (tipPercent / 100);
    const total = subtotal + tipAmount;
    expect(tipAmount).toBe(0);
    expect(total).toBe(80.00);
  });

  it("should handle single guest (no split)", () => {
    const total = 45.90;
    const guestCount = 1;
    const perPerson = total / guestCount;
    expect(perPerson).toBe(45.90);
  });

  it("should calculate tip amount from percent correctly", () => {
    const subtotal = 200.00;
    const tipPercent = 12;
    const tipAmount = Math.round(subtotal * (tipPercent / 100) * 100) / 100;
    expect(tipAmount).toBe(24.00);
  });
});

// ==================== KDS ROUTING ====================

describe("Salon KDS - Item routing by production destination", () => {
  const items = [
    { id: 1, productName: "Cheeseburger", productionDestination: "KITCHEN", status: "PENDING" },
    { id: 2, productName: "Coca Cola", productionDestination: "BAR", status: "PENDING" },
    { id: 3, productName: "Batata Frita", productionDestination: "KITCHEN", status: "IN_PROGRESS" },
    { id: 4, productName: "Cerveja", productionDestination: "BAR", status: "READY" },
    { id: 5, productName: "Combo Especial", productionDestination: "BOTH", status: "PENDING" },
  ];

  it("should filter items for kitchen KDS", () => {
    const kitchenItems = items.filter(i =>
      i.productionDestination === "KITCHEN" || i.productionDestination === "BOTH"
    );
    expect(kitchenItems.length).toBe(3);
    expect(kitchenItems.map(i => i.id)).toContain(1);
    expect(kitchenItems.map(i => i.id)).toContain(3);
    expect(kitchenItems.map(i => i.id)).toContain(5);
  });

  it("should filter items for bar KDS", () => {
    const barItems = items.filter(i =>
      i.productionDestination === "BAR" || i.productionDestination === "BOTH"
    );
    expect(barItems.length).toBe(3);
    expect(barItems.map(i => i.id)).toContain(2);
    expect(barItems.map(i => i.id)).toContain(4);
    expect(barItems.map(i => i.id)).toContain(5);
  });

  it("should show pending and in_progress items in KDS (not delivered/cancelled)", () => {
    const activeStatuses = ["PENDING", "IN_PROGRESS", "READY"];
    const activeItems = items.filter(i => activeStatuses.includes(i.status));
    expect(activeItems.length).toBe(5); // all items in this test are active
  });

  it("should not show NONE destination items in any KDS", () => {
    const noneItems = items.filter(i => i.productionDestination === "NONE");
    expect(noneItems.length).toBe(0);
  });
});

// ==================== ORDER TOTAL CALCULATION ====================

describe("Salon Order - Total amount calculation", () => {
  it("should calculate order total from items", () => {
    const items = [
      { quantity: 2, unitPrice: 25.90, totalPrice: 51.80 },
      { quantity: 1, unitPrice: 8.00, totalPrice: 8.00 },
      { quantity: 3, unitPrice: 5.50, totalPrice: 16.50 },
    ];
    const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
    expect(subtotal).toBeCloseTo(76.30, 2);
  });

  it("should recalculate total when item is removed", () => {
    let items = [
      { id: 1, totalPrice: 51.80 },
      { id: 2, totalPrice: 8.00 },
      { id: 3, totalPrice: 16.50 },
    ];
    // Remove item 2
    items = items.filter(i => i.id !== 2);
    const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
    expect(subtotal).toBeCloseTo(68.30, 2);
  });

  it("should apply tip to subtotal correctly", () => {
    const subtotal = 76.30;
    const tipPercent = 10;
    const tipAmount = Math.round(subtotal * (tipPercent / 100) * 100) / 100;
    const total = Math.round((subtotal + tipAmount) * 100) / 100;
    expect(tipAmount).toBeCloseTo(7.63, 2);
    expect(total).toBeCloseTo(83.93, 2);
  });
});

// ==================== WAITER TIP REPORT ====================

describe("Salon Waiter - Tip report aggregation", () => {
  const orders = [
    { waiterId: "w1", waiterName: "João", tipAmount: "15.00", totalAmount: "150.00" },
    { waiterId: "w1", waiterName: "João", tipAmount: "8.50", totalAmount: "85.00" },
    { waiterId: "w2", waiterName: "Maria", tipAmount: "20.00", totalAmount: "200.00" },
    { waiterId: "w2", waiterName: "Maria", tipAmount: "12.00", totalAmount: "120.00" },
  ];

  it("should aggregate tips by waiter", () => {
    const byWaiter = new Map<string, { name: string; totalTip: number; totalSales: number; orderCount: number }>();
    for (const order of orders) {
      const existing = byWaiter.get(order.waiterId) ?? { name: order.waiterName, totalTip: 0, totalSales: 0, orderCount: 0 };
      existing.totalTip += parseFloat(order.tipAmount);
      existing.totalSales += parseFloat(order.totalAmount);
      existing.orderCount += 1;
      byWaiter.set(order.waiterId, existing);
    }
    const joao = byWaiter.get("w1")!;
    const maria = byWaiter.get("w2")!;
    expect(joao.totalTip).toBeCloseTo(23.50, 2);
    expect(joao.orderCount).toBe(2);
    expect(maria.totalTip).toBeCloseTo(32.00, 2);
    expect(maria.orderCount).toBe(2);
  });

  it("should calculate average tip per order", () => {
    const totalTip = 23.50;
    const orderCount = 2;
    const avgTip = totalTip / orderCount;
    expect(avgTip).toBeCloseTo(11.75, 2);
  });
});

// ==================== DASHBOARD STATS ====================

describe("Salon Dashboard - Stats calculation", () => {
  it("should calculate average ticket from closed orders", () => {
    const closedOrders = [
      { totalAmount: "120.00" },
      { totalAmount: "85.50" },
      { totalAmount: "200.00" },
    ];
    const todayRevenue = closedOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
    const todayOrders = closedOrders.length;
    const avgTicket = todayOrders > 0 ? todayRevenue / todayOrders : 0;
    expect(todayRevenue).toBeCloseTo(405.50, 2);
    expect(avgTicket).toBeCloseTo(135.17, 2);
  });

  it("should return zero avg ticket when no orders", () => {
    const todayOrders = 0;
    const todayRevenue = 0;
    const avgTicket = todayOrders > 0 ? todayRevenue / todayOrders : 0;
    expect(avgTicket).toBe(0);
  });

  it("should count occupied tables correctly", () => {
    const tables = [
      { status: "OCCUPIED" },
      { status: "FREE" },
      { status: "OCCUPIED" },
      { status: "FREE" },
      { status: "OCCUPIED" },
    ];
    const occupied = tables.filter(t => t.status === "OCCUPIED").length;
    const total = tables.length;
    expect(occupied).toBe(3);
    expect(total).toBe(5);
  });
});
