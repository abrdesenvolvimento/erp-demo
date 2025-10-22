import { getDb } from './server/db.js';
import { productCompositions, products } from './drizzle/schema.js';
import { eq, and } from 'drizzle-orm';

const db = await getDb();

// Buscar IDs
const ginProduct = await db.select().from(products).where(eq(products.name, 'Dose Gin Dober'));
const ginComponent = await db.select().from(products).where(eq(products.name, 'Gin Dober 750ml'));

console.log('Dose Gin Dober ID:', ginProduct[0].id);
console.log('Gin Dober 750ml ID:', ginComponent[0].id);

// Atualizar quantidade
const result = await db.update(productCompositions)
  .set({ quantity: '0.2' })
  .where(
    and(
      eq(productCompositions.parentProductId, ginProduct[0].id),
      eq(productCompositions.childProductId, ginComponent[0].id)
    )
  );

console.log('\n✅ Quantidade atualizada!');
console.log('Linhas afetadas:', result);

// Verificar atualização
const updated = await db.select().from(productCompositions)
  .where(
    and(
      eq(productCompositions.parentProductId, ginProduct[0].id),
      eq(productCompositions.childProductId, ginComponent[0].id)
    )
  );

console.log('\nComposição atualizada:');
console.log(updated[0]);

process.exit(0);
