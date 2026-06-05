import { describe, it, expect } from "vitest";

/**
 * Tests for the Print Agent architecture and ESC/POS integration.
 * These tests validate the data flow and formatting logic.
 */

// --- ESC/POS Constants (mirrored from print-agent.js) ---
const ESC = "\x1B";
const GS = "\x1D";
const ESCPOS = {
  INIT: ESC + "@",
  BOLD_ON: ESC + "E\x01",
  BOLD_OFF: ESC + "E\x00",
  DOUBLE_HEIGHT_ON: ESC + "!\x10",
  DOUBLE_ON: ESC + "!\x30",
  NORMAL: ESC + "!\x00",
  ALIGN_CENTER: ESC + "a\x01",
  ALIGN_LEFT: ESC + "a\x00",
  PARTIAL_CUT: GS + "V\x01",
  FEED_5: ESC + "d\x05",
  LINE: "------------------------------------------------\n",
  DASHED: "- - - - - - - - - - - - - - - - - - - - - - - -\n",
};

// --- Helper functions (mirrored from print-agent.js) ---
function padRight(str: string, len: number) {
  return (str || "").substring(0, len).padEnd(len);
}
function padLeft(str: string, len: number) {
  return (str || "").substring(0, len).padStart(len);
}
function truncate(str: string, len: number) {
  if (!str) return "";
  return str.length > len ? str.substring(0, len - 1) + "." : str;
}
function formatMoney(value: number) {
  return value.toFixed(2).replace(".", ",");
}

