import { describe, it, expect, vi } from 'vitest';

/**
 * Teste para verificar a correção do bug na query getStockMonthlyEvolution:
 * - A coluna s.totalAmount não existe na tabela sales
 * - A coluna correta é s.finalAmount
 * - O bug causava a função inteira falhar silenciosamente, retornando array vazio
 */

describe('Monthly Evolution - Bug Fix: finalAmount vs totalAmount', () => {
  it('should use finalAmount (not totalAmount) in revenue query', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('./server/stockAnalysisQueries.ts', 'utf-8');
    
    // Verificar que NÃO usa totalAmount na query de sales
    const hasTotalAmountInSalesQuery = content.includes('SUM(s.totalAmount)');
    expect(hasTotalAmountInSalesQuery).toBe(false);
    
    // Verificar que usa finalAmount na query de sales
    const hasFinalAmountInSalesQuery = content.includes('SUM(s.finalAmount)');
    expect(hasFinalAmountInSalesQuery).toBe(true);
  });

  it('should export getStockMonthlyEvolution with correct signature', async () => {
    // Mock do banco para evitar conexão real
    vi.mock('./db', () => ({
      getDb: vi.fn().mockResolvedValue(null)
    }));
    
    const mod = await import('./stockAnalysisQueries');
    expect(typeof mod.getStockMonthlyEvolution).toBe('function');
  });

  it('should have revenue field in StockMonthlyEvolution interface', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('./server/stockAnalysisQueries.ts', 'utf-8');
    
    // Verificar que a interface tem o campo revenue
    expect(content).toContain('revenue:');
    // Verificar que o resultado inclui revenue
    expect(content).toContain('revenue: Math.round(revenue');
  });
});
