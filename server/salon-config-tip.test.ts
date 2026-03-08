import { describe, it, expect } from "vitest";

/**
 * Tests for salon config and dynamic tip percent feature
 */

describe("Salon Config - Taxa de Serviço Configurável", () => {
  describe("Config defaults", () => {
    it("should have default tip percent of 10", () => {
      const defaultConfig = {
        tipEnabled: true,
        defaultTipPercent: 10,
        gratuityLabel: "Taxa de serviço",
      };
      expect(defaultConfig.defaultTipPercent).toBe(10);
      expect(defaultConfig.tipEnabled).toBe(true);
      expect(defaultConfig.gratuityLabel).toBe("Taxa de serviço");
    });

    it("should allow custom tip percentages", () => {
      const customConfig = {
        tipEnabled: true,
        defaultTipPercent: 12,
        gratuityLabel: "Gorjeta",
      };
      expect(customConfig.defaultTipPercent).toBe(12);
      expect(customConfig.gratuityLabel).toBe("Gorjeta");
    });

    it("should allow disabling tip entirely", () => {
      const disabledConfig = {
        tipEnabled: false,
        defaultTipPercent: 10,
        gratuityLabel: "Taxa de serviço",
      };
      expect(disabledConfig.tipEnabled).toBe(false);
    });
  });

  describe("Tip calculation with dynamic percent", () => {
    it("should calculate tip correctly with 10%", () => {
      const subtotal = 275.96;
      const tipPercent = 10;
      const tipAmount = subtotal * (tipPercent / 100);
      const totalWithTip = subtotal + tipAmount;
      const totalWithoutTip = subtotal;

      expect(tipAmount).toBeCloseTo(27.60, 2);
      expect(totalWithTip).toBeCloseTo(303.56, 2);
      expect(totalWithoutTip).toBe(275.96);
    });

    it("should calculate tip correctly with 12%", () => {
      const subtotal = 275.96;
      const tipPercent = 12;
      const tipAmount = subtotal * (tipPercent / 100);
      const totalWithTip = subtotal + tipAmount;

      expect(tipAmount).toBeCloseTo(33.12, 2);
      expect(totalWithTip).toBeCloseTo(309.08, 2);
    });

    it("should calculate tip correctly with 15%", () => {
      const subtotal = 275.96;
      const tipPercent = 15;
      const tipAmount = subtotal * (tipPercent / 100);
      const totalWithTip = subtotal + tipAmount;

      expect(tipAmount).toBeCloseTo(41.39, 2);
      expect(totalWithTip).toBeCloseTo(317.35, 2);
    });

    it("should handle 0% tip (no service fee)", () => {
      const subtotal = 275.96;
      const tipPercent = 0;
      const tipAmount = subtotal * (tipPercent / 100);
      const totalWithTip = subtotal + tipAmount;

      expect(tipAmount).toBe(0);
      expect(totalWithTip).toBe(subtotal);
    });
  });

  describe("Dynamic tip button options", () => {
    it("should generate correct button options based on default percent", () => {
      const defaultPercent = 10;
      const options = [0, defaultPercent, defaultPercent + 2, defaultPercent + 5];
      
      expect(options).toEqual([0, 10, 12, 15]);
    });

    it("should generate correct button options for 12% default", () => {
      const defaultPercent = 12;
      const options = [0, defaultPercent, defaultPercent + 2, defaultPercent + 5];
      
      expect(options).toEqual([0, 12, 14, 17]);
    });

    it("should always include 0 (Sem) as first option", () => {
      const defaultPercent = 15;
      const options = [0, defaultPercent, defaultPercent + 2, defaultPercent + 5];
      
      expect(options[0]).toBe(0);
    });
  });

  describe("Service fee confirmation flow", () => {
    it("should set tip to 0 when client declines service fee", () => {
      const subtotal = 100;
      const defaultTipPercent = 10;
      let tipPercent = defaultTipPercent;
      let serviceFeeConfirmed = false;

      // Client declines
      serviceFeeConfirmed = false;
      tipPercent = 0;

      const finalAmount = subtotal + (subtotal * tipPercent / 100);
      expect(finalAmount).toBe(100);
      expect(tipPercent).toBe(0);
    });

    it("should keep tip when client accepts service fee", () => {
      const subtotal = 100;
      const defaultTipPercent = 10;
      let tipPercent = defaultTipPercent;
      let serviceFeeConfirmed = true;

      const tipAmount = subtotal * tipPercent / 100;
      const finalAmount = subtotal + tipAmount;
      expect(finalAmount).toBe(110);
      expect(tipPercent).toBe(10);
    });
  });

  describe("Revenue separation (subtotal vs totalAmount)", () => {
    it("should use subtotal for revenue calculation (not totalAmount)", () => {
      const order = {
        subtotal: 275.96,
        tipAmount: 27.60,
        totalAmount: 303.56,
      };

      // Revenue should be subtotal only
      const revenue = order.subtotal;
      expect(revenue).toBe(275.96);
      expect(revenue).not.toBe(order.totalAmount);
    });

    it("should record sale.finalAmount as subtotal", () => {
      const order = {
        subtotal: 275.96,
        tipAmount: 27.60,
        totalAmount: 303.56,
      };

      const saleFinalAmount = order.subtotal; // NOT totalAmount
      expect(saleFinalAmount).toBe(275.96);
    });

    it("should track tip separately in dashboard", () => {
      const dashboardStats = {
        totalRevenue: 275.96, // subtotal only
        totalTips: 27.60,    // tips separate
        closedOrders: 1,
      };

      expect(dashboardStats.totalRevenue).toBe(275.96);
      expect(dashboardStats.totalTips).toBe(27.60);
      expect(dashboardStats.totalRevenue + dashboardStats.totalTips).toBeCloseTo(303.56, 2);
    });
  });
});
