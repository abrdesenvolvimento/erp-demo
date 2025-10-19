import { eq, desc, or, like, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users,
  categories, Category, InsertCategory,
  subcategories, Subcategory, InsertSubcategory,
  salesChannels, SalesChannel, InsertSalesChannel,
  products, Product, InsertProduct,
  productCompositions, ProductComposition, InsertProductComposition,
  productPrices, ProductPrice, InsertProductPrice,
  partners, Partner, InsertPartner,
  sales, Sale, InsertSale,
  saleItems, SaleItem, InsertSaleItem,
  purchaseOrders, PurchaseOrder, InsertPurchaseOrder,
  purchaseOrderItems, PurchaseOrderItem, InsertPurchaseOrderItem,
  accountsPayable, AccountPayable, InsertAccountPayable
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { id: user.id };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role === undefined) {
      if (user.id === ENV.ownerId) {
        user.role = 'admin';
        values.role = 'admin';
        updateSet.role = 'admin';
      }
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== CATEGORIAS ====================
export async function getCategories(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(categories);
  if (activeOnly) {
    query = query.where(eq(categories.active, true)) as any;
  }
  
  return await query.orderBy(categories.name);
}

export async function createCategory(data: InsertCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(categories).values(data);
  return Number((result as any).insertId);
}

export async function updateCategory(id: number, data: Partial<InsertCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(categories).set(data).where(eq(categories.id, id));
}

// ==================== SUBCATEGORIAS ====================
export async function getSubcategories(categoryId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(subcategories);
  if (categoryId) {
    query = query.where(eq(subcategories.categoryId, categoryId)) as any;
  }
  
  return await query.orderBy(subcategories.name);
}

// ==================== CANAIS DE VENDA ====================
export async function getSalesChannels(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(salesChannels);
  if (activeOnly) {
    query = query.where(eq(salesChannels.active, true)) as any;
  }
  
  return await query.orderBy(salesChannels.name);
}

export async function createSalesChannel(data: InsertSalesChannel) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(salesChannels).values(data);
  return Number((result as any).insertId);
}

