import { drizzle } from 'drizzle-orm/mysql2';
import { products } from './drizzle/schema.ts';
import { and, isNotNull, lte, eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

// Buscar todos os produtos com vencimento próximo (30 dias)
const today = new Date();
const thirtyDaysFromNow = new Date();
thirtyDaysFromNow.setDate(today.getDate() + 30);

const result = await db.select({
  id: products.id,
  name: products.name,
  currentStock: products.currentStock,
  expirationDate: products.expirationDate,
  active: products.active
})
.from(products)
.where(and(
  eq(products.active, true),
  isNotNull(products.expirationDate),
  lte(products.expirationDate, thirtyDaysFromNow)
));

console.log('Produtos com vencimento próximo (30 dias):');
console.log('Total:', result.length);
console.log('');
result.forEach(r => {
  const stock = parseFloat(r.currentStock?.toString() || '0');
  const expDate = new Date(r.expirationDate);
  const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`- ${r.name}: estoque=${stock}, vencimento=${expDate.toLocaleDateString('pt-BR')}, dias=${daysUntil}`);
});

process.exit(0);
