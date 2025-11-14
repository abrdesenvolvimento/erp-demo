import { drizzle } from 'drizzle-orm/mysql2';
import { products, categories, subcategories } from './drizzle/schema.ts';
import { writeFileSync } from 'fs';

const db = drizzle(process.env.DATABASE_URL);

// Buscar produtos com JOINs
const result = await db
  .select({
    id: products.id,
    name: products.name,
    ean: products.ean,
    uom: products.uom,
    categoryName: categories.name,
    subcategoryName: subcategories.name,
    currentStock: products.currentStock,
    minStock: products.minStock,
    avgCost: products.avgCost,
    isComposite: products.isComposite,
    active: products.active
  })
  .from(products)
  .leftJoin(categories, products.categoryId.eq(categories.id))
  .leftJoin(subcategories, products.subcategoryId.eq(subcategories.id))
  .orderBy(products.id);

// Gerar CSV
const csvLines = [
  'ID,Nome,EAN,Unidade,Categoria,Subcategoria,Estoque Atual,Estoque Mínimo,Custo Médio,Produto Composto,Ativo'
];

for (const p of result) {
  const avgCost = p.avgCost ? parseFloat(p.avgCost).toFixed(2) : '0.00';
  
  csvLines.push([
    p.id,
    `"${p.name.replace(/"/g, '""')}"`,
    p.ean || '',
    p.uom,
    `"${p.categoryName || ''}"`,
    `"${p.subcategoryName || ''}"`,
    p.currentStock || 0,
    p.minStock || 0,
    avgCost,
    p.isComposite ? 'Sim' : 'Não',
    p.active ? 'Sim' : 'Não'
  ].join(','));
}

writeFileSync('/home/ubuntu/produtos_atualizados.csv', csvLines.join('\n'), 'utf-8');

console.log(`✅ Exportados ${result.length} produtos com subcategorias para produtos_atualizados.csv`);
process.exit(0);
