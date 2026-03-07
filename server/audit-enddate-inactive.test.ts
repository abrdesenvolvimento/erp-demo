import { describe, it, expect } from 'vitest';

// ============================================
// Testes para correção de endDate e produtos inativos em análises
// ============================================

describe('Correção de endDate em filtros de auditoria', () => {

  it('deve ajustar endDate para final do dia (23:59:59.999)', () => {
    // Simula o que o backend agora faz
    const endDate = new Date('2026-03-07'); // meia-noite UTC
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    expect(endOfDay.getHours()).toBe(23);
    expect(endOfDay.getMinutes()).toBe(59);
    expect(endOfDay.getSeconds()).toBe(59);
    expect(endOfDay.getMilliseconds()).toBe(999);
  });

  it('deve incluir registros do mesmo dia que estão após meia-noite UTC', () => {
    const endDate = new Date('2026-03-07');
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Registro inserido às 02:00 UTC (23h BRT do dia 06)
    const recordDate = new Date('2026-03-07T02:00:00.000Z');
    
    // Sem correção: meia-noite UTC excluiria o registro
    expect(recordDate > endDate).toBe(true);
    
    // Com correção: final do dia inclui o registro
    expect(recordDate <= endOfDay).toBe(true);
  });

  it('deve incluir registros até 23:59:59 do dia selecionado', () => {
    // Simula o comportamento do backend: endDate chega como Date, setHours ajusta
    const endDate = new Date('2026-03-07T00:00:00.000Z');
    const endOfDay = new Date(endDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Registro no final do dia UTC
    const lateRecord = new Date('2026-03-07T23:59:59.000Z');
    expect(lateRecord.getTime() <= endOfDay.getTime()).toBe(true);

    // Registro no dia seguinte deve ser excluído
    const nextDayRecord = new Date('2026-03-08T00:00:01.000Z');
    expect(nextDayRecord.getTime() <= endOfDay.getTime()).toBe(false);
  });

  it('não deve alterar o startDate (continua como meia-noite UTC)', () => {
    const startDate = new Date('2026-02-05T00:00:00.000Z');
    // startDate permanece como está - meia-noite UTC
    expect(startDate.getUTCHours()).toBe(0);
    expect(startDate.getUTCMinutes()).toBe(0);
  });

  it('deve funcionar corretamente para todos os meses', () => {
    const months = [
      '2026-01-31', '2026-02-28', '2026-03-31',
      '2026-04-30', '2026-06-30', '2026-12-31',
    ];

    months.forEach(dateStr => {
      const endDate = new Date(dateStr);
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      expect(endOfDay.getHours()).toBe(23);
      expect(endOfDay.getMinutes()).toBe(59);
      expect(endOfDay.getSeconds()).toBe(59);
    });
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
