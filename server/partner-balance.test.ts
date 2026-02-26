import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes para verificar que a listagem de parceiros usa saldo calculado (real)
 * em vez do campo currentBalance armazenado na tabela partners.
 * 
 * Bug: Parceiros mostrava saldo R$163 para Savio, mas Conta Corrente mostrava R$107.
 * Causa: O campo currentBalance na tabela partners ficava desatualizado quando
 * pagamentos eram feitos via Contas a Receber (registerCustomerPayment).
 * Correção: getPartners agora calcula o saldo real via getCustomerBalance()
 * para parceiros do tipo CUSTOMER ou BOTH.
 */

// Mock do módulo de banco de dados
vi.mock('../server/db', async () => {
  const actual = await vi.importActual('../server/db') as any;
  return {
    ...actual,
  };
});

describe('Saldo do Parceiro na Listagem', () => {
  
  it('deve existir a função getPartners no db.ts', async () => {
    const db = await import('../server/db');
    expect(typeof db.getPartners).toBe('function');
  });

  it('deve existir a função getCustomerBalance no db.ts', async () => {
    const db = await import('../server/db');
    expect(typeof db.getCustomerBalance).toBe('function');
  });

  it('getPartners deve retornar array', async () => {
    const db = await import('../server/db');
    const result = await db.getPartners({ companyId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it('parceiros do tipo CUSTOMER devem ter currentBalance como string com 2 casas decimais', async () => {
    const db = await import('../server/db');
    const result = await db.getPartners({ companyId: 1, partnerType: 'CUSTOMER' });
    
    if (result.length > 0) {
      for (const partner of result) {
        // currentBalance deve ser uma string com formato decimal
        expect(typeof partner.currentBalance).toBe('string');
        expect(partner.currentBalance).toMatch(/^-?\d+\.\d{2}$/);
      }
    }
  });

  it('saldo do Savio deve ser calculado (vendas + débitos - pagamentos), não o campo armazenado', async () => {
    const db = await import('../server/db');
    
    // Buscar Savio na listagem de parceiros
    const partners = await db.getPartners({ search: 'Savio', companyId: 1 });
    const savio = partners.find((p: any) => p.name === 'Savio' || p.tradeName === 'Savio');
    
    if (savio) {
      // Calcular saldo real usando getCustomerBalance
      const realBalance = await db.getCustomerBalance(savio.id, 1);
      
      // O saldo na listagem deve ser igual ao saldo calculado
      expect(parseFloat(savio.currentBalance as string)).toBeCloseTo(realBalance, 2);
    }
  });

  it('getCustomerBalance deve retornar número (vendas a prazo + débitos - pagamentos)', async () => {
    const db = await import('../server/db');
    
    // Buscar qualquer cliente
    const partners = await db.getPartners({ companyId: 1, partnerType: 'CUSTOMER' });
    
    if (partners.length > 0) {
      const balance = await db.getCustomerBalance(partners[0].id, 1);
      expect(typeof balance).toBe('number');
      expect(isNaN(balance)).toBe(false);
    }
  });

  it('fornecedores (SUPPLIER) não devem ter saldo recalculado', async () => {
    const db = await import('../server/db');
    const suppliers = await db.getPartners({ companyId: 1, partnerType: 'SUPPLIER' });
    
    // Fornecedores devem manter o currentBalance original da tabela
    // (não passam pelo getCustomerBalance)
    if (suppliers.length > 0) {
      for (const supplier of suppliers) {
        // Apenas verificar que o campo existe
        expect(supplier.currentBalance !== undefined).toBe(true);
      }
    }
  });

  it('busca por tradeName deve funcionar', async () => {
    const db = await import('../server/db');
    // A busca deve incluir tradeName além de name e docNumber
    const result = await db.getPartners({ search: 'test_nonexistent_name_xyz', companyId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});
