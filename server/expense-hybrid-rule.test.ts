import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Testes para a regra híbrida de despesas:
 * - Parceladas (>1 parcela): filtram/agrupam por dueDate (vencimento)
 * - Pagamento único (1 parcela): filtram/agrupam por competenceMonth (competência)
 */

const dbFilePath = path.resolve(__dirname, 'db.ts');
const dbContent = fs.readFileSync(dbFilePath, 'utf-8');

describe('Regra Híbrida de Despesas - Análise de Despesas', () => {
  it('getExpenseAnalysisByCategory usa regra híbrida com subquery pc.numParcelas', () => {
    // Verificar que a função contém a subquery de contagem de parcelas
    const fnMatch = dbContent.match(
      /export async function getExpenseAnalysisByCategory[\s\S]*?(?=export async function)/
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    
    // Deve ter a subquery de contagem de parcelas
    expect(fnBody).toContain('SELECT expenseId, COUNT(*) as numParcelas');
    expect(fnBody).toContain('pc.numParcelas > 1');
    expect(fnBody).toContain('pc.numParcelas = 1');
    // Parceladas usam dueDate
    expect(fnBody).toContain('ei.dueDate');
    // Únicas usam competenceMonth
    expect(fnBody).toContain('e.competenceMonth');
  });

  it('getExpenseAnalysisByMonth usa regra híbrida com CASE WHEN para year/month', () => {
    const fnMatch = dbContent.match(
      /export async function getExpenseAnalysisByMonth[\s\S]*?(?=export async function)/
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    
    // Deve usar CASE WHEN para determinar year/month baseado no tipo
    expect(fnBody).toContain('CASE WHEN pc.numParcelas > 1');
    expect(fnBody).toContain('YEAR(CONVERT_TZ(ei.dueDate');
    expect(fnBody).toContain('SUBSTRING(e.competenceMonth');
  });

  it('getExpenseAnalysisByCategoryAndMonth usa regra híbrida', () => {
    const fnMatch = dbContent.match(
      /export async function getExpenseAnalysisByCategoryAndMonth[\s\S]*?(?=export async function)/
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    
    expect(fnBody).toContain('pc.numParcelas > 1');
    expect(fnBody).toContain('pc.numParcelas = 1');
    expect(fnBody).toContain('CASE WHEN pc.numParcelas > 1');
  });

  it('getExpenseAnalysisDetail usa regra híbrida e retorna campos extras', () => {
    const fnMatch = dbContent.match(
      /export async function getExpenseAnalysisDetail[\s\S]*?(?=export async function)/
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    
    // Deve ter a subquery de contagem de parcelas
    expect(fnBody).toContain('SELECT expenseId, COUNT(*) as numParcelas');
    expect(fnBody).toContain('pc.numParcelas > 1');
    // Deve retornar campos extras para identificar parcelas
    expect(fnBody).toContain('installmentNumber');
    expect(fnBody).toContain('numParcelas');
    expect(fnBody).toContain('competenceMonth');
  });

  it('getExpenseAnalysisSummary usa regra híbrida', () => {
    const fnMatch = dbContent.match(
      /export async function getExpenseAnalysisSummary[\s\S]*?(?=export async function)/
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    
    expect(fnBody).toContain('SELECT expenseId, COUNT(*) as numParcelas');
    expect(fnBody).toContain('pc.numParcelas > 1');
    expect(fnBody).toContain('pc.numParcelas = 1');
    expect(fnBody).toContain('e.competenceMonth');
  });

  it('getExpenseHierarchicalData usa regra híbrida com CASE WHEN', () => {
    const fnMatch = dbContent.match(
      /export async function getExpenseHierarchicalData[\s\S]*?(?=\n\/\/ ==)/
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    
    expect(fnBody).toContain('SELECT expenseId, COUNT(*) as numParcelas');
    expect(fnBody).toContain('CASE WHEN pc.numParcelas > 1');
    expect(fnBody).toContain('e.competenceMonth');
    // Deve retornar numParcelas
    expect(fnBody).toContain('numParcelas: parseInt(row.numParcelas');
  });
});

describe('Regra Híbrida de Despesas - Fechamento Mensal', () => {
  it('Query de despesas por categoria no Fechamento usa regra híbrida', () => {
    // Buscar a seção 3 do getMonthlyClosing
    const closingMatch = dbContent.match(
      /\/\/ 3\. DESPESAS[\s\S]*?ORDER BY totalAmount DESC\n  \`\)\);/
    );
    expect(closingMatch).toBeTruthy();
    const section = closingMatch![0];
    
    expect(section).toContain('pc.numParcelas > 1');
    expect(section).toContain('pc.numParcelas = 1');
    expect(section).toContain('ei.dueDate');
    expect(section).toContain('e.competenceMonth');
    expect(section).toContain('SELECT expenseId, COUNT(*) as numParcelas');
  });

  it('Query de despesas por conta gerencial no Fechamento usa regra híbrida', () => {
    // Buscar a seção 7 do getMonthlyClosing
    const section7Match = dbContent.match(
      /\/\/ 7\. DESPESAS POR CONTA GERENCIAL[\s\S]*?ORDER BY total DESC\n  \`\)\);/
    );
    expect(section7Match).toBeTruthy();
    const section = section7Match![0];
    
    expect(section).toContain('pc.numParcelas > 1');
    expect(section).toContain('pc.numParcelas = 1');
    expect(section).toContain('ei.dueDate');
    expect(section).toContain('e.competenceMonth');
    expect(section).toContain('SELECT expenseId, COUNT(*) as numParcelas');
  });
});

describe('Regra Híbrida - Nenhuma query usa apenas dueDate ou apenas createdAt', () => {
  it('Nenhuma função de análise de despesas filtra por createdAt', () => {
    // Extrair bloco de análise de despesas
    const analysisBlock = dbContent.match(
      /\/\/ ==================== ANÁLISE DE DESPESAS ====================[\s\S]*?\/\/ ==================== METAS DE FATURAMENTO ====================/
    );
    expect(analysisBlock).toBeTruthy();
    const block = analysisBlock![0];
    
    // Não deve conter filtro por createdAt (exceto ORDER BY)
    const createdAtFilters = block.match(/AND.*createdAt.*>=/g);
    expect(createdAtFilters).toBeNull();
  });

  it('Todas as funções de análise usam a subquery de contagem de parcelas', () => {
    const functionNames = [
      'getExpenseAnalysisByCategory',
      'getExpenseAnalysisByMonth',
      'getExpenseAnalysisByCategoryAndMonth',
      'getExpenseAnalysisDetail',
      'getExpenseAnalysisSummary',
      'getExpenseHierarchicalData',
    ];
    
    for (const fnName of functionNames) {
      const fnRegex = new RegExp(
        `export async function ${fnName}[\\s\\S]*?(?=export async function|\\n\\/\\/ ==)`
      );
      const fnMatch = dbContent.match(fnRegex);
      expect(fnMatch, `${fnName} should exist`).toBeTruthy();
      expect(fnMatch![0], `${fnName} should use numParcelas subquery`).toContain('SELECT expenseId, COUNT(*) as numParcelas');
    }
  });
});
