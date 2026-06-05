import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Auto-print architecture v48.1", () => {
  describe("SalaoComanda (garçom celular) - NÃO deve ter impressão", () => {
    const comanda = fs.readFileSync(
      path.resolve(__dirname, "../../client/src/pages/SalaoComanda.tsx"),
      "utf-8"
    );

    it("não importa printProductionTicket", () => {
      expect(comanda).not.toMatch(/import.*printProductionTicket.*from/);
    });

    it("não importa printReceipt", () => {
      expect(comanda).not.toMatch(/import.*printReceipt.*from/);
    });

    it("não chama printProductionTicket", () => {
      expect(comanda).not.toMatch(/printProductionTicket\s*\(/);
    });

    it("não chama printReceipt", () => {
      expect(comanda).not.toMatch(/printReceipt\s*\(/);
    });

    it("tem comentário explicando que impressão é no KDS/Caixa", () => {
      expect(comanda).toMatch(/[Ii]mpress.*KDS|[Ii]mpress.*computador central|[Ii]mpress.*Caixa/);
    });
  });

  describe("KDS Cozinha - DEVE ter auto-print", () => {
    const kdsCozinha = fs.readFileSync(
      path.resolve(__dirname, "../../client/src/pages/SalaoKDSCozinha.tsx"),
      "utf-8"
    );

    it("importa printProductionTicket", () => {
      expect(kdsCozinha).toMatch(/import.*printProductionTicket.*from.*printTicket/);
    });

    it("tem estado autoPrint", () => {
      expect(kdsCozinha).toMatch(/useState.*true.*autoPrint|autoPrint.*useState/);
    });

    it("tem ref printedItemIdsRef para evitar duplicatas", () => {
      expect(kdsCozinha).toMatch(/printedItemIdsRef/);
    });

    it("tem initialLoadRef para não imprimir na carga inicial", () => {
      expect(kdsCozinha).toMatch(/initialLoadRef/);
    });

    it("chama printProductionTicketViaAgent com destination KITCHEN", () => {
      expect(kdsCozinha).toMatch(/destination:\s*"KITCHEN"/);
      expect(kdsCozinha).toMatch(/printProductionTicketViaAgent/);
    });

    it("agrupa itens por orderId antes de imprimir", () => {
      expect(kdsCozinha).toMatch(/byOrder/);
    });
  });

  describe("KDS Bar - DEVE ter auto-print", () => {
    const kdsBar = fs.readFileSync(
      path.resolve(__dirname, "../../client/src/pages/SalaoKDSBar.tsx"),
      "utf-8"
    );

    it("importa printProductionTicket", () => {
      expect(kdsBar).toMatch(/import.*printProductionTicket.*from.*printTicket/);
    });

    it("tem estado autoPrint", () => {
      expect(kdsBar).toMatch(/useState.*true.*autoPrint|autoPrint.*useState/);
    });

    it("tem ref printedItemIdsRef para evitar duplicatas", () => {
      expect(kdsBar).toMatch(/printedItemIdsRef/);
    });

    it("chama printProductionTicketViaAgent com destination BAR", () => {
      expect(kdsBar).toMatch(/destination:\s*"BAR"/);
      expect(kdsBar).toMatch(/printProductionTicketViaAgent/);
    });
  });

  describe("Caixa - DEVE ter auto-print de cupom", () => {
    const caixa = fs.readFileSync(
      path.resolve(__dirname, "../../client/src/pages/SalaoCaixa.tsx"),
      "utf-8"
    );

    it("importa printReceipt", () => {
      expect(caixa).toMatch(/import.*printReceipt.*from.*printTicket/);
    });

    it("tem estado autoPrint", () => {
      expect(caixa).toMatch(/useState.*true.*autoPrint|autoPrint.*useState/);
    });

    it("tem ref printedOrderIdsRef para evitar duplicatas", () => {
      expect(caixa).toMatch(/printedOrderIdsRef/);
    });

    it("usa recentlyClosedOrders query", () => {
      expect(caixa).toMatch(/recentlyClosedOrders/);
    });

    it("chama printReceipt quando detecta nova ordem fechada", () => {
      expect(caixa).toMatch(/printReceipt\s*\(/);
    });

    it("tem botão de reimprimir manual", () => {
      expect(caixa).toMatch(/handleManualPrint|Reimprimir/);
    });
  });

  describe("Rota /salao/caixa registrada no App.tsx", () => {
    const app = fs.readFileSync(
      path.resolve(__dirname, "../../client/src/App.tsx"),
      "utf-8"
    );

    it("importa SalaoCaixa", () => {
      expect(app).toMatch(/import SalaoCaixa from/);
    });

    it("tem rota /salao/caixa", () => {
      expect(app).toMatch(/\/salao\/caixa/);
    });
  });

  describe("Endpoint recentlyClosedOrders no salon router", () => {
    const salon = fs.readFileSync(
      path.resolve(__dirname, "../../server/routers/salon.ts"),
      "utf-8"
    );

    it("tem procedure recentlyClosedOrders", () => {
      expect(salon).toMatch(/recentlyClosedOrders:\s*protectedProcedure/);
    });

    it("filtra por status CLOSED", () => {
      expect(salon).toMatch(/status.*CLOSED|CLOSED.*status/);
    });

    it("aceita sinceMinutes como parâmetro", () => {
      expect(salon).toMatch(/sinceMinutes/);
    });
  });
});
