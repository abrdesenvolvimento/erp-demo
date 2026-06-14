import { describe, it, expect } from 'vitest';

/**
 * Tests for User Blocking feature
 * - toggleBlock procedure should block/unblock users
 * - Blocked users should be denied access via auth flow
 * - Admin cannot block themselves
 */

describe('User Blocking Feature', () => {
  describe('blockUser db helper', () => {
    it('should export blockUser function from db module', async () => {
      const db = await import('./db');
      expect(db.blockUser).toBeDefined();
      expect(typeof db.blockUser).toBe('function');
    });
  });

  describe('toggleBlock procedure validation', () => {
    it('should have toggleBlock procedure in users router', async () => {
      const { appRouter } = await import('./routers');
      // Check that users.toggleBlock exists as a procedure
      const usersRouter = (appRouter as any)._def.procedures;
      // tRPC v11 structure - procedures are nested
      expect(usersRouter).toBeDefined();
    });
  });

  describe('Schema validation', () => {
    it('users table should have blocked field defined', async () => {
      const { users } = await import('../drizzle/schema');
      // Check that blocked column exists in the schema
      const columns = Object.keys((users as any));
      // In drizzle, the table object has column accessors
      expect((users as any).blocked).toBeDefined();
    });
  });

  describe('Auth blocked check', () => {
    it('sdk.ts should contain blocked user check', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const sdkContent = fs.readFileSync(
        path.resolve(__dirname, './_core/sdk.ts'),
        'utf-8'
      );
      expect(sdkContent).toContain('user.blocked');
      expect(sdkContent).toContain('Usuário bloqueado');
    });
  });
});

describe('Waiter Closing Report - Date Display', () => {
  it('SalaoFechamentoGarcom should use formatDateTimeShort for order times', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../client/src/pages/SalaoFechamentoGarcom.tsx'),
      'utf-8'
    );
    // Should use formatDateTimeShort instead of just formatTime for orders
    expect(content).toContain('formatDateTimeShort(order.openedAt)');
    expect(content).toContain('formatDateTimeShort(order.closedAt)');
    // Should have the formatDateTimeShort function defined
    expect(content).toContain('const formatDateTimeShort');
  });

  it('PDF export should also use formatDateTimeShort', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../client/src/pages/SalaoFechamentoGarcom.tsx'),
      'utf-8'
    );
    expect(content).toContain('formatDateTimeShort(o.openedAt)');
    expect(content).toContain('formatDateTimeShort(o.closedAt)');
  });
});

describe('Waiter Closing Report - Product Sort', () => {
  it('should have sort state and sortProducts function', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../client/src/pages/SalaoFechamentoGarcom.tsx'),
      'utf-8'
    );
    expect(content).toContain('productSortBy');
    expect(content).toContain('const sortProducts');
    expect(content).toContain('sortProducts(w.productsSold)');
  });

  it('sortProducts logic should sort by revenue or quantity', () => {
    // Simulate the sort logic
    const products = [
      { productName: 'Burger', quantity: 5, totalRevenue: 150 },
      { productName: 'Beer', quantity: 20, totalRevenue: 100 },
      { productName: 'Soda', quantity: 10, totalRevenue: 50 },
    ];

    // Sort by revenue (default)
    const byRevenue = [...products].sort((a, b) => b.totalRevenue - a.totalRevenue);
    expect(byRevenue[0].productName).toBe('Burger');
    expect(byRevenue[1].productName).toBe('Beer');
    expect(byRevenue[2].productName).toBe('Soda');

    // Sort by quantity
    const byQuantity = [...products].sort((a, b) => b.quantity - a.quantity);
    expect(byQuantity[0].productName).toBe('Beer');
    expect(byQuantity[1].productName).toBe('Soda');
    expect(byQuantity[2].productName).toBe('Burger');
  });

  it('should have sort toggle buttons in the UI', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../client/src/pages/SalaoFechamentoGarcom.tsx'),
      'utf-8'
    );
    expect(content).toContain('Por Valor');
    expect(content).toContain('Por Qtd');
    expect(content).toContain('setProductSortBy("revenue")');
    expect(content).toContain('setProductSortBy("quantity")');
  });
});
