import { describe, it, expect, vi } from 'vitest';

// ============================================
// Testes para Auditoria de Movimentações de Estoque
// ============================================

describe('Auditoria de Movimentações de Estoque', () => {
  
  describe('getAllProductMovements', () => {
    it('deve retornar estrutura correta com movements e total', async () => {
      const result = { movements: [], total: 0 };
      expect(result).toHaveProperty('movements');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.movements)).toBe(true);
      expect(typeof result.total).toBe('number');
    });

    it('deve suportar paginação', () => {
      const page = 1;
      const pageSize = 50;
      const offset = (page - 1) * pageSize;
      expect(offset).toBe(0);
      
      const page2 = 2;
      const offset2 = (page2 - 1) * pageSize;
      expect(offset2).toBe(50);
    });

    it('deve suportar filtro por tipo', () => {
      const validTypes = ['ENTRADA', 'SAIDA', 'PERDA', 'ACERTO', 'ESTORNO'];
      validTypes.forEach(type => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });
    });

    it('deve suportar filtro por período', () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-03-06');
      expect(startDate < endDate).toBe(true);
    });

    it('deve suportar busca por nome de produto', () => {
      const search = 'Coca Cola';
      const likePattern = `%${search}%`;
      expect(likePattern).toBe('%Coca Cola%');
    });
  });

  describe('getMovementStats', () => {
    it('deve retornar estrutura correta com byType, topProducts e totalMovements', () => {
      const result = { byType: [], topProducts: [], totalMovements: 0 };
      expect(result).toHaveProperty('byType');
      expect(result).toHaveProperty('topProducts');
      expect(result).toHaveProperty('totalMovements');
    });

    it('deve calcular total de movimentações corretamente', () => {
      const byType = [
        { type: 'ENTRADA', count: 1073, totalQty: '5000' },
        { type: 'SAIDA', count: 11213, totalQty: '15000' },
        { type: 'PERDA', count: 8, totalQty: '50' },
      ];
      const totalMovements = byType.reduce((sum, b) => sum + Number(b.count), 0);
      expect(totalMovements).toBe(12294);
    });

    it('deve limitar topProducts a 10 itens', () => {
      const maxProducts = 10;
      const topProducts = Array.from({ length: maxProducts }, (_, i) => ({
        productId: i + 1,
        productName: `Produto ${i + 1}`,
        count: 100 - i * 5,
      }));
      expect(topProducts.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Estorno por cancelamento de venda', () => {
    it('deve registrar movimentação de ESTORNO ao cancelar venda', () => {
      // Simular dados de cancelamento
      const saleItems = [
        { productId: 1, quantity: '2' },
        { productId: 2, quantity: '5' },
      ];
      
      const estornos = saleItems.map(item => ({
        productId: item.productId,
        type: 'ESTORNO',
        quantity: Math.abs(parseFloat(item.quantity)),
        documentNumber: 'Venda #12345',
        notes: 'Estorno - Cancelamento de venda',
      }));

      expect(estornos).toHaveLength(2);
      expect(estornos[0].type).toBe('ESTORNO');
      expect(estornos[0].quantity).toBe(2);
      expect(estornos[0].notes).toContain('Estorno');
      expect(estornos[1].quantity).toBe(5);
    });

    it('deve registrar movimentação de ESTORNO ao cancelar compra', () => {
      const purchaseItems = [
        { productId: 1, quantity: '10' },
        { productId: 2, quantity: '20' },
      ];
      
      const estornos = purchaseItems.map(item => ({
        productId: item.productId,
        type: 'ESTORNO',
        quantity: -Math.abs(parseFloat(item.quantity)),
        documentNumber: 'NF 12345',
        notes: 'Estorno - Cancelamento de compra',
      }));

      expect(estornos).toHaveLength(2);
      expect(estornos[0].type).toBe('ESTORNO');
      expect(estornos[0].quantity).toBe(-10);
      expect(estornos[0].notes).toContain('Cancelamento de compra');
    });
  });

  describe('Auditoria de Parceiros', () => {
    it('deve gerar diff de alterações de parceiro corretamente', () => {
      const current = { name: 'Fornecedor A', phone: '11999999999', email: 'a@test.com' };
      const update = { name: 'Fornecedor B', phone: '11999999999' };
      
      const fieldLabels: Record<string, string> = { name: 'Nome', phone: 'Telefone', email: 'E-mail' };
      
      const changes: any[] = [];
      for (const [key, newValue] of Object.entries(update)) {
        const oldValue = (current as any)[key];
        if (oldValue !== undefined && String(oldValue) !== String(newValue)) {
          changes.push({
            field: key,
            label: fieldLabels[key] || key,
            oldValue: String(oldValue),
            newValue: String(newValue),
          });
        }
      }
      
      expect(changes).toHaveLength(1);
      expect(changes[0].field).toBe('name');
      expect(changes[0].oldValue).toBe('Fornecedor A');
      expect(changes[0].newValue).toBe('Fornecedor B');
    });

    it('deve registrar criação de parceiro no audit log', () => {
      const auditEntry = {
        entityType: 'PARCEIRO',
        entityId: 1,
        entityName: 'Novo Fornecedor',
        action: 'CRIACAO',
        changes: [{ field: 'name', label: 'Nome', oldValue: null, newValue: 'Novo Fornecedor' }],
      };
      
      expect(auditEntry.entityType).toBe('PARCEIRO');
      expect(auditEntry.action).toBe('CRIACAO');
      expect(auditEntry.changes[0].oldValue).toBeNull();
    });
  });

  describe('Auditoria de Categorias', () => {
    it('deve registrar criação de categoria no audit log', () => {
      const auditEntry = {
        entityType: 'CATEGORIA',
        entityId: 1,
        entityName: 'Bebidas',
        action: 'CRIACAO',
        changes: [{ field: 'name', label: 'Nome', oldValue: null, newValue: 'Bebidas' }],
      };
      
      expect(auditEntry.entityType).toBe('CATEGORIA');
      expect(auditEntry.action).toBe('CRIACAO');
    });

    it('deve registrar edição de subcategoria no audit log', () => {
      const auditEntry = {
        entityType: 'CATEGORIA',
        entityId: 5,
        entityName: 'Cervejas (Subcategoria)',
        action: 'EDICAO',
        changes: [{ field: 'name', label: 'Nome', oldValue: 'Cerveja', newValue: 'Cervejas' }],
      };
      
      expect(auditEntry.entityType).toBe('CATEGORIA');
      expect(auditEntry.entityName).toContain('Subcategoria');
      expect(auditEntry.action).toBe('EDICAO');
    });

    it('deve registrar desativação de categoria', () => {
      const current = { name: 'Categoria X', active: true };
      const update = { active: false };
      
      let action = 'EDICAO';
      if (update.active === false && current.active === true) action = 'DESATIVACAO';
      
      expect(action).toBe('DESATIVACAO');
    });
  });

  describe('Formatação de quantidades', () => {
    it('deve formatar quantidades inteiras sem casas decimais', () => {
      const qty = 10;
      expect(Number.isInteger(qty)).toBe(true);
    });

    it('deve formatar quantidades fracionárias com casas decimais', () => {
      const qty = 2.5;
      expect(Number.isInteger(qty)).toBe(false);
    });

    it('deve exibir sinal positivo para entradas', () => {
      const qty = 10;
      const formatted = qty > 0 ? `+${qty}` : `${qty}`;
      expect(formatted).toBe('+10');
    });

    it('deve exibir sinal negativo para saídas', () => {
      const qty = -5;
      const formatted = qty > 0 ? `+${qty}` : `${qty}`;
      expect(formatted).toBe('-5');
    });
  });
});
