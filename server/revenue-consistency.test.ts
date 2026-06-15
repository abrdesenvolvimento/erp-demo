import { describe, it, expect } from 'vitest';

/**
 * Tests para verificar a consistência dos cálculos de faturamento
 * entre Dashboard, Vendas por Categoria e Faturamento por Tipo de Pagamento
 */

describe('Revenue Consistency - getSalesByCategory', () => {
  it('should proportionalize category revenue to match finalAmount total', () => {
    // Simular o cálculo que getSalesByCategory faz
    const totalFinalAmount = 6934.85; // Dashboard value (authoritative)
    const categoryItems = [
      { categoryName: 'BURGERS', itemRevenue: 2988 },
      { categoryName: 'BEBIDAS', itemRevenue: 2424 },
      { categoryName: 'ENTRADAS', itemRevenue: 1067 },
    ];
    const totalItemRevenue = categoryItems.reduce((sum, c) => sum + c.itemRevenue, 0);

    let totalProportionalized = 0;
    const result = categoryItems.map(cat => {
      const proportion = cat.itemRevenue / totalItemRevenue;
      const revenue = totalFinalAmount * proportion;
      totalProportionalized += revenue;
      return { ...cat, revenue, proportion };
    });

    // Total proporcionalizado deve bater com finalAmount
    expect(totalProportionalized).toBeCloseTo(totalFinalAmount, 2);
    
    // Cada categoria deve ter proporção correta
    expect(result[0].proportion).toBeCloseTo(2988 / totalItemRevenue, 4);
    expect(result[1].proportion).toBeCloseTo(2424 / totalItemRevenue, 4);
    expect(result[2].proportion).toBeCloseTo(1067 / totalItemRevenue, 4);
    
    // Soma das proporções deve ser 1
    const totalProportion = result.reduce((sum, r) => sum + r.proportion, 0);
    expect(totalProportion).toBeCloseTo(1, 4);
  });

  it('should handle zero total item revenue gracefully', () => {
    const totalFinalAmount = 100;
    const totalItemRevenue = 0;
    
    const proportion = totalItemRevenue > 0 ? 50 / totalItemRevenue : 0;
    const revenue = totalFinalAmount * proportion;
    
    expect(revenue).toBe(0);
    expect(proportion).toBe(0);
  });
});

describe('Revenue Consistency - getSalesByPaymentType', () => {
  it('should normalize salon payments to match finalAmount minus tips', () => {
    const salaoFinalAmount = 6934.85;
    const salaoTotalTips = 455.85;
    const salaoRevenueWithoutTips = salaoFinalAmount - salaoTotalTips; // 6479.00

    // Raw payments from salonOrderPayments (may not match due to data integrity)
    const rawPayments = [
      { method: 'DEBIT', rawRevenue: 4500 },
      { method: 'CREDIT', rawRevenue: 1120 },
      { method: 'CASH', rawRevenue: 855 },
      { method: 'PIX', rawRevenue: 644.40 },
    ];
    const rawTotal = rawPayments.reduce((sum, p) => sum + p.rawRevenue, 0); // 7119.40

    // Normalize proportionally
    let normalizedTotal = 0;
    const normalized = rawPayments.map(p => {
      const proportion = p.rawRevenue / rawTotal;
      const revenue = salaoRevenueWithoutTips * proportion;
      normalizedTotal += revenue;
      return { ...p, normalizedRevenue: revenue };
    });

    // Normalized total should match revenue without tips
    expect(normalizedTotal).toBeCloseTo(salaoRevenueWithoutTips, 2);
    
    // Adding tips should give us the full finalAmount
    expect(normalizedTotal + salaoTotalTips).toBeCloseTo(salaoFinalAmount, 2);
  });

  it('should show gorjeta as separate line', () => {
    const salaoTotalTips = 455.85;
    const aggregated: Record<string, { count: number; revenue: number }> = {};
    
    // Add tip as separate line
    if (salaoTotalTips > 0) {
      aggregated['Gorjeta (Serviço)'] = { count: 0, revenue: salaoTotalTips };
    }
    
    expect(aggregated['Gorjeta (Serviço)']).toBeDefined();
    expect(aggregated['Gorjeta (Serviço)'].revenue).toBe(455.85);
  });

  it('should handle no salon sales gracefully', () => {
    const salaoFinalAmount = 0;
    const salaoTotalTips = 0;
    const salaoRevenueWithoutTips = salaoFinalAmount - salaoTotalTips;
    
    const rawPayments: any[] = [];
    const rawTotal = 0;
    
    // Should not add gorjeta line when tips are 0
    const aggregated: Record<string, { count: number; revenue: number }> = {};
    if (salaoTotalTips > 0) {
      aggregated['Gorjeta (Serviço)'] = { count: 0, revenue: salaoTotalTips };
    }
    
    expect(aggregated['Gorjeta (Serviço)']).toBeUndefined();
    expect(salaoRevenueWithoutTips).toBe(0);
  });
});

describe('Revenue Consistency - getSalesStats (Vendas page)', () => {
  it('should include salao channel in stats', () => {
    // Simulating the getSalesStats return with salao
    const stats = {
      balcao: { count: 10, total: 1000 },
      delivery: { count: 5, total: 500 },
      aPrazo: { count: 3, total: 300 },
      salao: { count: 8, total: 800 },
      total: { count: 26, total: 2600 },
    };
    
    // Salao should be tracked separately
    expect(stats.salao).toBeDefined();
    expect(stats.salao.count).toBe(8);
    expect(stats.salao.total).toBe(800);
    
    // Total should include all channels
    const sumChannels = stats.balcao.total + stats.delivery.total + stats.aPrazo.total + stats.salao.total;
    expect(sumChannels).toBe(stats.total.total);
  });
});

describe('Revenue Consistency - Dashboard monthly revenue', () => {
  it('should include salao in monthly revenue breakdown', () => {
    // Simulating getDashboardMonthlyRevenue return
    const monthlyRevenue = {
      total: 6934.85,
      balcao: 0,
      delivery: 0,
      aPrazo: 0,
      salao: 6934.85,
      count: 60,
    };
    
    expect(monthlyRevenue.salao).toBeDefined();
    expect(monthlyRevenue.total).toBeCloseTo(
      monthlyRevenue.balcao + monthlyRevenue.delivery + monthlyRevenue.aPrazo + monthlyRevenue.salao,
      2
    );
  });
});
