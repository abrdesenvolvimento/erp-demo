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
  purchaseInstallments, PurchaseInstallment, InsertPurchaseInstallment,
  accountsPayable, AccountPayable, InsertAccountPayable,
  expenseCategories, ExpenseCategory, InsertExpenseCategory,
  expenses, Expense, InsertExpense,
  expenseInstallments, ExpenseInstallment, InsertExpenseInstallment
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
  
  // Get products
  let query = db.select().from(products);
  const conditions = [];
  
  if (filters?.activeOnly !== false) {
    conditions.push(eq(products.active, true));
  }
  
  if (filters?.categoryId) {
    conditions.push(eq(products.categoryId, filters.categoryId));
  }
  
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    conditions.push(
      sql`(LOWER(${products.name}) LIKE ${`%${searchLower}%`} OR LOWER(${products.ean}) LIKE ${`%${searchLower}%`})`
    );
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const productList = await query.orderBy(products.name);
  
  // Get all prices in a single query
  if (productList.length === 0) return [];
  
  const productIds = productList.map(p => p.id);
  const allPrices = await db.select()
    .from(productPrices)
    .where(sql`${productPrices.productId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`);
  
  // Group prices by product
  const pricesByProduct = new Map<number, typeof allPrices>();
  for (const price of allPrices) {
    if (!pricesByProduct.has(price.productId)) {
      pricesByProduct.set(price.productId, []);
    }
    pricesByProduct.get(price.productId)!.push(price);
  }
  
  // Attach prices to products
  return productList.map(product => ({
    ...product,
    prices: pricesByProduct.get(product.id) || []
  }));
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

