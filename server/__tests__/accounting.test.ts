import { describe, it, expect } from 'vitest';
import * as accounting from '../accounting';

describe('Módulo de Contabilidade', () => {
  describe('Plano de Contas', () => {
    it('deve listar todas as contas', async () => {
      const accounts = await accounting.getChartOfAccounts(1);
      expect(accounts).toBeDefined();
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBeGreaterThan(0);
    });

    it('deve buscar conta por código', async () => {
      const account = await accounting.getAccountByCode('1', 1);
      expect(account).toBeDefined();
      expect(account?.code).toBe('1');
      expect(account?.name).toBe('ATIVO');
    });

    it('deve listar apenas contas analíticas', async () => {
      const accounts = await accounting.getAnalyticalAccounts(1);
      expect(accounts).toBeDefined();
      expect(Array.isArray(accounts)).toBe(true);
      // Todas devem ser analíticas
      for (const acc of accounts) {
        expect(acc.isAnalytical).toBe(true);
      }
    });
  });

  describe('Períodos Contábeis', () => {
    it('deve criar período se não existir', async () => {
      const result = await accounting.ensurePeriodOpen('2026-02', 1);
      expect(result).toBe(true);
    });

    it('deve buscar período existente', async () => {
      const period = await accounting.getAccountingPeriod('2026-02', 1);
      expect(period).toBeDefined();
      expect(period?.competenceMonth).toBe('2026-02');
      expect(period?.status).toBe('OPEN');
    });
  });

  describe('Journals e Lançamentos', () => {
    let journalId: number;

    it('deve criar um journal', async () => {
      const journal = await accounting.createJournal({
        companyId: 1,
        competenceMonth: '2026-02',
        description: 'Teste de contabilização',
        createdBy: 'test-user'
      });
      expect(journal).toBeDefined();
      expect(journal.id).toBeGreaterThan(0);
      expect(journal.status).toBe('DRAFT');
      journalId = journal.id;
    });

    it('deve adicionar lançamentos com partida dobrada', async () => {
      // Usar códigos corretos do Plano de Contas
      const contaCaixa = await accounting.getAccountByCode('1.1.1.01', 1);
      const contaReceita = await accounting.getAccountByCode('4.1.1.01', 1);
      
      expect(contaCaixa).toBeDefined();
      expect(contaReceita).toBeDefined();
      
      if (!contaCaixa || !contaReceita) {
        throw new Error('Contas de teste não encontradas');
      }

      const entries = await accounting.addEntriesToJournal(
        journalId,
        [
          { accountId: contaCaixa.id, amount: 100, entryType: 'D', description: 'Entrada em caixa' },
          { accountId: contaReceita.id, amount: 100, entryType: 'C', description: 'Receita de venda' }
        ],
        new Date(),
        '2026-02'
      );
      
      expect(entries).toBeDefined();
      expect(entries.length).toBe(2);
    });

    it('deve rejeitar partida dobrada inválida', async () => {
      const contaCaixa = await accounting.getAccountByCode('1.1.1.01', 1);
      expect(contaCaixa).toBeDefined();
      
      if (!contaCaixa) return;

      // Criar novo journal para este teste
      const newJournal = await accounting.createJournal({
        companyId: 1,
        competenceMonth: '2026-02',
        description: 'Teste partida dobrada inválida',
        createdBy: 'test-user'
      });

      await expect(
        accounting.addEntriesToJournal(
          newJournal.id,
          [
            { accountId: contaCaixa.id, amount: 100, entryType: 'D', description: 'Só débito' }
          ],
          new Date(),
          '2026-02'
        )
      ).rejects.toThrow('Partida dobrada inválida');
    });

    it('deve postar journal', async () => {
      const journal = await accounting.postJournal(journalId);
      expect(journal).toBeDefined();
      expect(journal.status).toBe('POSTED');
    });
  });

  describe('Relatórios', () => {
    it('deve gerar balancete', async () => {
      const balancete = await accounting.getBalancete('2026-02', 1);
      expect(balancete).toBeDefined();
      expect(Array.isArray(balancete)).toBe(true);
    });

    it('deve gerar DRE', async () => {
      const dre = await accounting.getDRE('2026-02', 1);
      expect(dre).toBeDefined();
      expect(Array.isArray(dre)).toBe(true);
    });
  });
});
