import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('✅ VERIFICAÇÃO FINAL:\n');

// 1. Subcategorias
console.log('📋 1. Subcategorias corrigidas:\n');
const ids = [3060013, 3510002];

for (const id of ids) {
  const [products] = await connection.execute(`
    SELECT id, name, subcategory FROM products WHERE id = ?
  `, [id]);
  
  if (products.length > 0) {
    const p = products[0];
    console.log(`✓ ID ${p.id}: ${p.name}`);
    console.log(`  Subcategoria: ${p.subcategory}\n`);
  }
}

// 2. Produtos compostos
console.log('\n📦 2. Status dos produtos compostos:\n');

const [composites] = await connection.execute(`
  SELECT id, name, avgCost
  FROM products
  WHERE isComposite = 1 AND active = 1
  LIMIT 5
`);

for (const comp of composites) {
  const [compositions] = await connection.execute(`
    SELECT pc.quantity, p.avgCost
    FROM productCompositions pc
    JOIN products p ON pc.childProductId = p.id
    WHERE pc.parentProductId = ?
  `, [comp.id]);
  
  let calculatedCost = 0;
  compositions.forEach(c => {
    calculatedCost += parseFloat(c.quantity) * parseFloat(c.avgCost || 0);
  });
  
  const currentCost = parseFloat(comp.avgCost || 0);
  const diff = Math.abs(currentCost - calculatedCost);
  
  if (diff < 0.01) {
    console.log(`✅ ${comp.name} - Custo correto (R$ ${currentCost.toFixed(2)})`);
  } else {
    console.log(`⚠️  ${comp.name} - Diferença: R$ ${diff.toFixed(2)}`);
  }
}

await connection.end();
