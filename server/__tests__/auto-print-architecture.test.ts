import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Auto-print architecture v48.1", () => {
  describe("SalaoComanda (garçom celular) - usa fila do servidor para impressão", () => {
    const comanda = fs.readFileSync(
      path.resolve(__dirname, "../../client/src/pages/SalaoComanda.tsx"),
      "utf-8"
    );

    it("não importa printProductionTicket", () => {
      expect(comanda).not.toMatch(/import.*printProductionTicket.*from/);
    });

    it("não importa de printService (usa fila do servidor)", () => {
      expect(comanda).not.toMatch(/import.*from.*printService/);
    });

    it("usa trpc.salon.requestPrint para enviar via fila do servidor", () => {
      expect(comanda).toMatch(/trpc\.salon\.requestPrint/);
    });

    it("não chama printProductionTicket", () => {
      expect(comanda).not.toMatch(/printProductionTicket\s*\(/);
    });

    it("não chama printReceipt diretamente", () => {
      expect(comanda).not.toMatch(/printReceipt\s*\(/);
    });

    it("tem comentário explicando que impressão é via fila do servidor", () => {
      expect(comanda).toMatch(/[Ii]mpress.*fila.*servidor|[Ii]mpress.*Print Agent.*busca|[Ii]mpress.*Caixa/);
    });
  });

  describe("KDS Cozinha - DEVE ter auto-print", () => {
    const kdsCozinha = fs.readFileSync(
      path.resolve(__dirname, "../../client/src/pages/SalaoKDSCozinha.tsx"),
      "utf-8"
    );

    it("NÃO importa printProductionTicket (sem fallback window.print)", () => {
      expect(kdsCozinha).not.toMatch(/import.*printProductionTicket.*from.*printTicket/);
    });

    it("mostra toast.error quando agent offline", () => {
      expect(kdsCozinha).toMatch(/toast\.error.*Print Agent offline/);
    });

    it("tem estado autoPrint", () => {
      expect(kdsCozinha).toMatch(/useState.*true.*autoPrint|autoPrint.*useState/);
    });

    it("tem ref printedItemIdsRef para evitar duplicatas", () => {
      expect(kdsCozinha).toMatch(/printedItemIdsRef/);
    });

    it("tem initialLoadRef para controlar carga inicial (imprime recentes < 2min)", () => {
      expect(kdsCozinha).toMatch(/initialLoadRef/);
      expect(kdsCozinha).toMatch(/RECENT_THRESHOLD_MS/);
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

    it("NÃO importa printProductionTicket (sem fallback window.print)", () => {
      expect(kdsBar).not.toMatch(/import.*printProductionTicket.*from.*printTicket/);
    });

    it("mostra toast.error quando agent offline", () => {
      expect(kdsBar).toMatch(/toast\.error.*Print Agent offline/);
    });

    it("tem estado autoPrint", () => {
      expect(kdsBar).toMatch(/useState.*true.*autoPrint|autoPrint.*useState/);
    });

    it("tem ref printedItemIdsRef para evitar duplicatas", () => {
      expect(kdsBar).toMatch(/printedItemIdsRef/);
    });

    it("tem initialLoadRef com threshold de 2min para imprimir recentes", () => {
      expect(kdsBar).toMatch(/initialLoadRef/);
      expect(kdsBar).toMatch(/RECENT_THRESHOLD_MS/);
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

    it("importa printReceiptViaAgent de printService (sem printTicket fallback)", () => {
      expect(caixa).toMatch(/import.*printReceiptViaAgent.*from.*printService/);
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

    it("chama printReceiptViaAgent quando detecta nova ordem fechada (sem fallback window.print)", () => {
      expect(caixa).toMatch(/printReceiptViaAgent\s*\(/);
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
