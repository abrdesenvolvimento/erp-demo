import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('✅ VALIDAÇÃO FINAL:\n');

// 1. Verificar produto 510003 (Heineken 250ml)
const [heineken] = await connection.execute(
  'SELECT id, name, currentStock FROM products WHERE id = 510003'
);

console.log('🔍 Produto 510003 (Heineken 250ml):');
if (heineken.length > 0) {
  console.log(`   Estoque: ${heineken[0].currentStock} unidades`);
  console.log(`   Status: ${heineken[0].currentStock === 33 ? '✅ CORRETO' : '❌ INCORRETO'}\n`);
}

// 2. Estatísticas gerais
const [stats] = await connection.execute(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN currentStock > 0 THEN 1 ELSE 0 END) as com_estoque,
    SUM(CASE WHEN currentStock = 0 THEN 1 ELSE 0 END) as zerados,
    SUM(CASE WHEN currentStock < 0 THEN 1 ELSE 0 END) as negativos,
    SUM(currentStock) as estoque_total
  FROM products
  WHERE active = 1
`);

const s = stats[0];
console.log('📊 Estatísticas Gerais:');
console.log(`   Total de produtos ativos: ${s.total}`);
console.log(`   Produtos com estoque: ${s.com_estoque} (${(s.com_estoque/s.total*100).toFixed(1)}%)`);
console.log(`   Produtos zerados: ${s.zerados} (${(s.zerados/s.total*100).toFixed(1)}%)`);
console.log(`   Produtos negativos: ${s.negativos}`);
console.log(`   Estoque total: ${s.estoque_total} unidades`);

await connection.end();
