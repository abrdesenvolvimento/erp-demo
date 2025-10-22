import { getDb } from './server/db.ts';
import { productCompositions, products } from './drizzle/schema.ts';
import { eq, and } from 'drizzle-orm';

const db = await getDb();

// Find Dose Gin Dober
const dose = await db.select().from(products).where(eq(products.name, 'Dose Gin Dober')).limit(1);
console.log('Dose ID:', dose[0].id);

// Find Gin Dober
const gin = await db.select().from(products).where(eq(products.name, 'Gin Dober 750ml')).limit(1);
console.log('Gin ID:', gin[0].id);

// Update composition
await db.update(productCompositions)
  .set({ quantity: '0.2' })
  .where(and(
    eq(productCompositions.parentProductId, dose[0].id),
    eq(productCompositions.childProductId, gin[0].id)
  ));

console.log('Updated!');

// Verify
const comp = await db.select().from(productCompositions)
  .where(and(
    eq(productCompositions.parentProductId, dose[0].id),
    eq(productCompositions.childProductId, gin[0].id)
  ));

console.log('New quantity:', comp[0].quantity);
process.exit(0);
