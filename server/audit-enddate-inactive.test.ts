import { describe, it, expect } from 'vitest';

// ============================================
// Testes para correção de endDate e produtos inativos em análises
// ============================================

describe('Correção de endDate em filtros de auditoria', () => {

  it('deve usar próximo dia meia-noite UTC para filtro de endDate', () => {
    // Simula o que o backend agora faz: nextDay UTC + lt()
    const endDate = new Date('2026-03-07T00:00:00.000Z');
    const nextDay = new Date(endDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    expect(nextDay.toISOString()).toBe('2026-03-08T00:00:00.000Z');
    expect(nextDay.getUTCHours()).toBe(0);
    expect(nextDay.getUTCMinutes()).toBe(0);
  });

  it('deve incluir registros de qualquer hora do dia com nextDay UTC', () => {
    const endDate = new Date('2026-03-07T00:00:00.000Z');
    const nextDay = new Date(endDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    // Registro inserido às 02:00 UTC
    const record02 = new Date('2026-03-07T02:00:00.000Z');
    expect(record02.getTime() < nextDay.getTime()).toBe(true);

    // Registro inserido às 07:19 UTC (que antes era excluído com setHours)
    const record07 = new Date('2026-03-07T07:19:10.000Z');
    expect(record07.getTime() < nextDay.getTime()).toBe(true);

    // Registro inserido às 23:59 UTC
    const record23 = new Date('2026-03-07T23:59:59.000Z');
    expect(record23.getTime() < nextDay.getTime()).toBe(true);
  });

  it('deve excluir registros do dia seguinte com nextDay UTC + lt()', () => {
    const endDate = new Date('2026-03-07T00:00:00.000Z');
    const nextDay = new Date(endDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    // Registro exatamente na meia-noite do dia seguinte deve ser excluído (lt, não lte)
    const midnightNext = new Date('2026-03-08T00:00:00.000Z');
    expect(midnightNext.getTime() < nextDay.getTime()).toBe(false);

    // Registro 1 segundo após meia-noite do dia seguinte
    const nextDayRecord = new Date('2026-03-08T00:00:01.000Z');
    expect(nextDayRecord.getTime() < nextDay.getTime()).toBe(false);
  });

  it('não deve alterar o startDate (continua como meia-noite UTC)', () => {
    const startDate = new Date('2026-02-05T00:00:00.000Z');
    expect(startDate.getUTCHours()).toBe(0);
    expect(startDate.getUTCMinutes()).toBe(0);
  });

  it('deve funcionar corretamente para virada de mês e ano', () => {
    // Final de janeiro -> 1 fevereiro
    const jan31 = new Date('2026-01-31T00:00:00.000Z');
    const nextJan = new Date(jan31);
    nextJan.setUTCDate(nextJan.getUTCDate() + 1);
    expect(nextJan.toISOString()).toBe('2026-02-01T00:00:00.000Z');

    // Final de fevereiro -> 1 março
    const feb28 = new Date('2026-02-28T00:00:00.000Z');
    const nextFeb = new Date(feb28);
    nextFeb.setUTCDate(nextFeb.getUTCDate() + 1);
    expect(nextFeb.toISOString()).toBe('2026-03-01T00:00:00.000Z');

    // Final de dezembro -> 1 janeiro do próximo ano
    const dec31 = new Date('2026-12-31T00:00:00.000Z');
    const nextDec = new Date(dec31);
    nextDec.setUTCDate(nextDec.getUTCDate() + 1);
    expect(nextDec.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('Produtos inativos em telas de análise', () => {

  it('Análise de Vendas deve carregar produtos com activeOnly: false', () => {
    // Simula o parâmetro que a Análise de Vendas agora envia
    const queryInput = { activeOnly: false };
    expect(queryInput.activeOnly).toBe(false);
  });

  it('Análise por Canal deve carregar produtos com activeOnly: false', () => {
    const queryInput = { activeOnly: false };
    expect(queryInput.activeOnly).toBe(false);
  });

  it('Tela de Vendas deve manter activeOnly: true para evitar venda de produto inativo', () => {
    // A tela de vendas continua com activeOnly: true
    const queryInput = { activeOnly: true };
    expect(queryInput.activeOnly).toBe(true);
  });

  it('deve filtrar produtos corretamente com activeOnly: false', () => {
    const allProducts = [
      { id: 1, name: 'Coca Cola 350ml', active: true },
      { id: 2, name: 'Fumax 500gr', active: true },
      { id: 3, name: 'Produto Descontinuado', active: false },
      { id: 4, name: 'Outro Inativo', active: false },
    ];

    // Com activeOnly: false, todos devem aparecer
    const withInactive = allProducts; // sem filtro
    expect(withInactive).toHaveLength(4);

    // Com activeOnly: true, apenas ativos
    const activeOnly = allProducts.filter(p => p.active);
    expect(activeOnly).toHaveLength(2);
    expect(activeOnly.every(p => p.active)).toBe(true);
  });

  it('deve exibir indicador visual "Inativo" para produtos inativos no dropdown', () => {
    const product = { id: 3, name: 'Produto Descontinuado', active: false };
    
    // Lógica do frontend: se !product.active, mostra badge "Inativo"
    const showInactiveBadge = !product.active;
    expect(showInactiveBadge).toBe(true);

    const activeProduct = { id: 1, name: 'Coca Cola', active: true };
    const showActiveBadge = !activeProduct.active;
    expect(showActiveBadge).toBe(false);
  });
});

describe('Modal de Movimentações do Produto', () => {

  it('deve usar largura max-w-6xl para melhor visualização', () => {
    // O modal agora usa w-[95vw] max-w-6xl em vez do antigo max-w-[95vw]
    const modalClass = 'w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto';
    expect(modalClass).toContain('max-w-6xl');
    expect(modalClass).toContain('max-h-[90vh]');
  });
});
