import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('🔄 Recalculando custos de produtos compostos...\n');

// Buscar todos os produtos compostos ativos
const [composites] = await connection.execute(`
  SELECT id, name, avgCost
  FROM products
  WHERE isComposite = 1 AND active = 1
`);

console.log(`Total de produtos compostos: ${composites.length}\n`);

let updated = 0;
let errors = 0;
let unchanged = 0;

for (const comp of composites) {
  // Buscar composições
  const [compositions] = await connection.execute(`
    SELECT pc.quantity, p.avgCost as componentCost
    FROM productCompositions pc
    JOIN products p ON pc.childProductId = p.id
    WHERE pc.parentProductId = ?
  `, [comp.id]);
  
  if (compositions.length === 0) {
    console.log(`⚠️  ${comp.name} (ID: ${comp.id}) - Sem composições definidas`);
    errors++;
    continue;
  }
  
  // Calcular custo total
  let calculatedCost = 0;
  for (const c of compositions) {
    calculatedCost += parseFloat(c.quantity) * parseFloat(c.componentCost || 0);
  }
  
  const currentCost = parseFloat(comp.avgCost || 0);
  const difference = Math.abs(currentCost - calculatedCost);
  
  if (difference > 0.01) {
    // Atualizar custo
    await connection.execute(`
      UPDATE products SET avgCost = ? WHERE id = ?
    `, [calculatedCost.toFixed(2), comp.id]);
    
    console.log(`✅ ${comp.name} (ID: ${comp.id})`);
    console.log(`   Antes: R$ ${currentCost.toFixed(2)} → Depois: R$ ${calculatedCost.toFixed(2)}`);
    updated++;
  } else {
    unchanged++;
  }
}

console.log(`\n📊 Resumo:`);
console.log(`   ✅ Atualizados: ${updated}`);
console.log(`   ⚠️  Erros: ${errors}`);
console.log(`   ➖ Sem alteração: ${unchanged}`);
console.log(`   📦 Total: ${composites.length}`);

await connection.end();
