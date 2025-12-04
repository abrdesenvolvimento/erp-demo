import { eq, desc, or, like, and, sql, gte, lte } from "drizzle-orm";
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
  expenseInstallments, ExpenseInstallment, InsertExpenseInstallment,
  receivables, Receivable, InsertReceivable,
  receivableInstallments, ReceivableInstallment, InsertReceivableInstallment,
  receivablePayments, ReceivablePayment, InsertReceivablePayment,
  customerPayments, CustomerPayment, InsertCustomerPayment
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

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(users.createdAt);
}

export async function updateUserRole(userId: string, role: 'admin' | 'user') {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  await db.update(users).set({ role }).where(eq(users.id, userId));
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

export async function createSubcategory(data: InsertSubcategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(subcategories).values(data);
  return Number((result as any).insertId);
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
  console.log('[createProduct] Insert result:', result);
  
  // Tentar diferentes formas de obter o ID
  const insertId = (result as any).insertId || (result as any).lastInsertRowid || (result as any)[0]?.insertId;
  
  if (!insertId) {
    console.error('[createProduct] Failed to get insertId from result:', result);
    throw new Error("Failed to get product ID after insert");
  }
  
  return Number(insertId);
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
  
  console.log('[updateProductStockWithCompositions] Called with id:', id, 'quantity:', quantity);
  
  // Check if product is composite
  const product = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (product.length === 0) {
    console.log('[updateProductStockWithCompositions] Product not found!');
    return;
  }
  
  console.log('[updateProductStockWithCompositions] Product:', product[0].name, 'isComposite:', product[0].isComposite);
  
  if (product[0].isComposite) {
    // For composite products, ONLY update component stocks (not the composite itself)
    const compositions = await db.select()
      .from(productCompositions)
      .where(eq(productCompositions.parentProductId, id));
    
    console.log('[updateProductStockWithCompositions] Found', compositions.length, 'compositions');
    
    // Update stock of each component
    for (const comp of compositions) {
      const componentQuantity = quantity * parseFloat(comp.quantity || "0");
      console.log('[updateProductStockWithCompositions] Updating component', comp.childProductId, 'by', componentQuantity);
      await updateProductStock(comp.childProductId, componentQuantity);
    }
  } else {
    // For regular products, update their own stock
    console.log('[updateProductStockWithCompositions] Updating regular product stock');
    await updateProductStock(id, quantity);
  }
  
  console.log('[updateProductStockWithCompositions] Completed');
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
  
  query = query.orderBy(desc(sales.createdAt)) as any;
  
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
  
  // Buscar itens com nome do produto
  const result = await db
    .select({
      id: saleItems.id,
      saleId: saleItems.saleId,
      productId: saleItems.productId,
      productName: products.name,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      totalPrice: saleItems.totalPrice,
    })
    .from(saleItems)
    .leftJoin(products, eq(saleItems.productId, products.id))
    .where(eq(saleItems.saleId, saleId));
  
  return result;
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

export async function getSalesStats(
  period?: 'today' | 'week' | 'month' | 'all',
  dateFrom?: string,
  dateTo?: string,
  channel?: 'BALCAO' | 'DELIVERY' | 'A_PRAZO'
) {
  const db = await getDb();
  if (!db) return {
    balcao: { count: 0, total: "0.00" },
    delivery: { count: 0, total: "0.00" },
    aPrazo: { count: 0, total: "0.00" },
    total: { count: 0, total: "0.00" },
  };
  
  // Buscar todas as vendas
  let allSales = await db.select().from(sales);
  
  // Aplicar filtro de data customizada (tem prioridade sobre period)
  // IMPORTANTE: Usa saleDate (data real da venda) ao invés de createdAt (data de implantação)
  if (dateFrom || dateTo) {
    allSales = allSales.filter(sale => {
      const saleDate = new Date(sale.saleDate!);
      const saleBrasiliaStr = saleDate.toLocaleString('en-US', { 
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour12: false
      });
      
      const [saleDatePart] = saleBrasiliaStr.split(', ');
      const [saleMonth, saleDay, saleYear] = saleDatePart.split('/');
      const saleDateStr = `${saleYear}-${saleMonth}-${saleDay}`; // YYYY-MM-DD
      
      if (dateFrom && saleDateStr < dateFrom) return false;
      if (dateTo && saleDateStr > dateTo) return false;
      return true;
    });
  }
  // Aplicar filtro de período usando horário de Brasília (GMT-3)
  else if (period && period !== 'all') {
    // Obter data ATUAL em Brasília
    const now = new Date();
    const nowBrasiliaStr = now.toLocaleString('en-US', { 
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Parse: "12/01/2025, 18:03:00" -> partes
    const [datePart, timePart] = nowBrasiliaStr.split(', ');
    const [month, day, year] = datePart.split('/');
    const todayBrasilia = { year: parseInt(year), month: parseInt(month), day: parseInt(day) };
    
    if (period === 'today') {
      // Filtrar vendas de hoje comparando data em Brasília
      // IMPORTANTE: Usa saleDate (data real da venda) ao invés de createdAt
      allSales = allSales.filter(sale => {
        const saleDate = new Date(sale.saleDate!);
        const saleBrasiliaStr = saleDate.toLocaleString('en-US', { 
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour12: false
        });
        
        const [saleDatePart] = saleBrasiliaStr.split(', ');
        const [saleMonth, saleDay, saleYear] = saleDatePart.split('/');
        
        return parseInt(saleYear) === todayBrasilia.year &&
               parseInt(saleMonth) === todayBrasilia.month &&
               parseInt(saleDay) === todayBrasilia.day;
      });
    } else if (period === 'week') {
      // 7 dias atrás
      // IMPORTANTE: Usa saleDate (data real da venda) ao invés de createdAt
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      allSales = allSales.filter(sale => {
        const saleDate = new Date(sale.saleDate!);
        return saleDate >= weekAgo;
      });
    } else if (period === 'month') {
      // Mês atual comparando data em Brasília
      // IMPORTANTE: Usa saleDate (data real da venda) ao invés de createdAt
      allSales = allSales.filter(sale => {
        const saleDate = new Date(sale.saleDate!);
        const saleBrasiliaStr = saleDate.toLocaleString('en-US', { 
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour12: false
        });
        
        const [saleDatePart] = saleBrasiliaStr.split(', ');
        const [saleMonth, saleDay, saleYear] = saleDatePart.split('/');
        
        return parseInt(saleYear) === todayBrasilia.year &&
               parseInt(saleMonth) === todayBrasilia.month;
      });
    }
  }
  
  // Aplicar filtro de canal se especificado
  if (channel) {
    allSales = allSales.filter(sale => sale.saleType === channel);
  }
  
  const stats = {
    balcao: { count: 0, total: 0 },
    delivery: { count: 0, total: 0 },
    aPrazo: { count: 0, total: 0 },
  };
  
  for (const sale of allSales) {
    const amount = parseFloat(sale.finalAmount);
    
    if (sale.saleType === "BALCAO") {
      stats.balcao.count++;
      stats.balcao.total += amount;
    } else if (sale.saleType === "DELIVERY") {
      stats.delivery.count++;
      stats.delivery.total += amount;
    } else if (sale.saleType === "A_PRAZO") {
      stats.aPrazo.count++;
      stats.aPrazo.total += amount;
    }
  }
  
  const totalCount = stats.balcao.count + stats.delivery.count + stats.aPrazo.count;
  const totalAmount = stats.balcao.total + stats.delivery.total + stats.aPrazo.total;
  
  return {
    balcao: { count: stats.balcao.count, total: stats.balcao.total.toFixed(2) },
    delivery: { count: stats.delivery.count, total: stats.delivery.total.toFixed(2) },
    aPrazo: { count: stats.aPrazo.count, total: stats.aPrazo.total.toFixed(2) },
    total: { count: totalCount, total: totalAmount.toFixed(2) },
  };
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
  
  console.log('[setProductCompositions] Called with:', { parentProductId, compositions });
  
  // Remover composições antigas
  console.log('[setProductCompositions] Deleting old compositions for product', parentProductId);
  await db.delete(productCompositions)
    .where(eq(productCompositions.parentProductId, parentProductId));
  console.log('[setProductCompositions] Old compositions deleted');
  
  // Adicionar novas composições
  if (compositions.length > 0) {
    const values = compositions.map(comp => ({
      parentProductId,
      childProductId: comp.childProductId,
      quantity: typeof comp.quantity === 'number' ? comp.quantity.toString() : comp.quantity
    }));
    console.log('[setProductCompositions] Inserting new compositions:', values);
    const result = await db.insert(productCompositions).values(values);
    console.log('[setProductCompositions] Insert result:', result);
  } else {
    console.log('[setProductCompositions] No compositions to insert');
  }
  
  // Verificar se foram salvas
  const [saved] = await db.execute(`SELECT * FROM productCompositions WHERE parentProductId = ${parentProductId}`);
  console.log('[setProductCompositions] Compositions after save:', saved);
  
  // Calcular e atualizar custo médio do produto composto
  await updateCompositeProductCost(parentProductId);
}

// Atualizar custo de todos os produtos compostos que usam um componente específico
export async function updateCompositeProductsUsingComponent(componentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  console.log('[updateCompositeProductsUsingComponent] Finding composite products using component', componentId);
  
  // Buscar todos os produtos compostos que usam este componente
  const compositeProducts = await db.select({
    parentProductId: productCompositions.parentProductId
  })
  .from(productCompositions)
  .where(eq(productCompositions.childProductId, componentId));
  
  console.log('[updateCompositeProductsUsingComponent] Found', compositeProducts.length, 'composite products');
  
  // Atualizar custo de cada produto composto
  for (const comp of compositeProducts) {
    await updateCompositeProductCost(comp.parentProductId);
  }
}

// Calcular custo médio de produto composto baseado nos componentes
export async function updateCompositeProductCost(parentProductId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  console.log('[updateCompositeProductCost] ===== START ===== Calculating cost for product', parentProductId);
  
  // Buscar composições com detalhes dos produtos
  const compositions = await db.select({
    childProductId: productCompositions.childProductId,
    quantity: productCompositions.quantity,
    avgCost: products.avgCost,
    childName: products.name
  })
  .from(productCompositions)
  .leftJoin(products, eq(productCompositions.childProductId, products.id))
  .where(eq(productCompositions.parentProductId, parentProductId));
  
  console.log('[updateCompositeProductCost] Found', compositions.length, 'compositions');
  
  if (compositions.length === 0) {
    console.log('[updateCompositeProductCost] No compositions found, skipping cost calculation');
    return;
  }
  
  // Calcular custo total somando (quantidade * custo) de cada componente
  let totalCost = 0;
  for (const comp of compositions) {
    const quantity = parseFloat(comp.quantity?.toString() || "0");
    const cost = parseFloat(comp.avgCost?.toString() || "0");
    const subtotal = quantity * cost;
    totalCost += subtotal;
    console.log('[updateCompositeProductCost] Component:', {
      childId: comp.childProductId,
      childName: comp.childName,
      quantity,
      cost,
      subtotal
    });
  }
  
  console.log('[updateCompositeProductCost] Total calculated cost:', totalCost);
  
  // Atualizar custo médio do produto composto (mantendo 4 casas decimais como nas compras)
  const newCost = totalCost.toFixed(4);
  console.log('[updateCompositeProductCost] Updating product', parentProductId, 'with new cost:', newCost);
  
  await db.update(products)
    .set({ avgCost: newCost })
    .where(eq(products.id, parentProductId));
  
  console.log('[updateCompositeProductCost] ===== END ===== Cost updated successfully');
}

export async function getProductCompositionsWithDetails(parentProductId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const compositions = await db.select({
    id: productCompositions.id,
    childProductId: productCompositions.childProductId,
    quantity: productCompositions.quantity,
    childProduct: {
      id: products.id,
      name: products.name,
      ean: products.ean,
      uom: products.uom,
      categoryId: products.categoryId,
      subcategory: products.subcategory,
      minStock: products.minStock,
      currentStock: products.currentStock,
      avgCost: products.avgCost,
      isComposite: products.isComposite,
      active: products.active
    }
  })
  .from(productCompositions)
  .leftJoin(products, eq(productCompositions.childProductId, products.id))
  .where(eq(productCompositions.parentProductId, parentProductId));
  
  console.log('[getProductCompositionsWithDetails] Query for product', parentProductId);
  console.log('[getProductCompositionsWithDetails] Found', compositions.length, 'compositions');
  console.log('[getProductCompositionsWithDetails] Compositions:', JSON.stringify(compositions, null, 2));
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
    id: purchaseOrderItems.id,
    productId: purchaseOrderItems.productId,
    quantity: purchaseOrderItems.quantity,
    unitCost: purchaseOrderItems.unitCost,
    totalCost: purchaseOrderItems.totalCost,
    expiryDate: purchaseOrderItems.expiryDate,
    productName: products.name,
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
  for (const item of items) {
    // Buscar produto para atualizar estoque
    const product = await db.select().from(products).where(eq(products.id, item.productId || 0)).limit(1);
    if (product.length === 0) continue;
    const prod = product[0];
    
    const currentStock = parseFloat(prod.currentStock?.toString() || "0");
    const currentAvgCost = parseFloat(prod.avgCost?.toString() || "0");
    const quantityPurchased = parseFloat(item.quantity.toString());
    const unitCost = parseFloat(item.unitCost.toString());
    
    // Calcular novo estoque
    const newStock = currentStock + quantityPurchased;
    
    // Calcular novo custo médio ponderado (RN-COMP-01)
    const newAvgCost = currentStock > 0
      ? (currentStock * currentAvgCost + quantityPurchased * unitCost) / newStock
      : unitCost;
    
    // Preparar dados de atualização
    const updateData: any = {
      currentStock: newStock,
      avgCost: newAvgCost.toFixed(4)
    };
    
    // Se o item tem data de vencimento, atualizar no produto
    if (item.expiryDate) {
      updateData.expirationDate = item.expiryDate;
    }
    
    // Atualizar produto
    await updateProduct(prod.id, updateData);
    
    // Atualizar custo de produtos compostos que usam este componente
    if (item.productId) {
      await updateCompositeProductsUsingComponent(item.productId);
    }
  }
  
  // Atualizar status da ordem de compra
  await updatePurchaseOrder(purchaseOrderId, { status: "CONFIRMED" });
  
  // NOTA: Compras de produtos NÃO devem gerar despesas operacionais.
  // Elas já são registradas em Contas a Pagar (purchaseInstallments).
  // Despesas operacionais são para custos fixos (aluguel, energia, etc).
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
  
  // Filtros de data removidos - agora controlado pelas parcelas
  
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

export async function getPaymentHistory(filters: {
  supplierId?: number;
  startDate?: string;
  endDate?: string;
  docNumber?: string;
  paymentMethod?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar parcelas PAGAS de COMPRAS
  const purchaseConditions: any[] = [eq(purchaseInstallments.status, "PAID")];
  
  if (filters.supplierId) {
    purchaseConditions.push(eq(purchaseOrders.supplierId, filters.supplierId));
  }
  
  if (filters.startDate) {
    purchaseConditions.push(sql`${purchaseInstallments.paidDate} >= ${filters.startDate}`);
  }
  
  if (filters.endDate) {
    purchaseConditions.push(sql`${purchaseInstallments.paidDate} <= ${filters.endDate}`);
  }
  
  const paidPurchases = await db
    .select({
      id: purchaseInstallments.id,
      purchaseOrderId: purchaseInstallments.purchaseOrderId,
      installmentNumber: purchaseInstallments.installmentNumber,
      amount: purchaseInstallments.amount,
      paidDate: purchaseInstallments.paidDate,
      dueDate: purchaseInstallments.dueDate,
      status: purchaseInstallments.status,
      supplierId: purchaseOrders.supplierId,
      supplierName: partners.name,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseInstallments)
    .innerJoin(purchaseOrders, eq(purchaseInstallments.purchaseOrderId, purchaseOrders.id))
    .leftJoin(partners, eq(purchaseOrders.supplierId, partners.id))
    .where(and(...purchaseConditions))
    .orderBy(desc(purchaseInstallments.paidDate));
  
  // Buscar parcelas PAGAS de DESPESAS
  const expenseConditions: any[] = [eq(expenseInstallments.status, "PAGO")];
  
  if (filters.supplierId) {
    expenseConditions.push(eq(expenses.supplierId, filters.supplierId));
  }
  
  if (filters.startDate) {
    expenseConditions.push(sql`${expenseInstallments.paymentDate} >= ${filters.startDate}`);
  }
  
  if (filters.endDate) {
    expenseConditions.push(sql`${expenseInstallments.paymentDate} <= ${filters.endDate}`);
  }
  
  const paidExpenses = await db
    .select({
      id: expenseInstallments.id,
      expenseId: expenseInstallments.expenseId,
      installmentNumber: expenseInstallments.installmentNumber,
      amount: expenseInstallments.amount,
      paymentAmount: expenseInstallments.paymentAmount,
      paymentDate: expenseInstallments.paymentDate,
      paymentMethod: expenseInstallments.paymentMethod,
      notes: expenseInstallments.notes,
      dueDate: expenseInstallments.dueDate,
      status: expenseInstallments.status,
      supplierId: expenses.supplierId,
      supplierName: partners.name,
      docType: expenses.docType,
      docNumber: expenses.docNumber,
      description: expenses.description,
      createdAt: expenses.createdAt,
    })
    .from(expenseInstallments)
    .innerJoin(expenses, eq(expenseInstallments.expenseId, expenses.id))
    .leftJoin(partners, eq(expenses.supplierId, partners.id))
    .where(and(...expenseConditions))
    .orderBy(desc(expenseInstallments.paymentDate));
  
  // Consolidar resultados
  const result: any[] = [];
  
  // Adicionar compras
  for (const purchase of paidPurchases) {
    result.push({
      id: purchase.id,
      type: 'purchase',
      supplierId: purchase.supplierId || 0,
      supplierName: purchase.supplierName || 'Sem nome',
      description: `Compra #${purchase.purchaseOrderId} - Parcela ${purchase.installmentNumber}`,
      origin: 'Compra',
      expenseDate: purchase.createdAt || new Date(),
      dueDate: purchase.dueDate || new Date(),
      paidDate: purchase.paidDate || null,
      paymentMethod: null,
      notes: null,
      totalAmount: purchase.amount || "0",
      paidAmount: purchase.amount || "0",
      status: purchase.status,
    });
  }
  
  // Adicionar despesas
  for (const expense of paidExpenses) {
    const docTypeLabel = expense.docType === 'NOTA_FISCAL' ? 'NF' :
                        expense.docType === 'CUPOM' ? 'Cupom' :
                        expense.docType === 'RECIBO' ? 'Recibo' : 'Doc';
    
    result.push({
      id: expense.id,
      type: 'expense',
      expenseId: expense.expenseId,
      supplierId: expense.supplierId || 0,
      supplierName: expense.supplierName || 'Sem nome',
      description: `${expense.description || 'Despesa'} - ${docTypeLabel} ${expense.docNumber || 's/n'} - Parcela ${expense.installmentNumber}`,
      origin: 'Despesa',
      expenseDate: expense.createdAt || new Date(),
      dueDate: expense.dueDate || new Date(),
      paidDate: expense.paymentDate || null,
      paymentMethod: expense.paymentMethod || null,
      notes: expense.notes || null,
      totalAmount: expense.amount || "0",
      paidAmount: expense.paymentAmount || "0",
      status: expense.status,
    });
  }
  
  // Ordenar por data de pagamento (mais recente primeiro)
  result.sort((a, b) => {
    const dateA = a.paidDate ? new Date(a.paidDate).getTime() : 0;
    const dateB = b.paidDate ? new Date(b.paidDate).getTime() : 0;
    return dateB - dateA;
  });
  
  return result;
}

// Pagar parcela de compra
export async function payPurchaseInstallment(data: {
  installmentId: number;
  paidDate: Date;
  paidAmount: string;
  paymentMethod: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar a parcela
  const installment = await db.select()
    .from(purchaseInstallments)
    .where(eq(purchaseInstallments.id, data.installmentId))
    .limit(1);
  
  if (!installment[0]) throw new Error("Parcela não encontrada");
  
  const installmentAmount = parseFloat(installment[0].amount);
  const paidAmount = parseFloat(data.paidAmount);
  
  // Atualizar parcela
  await db.update(purchaseInstallments)
    .set({
      paidDate: data.paidDate,
      status: paidAmount >= installmentAmount ? "PAID" : "PENDING"
    })
    .where(eq(purchaseInstallments.id, data.installmentId));
  
  return { success: true };
}

// Pagar parcela de despesa
export async function payExpenseInstallment(data: {
  installmentId: number;
  paidDate: Date;
  paidAmount: string;
  paymentMethod: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar a parcela
  const installment = await db.select()
    .from(expenseInstallments)
    .where(eq(expenseInstallments.id, data.installmentId))
    .limit(1);
  
  if (!installment[0]) throw new Error("Parcela não encontrada");
  
  const installmentAmount = parseFloat(installment[0].amount);
  const paidAmount = parseFloat(data.paidAmount);
  const alreadyPaid = parseFloat(installment[0].paymentAmount || "0");
  const newPaidAmount = alreadyPaid + paidAmount;
  
  // Atualizar parcela
  await db.update(expenseInstallments)
    .set({
      paymentDate: data.paidDate,
      paymentAmount: newPaidAmount.toFixed(2),
      paymentMethod: data.paymentMethod,
      notes: data.notes,
      status: newPaidAmount >= installmentAmount ? "PAGO" : "PENDENTE"
    })
    .where(eq(expenseInstallments.id, data.installmentId));
  
  // Atualizar status da despesa
  await updateExpenseStatus(installment[0].expenseId);
  
  return { success: true };
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


// ==================== CONTAS A RECEBER ====================

// Criar recebível (chamado automaticamente ao criar venda A_PRAZO)
export async function createReceivable(data: InsertReceivable) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(receivables).values(data);
  
  // Buscar o recebível criado pela venda (mais confiável que insertId)
  const created = await db.select().from(receivables)
    .where(eq(receivables.saleId, data.saleId))
    .orderBy(desc(receivables.id))
    .limit(1);
  
  if (!created || created.length === 0) {
    throw new Error("Failed to create receivable");
  }
  
  return created[0];
}

// Criar parcela de recebível
export async function createReceivableInstallment(data: InsertReceivableInstallment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(receivableInstallments).values(data);
  return Number((result as any).insertId);
}

// Listar recebíveis
export async function listReceivables(filters?: {
  customerId?: number;
  status?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let query = db.select().from(receivables);
  
  const conditions = [];
  if (filters?.customerId) {
    conditions.push(eq(receivables.customerId, filters.customerId));
  }
  if (filters?.status) {
    conditions.push(eq(receivables.status, filters.status as any));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(receivables.createdAt));
}

// Obter recebível por ID com parcelas
export async function getReceivableById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const receivable = await db.select().from(receivables).where(eq(receivables.id, id)).limit(1);
  if (!receivable[0]) return null;
  
  const installments = await db.select()
    .from(receivableInstallments)
    .where(eq(receivableInstallments.receivableId, id))
    .orderBy(receivableInstallments.installmentNumber);
  
  return {
    ...receivable[0],
    installments
  };
}

// Listar parcelas pendentes
export async function listPendingReceivableInstallments(customerId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (customerId) {
    return await db.select({
      installment: receivableInstallments,
      receivable: receivables
    })
    .from(receivableInstallments)
    .leftJoin(receivables, eq(receivableInstallments.receivableId, receivables.id))
    .where(and(
      eq(receivableInstallments.status, "PENDENTE"),
      eq(receivables.customerId, customerId)
    ))
    .orderBy(receivableInstallments.dueDate);
  }
  
  return await db.select({
    installment: receivableInstallments,
    receivable: receivables
  })
  .from(receivableInstallments)
  .leftJoin(receivables, eq(receivableInstallments.receivableId, receivables.id))
  .where(eq(receivableInstallments.status, "PENDENTE"))
  .orderBy(receivableInstallments.dueDate);
}

// Listar parcelas vencidas
export async function listOverdueReceivableInstallments() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return await db.select({
    installment: receivableInstallments,
    receivable: receivables
  })
  .from(receivableInstallments)
  .leftJoin(receivables, eq(receivableInstallments.receivableId, receivables.id))
  .where(and(
    eq(receivableInstallments.status, "PENDENTE"),
    sql`${receivableInstallments.dueDate} < ${today}`
  ))
  .orderBy(receivableInstallments.dueDate);
}

// Registrar pagamento de parcela
export async function payReceivableInstallment(
  id: number,
  paymentData: {
    paidDate: Date;
    paidAmount: string;
    paymentMethod: string;
    notes?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar parcela
  const installment = await db.select().from(receivableInstallments).where(eq(receivableInstallments.id, id)).limit(1);
  if (!installment[0]) throw new Error("Parcela não encontrada");
  
  const paidAmount = parseFloat(paymentData.paidAmount);
  const installmentAmount = parseFloat(installment[0].amount);
  
  // Determinar status da parcela
  let status: "PAGO" | "PARCIAL" = "PAGO";
  if (paidAmount < installmentAmount) {
    status = "PARCIAL";
  }
  
  // Atualizar parcela
  await db.update(receivableInstallments)
    .set({
      paidDate: paymentData.paidDate,
      paidAmount: paymentData.paidAmount,
      paymentMethod: paymentData.paymentMethod,
      notes: paymentData.notes,
      status
    })
    .where(eq(receivableInstallments.id, id));
  
  // Atualizar recebível
  await updateReceivableStatus(installment[0].receivableId);
}

// Atualizar status do recebível baseado nas parcelas
async function updateReceivableStatus(receivableId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar todas as parcelas
  const installments = await db.select()
    .from(receivableInstallments)
    .where(eq(receivableInstallments.receivableId, receivableId));
  
  // Calcular totais
  let totalReceived = 0;
  let hasPending = false;
  let hasOverdue = false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (const inst of installments) {
    if (inst.paidAmount) {
      totalReceived += parseFloat(inst.paidAmount);
    }
    // Verificar se há parcelas não quitadas (PENDENTE, PARCIAL ou VENCIDO)
    if (inst.status === "PENDENTE" || inst.status === "PARCIAL" || inst.status === "VENCIDO") {
      hasPending = true;
      if (new Date(inst.dueDate) < today) {
        hasOverdue = true;
      }
    }
  }
  
  // Determinar status
  let status: "PENDENTE" | "PARCIAL" | "QUITADO" | "VENCIDO" = "PENDENTE";
  
  if (totalReceived === 0) {
    status = hasOverdue ? "VENCIDO" : "PENDENTE";
  } else if (hasPending) {
    status = hasOverdue ? "VENCIDO" : "PARCIAL";
  } else {
    status = "QUITADO";
  }
  
  // Atualizar recebível
  await db.update(receivables)
    .set({
      receivedAmount: totalReceived.toFixed(2),
      status
    })
    .where(eq(receivables.id, receivableId));
}

// Atualizar status de parcelas vencidas
export async function updateOverdueReceivableInstallments() {
  const db = await getDb();
  if (!db) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  await db.update(receivableInstallments)
    .set({ status: "VENCIDO" })
    .where(and(
      eq(receivableInstallments.status, "PENDENTE"),
      sql`${receivableInstallments.dueDate} < ${today}`
    ));
  
  // Atualizar status dos recebíveis também
  const overdueInstallments = await db.select()
    .from(receivableInstallments)
    .where(eq(receivableInstallments.status, "VENCIDO"));
  
  const receivableIds = Array.from(new Set(overdueInstallments.map(i => i.receivableId)));
  
  for (const id of receivableIds) {
    await updateReceivableStatus(id);
  }
}

// Resumo de recebíveis
export async function getReceivablesSummary() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Total a receber (parcelas pendentes)
  const pending = await db.select({
    total: sql<string>`COALESCE(SUM(${receivableInstallments.amount}), 0)`
  })
  .from(receivableInstallments)
  .where(eq(receivableInstallments.status, "PENDENTE"));
  
  // Total vencido
  const overdue = await db.select({
    total: sql<string>`COALESCE(SUM(${receivableInstallments.amount}), 0)`
  })
  .from(receivableInstallments)
  .where(and(
    eq(receivableInstallments.status, "PENDENTE"),
    sql`${receivableInstallments.dueDate} < ${today}`
  ));
  
  // Total recebido hoje
  const receivedToday = await db.select({
    total: sql<string>`COALESCE(SUM(${receivableInstallments.paidAmount}), 0)`
  })
  .from(receivableInstallments)
  .where(and(
    eq(receivableInstallments.status, "PAGO"),
    sql`DATE(${receivableInstallments.paidDate}) = DATE(${today})`
  ));
  
  return {
    totalPending: parseFloat(pending[0]?.total || "0"),
    totalOverdue: parseFloat(overdue[0]?.total || "0"),
    receivedToday: parseFloat(receivedToday[0]?.total || "0")
  };
}



// Listar clientes com saldo devedor
export async function getCustomersWithPendingReceivables() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar todos os recebíveis pendentes agrupados por cliente
  const results = await db.select({
    customerId: receivables.customerId,
    customerName: partners.name,
    totalPending: sql<string>`SUM(GREATEST(0, CAST(${receivables.totalAmount} AS DECIMAL(10,2)) - CAST(${receivables.receivedAmount} AS DECIMAL(10,2))))`,
    salesCount: sql<number>`COUNT(DISTINCT ${receivables.saleId})`
  })
  .from(receivables)
  .leftJoin(partners, eq(receivables.customerId, partners.id))
  .where(sql`${receivables.status} IN ('PENDENTE', 'PARCIAL', 'VENCIDO')`)
  .groupBy(receivables.customerId, partners.name)
  .having(sql`SUM(CAST(${receivables.totalAmount} AS DECIMAL(10,2)) - CAST(${receivables.receivedAmount} AS DECIMAL(10,2))) > 0`)
  .orderBy(desc(sql`SUM(CAST(${receivables.totalAmount} AS DECIMAL(10,2)) - CAST(${receivables.receivedAmount} AS DECIMAL(10,2)))`));
  
  return results;
}

// Obter total pendente de todos os clientes
export async function getTotalPendingReceivables() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select({
    total: sql<string>`COALESCE(SUM(GREATEST(0, CAST(${receivables.totalAmount} AS DECIMAL(10,2)) - CAST(${receivables.receivedAmount} AS DECIMAL(10,2)))), 0)`
  })
  .from(receivables)
  .where(sql`${receivables.status} IN ('PENDENTE', 'PARCIAL', 'VENCIDO')`);
  
  return parseFloat(result[0]?.total || "0");
}

// Obter detalhamento completo de um cliente
export async function getCustomerReceivableDetail(customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar informações do cliente
  const customer = await db.select().from(partners).where(eq(partners.id, customerId)).limit(1);
  if (!customer[0]) throw new Error("Cliente não encontrado");
  
  // Buscar todas as vendas A_PRAZO do cliente com recebíveis
  const salesWithReceivables = await db.select({
    sale: sales,
    receivable: receivables
  })
  .from(sales)
  .leftJoin(receivables, eq(sales.id, receivables.saleId))
  .where(and(
    eq(sales.customerId, customerId),
    eq(sales.saleType, "A_PRAZO")
  ))
  .orderBy(desc(sales.saleDate));
  
  // Para cada venda, buscar itens e parcelas
  const salesWithDetails = await Promise.all(
    salesWithReceivables.map(async (item) => {
      const items = await db.select({
        productId: saleItems.productId,
        productName: products.name,
        quantity: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        totalPrice: saleItems.totalPrice
      })
      .from(saleItems)
      .leftJoin(products, eq(saleItems.productId, products.id))
      .where(eq(saleItems.saleId, item.sale.id!));
      
      let installments: any[] = [];
      if (item.receivable) {
        installments = await db.select()
          .from(receivableInstallments)
          .where(eq(receivableInstallments.receivableId, item.receivable.id!))
          .orderBy(receivableInstallments.installmentNumber);
      }
      
      const totalAmount = parseFloat(item.sale.finalAmount || "0");
      const paidAmount = item.receivable ? parseFloat(item.receivable.receivedAmount || "0") : 0;
      const pendingAmount = totalAmount - paidAmount;
      
      return {
        ...item.sale,
        receivable: item.receivable,
        items,
        installments,
        totalAmount: totalAmount.toFixed(2),
        paidAmount: paidAmount.toFixed(2),
        pendingAmount: pendingAmount.toFixed(2)
      };
    })
  );
  
  // Calcular total pendente (ignorar saldos negativos de pagamentos a maior)
  const totalPending = salesWithDetails.reduce((sum, sale) => {
    const pending = parseFloat(sale.pendingAmount);
    return sum + (pending > 0 ? pending : 0);
  }, 0);
  
  // Buscar histórico de pagamentos da nova tabela receivablePayments
  const payments = await db.select({
    paidDate: receivablePayments.paidDate,
    paidAmount: receivablePayments.paidAmount,
    paymentMethod: receivablePayments.paymentMethod,
    notes: receivablePayments.notes,
    createdAt: receivablePayments.createdAt
  })
  .from(receivablePayments)
  .where(eq(receivablePayments.customerId, customerId))
  .orderBy(desc(receivablePayments.paidDate));
  
  return {
    customer: customer[0],
    sales: salesWithDetails,
    payments,
    totalPending: totalPending.toFixed(2)
  };
}

// Registrar recebimento para um cliente (aplicado na venda mais antiga ou específica)
export async function registerCustomerPayment(data: {
  customerId: number;
  saleId?: number;
  paidDate: Date;
  paidAmount: string;
  paymentMethod: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const amount = parseFloat(data.paidAmount);
  let remainingAmount = amount;
  
  // Se saleId foi especificado, aplicar apenas nessa venda
  if (data.saleId) {
    const receivable = await db.select()
      .from(receivables)
      .where(and(
        eq(receivables.saleId, data.saleId),
        eq(receivables.customerId, data.customerId)
      ))
      .limit(1);
    
    if (!receivable[0]) throw new Error("Recebível não encontrado");
    
    // Buscar parcelas pendentes dessa venda
    const pendingInstallments = await db.select()
      .from(receivableInstallments)
      .where(and(
        eq(receivableInstallments.receivableId, receivable[0].id!),
        sql`${receivableInstallments.status} IN ('PENDENTE', 'PARCIAL', 'VENCIDO')`
      ))
      .orderBy(receivableInstallments.installmentNumber);
    
    // Aplicar pagamento nas parcelas
    for (const installment of pendingInstallments) {
      if (remainingAmount <= 0) break;
      
      const installmentAmount = parseFloat(installment.amount);
      const alreadyPaid = parseFloat(installment.paidAmount || "0");
      const installmentPending = installmentAmount - alreadyPaid;
      
      const paymentForThisInstallment = Math.min(remainingAmount, installmentPending);
      const newPaidAmount = alreadyPaid + paymentForThisInstallment;
      
      // Criar registro de pagamento no histórico
      await db.insert(receivablePayments).values({
        installmentId: installment.id!,
        receivableId: receivable[0].id!,
        customerId: data.customerId,
        paidDate: data.paidDate,
        paidAmount: paymentForThisInstallment.toFixed(2),
        paymentMethod: data.paymentMethod,
        notes: data.notes
      });
      
      // Atualizar parcela com totais acumulados
      await db.update(receivableInstallments)
        .set({
          paidDate: data.paidDate,
          paidAmount: newPaidAmount.toFixed(2),
          paymentMethod: data.paymentMethod,
          status: newPaidAmount >= installmentAmount ? "PAGO" : "PARCIAL"
        })
        .where(eq(receivableInstallments.id, installment.id!));
      
      remainingAmount -= paymentForThisInstallment;
    }
    
    // Atualizar recebível
    await updateReceivableStatus(receivable[0].id!);
    
  } else {
    // Aplicar na venda mais antiga (FIFO)
    const receivablesWithPending = await db.select()
      .from(receivables)
      .where(and(
        eq(receivables.customerId, data.customerId),
        sql`${receivables.status} IN ('PENDENTE', 'PARCIAL', 'VENCIDO')`
      ))
      .orderBy(receivables.createdAt); // Mais antiga primeiro
    
    for (const receivable of receivablesWithPending) {
      if (remainingAmount <= 0) break;
      
      // Buscar parcelas pendentes
      const pendingInstallments = await db.select()
        .from(receivableInstallments)
        .where(and(
          eq(receivableInstallments.receivableId, receivable.id!),
          sql`${receivableInstallments.status} IN ('PENDENTE', 'PARCIAL', 'VENCIDO')`
        ))
        .orderBy(receivableInstallments.installmentNumber);
      
      // Aplicar pagamento nas parcelas
      for (const installment of pendingInstallments) {
        if (remainingAmount <= 0) break;
        
        const installmentAmount = parseFloat(installment.amount);
        const alreadyPaid = parseFloat(installment.paidAmount || "0");
        const installmentPending = installmentAmount - alreadyPaid;
        
        const paymentForThisInstallment = Math.min(remainingAmount, installmentPending);
        const newPaidAmount = alreadyPaid + paymentForThisInstallment;
        
        // Criar registro de pagamento no histórico
        await db.insert(receivablePayments).values({
          installmentId: installment.id!,
          receivableId: receivable.id!,
          customerId: data.customerId,
          paidDate: data.paidDate,
          paidAmount: paymentForThisInstallment.toFixed(2),
          paymentMethod: data.paymentMethod,
          notes: data.notes
        });
        
        // Atualizar parcela com totais acumulados
        await db.update(receivableInstallments)
          .set({
            paidDate: data.paidDate,
            paidAmount: newPaidAmount.toFixed(2),
            paymentMethod: data.paymentMethod,
            status: newPaidAmount >= installmentAmount ? "PAGO" : "PARCIAL"
          })
          .where(eq(receivableInstallments.id, installment.id!));
        
        remainingAmount -= paymentForThisInstallment;
      }
      
      // Atualizar recebível
      await updateReceivableStatus(receivable.id!);
    }
  }
  
  // Atualizar saldo do cliente
  const currentBalance = await db.select({ balance: partners.currentBalance })
    .from(partners)
    .where(eq(partners.id, data.customerId))
    .limit(1);
  
  const newBalance = parseFloat(currentBalance[0]?.balance || "0") - amount;
  
  await db.update(partners)
    .set({ currentBalance: newBalance.toFixed(2) })
    .where(eq(partners.id, data.customerId));
  
  return { success: true, appliedAmount: amount - remainingAmount };
}



// ==================== CONTAS A PAGAR ====================

// Listar fornecedores com saldo devedor (contas a pagar pendentes)
export async function getSuppliersWithPendingPayables() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar pendências de COMPRAS (purchaseInstallments)
  const purchasePendings = await db.select({
    supplierId: purchaseOrders.supplierId,
    totalPending: sql<string>`SUM(CAST(${purchaseInstallments.amount} AS DECIMAL(10,2)))`
  })
  .from(purchaseInstallments)
  .leftJoin(purchaseOrders, eq(purchaseInstallments.purchaseOrderId, purchaseOrders.id))
  .where(eq(purchaseInstallments.status, 'PENDING'))
  .groupBy(purchaseOrders.supplierId);
  
  // Buscar pendências de DESPESAS (expenseInstallments)
  const expensePendings = await db.select({
    supplierId: expenses.supplierId,
    totalPending: sql<string>`SUM(CAST(${expenseInstallments.amount} AS DECIMAL(10,2)))`
  })
  .from(expenseInstallments)
  .leftJoin(expenses, eq(expenseInstallments.expenseId, expenses.id))
  .where(eq(expenseInstallments.status, 'PENDENTE'))
  .groupBy(expenses.supplierId);
  
  // Consolidar por fornecedor
  const supplierMap = new Map<number, { totalPending: number; count: number }>();
  
  for (const p of purchasePendings) {
    if (!p.supplierId) continue;
    const current = supplierMap.get(p.supplierId) || { totalPending: 0, count: 0 };
    current.totalPending += parseFloat(p.totalPending || "0");
    current.count++;
    supplierMap.set(p.supplierId, current);
  }
  
  for (const e of expensePendings) {
    if (!e.supplierId) continue;
    const current = supplierMap.get(e.supplierId) || { totalPending: 0, count: 0 };
    current.totalPending += parseFloat(e.totalPending || "0");
    current.count++;
    supplierMap.set(e.supplierId, current);
  }
  
  // Buscar nomes dos fornecedores e montar resultado
  const results = [];
  for (const [supplierId, data] of Array.from(supplierMap.entries())) {
    const supplier = await db.select().from(partners).where(eq(partners.id, supplierId)).limit(1);
    if (supplier[0]) {
      results.push({
        supplierId,
        supplierName: supplier[0].name,
        totalPending: data.totalPending.toFixed(2),
        expensesCount: data.count
      });
    }
  }
  
  // Ordenar por valor pendente (maior primeiro)
  results.sort((a, b) => parseFloat(b.totalPending) - parseFloat(a.totalPending));
  
  return results;
}

// Obter total pendente de pagamento a todos os fornecedores
export async function getTotalPendingPayables() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Total de compras pendentes
  const purchaseResult = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${purchaseInstallments.amount} AS DECIMAL(10,2))), 0)`
  })
  .from(purchaseInstallments)
  .where(eq(purchaseInstallments.status, 'PENDING'));
  
  // Total de despesas pendentes
  const expenseResult = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${expenseInstallments.amount} AS DECIMAL(10,2))), 0)`
  })
  .from(expenseInstallments)
  .where(eq(expenseInstallments.status, 'PENDENTE'));
  
  const purchaseTotal = parseFloat(purchaseResult[0]?.total || "0");
  const expenseTotal = parseFloat(expenseResult[0]?.total || "0");
  
  return purchaseTotal + expenseTotal;
}

