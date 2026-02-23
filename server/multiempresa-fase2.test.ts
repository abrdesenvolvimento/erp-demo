import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Multiempresa Fase 2 - Testes de Validação Estrutural
 * 
 * Verifica que todas as funções operacionais do db.ts, closingQueries.ts
 * e routers.ts foram atualizadas para suportar filtro por companyId.
 */

const DB_PATH = path.resolve(__dirname, '../server/db.ts');
const ROUTERS_PATH = path.resolve(__dirname, '../server/routers.ts');
const CLOSING_PATH = path.resolve(__dirname, '../server/closingQueries.ts');
const CONTEXT_PATH = path.resolve(__dirname, '../server/_core/context.ts');
const SCHEMA_PATH = path.resolve(__dirname, '../drizzle/schema.ts');

const dbContent = fs.readFileSync(DB_PATH, 'utf-8');
const routersContent = fs.readFileSync(ROUTERS_PATH, 'utf-8');
const closingContent = fs.readFileSync(CLOSING_PATH, 'utf-8');
const contextContent = fs.readFileSync(CONTEXT_PATH, 'utf-8');
const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');

describe('Multiempresa Fase 2 - Schema', () => {
  const operationalTables = [
    'sales',
    'saleItems',
    'purchaseOrders',
    'purchaseOrderItems',
    'expenses',
    'receivables',
    // receivableInstallments herda companyId do pai (receivables)
    'revenueGoals',
    'managementAccounts',
  ];

  it.each(operationalTables)('tabela %s deve ter companyId no schema', (table) => {
    // Find the table definition and check it has companyId
    const tableRegex = new RegExp(`export const ${table} = mysqlTable[\\s\\S]*?\\}\\)`, 'g');
    const match = schemaContent.match(tableRegex);
    expect(match).toBeTruthy();
    expect(match![0]).toContain('companyId');
  });
});

describe('Multiempresa Fase 2 - Context', () => {
  it('context.ts deve ter activeCompanyId como number | undefined', () => {
    expect(contextContent).toContain('activeCompanyId');
    // Should NOT be null type
    expect(contextContent).not.toMatch(/activeCompanyId.*number \| null/);
  });

  it('context.ts deve ter activeBranchId como number | undefined', () => {
    expect(contextContent).toContain('activeBranchId');
    expect(contextContent).not.toMatch(/activeBranchId.*number \| null/);
  });
});

describe('Multiempresa Fase 2 - db.ts Funções Operacionais', () => {
  // Funções que DEVEM ter companyId como parâmetro
  const functionsWithCompanyId = [
    'getSales',
    'getSalesCalendar',
    'getSalesForExport',
    'getSalesStats',
    // createSale recebe companyId dentro do objeto de dados, não como parâmetro separado
    'getExpenses',
    // createExpense recebe companyId dentro do objeto de dados, não como parâmetro separado
    'listReceivables',
    'getReceivablesSummary',
    'getCustomersWithPendingReceivables',
    'getTotalPendingReceivables',
    'getSuppliersWithPendingPayables',
    'getTotalPendingPayables',
    'getPaymentHistory',
    'getPayablesCalendar',
    'getCustomersWithBalance',
    'getCustomerAccountHistory',
    'getDashboardDailyRevenue',
    'getDashboardMonthlyRevenue',
    'getDashboardMonthlyPurchases',
    'getCategories',
    'getSalesChannels',
    'getPurchaseTotalCurrentMonth',
    'getPurchaseTotalByDocType',
    'getGrossMarginByCategory',
    'getDeliveryProductAnalysis',
    'getDeliveryNetMarginOptimized',
    'getProducts',
    'getSalesAnalysisSummary',
    'getSalesAnalysisByValue',
    'getSalesAnalysisByQuantity',
    'getSalesAnalysisByCategoryValue',
    'getSalesAnalysisByDay',
    'getSalesAnalysisByWeek',
    'getSalesAnalysisByMonth',
    'getSalesByProductAndDate',
    'getExpenseAnalysisSummary',
    'getExpenseAnalysisByCategory',
    'getExpenseAnalysisByMonth',
    'getExpenseAnalysisByCategoryAndMonth',
    'getExpenseAnalysisDetail',
    'getExpenseHierarchicalData',
    'getMonthlyClosing',
    'getYearlyClosing',
    'getRevenueGoals',
    'getRevenueGoal',
    'getRevenueGoalProgress',
    'getAllRevenueGoalHistory',
    'listManagementAccounts',
    'listManagementAccountsForSelect',
    'listManagementAccountsGrouped',
    'getProductMovements',
  ];

  it.each(functionsWithCompanyId)('função %s deve ter companyId como parâmetro', (funcName) => {
    // Find the function signature
    const funcRegex = new RegExp(`export async function ${funcName}\\([^)]*`, 'g');
    const match = dbContent.match(funcRegex);
    expect(match).toBeTruthy();
    // At least one of the matches should have companyId
    const hasCompanyId = match!.some(m => m.includes('companyId'));
    expect(hasCompanyId).toBe(true);
  });
});

