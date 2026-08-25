import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
const routerPath = path.resolve(__dirname, "routers/historicalRevenueAdjustments.ts");
const pagePath = path.resolve(__dirname, "../client/src/pages/AjustesFaturamentoHistorico.tsx");
const dbPath = path.resolve(__dirname, "db.ts");

const schemaContent = fs.readFileSync(schemaPath, "utf-8");
const routerContent = fs.readFileSync(routerPath, "utf-8");
const pageContent = fs.readFileSync(pagePath, "utf-8");
const dbContent = fs.readFileSync(dbPath, "utf-8");

describe("Ajustes históricos de faturamento", () => {
  it("mantém uma tabela específica, separada das vendas operacionais", () => {
    expect(schemaContent).toContain('mysqlTable("historicalRevenueAdjustments"');
    expect(schemaContent).toContain('status", ["DRAFT", "APPROVED", "CANCELLED"]');
    expect(schemaContent).not.toContain('historicalRevenueAdjustment: mysqlTable("sales"');
  });

  it("inicia novos ajustes como rascunho e não expõe aprovação na API inicial", () => {
    expect(routerContent).toContain('status: "DRAFT"');
    expect(routerContent).not.toContain('approveDraft');
  });

  it("restringe alteração e exclusão a rascunhos da empresa ativa", () => {
    expect(routerContent).toContain('updateHistoricalRevenueAdjustmentDraft(id, ctx.activeCompanyId || 1');
    expect(routerContent).toContain('deleteHistoricalRevenueAdjustmentDraft(input.id, ctx.activeCompanyId || 1');
  });

  it("explica na interface que rascunhos não afetam relatórios, estoque, caixa ou contas a receber", () => {
    expect(pageContent).toContain('não afetam faturamento, estoque, caixa, Contas a Receber ou contabilidade');
    expect(pageContent).toContain('A aprovação para refletir em análises será uma etapa posterior');
  });

  it("não inclui rascunhos no fechamento mensal atual", () => {
    const monthlyClosingSection = dbContent.slice(
      dbContent.indexOf("export async function getMonthlyClosing"),
      dbContent.indexOf("export async function getYearlyClosing")
    );
    expect(monthlyClosingSection).not.toContain("historicalRevenueAdjustments");
  });
});
