import { describe, it, expect } from 'vitest';

/**
 * Testes para a regra inteligente de Banco/Conta nos modais de pagamento.
 * 
 * Regra:
 * - Dinheiro → Auto-seleciona "Caixa Geral" (campo desabilitado)
 * - PIX/Transferência/Débito/Crédito → Mostra dropdown com contas bancárias (sem Caixa Geral)
 */

// Simular a lista de contas bancárias retornada pelo backend
const mockBankAccounts = [
  { id: 101, name: 'Caixa Geral', code: '1.1.1.01' },
  { id: 102, name: 'Itaú', code: '1.1.1.02' },
  { id: 103, name: 'Inter', code: '1.1.1.03' },
  { id: 104, name: 'C6', code: '1.1.1.04' },
];

// Simular a lógica de seleção de conta bancária (mesma lógica do frontend)
function getSmartBankAccount(
  paymentMethod: string,
  bankAccounts: typeof mockBankAccounts
): { bankAccountId: number | undefined; showDropdown: boolean; dropdownAccounts: typeof mockBankAccounts } {
  const caixaGeral = bankAccounts.find(a => a.name.toLowerCase().includes('caixa'));
  
  if (paymentMethod === 'DINHEIRO' && caixaGeral) {
    return {
      bankAccountId: caixaGeral.id,
      showDropdown: false,
      dropdownAccounts: [],
    };
  }
  
  // Para outros métodos, filtrar Caixa Geral do dropdown
  const filteredAccounts = bankAccounts.filter(a => !a.name.toLowerCase().includes('caixa'));
  return {
    bankAccountId: undefined,
    showDropdown: true,
    dropdownAccounts: filteredAccounts,
  };
}

describe('Regra Inteligente de Banco/Conta', () => {
  describe('Dinheiro → Caixa Geral automático', () => {
    it('deve auto-selecionar Caixa Geral quando forma de pagamento é Dinheiro', () => {
      const result = getSmartBankAccount('DINHEIRO', mockBankAccounts);
      expect(result.bankAccountId).toBe(101);
      expect(result.showDropdown).toBe(false);
    });

    it('não deve mostrar dropdown quando é Dinheiro', () => {
      const result = getSmartBankAccount('DINHEIRO', mockBankAccounts);
      expect(result.showDropdown).toBe(false);
      expect(result.dropdownAccounts).toHaveLength(0);
    });
  });

  describe('PIX/Transferência/Cartão → Escolher conta', () => {
    it('deve mostrar dropdown quando forma de pagamento é PIX', () => {
      const result = getSmartBankAccount('PIX', mockBankAccounts);
      expect(result.bankAccountId).toBeUndefined();
      expect(result.showDropdown).toBe(true);
    });

    it('deve mostrar dropdown quando forma de pagamento é Transferência', () => {
      const result = getSmartBankAccount('TRANSFERENCIA', mockBankAccounts);
      expect(result.bankAccountId).toBeUndefined();
      expect(result.showDropdown).toBe(true);
    });

    it('deve mostrar dropdown quando forma de pagamento é Cartão de Débito', () => {
      const result = getSmartBankAccount('CARTAO_DEBITO', mockBankAccounts);
      expect(result.showDropdown).toBe(true);
    });

    it('deve mostrar dropdown quando forma de pagamento é Cartão de Crédito', () => {
      const result = getSmartBankAccount('CARTAO_CREDITO', mockBankAccounts);
      expect(result.showDropdown).toBe(true);
    });

    it('dropdown não deve incluir Caixa Geral', () => {
      const result = getSmartBankAccount('PIX', mockBankAccounts);
      const names = result.dropdownAccounts.map(a => a.name);
      expect(names).not.toContain('Caixa Geral');
      expect(names).toContain('Itaú');
      expect(names).toContain('Inter');
      expect(names).toContain('C6');
    });

    it('dropdown deve ter 3 contas (sem Caixa Geral)', () => {
      const result = getSmartBankAccount('PIX', mockBankAccounts);
      expect(result.dropdownAccounts).toHaveLength(3);
    });
  });

  describe('Cenários de borda', () => {
    it('deve funcionar quando não há Caixa Geral na lista', () => {
      const accountsSemCaixa = [
        { id: 102, name: 'Itaú', code: '1.1.1.02' },
        { id: 103, name: 'Inter', code: '1.1.1.03' },
      ];
      const result = getSmartBankAccount('DINHEIRO', accountsSemCaixa);
      // Sem Caixa Geral, deve mostrar dropdown normalmente
      expect(result.bankAccountId).toBeUndefined();
      expect(result.showDropdown).toBe(true);
    });

    it('deve funcionar com lista vazia de contas', () => {
      const result = getSmartBankAccount('PIX', []);
      expect(result.showDropdown).toBe(true);
      expect(result.dropdownAccounts).toHaveLength(0);
    });
  });
});
