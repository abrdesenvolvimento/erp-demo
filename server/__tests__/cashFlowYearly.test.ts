import { describe, it, expect } from 'vitest';
import { appRouter } from '../routers';
import type { TrpcContext } from '../_core/context';

// Mock de contexto admin
const mockAdminContext: TrpcContext = {
  user: {
    id: 'admin-test',
    name: 'Admin Test',
    email: 'admin@test.com',
    role: 'admin',
    loginMethod: 'oauth',
    createdAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: {} as any,
  res: {} as any,
  activeCompanyId: 1,
  activeBranchId: 1,
};

const caller = appRouter.createCaller(mockAdminContext);

describe('Cash Flow - Yearly Closing', () => {
  // Yearly closing queries all 12 months in parallel, needs more time
  const YEARLY_TIMEOUT = 30000;
  it('deve retornar estrutura completa do fluxo de caixa no fechamento mensal', async () => {
    const closing = await caller.closing.monthly({
      year: 2025,
      month: 12,
    });

    expect(closing).toBeDefined();
    expect(closing.cashFlow).toBeDefined();

    // Verificar campos do fluxo de caixa
    expect(typeof closing.cashFlow.received).toBe('number');
    expect(typeof closing.cashFlow.paid).toBe('number');
    expect(typeof closing.cashFlow.balance).toBe('number');
    expect(typeof closing.cashFlow.vendasAVista).toBe('number');
    expect(typeof closing.cashFlow.recebimentosPrazo).toBe('number');
    expect(typeof closing.cashFlow.outrasReceitasCaixa).toBe('number');
    expect(typeof closing.cashFlow.purchasePayments).toBe('number');
    expect(typeof closing.cashFlow.expensePayments).toBe('number');

    // Verificar que received = vendasAVista + recebimentosPrazo + outrasReceitasCaixa
    const expectedReceived = closing.cashFlow.vendasAVista + closing.cashFlow.recebimentosPrazo + closing.cashFlow.outrasReceitasCaixa;
    expect(closing.cashFlow.received).toBeCloseTo(expectedReceived, 2);

    // Verificar que paid = purchasePayments + expensePayments
    const expectedPaid = closing.cashFlow.purchasePayments + closing.cashFlow.expensePayments;
    expect(closing.cashFlow.paid).toBeCloseTo(expectedPaid, 2);

    // Verificar que balance = received - paid
    const expectedBalance = closing.cashFlow.received - closing.cashFlow.paid;
    expect(closing.cashFlow.balance).toBeCloseTo(expectedBalance, 2);
  });

  it('deve retornar campos de fluxo de caixa detalhados no fechamento anual', async () => {
    const closing = await caller.closing.yearly({
      year: 2026, // Ano com poucos dados para ser rápido
    });

    expect(closing).toBeDefined();
    expect(closing.totals).toBeDefined();

    // Verificar campos de fluxo de caixa nos totais anuais
    expect(typeof closing.totals.cashReceived).toBe('number');
    expect(typeof closing.totals.cashPaid).toBe('number');
    expect(typeof closing.totals.cashBalance).toBe('number');
    expect(typeof closing.totals.cashVendasAVista).toBe('number');
    expect(typeof closing.totals.cashRecebimentosPrazo).toBe('number');
    expect(typeof closing.totals.cashOutrasReceitas).toBe('number');
    expect(typeof closing.totals.cashPurchasePayments).toBe('number');
    expect(typeof closing.totals.cashExpensePayments).toBe('number');

    // Verificar que cashReceived = cashVendasAVista + cashRecebimentosPrazo + cashOutrasReceitas
    const expectedReceived = closing.totals.cashVendasAVista + closing.totals.cashRecebimentosPrazo + closing.totals.cashOutrasReceitas;
    expect(closing.totals.cashReceived).toBeCloseTo(expectedReceived, 2);

    // Verificar que cashPaid = cashPurchasePayments + cashExpensePayments
    const expectedPaid = closing.totals.cashPurchasePayments + closing.totals.cashExpensePayments;
    expect(closing.totals.cashPaid).toBeCloseTo(expectedPaid, 2);

    // Verificar que cashBalance = cashReceived - cashPaid
    const expectedBalance = closing.totals.cashReceived - closing.totals.cashPaid;
    expect(closing.totals.cashBalance).toBeCloseTo(expectedBalance, 2);
  }, YEARLY_TIMEOUT);

  it('deve incluir campos de fluxo de caixa em cada mês do fechamento anual', async () => {
    const closing = await caller.closing.yearly({
      year: 2026,
    });

    expect(closing.months.length).toBe(12);

    for (const month of closing.months) {
      expect(typeof month.cashReceived).toBe('number');
      expect(typeof month.cashPaid).toBe('number');
      expect(typeof month.cashBalance).toBe('number');
      expect(typeof month.cashVendasAVista).toBe('number');
      expect(typeof month.cashRecebimentosPrazo).toBe('number');
      expect(typeof month.cashOutrasReceitas).toBe('number');
      expect(typeof month.cashPurchasePayments).toBe('number');
      expect(typeof month.cashExpensePayments).toBe('number');

      // Verificar consistência: received = vendasAVista + recebimentosPrazo + outrasReceitas
      const expectedReceived = month.cashVendasAVista + month.cashRecebimentosPrazo + month.cashOutrasReceitas;
      expect(month.cashReceived).toBeCloseTo(expectedReceived, 2);

      // Verificar consistência: paid = purchasePayments + expensePayments
      const expectedPaid = month.cashPurchasePayments + month.cashExpensePayments;
      expect(month.cashPaid).toBeCloseTo(expectedPaid, 2);
    }
  }, YEARLY_TIMEOUT);

  it('vendas à vista deve ser Balcão + Delivery (não inclui A Prazo)', async () => {
    const closing = await caller.closing.monthly({
      year: 2025,
      month: 12, // Mês com dados de Delivery e A Prazo
    });

    // vendasAVista deve ser Balcão + Delivery
    const balcao = closing.dre.receitaBruta.balcao;
    const delivery = closing.dre.receitaBruta.delivery;
    const expectedVendasAVista = balcao + delivery;

    expect(closing.cashFlow.vendasAVista).toBeCloseTo(expectedVendasAVista, 2);

    // vendasAVista NÃO deve incluir A Prazo
    const aPrazo = closing.dre.receitaBruta.aPrazo;
    if (aPrazo > 0) {
      expect(closing.cashFlow.vendasAVista).not.toBeCloseTo(expectedVendasAVista + aPrazo, 2);
    }
  });

  it('todos os valores de fluxo de caixa devem ser >= 0', async () => {
    const closing = await caller.closing.monthly({
      year: 2025,
      month: 12,
    });

    // Entradas individuais devem ser >= 0
    expect(closing.cashFlow.vendasAVista).toBeGreaterThanOrEqual(0);
    expect(closing.cashFlow.recebimentosPrazo).toBeGreaterThanOrEqual(0);
    expect(closing.cashFlow.outrasReceitasCaixa).toBeGreaterThanOrEqual(0);
    expect(closing.cashFlow.received).toBeGreaterThanOrEqual(0);

    // Saídas individuais devem ser >= 0
    expect(closing.cashFlow.purchasePayments).toBeGreaterThanOrEqual(0);
    expect(closing.cashFlow.expensePayments).toBeGreaterThanOrEqual(0);
    expect(closing.cashFlow.paid).toBeGreaterThanOrEqual(0);

    // Balance pode ser negativo, mas received e paid devem ser >= 0
  });
});
