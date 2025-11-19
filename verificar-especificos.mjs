import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const ids = [420003, 420005, 450002]; // Petra 350ml, Petra 269ml, Amstel 269ml

console.log('🔍 Verificando produtos que tinham diferenças:\n');

for (const id of ids) {
  const [products] = await connection.execute(`
    SELECT id, name, avgCost FROM products WHERE id = ?
  `, [id]);
  
  if (products.length > 0) {
    const p = products[0];
    console.log(`📦 ${p.name} (ID: ${p.id})`);
    console.log(`   Custo atual: R$ ${parseFloat(p.avgCost).toFixed(2)}`);
    
    // Buscar composições
    const [compositions] = await connection.execute(`
      SELECT pc.quantity, pr.name, pr.avgCost
      FROM productCompositions pc
      JOIN products pr ON pc.childProductId = pr.id
      WHERE pc.parentProductId = ?
    `, [id]);
    
    let calculatedCost = 0;
    console.log('   Componentes:');
    compositions.forEach(c => {
      const itemCost = parseFloat(c.quantity) * parseFloat(c.avgCost);
      calculatedCost += itemCost;
      console.log(`     - ${c.quantity}x ${c.name} (R$ ${parseFloat(c.avgCost).toFixed(2)}) = R$ ${itemCost.toFixed(2)}`);
    });
    
    console.log(`   Custo calculado: R$ ${calculatedCost.toFixed(2)}`);
    const diff = parseFloat(p.avgCost) - calculatedCost;
    console.log(`   Diferença: R$ ${diff.toFixed(2)}\n`);
  }
}

await connection.end();