// Obter detalhamento completo de um fornecedor
export async function getSupplierPayableDetail(supplierId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar informações do fornecedor
  const supplier = await db.select().from(partners).where(eq(partners.id, supplierId)).limit(1);
  if (!supplier[0]) throw new Error("Fornecedor não encontrado");
  
  const allInstallments: any[] = [];
  
  // 1. Buscar parcelas de COMPRAS
  const purchases = await db.select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.supplierId, supplierId))
    .orderBy(desc(purchaseOrders.createdAt));
  
  for (const purchase of purchases) {
    const installments = await db.select()
      .from(purchaseInstallments)
      .where(eq(purchaseInstallments.purchaseOrderId, purchase.id))
      .orderBy(purchaseInstallments.installmentNumber);
    
    const docTypeLabel = purchase.docType === 'NOTA_FISCAL' ? 'NF' : 
                        purchase.docType === 'CUPOM' ? 'Cupom' : 'Doc';
    
    for (const inst of installments) {
      const amount = parseFloat(inst.amount || "0");
      const isPaid = inst.status === 'PAID';
      allInstallments.push({
        id: inst.id,
        type: 'purchase',
        purchaseOrderId: purchase.id,
        expenseId: null,
        supplierId: purchase.supplierId,
        categoryId: null,
        description: `Compra #${purchase.id} - ${docTypeLabel} ${purchase.docNumber || 's/n'} - Parcela ${inst.installmentNumber}`,
        installmentNumber: inst.installmentNumber,
        totalInstallments: installments.length,
        expenseDate: purchase.createdAt || new Date(),
        dueDate: inst.dueDate || new Date(),
        paidDate: inst.paidDate || null,
        paymentMethod: null,
        notes: null,
        origin: 'Compra',
        status: inst.status || 'PENDING',
        totalAmount: amount.toFixed(2),
        paidAmount: isPaid ? amount.toFixed(2) : "0.00",
        pendingAmount: isPaid ? "0.00" : amount.toFixed(2)
      });
    }
  }
  
  // 2. Buscar parcelas de DESPESAS
  const expensesList = await db.select()
    .from(expenses)
    .where(eq(expenses.supplierId, supplierId))
    .orderBy(desc(expenses.createdAt));
  
  for (const expense of expensesList) {
    const installments = await db.select()
      .from(expenseInstallments)
      .where(eq(expenseInstallments.expenseId, expense.id))
      .orderBy(expenseInstallments.installmentNumber);
    
    for (const inst of installments) {
      const amount = parseFloat(inst.amount || "0");
      const paid = parseFloat(inst.paymentAmount || "0");
      const pending = amount - paid;
      
      allInstallments.push({
        id: inst.id,
        type: 'expense',
        purchaseOrderId: null,
        expenseId: expense.id,
        supplierId: expense.supplierId,
        categoryId: expense.categoryId,
        description: `${expense.description || 'Despesa'} - Parcela ${inst.installmentNumber}/${installments.length}`,
        installmentNumber: inst.installmentNumber,
        totalInstallments: installments.length,
        expenseDate: expense.createdAt || new Date(),
        dueDate: inst.dueDate || new Date(),
        paidDate: inst.paymentDate || null,
        paymentMethod: inst.paymentMethod || null,
        notes: inst.notes || null,
        origin: 'Despesa',
        status: inst.status || 'PENDENTE',
        totalAmount: amount.toFixed(2),
        paidAmount: paid.toFixed(2),
        pendingAmount: pending.toFixed(2)
      });
    }
  }
  
  // Ordenar por data de vencimento
  allInstallments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  
  // Calcular total pendente
  const totalPending = allInstallments.reduce((sum, inst) => 
    sum + parseFloat(inst.pendingAmount), 0
  );
  
  return {
    supplier: supplier[0],
    expenses: allInstallments,
    payments: [], // TODO: implementar histórico de pagamentos consolidado
    totalPending: totalPending.toFixed(2)
  };
}



