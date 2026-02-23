import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const dbContent = fs.readFileSync(path.resolve(__dirname, 'db.ts'), 'utf-8');
const contextContent = fs.readFileSync(path.resolve(__dirname, '../client/src/contexts/CompanyContext.tsx'), 'utf-8');
const appContent = fs.readFileSync(path.resolve(__dirname, '../client/src/App.tsx'), 'utf-8');
const selectCompanyExists = fs.existsSync(path.resolve(__dirname, '../client/src/pages/SelectCompany.tsx'));

describe('Dashboard queries filtram por companyId', () => {
  const dashboardFunctions = [
    'getDashboardDailyRevenue',
    'getDashboardMonthlyRevenue',
    'getDashboardMonthlyPurchases',
    'getDeliveryNetMarginOptimized',
  ];

  it.each(dashboardFunctions)('%s recebe companyId como parâmetro', (fn) => {
    const regex = new RegExp(`export async function ${fn}\\(companyId`);
    expect(dbContent).toMatch(regex);
  });

  it('getDashboardDailyRevenue filtra por companyId no SQL', () => {
    // Encontrar a função getDashboardDailyRevenue e verificar se tem filtro companyId no SQL
    const fnMatch = dbContent.match(/export async function getDashboardDailyRevenue[\s\S]*?^}/m);
    expect(fnMatch).toBeTruthy();
    expect(fnMatch![0]).toContain('AND companyId = ${companyId}');
  });

  it('getDashboardMonthlyRevenue filtra por companyId no SQL', () => {
    const fnMatch = dbContent.match(/export async function getDashboardMonthlyRevenue[\s\S]*?^}/m);
    expect(fnMatch).toBeTruthy();
    expect(fnMatch![0]).toContain('AND companyId = ${companyId}');
  });

  it('getDashboardMonthlyPurchases filtra por companyId no SQL', () => {
    const fnMatch = dbContent.match(/export async function getDashboardMonthlyPurchases[\s\S]*?^}/m);
    expect(fnMatch).toBeTruthy();
    expect(fnMatch![0]).toContain('AND companyId = ${companyId}');
  });

  it('getDeliveryNetMarginOptimized filtra por companyId no SQL (revenue query)', () => {
    const fnMatch = dbContent.match(/export async function getDeliveryNetMarginOptimized[\s\S]*?^}/m);
    expect(fnMatch).toBeTruthy();
    expect(fnMatch![0]).toContain('AND companyId = ${companyId}');
  });

  it('getDeliveryNetMarginOptimized filtra por companyId no SQL (cost query)', () => {
    const fnMatch = dbContent.match(/export async function getDeliveryNetMarginOptimized[\s\S]*?^}/m);
    expect(fnMatch).toBeTruthy();
    expect(fnMatch![0]).toContain('AND s.companyId = ${companyId}');
  });

  it('getTotalPendingReceivables filtra por companyId via Drizzle', () => {
    const fnMatch = dbContent.match(/export async function getTotalPendingReceivables[\s\S]*?^}/m);
    expect(fnMatch).toBeTruthy();
    expect(fnMatch![0]).toContain('sales.companyId');
  });

  it('getPurchaseTotalCurrentMonth filtra por companyId via Drizzle', () => {
    const fnMatch = dbContent.match(/export async function getPurchaseTotalCurrentMonth[\s\S]*?^}/m);
    expect(fnMatch).toBeTruthy();
    expect(fnMatch![0]).toContain('purchaseOrders.companyId');
  });

  it('getGrossMarginByCategory filtra por companyId via Drizzle', () => {
    const fnMatch = dbContent.match(/export async function getGrossMarginByCategory[\s\S]*?^}/m);
    expect(fnMatch).toBeTruthy();
    expect(fnMatch![0]).toContain('sales.companyId');
  });
});

describe('Tela de seleção obrigatória de empresa', () => {
  it('SelectCompany.tsx existe', () => {
    expect(selectCompanyExists).toBe(true);
  });

  it('CompanyContext expõe needsSelection', () => {
    expect(contextContent).toContain('needsSelection');
  });

  it('CompanyContext NÃO auto-seleciona quando há múltiplas empresas', () => {
    // Deve ter companies.length === 1 (não > 0) para auto-seleção
    expect(contextContent).toContain('companies.length === 1');
  });

  it('App.tsx usa CompanyGate para controlar acesso', () => {
    expect(appContent).toContain('CompanyGate');
  });

  it('App.tsx importa SelectCompany', () => {
    expect(appContent).toContain('SelectCompany');
  });

  it('CompanyGate verifica needsSelection', () => {
    expect(appContent).toContain('needsSelection');
  });
});
