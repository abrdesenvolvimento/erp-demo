import mysql from 'mysql2/promise';
import { writeFileSync } from 'fs';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await connection.execute(`
  SELECT 
    p.id,
    p.name,
    p.ean,
    p.uom,
    c.name as categoryName,
    sc.name as subcategoryName,
    p.currentStock,
    p.minStock,
    p.avgCost,
    p.isComposite,
    p.active
  FROM products p
  LEFT JOIN categories c ON p.categoryId = c.id
  LEFT JOIN subcategories sc ON p.subcategoryId = sc.id
  ORDER BY p.id ASC
`);

const csvLines = [
  'ID,Nome,EAN,Unidade,Categoria,Subcategoria,Estoque Atual,Estoque Mínimo,Custo Médio,Produto Composto,Ativo'
];

for (const p of rows) {
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

await connection.end();

console.log(`✅ Exportados ${rows.length} produtos com subcategorias`);
process.exit(0);