// Update stock considering composite products
export async function updateProductStockWithCompositions(id: number, quantity: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Update main product stock
  await updateProductStock(id, quantity);
  
  // Check if product is composite
  const product = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (product.length === 0 || !product[0].isComposite) {
    return; // Not composite, done
  }
  
  // Get compositions
  const compositions = await db.select()
    .from(productCompositions)
    .where(eq(productCompositions.parentProductId, id));
  
  // Update stock of each component
  for (const comp of compositions) {
    const componentQuantity = quantity * comp.quantity;
    await updateProductStock(comp.childProductId, componentQuantity);
  }
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
    const searchLower = filters.search.toLowerCase();
    conditions.push(
      sql`(LOWER(${partners.name}) LIKE ${`%${searchLower}%`} OR LOWER(${partners.docNumber}) LIKE ${`%${searchLower}%`})`
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
  console.log('[createSale] saleResult:', saleResult);
  // O insertId está no primeiro elemento do array
  const saleId = Number((saleResult as any)[0]?.insertId || (saleResult as any).insertId);
  console.log('[createSale] saleId:', saleId);
  
  // Inserir itens
  const itemsWithSaleId = items.map(item => ({ ...item, saleId }));
  await db.insert(saleItems).values(itemsWithSaleId);
  
  // Baixar estoque (considerando produtos compostos)
  for (const item of items) {
    await updateProductStockWithCompositions(item.productId, -item.quantity);
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
  
  try {
    console.log("[createPurchaseOrder] Data:", JSON.stringify(data, null, 2));
    const result = await db.insert(purchaseOrders).values(data);
    return result[0].insertId;
  } catch (error: any) {
    console.error("[createPurchaseOrder] Error:", error.message);
    console.error("[createPurchaseOrder] SQL:", error.sql);
    throw error;
  }
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

export async function addPurchaseInstallment(data: InsertPurchaseInstallment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(purchaseInstallments).values(data);
  return result[0].insertId;
}

export async function getPurchaseInstallments(purchaseOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(purchaseInstallments)
    .where(eq(purchaseInstallments.purchaseOrderId, purchaseOrderId))
    .orderBy(purchaseInstallments.installmentNumber);
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
  
  // Gerar contas a pagar baseadas nas parcelas (RN-COMP-03)
  const po = await getPurchaseOrderById(purchaseOrderId);
  const installments = await getPurchaseInstallments(purchaseOrderId);
  
  if (po && po.purchaseOrder && installments.length > 0) {
    for (const installment of installments) {
      await db.insert(accountsPayable).values({
        description: `Compra #${purchaseOrderId} - Parcela ${installment.installmentNumber}/${installments.length} - ${po.supplier?.name || 'Fornecedor'}`,
        amount: installment.amount.toString(),
        dueDate: installment.dueDate,
        status: "PENDING",
        supplierId: po.purchaseOrder.supplierId,
        purchaseOrderId: purchaseOrderId
      });
    }
  }
}

export async function searchProducts(searchTerm: string) {
  const db = await getDb();
  if (!db) return [];
  
  const searchLower = searchTerm.toLowerCase();
  const term = `%${searchLower}%`;
  
  const results = await db.select()
    .from(products)
    .where(
      or(
        sql`LOWER(${products.name}) LIKE ${term}`,
        sql`LOWER(${products.ean}) LIKE ${term}`
      )
    )
    .limit(10);
  
  return results;
}

// ==================== DESPESAS OPERACIONAIS ====================

// Categorias de Despesas
export async function getExpenseCategories(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(expenseCategories);
  if (activeOnly) {
    query = query.where(eq(expenseCategories.active, true)) as any;
  }
  
  return await query.orderBy(expenseCategories.name);
}

export async function createExpenseCategory(data: InsertExpenseCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(expenseCategories).values(data);
  return Number((result as any).insertId);
}

export async function updateExpenseCategory(id: number, data: Partial<InsertExpenseCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(expenseCategories).set(data).where(eq(expenseCategories.id, id));
}

// Despesas
export async function getExpenses(filters?: { 
  categoryId?: number; 
  status?: string; 
  supplierId?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select({
    expense: expenses,
    category: expenseCategories,
    supplier: partners
  })
  .from(expenses)
  .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
  .leftJoin(partners, eq(expenses.supplierId, partners.id));
  
  const conditions = [];
  
  if (filters?.categoryId) {
    conditions.push(eq(expenses.categoryId, filters.categoryId));
  }
  
  if (filters?.status) {
    conditions.push(eq(expenses.status, filters.status as any));
  }
  
  if (filters?.supplierId) {
    conditions.push(eq(expenses.supplierId, filters.supplierId));
  }
  
  if (filters?.startDate) {
    conditions.push(sql`${expenses.firstDueDate} >= ${filters.startDate}`);
  }
  
  if (filters?.endDate) {
    conditions.push(sql`${expenses.firstDueDate} <= ${filters.endDate}`);
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(expenses.createdAt));
}

export async function getExpenseById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({
    expense: expenses,
    category: expenseCategories,
    supplier: partners
  })
  .from(expenses)
  .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
  .leftJoin(partners, eq(expenses.supplierId, partners.id))
  .where(eq(expenses.id, id))
  .limit(1);
  
  if (result.length === 0) return null;
  
  // Buscar parcelas
  const installments = await getExpenseInstallments(id);
  
  return {
    ...result[0],
    installments
  };
}

export async function createExpense(data: InsertExpense) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(expenses).values(data);
  const insertId = (result as any)[0]?.insertId || (result as any).insertId;
  if (!insertId) {
    // Fallback: buscar o último registro inserido
    const lastRecord = await db.select().from(expenses).orderBy(desc(expenses.id)).limit(1);
    return lastRecord[0]?.id || 0;
  }
  return Number(insertId);
}

export async function updateExpense(id: number, data: Partial<InsertExpense>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(expenses).set(data).where(eq(expenses.id, id));
}

export async function cancelExpense(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Marcar despesa como cancelada
  await db.update(expenses)
    .set({ status: "CANCELADA" })
    .where(eq(expenses.id, id));
  
  // Cancelar todas as parcelas pendentes
  await db.update(expenseInstallments)
    .set({ status: "CANCELADO" })
    .where(and(
      eq(expenseInstallments.expenseId, id),
      eq(expenseInstallments.status, "PENDENTE")
    ));
}

// Parcelas de Despesas
export async function getExpenseInstallments(expenseId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(expenseInstallments)
    .where(eq(expenseInstallments.expenseId, expenseId))
    .orderBy(expenseInstallments.installmentNumber);
}

export async function getPendingExpenseInstallments(filters?: {
  categoryId?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select({
    installment: expenseInstallments,
    expense: expenses,
    category: expenseCategories,
    supplier: partners
  })
  .from(expenseInstallments)
  .innerJoin(expenses, eq(expenseInstallments.expenseId, expenses.id))
  .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
  .leftJoin(partners, eq(expenses.supplierId, partners.id));
  
  const conditions = [
    or(
      eq(expenseInstallments.status, "PENDENTE"),
      eq(expenseInstallments.status, "VENCIDO")
    )
  ];
  
  if (filters?.categoryId) {
    conditions.push(eq(expenses.categoryId, filters.categoryId));
  }
  
  if (filters?.startDate) {
    conditions.push(sql`${expenseInstallments.dueDate} >= ${filters.startDate}`);
  }
  
  if (filters?.endDate) {
    conditions.push(sql`${expenseInstallments.dueDate} <= ${filters.endDate}`);
  }
  
  query = query.where(and(...conditions)) as any;
  
  return await query.orderBy(expenseInstallments.dueDate);
}

export async function createExpenseInstallment(data: InsertExpenseInstallment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(expenseInstallments).values(data);
  return Number((result as any).insertId);
}

export async function payExpenseInstallment(
  id: number, 
  paymentData: {
    paymentDate: Date;
    paymentAmount: string;
    paymentMethod: string;
    notes?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(expenseInstallments)
    .set({
      paymentDate: paymentData.paymentDate,
      paymentAmount: paymentData.paymentAmount,
      paymentMethod: paymentData.paymentMethod as any,
      notes: paymentData.notes,
      status: "PAGO"
    })
    .where(eq(expenseInstallments.id, id));
}

// Atualizar status de parcelas vencidas
export async function updateOverdueExpenseInstallments() {
  const db = await getDb();
  if (!db) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  await db.update(expenseInstallments)
    .set({ status: "VENCIDO" })
    .where(and(
      eq(expenseInstallments.status, "PENDENTE"),
      sql`${expenseInstallments.dueDate} < ${today}`
    ));
}

