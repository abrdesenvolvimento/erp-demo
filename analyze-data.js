import { getDb } from "./server/db.js";
import { sales, saleItems, products, partners, productCompositions } from "./drizzle/schema.js";
import { sql } from "drizzle-orm";

async function analyzeData() {
  const db = await getDb();
  console.log("=== ANÁLISE DE DADOS DO BANCO ===\n");
  
  const salesCount = await db.select({ count: sql`count(*)` }).from(sales);
  const productsCount = await db.select({ count: sql`count(*)` }).from(products);
  const partnersCount = await db.select({ count: sql`count(*)` }).from(partners);
  const compositionsCount = await db.select({ count: sql`count(*)` }).from(productCompositions);
  
  console.log(`Vendas: ${salesCount[0].count}`);
  console.log(`Produtos: ${productsCount[0].count}`);
  console.log(`Parceiros: ${partnersCount[0].count}`);
  console.log(`Composições: ${compositionsCount[0].count}`);
  
  console.log("\n=== PRODUTOS ===");
  const allProducts = await db.select().from(products);
  allProducts.forEach(p => {
    console.log(`- ${p.name} (${p.isComposite ? 'COMPOSTO' : 'SIMPLES'}) - Estoque: ${p.currentStock}`);
  });
  
  console.log("\n=== PARCEIROS ===");
  const allPartners = await db.select().from(partners);
  allPartners.forEach(p => {
    console.log(`- ${p.name} (${p.partnerType})`);
  });
  
  process.exit(0);
}

analyzeData().catch(console.error);
