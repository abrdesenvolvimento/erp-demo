import { getDb } from './server/db.ts';
import { productCompositions, products } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = await getDb();

// Find Dose Gin Dober product
const doseProduct = await db.select().from(products).where(eq(products.name, 'Dose Gin Dober')).limit(1);

if (doseProduct.length === 0) {
  console.log('Dose Gin Dober not found!');
  process.exit(1);
}

console.log('Dose Gin Dober ID:', doseProduct[0].id);

// Get compositions
const compositions = await db.select().from(productCompositions).where(eq(productCompositions.parentProductId, doseProduct[0].id));

console.log('\nCompositions:');
for (const comp of compositions) {
  const component = await db.select().from(products).where(eq(products.id, comp.childProductId)).limit(1);
  console.log(`- ${component[0].name}: quantity = ${comp.quantity} (type: ${typeof comp.quantity})`);
}

process.exit(0);
