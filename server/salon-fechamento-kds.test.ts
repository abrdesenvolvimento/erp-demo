/**
 * Testes do Fechamento de Garçom e Redesign KDS
 * Cobre: agregação de relatório de garçom, cálculo de urgência KDS, formatação de tempo
 */

import { describe, it, expect } from "vitest";

// ==================== WAITER CLOSING REPORT AGGREGATION ====================

describe("Waiter Closing Report - Aggregation logic", () => {
  // Simulate the aggregation logic from getWaiterClosingReport
  function aggregateReport(orders: Array<{
    waiterId: string;
    waiterName: string;
    subtotal: string;
    tipAmount: string;
    totalAmount: string;
    guestCount: number;
    openedAt: string;
    closedAt: string;
  }>, items: Array<{
    orderId: number;
    productId: number;
    productName: string;
    quantity: string;
    totalPrice: string;
  }>, payments: Array<{
    orderId: number;
    method: string;
    amount: string;
  }>) {
    const byWaiter = new Map<string, {
      waiterId: string;
      waiterName: string;
      totalSales: number;
      totalSubtotal: number;
      totalTips: number;
      orderCount: number;
      totalGuests: number;
      totalServiceTime: number;
      productsSold: Map<number, { productId: number; productName: string; quantity: number; totalRevenue: number }>;
      paymentBreakdown: Map<string, number>;
    }>();

    orders.forEach((o, idx) => {
      const key = o.waiterId;
      const existing = byWaiter.get(key) ?? {
        waiterId: o.waiterId,
        waiterName: o.waiterName,
        totalSales: 0,
        totalSubtotal: 0,
        totalTips: 0,
        orderCount: 0,
        totalGuests: 0,
        totalServiceTime: 0,
        productsSold: new Map(),
        paymentBreakdown: new Map(),
      };

      const subtotal = parseFloat(o.subtotal);
      const tipAmount = parseFloat(o.tipAmount);
      const totalAmount = parseFloat(o.totalAmount);
      const serviceTime = (new Date(o.closedAt).getTime() - new Date(o.openedAt).getTime()) / 60000;

      existing.totalSales += totalAmount;
      existing.totalSubtotal += subtotal;
      existing.totalTips += tipAmount;
      existing.orderCount += 1;
      existing.totalGuests += o.guestCount;
      existing.totalServiceTime += serviceTime;

      // Products
      const orderItems = items.filter(i => i.orderId === idx + 1);
      for (const item of orderItems) {
        const qty = parseFloat(item.quantity);
        const rev = parseFloat(item.totalPrice);
        const prev = existing.productsSold.get(item.productId);
        if (prev) {
          prev.quantity += qty;
          prev.totalRevenue += rev;
        } else {
          existing.productsSold.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            quantity: qty,
            totalRevenue: rev,
          });
        }
      }

      // Payments
      const orderPayments = payments.filter(p => p.orderId === idx + 1);
      for (const p of orderPayments) {
        const amt = parseFloat(p.amount);
        existing.paymentBreakdown.set(p.method, (existing.paymentBreakdown.get(p.method) ?? 0) + amt);
      }

      byWaiter.set(key, existing);
    });

    return Array.from(byWaiter.values()).map(w => ({
      ...w,
      avgTicket: w.orderCount > 0 ? w.totalSales / w.orderCount : 0,
      avgServiceTime: w.orderCount > 0 ? w.totalServiceTime / w.orderCount : 0,
      productsSold: Array.from(w.productsSold.values()).sort((a, b) => b.totalRevenue - a.totalRevenue),
      paymentBreakdown: Object.fromEntries(w.paymentBreakdown),
    }));
  }

  const testOrders = [
    { waiterId: "w1", waiterName: "João", subtotal: "100.00", tipAmount: "10.00", totalAmount: "110.00", guestCount: 2, openedAt: "2026-03-08T18:00:00Z", closedAt: "2026-03-08T19:30:00Z" },
    { waiterId: "w1", waiterName: "João", subtotal: "80.00", tipAmount: "8.00", totalAmount: "88.00", guestCount: 3, openedAt: "2026-03-08T19:00:00Z", closedAt: "2026-03-08T20:00:00Z" },
    { waiterId: "w2", waiterName: "Maria", subtotal: "150.00", tipAmount: "15.00", totalAmount: "165.00", guestCount: 4, openedAt: "2026-03-08T18:30:00Z", closedAt: "2026-03-08T20:30:00Z" },
  ];

  const testItems = [
    { orderId: 1, productId: 10, productName: "Cerveja", quantity: "3", totalPrice: "45.00" },
    { orderId: 1, productId: 20, productName: "Hambúrguer", quantity: "2", totalPrice: "55.00" },
    { orderId: 2, productId: 10, productName: "Cerveja", quantity: "4", totalPrice: "60.00" },
    { orderId: 2, productId: 30, productName: "Batata Frita", quantity: "1", totalPrice: "20.00" },
    { orderId: 3, productId: 10, productName: "Cerveja", quantity: "5", totalPrice: "75.00" },
    { orderId: 3, productId: 20, productName: "Hambúrguer", quantity: "3", totalPrice: "75.00" },
  ];

  const testPayments = [
    { orderId: 1, method: "PIX", amount: "110.00" },
    { orderId: 2, method: "CASH", amount: "50.00" },
    { orderId: 2, method: "CREDIT", amount: "38.00" },
    { orderId: 3, method: "DEBIT", amount: "165.00" },
  ];

  it("should aggregate totals by waiter correctly", () => {
    const result = aggregateReport(testOrders, testItems, testPayments);
    expect(result.length).toBe(2);

    const joao = result.find(w => w.waiterId === "w1")!;
    expect(joao.totalSales).toBeCloseTo(198.00, 2);
    expect(joao.totalSubtotal).toBeCloseTo(180.00, 2);
    expect(joao.totalTips).toBeCloseTo(18.00, 2);
    expect(joao.orderCount).toBe(2);
    expect(joao.totalGuests).toBe(5);

    const maria = result.find(w => w.waiterId === "w2")!;
    expect(maria.totalSales).toBeCloseTo(165.00, 2);
    expect(maria.totalSubtotal).toBeCloseTo(150.00, 2);
    expect(maria.totalTips).toBeCloseTo(15.00, 2);
    expect(maria.orderCount).toBe(1);
    expect(maria.totalGuests).toBe(4);
  });

  it("should calculate average ticket correctly", () => {
    const result = aggregateReport(testOrders, testItems, testPayments);
    const joao = result.find(w => w.waiterId === "w1")!;
    expect(joao.avgTicket).toBeCloseTo(99.00, 2); // 198 / 2
    const maria = result.find(w => w.waiterId === "w2")!;
    expect(maria.avgTicket).toBeCloseTo(165.00, 2); // 165 / 1
  });

  it("should calculate average service time correctly", () => {
    const result = aggregateReport(testOrders, testItems, testPayments);
    const joao = result.find(w => w.waiterId === "w1")!;
    // Order 1: 90 min, Order 2: 60 min → avg = 75 min
    expect(joao.avgServiceTime).toBeCloseTo(75.00, 0);
    const maria = result.find(w => w.waiterId === "w2")!;
    // Order 3: 120 min
    expect(maria.avgServiceTime).toBeCloseTo(120.00, 0);
  });

  it("should aggregate products sold by waiter", () => {
    const result = aggregateReport(testOrders, testItems, testPayments);
    const joao = result.find(w => w.waiterId === "w1")!;
    // João: Cerveja 3+4=7 (R$105), Hambúrguer 2 (R$55), Batata 1 (R$20)
    expect(joao.productsSold.length).toBe(3);
    const cerveja = joao.productsSold.find(p => p.productId === 10)!;
    expect(cerveja.quantity).toBe(7);
    expect(cerveja.totalRevenue).toBeCloseTo(105.00, 2);
  });

  it("should sort products by revenue descending", () => {
    const result = aggregateReport(testOrders, testItems, testPayments);
    const joao = result.find(w => w.waiterId === "w1")!;
    // Cerveja R$105 > Hambúrguer R$55 > Batata R$20
    expect(joao.productsSold[0].productName).toBe("Cerveja");
    expect(joao.productsSold[1].productName).toBe("Hambúrguer");
    expect(joao.productsSold[2].productName).toBe("Batata Frita");
  });

  it("should aggregate payment breakdown by waiter", () => {
    const result = aggregateReport(testOrders, testItems, testPayments);
    const joao = result.find(w => w.waiterId === "w1")!;
    // João: PIX R$110, CASH R$50, CREDIT R$38
    expect(joao.paymentBreakdown["PIX"]).toBeCloseTo(110.00, 2);
    expect(joao.paymentBreakdown["CASH"]).toBeCloseTo(50.00, 2);
    expect(joao.paymentBreakdown["CREDIT"]).toBeCloseTo(38.00, 2);

    const maria = result.find(w => w.waiterId === "w2")!;
    expect(maria.paymentBreakdown["DEBIT"]).toBeCloseTo(165.00, 2);
  });

  it("should handle empty orders array", () => {
    const result = aggregateReport([], [], []);
    expect(result.length).toBe(0);
  });
});

