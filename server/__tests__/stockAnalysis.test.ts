import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do getDb
const mockExecute = vi.fn();
vi.mock('../db', () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: (...args: any[]) => mockExecute(...args),
  }),
}));

import { getStockAnalysisByCategory, getStockAnalysisByProduct } from '../stockAnalysisQueries';

describe('Stock Analysis Queries', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  describe('getStockAnalysisByCategory', () => {
    it('should return category summary with correct calculations', async () => {
      // Mock: stock, cmv, movements, costCurrent, costPrev
      mockExecute
        .mockResolvedValueOnce([[
          { categoryId: 1, categoryName: 'Bebidas', stockValue: '80000', productCount: '500' },
          { categoryId: 2, categoryName: 'Tabacaria', stockValue: '4000', productCount: '60' },
        ]])
        .mockResolvedValueOnce([[
          { categoryId: 1, cmv: '28000' },
          { categoryId: 2, cmv: '1500' },
        ]])
        .mockResolvedValueOnce([[
          { categoryId: 1, totalIn: '10000', totalOut: '0', adjustIn: '0', adjustOut: '0' },
        ]])
        .mockResolvedValueOnce([[
          { categoryId: 1, avgPurchaseCost: '3.50' },
        ]])
        .mockResolvedValueOnce([[
          { categoryId: 1, avgPurchaseCost: '3.80' },
        ]]);

      const result = await getStockAnalysisByCategory('2026-02-01', '2026-02-28', '2026-01-01', '2026-01-31', 22);

      expect(result).toHaveLength(2);
      
      // Bebidas - maior valor, deve vir primeiro
      const bebidas = result[0];
      expect(bebidas.categoryName).toBe('Bebidas');
      expect(bebidas.stockValue).toBe(80000);
      expect(bebidas.productCount).toBe(500);
      
      // Percentual: 80000 / 84000 * 100 = 95.2%
      expect(bebidas.stockPercentage).toBeCloseTo(95.2, 0);
      
      // Estoque inicial = 80000 - 10000 + 0 = 70000
      // Estoque médio = (70000 + 80000) / 2 = 75000
      // Giro = 28000 / 75000 = 0.37
      expect(bebidas.turnover).toBeCloseTo(0.37, 1);
      
      // Dias de estoque = 80000 / (28000 / 22) = 62.8
      expect(bebidas.daysOfStock).toBeCloseTo(63, 0);
      
      // Variação custo = (3.50 - 3.80) / 3.80 * 100 = -7.9%
      expect(bebidas.costVariation).toBeCloseTo(-7.9, 0);

      // Tabacaria - sem movimentações
      const tabacaria = result[1];
      expect(tabacaria.categoryName).toBe('Tabacaria');
      expect(tabacaria.stockValue).toBe(4000);
    });

    it('should handle empty results', async () => {
      mockExecute
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await getStockAnalysisByCategory('2026-02-01', '2026-02-28', '2026-01-01', '2026-01-31', 22);
      expect(result).toHaveLength(0);
    });

    it('should sort by stockValue descending', async () => {
      mockExecute
        .mockResolvedValueOnce([[
          { categoryId: 1, categoryName: 'Mercearia', stockValue: '500', productCount: '10' },
          { categoryId: 2, categoryName: 'Bebidas', stockValue: '80000', productCount: '500' },
          { categoryId: 3, categoryName: 'Cigarro', stockValue: '1500', productCount: '20' },
        ]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await getStockAnalysisByCategory('2026-02-01', '2026-02-28', '2026-01-01', '2026-01-31', 22);
      expect(result[0].categoryName).toBe('Bebidas');
      expect(result[1].categoryName).toBe('Cigarro');
      expect(result[2].categoryName).toBe('Mercearia');
    });
  });

  describe('getStockAnalysisByProduct', () => {
    it('should return product details with correct calculations', async () => {
      // Mock: products, cmv, lastSale, lastPurchase, lastCost, costCurr, costPrev, entries
      mockExecute
        .mockResolvedValueOnce([[
          { productId: 1, productName: 'Heineken 269ml', categoryId: 1, categoryName: 'Bebidas', currentStock: 527, avgCost: '3.78' },
        ]])
        .mockResolvedValueOnce([[
          { productId: 1, cmv: '1636', qtdSold: '433' },
        ]])
        .mockResolvedValueOnce([[
          { productId: 1, lastSaleDate: '2026-02-22' },
        ]])
        .mockResolvedValueOnce([[
          { productId: 1, lastPurchaseDate: '2026-02-21' },
        ]])
        .mockResolvedValueOnce([[
          { productId: 1, lastPurchaseCost: '3.7825' },
        ]])
        .mockResolvedValueOnce([[
          { productId: 1, avgPurchaseCost: '3.78' },
        ]])
        .mockResolvedValueOnce([[
          { productId: 1, avgPurchaseCost: '3.83' },
        ]])
        .mockResolvedValueOnce([[
          { productId: 1, entriesCount: '5', totalPurchased: '1216' },
        ]]);

      const result = await getStockAnalysisByProduct('2026-02-01', '2026-02-28', '2026-01-01', '2026-01-31', 22);

      expect(result).toHaveLength(1);
      const prod = result[0];
      expect(prod.productName).toBe('Heineken 269ml');
      expect(prod.currentStock).toBe(527);
      expect(prod.avgCost).toBe(3.78);
      expect(prod.qtdSold).toBe(433);
      expect(prod.stockValue).toBeCloseTo(1992.06, 1);
      
      // Giro = CMV / stockValue = 1636 / 1992.06 = 0.82
      expect(prod.turnover).toBeCloseTo(0.82, 1);
      
      // Dias = stockValue / (CMV / 22) = 1992.06 / 74.36 = 26.8
      expect(prod.daysOfStock).toBeCloseTo(27, 0);
      
      // Variação custo = (3.78 - 3.83) / 3.83 * 100 = -1.3%
      expect(prod.costVariation).toBeCloseTo(-1.3, 0);
      
      expect(prod.entriesInPeriod).toBe(5);
      expect(prod.totalPurchased).toBe(1216);
      expect(prod.lastPurchaseCost).toBe(3.78);
    });

    it('should handle product with no sales (999 days)', async () => {
      mockExecute
        .mockResolvedValueOnce([[
          { productId: 1, productName: 'Blue Label 750ml', categoryId: 1, categoryName: 'Bebidas', currentStock: 2, avgCost: '799.90' },
        ]])
        .mockResolvedValueOnce([[]])  // no CMV
        .mockResolvedValueOnce([[]])  // no last sale
        .mockResolvedValueOnce([[]])  // no purchase
        .mockResolvedValueOnce([[]])  // no last cost
        .mockResolvedValueOnce([[]])  // no cost curr
        .mockResolvedValueOnce([[]])  // no cost prev
        .mockResolvedValueOnce([[]]);  // no entries

      const result = await getStockAnalysisByProduct('2026-02-01', '2026-02-28', '2026-01-01', '2026-01-31', 22);

      expect(result).toHaveLength(1);
      const prod = result[0];
      expect(prod.productName).toBe('Blue Label 750ml');
      expect(prod.turnover).toBe(0);
      expect(prod.daysOfStock).toBe(999);
      expect(prod.qtdSold).toBe(0);
      expect(prod.costVariation).toBeNull();
      expect(prod.lastPurchaseDate).toBeNull();
      expect(prod.entriesInPeriod).toBe(0);
    });
  });
});
