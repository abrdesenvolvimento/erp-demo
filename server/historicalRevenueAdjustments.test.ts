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

  it("inicia novos ajustes como rascunho e exige aprovação administrativa explícita", () => {
    expect(routerContent).toContain('status: "DRAFT"');
    expect(routerContent).toContain('approveDrafts: adminProcedure');
    expect(routerContent).toContain('cancelApproved: adminProcedure');
  });

  it("restringe alteração e exclusão a rascunhos da empresa ativa", () => {
    expect(routerContent).toContain('updateHistoricalRevenueAdjustmentDraft(id, requireActiveCompanyId(ctx.activeCompanyId)');
    expect(routerContent).toContain('deleteHistoricalRevenueAdjustmentDraft(input.id, requireActiveCompanyId(ctx.activeCompanyId)');
  });

  it("explica na interface os limites operacionais dos ajustes publicados", () => {
    expect(pageContent).toContain('não afetam faturamento, estoque, caixa, Contas a Receber ou contabilidade');
    expect(pageContent).toContain('não criam vendas, produtos, formas de pagamento, estoque, caixa, Contas a Receber, CMV, DRE ou lançamentos contábeis');
  });

  it("inclui somente ajustes aprovados na visão gerencial, mantendo o fechamento contábil real separado", () => {
    const monthlyClosingSection = dbContent.slice(
      dbContent.indexOf("export async function getMonthlyClosing"),
      dbContent.indexOf("export async function getYearlyClosing")
    );
    expect(monthlyClosingSection).toContain("getApprovedHistoricalRevenueForPeriod");
    expect(monthlyClosingSection).toContain("managementRevenue");
    expect(monthlyClosingSection).toContain("cashFlow:");
  });

  it("mantém a trilha de aprovação e cancelamento, e reutiliza somente o recorte APPROVED nas análises", () => {
    expect(schemaContent).toContain('cancelledAt: timestamp("cancelledAt")');
    expect(schemaContent).toContain('cancellationReason: varchar("cancellationReason", { length: 500 })');
    expect(dbContent).toContain("approveHistoricalRevenueAdjustments");
    expect(dbContent).toContain("cancelApprovedHistoricalRevenueAdjustment");
    expect(dbContent).toContain('eq(historicalRevenueAdjustments.status, "APPROVED")');
    expect(dbContent).toContain("getApprovedHistoricalRevenueForPeriod(companyId, firstDayOfMonth, lastDayOfMonth)");
    expect(dbContent).toContain("getApprovedHistoricalRevenueForPeriod(companyId, firstDayOfYear, lastDayOfYear)");
  });
});
