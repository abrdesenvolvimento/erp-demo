import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

/**
 * Public cardápio router - no authentication required.
 * Serves active products grouped by category for the public menu page.
 */
export const cardapioRouter = router({
  /**
   * Get the full public menu for a given company.
   * Returns products grouped by category with prices from the SALAO channel.
   */
  getMenu: publicProcedure
    .input(z.object({
      companyId: z.number().default(2),
    }).optional())
    .query(async ({ input }) => {
      const companyId = input?.companyId ?? 2;
      const db = await getDb();
      if (!db) return { categories: [], updatedAt: null };

      // Get the SALAO channel for this company
      const channelRows = await db.execute(sql`
        SELECT id FROM salesChannels 
        WHERE companyId = ${companyId} AND (code = 'SALAO' OR type = 'SALAO')
        LIMIT 1
      `);
      const salonChannelId = (channelRows as any)[0]?.[0]?.id;
      if (!salonChannelId) return { categories: [], updatedAt: null };

      // Get active products with their SALAO prices, excluding Ingredientes
      const rows = await db.execute(sql`
        SELECT 
          p.id, p.name, p.subcategory, p.notes,
          c.id as categoryId, c.name as categoryName,
          pp.price
        FROM products p 
        JOIN categories c ON p.categoryId = c.id 
        LEFT JOIN productPrices pp ON pp.productId = p.id AND pp.channelId = ${salonChannelId}
        WHERE p.active = 1 
          AND UPPER(c.name) NOT LIKE '%INGREDIENTE%'
          AND p.companyId = ${companyId}
        ORDER BY c.name, p.name
      `);

      const products = (rows as any)[0] as Array<{
        id: number;
        name: string;
        subcategory: string | null;
        notes: string | null;
        categoryId: number;
        categoryName: string;
        price: string | null;
      }>;

      // Group by category
      const categoryMap = new Map<string, {
        id: number;
        name: string;
        displayName: string;
        items: Array<{ id: number; name: string; price: number | null; description: string | null }>;
      }>();

      for (const p of products) {
        const catKey = p.categoryName;
        if (!categoryMap.has(catKey)) {
          categoryMap.set(catKey, {
            id: p.categoryId,
            name: p.categoryName,
            displayName: formatCategoryName(p.categoryName),
            items: [],
          });
        }
        categoryMap.get(catKey)!.items.push({
          id: p.id,
          name: formatProductName(p.name),
          price: p.price ? parseFloat(p.price) : null,
          description: p.notes || null,
        });
      }

      // Define display order for categories
      const categoryOrder = [
        'BURGERS',
        'ENTRADAS E ACOMPANHAMENTOS',
        'BEBIIDAS',
      ];

      const categories = Array.from(categoryMap.values()).sort((a, b) => {
        const aIdx = categoryOrder.indexOf(a.name);
        const bIdx = categoryOrder.indexOf(b.name);
        if (aIdx === -1 && bIdx === -1) return a.name.localeCompare(b.name);
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });

      return {
        categories,
        updatedAt: new Date().toISOString(),
      };
    }),
});

/** Format category name for display (title case, fix typos) */
function formatCategoryName(name: string): string {
  const fixes: Record<string, string> = {
    'BEBIIDAS': 'Bebidas',
    'BURGERS': 'Burgers',
    'ENTRADAS E ACOMPANHAMENTOS': 'Entradas & Acompanhamentos',
  };
  if (fixes[name]) return fixes[name];
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/** Format product name for display — all uppercase as requested */
function formatProductName(name: string): string {
  return name.toUpperCase();
}
