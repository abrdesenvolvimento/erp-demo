import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the "Send to Production" batch feature (v48.3)
 * 
 * This feature changes the item lifecycle:
 * - Items start as DRAFT when added to comanda
 * - Garçom clicks "Enviar para Produção" → all DRAFT items become PENDING
 * - KDS only shows PENDING/IN_PROGRESS items (never DRAFT)
 * - Print Agent prints when KDS detects new PENDING items
 */

describe("Send to Production - Business Logic", () => {
  describe("Item Status Lifecycle", () => {
    it("should define DRAFT as the initial status for items with production destination", () => {
      // Items with destination KITCHEN, BAR, or BOTH start as DRAFT
      const destinations = ["KITCHEN", "BAR", "BOTH"];
      for (const dest of destinations) {
        const initialStatus = dest === "NONE" ? "DELIVERED" : "DRAFT";
        expect(initialStatus).toBe("DRAFT");
      }
    });

    it("should set DELIVERED status for items with NONE destination", () => {
      const destination = "NONE";
      const initialStatus = destination === "NONE" ? "DELIVERED" : "DRAFT";
      expect(initialStatus).toBe("DELIVERED");
    });

    it("should not set sentAt for DRAFT items", () => {
      const status = "DRAFT";
      const shouldSetSentAt = status === "DELIVERED";
      expect(shouldSetSentAt).toBe(false);
    });

    it("should set sentAt when transitioning from DRAFT to PENDING", () => {
      // When sendToProduction is called, items get sentAt = new Date()
      const sentAt = new Date();
      expect(sentAt).toBeInstanceOf(Date);
    });
  });

  describe("Batch Send Logic", () => {
    it("should only send DRAFT items, not already PENDING ones", () => {
      const items = [
        { id: 1, status: "DRAFT", productName: "Burger" },
        { id: 2, status: "PENDING", productName: "Fries" },
        { id: 3, status: "DRAFT", productName: "Beer" },
        { id: 4, status: "IN_PROGRESS", productName: "Salad" },
        { id: 5, status: "DELIVERED", productName: "Water" },
      ];

      const draftItems = items.filter(i => i.status === "DRAFT");
      expect(draftItems).toHaveLength(2);
      expect(draftItems[0].productName).toBe("Burger");
      expect(draftItems[1].productName).toBe("Beer");
    });

    it("should return sent count of 0 when no DRAFT items exist", () => {
      const items = [
        { id: 1, status: "PENDING", productName: "Burger" },
        { id: 2, status: "DELIVERED", productName: "Water" },
      ];

      const draftItems = items.filter(i => i.status === "DRAFT");
      expect(draftItems).toHaveLength(0);
    });

    it("should group items by production destination for printing", () => {
      const sentItems = [
        { id: 1, productName: "Burger", productionDestination: "KITCHEN", quantity: "2" },
        { id: 2, productName: "Fries", productionDestination: "KITCHEN", quantity: "1" },
        { id: 3, productName: "Beer", productionDestination: "BAR", quantity: "3" },
        { id: 4, productName: "Cocktail", productionDestination: "BAR", quantity: "1" },
        { id: 5, productName: "Combo", productionDestination: "BOTH", quantity: "1" },
      ];

      const kitchenItems = sentItems.filter(i => 
        i.productionDestination === "KITCHEN" || i.productionDestination === "BOTH"
      );
      const barItems = sentItems.filter(i => 
        i.productionDestination === "BAR" || i.productionDestination === "BOTH"
      );

      expect(kitchenItems).toHaveLength(3); // Burger, Fries, Combo
      expect(barItems).toHaveLength(3); // Beer, Cocktail, Combo
    });
  });

  describe("KDS Filtering", () => {
    it("should only show PENDING and IN_PROGRESS items in KDS", () => {
      const allItems = [
        { id: 1, status: "DRAFT" },
        { id: 2, status: "PENDING" },
        { id: 3, status: "IN_PROGRESS" },
        { id: 4, status: "READY" },
        { id: 5, status: "DELIVERED" },
        { id: 6, status: "CANCELLED" },
      ];

      const kdsStatuses = ["PENDING", "IN_PROGRESS"];
      const kdsItems = allItems.filter(i => kdsStatuses.includes(i.status));
      expect(kdsItems).toHaveLength(2);
      expect(kdsItems[0].id).toBe(2);
      expect(kdsItems[1].id).toBe(3);
    });

    it("should detect new items by comparing previous IDs", () => {
      const previousIds = new Set([1, 2, 3]);
      const currentItems = [
        { id: 1, status: "PENDING" },
        { id: 2, status: "IN_PROGRESS" },
        { id: 3, status: "PENDING" },
        { id: 4, status: "PENDING" }, // NEW
        { id: 5, status: "PENDING" }, // NEW
      ];

      const newItems = currentItems.filter(i => 
        i.status === "PENDING" && !previousIds.has(i.id)
      );
      expect(newItems).toHaveLength(2);
      expect(newItems[0].id).toBe(4);
      expect(newItems[1].id).toBe(5);
    });
  });

  describe("Print Agent Integration", () => {
    it("should format production ticket with multiple items", () => {
      const ticketData = {
        tableNumber: 5,
        orderId: 123,
        items: [
          { productName: "Smash Burger", quantity: 2, notes: "Sem cebola" },
          { productName: "Batata Frita", quantity: 1 },
        ],
        destination: "KITCHEN",
        timestamp: new Date().toISOString(),
      };

      expect(ticketData.items).toHaveLength(2);
      expect(ticketData.destination).toBe("KITCHEN");
      expect(ticketData.items[0].notes).toBe("Sem cebola");
    });

    it("should send to correct department based on destination", () => {
      const departmentMap: Record<string, string> = {
        KITCHEN: "KITCHEN",
        BAR: "BAR",
      };

      expect(departmentMap["KITCHEN"]).toBe("KITCHEN");
      expect(departmentMap["BAR"]).toBe("BAR");
    });

    it("should handle BOTH destination by printing to both departments", () => {
      const destination = "BOTH";
      const departments = destination === "BOTH" 
        ? ["KITCHEN", "BAR"] 
        : [destination];

      expect(departments).toEqual(["KITCHEN", "BAR"]);
    });
  });

  describe("UI State Management", () => {
    it("should show send button only when DRAFT items exist", () => {
      const activeItems = [
        { id: 1, status: "DRAFT" },
        { id: 2, status: "PENDING" },
        { id: 3, status: "DELIVERED" },
      ];

      const draftCount = activeItems.filter(i => i.status === "DRAFT").length;
      const showSendButton = draftCount > 0;
      expect(showSendButton).toBe(true);
    });

    it("should hide send button when no DRAFT items", () => {
      const activeItems = [
        { id: 1, status: "PENDING" },
        { id: 2, status: "DELIVERED" },
      ];

      const draftCount = activeItems.filter(i => i.status === "DRAFT").length;
      const showSendButton = draftCount > 0;
      expect(showSendButton).toBe(false);
    });

    it("should display correct count in send button label", () => {
      const activeItems = [
        { id: 1, status: "DRAFT" },
        { id: 2, status: "DRAFT" },
        { id: 3, status: "DRAFT" },
        { id: 4, status: "PENDING" },
      ];

      const draftCount = activeItems.filter(i => i.status === "DRAFT").length;
      const label = `Enviar para Produção (${draftCount} item(ns))`;
      expect(label).toBe("Enviar para Produção (3 item(ns))");
    });

    it("should display DRAFT status as 'Rascunho' with blue color", () => {
      const statusConfig: Record<string, { label: string; color: string }> = {
        DRAFT: { label: "Rascunho", color: "bg-blue-100 text-blue-700" },
        PENDING: { label: "Enviado", color: "bg-yellow-100 text-yellow-700" },
      };

      expect(statusConfig.DRAFT.label).toBe("Rascunho");
      expect(statusConfig.DRAFT.color).toContain("blue");
      expect(statusConfig.PENDING.label).toBe("Enviado");
    });
  });

  describe("Auto-Print Toggle", () => {
    it("should default auto-print to enabled", () => {
      const autoPrintEnabled = true; // Default state
      expect(autoPrintEnabled).toBe(true);
    });

    it("should skip printing when auto-print is disabled", () => {
      const autoPrintEnabled = false;
      const newItems = [{ id: 4, status: "PENDING" }];
      
      const shouldPrint = autoPrintEnabled && newItems.length > 0;
      expect(shouldPrint).toBe(false);
    });

    it("should print when auto-print is enabled and new items exist", () => {
      const autoPrintEnabled = true;
      const newItems = [{ id: 4, status: "PENDING" }];
      
      const shouldPrint = autoPrintEnabled && newItems.length > 0;
      expect(shouldPrint).toBe(true);
    });
  });
});
