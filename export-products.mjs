import { drizzle } from 'drizzle-orm/mysql2';
import { products, categories, subcategories } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';
import { writeFileSync } from 'fs';

const db = drizzle(process.env.DATABASE_URL);

// Buscar todos os produtos
const allProducts = await db.select().from(products);

// Buscar categorias e subcategorias
const allCategories = await db.select().from(categories);
const allSubcategories = await db.select().from(subcategories);

// Mapear IDs para nomes
const categoryMap = Object.fromEntries(allCategories.map(c => [c.id, c.name]));
const subcategoryMap = Object.fromEntries(allSubcategories.map(s => [s.id, s.name]));

// Gerar CSV
const csvLines = [
  'ID,Nome,EAN,Unidade,Categoria,Subcategoria,Estoque Atual,Estoque Mínimo,Custo Médio,Produto Composto,Ativo'
];

for (const p of allProducts) {
  const category = p.categoryId ? categoryMap[p.categoryId] || '' : '';
  const subcategory = p.subcategoryId ? subcategoryMap[p.subcategoryId] || '' : '';
  const avgCost = p.avgCost ? parseFloat(p.avgCost).toFixed(2) : '0.00';
  
  csvLines.push([
    p.id,
    `"${p.name.replace(/"/g, '""')}"`,
    p.ean || '',
    p.uom,
    `"${category}"`,
    `"${subcategory}"`,
    p.currentStock || 0,
    p.minStock || 0,
    avgCost,
    p.isComposite ? 'Sim' : 'Não',
    p.active ? 'Sim' : 'Não'
  ].join(','));
}

writeFileSync('/home/ubuntu/produtos_atualizados.csv', csvLines.join('\n'), 'utf-8');

console.log(`✅ Exportados ${allProducts.length} produtos para produtos_atualizados.csv`);
process.exit(0);