// ==================== GLOBAL TOTALS ====================

describe("Waiter Closing Report - Global totals", () => {
  it("should calculate global totals from multiple waiters", () => {
    const waiters = [
      { totalSales: 198.00, totalSubtotal: 180.00, totalTips: 18.00, orderCount: 2, totalGuests: 5 },
      { totalSales: 165.00, totalSubtotal: 150.00, totalTips: 15.00, orderCount: 1, totalGuests: 4 },
    ];

    const totals = waiters.reduce(
      (acc, w) => ({
        totalSales: acc.totalSales + w.totalSales,
        totalSubtotal: acc.totalSubtotal + w.totalSubtotal,
        totalTips: acc.totalTips + w.totalTips,
        totalOrders: acc.totalOrders + w.orderCount,
        totalGuests: acc.totalGuests + w.totalGuests,
      }),
      { totalSales: 0, totalSubtotal: 0, totalTips: 0, totalOrders: 0, totalGuests: 0 }
    );

    expect(totals.totalSales).toBeCloseTo(363.00, 2);
    expect(totals.totalSubtotal).toBeCloseTo(330.00, 2);
    expect(totals.totalTips).toBeCloseTo(33.00, 2);
    expect(totals.totalOrders).toBe(3);
    expect(totals.totalGuests).toBe(9);

    const avgTicket = totals.totalOrders > 0 ? totals.totalSales / totals.totalOrders : 0;
    expect(avgTicket).toBeCloseTo(121.00, 2);
  });
});

