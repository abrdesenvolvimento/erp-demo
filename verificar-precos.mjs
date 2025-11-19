import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar canais
const [channels] = await connection.execute('SELECT id, code, name FROM salesChannels WHERE active = 1');

console.log(`📋 Canais ativos: ${channels.length}\n`);
channels.forEach(ch => console.log(`  - ${ch.code} (${ch.name})`));
console.log();

// Para cada canal, verificar produtos sem preço
for (const channel of channels) {
  const [products] = await connection.execute(`
    SELECT p.id, p.name
    FROM products p
    WHERE p.active = 1
    AND NOT EXISTS (
      SELECT 1 FROM productPrices pp 
      WHERE pp.productId = p.id AND pp.channelId = ?
    )
    LIMIT 10
  `, [channel.id]);
  
  if (products.length > 0) {
    console.log(`⚠️  Canal ${channel.code}: ${products.length} produtos sem preço`);
    products.slice(0, 5).forEach(p => {
      console.log(`   - ID ${p.id}: ${p.name}`);
    });
    if (products.length > 5) {
      console.log(`   ... e mais ${products.length - 5} produtos`);
    }
    console.log();
  } else {
    console.log(`✅ Canal ${channel.code}: Todos os produtos têm preço`);
  }
}

await connection.end();
