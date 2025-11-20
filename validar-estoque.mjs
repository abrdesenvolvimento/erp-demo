import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('✅ VALIDAÇÃO DE ESTOQUE:\n');

// 1. Estatísticas gerais
const [stats] = await connection.execute(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN currentStock > 0 THEN 1 ELSE 0 END) as com_estoque,
    SUM(CASE WHEN currentStock = 0 THEN 1 ELSE 0 END) as zerados,
    SUM(currentStock) as estoque_total
  FROM products
  WHERE active = 1
`);

const s = stats[0];
console.log('📊 Estatísticas Gerais:');
console.log(`   Total de produtos ativos: ${s.total}`);
console.log(`   Produtos com estoque: ${s.com_estoque} (${(s.com_estoque/s.total*100).toFixed(1)}%)`);
console.log(`   Produtos zerados: ${s.zerados} (${(s.zerados/s.total*100).toFixed(1)}%)`);
console.log(`   Estoque total: ${s.estoque_total} unidades\n`);

// 2. Validar alguns produtos atualizados
console.log('🔍 Amostra de Produtos Atualizados:\n');

const [samples] = await connection.execute(`
  SELECT id, name, currentStock
  FROM products
  WHERE id IN (2010001, 2010002, 2010004, 2010006, 2010007)
  ORDER BY id
`);

samples.forEach(p => {
  console.log(`   ✓ ID ${p.id}: ${p.name} → ${p.currentStock} unidades`);
});

await connection.end();
