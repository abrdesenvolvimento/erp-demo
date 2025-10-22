import { getDb } from "./server/db.js";
import { products, productCompositions, productPrices, categories, salesChannels } from "./drizzle/schema.js";
import { eq } from "drizzle-orm";

async function createProducts() {
  const db = await getDb();
  console.log("=== CRIANDO PRODUTOS REALISTAS ===\n");
  
  // Buscar categoria Bebidas e canais de venda
  const bebidasCat = await db.select().from(categories).where(eq(categories.name, 'Bebidas')).limit(1);
  const channels = await db.select().from(salesChannels);
  
  if (!bebidasCat.length) {
    console.error("Categoria Bebidas não encontrada!");
    process.exit(1);
  }
  
  const categoryId = bebidasCat[0].id;
  
  // Produtos para drinks compostos
  console.log("1. Criando componentes para drinks...");
  
  // Gin Dober 750ml
  const [ginDober] = await db.insert(products).values({
    name: "Gin Dober 750ml",
    categoryId,
    ean: "7891234567890",
    uom: "UN",
    minStock: 5,
    currentStock: 10,
    avgCost: "45.00",
    isComposite: false,
    active: true
  });
  console.log(`   ✓ Gin Dober 750ml criado (ID: ${ginDober.insertId})`);
  
  // Energético Red Bull 250ml
  const [energetico] = await db.insert(products).values({
    name: "Energético Red Bull 250ml",
    categoryId,
    ean: "7891234567891",
    uom: "UN",
    minStock: 24,
    currentStock: 48,
    avgCost: "6.50",
    isComposite: false,
    active: true
  });
  console.log(`   ✓ Energético Red Bull 250ml criado (ID: ${energetico.insertId})`);
  
  // Gelo de Sabor (Limão)
  const [gelo] = await db.insert(products).values({
    name: "Gelo de Sabor Limão",
    categoryId,
    ean: "7891234567892",
    uom: "UN",
    minStock: 50,
    currentStock: 100,
    avgCost: "0.50",
    isComposite: false,
    active: true
  });
  console.log(`   ✓ Gelo de Sabor Limão criado (ID: ${gelo.insertId})`);
  
  // Copo 700ml
  const [copo] = await db.insert(products).values({
    name: "Copo Descartável 700ml",
    categoryId,
    ean: "7891234567893",
    uom: "UN",
    minStock: 100,
    currentStock: 500,
    avgCost: "0.30",
    isComposite: false,
    active: true
  });
  console.log(`   ✓ Copo 700ml criado (ID: ${copo.insertId})`);
  
  console.log("\n2. Criando produto composto: Dose Gin Dober...");
  
  // Dose Gin Dober (produto composto)
  const [doseGin] = await db.insert(products).values({
    name: "Dose Gin Dober",
    categoryId,
    subcategory: "Drinks",
    ean: "7891234567894",
    uom: "UN",
    minStock: 0,
    currentStock: 0, // Produtos compostos não têm estoque próprio
    avgCost: "52.30", // Soma dos custos dos componentes
    isComposite: true,
    active: true
  });
  console.log(`   ✓ Dose Gin Dober criado (ID: ${doseGin.insertId})`);
  
  // Criar composições
  await db.insert(productCompositions).values([
    {
      parentProductId: doseGin.insertId,
      childProductId: ginDober.insertId,
      quantity: 0.2 // 200ml de uma garrafa de 750ml
    },
    {
      parentProductId: doseGin.insertId,
      childProductId: energetico.insertId,
      quantity: 1 // 1 lata de 250ml
    },
    {
      parentProductId: doseGin.insertId,
      childProductId: gelo.insertId,
      quantity: 1 // 1 unidade de gelo
    },
    {
      parentProductId: doseGin.insertId,
      childProductId: copo.insertId,
      quantity: 1 // 1 copo
    }
  ]);
  console.log(`   ✓ Composições criadas (4 componentes)`);
  
  // Criar preços para todos os produtos
  console.log("\n3. Criando preços por canal de venda...");
  const productIds = [ginDober.insertId, energetico.insertId, gelo.insertId, copo.insertId, doseGin.insertId];
  const prices = {
    [ginDober.insertId]: { balcao: 65.00, delivery: 70.00 },
    [energetico.insertId]: { balcao: 10.00, delivery: 12.00 },
    [gelo.insertId]: { balcao: 1.00, delivery: 1.50 },
    [copo.insertId]: { balcao: 0.50, delivery: 0.50 },
    [doseGin.insertId]: { balcao: 75.00, delivery: 80.00 }
  };
  
  for (const productId of productIds) {
    for (const channel of channels) {
      const price = channel.name.includes('Delivery') ? prices[productId].delivery : prices[productId].balcao;
      await db.insert(productPrices).values({
        productId,
        channelId: channel.id,
        price: price.toFixed(2)
      });
    }
  }
  console.log(`   ✓ Preços criados para ${productIds.length} produtos x ${channels.length} canais`);
  
  console.log("\n✅ Produtos realistas criados com sucesso!");
  process.exit(0);
}

createProducts().catch(console.error);
