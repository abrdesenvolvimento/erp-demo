import mysql2 from 'mysql2/promise';
import { writeFileSync } from 'fs';

const connection = await mysql2.createConnection(process.env.DATABASE_URL);

// Buscar produtos com preços por canal (corrigido GROUP BY)
const [rows] = await connection.execute(`
  SELECT 
    p.id,
    p.name,
    c.name as categoria,
    p.ean,
    p.uom,
    p.currentStock,
    p.minStock,
    p.avgCost,
    ROUND(p.currentStock * p.avgCost, 2) as valorEstoque,
    p.active,
    p.isComposite,
    p.expirationDate,
    GROUP_CONCAT(
      CONCAT(pp.channelType, ':', pp.price)
      SEPARATOR '|'
    ) as precosPorCanal
  FROM products p
  LEFT JOIN categories c ON p.categoryId = c.id
  LEFT JOIN productPrices pp ON p.id = pp.productId
  WHERE p.active = true 
    AND p.isComposite = false
  GROUP BY p.id, p.name, c.name, p.ean, p.uom, p.currentStock, p.minStock, p.avgCost, p.active, p.isComposite, p.expirationDate
  ORDER BY c.name, p.name
`);

writeFileSync('/home/ubuntu/inventario-full.json', JSON.stringify(rows, null, 2));
console.log(`✅ ${rows.length} produtos exportados`);

await connection.end();
process.exit(0);
