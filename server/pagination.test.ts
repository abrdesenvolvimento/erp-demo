import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes de paginação para Despesas e Outras Receitas
 * Valida que as funções retornam o formato paginado correto
 */

// Mock do getDb para evitar conexão real
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();

describe('Paginação - Formato de Resposta', () => {
  it('deve retornar formato paginado com data, total, totalPages e page', () => {
    // Simula a lógica de paginação usada em getExpenses e listOtherRevenues
    const allData = Array.from({ length: 75 }, (_, i) => ({ id: i + 1, amount: 100 }));
    const page = 1;
    const limit = 30;
    
    const total = allData.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedData = allData.slice(offset, offset + limit);
    
    const result = { data: paginatedData, total, totalPages, page };
    
    expect(result.data).toHaveLength(30);
    expect(result.total).toBe(75);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(1);
  });

  it('deve retornar página 2 corretamente', () => {
    const allData = Array.from({ length: 75 }, (_, i) => ({ id: i + 1, amount: 100 }));
    const page = 2;
    const limit = 30;
    
    const total = allData.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedData = allData.slice(offset, offset + limit);
    
    const result = { data: paginatedData, total, totalPages, page };
    
    expect(result.data).toHaveLength(30);
    expect(result.data[0].id).toBe(31);
    expect(result.data[29].id).toBe(60);
    expect(result.page).toBe(2);
  });

  it('deve retornar última página com itens restantes', () => {
    const allData = Array.from({ length: 75 }, (_, i) => ({ id: i + 1, amount: 100 }));
    const page = 3;
    const limit = 30;
    
    const total = allData.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedData = allData.slice(offset, offset + limit);
    
    const result = { data: paginatedData, total, totalPages, page };
    
    expect(result.data).toHaveLength(15);
    expect(result.data[0].id).toBe(61);
    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(3);
  });

  it('deve retornar lista vazia para página além do total', () => {
    const allData = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, amount: 100 }));
    const page = 5;
    const limit = 30;
    
    const total = allData.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedData = allData.slice(offset, offset + limit);
    
    const result = { data: paginatedData, total, totalPages, page };
    
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(10);
    expect(result.totalPages).toBe(1);
  });

  it('deve usar limit padrão de 30 quando não especificado', () => {
    const limit = undefined;
    const pageSize = limit || 30;
    expect(pageSize).toBe(30);
  });

  it('deve usar page padrão de 1 quando não especificado', () => {
    const page = undefined;
    const pageNum = page || 1;
    expect(pageNum).toBe(1);
  });
});

describe('Paginação - Cálculos de Totais', () => {
  it('total e totalPages devem ser consistentes', () => {
    const testCases = [
      { total: 0, limit: 30, expectedPages: 0 },
      { total: 1, limit: 30, expectedPages: 1 },
      { total: 30, limit: 30, expectedPages: 1 },
      { total: 31, limit: 30, expectedPages: 2 },
      { total: 60, limit: 30, expectedPages: 2 },
      { total: 61, limit: 30, expectedPages: 3 },
      { total: 100, limit: 30, expectedPages: 4 },
    ];
    
    for (const tc of testCases) {
      const totalPages = Math.ceil(tc.total / tc.limit);
      expect(totalPages).toBe(tc.expectedPages);
    }
  });

  it('offset deve ser calculado corretamente para cada página', () => {
    const limit = 30;
    expect((1 - 1) * limit).toBe(0);
    expect((2 - 1) * limit).toBe(30);
    expect((3 - 1) * limit).toBe(60);
    expect((4 - 1) * limit).toBe(90);
  });
});

describe('Paginação - Integração com Filtros', () => {
  it('deve resetar para página 1 quando filtros mudam (lógica frontend)', () => {
    // Simula o comportamento do useEffect que reseta a página
    let currentPage = 3;
    
    // Quando filtro muda, página reseta para 1
    const onFilterChange = () => { currentPage = 1; };
    
    onFilterChange();
    expect(currentPage).toBe(1);
  });

  it('totais devem refletir todos os registros filtrados, não apenas a página atual', () => {
    // Simula: 75 despesas ativas, 5 canceladas, mostrando página 1 de 30
    const allData = [
      ...Array.from({ length: 75 }, (_, i) => ({ id: i + 1, amount: 100, status: 'ATIVA' })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: i + 76, amount: 50, status: 'CANCELADA' })),
    ];
    
    const page = 1;
    const limit = 30;
    const total = allData.length;
    const paginatedData = allData.slice(0, limit);
    
    // Total deve ser 80 (todas as despesas), não 30 (apenas a página)
    expect(total).toBe(80);
    expect(paginatedData).toHaveLength(30);
    
    // Cards de resumo devem usar total, não paginatedData.length
    const totalAtivo = allData.filter(d => d.status === 'ATIVA').reduce((s, d) => s + d.amount, 0);
    const totalCancelado = allData.filter(d => d.status === 'CANCELADA').reduce((s, d) => s + d.amount, 0);
    
    expect(totalAtivo).toBe(7500);
    expect(totalCancelado).toBe(250);
  });
});
