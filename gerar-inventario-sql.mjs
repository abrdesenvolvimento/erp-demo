import mysql from 'mysql2/promise';
import fs from 'fs';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const [products] = await connection.execute(`
  SELECT 
    p.id,
    p.name,
    p.categoryId,
    p.subcategoryId,
    p.ean,
    p.uom,
    p.minStock,
    p.currentStock,
    p.avgCost,
    p.isComposite,
    p.active,
    c.name as categoryName,
    s.name as subcategoryName
  FROM products p
  LEFT JOIN categories c ON p.categoryId = c.id
  LEFT JOIN subcategories s ON p.subcategoryId = s.id
  ORDER BY p.name
`);

const csv = ['ID,Nome,Categoria,Subcategoria,EAN,Unidade,Estoque Mínimo,Estoque Atual,Custo Médio,Produto Composto,Ativo'];

products.forEach(p => {
  const row = [
    p.id,
    '"' + (p.name || '').replace(/"/g, '""') + '"',
    '"' + (p.categoryName || '') + '"',
    '"' + (p.subcategoryName || '') + '"',
    p.ean || '',
    p.uom,
    p.minStock || 0,
    p.currentStock || 0,
    p.avgCost || '0.00',
    p.isComposite ? 'Sim' : 'Não',
    p.active ? 'Sim' : 'Não'
  ];
  csv.push(row.join(','));
});

const filename = '/home/ubuntu/inventario-' + new Date().toISOString().split('T')[0] + '.csv';
fs.writeFileSync(filename, csv.join('\n'));

console.log('✅ Total de produtos:', products.length);
console.log('✅ CSV gerado:', filename);

await connection.end();