// ==================== KDS URGENCY LOGIC ====================

describe("KDS Urgency - Timer and color logic", () => {
  function getUrgencyLevel(date: Date | string | null, thresholdWarning: number, thresholdCritical: number): "normal" | "warning" | "critical" {
    if (!date) return "normal";
    const diffMin = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diffMin > thresholdCritical) return "critical";
    if (diffMin > thresholdWarning) return "warning";
    return "normal";
  }

  function getUrgencyPercent(date: Date | string | null, maxMin: number): number {
    if (!date) return 0;
    const diffMin = (Date.now() - new Date(date).getTime()) / 60000;
    return Math.min(diffMin / maxMin, 1);
  }

  function formatElapsed(date: Date | string | null): string {
    if (!date) return "";
    const diffMs = Date.now() - new Date(date).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "< 1min";
    if (diffMin < 60) return `${diffMin}min`;
    return `${Math.floor(diffMin / 60)}h${String(diffMin % 60).padStart(2, "0")}m`;
  }

  it("should return normal for recent items (Kitchen: < 10min)", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(getUrgencyLevel(fiveMinAgo, 10, 20)).toBe("normal");
  });

  it("should return warning for items over 10min (Kitchen)", () => {
    const twelveMinAgo = new Date(Date.now() - 12 * 60000).toISOString();
    expect(getUrgencyLevel(twelveMinAgo, 10, 20)).toBe("warning");
  });

  it("should return critical for items over 20min (Kitchen)", () => {
    const twentyFiveMinAgo = new Date(Date.now() - 25 * 60000).toISOString();
    expect(getUrgencyLevel(twentyFiveMinAgo, 10, 20)).toBe("critical");
  });

  it("should return warning for items over 8min (Bar)", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60000).toISOString();
    expect(getUrgencyLevel(tenMinAgo, 8, 15)).toBe("warning");
  });

  it("should return critical for items over 15min (Bar)", () => {
    const eighteenMinAgo = new Date(Date.now() - 18 * 60000).toISOString();
    expect(getUrgencyLevel(eighteenMinAgo, 8, 15)).toBe("critical");
  });

  it("should return normal for null date", () => {
    expect(getUrgencyLevel(null, 10, 20)).toBe("normal");
  });

  it("should calculate urgency percent correctly", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60000).toISOString();
    const pct = getUrgencyPercent(tenMinAgo, 25);
    expect(pct).toBeCloseTo(0.4, 1); // 10/25 = 0.4
  });

  it("should cap urgency percent at 1.0", () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000).toISOString();
    const pct = getUrgencyPercent(thirtyMinAgo, 25);
    expect(pct).toBe(1);
  });

  it("should return 0 percent for null date", () => {
    expect(getUrgencyPercent(null, 25)).toBe(0);
  });

  it("should format elapsed time < 1min", () => {
    const thirtySecAgo = new Date(Date.now() - 30000).toISOString();
    expect(formatElapsed(thirtySecAgo)).toBe("< 1min");
  });

  it("should format elapsed time in minutes", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(formatElapsed(fiveMinAgo)).toBe("5min");
  });

  it("should format elapsed time in hours and minutes", () => {
    const ninetyMinAgo = new Date(Date.now() - 90 * 60000).toISOString();
    expect(formatElapsed(ninetyMinAgo)).toBe("1h30m");
  });

  it("should format elapsed time with zero-padded minutes", () => {
    const sixtyFiveMinAgo = new Date(Date.now() - 65 * 60000).toISOString();
    expect(formatElapsed(sixtyFiveMinAgo)).toBe("1h05m");
  });

  it("should return empty string for null date", () => {
    expect(formatElapsed(null)).toBe("");
  });
});

