import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

const rows = await db.execute(sql`
  SELECT p.id, p.name, p.active, p.availableInSalon, p.companyId,
    c.name as catName, s.name as subName, pp.price, pp.channelId
  FROM products p 
  LEFT JOIN categories c ON p.categoryId = c.id
  LEFT JOIN subcategories s ON p.subcategoryId = s.id
  LEFT JOIN productPrices pp ON pp.productId = p.id
  WHERE p.name LIKE '%GUARAN%'
  ORDER BY p.name
`);

console.log('Guaraná products:');
console.table(rows[0]);

// Also check what SALAO channel ID is for company 2
const channels = await db.execute(sql`
  SELECT id, code, type, name FROM salesChannels WHERE companyId = 2
`);
console.log('\nSales channels for company 2:');
console.table(channels[0]);

process.exit(0);
