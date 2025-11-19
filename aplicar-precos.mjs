import mysql from 'mysql2/promise';
import fs from 'fs';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Ler JSON
const updates = JSON.parse(fs.readFileSync('/home/ubuntu/updates-custos-precos.json', 'utf8'));

// Buscar IDs dos canais
const [channels] = await connection.execute('SELECT id, code FROM salesChannels');
const channelMap = {};
channels.forEach(ch => {
  channelMap[ch.code] = ch.id;
});

console.log('📋 Canais encontrados:', Object.keys(channelMap));
console.log();

console.log(`💵 Atualizando preços de ${updates.length} produtos...`);
console.log();

let stats = {
  balcao: 0,
  aprazo: 0,
  ifood: 0,
  food99: 0,
  aiqfome: 0,
  errors: 0
};

for (const update of updates) {
  const productId = update.id;
  
  // Balcão
  if (update.balcao && channelMap['BALCAO']) {
    try {
      await connection.execute(
        'INSERT INTO productPrices (productId, channelId, price) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE price = ?',
        [productId, channelMap['BALCAO'], update.balcao, update.balcao]
      );
      stats.balcao++;
    } catch (error) {
      stats.errors++;
      console.error(`❌ Erro Balcão produto ${productId}: ${error.message}`);
    }
  }
  
  // A Prazo (mesmo valor do Balcão)
  if (update.balcao && channelMap['A_PRAZO']) {
    try {
      await connection.execute(
        'INSERT INTO productPrices (productId, channelId, price) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE price = ?',
        [productId, channelMap['A_PRAZO'], update.balcao, update.balcao]
      );
      stats.aprazo++;
    } catch (error) {
      stats.errors++;
      console.error(`❌ Erro A Prazo produto ${productId}: ${error.message}`);
    }
  }
  
  // iFood
  if (update.delivery && channelMap['IFOOD']) {
    try {
      await connection.execute(
        'INSERT INTO productPrices (productId, channelId, price) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE price = ?',
        [productId, channelMap['IFOOD'], update.delivery, update.delivery]
      );
      stats.ifood++;
    } catch (error) {
      stats.errors++;
      console.error(`❌ Erro iFood produto ${productId}: ${error.message}`);
    }
  }
  
  // 99Food (mesmo valor do iFood)
  if (update.delivery && channelMap['99FOOD']) {
    try {
      await connection.execute(
        'INSERT INTO productPrices (productId, channelId, price) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE price = ?',
        [productId, channelMap['99FOOD'], update.delivery, update.delivery]
      );
      stats.food99++;
    } catch (error) {
      stats.errors++;
      console.error(`❌ Erro 99Food produto ${productId}: ${error.message}`);
    }
  }
  
  // Aiqfome (mesmo valor do iFood)
  if (update.delivery && channelMap['AIQFOME']) {
    try {
      await connection.execute(
        'INSERT INTO productPrices (productId, channelId, price) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE price = ?',
        [productId, channelMap['AIQFOME'], update.delivery, update.delivery]
      );
      stats.aiqfome++;
    } catch (error) {
      stats.errors++;
      console.error(`❌ Erro Aiqfome produto ${productId}: ${error.message}`);
    }
  }
  
  if ((stats.balcao + stats.aprazo + stats.ifood + stats.food99 + stats.aiqfome) % 500 === 0) {
    console.log(`✅ ${stats.balcao + stats.aprazo + stats.ifood + stats.food99 + stats.aiqfome} preços atualizados...`);
  }
}

console.log();
console.log('═══════════════════════════════════');
console.log(`✅ Balcão: ${stats.balcao} preços`);
console.log(`✅ A Prazo: ${stats.aprazo} preços`);
console.log(`✅ iFood: ${stats.ifood} preços`);
console.log(`✅ 99Food: ${stats.food99} preços`);
console.log(`✅ Aiqfome: ${stats.aiqfome} preços`);
console.log(`❌ Erros: ${stats.errors}`);
console.log('═══════════════════════════════════');

await connection.end();
