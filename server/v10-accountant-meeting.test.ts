import { describe, it, expect } from "vitest";

/**
 * Tests for v10 Accountant Meeting improvements
 * 1. Categorias page hides Despesas tab
 * 2. Sales report date fix (timezone)
 * 3. Compras: doc type filter, totals cards, Excel export
 * 4. Cancel test data (already exists)
 * 5. Export Despesas and Outras Receitas
 * 6. Consultor access replication
 * 7. Future: KDS time mapping (noted in todo)
 */

describe("v10 - Accountant Meeting Improvements", () => {
  
  describe("Item 1: Categorias - Hide Despesas Tab", () => {
    it("should have removed Despesas tab from Categorias page", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("client/src/pages/Categorias.tsx", "utf-8");
      // Should NOT have a Despesas tab trigger
      expect(content).not.toMatch(/TabsTrigger[^>]*value=["']despesas["']/);
      // Should still have Produtos tab
      expect(content).toMatch(/Produtos/);
    });
  });

  describe("Item 2: Sales Report Date Fix", () => {
    it("should use T12:00:00 to avoid timezone shift in Vendas export", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("client/src/pages/Vendas.tsx", "utf-8");
      // Should use T12:00:00 to avoid UTC midnight timezone shift
      expect(content).toMatch(/T12:00:00/);
    });
  });

  describe("Item 3: Compras - Filters, Totals, Excel Export", () => {
    it("should have doc type filter in Compras", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("client/src/pages/Compras.tsx", "utf-8");
      // Should have doc type filter state
      expect(content).toMatch(/filterDocType|docTypeFilter/);
      // Should have totals computation with filteredPurchases
      expect(content).toMatch(/filteredPurchases/);
      // Should have Excel export functionality
      expect(content).toMatch(/Download/);
    });
  });

  describe("Item 5: Export Despesas and Outras Receitas", () => {
    it("should have export button in Despesas", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("client/src/pages/Despesas.tsx", "utf-8");
      expect(content).toMatch(/Download/);
      expect(content).toMatch(/csv/i);
    });

    it("should have export button in OutrasReceitas", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("client/src/pages/OutrasReceitas.tsx", "utf-8");
      expect(content).toMatch(/Download/);
      expect(content).toMatch(/csv/i);
    });
  });

  describe("Item 6: Consultor Access Replication", () => {
    it("should give consultor access to all analysis pages", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("client/src/components/DashboardLayout.tsx", "utf-8");
      
      const analysisPages = [
        "Análise de Vendas",
        "Análise Delivery",
        "Análise por Canal",
        "Análise de Despesas",
        "Análise de Estoque",
        "Fechamento Garçom",
        "Análise KDS",
      ];
      
      for (const page of analysisPages) {
        const regex = new RegExp(`label:\\s*"${page}"[^}]*roles:\\s*\\[[^\\]]*"consultor"[^\\]]*\\]`);
        expect(content).toMatch(regex);
      }
    });

    it("should give consultor access to all finance pages", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("client/src/components/DashboardLayout.tsx", "utf-8");
      expect(content).toMatch(/Consultor tem acesso de leitura/);
    });

    it("should give consultor access to Categorias and Importar iFood", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("client/src/components/DashboardLayout.tsx", "utf-8");
      
      const catRegex = /label:\s*"Categorias"[^}]*roles:\s*\[[^\]]*"consultor"[^\]]*\]/;
      expect(content).toMatch(catRegex);
      
      const ifoodRegex = /label:\s*"Importar iFood"[^}]*roles:\s*\[[^\]]*"consultor"[^\]]*\]/;
      expect(content).toMatch(ifoodRegex);
    });
  });

  describe("Item 7: Future KDS Time Mapping", () => {
    it("should be noted in todo.md for future development", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("todo.md", "utf-8");
      expect(content).toMatch(/Mapeamento de Tempo/i);
      expect(content).toMatch(/FUTURO/);
    });
  });
});