describe('Multiempresa Fase 2 - db.ts Filtros SQL', () => {
  it('deve ter filtros companyId em whereConditions para vendas', () => {
    // Count occurrences of companyId filter in whereConditions
    const salesFilters = (dbContent.match(/companyId.*whereConditions|whereConditions.*companyId/g) || []).length;
    expect(salesFilters).toBeGreaterThanOrEqual(5);
  });

  it('deve ter filtros companyId em whereClause para despesas', () => {
    const expenseFilters = (dbContent.match(/companyId.*whereClause|whereClause.*companyId/g) || []).length;
    expect(expenseFilters).toBeGreaterThanOrEqual(5);
  });
});

describe('Multiempresa Fase 2 - closingQueries.ts', () => {
  const closingFunctions = [
    'getSalesByCategory',
    'getPurchasesByCategory',
    'getSalesByPaymentType',
    'getSalesByChannel',
    'getPurchasesBySupplier',
    'getStockByCategory',
  ];

  it.each(closingFunctions)('função %s deve ter companyId como parâmetro', (funcName) => {
    const funcRegex = new RegExp(`export async function ${funcName}\\([^)]*`, 'g');
    const match = closingContent.match(funcRegex);
    expect(match).toBeTruthy();
    const hasCompanyId = match!.some(m => m.includes('companyId'));
    expect(hasCompanyId).toBe(true);
  });
});

describe('Multiempresa Fase 2 - routers.ts', () => {
  it('deve ter ctx.activeCompanyId em chamadas de vendas', () => {
    const salesCalls = (routersContent.match(/db\.getSales.*activeCompanyId|db\.createSale.*activeCompanyId|db\.getSalesStats.*activeCompanyId/g) || []).length;
    expect(salesCalls).toBeGreaterThanOrEqual(3);
  });

  it('deve ter ctx.activeCompanyId em chamadas de compras', () => {
    const purchaseCalls = (routersContent.match(/db\.createPurchaseOrder.*activeCompanyId|db\.getPurchaseTotalCurrentMonth.*activeCompanyId/g) || []).length;
    expect(purchaseCalls).toBeGreaterThanOrEqual(1);
  });

  it('deve ter ctx.activeCompanyId em chamadas de despesas', () => {
    const expenseCalls = (routersContent.match(/db\.getExpenses.*activeCompanyId|db\.createExpense.*activeCompanyId/g) || []).length;
    expect(expenseCalls).toBeGreaterThanOrEqual(1);
  });

  it('deve ter ctx.activeCompanyId em chamadas de dashboard', () => {
    const dashboardCalls = (routersContent.match(/db\.getDashboard.*activeCompanyId/g) || []).length;
    expect(dashboardCalls).toBeGreaterThanOrEqual(2);
  });

  it('deve ter ctx.activeCompanyId em chamadas de fechamento', () => {
    const closingCalls = (routersContent.match(/db\.getMonthlyClosing.*activeCompanyId|db\.getYearlyClosing.*activeCompanyId/g) || []).length;
    expect(closingCalls).toBeGreaterThanOrEqual(2);
  });

  it('deve ter ctx.activeCompanyId em chamadas de análise de vendas', () => {
    const analysisCalls = (routersContent.match(/db\.getSalesAnalysis.*activeCompanyId/g) || []).length;
    expect(analysisCalls).toBeGreaterThanOrEqual(5);
  });

  it('deve ter ctx.activeCompanyId em chamadas de análise de despesas', () => {
    const expenseAnalysisCalls = (routersContent.match(/db\.getExpenseAnalysis.*activeCompanyId/g) || []).length;
    expect(expenseAnalysisCalls).toBeGreaterThanOrEqual(3);
  });

  it('não deve ter handlers com ctx não encontrado (todos devem ter ctx no destructuring)', () => {
    // Check that all handlers that use ctx.activeCompanyId have ctx in their destructuring
    const lines = routersContent.split('\n');
    const issues: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('ctx.activeCompanyId') || lines[i].includes('ctx.activeBranchId')) {
        // Look backwards for the handler definition
        let found = false;
        for (let j = i; j >= Math.max(i - 30, 0); j--) {
          if (lines[j].includes('.query(') || lines[j].includes('.mutation(')) {
            if (lines[j].includes('ctx')) {
              found = true;
            }
            break;
          }
        }
        if (!found) {
          issues.push(`Line ${i + 1}: uses ctx but handler may not have ctx in destructuring`);
        }
      }
    }
    
    // Allow up to 10 false positives (some handlers use ctx from protectedProcedure, company router additions)
    expect(issues.length).toBeLessThanOrEqual(10);
  });
});
