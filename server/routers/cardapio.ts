import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { generateCategoryStory, resolveLogoUrl } from "../storyGenerator";
import { storagePut } from "../storage";

/**
 * Public cardápio router - no authentication required.
 * Serves active products grouped by category for the public menu page.
 */
export const cardapioRouter = router({
  /**
   * Generate Instagram Story images for each category.
   * Returns an array of { categoryName, imageUrl } objects.
   */
  generateStories: protectedProcedure
    .input(z.object({
      companyId: z.number().default(2),
    }).optional())
    .mutation(async ({ input }) => {
      const companyId = input?.companyId ?? 2;
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Get the SALAO channel for this company
      const channelRows = await db.execute(sql`
        SELECT id FROM salesChannels 
        WHERE companyId = ${companyId} AND (code = 'SALAO' OR type = 'SALAO')
        LIMIT 1
      `);
      const salonChannelId = (channelRows as any)[0]?.[0]?.id;
      if (!salonChannelId) throw new Error('Canal Sal\u00e3o n\u00e3o encontrado');

      // Get active products with their SALAO prices
      const rows = await db.execute(sql`
        SELECT 
          p.id, p.name, p.notes,
          c.id as categoryId, c.name as categoryName,
          s.name as subcategoryName,
          pp.price
        FROM products p 
        JOIN categories c ON p.categoryId = c.id 
        LEFT JOIN subcategories s ON p.subcategoryId = s.id
        LEFT JOIN productPrices pp ON pp.productId = p.id AND pp.channelId = ${salonChannelId}
        WHERE p.active = 1 
          AND p.availableInSalon = 1
          AND UPPER(c.name) NOT LIKE '%INGREDIENTE%'
          AND p.companyId = ${companyId}
        ORDER BY c.name, p.name
      `);

      const products = (rows as any)[0] as Array<{
        id: number;
        name: string;
        notes: string | null;
        categoryId: number;
        categoryName: string;
        subcategoryName: string | null;
        price: string | null;
      }>;

      // Group by subcategory for Bebidas, by category for others
      // Use same logic as the online cardápio: Bebidas split into Água/Refri, Sucos, Cervejas, Drinks
      const categoryMap = new Map<string, {
        name: string;
        displayName: string;
        sectionStyle?: string;
        items: Array<{ id: number; name: string; price: number | null; description: string | null }>;
      }>();

      const bebidasItems: Array<{ id: number; name: string; price: number | null; description: string | null }> = [];

      for (const p of products) {
        const isCopaDoMundo = p.subcategoryName === 'COPA DO MUNDO' || p.categoryName === 'COPA DO MUNDO';
        const isBebidas = p.categoryName.toUpperCase().includes('BEBII') || p.categoryName.toUpperCase().includes('BEBIDA');
        
        if (isCopaDoMundo) {
          const catKey = 'COPA DO MUNDO';
          if (!categoryMap.has(catKey)) {
            categoryMap.set(catKey, {
              name: catKey,
              displayName: 'Copa do Mundo',
              sectionStyle: 'copa',
              items: [],
            });
          }
          categoryMap.get(catKey)!.items.push({
            id: p.id,
            name: p.name.toUpperCase(),
            price: p.price ? parseFloat(p.price) : null,
            description: p.notes || null,
          });
        } else if (isBebidas) {
          // Collect all bebidas to split by subcategory later
          bebidasItems.push({
            id: p.id,
            name: p.name.toUpperCase(),
            price: p.price ? parseFloat(p.price) : null,
            description: p.notes || null,
          });
        } else {
          const catKey = p.categoryName;
          if (!categoryMap.has(catKey)) {
            categoryMap.set(catKey, {
              name: catKey,
              displayName: formatCategoryName(catKey),
              sectionStyle: catKey === 'PARA COMPARTILHAR' ? 'dark' : 'light',
              items: [],
            });
          }
          categoryMap.get(catKey)!.items.push({
            id: p.id,
            name: p.name.toUpperCase(),
            price: p.price ? parseFloat(p.price) : null,
            description: p.notes || null,
          });
        }
      }

      // Split bebidas into subcategories (same logic as online cardápio)
      if (bebidasItems.length > 0) {
        const grouped = groupBebidasForStory(bebidasItems);
        if (grouped.aguasRefri.length > 0) {
          categoryMap.set('AGUA_REFRI', {
            name: 'AGUA_REFRI',
            displayName: '\u00c1gua e Refrigerante',
            sectionStyle: 'light',
            items: grouped.aguasRefri,
          });
        }
        if (grouped.sucos.length > 0) {
          categoryMap.set('SUCOS', {
            name: 'SUCOS',
            displayName: 'Sucos',
            sectionStyle: 'light',
            items: grouped.sucos,
          });
        }
        if (grouped.cervejas.length > 0) {
          categoryMap.set('CERVEJAS', {
            name: 'CERVEJAS',
            displayName: 'Cervejas',
            sectionStyle: 'light',
            items: grouped.cervejas,
          });
        }
        if (grouped.drinks.length > 0) {
          categoryMap.set('DRINKS', {
            name: 'DRINKS',
            displayName: 'Drinks',
            sectionStyle: 'dark',
            items: grouped.drinks,
          });
        }
      }

      // Resolve logo URL
      const logoUrl = await resolveLogoUrl();

      // Generate story for each category
      const results: Array<{ categoryName: string; displayName: string; imageUrl: string }> = [];
      const timestamp = Date.now();

      for (const [key, cat] of categoryMap) {
        if (cat.items.length === 0) continue;
        
        const buffer = await generateCategoryStory(cat, logoUrl);
        const fileName = `stories/cardapio-${key.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}.png`;
        
        const { url } = await storagePut(fileName, buffer, 'image/png');
        results.push({
          categoryName: key,
          displayName: cat.displayName,
          imageUrl: url,
        });
      }

      return { stories: results, generatedAt: new Date().toISOString() };
    }),

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
          s.id as subcategoryId, s.name as subcategoryName,
          pp.price
        FROM products p 
        JOIN categories c ON p.categoryId = c.id 
        LEFT JOIN subcategories s ON p.subcategoryId = s.id
        LEFT JOIN productPrices pp ON pp.productId = p.id AND pp.channelId = ${salonChannelId}
        WHERE p.active = 1 
          AND p.availableInSalon = 1
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
        subcategoryId: number | null;
        subcategoryName: string | null;
        price: string | null;
      }>;

      // Group by category, splitting BURGERS into regular and Copa do Mundo
      const categoryMap = new Map<string, {
        id: number;
        name: string;
        displayName: string;
        sectionStyle?: string;
        items: Array<{ id: number; name: string; price: number | null; description: string | null }>;
      }>();

      for (const p of products) {
        // Copa do Mundo burgers get their own section
        const isCopaDoMundo = p.subcategoryName === 'COPA DO MUNDO';
        const catKey = isCopaDoMundo ? 'COPA DO MUNDO' : p.categoryName;
        
        if (!categoryMap.has(catKey)) {
          categoryMap.set(catKey, {
            id: isCopaDoMundo ? 99901 : p.categoryId,
            name: catKey,
            displayName: isCopaDoMundo ? 'Copa do Mundo' : formatCategoryName(p.categoryName),
            sectionStyle: isCopaDoMundo ? 'copa' : (catKey === 'PARA COMPARTILHAR' ? 'dark' : 'light'),
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
        'ENTRADAS E ACOMPANHAMENTOS',
        'BURGERS',
        'COPA DO MUNDO',
        'SOBREMESAS',
        'PARA COMPARTILHAR',
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
    'PARA COMPARTILHAR': 'Para Compartilhar',
    'COPA DO MUNDO': 'Copa do Mundo',
    'SOBREMESAS': 'Sobremesas',
  };
  if (fixes[name]) return fixes[name];
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/** Format product name for display — all uppercase as requested */
function formatProductName(name: string): string {
  return name.toUpperCase();
}

/** Group bebidas into subcategories for story generation (same logic as online cardápio) */
function groupBebidasForStory(items: Array<{ id: number; name: string; price: number | null; description: string | null }>) {
  const cervejas: typeof items = [];
  const drinks: typeof items = [];
  const sucos: typeof items = [];
  const aguasRefri: typeof items = [];

  for (const item of items) {
    const nameUpper = item.name.toUpperCase();
    if (
      nameUpper.includes('HEINEKEN') ||
      nameUpper.includes('CORONA') ||
      nameUpper.includes('ORIGINAL 6') ||
      nameUpper.includes('SPATEN') ||
      nameUpper.includes('LAGUNITAS') ||
      nameUpper.includes('BLUE MOON') ||
      nameUpper.includes('STELLA')
    ) {
      cervejas.push(item);
    } else if (nameUpper.includes('SUCO')) {
      sucos.push(item);
    } else if (
      nameUpper.includes('AGUA') || nameUpper.includes('ÁGUA') ||
      nameUpper.includes('COCA') ||
      nameUpper.includes('GUARANA') || nameUpper.includes('GUARANÁ')
    ) {
      aguasRefri.push(item);
    } else {
      // Drinks: Negroni, Aperol Spritz, Gin Tônica, Caipirinha, etc.
      drinks.push(item);
    }
  }

  return { cervejas, drinks, sucos, aguasRefri };
}
