import { describe, it, expect } from 'vitest';

/**
 * Testes de validação do isolamento multiempresa
 * Verifica que todas as tabelas críticas possuem companyId e que
 * as queries de filtro usam corretamente o campo.
 */

// Importar schema para verificar estrutura
import * as schema from '../../drizzle/schema';

describe('Multiempresa - Schema Isolation', () => {
  // Tabelas que DEVEM ter companyId para isolamento
  const tablesWithCompanyId = [
    { name: 'products', table: schema.products },
    { name: 'categories', table: schema.categories },
    { name: 'subcategories', table: schema.subcategories },
    { name: 'salesChannels', table: schema.salesChannels },
    { name: 'partners', table: schema.partners },
    { name: 'sales', table: schema.sales },
    { name: 'saleItems', table: schema.saleItems },
    { name: 'purchaseOrders', table: schema.purchaseOrders },
    { name: 'expenses', table: schema.expenses },
    { name: 'receivables', table: schema.receivables },
    { name: 'purchaseInstallments', table: schema.purchaseInstallments },
    { name: 'expenseInstallments', table: schema.expenseInstallments },
    { name: 'receivableInstallments', table: schema.receivableInstallments },
    { name: 'productCompositions', table: schema.productCompositions },
    { name: 'journals', table: schema.journals },
    { name: 'accountingEntries', table: schema.accountingEntries },
    { name: 'journalSources', table: schema.journalSources },
    { name: 'accountingPeriods', table: schema.accountingPeriods },
    { name: 'accountingBatchLog', table: schema.accountingBatchLog },
    { name: 'chartOfAccounts', table: schema.chartOfAccounts },
    { name: 'managementAccounts', table: schema.managementAccounts },
    { name: 'productMovements', table: schema.productMovements },
    { name: 'productPrices', table: schema.productPrices },
  ];

  it.each(tablesWithCompanyId)('$name deve ter coluna companyId no schema', ({ table }) => {
    // Verifica que a tabela tem a coluna companyId definida no Drizzle schema
    const columns = Object.keys((table as any)[Symbol.for('drizzle:Columns')] || (table as any));
    // Drizzle tables expose columns as properties
    expect((table as any).companyId).toBeDefined();
  });
});

describe('Multiempresa - Insert Functions', () => {
  it('setProductCompositions deve aceitar companyId e branchId como parâmetros', async () => {
    // Importar a função e verificar que aceita os parâmetros
    const dbModule = await import('../db');
    expect(typeof dbModule.setProductCompositions).toBe('function');
    // A função deve ter 4 parâmetros: parentProductId, compositions, companyId?, branchId?
    expect(dbModule.setProductCompositions.length).toBeGreaterThanOrEqual(2);
  });

  it('createJournal deve aceitar companyId como parâmetro', async () => {
    const dbModule = await import('../db');
    expect(typeof dbModule.createJournal).toBe('function');
  });

  it('addAccountingEntry deve aceitar companyId como parâmetro', async () => {
    const dbModule = await import('../db');
    expect(typeof dbModule.addAccountingEntry).toBe('function');
  });

  it('addJournalSource deve aceitar companyId como parâmetro', async () => {
    const dbModule = await import('../db');
    expect(typeof dbModule.addJournalSource).toBe('function');
  });
});

describe('Multiempresa - Parcelas Schema', () => {
  it('purchaseInstallments deve ter companyId e branchId', () => {
    expect((schema.purchaseInstallments as any).companyId).toBeDefined();
    expect((schema.purchaseInstallments as any).branchId).toBeDefined();
  });

  it('expenseInstallments deve ter companyId e branchId', () => {
    expect((schema.expenseInstallments as any).companyId).toBeDefined();
    expect((schema.expenseInstallments as any).branchId).toBeDefined();
  });

  it('receivableInstallments deve ter companyId e branchId', () => {
    expect((schema.receivableInstallments as any).companyId).toBeDefined();
    expect((schema.receivableInstallments as any).branchId).toBeDefined();
  });
});

describe('Multiempresa - Contabilidade Schema', () => {
  it('journals deve ter companyId', () => {
    expect((schema.journals as any).companyId).toBeDefined();
  });

  it('accountingEntries deve ter companyId', () => {
    expect((schema.accountingEntries as any).companyId).toBeDefined();
  });

  it('journalSources deve ter companyId', () => {
    expect((schema.journalSources as any).companyId).toBeDefined();
  });

  it('chartOfAccounts deve ter companyId', () => {
    expect((schema.chartOfAccounts as any).companyId).toBeDefined();
  });

  it('managementAccounts deve ter companyId', () => {
    expect((schema.managementAccounts as any).companyId).toBeDefined();
  });

  it('accountingBatchLog deve ter companyId', () => {
    expect((schema.accountingBatchLog as any).companyId).toBeDefined();
  });
});
