import mysql from 'mysql2/promise';
import fs from 'fs';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Ler JSON
const updates = JSON.parse(fs.readFileSync('/home/ubuntu/updates-custos-precos.json', 'utf8'));

console.log(`💰 Atualizando custos de ${updates.length} produtos...`);
console.log();

let success = 0;
let errors = 0;
let skipped = 0;

for (const update of updates) {
  if (!update.custo) {
    skipped++;
    continue;
  }
  
  try {
    await connection.execute(
      'UPDATE products SET avgCost = ? WHERE id = ?',
      [update.custo, update.id]
    );
    success++;
    if (success % 100 === 0) {
      console.log(`✅ ${success} custos atualizados...`);
    }
  } catch (error) {
    errors++;
    console.error(`❌ Erro ao atualizar produto ${update.id}: ${error.message}`);
  }
}

console.log();
console.log('═══════════════════════════════════');
console.log(`✅ Custos atualizados: ${success}`);
console.log(`⚠️  Produtos sem custo (ignorados): ${skipped}`);
console.log(`❌ Erros: ${errors}`);
console.log('═══════════════════════════════════');

await connection.end();
