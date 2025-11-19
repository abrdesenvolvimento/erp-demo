import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar produtos sem custo (ou custo zero)
const [products] = await connection.execute(`
  SELECT id, name, subcategory, avgCost
  FROM products
  WHERE active = 1 AND (avgCost IS NULL OR avgCost = 0)
  ORDER BY name
`);

console.log(`📋 Produtos sem custo atualizado: ${products.length}\n`);

if (products.length > 0) {
  console.log('ID\t\tNome\t\t\t\t\tSubcategoria');
  console.log('─'.repeat(80));
  
  products.forEach(p => {
    const name = p.name.length > 35 ? p.name.substring(0, 32) + '...' : p.name.padEnd(35);
    const subcat = (p.subcategory || 'N/A').padEnd(20);
    console.log(`${p.id}\t\t${name}\t${subcat}`);
  });
}

await connection.end();
