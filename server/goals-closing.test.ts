import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

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

describe('Goals - Revenue Goals CRUD', () => {
  let testGoalId: number | undefined;

  it('deve listar metas (pode estar vazia)', async () => {
    const goals = await caller.goals.list({ year: 2026 });
    expect(Array.isArray(goals)).toBe(true);
  });

  it('deve criar/atualizar uma meta de faturamento', async () => {
    const result = await caller.goals.upsert({
      year: 2026,
      month: 1,
      channelId: null, // Meta geral
      targetAmount: 50000,
      notes: 'Meta de teste',
    });
    expect(result.success).toBe(true);
  });

  it('deve buscar a meta criada', async () => {
    const goal = await caller.goals.get({
      year: 2026,
      month: 1,
      channelId: null,
    });
    expect(goal).not.toBeNull();
    expect(goal?.targetAmount).toBe(50000);
    expect(goal?.notes).toBe('Meta de teste');
    testGoalId = goal?.id;
  });

  it('deve atualizar a meta existente', async () => {
    const result = await caller.goals.upsert({
      year: 2026,
      month: 1,
      channelId: null,
      targetAmount: 60000,
      notes: 'Meta atualizada',
    });
    expect(result.success).toBe(true);

    const goal = await caller.goals.get({
      year: 2026,
      month: 1,
      channelId: null,
    });
    expect(goal?.targetAmount).toBe(60000);
    expect(goal?.notes).toBe('Meta atualizada');
  });

  it('deve buscar progresso de metas', async () => {
    const progress = await caller.goals.progress({
      year: 2026,
      month: 1,
    });
    // Pode ser null se não houver metas ou pode ter dados
    if (progress) {
      expect(progress.year).toBe(2026);
      expect(progress.month).toBe(1);
      expect(Array.isArray(progress.goals)).toBe(true);
    }
  });

  it('deve deletar a meta de teste', async () => {
    if (testGoalId) {
      const result = await caller.goals.delete({ id: testGoalId });
      expect(result.success).toBe(true);
    }
  });
});

describe('Closing - Monthly Closing Report', () => {
  it('deve gerar relatório de fechamento mensal', async () => {
    const closing = await caller.closing.monthly({
      year: 2026,
      month: 1,
    });

    expect(closing).toBeDefined();
    expect(closing.period.year).toBe(2026);
    expect(closing.period.month).toBe(1);
    
    // Verificar estrutura do relatório
    expect(closing.sales).toBeDefined();
    expect(closing.sales.total).toBeDefined();
    expect(typeof closing.sales.total.count).toBe('number');
    expect(typeof closing.sales.total.revenue).toBe('number');
    
    expect(closing.purchases).toBeDefined();
    expect(closing.purchases.total).toBeDefined();
    
    expect(closing.expenses).toBeDefined();
    expect(closing.expenses.total).toBeDefined();
    expect(Array.isArray(closing.expenses.byCategory)).toBe(true);
    
    expect(closing.cashFlow).toBeDefined();
    expect(typeof closing.cashFlow.received).toBe('number');
    expect(typeof closing.cashFlow.paid).toBe('number');
    
    expect(closing.results).toBeDefined();
    expect(typeof closing.results.revenue).toBe('number');
    expect(typeof closing.results.grossProfit).toBe('number');
    expect(typeof closing.results.netResult).toBe('number');
  });

  it('deve gerar relatório de fechamento anual', async () => {
    const closing = await caller.closing.yearly({
      year: 2026, // Ano sem dados para ser mais rápido
    });

    expect(closing).toBeDefined();
    expect(closing.year).toBe(2026);
    expect(Array.isArray(closing.months)).toBe(true);
    expect(closing.months.length).toBe(12);
    
    // Verificar totais
    expect(closing.totals).toBeDefined();
    expect(typeof closing.totals.revenue).toBe('number');
    expect(typeof closing.totals.grossProfit).toBe('number');
  });
});
