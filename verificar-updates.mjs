import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Verificar subcategorias dos 3 produtos
console.log('📋 1. VERIFICAÇÃO DE SUBCATEGORIAS:\n');
const ids = [2010003, 3060013, 3510002];

for (const id of ids) {
  const [products] = await connection.execute(`
    SELECT id, name, subcategory FROM products WHERE id = ?
  `, [id]);
  
  if (products.length > 0) {
    const p = products[0];
    console.log(`✓ ID ${p.id}: ${p.name}`);
    console.log(`  Subcategoria: ${p.subcategory || '⚠️  AINDA SEM SUBCATEGORIA'}\n`);
  }
}

// 2. Verificar produtos compostos e seus custos
console.log('\n📦 2. VERIFICAÇÃO DE PRODUTOS COMPOSTOS:\n');

const [composites] = await connection.execute(`
  SELECT DISTINCT p.id, p.name, p.avgCost, p.isComposite
  FROM products p
  WHERE p.isComposite = 1 AND p.active = 1
  LIMIT 10
`);

console.log(`Total de produtos compostos ativos: ${composites.length}\n`);

for (const comp of composites.slice(0, 5)) {
  console.log(`📦 ${comp.name} (ID: ${comp.id})`);
  console.log(`   Custo atual: R$ ${parseFloat(comp.avgCost || 0).toFixed(2)}`);
  
  // Buscar composições (nomes corretos: parentProductId e childProductId)
  const [compositions] = await connection.execute(`
    SELECT pc.quantity, p.name as componentName, p.avgCost as componentCost
    FROM productCompositions pc
    JOIN products p ON pc.childProductId = p.id
    WHERE pc.parentProductId = ?
  `, [comp.id]);
  
  if (compositions.length > 0) {
    let calculatedCost = 0;
    console.log('   Componentes:');
    compositions.forEach(c => {
      const itemCost = parseFloat(c.quantity) * parseFloat(c.componentCost || 0);
      calculatedCost += itemCost;
      console.log(`     - ${c.quantity}x ${c.componentName} (R$ ${parseFloat(c.componentCost || 0).toFixed(2)}) = R$ ${itemCost.toFixed(2)}`);
    });
    console.log(`   Custo calculado: R$ ${calculatedCost.toFixed(2)}`);
    
    const currentCost = parseFloat(comp.avgCost || 0);
    if (Math.abs(currentCost - calculatedCost) > 0.01) {
      console.log(`   ⚠️  DIFERENÇA: R$ ${(currentCost - calculatedCost).toFixed(2)}`);
    } else {
      console.log(`   ✅ Custo correto!`);
    }
  }
  console.log();
}

await connection.end();
