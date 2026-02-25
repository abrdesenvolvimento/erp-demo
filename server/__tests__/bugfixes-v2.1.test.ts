import { describe, it, expect } from 'vitest';
import fs from 'fs';

/**
 * Tests for bug fixes reported on 24/02/2026 (Lote 4).
 * Verifies source code patterns to ensure:
 * 1. CalendarPayButton modal has proper layout (vertical labels, grid-cols-2)
 * 2. Dashboard stock calculation aligns with Stock Analysis (includes negative stock)
 * 3. Fechamento tables have Total rows for Vendas/Compras por Categoria
 * 4. Print styles exist for Fechamento Mensal
 * 5. getSale query includes companyId for proper company validation
 * 6. cancelSale uses Number() for safe companyId comparison
 */

describe('Bug Fixes v2.1 - 24/02/2026', () => {
  
  describe('BUG-01: CalendarPayButton modal layout', () => {
    it('should use vertical layout with labels above inputs (not grid-cols-4)', () => {
      const source = fs.readFileSync('./client/src/components/CalendarPayButton.tsx', 'utf-8');
      // Should NOT have grid-cols-4 which caused overlapping
      expect(source).not.toContain('grid-cols-4');
      // Should have proper label/input structure
      expect(source).toContain('Label');
      expect(source).toContain('Input');
    });

    it('should have payment form fields (value, interest, discount, method, notes)', () => {
      const source = fs.readFileSync('./client/src/components/CalendarPayButton.tsx', 'utf-8');
      expect(source).toContain('paidAmount');
      expect(source).toContain('interestAmount');
      expect(source).toContain('discountAmount');
      expect(source).toContain('paymentMethod');
      expect(source).toContain('notes');
    });
  });

  describe('BUG-02: Dashboard stock value alignment', () => {
    it('should include products with negative stock in dashboard calculation (currentStock !== 0)', () => {
      const source = fs.readFileSync('./server/routers.ts', 'utf-8');
      // Should filter by stock !== 0 (not > 0) to include negative stock in calculation
      expect(source).toContain('stock !== 0 && cost !== 0');
    });
  });

  describe('BUG-03: Fechamento - Total rows in category tables', () => {
    it('should have Total footer rows in Vendas por Categoria and Compras por Categoria', () => {
      const source = fs.readFileSync('./client/src/pages/FechamentoMensalNovo.tsx', 'utf-8');
      // Should have TableFooter for category tables
      expect(source).toContain('TableFooter');
      // Should calculate totals for category revenue
      const totalOccurrences = (source.match(/Total/g) || []).length;
      expect(totalOccurrences).toBeGreaterThanOrEqual(4); // At least 4 Total rows across tables
    });
  });

  describe('BUG-04: Fechamento print styles', () => {
    it('should have @media print styles for proper A4 printing', () => {
      const source = fs.readFileSync('./client/src/pages/FechamentoMensalNovo.tsx', 'utf-8');
      expect(source).toContain('@media print');
      expect(source).toContain('@page');
      expect(source).toContain('A4');
    });

    it('should hide sidebar and navigation in print mode', () => {
      const source = fs.readFileSync('./client/src/pages/FechamentoMensalNovo.tsx', 'utf-8');
      expect(source).toContain('[data-sidebar]');
      expect(source).toContain('display: none !important');
    });

    it('should have print:hidden class on header controls', () => {
      const source = fs.readFileSync('./client/src/pages/FechamentoMensalNovo.tsx', 'utf-8');
      expect(source).toContain('print:hidden');
      expect(source).toContain('print:block');
    });
  });

  describe('BUG-05: getSale missing companyId', () => {
    it('should include companyId and branchId in getSale SELECT query', () => {
      const source = fs.readFileSync('./server/db.ts', 'utf-8');
      // The getSale raw SQL should include s.companyId
      expect(source).toContain('s.companyId, s.branchId');
    });
  });

  describe('BUG-06: cancelSale company validation', () => {
    it('should use Number() for safe companyId comparison in cancelSale', () => {
      const source = fs.readFileSync('./server/db.ts', 'utf-8');
      // Should use Number() to avoid type mismatch (string vs number)
      expect(source).toContain('Number(sale.companyId) !== Number(companyId)');
    });
  });
});