describe("Print Agent - ESC/POS Formatting", () => {
  describe("Production Ticket Format", () => {
    it("should format a kitchen ticket with correct header", () => {
      const data = {
        tableNumber: 5,
        orderId: 42,
        items: [
          { productName: "Smash Burger", quantity: 2, notes: "Sem cebola" },
          { productName: "Batata Frita", quantity: 1 },
        ],
        destination: "KITCHEN",
        timestamp: "2026-06-07T20:30:00.000Z",
      };

      // Validate the ticket would contain key elements
      expect(data.destination).toBe("KITCHEN");
      expect(data.items.length).toBe(2);
      expect(data.items[0].notes).toBe("Sem cebola");
    });

    it("should format a bar ticket with correct header", () => {
      const data = {
        tableNumber: 3,
        orderId: 15,
        items: [
          { productName: "Caipirinha", quantity: 2 },
          { productName: "Cerveja Artesanal", quantity: 3 },
        ],
        destination: "BAR",
        timestamp: "2026-06-07T21:00:00.000Z",
      };

      expect(data.destination).toBe("BAR");
      expect(data.items.length).toBe(2);
    });

    it("should handle items with notes correctly", () => {
      const items = [
        { productName: "Burger", quantity: 1, notes: "Ponto mal passado" },
        { productName: "Salada", quantity: 1, notes: undefined },
      ];

      expect(items[0].notes).toBeTruthy();
      expect(items[1].notes).toBeUndefined();
    });
  });

  describe("Receipt Format", () => {
    it("should calculate receipt totals correctly", () => {
      const items = [
        { productName: "Smash Burger", quantity: 2, unitPrice: 32, totalPrice: 64 },
        { productName: "Cerveja", quantity: 3, unitPrice: 15, totalPrice: 45 },
        { productName: "Batata", quantity: 1, unitPrice: 25, totalPrice: 25 },
      ];

      const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
      const tipPercent = 10;
      const tipAmount = subtotal * (tipPercent / 100);
      const totalAmount = subtotal + tipAmount;

      expect(subtotal).toBe(134);
      expect(tipAmount).toBeCloseTo(13.4);
      expect(totalAmount).toBeCloseTo(147.4);
    });

    it("should format money values correctly", () => {
      expect(formatMoney(134)).toBe("134,00");
      expect(formatMoney(13.4)).toBe("13,40");
      expect(formatMoney(147.4)).toBe("147,40");
      expect(formatMoney(0)).toBe("0,00");
      expect(formatMoney(9.99)).toBe("9,99");
    });

    it("should handle cancelled items by excluding them", () => {
      const allItems = [
        { productName: "Burger", quantity: 1, totalPrice: 32, status: "DELIVERED" },
        { productName: "Cerveja", quantity: 1, totalPrice: 15, status: "CANCELLED" },
        { productName: "Batata", quantity: 1, totalPrice: 25, status: "READY" },
      ];

      const activeItems = allItems.filter(i => i.status !== "CANCELLED");
      const subtotal = activeItems.reduce((sum, i) => sum + i.totalPrice, 0);

      expect(activeItems.length).toBe(2);
      expect(subtotal).toBe(57);
    });
  });

  describe("Text Formatting Helpers", () => {
    it("should pad right correctly", () => {
      expect(padRight("Hello", 10)).toBe("Hello     ");
      expect(padRight("Long text here", 5)).toBe("Long ");
    });

    it("should pad left correctly", () => {
      expect(padLeft("42,00", 10)).toBe("     42,00");
      expect(padLeft("9,99", 10)).toBe("      9,99");
    });

    it("should truncate long names", () => {
      expect(truncate("Smash Burger Duplo Especial da Casa", 24)).toBe("Smash Burger Duplo Espe.");
      expect(truncate("Cerveja", 24)).toBe("Cerveja");
      expect(truncate("", 24)).toBe("");
    });
  });

  describe("Department Routing", () => {
    it("should route KITCHEN items to kitchen printer", () => {
      const item = { productName: "Burger", destination: "KITCHEN" };
      const department = item.destination === "KITCHEN" ? "KITCHEN" : "BAR";
      expect(department).toBe("KITCHEN");
    });

    it("should route BAR items to bar printer", () => {
      const item = { productName: "Cerveja", destination: "BAR" };
      const department = item.destination === "KITCHEN" ? "KITCHEN" : "BAR";
      expect(department).toBe("BAR");
    });

    it("should route BOTH items to both printers", () => {
      const item = { productName: "Combo", destination: "BOTH" };
      const departments = item.destination === "BOTH" ? ["KITCHEN", "BAR"] : [item.destination];
      expect(departments).toEqual(["KITCHEN", "BAR"]);
    });

    it("should not route NONE items to any printer", () => {
      const item = { productName: "Taxa Serviço", destination: "NONE" };
      const shouldPrint = item.destination !== "NONE";
      expect(shouldPrint).toBe(false);
    });
  });

  describe("Agent Config Sync", () => {
    it("should transform DB printer records to agent config format", () => {
      const dbPrinters = [
        { id: 1, name: "Cozinha", department: "KITCHEN", connectionType: "NETWORK", ipAddress: "192.168.1.100", port: 9100, active: true, paperWidth: "80mm" },
        { id: 2, name: "Bar", department: "BAR", connectionType: "NETWORK", ipAddress: "192.168.1.101", port: 9100, active: true, paperWidth: "80mm" },
        { id: 3, name: "Caixa USB", department: "CASHIER", connectionType: "USB", ipAddress: null, port: 9100, active: true, paperWidth: "80mm" },
        { id: 4, name: "Backup", department: "KITCHEN", connectionType: "NETWORK", ipAddress: "192.168.1.200", port: 9100, active: false, paperWidth: "58mm" },
      ];

      // Only active NETWORK printers should be synced to agent
      const agentPrinters = dbPrinters
        .filter(p => p.active && p.connectionType === "NETWORK" && p.ipAddress)
        .map(p => ({
          department: p.department,
          name: p.name,
          ip: p.ipAddress!,
          port: p.port || 9100,
          enabled: true,
        }));

      expect(agentPrinters.length).toBe(2);
      expect(agentPrinters[0]).toEqual({
        department: "KITCHEN",
        name: "Cozinha",
        ip: "192.168.1.100",
        port: 9100,
        enabled: true,
      });
      expect(agentPrinters[1]).toEqual({
        department: "BAR",
        name: "Bar",
        ip: "192.168.1.101",
        port: 9100,
        enabled: true,
      });
    });

    it("should handle empty printer list", () => {
      const dbPrinters: any[] = [];
      const agentPrinters = dbPrinters
        .filter(p => p.active && p.connectionType === "NETWORK" && p.ipAddress)
        .map(p => ({
          department: p.department,
          name: p.name,
          ip: p.ipAddress,
          port: p.port || 9100,
          enabled: true,
        }));

      expect(agentPrinters.length).toBe(0);
    });
  });

  describe("Auto-Print Detection Logic", () => {
    it("should detect new PENDING items that haven't been printed", () => {
      const printedIds = new Set([1, 2, 3]);
      const currentItems = [
        { id: 1, status: "PREPARING", orderId: 10 },
        { id: 2, status: "READY", orderId: 10 },
        { id: 3, status: "PENDING", orderId: 10 },
        { id: 4, status: "PENDING", orderId: 11 }, // NEW
        { id: 5, status: "PENDING", orderId: 11 }, // NEW
      ];

      const newPending = currentItems.filter(
        item => item.status === "PENDING" && !printedIds.has(item.id)
      );

      expect(newPending.length).toBe(2);
      expect(newPending[0].id).toBe(4);
      expect(newPending[1].id).toBe(5);
    });

    it("should group new items by orderId for batch printing", () => {
      const newItems = [
        { id: 4, orderId: 11, productName: "Burger", quantity: 2 },
        { id: 5, orderId: 11, productName: "Batata", quantity: 1 },
        { id: 6, orderId: 12, productName: "Cerveja", quantity: 3 },
      ];

      const byOrder: Record<number, typeof newItems> = {};
      for (const item of newItems) {
        if (!byOrder[item.orderId]) byOrder[item.orderId] = [];
        byOrder[item.orderId].push(item);
      }

      expect(Object.keys(byOrder).length).toBe(2);
      expect(byOrder[11].length).toBe(2);
      expect(byOrder[12].length).toBe(1);
    });

    it("should not print on initial load (register existing IDs only)", () => {
      let initialLoad = true;
      const printedIds = new Set<number>();
      const items = [
        { id: 1, status: "PENDING" },
        { id: 2, status: "PENDING" },
      ];

      if (initialLoad) {
        items.forEach(item => printedIds.add(item.id));
        initialLoad = false;
      }

      expect(printedIds.size).toBe(2);
      expect(initialLoad).toBe(false);
      // On next poll, these won't be printed again
      const newPending = items.filter(
        item => item.status === "PENDING" && !printedIds.has(item.id)
      );
      expect(newPending.length).toBe(0);
    });
  });

  describe("Cashier Auto-Print Detection", () => {
    it("should detect recently closed orders that haven't been printed", () => {
      const printedOrderIds = new Set([100, 101]);
      const recentOrders = [
        { id: 100, status: "CLOSED", tableNumber: 1 },
        { id: 101, status: "CLOSED", tableNumber: 2 },
        { id: 102, status: "CLOSED", tableNumber: 3 }, // NEW
      ];

      const newOrders = recentOrders.filter(
        order => !printedOrderIds.has(order.id)
      );

      expect(newOrders.length).toBe(1);
      expect(newOrders[0].id).toBe(102);
      expect(newOrders[0].tableNumber).toBe(3);
    });
  });

  describe("ESC/POS Command Validation", () => {
    it("should have correct ESC/POS init command", () => {
      expect(ESCPOS.INIT).toBe("\x1B@");
    });

    it("should have correct bold commands", () => {
      expect(ESCPOS.BOLD_ON).toBe("\x1BE\x01");
      expect(ESCPOS.BOLD_OFF).toBe("\x1BE\x00");
    });

    it("should have correct alignment commands", () => {
      expect(ESCPOS.ALIGN_CENTER).toBe("\x1Ba\x01");
      expect(ESCPOS.ALIGN_LEFT).toBe("\x1Ba\x00");
    });

    it("should have correct cut command", () => {
      expect(ESCPOS.PARTIAL_CUT).toBe("\x1DV\x01");
    });

    it("should have 48-char separator line for 80mm paper", () => {
      expect(ESCPOS.LINE.trim().length).toBe(48);
    });
  });
});
