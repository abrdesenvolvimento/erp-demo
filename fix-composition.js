import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { products, productCompositions } from "./drizzle/schema.js";

const db = drizzle(process.env.DATABASE_URL);

async function fixComposition() {
  // Get Beats GT products
  const beatsProducts = await db.select().from(products).where(eq(products.name, "Beats GT 269ml Long Neck"));
  const beatsPack = await db.select().from(products).where(eq(products.name, "Beats GT 269ml Long Neck Pack 6 Unidades"));
  
  if (beatsProducts.length === 0 || beatsPack.length === 0) {
    console.log("Products not found!");
    return;
  }
  
  const componentId = beatsProducts[0].id;
  const packId = beatsPack[0].id;
  
  console.log(`Component ID: ${componentId} - ${beatsProducts[0].name}`);
  console.log(`Pack ID: ${packId} - ${beatsPack[0].name}`);
  
  // Check if composition already exists
  const existing = await db.select().from(productCompositions).where(eq(productCompositions.parentProductId, packId));
  
  if (existing.length > 0) {
    console.log("Composition already exists:", existing);
    return;
  }
  
  // Insert composition
  await db.insert(productCompositions).values({
    parentProductId: packId,
    childProductId: componentId,
    quantity: 6
  });
  
  console.log("Composition inserted successfully!");
  
  // Verify
  const verify = await db.select().from(productCompositions).where(eq(productCompositions.parentProductId, packId));
  console.log("Verification:", verify);
}

fixComposition().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