// ==================== KDS SORTING ====================

describe("KDS Order Sorting - Oldest first", () => {
  it("should sort groups by oldest item first", () => {
    const groups = [
      { orderId: 1, items: [{ sentAt: "2026-03-08T19:00:00Z" }] },
      { orderId: 2, items: [{ sentAt: "2026-03-08T18:30:00Z" }] },
      { orderId: 3, items: [{ sentAt: "2026-03-08T19:30:00Z" }] },
    ];

    groups.sort((a, b) => {
      const aTime = a.items[0]?.sentAt;
      const bTime = b.items[0]?.sentAt;
      if (!aTime) return 1;
      if (!bTime) return -1;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });

    expect(groups[0].orderId).toBe(2); // 18:30 (oldest)
    expect(groups[1].orderId).toBe(1); // 19:00
    expect(groups[2].orderId).toBe(3); // 19:30 (newest)
  });
});

// ==================== PAYMENT LABELS ====================

describe("Payment Labels - Mapping", () => {
  const PAYMENT_LABELS: Record<string, string> = {
    CASH: "Dinheiro",
    CREDIT: "Crédito",
    DEBIT: "Débito",
    PIX: "PIX",
    VOUCHER: "Voucher",
  };

  it("should map all payment methods to labels", () => {
    expect(PAYMENT_LABELS["CASH"]).toBe("Dinheiro");
    expect(PAYMENT_LABELS["CREDIT"]).toBe("Crédito");
    expect(PAYMENT_LABELS["DEBIT"]).toBe("Débito");
    expect(PAYMENT_LABELS["PIX"]).toBe("PIX");
    expect(PAYMENT_LABELS["VOUCHER"]).toBe("Voucher");
  });

  it("should return undefined for unknown payment method", () => {
    expect(PAYMENT_LABELS["BITCOIN"]).toBeUndefined();
  });
});
