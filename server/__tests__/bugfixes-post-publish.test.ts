/**
 * Bug Fixes Post-Publish (08/03/2026)
 * 
 * 1. SalaoComanda.tsx: subtotal/totalWithTip variables used before definition (Cannot access before initialization)
 * 2. cancelSale: when cancelling a SALAO sale, also cancel the corresponding salonOrder
 * 3. Transferência de Comanda present in sidebar menu
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';

describe('Bug Fixes Post-Publish - 08/03/2026', () => {

  describe('BUG-01: SalaoComanda variable initialization order', () => {
    it('should define subtotal/totalWithTip before they are used in handlers', () => {
      const source = fs.readFileSync('./client/src/pages/SalaoComanda.tsx', 'utf-8');
      const lines = source.split('\n');

      // Find where subtotal is first defined (const subtotal = ...)
      let subtotalDefLine = -1;
      let handleTipChangeLine = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('const subtotal =') && !line.includes('subtotal =') && subtotalDefLine === -1) {
          // Look for the actual computation, not destructuring
          if (line.includes('items.reduce') || line.includes('reduce(')) {
            subtotalDefLine = i;
          }
        }
        if (line.includes('const subtotal') && line.includes('reduce')) {
          subtotalDefLine = i;
        }
        if (line.includes('function handleTipChange') || line.includes('handleTipChange')) {
          if (line.includes('function') || line.includes('=>') || line.includes('const handleTipChange')) {
            if (handleTipChangeLine === -1) handleTipChangeLine = i;
          }
        }
      }

      // subtotal should be defined before handleTipChange uses it
      if (subtotalDefLine !== -1 && handleTipChangeLine !== -1) {
        expect(subtotalDefLine).toBeLessThan(handleTipChangeLine);
      }
    });

    it('should define subtotal before handleCheckout and early returns', () => {
      const source = fs.readFileSync('./client/src/pages/SalaoComanda.tsx', 'utf-8');
      
      // Find the const subtotal = line (parseFloat pattern)
      const constSubtotalMatch = source.match(/const subtotal\s*=\s*parseFloat/);
      expect(constSubtotalMatch).not.toBeNull();
      
      const subtotalPos = source.indexOf(constSubtotalMatch![0]);
      
      // Check that handleCheckout (which uses subtotal/totalWithTip) is defined AFTER subtotal
      const handleCheckoutPos = source.indexOf('const handleCheckout');
      expect(handleCheckoutPos).toBeGreaterThan(-1);
      expect(subtotalPos).toBeLessThan(handleCheckoutPos);
      
      // Also check that early returns (if (!order)) come AFTER subtotal definition
      // This was the original bug: subtotal was defined after early returns
      const earlyReturnPos = source.indexOf('if (!order)');
      if (earlyReturnPos !== -1) {
        expect(subtotalPos).toBeLessThan(earlyReturnPos);
      }
    });
  });

  describe('BUG-02: cancelSale syncs salonOrder status', () => {
    it('should update salonOrder to CANCELLED when SALAO sale is cancelled', () => {
      const source = fs.readFileSync('./server/db.ts', 'utf-8');
      
      // The cancelSale function should check for SALAO saleType
      expect(source).toContain('sale.saleType === "SALAO"');
      
      // It should update salonOrders status
      expect(source).toContain('salonOrders');
      expect(source).toContain('.set({ status: "CANCELLED" })');
      
      // It should match by saleId
      expect(source).toContain('salonOrders.saleId');
    });

    it('should handle errors gracefully when syncing salon order', () => {
      const source = fs.readFileSync('./server/db.ts', 'utf-8');
      
      // Should be wrapped in try-catch
      const cancelSaleSection = source.substring(
        source.indexOf('export async function cancelSale'),
        source.indexOf('export async function updateSaleItems') || source.length
      );
      
      // The salon sync should be in a try-catch to not break the main cancel flow
      expect(cancelSaleSection).toContain('try');
      expect(cancelSaleSection).toContain('catch');
      expect(cancelSaleSection).toContain('[cancelSale] Falha ao cancelar comanda');
    });
  });

  describe('BUG-03: Transferência in sidebar menu', () => {
    it('should have Transferência item in DashboardLayout sidebar', () => {
      const source = fs.readFileSync('./client/src/components/DashboardLayout.tsx', 'utf-8');
      
      expect(source).toContain('Transferência');
      expect(source).toContain('/salao/transferencia');
    });

    it('should have the transfer route in App.tsx', () => {
      const source = fs.readFileSync('./client/src/App.tsx', 'utf-8');
      
      expect(source).toContain('/salao/transferencia');
    });
  });
});
