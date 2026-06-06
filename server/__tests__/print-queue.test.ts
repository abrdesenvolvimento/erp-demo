import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Print Queue Architecture (server-side fila de impressão)", () => {
  describe("Schema - printJobs table", () => {
    const schema = fs.readFileSync(
      path.resolve(__dirname, "../../drizzle/schema.ts"),
      "utf-8"
    );

    it("define printJobs table", () => {
      expect(schema).toMatch(/export const printJobs\s*=\s*mysqlTable/);
    });

    it("has companyId column", () => {
      expect(schema).toMatch(/printJobs[\s\S]*companyId/);
    });

    it("has type column with production_ticket and receipt", () => {
      expect(schema).toMatch(/printJobs[\s\S]*type[\s\S]*production_ticket/);
      expect(schema).toMatch(/printJobs[\s\S]*receipt/);
    });

    it("has department column with KITCHEN, BAR, CASHIER", () => {
      expect(schema).toMatch(/printJobs[\s\S]*department[\s\S]*KITCHEN/);
      expect(schema).toMatch(/printJobs[\s\S]*BAR/);
      expect(schema).toMatch(/printJobs[\s\S]*CASHIER/);
    });

    it("has status column with PENDING, PROCESSING, DONE, FAILED", () => {
      expect(schema).toMatch(/printJobs[\s\S]*status[\s\S]*PENDING/);
      expect(schema).toMatch(/PROCESSING/);
      expect(schema).toMatch(/DONE/);
      expect(schema).toMatch(/FAILED/);
    });

    it("has payload column (text)", () => {
      expect(schema).toMatch(/printJobs[\s\S]*payload/);
    });
  });

  describe("Server endpoints - REST API for Print Agent polling", () => {
    const serverIndex = fs.readFileSync(
      path.resolve(__dirname, "../_core/index.ts"),
      "utf-8"
    );

    it("has GET /api/print-jobs/pending endpoint", () => {
      expect(serverIndex).toMatch(/app\.get\(['"]\/api\/print-jobs\/pending['"]/);
    });

    it("has POST /api/print-jobs/complete endpoint", () => {
      expect(serverIndex).toMatch(/app\.post\(['"]\/api\/print-jobs\/complete['"]/);
    });

    it("marks stale jobs as FAILED (expiration logic)", () => {
      expect(serverIndex).toMatch(/Expired|fiveMinAgo/);
    });

    it("marks fetched jobs as PROCESSING", () => {
      expect(serverIndex).toMatch(/status:\s*['"]PROCESSING['"]/);
    });
  });

  describe("Salon router - tRPC mutations for print queue", () => {
    const salon = fs.readFileSync(
      path.resolve(__dirname, "../routers/salon.ts"),
      "utf-8"
    );

    it("has requestPrint mutation", () => {
      expect(salon).toMatch(/requestPrint:\s*protectedProcedure/);
    });

    it("has requestPrintMulti mutation for multiple departments", () => {
      expect(salon).toMatch(/requestPrintMulti:\s*protectedProcedure/);
    });

    it("imports printJobs from schema", () => {
      expect(salon).toMatch(/import[\s\S]*printJobs[\s\S]*from.*schema/);
    });

    it("inserts into printJobs table", () => {
      expect(salon).toMatch(/insert\(printJobs\)/);
    });
  });

  describe("SalaoComanda (garçom celular) - usa fila do servidor", () => {
    const comanda = fs.readFileSync(
      path.resolve(__dirname, "../../client/src/pages/SalaoComanda.tsx"),
      "utf-8"
    );

    it("NÃO importa printReceiptViaAgent (não acessa agent direto)", () => {
      expect(comanda).not.toMatch(/import.*printReceiptViaAgent/);
    });

    it("NÃO importa de printService", () => {
      expect(comanda).not.toMatch(/import.*from.*printService/);
    });

    it("usa trpc.salon.requestPrint mutation", () => {
      expect(comanda).toMatch(/trpc\.salon\.requestPrint\.useMutation/);
    });

    it("envia para departamento CASHIER", () => {
      expect(comanda).toMatch(/department:\s*["']CASHIER["']/);
    });

    it("envia type receipt", () => {
      expect(comanda).toMatch(/type:\s*["']receipt["']/);
    });
  });

  describe("SalaoCaixa (desktop) - mantém impressão direta via agent", () => {
    const caixa = fs.readFileSync(
      path.resolve(__dirname, "../../client/src/pages/SalaoCaixa.tsx"),
      "utf-8"
    );

    it("importa printReceiptViaAgent (desktop tem acesso direto ao agent)", () => {
      expect(caixa).toMatch(/import.*printReceiptViaAgent.*from.*printService/);
    });

    it("chama printReceiptViaAgent diretamente", () => {
      expect(caixa).toMatch(/printReceiptViaAgent\s*\(/);
    });
  });

  describe("Print Agent v2.0 - polling do servidor", () => {
    const agent = fs.readFileSync(
      path.resolve(__dirname, "../../print-agent/print-agent.js"),
      "utf-8"
    );

    it("é versão 2.0", () => {
      expect(agent).toMatch(/v2\.0/);
    });

    it("tem função pollForJobs", () => {
      expect(agent).toMatch(/async function pollForJobs/);
    });

    it("tem função startPolling", () => {
      expect(agent).toMatch(/function startPolling/);
    });

    it("tem função stopPolling", () => {
      expect(agent).toMatch(/function stopPolling/);
    });

    it("tem função reportJobComplete", () => {
      expect(agent).toMatch(/async function reportJobComplete/);
    });

    it("busca /api/print-jobs/pending", () => {
      expect(agent).toMatch(/\/api\/print-jobs\/pending/);
    });

    it("reporta para /api/print-jobs/complete", () => {
      expect(agent).toMatch(/\/api\/print-jobs\/complete/);
    });

    it("tem configuração serverUrl", () => {
      expect(agent).toMatch(/serverUrl/);
    });

    it("tem configuração companyId", () => {
      expect(agent).toMatch(/companyId/);
    });

    it("tem backoff em caso de erros consecutivos", () => {
      expect(agent).toMatch(/MAX_CONSECUTIVE_ERRORS|consecutiveErrors/);
    });

    it("mantém endpoint /print direto para desktop/KDS", () => {
      expect(agent).toMatch(/app\.post\(['"]\/print['"]/);
    });

    it("mantém endpoint /print-multi para múltiplos departamentos", () => {
      expect(agent).toMatch(/app\.post\(['"]\/print-multi['"]/);
    });
  });
});