// Atualizar status da despesa baseado nas parcelas
export async function updateExpenseStatus(expenseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar todas as parcelas da despesa
  const installments = await db.select()
    .from(expenseInstallments)
    .where(eq(expenseInstallments.expenseId, expenseId));
  
  if (installments.length === 0) return;
  
  // Verificar se todas as parcelas estão pagas
  const allPaid = installments.every(i => i.status === 'PAGO');
  
  // Atualizar status da despesa
  await db.update(expenses)
    .set({ status: allPaid ? 'PAGA' : 'ATIVA' })
    .where(eq(expenses.id, expenseId));
}

// Registrar pagamento para um fornecedor
export async function registerSupplierPayment(data: {
  supplierId: number;
  expenseId?: number;
  paidDate: Date;
  paidAmount: string;
  paymentMethod: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const amount = parseFloat(data.paidAmount);
  let remainingAmount = amount;
  
  // Se expenseId foi especificado, aplicar apenas nessa despesa
  if (data.expenseId) {
    const expense = await db.select()
      .from(expenses)
      .where(and(
        eq(expenses.id, data.expenseId),
        eq(expenses.supplierId, data.supplierId)
      ))
      .limit(1);
    
    if (!expense[0]) throw new Error("Despesa não encontrada");
    
    // Buscar parcelas pendentes dessa despesa
    const pendingInstallments = await db.select()
      .from(expenseInstallments)
      .where(and(
        eq(expenseInstallments.expenseId, expense[0].id!),
        sql`${expenseInstallments.status} IN ('PENDENTE', 'VENCIDA')`
      ))
      .orderBy(expenseInstallments.installmentNumber);
    
    // Aplicar pagamento nas parcelas
    for (const installment of pendingInstallments) {
      if (remainingAmount <= 0) break;
      
      const installmentAmount = parseFloat(installment.amount);
      const alreadyPaid = parseFloat(installment.paymentAmount || "0");
      const installmentPending = installmentAmount - alreadyPaid;
      
      const paymentForThisInstallment = Math.min(remainingAmount, installmentPending);
      const newPaidAmount = alreadyPaid + paymentForThisInstallment;
      
      await db.update(expenseInstallments)
        .set({
          paymentDate: data.paidDate,
          paymentAmount: newPaidAmount.toFixed(2),
          paymentMethod: data.paymentMethod,
          notes: data.notes,
          status: newPaidAmount >= installmentAmount ? "PAGO" : "PENDENTE"
        })
        .where(eq(expenseInstallments.id, installment.id!));
      
      remainingAmount -= paymentForThisInstallment;
    }
    
    // Atualizar status da despesa
    await updateExpenseStatus(expense[0].id!);
    
  } else {
    // Aplicar na despesa mais antiga (FIFO)
    const expensesWithPending = await db.select()
      .from(expenses)
      .where(and(
        eq(expenses.supplierId, data.supplierId),
        eq(expenses.status, 'ATIVA')
      ))
      .orderBy(expenses.createdAt); // Mais antiga primeiro
    
    for (const expense of expensesWithPending) {
      if (remainingAmount <= 0) break;
      
      // Buscar parcelas pendentes
      const pendingInstallments = await db.select()
        .from(expenseInstallments)
        .where(and(
          eq(expenseInstallments.expenseId, expense.id!),
          sql`${expenseInstallments.status} IN ('PENDENTE', 'VENCIDA')`
        ))
        .orderBy(expenseInstallments.installmentNumber);
      
      // Aplicar pagamento nas parcelas
      for (const installment of pendingInstallments) {
        if (remainingAmount <= 0) break;
        
        const installmentAmount = parseFloat(installment.amount);
        const alreadyPaid = parseFloat(installment.paymentAmount || "0");
        const installmentPending = installmentAmount - alreadyPaid;
        
        const paymentForThisInstallment = Math.min(remainingAmount, installmentPending);
        const newPaidAmount = alreadyPaid + paymentForThisInstallment;
        
        await db.update(expenseInstallments)
          .set({
            paymentDate: data.paidDate,
            paymentAmount: newPaidAmount.toFixed(2),
            paymentMethod: data.paymentMethod,
            notes: data.notes,
            status: newPaidAmount >= installmentAmount ? "PAGO" : "PENDENTE"
          })
          .where(eq(expenseInstallments.id, installment.id!));
        
        remainingAmount -= paymentForThisInstallment;
      }
      
      // Atualizar status da despesa
      await updateExpenseStatus(expense.id!);
    }
  }
  
  // Atualizar saldo do fornecedor
  const currentBalance = await db.select({ balance: partners.currentBalance })
    .from(partners)
    .where(eq(partners.id, data.supplierId))
    .limit(1);
  
  const newBalance = parseFloat(currentBalance[0]?.balance || "0") + amount;
  
  await db.update(partners)
    .set({ currentBalance: newBalance.toFixed(2) })
    .where(eq(partners.id, data.supplierId));
  
  return { success: true, appliedAmount: amount - remainingAmount };
}


// ==================== FUNÇÕES PARA EDIÇÃO DE VENDAS ====================

export async function deleteSaleItems(saleId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  await database.delete(saleItems)
    .where(eq(saleItems.saleId, saleId));
}

export async function createSaleItem(data: {
  saleId: number;
  productId: number;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  const [result] = await database.insert(saleItems).values(data);
  return result.insertId;
}

export async function updateSale(saleId: number, data: {
  subtotal?: string;
  finalAmount?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  await database.update(sales)
    .set(data)
    .where(eq(sales.id, saleId));
}

export async function getReceivableBySaleId(saleId: number) {
  const database = await getDb();
  if (!database) return null;
  
  const result = await database.select()
    .from(receivables)
    .where(eq(receivables.saleId, saleId))
    .limit(1);
  
  return result[0] || null;
}

export async function updateReceivableBySaleId(saleId: number, data: {
  totalAmount?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  await database.update(receivables)
    .set(data)
    .where(eq(receivables.saleId, saleId));
}

export async function getPendingReceivablesByCustomer(customerId: number) {
  const database = await getDb();
  if (!database) return [];
  
  const result = await database.select()
    .from(receivables)
    .where(eq(receivables.customerId, customerId));
  
  // Filtrar apenas recebíveis com saldo pendente
  return result.filter(rec => {
    const total = parseFloat(rec.totalAmount);
    const received = parseFloat(rec.receivedAmount);
    return total > received && rec.status === 'PENDENTE';
  });
}


export async function getSalesCalendar(year: number, month: number) {
  const db = await getDb();
  if (!db) return [];

  // Buscar TODAS as vendas (sem filtro de data no SQL)
  // Vamos filtrar em JavaScript após converter para Brasília
  const allSales = await db.select().from(sales);

  // Agrupar por dia e canal
  const calendar: Record<number, { day: number; balcao: number; delivery: number; aPrazo: number; total: number; count: number }> = {};

  for (const sale of allSales) {
    const saleDate = new Date(sale.saleDate || sale.createdAt || new Date());
    
    // Converter para horário de Brasília para obter ano/mês/dia corretos
    const dateStr = saleDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const [datePart] = dateStr.split(', ');
    const [monthStr, dayStr, yearStr] = datePart.split('/');
    
    const saleYear = parseInt(yearStr, 10);
    const saleMonth = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    
    // Filtrar apenas vendas do mês/ano solicitado (APÓS conversão para Brasília)
    if (saleYear !== year || saleMonth !== month) {
      continue;
    }

    if (!calendar[day]) {
      calendar[day] = { day, balcao: 0, delivery: 0, aPrazo: 0, total: 0, count: 0 };
    }

    const amount = parseFloat(sale.finalAmount);
    calendar[day].total += amount;
    calendar[day].count += 1;

    if (sale.saleType === 'BALCAO') {
      calendar[day].balcao += amount;
    } else if (sale.saleType === 'DELIVERY') {
      calendar[day].delivery += amount;
    } else if (sale.saleType === 'A_PRAZO') {
      calendar[day].aPrazo += amount;
    }
  }

  return Object.values(calendar);
}


// ==================== CONTA CORRENTE (NOVO MODELO) ====================

/**
 * Calcula o saldo devedor de um cliente
 * Saldo = Σ(vendas A_PRAZO) - Σ(pagamentos)
 */
export async function getCustomerBalance(customerId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Soma total de vendas A_PRAZO
  const [salesResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${sales.finalAmount} AS DECIMAL(10,2))), 0)`
  })
  .from(sales)
  .where(and(
    eq(sales.customerId, customerId),
    eq(sales.saleType, "A_PRAZO")
  ));

  // Soma total de pagamentos
  const [paymentsResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${customerPayments.paidAmount} AS DECIMAL(10,2))), 0)`
  })
  .from(customerPayments)
  .where(eq(customerPayments.customerId, customerId));

  const totalSales = parseFloat(salesResult.total || "0");
  const totalPayments = parseFloat(paymentsResult.total || "0");
  
  return totalSales - totalPayments;
}

