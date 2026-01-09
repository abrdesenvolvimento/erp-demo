import { drizzle } from 'drizzle-orm/mysql2';
import { products } from './drizzle/schema.ts';
import { like, or } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

const result = await db.select({
  id: products.id,
  name: products.name,
  currentStock: products.currentStock,
  expirationDate: products.expirationDate,
  active: products.active
})
.from(products)
.where(or(
  like(products.name, '%Kaut%'),
  like(products.name, '%Pepsi Black%')
));

console.log('Produtos encontrados:');
result.forEach(r => {
  console.log(`- ${r.name}: estoque=${r.currentStock}, vencimento=${r.expirationDate}, ativo=${r.active}`);
});

process.exit(0);
