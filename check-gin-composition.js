import { getDb } from './server/db.js';
import { productCompositions, products } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';

const db = await getDb();

// Buscar o produto Dose Gin Dober
const ginProduct = await db.select().from(products).where(eq(products.name, 'Dose Gin Dober'));
console.log('Produto Dose Gin Dober:', ginProduct[0]);

if (ginProduct.length > 0) {
  // Buscar composições
  const compositions = await db.select().from(productCompositions).where(eq(productCompositions.productId, ginProduct[0].id));
  console.log('\nComposições:');
  
  for (const comp of compositions) {
    const component = await db.select().from(products).where(eq(products.id, comp.componentId));
    console.log(`- ${component[0].name}: quantidade = ${comp.quantity}`);
  }
}

process.exit(0);
