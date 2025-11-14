import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar ID da categoria Bebidas
const [categories] = await connection.execute('SELECT id FROM categories WHERE name = ?', ['Bebidas']);
const bebidasId = categories[0]?.id || 1;

console.log(`📝 Usando categoria Bebidas (ID: ${bebidasId})`);

const subcategories = [
  'Aluminio', 'Amendoim', 'Bala', 'Bebida Mista', 'Bitter', 'Cachaça',
  'Carvão', 'Cerveja', 'Chiclete', 'Chocolate', 'Cigarro', 'Copo',
  'Coquetel', 'Dose Whisky', 'Energetico', 'Essência', 'Gelo de Sabor',
  'Licor', 'Piteira', 'Refrigerante', 'Salgadinho', 'Seda', 'Suco',
  'Tabaco', 'Vinho', 'Whisky', 'Água', 'Água de Coco'
];

console.log(`\n📝 Criando ${subcategories.length} subcategorias...`);

let created = 0;
for (const name of subcategories) {
  try {
    await connection.execute(
      'INSERT INTO subcategories (name, categoryId) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = name',
      [name, bebidasId]
    );
    created++;
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ Erro ao criar subcategoria "${name}":`, error.message);
  }
}

// Verificar quantas foram criadas
const [result] = await connection.execute('SELECT COUNT(*) as count FROM subcategories');
console.log(`\n✅ Total de subcategorias criadas: ${created}`);
console.log(`✅ Total de subcategorias no banco: ${result[0].count}`);

await connection.end();
process.exit(0);
