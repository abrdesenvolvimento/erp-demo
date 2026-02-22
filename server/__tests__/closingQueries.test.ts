import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getDb
const mockExecute = vi.fn();
const mockDb = {
  execute: mockExecute,
};

vi.mock('../db', () => ({
  getDb: vi.fn(() => mockDb),
}));

// Import after mocking
import {
  getSalesByChannel,
  getSalesByCategory,
  getPurchasesByCategory,
  getSalesByPaymentType,
  getStockByCategory,
  getPurchasesBySupplier,
} from '../closingQueries';

describe('closingQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSalesByChannel', () => {
    it('should map channel codes to friendly names (iFood, 99, Balcão, A Prazo)', async () => {
      mockExecute.mockResolvedValueOnce([[
        { channelId: 1, channelName: 'Balcão / A Prazo', channelCode: 'BALCAO', saleType: 'BALCAO', count: '100', revenue: '5000.00' },
        { channelId: 2, channelName: 'Delivery iFood', channelCode: 'IFOOD', saleType: 'DELIVERY', count: '50', revenue: '3000.00' },
        { channelId: 3, channelName: 'Delivery 99Food', channelCode: '99FOOD', saleType: 'DELIVERY', count: '10', revenue: '500.00' },
        { channelId: 1, channelName: 'Balcão / A Prazo', channelCode: 'BALCAO', saleType: 'A_PRAZO', count: '20', revenue: '1500.00' },
      ]]);

      const result = await getSalesByChannel('2026-02-01', '2026-02-28');
      
      // Should have 4 distinct channels: Balcão, iFood, 99, A Prazo
      expect(result.length).toBe(4);
      
      const channelNames = result.map(r => r.channelName);
      expect(channelNames).toContain('Balcão');
      expect(channelNames).toContain('iFood');
      expect(channelNames).toContain('99');
      expect(channelNames).toContain('A Prazo');
      
      // Verify A Prazo is separated from Balcão
      const aPrazo = result.find(r => r.channelName === 'A Prazo');
      expect(aPrazo).toBeDefined();
      expect(aPrazo!.revenue).toBe(1500);
      expect(aPrazo!.count).toBe(20);
      
      const balcao = result.find(r => r.channelName === 'Balcão');
      expect(balcao).toBeDefined();
      expect(balcao!.revenue).toBe(5000);
    });

    it('should calculate ticket medio correctly', async () => {
      mockExecute.mockResolvedValueOnce([[
        { channelId: 1, channelName: 'Balcão / A Prazo', channelCode: 'BALCAO', saleType: 'BALCAO', count: '10', revenue: '500.00' },
      ]]);

      const result = await getSalesByChannel('2026-02-01', '2026-02-28');
      expect(result[0].ticketMedio).toBe(50);
    });

    it('should sort by revenue descending', async () => {
      mockExecute.mockResolvedValueOnce([[
        { channelId: 1, channelName: 'Balcão / A Prazo', channelCode: 'BALCAO', saleType: 'BALCAO', count: '10', revenue: '100.00' },
        { channelId: 2, channelName: 'Delivery iFood', channelCode: 'IFOOD', saleType: 'DELIVERY', count: '50', revenue: '5000.00' },
      ]]);

      const result = await getSalesByChannel('2026-02-01', '2026-02-28');
      expect(result[0].channelName).toBe('iFood');
      expect(result[1].channelName).toBe('Balcão');
    });
  });

  describe('getPurchasesBySupplier', () => {
    it('should use name when tradeName is null', async () => {
      // Data comes pre-sorted by amount DESC from SQL ORDER BY
      mockExecute.mockResolvedValueOnce([[
        { supplierId: 2, supplierName: 'Coca Cola', amount: '2000.00', invoiceCount: '5' },
        { supplierId: 1, supplierName: 'Assai Autonomistas', amount: '1000.00', invoiceCount: '3' },
      ]]);

      const result = await getPurchasesBySupplier('2026-02-01', '2026-02-28');
      
      // No "Sem Nome" entries
      const hasNoName = result.some(r => r.supplierName === 'Sem Nome');
      expect(hasNoName).toBe(false);
      
      // Results are ordered by amount DESC from the query
      expect(result[0].supplierName).toBe('Coca Cola');
      expect(result[1].supplierName).toBe('Assai Autonomistas');
    });

    it('should calculate percentages correctly', async () => {
      mockExecute.mockResolvedValueOnce([[
        { supplierId: 1, supplierName: 'Supplier A', amount: '750.00', invoiceCount: '3' },
        { supplierId: 2, supplierName: 'Supplier B', amount: '250.00', invoiceCount: '1' },
      ]]);

      const result = await getPurchasesBySupplier('2026-02-01', '2026-02-28');
      expect(result[0].percentage).toBe(75);
      expect(result[1].percentage).toBe(25);
    });
  });

  describe('getStockByCategory', () => {
    it('should calculate initial stock differently from final stock', async () => {
      // Final stock
      mockExecute.mockResolvedValueOnce([[
        { categoryId: 1, categoryName: 'Bebidas', finalStock: '10000.00' },
      ]]);
      // Movements
      mockExecute.mockResolvedValueOnce([[
        { categoryId: 1, totalIn: '3000.00', totalOut: '1000.00', adjustIn: '200.00', adjustOut: '100.00' },
      ]]);
      // CMV
      mockExecute.mockResolvedValueOnce([[
        { categoryId: 1, cmv: '5000.00' },
      ]]);

      const result = await getStockByCategory('2026-02-01', '2026-02-28', 2026, 2);
      
      // Initial = Final - TotalIn + TotalOut = 10000 - 3200 + 1100 = 7900
      expect(result[0].initialStock).toBe(7900);
      expect(result[0].finalStock).toBe(10000);
      
      // Variation should be finalStock - initialStock = 2100
      expect(result[0].variation).toBe(2100);
      
      // Initial and final should be different
      expect(result[0].initialStock).not.toBe(result[0].finalStock);
    });

    it('should calculate turnover (giro) correctly', async () => {
      // Final stock
      mockExecute.mockResolvedValueOnce([[
        { categoryId: 1, categoryName: 'Bebidas', finalStock: '10000.00' },
      ]]);
      // No movements
      mockExecute.mockResolvedValueOnce([[]]);
      // CMV
      mockExecute.mockResolvedValueOnce([[
        { categoryId: 1, cmv: '5000.00' },
      ]]);

      const result = await getStockByCategory('2026-02-01', '2026-02-28', 2026, 2);
      
      // avgStock = (10000 + 10000) / 2 = 10000
      // turnover = 5000 / 10000 = 0.5
      expect(result[0].turnover).toBe(0.5);
    });
  });

  describe('getSalesByPaymentType', () => {
    it('should return payment types with percentages', async () => {
      mockExecute.mockResolvedValueOnce([[
        { paymentType: 'PIX', count: '100', revenue: '5000.00' },
        { paymentType: 'Cartão de Débito', count: '200', revenue: '10000.00' },
        { paymentType: 'Dinheiro', count: '50', revenue: '2000.00' },
      ]]);

      const result = await getSalesByPaymentType('2026-02-01', '2026-02-28');
      
      expect(result.length).toBe(3);
      const totalPercentage = result.reduce((sum, r) => sum + r.percentage, 0);
      expect(totalPercentage).toBeCloseTo(100, 0);
    });
  });

  describe('getSalesByCategory', () => {
    it('should calculate margin correctly', async () => {
      mockExecute.mockResolvedValueOnce([[
        { categoryId: 1, categoryName: 'Bebidas', revenue: '10000.00', cost: '7000.00' },
      ]]);

      const result = await getSalesByCategory('2026-02-01', '2026-02-28');
      
      // Margin = (10000 - 7000) / 10000 * 100 = 30%
      expect(result[0].margin).toBe(30);
      expect(result[0].grossProfit).toBe(3000);
    });
  });
});
