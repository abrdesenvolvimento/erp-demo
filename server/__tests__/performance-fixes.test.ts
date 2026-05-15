import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const DB_TS = fs.readFileSync(path.resolve(__dirname, '../db.ts'), 'utf-8');
const ROUTERS_TS = fs.readFileSync(path.resolve(__dirname, '../routers.ts'), 'utf-8');
const MAIN_TSX = fs.readFileSync(path.resolve(__dirname, '../../client/src/main.tsx'), 'utf-8');
const DATE_UTILS = fs.readFileSync(path.resolve(__dirname, '../../shared/dateUtils.ts'), 'utf-8');

describe('Idempotency Guard: confirmPurchaseOrder', () => {
  it('should check if PO is already CONFIRMED before processing', () => {
    // The function must check status === "CONFIRMED" and return early
    expect(DB_TS).toContain('purchaseOrderData.purchaseOrder.status === "CONFIRMED"');
    expect(DB_TS).toContain('Ignorando');
  });

  it('should use optimistic lock (UPDATE WHERE status=DRAFT) to prevent concurrent confirmations', () => {
    // v47.2 fix: Use atomic UPDATE WHERE status='DRAFT' as optimistic lock
    const confirmFnStart = DB_TS.indexOf('export async function confirmPurchaseOrder');
    const lockPos = DB_TS.indexOf('LOCK OTIMISTA', confirmFnStart);
    const atomicUpdatePos = DB_TS.indexOf("WHERE status = 'DRAFT'", confirmFnStart) || DB_TS.indexOf("status = 'DRAFT'", confirmFnStart);
    const affectedRowsPos = DB_TS.indexOf('affectedRows', confirmFnStart);
    
    expect(lockPos).toBeGreaterThan(-1);
    expect(atomicUpdatePos).toBeGreaterThan(-1);
    expect(affectedRowsPos).toBeGreaterThan(-1);
  });

  it('should reject confirmation of purchase orders with no items', () => {
    expect(DB_TS).toContain('Compra sem itens não pode ser confirmada');
  });

  it('should reject confirmation of CANCELLED purchase orders', () => {
    expect(DB_TS).toContain('Compra cancelada não pode ser confirmada');
  });
});

describe('Mutation Retry Prevention', () => {
  it('should have retry: false for mutations in QueryClient', () => {
    expect(MAIN_TSX).toContain('mutations:');
    expect(MAIN_TSX).toContain('retry: false');
  });

  it('should have limited retry for queries', () => {
    expect(MAIN_TSX).toContain('retry: 1');
  });

  it('should have staleTime configured', () => {
    expect(MAIN_TSX).toContain('staleTime: 30_000');
  });

  it('should disable refetchOnWindowFocus', () => {
    expect(MAIN_TSX).toContain('refetchOnWindowFocus: false');
  });
});

describe('Timezone: Server returns Brasília time via CONVERT_TZ', () => {
  it('getSales should use CONVERT_TZ in SELECT for saleDate', () => {
    // Find the getSales function and check it uses CONVERT_TZ
    const getSalesIdx = DB_TS.indexOf('export async function getSales(');
    expect(getSalesIdx).toBeGreaterThan(-1);
    
    // The function should have CONVERT_TZ for saleDate in the SELECT
    const nextFunctionIdx = DB_TS.indexOf('export async function', getSalesIdx + 1);
    const getSalesBody = DB_TS.substring(getSalesIdx, nextFunctionIdx);
    expect(getSalesBody).toContain('CONVERT_TZ');
    expect(getSalesBody).toContain("-03:00");
  });

  it('getSale should use CONVERT_TZ in SELECT for saleDate', () => {
    const getSaleIdx = DB_TS.indexOf('export async function getSale(');
    expect(getSaleIdx).toBeGreaterThan(-1);
    
    const nextFunctionIdx = DB_TS.indexOf('export async function', getSaleIdx + 1);
    const getSaleBody = DB_TS.substring(getSaleIdx, nextFunctionIdx);
    expect(getSaleBody).toContain('CONVERT_TZ');
    expect(getSaleBody).toContain("-03:00");
  });
});

