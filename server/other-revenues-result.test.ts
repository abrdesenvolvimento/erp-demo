import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Testes para verificar que Outras Receitas compõem o Resultado Líquido
 * e que o card aparece antes do Resultado Líquido no Fechamento.
 */

const dbFilePath = path.resolve(__dirname, 'db.ts');
const dbContent = fs.readFileSync(dbFilePath, 'utf-8');

const fechamentoPath = path.resolve(__dirname, '../client/src/pages/FechamentoMensalNovo.tsx');
const fechamentoContent = fs.readFileSync(fechamentoPath, 'utf-8');

describe('Outras Receitas no Resultado Líquido - Backend', () => {
  it('netResult inclui totalOtherRevenues na fórmula', () => {
    // Buscar a linha onde netResult é calculado
    const netResultCalc = dbContent.match(/netResult\s*=\s*totalSales\.revenue\s*-\s*totalSales\.cost\s*-\s*totalExpenses\.amount\s*\+\s*totalOtherRevenues/);
    expect(netResultCalc, 'netResult deve incluir + totalOtherRevenues').toBeTruthy();
  });

  it('netResult é calculado após buscar Outras Receitas (não antes)', () => {
    // O cálculo do netResult deve vir DEPOIS da query de otherRevenues
    const otherRevenuesQueryPos = dbContent.indexOf('8b. OUTRAS RECEITAS');
    const totalOtherRevenuesPos = dbContent.indexOf('const totalOtherRevenues = otherRevenuesList.reduce');
    const netResultCalcPos = dbContent.indexOf('netResult = totalSales.revenue - totalSales.cost - totalExpenses.amount + totalOtherRevenues');
    
    expect(otherRevenuesQueryPos).toBeGreaterThan(0);
    expect(totalOtherRevenuesPos).toBeGreaterThan(otherRevenuesQueryPos);
    expect(netResultCalcPos).toBeGreaterThan(totalOtherRevenuesPos);
  });

  it('netResult é declarado com let (não const) para permitir reatribuição', () => {
    const letNetResult = dbContent.match(/let netResult\s*=\s*0/);
    expect(letNetResult, 'netResult deve ser declarado com let').toBeTruthy();
  });

  it('otherRevenues é retornado no objeto de resposta do getMonthlyClosing', () => {
    const closingReturn = dbContent.match(/return \{[\s\S]*?otherRevenues:\s*\{[\s\S]*?total:\s*totalOtherRevenues/);
    expect(closingReturn, 'otherRevenues deve estar no retorno').toBeTruthy();
  });
});

describe('Outras Receitas no Resultado Líquido - Frontend', () => {
  it('Card de Outras Receitas aparece ANTES do card de Resultado Líquido nos cards de resumo', () => {
    // Buscar posição do card de Outras Receitas e do Resultado Líquido na seção de cards
    const cardsSection = fechamentoContent.match(/CARDS DE RESUMO[\s\S]*?<\/div>\s*\n\s*\n/);
    expect(cardsSection, 'Seção de cards de resumo deve existir').toBeTruthy();
    
    const outrasReceitasPos = cardsSection![0].indexOf('Outras Receitas');
    const resultadoLiquidoPos = cardsSection![0].indexOf('Resultado Líquido');
    
    expect(outrasReceitasPos, 'Card Outras Receitas deve existir nos cards').toBeGreaterThan(0);
    expect(resultadoLiquidoPos, 'Card Resultado Líquido deve existir nos cards').toBeGreaterThan(0);
    expect(outrasReceitasPos, 'Outras Receitas deve vir ANTES do Resultado Líquido').toBeLessThan(resultadoLiquidoPos);
  });

  it('Grid de cards usa 5 colunas para acomodar Outras Receitas', () => {
    const gridCols5 = fechamentoContent.includes('lg:grid-cols-5');
    expect(gridCols5, 'Grid deve ter 5 colunas').toBe(true);
  });

  it('Card de Outras Receitas usa ícone PlusCircle e cor emerald', () => {
    // Verificar na seção de cards de resumo
    const cardsSection = fechamentoContent.match(/CARDS DE RESUMO[\s\S]*?<\/div>\s*\n\s*\n/);
    expect(cardsSection).toBeTruthy();
    
    expect(cardsSection![0]).toContain('PlusCircle');
    expect(cardsSection![0]).toContain('emerald');
  });

  it('Seção detalhada de Outras Receitas (seção 7) foi removida do Fechamento', () => {
    const detalhamento = fechamentoContent.includes('Outras Receitas — Detalhamento');
    expect(detalhamento, 'Seção de detalhamento não deve existir').toBe(false);
  });
});
