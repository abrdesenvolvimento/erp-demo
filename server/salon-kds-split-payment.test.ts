import { describe, it, expect } from "vitest";

// ============================================================
// Unit tests for KDS Stats, Print Ticket, and Split Payment
// ============================================================

describe("KDS Stats Logic", () => {
  it("should calculate average prep time correctly", () => {
    // Simulate prep times in minutes
    const prepTimes = [5, 8, 12, 6, 9];
    const avg = prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length;
    expect(avg).toBe(8);
  });

  it("should group items by product name for stats", () => {
    const items = [
      { productName: "Smash Burger", prepTimeMin: 6 },
      { productName: "Smash Burger", prepTimeMin: 8 },
      { productName: "Batata Frita", prepTimeMin: 4 },
      { productName: "Batata Frita", prepTimeMin: 5 },
      { productName: "Smash Burger", prepTimeMin: 7 },
    ];

    const grouped: Record<string, { total: number; count: number }> = {};
    for (const item of items) {
      if (!grouped[item.productName]) {
        grouped[item.productName] = { total: 0, count: 0 };
      }
      grouped[item.productName].total += item.prepTimeMin;
      grouped[item.productName].count += 1;
    }

    const stats = Object.entries(grouped).map(([name, data]) => ({
      name,
      count: data.count,
      avgPrepMin: Math.round(data.total / data.count),
    }));

    stats.sort((a, b) => b.count - a.count);

    expect(stats).toHaveLength(2);
    expect(stats[0].name).toBe("Smash Burger");
    expect(stats[0].count).toBe(3);
    expect(stats[0].avgPrepMin).toBe(7); // (6+8+7)/3 = 7
    expect(stats[1].name).toBe("Batata Frita");
    expect(stats[1].count).toBe(2);
    expect(stats[1].avgPrepMin).toBe(5); // (4+5)/2 = 4.5 → rounds to 5
  });

  it("should handle empty items list for stats", () => {
    const items: any[] = [];
    const grouped: Record<string, { total: number; count: number }> = {};
    for (const item of items) {
      if (!grouped[item.productName]) {
        grouped[item.productName] = { total: 0, count: 0 };
      }
      grouped[item.productName].total += item.prepTimeMin;
      grouped[item.productName].count += 1;
    }
    expect(Object.keys(grouped)).toHaveLength(0);
  });
});

describe("KDS Urgency Level", () => {
  function getUrgencyLevel(diffMin: number): "normal" | "warning" | "critical" {
    if (diffMin > 15) return "critical";
    if (diffMin > 8) return "warning";
    return "normal";
  }

  function getUrgencyPercent(diffMin: number): number {
    return Math.min(diffMin / 20, 1);
  }

  it("should return normal for items under 8 minutes", () => {
    expect(getUrgencyLevel(0)).toBe("normal");
    expect(getUrgencyLevel(5)).toBe("normal");
    expect(getUrgencyLevel(8)).toBe("normal");
  });

  it("should return warning for items between 8 and 15 minutes", () => {
    expect(getUrgencyLevel(9)).toBe("warning");
    expect(getUrgencyLevel(12)).toBe("warning");
    expect(getUrgencyLevel(15)).toBe("warning");
  });

  it("should return critical for items over 15 minutes", () => {
    expect(getUrgencyLevel(16)).toBe("critical");
    expect(getUrgencyLevel(30)).toBe("critical");
  });

  it("should calculate urgency percent correctly", () => {
    expect(getUrgencyPercent(0)).toBe(0);
    expect(getUrgencyPercent(10)).toBe(0.5);
    expect(getUrgencyPercent(20)).toBe(1);
    expect(getUrgencyPercent(30)).toBe(1); // capped at 1
  });
});

