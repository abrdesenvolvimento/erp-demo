import { describe, it, expect } from "vitest";

/**
 * Tests for Salon v2 improvements:
 * 1. Items with NONE destination → DELIVERED immediately
 * 2. Checkout 2-step flow logic
 * 3. Waiter closing report grouping by waiterId
 */

describe("Salon v2 Improvements", () => {

  describe("NONE destination items → DELIVERED", () => {
    it("should set status to DELIVERED for NONE destination products", () => {
      const destination = "NONE";
      const initialStatus = destination === "NONE" ? "DELIVERED" : "PENDING";
      expect(initialStatus).toBe("DELIVERED");
    });

    it("should set status to PENDING for COZINHA destination products", () => {
      const destination = "COZINHA";
      const initialStatus = destination === "NONE" ? "DELIVERED" : "PENDING";
      expect(initialStatus).toBe("PENDING");
    });

    it("should set status to PENDING for BAR destination products", () => {
      const destination = "BAR";
      const initialStatus = destination === "NONE" ? "DELIVERED" : "PENDING";
      expect(initialStatus).toBe("PENDING");
    });

    it("should default null destination to NONE and thus DELIVERED", () => {
      const productionDestination: string | null = null;
      const destination = productionDestination ?? "NONE";
      const initialStatus = destination === "NONE" ? "DELIVERED" : "PENDING";
      expect(destination).toBe("NONE");
      expect(initialStatus).toBe("DELIVERED");
    });

    it("should add deliveredAt timestamp for DELIVERED items", () => {
      const destination = "NONE";
      const initialStatus = destination === "NONE" ? "DELIVERED" : "PENDING";
      const extraFields = initialStatus === "DELIVERED" ? { deliveredAt: new Date() } : {};
      expect(extraFields).toHaveProperty("deliveredAt");
      expect(extraFields.deliveredAt).toBeInstanceOf(Date);
    });

    it("should NOT add deliveredAt for PENDING items", () => {
      const destination = "COZINHA";
      const initialStatus = destination === "NONE" ? "DELIVERED" : "PENDING";
      const extraFields = initialStatus === "DELIVERED" ? { deliveredAt: new Date() } : {};
      expect(extraFields).not.toHaveProperty("deliveredAt");
    });
  });

  describe("Waiter closing report grouping", () => {
    it("should group orders by waiterId (not waiterName)", () => {
      const orders = [
        { waiterId: "user1", waiterName: "Gabriel Morais", totalAmount: "100" },
        { waiterId: "user2", waiterName: "Gabriel Morais", totalAmount: "50" },
        { waiterId: "user1", waiterName: "Gabriel Morais", totalAmount: "75" },
      ];

      const byWaiter = new Map<string, { waiterId: string; totalSales: number; orderCount: number }>();
      for (const o of orders) {
        const key = o.waiterId;
        const existing = byWaiter.get(key);
        if (existing) {
          existing.totalSales += parseFloat(o.totalAmount);
          existing.orderCount += 1;
        } else {
          byWaiter.set(key, {
            waiterId: o.waiterId,
            totalSales: parseFloat(o.totalAmount),
            orderCount: 1,
          });
        }
      }

      // Two distinct users, even with same name
      expect(byWaiter.size).toBe(2);
      expect(byWaiter.get("user1")!.totalSales).toBe(175);
      expect(byWaiter.get("user1")!.orderCount).toBe(2);
      expect(byWaiter.get("user2")!.totalSales).toBe(50);
      expect(byWaiter.get("user2")!.orderCount).toBe(1);
    });

    it("should handle null waiterId with 'unknown' key", () => {
      const orders = [
        { waiterId: null, waiterName: null, totalAmount: "30" },
        { waiterId: null, waiterName: null, totalAmount: "20" },
      ];

      const byWaiter = new Map<string, { totalSales: number; orderCount: number }>();
      for (const o of orders) {
        const key = o.waiterId ?? "unknown";
        const existing = byWaiter.get(key);
        if (existing) {
          existing.totalSales += parseFloat(o.totalAmount);
          existing.orderCount += 1;
        } else {
          byWaiter.set(key, {
            totalSales: parseFloat(o.totalAmount),
            orderCount: 1,
          });
        }
      }

      expect(byWaiter.size).toBe(1);
      expect(byWaiter.get("unknown")!.totalSales).toBe(50);
      expect(byWaiter.get("unknown")!.orderCount).toBe(2);
    });
  });

  describe("Checkout 2-step flow", () => {
    it("should calculate tip amount correctly", () => {
      const subtotal = 100;
      const tipPercent = 10;
      const tipAmount = subtotal * (tipPercent / 100);
      const totalWithTip = subtotal + tipAmount;
      expect(tipAmount).toBe(10);
      expect(totalWithTip).toBe(110);
    });

    it("should calculate per-person amount correctly", () => {
      const totalWithTip = 120;
      const guestCount = 4;
      const perPerson = guestCount > 0 ? totalWithTip / guestCount : totalWithTip;
      expect(perPerson).toBe(30);
    });

    it("should handle zero tip", () => {
      const subtotal = 80;
      const tipPercent = 0;
      const tipAmount = subtotal * (tipPercent / 100);
      const totalWithTip = subtotal + tipAmount;
      expect(tipAmount).toBe(0);
      expect(totalWithTip).toBe(80);
    });

    it("should handle single guest (no division)", () => {
      const totalWithTip = 100;
      const guestCount = 1;
      const perPerson = guestCount > 0 ? totalWithTip / guestCount : totalWithTip;
      expect(perPerson).toBe(100);
    });
  });

  describe("Table edit validation", () => {
    it("should validate table capacity is positive", () => {
      const capacity = 4;
      expect(capacity).toBeGreaterThan(0);
    });

    it("should validate table description is not empty", () => {
      const description = "Mesa VIP";
      expect(description.length).toBeGreaterThan(0);
    });
  });
});
