import { getDb } from './server/db.ts';
import { products } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = await getDb();
const gin = await db.select().from(products).where(eq(products.name, 'Gin Dober 750ml')).limit(1);
console.log('Gin Dober 750ml ID:', gin[0].id);
process.exit(0);