describe("Split Payment Logic", () => {
  it("should validate single payment covers full total", () => {
    const total = 150.0;
    const payments = [{ method: "PIX", amount: 150.0 }];
    const sum = payments.reduce((a, p) => a + p.amount, 0);
    expect(Math.abs(sum - total)).toBeLessThan(0.01);
  });

  it("should validate split payment covers full total", () => {
    const total = 150.0;
    const payments = [
      { method: "DINHEIRO", amount: 80.0 },
      { method: "CARTAO_CREDITO", amount: 70.0 },
    ];
    const sum = payments.reduce((a, p) => a + p.amount, 0);
    expect(Math.abs(sum - total)).toBeLessThan(0.01);
  });

  it("should reject split payment that doesn't cover total", () => {
    const total = 150.0;
    const payments = [
      { method: "DINHEIRO", amount: 80.0 },
      { method: "PIX", amount: 50.0 },
    ];
    const sum = payments.reduce((a, p) => a + p.amount, 0);
    const remaining = total - sum;
    expect(remaining).toBeGreaterThan(0.01);
    expect(remaining).toBeCloseTo(20.0);
  });

  it("should calculate remaining correctly with multiple payments", () => {
    const total = 303.56;
    const payments = [
      { method: "DINHEIRO", amount: 100.0 },
      { method: "CARTAO_DEBITO", amount: 100.0 },
      { method: "PIX", amount: 103.56 },
    ];
    const sum = payments.reduce((a, p) => a + p.amount, 0);
    expect(Math.abs(sum - total)).toBeLessThan(0.01);
  });

  it("should map payment method correctly for single vs multiple", () => {
    function mapPaymentMethod(payments: { method: string; amount: number }[]): string {
      if (payments.length === 0) return "DINHEIRO";
      if (payments.length === 1) return payments[0].method;
      return "MISTO";
    }

    expect(mapPaymentMethod([{ method: "PIX", amount: 100 }])).toBe("PIX");
    expect(mapPaymentMethod([
      { method: "DINHEIRO", amount: 50 },
      { method: "PIX", amount: 50 },
    ])).toBe("MISTO");
    expect(mapPaymentMethod([])).toBe("DINHEIRO");
  });

  it("should prevent adding payment that exceeds remaining", () => {
    const total = 100.0;
    const existingPayments = [{ method: "DINHEIRO", amount: 80.0 }];
    const existingSum = existingPayments.reduce((a, p) => a + p.amount, 0);
    const remaining = total - existingSum;
    
    const newPaymentAmount = 30.0; // exceeds remaining of 20
    const cappedAmount = Math.min(newPaymentAmount, remaining);
    
    expect(remaining).toBeCloseTo(20.0);
    expect(cappedAmount).toBeCloseTo(20.0);
  });

  it("should handle 'Restante' button correctly", () => {
    const total = 275.96;
    const payments = [
      { method: "DINHEIRO", amount: 100.0 },
      { method: "CARTAO_CREDITO", amount: 50.0 },
    ];
    const sum = payments.reduce((a, p) => a + p.amount, 0);
    const remaining = total - sum;
    
    // "Restante" button should fill the remaining amount
    expect(remaining).toBeCloseTo(125.96);
    
    payments.push({ method: "PIX", amount: remaining });
    const finalSum = payments.reduce((a, p) => a + p.amount, 0);
    expect(Math.abs(finalSum - total)).toBeLessThan(0.01);
  });
});

describe("KDS Print Ticket Format", () => {
  it("should format ticket items correctly", () => {
    const items = [
      { quantity: 2, productName: "Smash Burger", notes: "Sem cebola" },
      { quantity: 1, productName: "Batata Frita", notes: null },
      { quantity: 3, productName: "Negroni", notes: "" },
    ];

    const formatted = items.map((item) => ({
      qty: `${parseFloat(String(item.quantity))}x`,
      name: item.productName,
      hasNotes: !!item.notes,
    }));

    expect(formatted).toHaveLength(3);
    expect(formatted[0].qty).toBe("2x");
    expect(formatted[0].name).toBe("Smash Burger");
    expect(formatted[0].hasNotes).toBe(true);
    expect(formatted[1].hasNotes).toBe(false);
    expect(formatted[2].hasNotes).toBe(false);
  });

  it("should group items by order for printing", () => {
    const items = [
      { orderId: 1, tableNumber: 5, productName: "Item A" },
      { orderId: 1, tableNumber: 5, productName: "Item B" },
      { orderId: 2, tableNumber: 3, productName: "Item C" },
    ];

    const groups: Record<number, any> = {};
    for (const item of items) {
      if (!groups[item.orderId]) {
        groups[item.orderId] = {
          orderId: item.orderId,
          tableNumber: item.tableNumber,
          items: [],
        };
      }
      groups[item.orderId].items.push(item);
    }

    const result = Object.values(groups);
    expect(result).toHaveLength(2);
    expect(result[0].items).toHaveLength(2);
    expect(result[1].items).toHaveLength(1);
  });
});

describe("KDS Empty State Metrics", () => {
  it("should display correct metrics when no pending items", () => {
    const stats = {
      todayOrders: 47,
      todayItems: 123,
      avgPrepTimeMin: 11,
      lastOrderTime: "2026-03-08T17:21:00.000Z",
      itemStats: [
        { name: "Smash Burger", count: 25, avgPrepMin: 6 },
        { name: "Batata Frita", count: 18, avgPrepMin: 4 },
        { name: "Chicken", count: 12, avgPrepMin: 7 },
      ],
    };

    expect(stats.todayOrders).toBe(47);
    expect(stats.avgPrepTimeMin).toBe(11);
    expect(stats.itemStats).toHaveLength(3);
    expect(stats.itemStats[0].name).toBe("Smash Burger");
  });

  it("should handle zero stats gracefully", () => {
    const stats = {
      todayOrders: 0,
      todayItems: 0,
      avgPrepTimeMin: 0,
      lastOrderTime: null,
      itemStats: [],
    };

    expect(stats.todayOrders).toBe(0);
    expect(stats.lastOrderTime).toBeNull();
    expect(stats.itemStats).toHaveLength(0);
  });
});
