import mysql2 from 'mysql2/promise';
import { writeFileSync } from 'fs';

const connection = await mysql2.createConnection(process.env.DATABASE_URL);

const [rows] = await connection.execute(`
  SELECT 
    p.id,
    p.name,
    c.name as categoria,
    p.currentStock,
    p.minStock,
    p.avgCost,
    ROUND(p.currentStock * p.avgCost, 2) as valorEstoque,
    p.active,
    p.isComposite
  FROM products p
  LEFT JOIN categories c ON p.categoryId = c.id
  WHERE p.active = true 
    AND p.isComposite = false
  ORDER BY c.name, p.name
`);

writeFileSync('/home/ubuntu/inventario-completo.json', JSON.stringify(rows, null, 2));
console.log(`✅ ${rows.length} produtos exportados`);

await connection.end();
process.exit(0);
