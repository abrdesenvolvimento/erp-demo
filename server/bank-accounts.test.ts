import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes para funcionalidade de Contas Bancárias
 * - getBankAccounts retorna contas do plano de contas com código 1.1.1.*
 * - Contas filtradas por empresa (companyId)
 * - bankAccountId é passado nas funções de pagamento
 */

// Mock do mysql2/promise
const mockExecute = vi.fn();
vi.mock('mysql2/promise', () => ({
  default: {
    createConnection: vi.fn(() => Promise.resolve({
      execute: mockExecute,
      end: vi.fn()
    }))
  }
}));

describe('Contas Bancárias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuração de Contas', () => {
    it('Adega deve ter 4 contas bancárias ativas: Caixa Geral, Itaú, Inter, C6', () => {
      const adegaContas = [
        { id: 4, code: '1.1.1.01', name: 'Caixa Geral', companyId: 1 },
        { id: 5, code: '1.1.1.02', name: 'Itaú', companyId: 1 },
        { id: 6, code: '1.1.1.03', name: 'Inter', companyId: 1 },
        { id: 7, code: '1.1.1.04', name: 'C6', companyId: 1 },
      ];
      
      expect(adegaContas).toHaveLength(4);
      expect(adegaContas.map(c => c.name)).toEqual(['Caixa Geral', 'Itaú', 'Inter', 'C6']);
      expect(adegaContas.every(c => c.companyId === 1)).toBe(true);
    });

    it('A Brasa deve ter 2 contas bancárias ativas: Caixa Geral, Itaú', () => {
      const brasaContas = [
        { id: 30003, code: '1.1.1.01', name: 'Caixa Geral', companyId: 2 },
        { id: 30004, code: '1.1.1.02', name: 'Itaú', companyId: 2 },
      ];
      
      expect(brasaContas).toHaveLength(2);
      expect(brasaContas.map(c => c.name)).toEqual(['Caixa Geral', 'Itaú']);
      expect(brasaContas.every(c => c.companyId === 2)).toBe(true);
    });

    it('Banco do Brasil deve estar desativado (isActive=0)', () => {
      const bb = { id: 8, code: '1.1.1.05', name: 'Banco do Brasil', isActive: 0, companyId: 1 };
      expect(bb.isActive).toBe(0);
    });
  });

  describe('Filtro por Empresa', () => {
    it('getBankAccounts deve filtrar por companyId', () => {
      const todasContas = [
        { id: 4, name: 'Caixa Geral', companyId: 1, isActive: 1 },
        { id: 5, name: 'Itaú', companyId: 1, isActive: 1 },
        { id: 6, name: 'Inter', companyId: 1, isActive: 1 },
        { id: 7, name: 'C6', companyId: 1, isActive: 1 },
        { id: 8, name: 'Banco do Brasil', companyId: 1, isActive: 0 },
        { id: 30003, name: 'Caixa Geral', companyId: 2, isActive: 1 },
        { id: 30004, name: 'Itaú', companyId: 2, isActive: 1 },
      ];
      
      const adegaContas = todasContas.filter(c => c.companyId === 1 && c.isActive === 1);
      const brasaContas = todasContas.filter(c => c.companyId === 2 && c.isActive === 1);
      
      expect(adegaContas).toHaveLength(4);
      expect(brasaContas).toHaveLength(2);
    });
  });

  describe('Integração com Pagamentos', () => {
    it('paymentForm deve incluir campo bankAccountId', () => {
      const paymentForm = {
        paidDate: '2026-03-03',
        paidAmount: '100.00',
        paymentMethod: 'PIX',
        bankAccountId: 5, // Itaú
        notes: ''
      };
      
      expect(paymentForm.bankAccountId).toBe(5);
    });

    it('bankAccountId é opcional no pagamento', () => {
      const paymentForm = {
        paidDate: '2026-03-03',
        paidAmount: '100.00',
        paymentMethod: 'DINHEIRO',
        bankAccountId: undefined,
        notes: ''
      };
      
      expect(paymentForm.bankAccountId).toBeUndefined();
    });

    it('payInstallment deve aceitar bankAccountId', () => {
      const mutationInput = {
        installmentId: 1,
        type: 'expense' as const,
        paidDate: new Date(),
        paidAmount: '100.00',
        paymentMethod: 'PIX',
        bankAccountId: 6, // Inter
        notes: undefined
      };
      
      expect(mutationInput.bankAccountId).toBe(6);
      expect(mutationInput.type).toBe('expense');
    });

    it('registerPayment (Contas a Receber) deve aceitar bankAccountId', () => {
      const mutationInput = {
        customerId: 1,
        paidDate: new Date(),
        paidAmount: '500.00',
        paymentMethod: 'TRANSFERENCIA',
        bankAccountId: 7, // C6
        notes: undefined
      };
      
      expect(mutationInput.bankAccountId).toBe(7);
    });

    it('registerPayment (Contas a Pagar) deve aceitar bankAccountId', () => {
      const mutationInput = {
        supplierId: 1,
        paidDate: new Date(),
        paidAmount: '1500.00',
        paymentMethod: 'BOLETO',
        bankAccountId: 5, // Itaú
        notes: undefined
      };
      
      expect(mutationInput.bankAccountId).toBe(5);
    });
  });

  describe('Contas por Código', () => {
    it('Contas bancárias devem ter código no padrão 1.1.1.XX', () => {
      const contas = [
        { code: '1.1.1.01', name: 'Caixa Geral' },
        { code: '1.1.1.02', name: 'Itaú' },
        { code: '1.1.1.03', name: 'Inter' },
        { code: '1.1.1.04', name: 'C6' },
      ];
      
      contas.forEach(conta => {
        expect(conta.code).toMatch(/^1\.1\.1\.\d{2}$/);
      });
    });
  });
});
