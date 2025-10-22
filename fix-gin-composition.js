import { getDb } from './server/db.js';
import { productCompositions, products } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';

const db = await getDb();

// Buscar o produto Dose Gin Dober
const ginProduct = await db.select().from(products).where(eq(products.name, 'Dose Gin Dober'));
console.log('Produto Dose Gin Dober ID:', ginProduct[0].id);

if (ginProduct.length > 0) {
  // Buscar composições usando parentProductId
  const compositions = await db.select().from(productCompositions).where(eq(productCompositions.parentProductId, ginProduct[0].id));
  console.log('\nComposições atuais:');
  
  for (const comp of compositions) {
    const component = await db.select().from(products).where(eq(products.id, comp.childProductId));
    console.log(`- ID: ${comp.id} | ${component[0].name}: quantidade = ${comp.quantity}`);
  }
  
  // Buscar o componente Gin Dober 750ml
  const ginComponent = await db.select().from(products).where(eq(products.name, 'Gin Dober 750ml'));
  console.log('\nGin Dober 750ml ID:', ginComponent[0].id);
  
  // Buscar a composição do Gin
  const ginComposition = await db.select().from(productCompositions)
    .where(eq(productCompositions.parentProductId, ginProduct[0].id))
    .where(eq(productCompositions.childProductId, ginComponent[0].id));
    
  if (ginComposition.length > 0) {
    console.log('\nComposição do Gin encontrada:');
    console.log(ginComposition[0]);
  } else {
    console.log('\n⚠️  Composição do Gin NÃO encontrada!');
  }
}

process.exit(0);