describe('Timezone: Frontend parses dates without new Date()', () => {
  it('formatDateTimeBR should use regex parsing, not new Date()', () => {
    // The function should parse date strings manually
    expect(DATE_UTILS).toContain('formatDateTimeBR');
    
    // Find the formatDateTimeBR function
    const fnIdx = DATE_UTILS.indexOf('export function formatDateTimeBR');
    expect(fnIdx).toBeGreaterThan(-1);
    
    const fnEnd = DATE_UTILS.indexOf('export function', fnIdx + 1);
    const fnBody = fnEnd > -1 ? DATE_UTILS.substring(fnIdx, fnEnd) : DATE_UTILS.substring(fnIdx);
    
    // Should use match/regex or split for parsing
    const usesManualParsing = fnBody.includes('match') || fnBody.includes('split') || fnBody.includes('substring');
    expect(usesManualParsing).toBe(true);
  });

  it('formatDateBR should use regex parsing, not new Date()', () => {
    expect(DATE_UTILS).toContain('formatDateBR');
    
    const fnIdx = DATE_UTILS.indexOf('export function formatDateBR');
    expect(fnIdx).toBeGreaterThan(-1);
    
    const fnEnd = DATE_UTILS.indexOf('export function', fnIdx + 1);
    const fnBody = fnEnd > -1 ? DATE_UTILS.substring(fnIdx, fnEnd) : DATE_UTILS.substring(fnIdx);
    
    const usesManualParsing = fnBody.includes('match') || fnBody.includes('split') || fnBody.includes('substring');
    expect(usesManualParsing).toBe(true);
  });
});

describe('deletePurchaseCompletely: Cleanup orphaned data', () => {
  it('should delete productMovements when deleting a purchase', () => {
    const fnIdx = DB_TS.indexOf('export async function deletePurchaseCompletely');
    expect(fnIdx).toBeGreaterThan(-1);
    
    const fnBody = DB_TS.substring(fnIdx, fnIdx + 3000);
    expect(fnBody).toContain('productMovements');
    expect(fnBody).toContain('DELETE FROM productMovements');
  });

  it('should delete priceHistory when deleting a purchase', () => {
    const fnIdx = DB_TS.indexOf('export async function deletePurchaseCompletely');
    expect(fnIdx).toBeGreaterThan(-1);
    
    // Use a larger window since the function is long
    const fnBody = DB_TS.substring(fnIdx, fnIdx + 5000);
    expect(fnBody).toContain('priceHistory');
    expect(fnBody).toContain('DELETE FROM priceHistory');
  });
});

describe('Keep-alive heartbeat endpoint', () => {
  it('should have keep-alive endpoint registered in server', () => {
    const indexTs = fs.readFileSync(path.resolve(__dirname, '../_core/index.ts'), 'utf-8');
    expect(indexTs).toContain('/api/scheduled/keep-alive');
  });

  it('should have keepAlive router in appRouter', () => {
    expect(ROUTERS_TS).toContain('keepAlive: router');
    expect(ROUTERS_TS).toContain('keep-alive');
  });

  it('should have setup mutation for creating heartbeat job', () => {
    expect(ROUTERS_TS).toContain('createHeartbeatJob');
    expect(ROUTERS_TS).toContain("cron: '0 */5 * * * *'");
  });
});

describe('Dashboard queries parallelization', () => {
  it('dashboard.stats should use Promise.all for parallel queries', () => {
    const dashboardIdx = ROUTERS_TS.indexOf('dashboard:');
    expect(dashboardIdx).toBeGreaterThan(-1);
    
    const statsIdx = ROUTERS_TS.indexOf('stats:', dashboardIdx);
    expect(statsIdx).toBeGreaterThan(-1);
    
    // Find the next router/procedure after stats
    const nextIdx = ROUTERS_TS.indexOf(':', statsIdx + 10);
    const statsBody = ROUTERS_TS.substring(statsIdx, statsIdx + 3000);
    
    expect(statsBody).toContain('Promise.all');
  });
});
