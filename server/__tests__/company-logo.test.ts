import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';

/**
 * Tests for company logo integration, selection flow, and data isolation.
 * Verifies source code patterns to ensure:
 * 1. The myCompanies query returns logoUrl for each company
 * 2. The companies table has logoUrl field in schema
 * 3. The CompanyGate loading state prevents flash
 * 4. All critical queries filter by companyId
 */

describe('Company Logo Integration', () => {
  it('should include companyLogoUrl in the select fields of myCompanies query', () => {
    const routerSource = fs.readFileSync('./server/routers/company.ts', 'utf-8');
    expect(routerSource).toContain('companyLogoUrl: companies.logoUrl');
  });

  it('should have logoUrl column in companies schema', () => {
    const schemaSource = fs.readFileSync('./drizzle/schema.ts', 'utf-8');
    expect(schemaSource).toContain('logoUrl: text("logoUrl")');
  });

  it('should have CompanyGate with loading state to prevent flash', () => {
    const appSource = fs.readFileSync('./client/src/App.tsx', 'utf-8');
    
    // Verify CompanyGate exists
    expect(appSource).toContain('CompanyGate');
    
    // Verify it has a loading state that prevents rendering children while company data loads
    expect(appSource).toContain('companyLoading');
    expect(appSource).toContain('switching');
  });

  it('should have SelectCompany page that displays company logos', () => {
    const selectSource = fs.readFileSync('./client/src/pages/SelectCompany.tsx', 'utf-8');
    
    // Verify it uses company logo URL
    expect(selectSource).toContain('companyLogoUrl');
  });

  it('should invalidate all queries when switching companies', () => {
    const contextSource = fs.readFileSync('./client/src/contexts/CompanyContext.tsx', 'utf-8');
    expect(contextSource).toContain('invalidateQueries');
  });

  it('should have DashboardLayout showing company logo in sidebar', () => {
    const dashSource = fs.readFileSync('./client/src/components/DashboardLayout.tsx', 'utf-8');
    
    // Verify the sidebar company switcher uses logos
    expect(dashSource).toContain('companyLogoUrl');
    expect(dashSource).toContain('object-cover');
  });
});

describe('Company Data Isolation - companyId Filters', () => {
  it('should have companyId filter in getPurchaseOrders', () => {
    const dbSource = fs.readFileSync('./server/db.ts', 'utf-8');
    
    // Find getPurchaseOrders function and verify it uses companyId
    const funcMatch = dbSource.match(/export async function getPurchaseOrders[\s\S]*?(?=\nexport async function)/);
    expect(funcMatch).toBeTruthy();
    expect(funcMatch![0]).toContain('companyId');
  });

  it('should have companyId filter in closingQueries functions', () => {
    const closingSource = fs.readFileSync('./server/closingQueries.ts', 'utf-8');
    
    // All 6 closing functions should use companyId
    const functions = [
      'getSalesByChannel',
      'getSalesByCategory', 
      'getPurchasesByCategory',
      'getSalesByPaymentType',
      'getStockByCategory',
      'getPurchasesBySupplier'
    ];
    
    for (const fn of functions) {
      // Use a more flexible regex that matches to the next function or end of file
      const funcMatch = closingSource.match(new RegExp(`function ${fn}[\\s\\S]*?(?=\\nfunction |\\nexport |$)`));
      expect(funcMatch, `${fn} should exist`).toBeTruthy();
      expect(funcMatch![0], `${fn} should use companyId`).toContain('companyId');
    }
  });

  it('should have companyId filter in stockAnalysisQueries functions', () => {
    const stockSource = fs.readFileSync('./server/stockAnalysisQueries.ts', 'utf-8');
    
    expect(stockSource).toContain('companyId');
    
    const functions = ['getStockAnalysisByCategory', 'getStockAnalysisByProduct'];
    for (const fn of functions) {
      const funcMatch = stockSource.match(new RegExp(`function ${fn}[\\s\\S]*?(?=\\nfunction |\\nexport |$)`));
      expect(funcMatch, `${fn} should exist`).toBeTruthy();
      expect(funcMatch![0], `${fn} should use companyId`).toContain('companyId');
    }
  });

  it('should have accounting router using ctx.activeCompanyId (not hardcoded)', () => {
    const accountingSource = fs.readFileSync('./server/routers/accounting.ts', 'utf-8');
    
    // Should NOT have hardcoded companyId: 1 (except in comments)
    const lines = accountingSource.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    const nonCommentSource = lines.join('\n');
    expect(nonCommentSource).not.toMatch(/companyId:\s*1\b/);
    
    // Should use ctx.activeCompanyId
    expect(accountingSource).toContain('ctx.activeCompanyId');
  });

  it('should have stockAnalysis router passing companyId from context', () => {
    const stockRouterSource = fs.readFileSync('./server/routers/stockAnalysis.ts', 'utf-8');
    expect(stockRouterSource).toContain('ctx.activeCompanyId');
  });
});
