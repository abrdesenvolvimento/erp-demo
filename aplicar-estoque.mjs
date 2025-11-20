import mysql from 'mysql2/promise';
import fs from 'fs';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Ler arquivo JSON
const updates = JSON.parse(fs.readFileSync('/home/ubuntu/estoque-updates.json', 'utf8'));

console.log(`🔄 Atualizando estoque de ${updates.length} produtos...\n`);

let success = 0;
let errors = 0;

for (const update of updates) {
  try {
    await connection.execute(
      'UPDATE products SET currentStock = ? WHERE id = ?',
      [update.estoque, update.id]
    );
    success++;
    
    if (success % 20 === 0) {
      console.log(`   Processados: ${success}/${updates.length}`);
    }
  } catch (error) {
    console.error(`❌ Erro ao atualizar produto ${update.id}:`, error.message);
    errors++;
  }
}

console.log(`\n📊 Resultado:`);
console.log(`   ✅ Atualizados: ${success}`);
console.log(`   ❌ Erros: ${errors}`);
console.log(`   📦 Total: ${updates.length}`);

await connection.end();
