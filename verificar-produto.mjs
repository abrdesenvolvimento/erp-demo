import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('🔍 Verificando produto 510003:\n');

// Buscar por ID exato
const [byId] = await connection.execute(
  'SELECT id, name, currentStock FROM products WHERE id = ?',
  [510003]
);

if (byId.length > 0) {
  console.log('✅ Produto encontrado por ID 510003:');
  console.log(`   Nome: ${byId[0].name}`);
  console.log(`   Estoque atual: ${byId[0].currentStock}`);
} else {
  console.log('❌ Produto NÃO encontrado com ID 510003');
}

// Buscar Heineken 250ml
const [byName] = await connection.execute(
  'SELECT id, name, currentStock FROM products WHERE name LIKE ?',
  ['%Heineken 250%']
);

console.log(`\n🔍 Produtos Heineken 250ml no banco:`);
byName.forEach(p => {
  console.log(`   ID ${p.id}: ${p.name} → Estoque: ${p.currentStock}`);
});

await connection.end();
