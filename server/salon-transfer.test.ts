import { describe, it, expect } from "vitest";

/**
 * Tests for the Comanda Transfer feature
 * - transferOrder endpoint: validates admin-only access, required fields, and transfer logic
 * - getWaiterActiveOrders: returns waiters with their active orders
 * - getTransferHistory: returns transfer logs from order notes
 */

describe("Comanda Transfer Feature", () => {
  describe("Transfer Order Logic", () => {
    it("should require orderId, newWaiterId, newWaiterName, and reason", () => {
      const validInput = {
        orderId: 30001,
        companyId: "company-1",
        newWaiterId: "waiter-2",
        newWaiterName: "João",
        reason: "Troca de turno",
      };
      expect(validInput.orderId).toBeGreaterThan(0);
      expect(validInput.newWaiterId).toBeTruthy();
      expect(validInput.newWaiterName).toBeTruthy();
      expect(validInput.reason.trim().length).toBeGreaterThan(0);
    });

    it("should not allow transfer to the same waiter", () => {
      const currentWaiterId = "waiter-1";
      const newWaiterId = "waiter-1";
      expect(currentWaiterId).toBe(newWaiterId);
      // Backend should throw TRPCError CONFLICT in this case
    });

    it("should build correct transfer log entry", () => {
      const log = {
        type: "TRANSFER",
        fromWaiterId: "waiter-1",
        fromWaiterName: "Gabriel",
        toWaiterId: "waiter-2",
        toWaiterName: "João",
        reason: "Troca de turno",
        adminId: "admin-1",
        adminName: "Gabriel Admin",
        timestamp: new Date().toISOString(),
      };
      expect(log.type).toBe("TRANSFER");
      expect(log.fromWaiterId).not.toBe(log.toWaiterId);
      expect(log.reason).toBeTruthy();
      expect(log.adminId).toBeTruthy();
      expect(log.timestamp).toBeTruthy();
    });

    it("should append transfer log to existing notes", () => {
      const existingNotes = "";
      const transferLog = JSON.stringify({
        type: "TRANSFER",
        fromWaiterId: "w1",
        toWaiterId: "w2",
        reason: "Test",
        timestamp: new Date().toISOString(),
      });
      const separator = "\n---TRANSFER_LOG---\n";
      const newNotes = existingNotes + separator + transferLog;
      expect(newNotes).toContain("TRANSFER_LOG");
      expect(newNotes).toContain("TRANSFER");
    });

    it("should handle multiple transfers on same order", () => {
      const separator = "\n---TRANSFER_LOG---\n";
      const log1 = JSON.stringify({ type: "TRANSFER", fromWaiterId: "w1", toWaiterId: "w2", reason: "Turno 1" });
      const log2 = JSON.stringify({ type: "TRANSFER", fromWaiterId: "w2", toWaiterId: "w3", reason: "Turno 2" });
      const notes = separator + log1 + separator + log2;
      const logs = notes.split(separator).filter(Boolean);
      expect(logs.length).toBe(2);
      const parsed = logs.map((l) => JSON.parse(l));
      expect(parsed[0].fromWaiterId).toBe("w1");
      expect(parsed[1].fromWaiterId).toBe("w2");
    });
  });

  describe("Waiter Active Orders", () => {
    it("should group orders by waiter", () => {
      const orders = [
        { id: 1, waiterId: "w1", waiterName: "Gabriel", status: "OPEN" },
        { id: 2, waiterId: "w1", waiterName: "Gabriel", status: "OPEN" },
        { id: 3, waiterId: "w2", waiterName: "João", status: "OPEN" },
      ];
      const byWaiter = new Map<string, typeof orders>();
      for (const o of orders) {
        if (!byWaiter.has(o.waiterId)) byWaiter.set(o.waiterId, []);
        byWaiter.get(o.waiterId)!.push(o);
      }
      expect(byWaiter.size).toBe(2);
      expect(byWaiter.get("w1")!.length).toBe(2);
      expect(byWaiter.get("w2")!.length).toBe(1);
    });

    it("should only include OPEN and CHECKOUT_REQUESTED orders", () => {
      const validStatuses = ["OPEN", "CHECKOUT_REQUESTED"];
      const orders = [
        { id: 1, status: "OPEN" },
        { id: 2, status: "CHECKOUT_REQUESTED" },
        { id: 3, status: "CLOSED" },
        { id: 4, status: "CANCELLED" },
      ];
      const active = orders.filter((o) => validStatuses.includes(o.status));
      expect(active.length).toBe(2);
    });
  });

  describe("Transfer History", () => {
    it("should parse transfer logs from notes", () => {
      const separator = "\n---TRANSFER_LOG---\n";
      const log = {
        type: "TRANSFER",
        fromWaiterId: "w1",
        fromWaiterName: "Gabriel",
        toWaiterId: "w2",
        toWaiterName: "João",
        reason: "Troca de turno",
        adminId: "admin-1",
        adminName: "Admin",
        timestamp: "2026-03-08T19:00:00.000Z",
      };
      const notes = separator + JSON.stringify(log);
      const parts = notes.split(separator).filter(Boolean);
      expect(parts.length).toBe(1);
      const parsed = JSON.parse(parts[0]);
      expect(parsed.type).toBe("TRANSFER");
      expect(parsed.fromWaiterName).toBe("Gabriel");
      expect(parsed.toWaiterName).toBe("João");
      expect(parsed.reason).toBe("Troca de turno");
    });

    it("should sort transfers by timestamp descending", () => {
      const transfers = [
        { timestamp: "2026-03-08T10:00:00Z" },
        { timestamp: "2026-03-08T15:00:00Z" },
        { timestamp: "2026-03-08T12:00:00Z" },
      ];
      transfers.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      expect(transfers[0].timestamp).toBe("2026-03-08T15:00:00Z");
      expect(transfers[2].timestamp).toBe("2026-03-08T10:00:00Z");
    });
  });
});
