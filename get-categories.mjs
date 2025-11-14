import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [categories] = await connection.execute('SELECT id, name FROM categories ORDER BY name');

console.log('📋 Categorias disponíveis:');
for (const cat of categories) {
  console.log(`  ${cat.id}: ${cat.name}`);
}

await connection.end();
process.exit(0);
