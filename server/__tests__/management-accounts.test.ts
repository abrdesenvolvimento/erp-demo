import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';

// Teste de integração para contas gerenciais
describe('Management Accounts', () => {
  
  describe('Database Tables', () => {
    it('should have managementAccounts table with data', async () => {
      const { getDb } = await import('../db');
      const db = await getDb();
      
      if (!db) {
        console.log('Database not available, skipping test');
        return;
      }
      
      const result = await db.execute(sql.raw('SELECT COUNT(*) as count FROM managementAccounts'));
      const rows = result[0] as unknown as any[];
      const count = parseInt(rows[0]?.count || '0');
      
      expect(count).toBeGreaterThan(0);
      console.log(`Found ${count} management accounts`);
    });
    
    it('should have accountingMappings table with data', async () => {
      const { getDb } = await import('../db');
      const db = await getDb();
      
      if (!db) {
        console.log('Database not available, skipping test');
        return;
      }
      
      const result = await db.execute(sql.raw('SELECT COUNT(*) as count FROM accountingMappings'));
      const rows = result[0] as unknown as any[];
      const count = parseInt(rows[0]?.count || '0');
      
      expect(count).toBeGreaterThan(0);
      console.log(`Found ${count} accounting mappings`);
    });
  });
  
  describe('DB Functions', () => {
    it('should list management accounts', async () => {
      const { listManagementAccounts } = await import('../db');
      
      const accounts = await listManagementAccounts();
      
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBeGreaterThan(0);
      
      // Verificar estrutura do primeiro item
      const first = accounts[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('code');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('nature');
      expect(first).toHaveProperty('classification');
      expect(first).toHaveProperty('accountingCode');
      
      console.log(`Listed ${accounts.length} management accounts`);
      console.log('Sample account:', first);
    });
    
    it('should list management accounts for select (simplified)', async () => {
      const { listManagementAccountsForSelect } = await import('../db');
      
      const accounts = await listManagementAccountsForSelect();
      
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBeGreaterThan(0);
      
      // Verificar que tem label formatado
      const first = accounts[0];
      expect(first).toHaveProperty('label');
      expect(first.label).toContain('(');
      
      console.log(`Listed ${accounts.length} accounts for select`);
    });
    
    it('should list management accounts grouped by classification', async () => {
      const { listManagementAccountsGrouped } = await import('../db');
      
      const grouped = await listManagementAccountsGrouped();
      
      expect(typeof grouped).toBe('object');
      
      // Verificar que tem pelo menos uma classificação
      const classifications = Object.keys(grouped);
      expect(classifications.length).toBeGreaterThan(0);
      
      console.log('Classifications found:', classifications);
    });
    
    it('should get accounting code by management account id', async () => {
      const { listManagementAccountsForSelect, getAccountingCodeByManagementAccount } = await import('../db');
      
      // Primeiro, pegar um ID válido
      const accounts = await listManagementAccountsForSelect();
      if (accounts.length === 0) {
        console.log('No accounts found, skipping test');
        return;
      }
      
      const testId = accounts[0].id;
      const accountingCode = await getAccountingCodeByManagementAccount(testId);
      
      expect(accountingCode).not.toBeNull();
      expect(typeof accountingCode).toBe('string');
      expect(accountingCode).toMatch(/^\d+\.\d+\.\d+\.\d+$/); // Formato 3.1.01.001
      
      console.log(`Account ID ${testId} has accounting code: ${accountingCode}`);
    });
    
    it('should filter management accounts by nature', async () => {
      const { listManagementAccounts } = await import('../db');
      
      const custos = await listManagementAccounts({ nature: 'CUSTO' });
      const despesas = await listManagementAccounts({ nature: 'DESPESA' });
      
      // Verificar que todas as contas retornadas têm a natureza correta
      for (const account of custos) {
        expect(account.nature).toBe('CUSTO');
      }
      
      for (const account of despesas) {
        expect(account.nature).toBe('DESPESA');
      }
      
      console.log(`Found ${custos.length} CUSTO accounts and ${despesas.length} DESPESA accounts`);
    });
  });
  
  describe('Expense Integration', () => {
    it('should have expenses table with managementAccountId and accountingCode columns', async () => {
      const { getDb } = await import('../db');
      const db = await getDb();
      
      if (!db) {
        console.log('Database not available, skipping test');
        return;
      }
      
      const result = await db.execute(sql.raw(`SHOW COLUMNS FROM expenses WHERE Field IN ('managementAccountId', 'accountingCode')`));
      const rows = result[0] as unknown as any[];
      
      expect(rows.length).toBe(2);
      
      const columns = rows.map(r => r.Field);
      expect(columns).toContain('managementAccountId');
      expect(columns).toContain('accountingCode');
      
      console.log('Expense table has required columns:', columns);
    });
  });
});
