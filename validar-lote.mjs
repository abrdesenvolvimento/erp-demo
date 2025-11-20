import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('✅ VALIDAÇÃO DO LOTE:\n');

// Estatísticas gerais
const [stats] = await connection.execute(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN currentStock > 0 THEN 1 ELSE 0 END) as com_estoque,
    SUM(CASE WHEN currentStock = 0 THEN 1 ELSE 0 END) as zerados,
    SUM(currentStock) as estoque_total
  FROM products
  WHERE active = 1 AND isComposite = 0
`);

const s = stats[0];
console.log('📊 Estatísticas Finais (Produtos Simples):');
console.log(`   Total de produtos ativos: ${s.total}`);
console.log(`   Produtos com estoque: ${s.com_estoque} (${(s.com_estoque/s.total*100).toFixed(1)}%)`);
console.log(`   Produtos zerados: ${s.zerados} (${(s.zerados/s.total*100).toFixed(1)}%)`);
console.log(`   Estoque total: ${s.estoque_total} unidades\n`);

// Progresso do inventário
const produtos_atualizados = s.com_estoque;
const produtos_pendentes = s.zerados;
const percentual_completo = (produtos_atualizados / s.total * 100).toFixed(1);

console.log('📦 Progresso do Inventário:');
console.log(`   Produtos com estoque atualizado: ${produtos_atualizados} (${percentual_completo}%)`);
console.log(`   Produtos pendentes: ${produtos_pendentes}`);

await connection.end();
