import { drizzle } from 'drizzle-orm/mysql2';
import { products } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'fs';

const db = drizzle(process.env.DATABASE_URL);
const updates = JSON.parse(readFileSync('/home/ubuntu/lote-updates.json', 'utf-8'));

console.log(`🔄 Aplicando ${updates.length} atualizações...`);

let success = 0;
let errors = 0;

for (const update of updates) {
  try {
    await db.update(products)
      .set({ currentStock: update.estoque })
      .where(eq(products.id, update.id));
    success++;
    console.log(`✅ ${update.id} → ${update.estoque}`);
  } catch (err) {
    errors++;
    console.error(`❌ Erro no produto ${update.id}:`, err.message);
  }
}

console.log(`\n📊 Resultado:`);
console.log(`   ✅ Sucesso: ${success}`);
console.log(`   ❌ Erros: ${errors}`);
process.exit(0);
