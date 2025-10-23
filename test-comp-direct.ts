import { getDb } from './server/db';

async function test() {
  const db = await getDb();
  if (!db) {
    console.log('Database not available');
    return;
  }
  
  console.log('=== TESTE DE COMPOSIÇÕES ===\n');
  
  // Verificar produto Dose Dober
  const [dober] = await db.execute('SELECT * FROM products WHERE name LIKE "%Dober%"');
  console.log('Produto Dose Dober:', dober);
  
  // Verificar composições
  const [comps] = await db.execute('SELECT * FROM productCompositions WHERE parentProductId = 240006');
  console.log('\nComposições do Dose Dober:', comps);
}

test();