// ==================== PRODUTOS ====================
export async function getProducts(filters?: { search?: string; categoryId?: number; activeOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(products);
  const conditions = [];
  
  if (filters?.activeOnly !== false) {
    conditions.push(eq(products.active, true));
  }
  
  if (filters?.categoryId) {
    conditions.push(eq(products.categoryId, filters.categoryId));
  }
  
  if (filters?.search) {
    conditions.push(
      sql`(${products.name} LIKE ${`%${filters.search}%`} OR ${products.ean} LIKE ${`%${filters.search}%`})`
    );
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(products.name);
}

export async function getProduct(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(products).values(data);
  return Number((result as any).insertId);
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function updateProductStock(id: number, quantity: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(products)
    .set({ currentStock: sql`${products.currentStock} + ${quantity}` })
    .where(eq(products.id, id));
}

// ==================== PREÇOS DE PRODUTOS ====================
export async function getProductPrices(productId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(productPrices).where(eq(productPrices.productId, productId));
}

export async function setProductPrice(data: InsertProductPrice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verificar se já existe preço para este produto/canal
  const existing = await db.select()
    .from(productPrices)
    .where(and(
      eq(productPrices.productId, data.productId),
      eq(productPrices.channelId, data.channelId)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // Atualizar
    await db.update(productPrices)
      .set({ price: data.price, effectiveFrom: data.effectiveFrom })
      .where(eq(productPrices.id, existing[0].id));
    return existing[0].id;
  } else {
    // Inserir
    const result = await db.insert(productPrices).values(data);
    return Number((result as any).insertId);
  }
}

// ==================== PARCEIROS ====================
export async function getPartners(filters?: { search?: string; partnerType?: string; activeOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(partners);
  const conditions = [];
  
  if (filters?.activeOnly !== false) {
    conditions.push(eq(partners.active, true));
  }
  
  if (filters?.partnerType) {
    conditions.push(eq(partners.partnerType, filters.partnerType as any));
  }
  
  if (filters?.search) {
    conditions.push(
      sql`(${partners.name} LIKE ${`%${filters.search}%`} OR ${partners.docNumber} LIKE ${`%${filters.search}%`})`
    );
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(partners.name);
}

export async function getPartner(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPartner(data: InsertPartner) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(partners).values(data);
  return Number((result as any).insertId);
}

export async function updatePartner(id: number, data: Partial<InsertPartner>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(partners).set(data).where(eq(partners.id, id));
}

// ==================== VENDAS ====================
export async function getSales(filters?: { saleType?: string; customerId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(sales);
  const conditions = [];
  
  if (filters?.saleType) {
    conditions.push(eq(sales.saleType, filters.saleType as any));
  }
  
  if (filters?.customerId) {
    conditions.push(eq(sales.customerId, filters.customerId));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  query = query.orderBy(desc(sales.saleDate)) as any;
  
  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  
  return await query;
}

export async function getSale(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSaleItems(saleId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
}

export async function createSale(saleData: InsertSale, items: Omit<InsertSaleItem, 'saleId'>[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Inserir venda
  const saleResult = await db.insert(sales).values(saleData);
  const saleId = Number((saleResult as any).insertId);
  
  // Inserir itens
  const itemsWithSaleId = items.map(item => ({ ...item, saleId }));
  await db.insert(saleItems).values(itemsWithSaleId);
  
  // Baixar estoque
  for (const item of items) {
    await updateProductStock(item.productId, -item.quantity);
  }
  
  // Atualizar saldo do cliente se for venda a prazo
  if (saleData.saleType === 'A_PRAZO' && saleData.customerId) {
    await db.update(partners)
      .set({ currentBalance: sql`${partners.currentBalance} + ${saleData.finalAmount}` })
      .where(eq(partners.id, saleData.customerId));
  }
  
  return saleId;
}


// ==================== PRODUCT COMPOSITIONS ====================

export async function getProductCompositions(parentProductId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(productCompositions)
    .where(eq(productCompositions.parentProductId, parentProductId));
}

export async function setProductCompositions(parentProductId: number, compositions: { childProductId: number, quantity: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Remover composições antigas
  await db.delete(productCompositions)
    .where(eq(productCompositions.parentProductId, parentProductId));
  
  // Adicionar novas composições
  if (compositions.length > 0) {
    const values = compositions.map(comp => ({
      parentProductId,
      childProductId: comp.childProductId,
      quantity: comp.quantity
    }));
    await db.insert(productCompositions).values(values);
  }
}

export async function getProductCompositionsWithDetails(parentProductId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const compositions = await db.select({
    id: productCompositions.id,
    quantity: productCompositions.quantity,
    childProduct: products
  })
  .from(productCompositions)
  .leftJoin(products, eq(productCompositions.childProductId, products.id))
  .where(eq(productCompositions.parentProductId, parentProductId));
  
  return compositions;
}


// ==================== COMPRAS ====================

export async function createPurchaseOrder(data: InsertPurchaseOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(purchaseOrders).values(data);
  return result[0].insertId;
}

export async function getPurchaseOrders(filters?: { status?: string; supplierId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select({
    purchaseOrder: purchaseOrders,
    supplier: partners
  })
  .from(purchaseOrders)
  .leftJoin(partners, eq(purchaseOrders.supplierId, partners.id))
  .orderBy(desc(purchaseOrders.createdAt));
  
  // Aplicar filtros se fornecidos
  // Por simplicidade, retornando todos por enquanto
  
  return await query;
}

export async function getPurchaseOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({
    purchaseOrder: purchaseOrders,
    supplier: partners
  })
  .from(purchaseOrders)
  .leftJoin(partners, eq(purchaseOrders.supplierId, partners.id))
  .where(eq(purchaseOrders.id, id))
  .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updatePurchaseOrder(id: number, data: Partial<InsertPurchaseOrder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(purchaseOrders)
    .set(data)
    .where(eq(purchaseOrders.id, id));
}

export async function addPurchaseOrderItem(data: InsertPurchaseOrderItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(purchaseOrderItems).values(data);
  return result[0].insertId;
}

export async function getPurchaseOrderItems(purchaseOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const items = await db.select({
    item: purchaseOrderItems,
    product: products
  })
  .from(purchaseOrderItems)
  .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
  .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
  
  return items;
}

export async function deletePurchaseOrderItems(purchaseOrderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
}

export async function confirmPurchaseOrder(purchaseOrderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar itens da compra
  const items = await getPurchaseOrderItems(purchaseOrderId);
  
  // Atualizar estoque e custo médio para cada item
  for (const { item, product } of items) {
    if (!product || !item) continue;
    
    const currentStock = parseFloat(product.currentStock?.toString() || "0");
    const currentAvgCost = parseFloat(product.avgCost?.toString() || "0");
    const quantityPurchased = parseFloat(item.quantity.toString());
    const unitCost = parseFloat(item.unitCost.toString());
    
    // Calcular novo estoque
    const newStock = currentStock + quantityPurchased;
    
    // Calcular novo custo médio ponderado (RN-COMP-01)
    const newAvgCost = currentStock > 0
      ? (currentStock * currentAvgCost + quantityPurchased * unitCost) / newStock
      : unitCost;
    
    // Atualizar produto
    await updateProduct(product.id, {
      currentStock: newStock,
      avgCost: newAvgCost.toFixed(4)
    });
  }
  
  // Atualizar status da ordem de compra
  await updatePurchaseOrder(purchaseOrderId, { status: "CONFIRMED" });
  
  // Gerar conta a pagar (RN-COMP-03)
  const po = await getPurchaseOrderById(purchaseOrderId);
  if (po && po.purchaseOrder) {
    const totalAmount = parseFloat(po.purchaseOrder.totalAmount.toString());
    const freightCost = parseFloat(po.purchaseOrder.freightCost?.toString() || "0");
    const chargesCost = parseFloat(po.purchaseOrder.chargesCost?.toString() || "0");
    const finalAmount = totalAmount + freightCost + chargesCost;
    
    await db.insert(accountsPayable).values({
      description: `Compra #${purchaseOrderId} - ${po.supplier?.name || 'Fornecedor'}`,
      amount: finalAmount.toFixed(2),
      dueDate: po.purchaseOrder.dueDate || po.purchaseOrder.postingDate,
      status: "PENDING",
      supplierId: po.purchaseOrder.supplierId,
      purchaseOrderId: purchaseOrderId
    });
  }
}

export async function searchProducts(searchTerm: string) {
  const db = await getDb();
  if (!db) return [];
  
  const term = `%${searchTerm}%`;
  
  const results = await db.select()
    .from(products)
    .where(
      or(
        like(products.name, term),
        like(products.ean, term)
      )
    )
    .limit(10);
  
  return results;
}

