import { drizzle } from 'drizzle-orm/mysql2';
import mysql2 from 'mysql2/promise';
import { writeFileSync } from 'fs';

const connection = await mysql2.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const [rows] = await connection.execute(`
  SELECT p.id, p.name, c.name as categoria, p.currentStock, p.minStock
  FROM products p
  LEFT JOIN categories c ON p.categoryId = c.id
  WHERE p.active = true 
    AND p.isComposite = false 
    AND (p.currentStock IS NULL OR p.currentStock = 0)
  ORDER BY c.name, p.name
`);

writeFileSync('/home/ubuntu/produtos-pendentes.json', JSON.stringify(rows, null, 2));
console.log(`✅ ${rows.length} produtos exportados`);
console.log(`📁 /home/ubuntu/produtos-pendentes.json`);

await connection.end();
process.exit(0);
