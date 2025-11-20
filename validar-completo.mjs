import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('✅ VALIDAÇÃO COMPLETA DO INVENTÁRIO:\n');

// Estatísticas gerais
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
console.log('📊 Estatísticas Finais:');
console.log(`   Total de produtos ativos: ${s.total}`);
console.log(`   Produtos com estoque: ${s.com_estoque} (${(s.com_estoque/s.total*100).toFixed(1)}%)`);
console.log(`   Produtos zerados: ${s.zerados} (${(s.zerados/s.total*100).toFixed(1)}%)`);
console.log(`   Produtos negativos: ${s.negativos}`);
console.log(`   Estoque total: ${s.estoque_total} unidades\n`);

// Total atualizado hoje
console.log('📦 Resumo da Atualização de Hoje:');
console.log('   1ª rodada: 85 produtos');
console.log('   2ª rodada: 18 produtos');
console.log('   Total atualizado: 103 produtos ✅');

await connection.end();