/**
 * Lista todos os clientes com saldo devedor > 0
 */
export async function getCustomersWithBalance() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar todos os clientes que têm vendas A_PRAZO
  const customersWithSales = await db.select({
    customerId: sales.customerId,
    customerName: partners.name,
    totalSales: sql<string>`SUM(CAST(${sales.finalAmount} AS DECIMAL(10,2)))`,
    salesCount: sql<number>`COUNT(${sales.id})`
  })
  .from(sales)
  .leftJoin(partners, eq(sales.customerId, partners.id))
  .where(eq(sales.saleType, "A_PRAZO"))
  .groupBy(sales.customerId, partners.name);

  // Para cada cliente, calcular saldo (vendas - pagamentos)
  const customersWithBalances = await Promise.all(
    customersWithSales.map(async (customer) => {
      if (!customer.customerId) return null;
      const balance = await getCustomerBalance(customer.customerId);
      return {
        customerId: customer.customerId,
        customerName: customer.customerName,
        totalPending: balance.toFixed(2),
        salesCount: customer.salesCount
      };
    })
  );

  // Filtrar apenas clientes com saldo > 0 e ordenar por saldo decrescente
  return customersWithBalances
    .filter((c): c is NonNullable<typeof c> => c !== null && parseFloat(c.totalPending) > 0)
    .sort((a, b) => parseFloat(b.totalPending) - parseFloat(a.totalPending));
}

