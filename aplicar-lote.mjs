import mysql from 'mysql2/promise';
import fs from 'fs';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const updates = JSON.parse(fs.readFileSync('/home/ubuntu/lote-updates.json', 'utf8'));

console.log(`🔄 Atualizando ${updates.length} produtos...\n`);

let success = 0;
let errors = 0;

for (const update of updates) {
  try {
    await connection.execute(
      'UPDATE products SET currentStock = ? WHERE id = ?',
      [update.estoque, update.id]
    );
    success++;
    if (success <= 10 || success % 10 === 0) {
      console.log(`✅ [${success}/${updates.length}] ID ${update.id} → ${update.estoque} unidades`);
    }
  } catch (error) {
    console.error(`❌ Erro ID ${update.id}:`, error.message);
    errors++;
  }
}

console.log(`\n📊 Resultado Final:`);
console.log(`   ✅ Atualizados: ${success}`);
console.log(`   ❌ Erros: ${errors}`);

await connection.end();
