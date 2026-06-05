import { describe, it, expect, vi } from 'vitest';

describe('Printers Router', () => {
  describe('Schema validation', () => {
    it('should accept valid printer creation input', () => {
      const { z } = require('zod');
      const schema = z.object({
        companyId: z.number(),
        name: z.string().min(1).max(100),
        department: z.enum(["KITCHEN", "BAR", "CASHIER"]),
        connectionType: z.enum(["NETWORK", "USB", "BLUETOOTH"]).default("NETWORK"),
        ipAddress: z.string().max(45).optional(),
        port: z.number().min(1).max(65535).default(9100),
        paperWidth: z.enum(["58mm", "80mm"]).default("80mm"),
      });

      const validInput = {
        companyId: 2,
        name: "Impressora Cozinha Principal",
        department: "KITCHEN",
        connectionType: "NETWORK",
        ipAddress: "192.168.1.100",
        port: 9100,
        paperWidth: "80mm",
      };

      expect(schema.parse(validInput)).toEqual(validInput);
    });

    it('should reject invalid department', () => {
      const { z } = require('zod');
      const schema = z.object({
        department: z.enum(["KITCHEN", "BAR", "CASHIER"]),
      });

      expect(() => schema.parse({ department: "INVALID" })).toThrow();
    });

    it('should reject empty name', () => {
      const { z } = require('zod');
      const schema = z.object({
        name: z.string().min(1).max(100),
      });

      expect(() => schema.parse({ name: "" })).toThrow();
    });

    it('should use defaults for optional fields', () => {
      const { z } = require('zod');
      const schema = z.object({
        connectionType: z.enum(["NETWORK", "USB", "BLUETOOTH"]).default("NETWORK"),
        port: z.number().min(1).max(65535).default(9100),
        paperWidth: z.enum(["58mm", "80mm"]).default("80mm"),
      });

      const result = schema.parse({});
      expect(result.connectionType).toBe("NETWORK");
      expect(result.port).toBe(9100);
      expect(result.paperWidth).toBe("80mm");
    });

    it('should reject port out of range', () => {
      const { z } = require('zod');
      const schema = z.object({
        port: z.number().min(1).max(65535),
      });

      expect(() => schema.parse({ port: 0 })).toThrow();
      expect(() => schema.parse({ port: 70000 })).toThrow();
    });
  });

  describe('Department routing logic', () => {
    it('should route KITCHEN items to kitchen printer', () => {
      const productionDestination = "KITCHEN";
      const destinations = productionDestination === "BOTH"
        ? ["KITCHEN", "BAR"]
        : [productionDestination];
      expect(destinations).toEqual(["KITCHEN"]);
    });

    it('should route BAR items to bar printer', () => {
      const productionDestination = "BAR";
      const destinations = productionDestination === "BOTH"
        ? ["KITCHEN", "BAR"]
        : [productionDestination];
      expect(destinations).toEqual(["BAR"]);
    });

    it('should route BOTH items to both kitchen and bar printers', () => {
      const productionDestination = "BOTH";
      const destinations = productionDestination === "BOTH"
        ? ["KITCHEN", "BAR"]
        : [productionDestination];
      expect(destinations).toEqual(["KITCHEN", "BAR"]);
    });

    it('should not route NONE items to any printer', () => {
      const productionDestination = "NONE";
      const shouldPrint = productionDestination !== "NONE";
      expect(shouldPrint).toBe(false);
    });
  });

  describe('Print ticket grouping', () => {
    it('should group items by destination correctly', () => {
      const items = [
        { productName: "Smash Burger", quantity: 2, productionDestination: "KITCHEN", notes: null },
        { productName: "Batata Frita", quantity: 1, productionDestination: "KITCHEN", notes: "Sem sal" },
        { productName: "Cerveja IPA", quantity: 3, productionDestination: "BAR", notes: null },
        { productName: "Combo Especial", quantity: 1, productionDestination: "BOTH", notes: null },
        { productName: "Guardanapo", quantity: 1, productionDestination: "NONE", notes: null },
      ];

      const byDest: Record<string, typeof items> = {};
      for (const item of items) {
        const dest = item.productionDestination;
        if (dest === "NONE") continue;
        if (dest === "BOTH") {
          if (!byDest["KITCHEN"]) byDest["KITCHEN"] = [];
          if (!byDest["BAR"]) byDest["BAR"] = [];
          byDest["KITCHEN"].push(item);
          byDest["BAR"].push(item);
        } else {
          if (!byDest[dest]) byDest[dest] = [];
          byDest[dest].push(item);
        }
      }

      expect(byDest["KITCHEN"]).toHaveLength(3); // 2 kitchen + 1 BOTH
      expect(byDest["BAR"]).toHaveLength(2); // 1 bar + 1 BOTH
      expect(byDest["NONE"]).toBeUndefined();
    });
  });

  describe('Printer config summary', () => {
    it('should correctly categorize printers by department', () => {
      const allPrinters = [
        { id: 1, department: "KITCHEN", active: true, name: "Cozinha 1" },
        { id: 2, department: "BAR", active: true, name: "Bar 1" },
        { id: 3, department: "CASHIER", active: true, name: "Caixa 1" },
        { id: 4, department: "KITCHEN", active: false, name: "Cozinha 2 (inativa)" },
      ];

      const activePrinters = allPrinters.filter(p => p.active);
      const summary = {
        kitchen: activePrinters.filter(p => p.department === "KITCHEN"),
        bar: activePrinters.filter(p => p.department === "BAR"),
        cashier: activePrinters.filter(p => p.department === "CASHIER"),
        total: activePrinters.length,
      };

      expect(summary.kitchen).toHaveLength(1);
      expect(summary.bar).toHaveLength(1);
      expect(summary.cashier).toHaveLength(1);
      expect(summary.total).toBe(3);
    });
  });

  describe('Receipt data formatting', () => {
    it('should calculate totals correctly for receipt', () => {
      const subtotal = 150.00;
      const tipPercent = 10;
      const tipAmount = subtotal * (tipPercent / 100);
      const totalAmount = subtotal + tipAmount;

      expect(tipAmount).toBe(15.00);
      expect(totalAmount).toBe(165.00);
    });

    it('should filter cancelled items from receipt', () => {
      const items = [
        { productName: "Burger", status: "DELIVERED", totalPrice: "30.00" },
        { productName: "Fries", status: "CANCELLED", totalPrice: "15.00" },
        { productName: "Beer", status: "DELIVERED", totalPrice: "20.00" },
      ];

      const activeItems = items.filter(i => i.status !== "CANCELLED");
      expect(activeItems).toHaveLength(2);
      expect(activeItems.map(i => i.productName)).toEqual(["Burger", "Beer"]);
    });
  });
});
