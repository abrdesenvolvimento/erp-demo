import { describe, it, expect } from 'vitest';
import * as accounting from '../accounting';
import { accountOtherRevenue, getAccountingCodeByManagementAccount } from '../db';

describe('Contabilização de Outras Receitas', () => {
  describe('Amarração Contábil', () => {
    it('deve buscar código contábil da conta gerencial de receita', async () => {
      // Conta gerencial ROR003 - Outras Receitas (id: 30006)
      const accountingCode = await getAccountingCodeByManagementAccount(30006);
      expect(accountingCode).toBeDefined();
      expect(accountingCode).toBe('4.2.1.03'); // Outras Receitas
    });

    it('deve retornar null para conta sem amarração', async () => {
      const accountingCode = await getAccountingCodeByManagementAccount(999999);
      expect(accountingCode).toBeNull();
    });
  });

  describe('Função accountOtherRevenue', () => {
    it('deve criar journal para outra receita', async () => {
      const result = await accountOtherRevenue({
        otherRevenueId: 999999, // ID fictício para teste
        amount: '100.00',
        managementAccountId: 30006, // ROR003 - Outras Receitas
        description: 'Teste de contabilização de outra receita',
        entryDate: new Date(),
        isPaid: true,
        createdBy: 'test-user',
      });

      expect(result.success).toBe(true);
      expect(result.journalId).toBeDefined();
      expect(result.journalId).toBeGreaterThan(0);
    });

    it('deve falhar para conta gerencial sem amarração', async () => {
      const result = await accountOtherRevenue({
        otherRevenueId: 999998,
        amount: '50.00',
        managementAccountId: 999999, // Conta inexistente
        description: 'Teste com conta inválida',
        entryDate: new Date(),
        isPaid: true,
        createdBy: 'test-user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('sem amarração contábil');
    });
  });

  describe('Criação de Outras Receitas com Contabilização', () => {
    it('deve criar outra receita e contabilizar automaticamente', async () => {
      const result = await accounting.createOtherRevenue({
        partnerId: 1, // Parceiro existente
        issueDate: new Date(),
        entryDate: new Date(),
        competenceMonth: '2026-02',
        documentType: 'RECIBO',
        documentNumber: 'TEST-001',
        managementAccountId: 30006, // ROR003 - Outras Receitas
        description: 'Receita de teste para contabilização',
        creditDate: new Date(), // Já recebido
        paymentMethod: 'PIX',
        notes: 'Teste automatizado',
        amount: 250.00,
        status: 'ACTIVE',
        companyId: 1,
        createdBy: 'test-user',
      });

      expect(result.id).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      expect(result.journalId).toBeDefined();
      expect(result.journalId).toBeGreaterThan(0);
    });
  });
});
