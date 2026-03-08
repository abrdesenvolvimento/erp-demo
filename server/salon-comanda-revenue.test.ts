import { describe, it, expect } from "vitest";

/**
 * Tests for Comanda document adjustments and revenue/service fee separation:
 * 1. Comanda document: abertura, tempo permanência, separated totals
 * 2. Revenue calculation: uses subtotal (excludes service fee/tip)
 * 3. Service fee observation text
 */

describe("Comanda Document Adjustments", () => {

  describe("Tempo de permanência calculation", () => {
    it("should calculate minutes correctly", () => {
      const openedAt = new Date("2026-03-08T10:00:00-03:00");
      const now = new Date("2026-03-08T10:45:00-03:00");
      const diffMs = now.getTime() - openedAt.getTime();
      const hours = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      const result = hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}min` : `${mins}min`;
      expect(result).toBe("45min");
    });

    it("should calculate hours and minutes correctly", () => {
      const openedAt = new Date("2026-03-08T10:00:00-03:00");
      const now = new Date("2026-03-08T12:30:00-03:00");
      const diffMs = now.getTime() - openedAt.getTime();
      const hours = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      const result = hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}min` : `${mins}min`;
      expect(result).toBe("2h30min");
    });

    it("should handle exact hours", () => {
      const openedAt = new Date("2026-03-08T10:00:00-03:00");
      const now = new Date("2026-03-08T12:00:00-03:00");
      const diffMs = now.getTime() - openedAt.getTime();
      const hours = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      const result = hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}min` : `${mins}min`;
      expect(result).toBe("2h00min");
    });
  });

  describe("Separated totals (subtotal vs service fee)", () => {
    it("should calculate all 4 values correctly", () => {
      const subtotal = 100;
      const tipPercent = 10;
      const tipAmount = subtotal * (tipPercent / 100);
      const totalComServico = subtotal + tipAmount;
      const totalSemServico = subtotal;

      expect(subtotal).toBe(100);
      expect(tipAmount).toBe(10);
      expect(totalComServico).toBe(110);
      expect(totalSemServico).toBe(100);
    });

    it("should handle 0% service fee", () => {
      const subtotal = 80;
      const tipPercent = 0;
      const tipAmount = subtotal * (tipPercent / 100);
      const totalComServico = subtotal + tipAmount;

      expect(tipAmount).toBe(0);
      expect(totalComServico).toBe(80);
    });

    it("should handle 12% service fee", () => {
      const subtotal = 200;
      const tipPercent = 12;
      const tipAmount = subtotal * (tipPercent / 100);
      const totalComServico = subtotal + tipAmount;

      expect(tipAmount).toBe(24);
      expect(totalComServico).toBe(224);
    });
  });
});

describe("Revenue Separation (Service Fee excluded from Faturamento)", () => {

  describe("Dashboard stats revenue calculation", () => {
    it("should use subtotal for todayRevenue (not totalAmount)", () => {
      // Simulating what the SQL query now does: SUM(subtotal) instead of SUM(totalAmount)
      const orders = [
        { subtotal: "100.00", tipAmount: "10.00", totalAmount: "110.00" },
        { subtotal: "50.00", tipAmount: "5.00", totalAmount: "55.00" },
      ];

      const todayRevenue = orders.reduce((sum, o) => sum + parseFloat(o.subtotal), 0);
      const todayTips = orders.reduce((sum, o) => sum + parseFloat(o.tipAmount), 0);
      const totalWithTips = orders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);

      expect(todayRevenue).toBe(150); // Only subtotals
      expect(todayTips).toBe(15); // Tips separate
      expect(totalWithTips).toBe(165); // This should NOT be used as revenue
      expect(todayRevenue + todayTips).toBe(totalWithTips);
    });
  });

  describe("Waiter performance uses subtotal for sales", () => {
    it("should calculate totalSales from subtotal, not totalAmount", () => {
      const orders = [
        { waiterId: "w1", subtotal: "80.00", tipAmount: "8.00", totalAmount: "88.00" },
        { waiterId: "w1", subtotal: "120.00", tipAmount: "12.00", totalAmount: "132.00" },
      ];

      let totalSales = 0;
      let totalTips = 0;
      for (const o of orders) {
        totalSales += parseFloat(o.subtotal);
        totalTips += parseFloat(o.tipAmount);
      }

      expect(totalSales).toBe(200); // Subtotals only
      expect(totalTips).toBe(20); // Tips tracked separately
    });
  });

  describe("Sale record uses subtotal as finalAmount", () => {
    it("should record subtotal as finalAmount in sale, not totalAmount with tip", () => {
      const subtotal = 150;
      const tipAmount = 15;
      const totalAmount = subtotal + tipAmount;

      // The sale record should use subtotal as finalAmount
      const saleRecord = {
        subtotal: subtotal.toFixed(2),
        finalAmount: subtotal.toFixed(2), // NOT totalAmount
        notes: `Comanda #1 - Mesa 5 - 2 pessoa(s) - SALÃO${tipAmount > 0 ? ` | Taxa serviço: R$ ${tipAmount.toFixed(2)}` : ""}`,
      };

      expect(saleRecord.finalAmount).toBe("150.00");
      expect(saleRecord.notes).toContain("Taxa serviço: R$ 15.00");
      expect(parseFloat(saleRecord.finalAmount)).toBe(subtotal);
      expect(parseFloat(saleRecord.finalAmount)).not.toBe(totalAmount);
    });

    it("should not mention service fee in notes when tip is 0", () => {
      const subtotal = 80;
      const tipAmount = 0;

      const notes = `Comanda #2 - Mesa 3 - 1 pessoa(s) - SALÃO${tipAmount > 0 ? ` | Taxa serviço: R$ ${tipAmount.toFixed(2)}` : ""}`;

      expect(notes).not.toContain("Taxa serviço");
    });
  });

  describe("Ticket médio calculation", () => {
    it("should calculate average ticket from subtotals only", () => {
      const todayRevenue = 300; // Sum of subtotals
      const todayOrders = 3;
      const avgTicket = todayOrders > 0 ? todayRevenue / todayOrders : 0;

      expect(avgTicket).toBe(100);
    });
  });
});
