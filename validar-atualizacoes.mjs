import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('🔍 Validando atualizações...\n');

// Amostra de 5 produtos
const testIds = [390001, 420002, 420004, 2250007, 2250010];

for (const id of testIds) {
  const [product] = await connection.execute(
    'SELECT id, name, avgCost FROM products WHERE id = ?',
    [id]
  );
  
  if (product.length > 0) {
    const p = product[0];
    console.log(`📦 ID ${p.id}: ${p.name}`);
    console.log(`   Custo: R$ ${parseFloat(p.avgCost).toFixed(2)}`);
    
    const [prices] = await connection.execute(
      `SELECT sc.code, pp.price 
       FROM productPrices pp 
       JOIN salesChannels sc ON pp.channelId = sc.id 
       WHERE pp.productId = ?`,
      [id]
    );
    
    prices.forEach(pr => {
      console.log(`   ${pr.code}: R$ ${parseFloat(pr.price).toFixed(2)}`);
    });
    console.log();
  }
}

// Estatísticas gerais
const [stats] = await connection.execute(`
  SELECT 
    COUNT(DISTINCT p.id) as total_produtos,
    COUNT(DISTINCT CASE WHEN p.avgCost > 0 THEN p.id END) as com_custo,
    COUNT(DISTINCT pp.productId) as com_preco
  FROM products p
  LEFT JOIN productPrices pp ON p.id = pp.productId
  WHERE p.active = 1
`);

console.log('📊 Estatísticas Gerais:');
console.log(`   Total de produtos ativos: ${stats[0].total_produtos}`);
console.log(`   Produtos com custo: ${stats[0].com_custo}`);
console.log(`   Produtos com preço: ${stats[0].com_preco}`);

await connection.end();
