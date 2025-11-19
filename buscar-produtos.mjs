import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const ids = [2010003, 3060013, 3510002];

console.log('📦 Informações dos Produtos:\n');

for (const id of ids) {
  const [products] = await connection.execute(`
    SELECT p.id, p.name, p.subcategory, c.name as categoryName, p.avgCost, p.currentStock
    FROM products p
    LEFT JOIN categories c ON p.categoryId = c.id
    WHERE p.id = ?
  `, [id]);
  
  if (products.length > 0) {
    const p = products[0];
    console.log(`ID: ${p.id}`);
    console.log(`Nome: ${p.name}`);
    console.log(`Categoria: ${p.categoryName}`);
    console.log(`Subcategoria: ${p.subcategory || 'N/A'}`);
    console.log(`Custo Médio: R$ ${parseFloat(p.avgCost).toFixed(2)}`);
    console.log(`Estoque: ${p.currentStock} unidades`);
    
    // Buscar preços
    const [prices] = await connection.execute(`
      SELECT sc.code, sc.name, pp.price
      FROM productPrices pp
      JOIN salesChannels sc ON pp.channelId = sc.id
      WHERE pp.productId = ?
    `, [id]);
    
    if (prices.length > 0) {
      console.log('Preços:');
      prices.forEach(pr => {
        console.log(`  - ${pr.name}: R$ ${parseFloat(pr.price).toFixed(2)}`);
      });
    } else {
      console.log('⚠️  SEM PREÇOS CADASTRADOS');
    }
    
    console.log('\n' + '─'.repeat(60) + '\n');
  } else {
    console.log(`❌ Produto ID ${id} não encontrado\n`);
  }
}

await connection.end();