/**
 * Busca histórico completo de um cliente (vendas + pagamentos)
 * Retorna lista ordenada cronologicamente com saldo acumulado
 */
export async function getCustomerAccountHistory(customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar informações do cliente
  const customer = await db.select().from(partners).where(eq(partners.id, customerId)).limit(1);
  if (!customer[0]) throw new Error("Cliente não encontrado");

  // Buscar todas as vendas A_PRAZO
  const customerSales = await db.select({
    id: sales.id,
    date: sales.saleDate,
    amount: sales.finalAmount,
    type: sql<string>`'SALE'`,
    description: sql<string>`CONCAT('Venda #', ${sales.id})`,
    paymentMethod: sales.paymentMethod
  })
  .from(sales)
  .where(and(
    eq(sales.customerId, customerId),
    eq(sales.saleType, "A_PRAZO")
  ));

  // Buscar todos os pagamentos
  const payments = await db.select({
    id: customerPayments.id,
    date: customerPayments.paidDate,
    amount: customerPayments.paidAmount,
    type: sql<string>`'PAYMENT'`,
    description: sql<string>`'Pagamento'`,
    paymentMethod: customerPayments.paymentMethod,
    notes: customerPayments.notes
  })
  .from(customerPayments)
  .where(eq(customerPayments.customerId, customerId));

  // Combinar e ordenar por data
  const history = [...customerSales, ...payments]
    .filter(item => item.date !== null)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());

  // Calcular saldo acumulado
  let balance = 0;
  const historyWithBalance = history.map(item => {
    const amount = parseFloat(item.amount);
    if (item.type === 'SALE') {
      balance += amount;
    } else {
      balance -= amount;
    }
    
    return {
      ...item,
      amount: amount.toFixed(2),
      balance: balance.toFixed(2)
    };
  });

  return {
    customer: customer[0],
    history: historyWithBalance,
    currentBalance: balance.toFixed(2)
  };
}

/**
 * Registra um pagamento na conta corrente do cliente (novo modelo)
 */
export async function registerPaymentToBalance(data: {
  customerId: number;
  paidDate: Date;
  paidAmount: string;
  paymentMethod: string;
  notes?: string;
  createdBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(customerPayments).values({
    customerId: data.customerId,
    paidDate: data.paidDate,
    paidAmount: data.paidAmount,
    paymentMethod: data.paymentMethod,
    notes: data.notes ?? null,
    createdBy: data.createdBy
  });

  return { success: true };
}
