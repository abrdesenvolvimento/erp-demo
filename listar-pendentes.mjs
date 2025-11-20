import mysql from 'mysql2/promise';
import fs from 'fs';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('📋 Buscando produtos simples sem estoque atualizado...\n');

// Buscar produtos simples (type = 'SIMPLES') com estoque = 0
const [produtos] = await connection.execute(`
  SELECT 
    p.id,
    p.name,
    p.ean,
    p.unit,
    p.currentStock,
    p.minStock,
    p.avgCost,
    c.name as categoria,
    s.name as subcategoria
  FROM products p
  LEFT JOIN categories c ON p.categoryId = c.id
  LEFT JOIN subcategories s ON p.subcategoryId = s.id
  WHERE p.active = 1 
    AND p.type = 'SIMPLES'
    AND p.currentStock = 0
  ORDER BY c.name, s.name, p.name
`);

console.log(`📊 Total de produtos simples sem estoque: ${produtos.length}\n`);

// Gerar CSV
const csvLines = ['ID,Nome,EAN,Categoria,Subcategoria,Unidade,Estoque Atual,Custo Médio'];

produtos.forEach(p => {
  const linha = [
    p.id,
    `"${p.name}"`,
    p.ean || '',
    `"${p.categoria || ''}"`,
    `"${p.subcategoria || ''}"`,
    p.unit,
    p.currentStock,
    p.avgCost || 0
  ].join(',');
  csvLines.push(linha);
});

const csv = csvLines.join('\n');
fs.writeFileSync('/home/ubuntu/produtos-pendentes-inventario.csv', csv);

console.log('✅ Arquivo gerado: /home/ubuntu/produtos-pendentes-inventario.csv');
console.log(`📦 Total: ${produtos.length} produtos\n`);

// Estatísticas por categoria
const categorias = {};
produtos.forEach(p => {
  const cat = p.categoria || 'Sem Categoria';
  categorias[cat] = (categorias[cat] || 0) + 1;
});

console.log('📊 Distribuição por Categoria:');
Object.entries(categorias)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count} produtos`);
  });

await connection.end();
