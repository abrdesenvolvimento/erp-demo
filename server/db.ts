import { eq, desc, or, like, and, sql, gte, lte, lt, ne, SQL } from "drizzle-orm";
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
  customerPayments, CustomerPayment, InsertCustomerPayment,
  customerDebits, CustomerDebit, InsertCustomerDebit,
  productMovements, ProductMovement, InsertProductMovement,
  revenueGoals, RevenueGoal, InsertRevenueGoal,
  managementAccounts, ManagementAccount, InsertManagementAccount,
  accountingMappings, AccountingMapping, InsertAccountingMapping,
  chartOfAccounts, ChartOfAccount, InsertChartOfAccount,
  revenueAccounts, RevenueAccount, InsertRevenueAccount,
  revenueEntries, RevenueEntry, InsertRevenueEntry,
  backupLogs, BackupLog, InsertBackupLog,
  journals, Journal, InsertJournal,
  accountingEntries, AccountingEntry, InsertAccountingEntry,
  journalSources, JournalSource, InsertJournalSource,
  accountingPeriods, AccountingPeriod, InsertAccountingPeriod,
  governanceSettings, GovernanceSettings, InsertGovernanceSettings,
  governanceAuditLog, GovernanceAuditLog, InsertGovernanceAuditLog,
  accountingBatchLog, AccountingBatchLog, InsertAccountingBatchLog
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { 
  getSalesByCategory, 
  getPurchasesByCategory, 
  getSalesByPaymentType, 
  getStockByCategory, 
  getPurchasesBySupplier,
  getSalesByChannel 
} from './closingQueries';
import { 
  getTodayInBrazil, 
  getCurrentBrazilDateInfo, 
  formatDateForInput,
  startOfMonthBrazil,
  endOfMonthBrazil,
  toDateString,
  getCurrentMonthRangeBrazil,
  getCompetenceMonthBrazil
} from '../shared/dateUtils';

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
    
    // Atribuir role
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.id === ENV.ownerId) {
      values.role = 'admin';
      updateSet.role = 'admin';
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

export async function updateUser(userId: string, data: { name?: string; email?: string; role?: 'admin' | 'user' | 'operacional' | 'consultor' }) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  
  if (Object.keys(updateData).length === 0) return;
  
  await db.update(users).set(updateData).where(eq(users.id, userId));
}

export async function deleteUser(userId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  await db.delete(users).where(eq(users.id, userId));
}

// ==================== CATEGORIAS ====================
export async function getCategories(activeOnly = true, companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [];
  if (activeOnly) {
    conditions.push(eq(categories.active, true));
  }
  if (companyId) {
    conditions.push(eq(categories.companyId, companyId));
  }
  
  let query = db.select().from(categories);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(categories.name);
}

export async function createCategory(data: InsertCategory & { companyId?: number; branchId?: number }) {
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
export async function getSubcategories(categoryId?: number, companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [];
  if (categoryId) {
    conditions.push(eq(subcategories.categoryId, categoryId));
  }
  if (companyId) {
    conditions.push(eq(subcategories.companyId, companyId));
  }
  
  let query = db.select().from(subcategories);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
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
export async function getSalesChannels(activeOnly = true, companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [];
  if (activeOnly) {
    conditions.push(eq(salesChannels.active, true));
  }
  if (companyId) {
    conditions.push(eq(salesChannels.companyId, companyId));
  }
  
  let query = db.select().from(salesChannels);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
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
export async function getProducts(filters?: { search?: string; categoryId?: number; subcategoryId?: number; activeOnly?: boolean; includePrices?: boolean; companyId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  // Get products
  let query = db.select().from(products);
  const conditions = [];
  
  if (filters?.companyId) {
    conditions.push(eq(products.companyId, filters.companyId));
  }
  
  if (filters?.activeOnly !== false) {
    conditions.push(eq(products.active, true));
  }
  
  if (filters?.categoryId) {
    conditions.push(eq(products.categoryId, filters.categoryId));
  }
  
  if (filters?.subcategoryId) {
    conditions.push(eq(products.subcategoryId, filters.subcategoryId));
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
  
  // OTIMIZAÇÃO: Só carregar preços se explicitamente solicitado (includePrices=true)
  // Para autocomplete, passar includePrices=true para mostrar preços nas sugestões
  const shouldIncludePrices = filters?.includePrices === true;
  
  if (productList.length === 0) return [];
  
  if (!shouldIncludePrices) {
    // Retornar produtos sem preços para autocomplete (mais rápido)
    return productList.map(product => ({
      ...product,
      prices: []
    }));
  }
  
  // Get all prices in a single query
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
export async function getPartners(filters?: { search?: string; partnerType?: string; activeOnly?: boolean; companyId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(partners);
  const conditions = [];
  
  if (filters?.companyId) {
    conditions.push(eq(partners.companyId, filters.companyId));
  }
  
  if (filters?.activeOnly !== false) {
    conditions.push(eq(partners.active, true));
  }
  
  if (filters?.partnerType) {
    // Se buscar por SUPPLIER ou CUSTOMER, incluir também tipo BOTH
    if (filters.partnerType === 'SUPPLIER') {
      conditions.push(or(
        eq(partners.partnerType, 'SUPPLIER'),
        eq(partners.partnerType, 'BOTH')
      ));
    } else if (filters.partnerType === 'CUSTOMER') {
      conditions.push(or(
        eq(partners.partnerType, 'CUSTOMER'),
        eq(partners.partnerType, 'BOTH')
      ));
    } else {
      conditions.push(eq(partners.partnerType, filters.partnerType as any));
    }
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
export async function getSales(filters?: { saleType?: string; customerId?: number; limit?: number; dateFrom?: string; dateTo?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  // Se tem filtro de data, usar query SQL otimizada
  if (filters?.dateFrom || filters?.dateTo) {
    let whereConditions = `1=1`;
    
    if (filters?.saleType) {
      whereConditions += ` AND saleType = '${filters.saleType}'`;
    }
    
    if (filters?.customerId) {
      whereConditions += ` AND customerId = ${filters.customerId}`;
    }
    
    // OTIMIZAÇÃO: Usar range de timestamps ao invés de CONVERT_TZ
    // Isso permite usar o índice em saleDate
    // Brasília = UTC-3, então adicionamos 3 horas para converter para UTC
    if (filters?.dateFrom) {
      // Início do dia em Brasília (00:00) = 03:00 UTC
      whereConditions += ` AND saleDate >= '${filters.dateFrom} 03:00:00'`;
    }
    if (filters?.dateTo) {
      // Fim do dia em Brasília (23:59:59) = próximo dia 02:59:59 UTC
      whereConditions += ` AND saleDate < DATE_ADD('${filters.dateTo}', INTERVAL 1 DAY) + INTERVAL 3 HOUR`;
    }
    
    const limitClause = filters?.limit ? `LIMIT ${filters.limit}` : 'LIMIT 500';
    
    const result = await db.execute(sql.raw(`
      SELECT 
        id, saleType, 
        CONVERT_TZ(saleDate, '+00:00', '-03:00') as saleDate,
        customerId, channelId, platformOrderId,
        subtotal, discountAmount, surchargeAmount, finalAmount,
        paymentMethod, requiresAdminApproval, adminApprovedBy, notes,
        status, cancelledAt, cancelledBy, cancellationReason,
        createdBy, createdAt
      FROM sales 
      WHERE ${whereConditions}
      ORDER BY saleDate DESC
      ${limitClause}
    `));
    
    return (result[0] as unknown as any[]) || [];
  }
  
  // Query padrão sem filtro de data - usar SQL para converter timezone
  let whereConditions = `1=1`;
  
  if (filters?.saleType) {
    whereConditions += ` AND saleType = '${filters.saleType}'`;
  }
  
  if (filters?.customerId) {
    whereConditions += ` AND customerId = ${filters.customerId}`;
  }
  
  const limitClause = filters?.limit ? `LIMIT ${filters.limit}` : 'LIMIT 500';
  
  const result = await db.execute(sql.raw(`
    SELECT 
      id, saleType, 
      CONVERT_TZ(saleDate, '+00:00', '-03:00') as saleDate,
      customerId, channelId, platformOrderId,
      subtotal, discountAmount, surchargeAmount, finalAmount,
      paymentMethod, requiresAdminApproval, adminApprovedBy, notes,
      status, cancelledAt, cancelledBy, cancellationReason,
      createdBy, createdAt
    FROM sales 
    WHERE ${whereConditions}
    ORDER BY saleDate DESC
    ${limitClause}
  `));
  
  return (result[0] as unknown as any[]) || [];
}

export async function getSale(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Usar SQL raw para converter saleDate para timezone de Brasília
  // Incluir JOIN com users para retornar o nome do vendedor
  // Incluir JOIN com partners para retornar o nome do cliente
  const result = await db.execute(sql.raw(`
    SELECT 
      s.id, s.saleType, 
      CONVERT_TZ(s.saleDate, '+00:00', '-03:00') as saleDate,
      s.customerId, s.channelId, s.platformOrderId,
      s.subtotal, s.discountAmount, s.surchargeAmount, s.finalAmount,
      s.paymentMethod, s.requiresAdminApproval, s.adminApprovedBy, s.notes,
      s.status, s.cancelledAt, s.cancelledBy, s.cancellationReason,
      s.createdBy, s.createdAt,
      u.name as sellerName,
      COALESCE(p.tradeName, p.name) as customerName
    FROM sales s
    LEFT JOIN users u ON s.createdBy = u.id
    LEFT JOIN partners p ON s.customerId = p.id
    WHERE s.id = ${id} 
    LIMIT 1
  `));
  
  const rows = (result[0] as unknown as any[]) || [];
  return rows.length > 0 ? rows[0] : undefined;
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

export async function getSaleItemsBySaleIds(saleIds: number[]) {
  const db = await getDb();
  if (!db || saleIds.length === 0) return [];
  
  // Buscar itens com custo médio do produto
  const result = await db
    .select({
      id: saleItems.id,
      saleId: saleItems.saleId,
      productId: saleItems.productId,
      productName: products.name,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      totalPrice: saleItems.totalPrice,
      avgCost: products.avgCost,
    })
    .from(saleItems)
    .leftJoin(products, eq(saleItems.productId, products.id))
    .where(sql`${saleItems.saleId} IN (${sql.join(saleIds.map(id => sql`${id}`), sql`, `)})`);
  
  return result;
}

export async function createSale(saleData: InsertSale, items: Omit<InsertSaleItem, 'saleId'>[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar conta de receita automática pelo tipo de venda
  const revenueAccount = await getRevenueAccountBySaleType(saleData.saleType);
  if (revenueAccount) {
    saleData.revenueAccountId = revenueAccount.id;
  }
  
  // Inserir venda
  const saleResult = await db.insert(sales).values(saleData);
  console.log('[createSale] saleResult:', saleResult);
  // O insertId está no primeiro elemento do array
  const saleId = Number((saleResult as any)[0]?.insertId || (saleResult as any).insertId);
  console.log('[createSale] saleId:', saleId);
  
  // Inserir itens
  const itemsWithSaleId = items.map(item => ({ ...item, saleId }));
  await db.insert(saleItems).values(itemsWithSaleId);
  
  // Baixar estoque (considerando produtos compostos) e registrar movimentação
  for (const item of items) {
    await updateProductStockWithCompositions(item.productId, -item.quantity);
    
    // Registrar movimentação de SAIDA
    await createProductMovement({
      productId: item.productId,
      date: saleData.saleDate || new Date(),
      type: "SAIDA",
      quantity: (-item.quantity).toString(),
      documentNumber: `Venda #${saleId}`,
      userId: saleData.createdBy,
      notes: `Venda ${saleData.saleType} - ${saleData.paymentMethod || 'N/A'}`,
    });
  }
  
  // Atualizar saldo do cliente se for venda a prazo
  if (saleData.saleType === 'A_PRAZO' && saleData.customerId) {
    await db.update(partners)
      .set({ currentBalance: sql`${partners.currentBalance} + ${saleData.finalAmount}` })
      .where(eq(partners.id, saleData.customerId));
  }
  
  // Criar lançamentos contábeis de receita (sistema legado)
  try {
    await createRevenueEntriesForSale(
      saleId,
      saleData.saleType,
      saleData.finalAmount,
      saleData.discountAmount || '0',
      saleData.saleDate || new Date()
    );
  } catch (error) {
    console.error('[createSale] Erro ao criar lançamentos de receita:', error);
    // Não falhar a venda por causa de erro contábil
  }
  
  // ========== CONTABILIZAÇÃO AUTOMÁTICA ==========
  // D - Caixa ou Clientes / C - Receita de Vendas
  // D - CMV / C - Estoque
  try {
    // Calcular CMV (custo médio dos produtos vendidos)
    let cmvTotal = 0;
    for (const item of items) {
      const product = await db.select({ avgCost: products.avgCost })
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);
      if (product[0]) {
        const avgCost = parseFloat(product[0].avgCost || '0');
        cmvTotal += avgCost * item.quantity;
      }
    }
    
    // Determinar tipo de canal
    let channelType: "BALCAO" | "DELIVERY" | "A_PRAZO" = "BALCAO";
    if (saleData.saleType === "A_PRAZO") {
      channelType = "A_PRAZO";
    } else if (saleData.saleType === "DELIVERY") {
      channelType = "DELIVERY";
    }
    
    // Buscar nome do cliente se for venda a prazo
    let customerName: string | undefined;
    if (saleData.customerId) {
      const customer = await db.select({ name: partners.name, tradeName: partners.tradeName })
        .from(partners)
        .where(eq(partners.id, saleData.customerId))
        .limit(1);
      if (customer[0]) {
        customerName = customer[0].tradeName || customer[0].name || undefined;
      }
    }
    
    const accountingResult = await accountSale({
      saleId,
      totalAmount: saleData.finalAmount,
      cmvAmount: cmvTotal.toFixed(2),
      channelType,
      customerName,
      entryDate: saleData.saleDate || new Date(),
      createdBy: saleData.createdBy || "system",
    });
    
    if (accountingResult.success) {
      console.log(`[createSale] Contabilização criada - Journal #${accountingResult.journalId}`);
    } else {
      console.warn(`[createSale] Erro na contabilização: ${accountingResult.error}`);
    }
  } catch (accountingError) {
    console.error(`[createSale] Erro ao contabilizar:`, accountingError);
    // Não bloqueia a venda - apenas loga o erro
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
  
  // OTIMIZAÇÃO: Usar SQL diretamente com filtro de data
  // Isso evita carregar 120k+ registros na memória
  
  // Construir condições WHERE
  let whereConditions = `status != 'CANCELLED'`;
  
  // Filtro de data customizada (tem prioridade sobre period)
  if (dateFrom || dateTo) {
    // Usar range de timestamps ao invés de CONVERT_TZ para usar índice
    // Brasília = UTC-3, então adicionamos 3 horas para converter para UTC
    if (dateFrom) {
      // Início do dia em Brasília (00:00) = 03:00 UTC
      whereConditions += ` AND saleDate >= '${dateFrom} 03:00:00'`;
    }
    if (dateTo) {
      // Fim do dia em Brasília (23:59:59) = próximo dia 02:59:59 UTC
      whereConditions += ` AND saleDate < DATE_ADD('${dateTo}', INTERVAL 1 DAY) + INTERVAL 3 HOUR`;
    }
  } else if (period && period !== 'all') {
    // Obter data atual em Brasília
    const now = new Date();
    const nowBrasiliaStr = now.toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' }).split(',')[0]; // YYYY-MM-DD
    
    if (period === 'today') {
      whereConditions += ` AND saleDate >= '${nowBrasiliaStr} 03:00:00'`;
      whereConditions += ` AND saleDate < DATE_ADD('${nowBrasiliaStr}', INTERVAL 1 DAY) + INTERVAL 3 HOUR`;
    } else if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      const weekAgoStr = weekAgo.toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' }).split(',')[0];
      whereConditions += ` AND saleDate >= '${weekAgoStr} 03:00:00'`;
    } else if (period === 'month') {
      // Primeiro dia do mês atual
      const [year, month] = nowBrasiliaStr.split('-');
      const firstDayOfMonth = `${year}-${month}-01`;
      whereConditions += ` AND saleDate >= '${firstDayOfMonth} 03:00:00'`;
    }
  }
  
  // Filtro de canal
  if (channel) {
    whereConditions += ` AND saleType = '${channel}'`;
  }
  
  // Query SQL otimizada com GROUP BY
  const result = await db.execute(sql.raw(`
    SELECT 
      saleType,
      COUNT(*) as count,
      COALESCE(SUM(finalAmount), 0) as total
    FROM sales
    WHERE ${whereConditions}
    GROUP BY saleType
  `));
  
  const rows = (result[0] as unknown as any[]) || [];
  
  const stats = {
    balcao: { count: 0, total: 0 },
    delivery: { count: 0, total: 0 },
    aPrazo: { count: 0, total: 0 },
  };
  
  for (const row of rows) {
    const count = parseInt(row.count || '0', 10);
    const total = parseFloat(row.total || '0');
    
    if (row.saleType === 'BALCAO') {
      stats.balcao = { count, total };
    } else if (row.saleType === 'DELIVERY') {
      stats.delivery = { count, total };
    } else if (row.saleType === 'A_PRAZO') {
      stats.aPrazo = { count, total };
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

export async function getPurchaseOrders(filters?: { status?: string; supplierId?: number; startDate?: Date; endDate?: Date; docNumber?: string; minValue?: number; maxValue?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [];
  
  // Filtro de fornecedor
  if (filters?.supplierId) {
    conditions.push(eq(purchaseOrders.supplierId, filters.supplierId));
  }
  
  // Filtro de número de documento
  if (filters?.docNumber) {
    conditions.push(like(purchaseOrders.docNumber, `%${filters.docNumber}%`));
  }
  
  // Filtro de data (createdAt)
  if (filters?.startDate) {
    conditions.push(gte(purchaseOrders.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    // Adiciona 1 dia para incluir o dia final completo
    const endOfDay = new Date(filters.endDate);
    endOfDay.setDate(endOfDay.getDate() + 1);
    conditions.push(lt(purchaseOrders.createdAt, endOfDay));
  }
  
  let query = db.select({
    purchaseOrder: purchaseOrders,
    supplier: partners
  })
  .from(purchaseOrders)
  .leftJoin(partners, eq(purchaseOrders.supplierId, partners.id));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  query = query.orderBy(desc(purchaseOrders.createdAt)) as any;
  
  const results = await query;
  
  // Filtro de valor (aplicado após query pois precisa calcular total)
  if (filters?.minValue !== undefined || filters?.maxValue !== undefined) {
    return results.filter(r => {
      const total = parseFloat(r.purchaseOrder.totalAmount || '0');
      if (filters.minValue !== undefined && total < filters.minValue) return false;
      if (filters.maxValue !== undefined && total > filters.maxValue) return false;
      return true;
    });
  }
  
  return results;
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
  
  // Buscar ordem de compra para pegar frete e taxas
  const purchaseOrderData = await getPurchaseOrderById(purchaseOrderId);
  if (!purchaseOrderData) throw new Error("Ordem de compra não encontrada");
  
  const discount = parseFloat(purchaseOrderData.purchaseOrder.discount?.toString() || "0");
  const freightCost = parseFloat(purchaseOrderData.purchaseOrder.freightCost?.toString() || "0");
  const chargesCost = parseFloat(purchaseOrderData.purchaseOrder.chargesCost?.toString() || "0");
  const netAdjustment = -discount + freightCost + chargesCost;
  
  // Buscar itens da compra
  const items = await getPurchaseOrderItems(purchaseOrderId);
  
  // Calcular subtotal dos produtos para rateio
  let subtotal = 0;
  for (const item of items) {
    const quantity = parseFloat(item.quantity.toString());
    const unitCost = parseFloat(item.unitCost.toString());
    subtotal += quantity * unitCost;
  }
  
  // Calcular fator de rateio: (subtotal - desconto + frete + taxas) / subtotal
  const allocationFactor = subtotal > 0 ? (subtotal + netAdjustment) / subtotal : 1;
  
  console.log(`[confirmPurchaseOrder] Subtotal: R$ ${subtotal.toFixed(2)}, Desconto: R$ ${discount.toFixed(2)}, Frete: R$ ${freightCost.toFixed(2)}, Taxas: R$ ${chargesCost.toFixed(2)}, Fator: ${allocationFactor.toFixed(6)}`);
  
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
    
    // Aplicar fator de rateio ao custo unitário (inclui frete e taxas proporcionalmente)
    const adjustedUnitCost = unitCost * allocationFactor;
    
    console.log(`[confirmPurchaseOrder] Produto ${prod.name}: Custo original R$ ${unitCost.toFixed(4)}, Custo ajustado R$ ${adjustedUnitCost.toFixed(4)}`);
    
    // Calcular novo estoque
    const newStock = currentStock + quantityPurchased;
    
    // Calcular novo custo médio ponderado (RN-COMP-01) usando custo ajustado
    const newAvgCost = currentStock > 0
      ? (currentStock * currentAvgCost + quantityPurchased * adjustedUnitCost) / newStock
      : adjustedUnitCost;
    
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
    
    // Registrar movimentação de ENTRADA
    await createProductMovement({
      productId: prod.id,
      date: new Date(),
      type: "ENTRADA",
      quantity: quantityPurchased.toString(),
      documentNumber: purchaseOrderData.purchaseOrder.docNumber || `Compra #${purchaseOrderId}`,
      userId: purchaseOrderData.purchaseOrder.createdBy,
      notes: `Compra confirmada - Fornecedor: ${purchaseOrderData.supplier?.name || 'N/A'}`,
    });
    
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
  
  // ========== CONTABILIZAÇÃO AUTOMÁTICA ==========
  // D - Estoque de Mercadorias
  // C - Fornecedores
  const totalAmount = (subtotal + netAdjustment).toFixed(2);
  try {
    const accountingResult = await accountPurchaseConfirmation({
      purchaseOrderId,
      totalAmount,
      supplierId: purchaseOrderData.purchaseOrder.supplierId,
      supplierName: purchaseOrderData.supplier?.tradeName || purchaseOrderData.supplier?.name || "Fornecedor",
      docNumber: purchaseOrderData.purchaseOrder.docNumber || undefined,
      entryDate: purchaseOrderData.purchaseOrder.purchaseDate || new Date(),
      createdBy: purchaseOrderData.purchaseOrder.createdBy || "system",
    });
    
    if (accountingResult.success) {
      console.log(`[confirmPurchaseOrder] Contabilização criada - Journal #${accountingResult.journalId}`);
    } else {
      console.warn(`[confirmPurchaseOrder] Erro na contabilização: ${accountingResult.error}`);
    }
  } catch (accountingError) {
    console.error(`[confirmPurchaseOrder] Erro ao contabilizar:`, accountingError);
    // Não bloqueia a confirmação - apenas loga o erro
  }
}

/**
 * Cancela uma ordem de compra confirmada
 * - Reverte entrada de estoque
 * - Recalcula custo médio
 * - Cancela parcelas pendentes em Contas a Pagar
 * - Valida se não há parcelas já pagas
 */
export async function cancelPurchaseOrder(purchaseOrderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar ordem de compra
  const po = await getPurchaseOrderById(purchaseOrderId);
  if (!po) throw new Error("Ordem de compra não encontrada");
  
  // Validar se está confirmada
  if (po.purchaseOrder.status !== "CONFIRMED") {
    throw new Error("Apenas compras confirmadas podem ser canceladas");
  }
  
  // Verificar se há parcelas já pagas
  const installments = await getPurchaseInstallments(purchaseOrderId);
  const hasPaidInstallments = installments.some(i => i.status === "PAID");
  if (hasPaidInstallments) {
    throw new Error("Não é possível cancelar compra com parcelas já pagas");
  }
  
  // Buscar itens da compra
  const items = await getPurchaseOrderItems(purchaseOrderId);
  
  // Reverter estoque para cada item
  for (const item of items) {
    const product = await db.select().from(products).where(eq(products.id, item.productId || 0)).limit(1);
    if (product.length === 0) continue;
    const prod = product[0];
    
    const currentStock = parseFloat(prod.currentStock?.toString() || "0");
    const quantityPurchased = parseFloat(item.quantity.toString());
    
    // Calcular novo estoque (reverter entrada)
    const newStock = currentStock - quantityPurchased;
    
    if (newStock < 0) {
      throw new Error(`Estoque insuficiente para cancelar compra do produto ${prod.name}. Estoque atual: ${currentStock}, quantidade da compra: ${quantityPurchased}`);
    }
    
    // Atualizar estoque
    const updateData: any = { currentStock: newStock };
    
    // Buscar data de vencimento mais recente de compras CONFIRMED (excluindo a atual)
    const confirmedPurchases = await db.select()
      .from(purchaseOrderItems)
      .innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .where(and(
        eq(purchaseOrderItems.productId, item.productId),
        eq(purchaseOrders.status, "CONFIRMED"),
        ne(purchaseOrders.id, purchaseOrderId)
      ))
      .orderBy(desc(purchaseOrderItems.expiryDate));
    
    if (confirmedPurchases.length > 0 && confirmedPurchases[0].purchaseOrderItems.expiryDate) {
      updateData.expirationDate = confirmedPurchases[0].purchaseOrderItems.expiryDate;
    } else {
      updateData.expirationDate = null; // Sem compras confirmadas, limpar vencimento
    }
    
    await updateProduct(prod.id, updateData);
    
    // NOTA: Não recalculamos custo médio ao cancelar, pois isso pode gerar inconsistências
    // O custo médio reflete o histórico de compras e deve ser mantido
  }
  
  // Cancelar parcelas pendentes
  await db.update(purchaseInstallments)
    .set({ status: "CANCELLED" })
    .where(and(
      eq(purchaseInstallments.purchaseOrderId, purchaseOrderId),
      eq(purchaseInstallments.status, "PENDING")
    ));
  
  // Atualizar status da ordem de compra
  await updatePurchaseOrder(purchaseOrderId, { status: "CANCELLED" });
}

/**
 * Atualiza itens de uma ordem de compra
 * - Permite editar quantidade, custo unitário, data de vencimento
 * - Recalcula estoque e custo médio
 * - Atualiza valor total da compra
 * - Atualiza parcelas em Contas a Pagar
 */
export async function updatePurchaseOrderItems(
  purchaseOrderId: number, 
  items: Array<{
    id?: number;
    productId: number;
    quantity: string;
    unitCost: string;
    expiryDate?: Date | null;
  }>,
  costs?: {
    freightCost?: string;
    chargesCost?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Funções auxiliares para cálculo em centavos (evita erros de ponto flutuante)
  const toCents = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    return Math.round(parseFloat(value.toString()) * 100);
  };
  const fromCents = (cents: number): string => (cents / 100).toFixed(2);
  
  // Buscar ordem de compra
  const po = await getPurchaseOrderById(purchaseOrderId);
  if (!po) throw new Error("Ordem de compra não encontrada");
  
  // Validar se está confirmada
  if (po.purchaseOrder.status !== "CONFIRMED") {
    throw new Error("Apenas compras confirmadas podem ser editadas");
  }
  
  // Verificar parcelas para regra de recalculo
  const installments = await getPurchaseInstallments(purchaseOrderId);
  const hasPaidInstallments = installments.some(i => i.status === "PAID");
  const pendingInstallments = installments.filter(i => i.status === "PENDING");
  
  // Buscar itens atuais
  const currentItems = await getPurchaseOrderItems(purchaseOrderId);
  
  // Reverter estoque dos itens atuais
  for (const item of currentItems) {
    const product = await db.select().from(products).where(eq(products.id, item.productId || 0)).limit(1);
    if (product.length === 0) continue;
    const prod = product[0];
    
    const currentStock = parseFloat(prod.currentStock?.toString() || "0");
    const quantityPurchased = parseFloat(item.quantity.toString());
    const newStock = currentStock - quantityPurchased;
    
    await updateProduct(prod.id, { currentStock: newStock });
  }
  
  // Deletar itens atuais
  await deletePurchaseOrderItems(purchaseOrderId);
  
  // Adicionar novos itens e atualizar estoque
  let totalAmountCents = 0;
  for (const item of items) {
    const quantity = parseFloat(item.quantity);
    const unitCostCents = toCents(item.unitCost);
    const totalCostCents = Math.round(quantity * unitCostCents);
    totalAmountCents += totalCostCents;
    
    // Adicionar item
    await addPurchaseOrderItem({
      purchaseOrderId,
      productId: item.productId,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: fromCents(totalCostCents),
      expiryDate: item.expiryDate || null
    });
    
    // Atualizar estoque
    const product = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
    if (product.length === 0) continue;
    const prod = product[0];
    
    const currentStock = parseFloat(prod.currentStock?.toString() || "0");
    const currentAvgCostCents = toCents(prod.avgCost);
    const newStock = currentStock + quantity;
    
    // Calcular novo custo médio ponderado (em centavos)
    const newAvgCostCents = currentStock > 0
      ? Math.round((currentStock * currentAvgCostCents + quantity * unitCostCents) / newStock)
      : unitCostCents;
    
    const updateData: any = {
      currentStock: newStock,
      avgCost: (newAvgCostCents / 100).toFixed(4)
    };
    
    if (item.expiryDate) {
      updateData.expirationDate = item.expiryDate;
    }
    
    await updateProduct(prod.id, updateData);
    
    // Atualizar custo de produtos compostos
    await updateCompositeProductsUsingComponent(item.productId);
  }
  
  // Patch semantics: usar novos valores se fornecidos, senão manter valores do banco
  const freightCostCents = costs?.freightCost !== undefined 
    ? toCents(costs.freightCost) 
    : toCents(po.purchaseOrder.freightCost);
  const chargesCostCents = costs?.chargesCost !== undefined 
    ? toCents(costs.chargesCost) 
    : toCents(po.purchaseOrder.chargesCost);
  
  totalAmountCents += freightCostCents + chargesCostCents;
  
  // Atualizar valor total da compra
  await updatePurchaseOrder(purchaseOrderId, { totalAmount: fromCents(totalAmountCents) });
  
  // Atualizar parcelas em Contas a Pagar
  // Regra: Se houver parcela paga, apenas recalcula as pendentes proporcionalmente
  // Se todas pendentes, distribui igualmente
  if (pendingInstallments.length > 0) {
    if (hasPaidInstallments) {
      // Calcular quanto já foi pago
      const paidInstallments = installments.filter(i => i.status === "PAID");
      const paidAmountCents = paidInstallments.reduce((sum, i) => sum + toCents(i.amount), 0);
      
      // Valor restante a distribuir entre parcelas pendentes
      const remainingAmountCents = totalAmountCents - paidAmountCents;
      const installmentAmountCents = Math.round(remainingAmountCents / pendingInstallments.length);
      
      for (const installment of pendingInstallments) {
        await db.update(purchaseInstallments)
          .set({ amount: fromCents(installmentAmountCents) })
          .where(eq(purchaseInstallments.id, installment.id));
      }
    } else {
      // Todas pendentes: distribui igualmente
      const installmentAmountCents = Math.round(totalAmountCents / installments.length);
      
      for (const installment of pendingInstallments) {
        await db.update(purchaseInstallments)
          .set({ amount: fromCents(installmentAmountCents) })
          .where(eq(purchaseInstallments.id, installment.id));
      }
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

// Cancelar venda (admin only, 24h limit)
export async function cancelSale(saleId: number, userId: string, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar venda
  const sale = await getSale(saleId);
  if (!sale) throw new Error("Venda não encontrada");
  if (sale.status === "CANCELLED") throw new Error("Venda já está cancelada");

  // Validar limite de 24h
  const saleDate = new Date(sale.saleDate!);
  const now = new Date();
  const hoursDiff = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60);
  if (hoursDiff > 24) {
    throw new Error("Não é possível cancelar vendas com mais de 24 horas");
  }

  // Buscar itens da venda
  const items = await getSaleItems(saleId);

  // Reverter estoque
  for (const item of items) {
    await updateProductStockWithCompositions(item.productId, item.quantity);
  }

  // Reverter saldo do cliente se for venda a prazo
  if (sale.saleType === "A_PRAZO" && sale.customerId) {
    await db.update(partners)
      .set({ currentBalance: sql`${partners.currentBalance} - ${sale.finalAmount}` })
      .where(eq(partners.id, sale.customerId));

    // Deletar receivable e suas parcelas
    const receivable = await getReceivableBySaleId(saleId);
    if (receivable) {
      // Deletar parcelas do recebível
      await db.delete(receivableInstallments)
        .where(eq(receivableInstallments.receivableId, receivable.id));
      
      // Deletar pagamentos do recebível
      await db.delete(receivablePayments)
        .where(eq(receivablePayments.receivableId, receivable.id));
      
      // Deletar recebível
      await db.delete(receivables)
        .where(eq(receivables.id, receivable.id));
    }
  }

  // Marcar venda como cancelada
  await db.update(sales)
    .set({
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledBy: userId,
      cancellationReason: reason || null,
    })
    .where(eq(sales.id, saleId));
}

// Editar venda (admin only, 24h limit)
export async function updateSaleItems(saleId: number, updates: {
  items: { productId: number; quantity: number; unitPrice: string }[];
  discountAmount?: string;
  surchargeAmount?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar venda
  const sale = await getSale(saleId);
  if (!sale) throw new Error("Venda não encontrada");
  if (sale.status === "CANCELLED") throw new Error("Não é possível editar venda cancelada");

  // Validar limite de 24h
  const saleDate = new Date(sale.saleDate!);
  const now = new Date();
  const hoursDiff = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60);
  if (hoursDiff > 24) {
    throw new Error("Não é possível editar vendas com mais de 24 horas");
  }

  // Buscar itens atuais
  const currentItems = await getSaleItems(saleId);

  // Reverter estoque dos itens atuais
  for (const item of currentItems) {
    await updateProductStockWithCompositions(item.productId, item.quantity);
  }

  // Deletar itens atuais
  await db.delete(saleItems).where(eq(saleItems.saleId, saleId));

  // Inserir novos itens
  const itemsWithSaleId = updates.items.map(item => ({
    ...item,
    saleId,
    totalPrice: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
  }));
  await db.insert(saleItems).values(itemsWithSaleId);

  // Baixar estoque dos novos itens
  for (const item of updates.items) {
    await updateProductStockWithCompositions(item.productId, -item.quantity);
  }

  // Recalcular valores
  const subtotal = updates.items.reduce((sum, item) => {
    return sum + parseFloat(item.unitPrice) * item.quantity;
  }, 0);

  const discountAmount = parseFloat(updates.discountAmount || "0");
  const surchargeAmount = parseFloat(updates.surchargeAmount || "0");
  const finalAmount = subtotal - discountAmount + surchargeAmount;

  // Atualizar venda
  await db.update(sales)
    .set({
      subtotal: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      surchargeAmount: surchargeAmount.toFixed(2),
      finalAmount: finalAmount.toFixed(2),
    })
    .where(eq(sales.id, saleId));

  // Atualizar saldo do cliente se for venda a prazo
  if (sale.saleType === "A_PRAZO" && sale.customerId) {
    const oldAmount = parseFloat(sale.finalAmount as any);
    const diff = finalAmount - oldAmount;

    await db.update(partners)
      .set({ currentBalance: sql`${partners.currentBalance} + ${diff}` })
      .where(eq(partners.id, sale.customerId));

    // Atualizar receivable se existir
    const receivable = await getReceivableBySaleId(saleId);
    if (receivable) {
      await db.update(receivables)
        .set({ totalAmount: finalAmount.toFixed(2) })
        .where(eq(receivables.id, receivable.id));
    }
  }
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
  docNumber?: string;
  minValue?: number;
  maxValue?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select({
    expense: expenses,
    category: expenseCategories,
    supplier: partners,
    managementAccount: managementAccounts,
    accountingMapping: accountingMappings
  })
  .from(expenses)
  .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
  .leftJoin(partners, eq(expenses.supplierId, partners.id))
  .leftJoin(managementAccounts, eq(expenses.managementAccountId, managementAccounts.id))
  .leftJoin(accountingMappings, eq(managementAccounts.id, accountingMappings.managementAccountId));
  
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
  
  // Filtro de número de documento
  if (filters?.docNumber) {
    conditions.push(like(expenses.docNumber, `%${filters.docNumber}%`));
  }
  
  // Filtro de data (createdAt)
  if (filters?.startDate) {
    conditions.push(gte(expenses.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    // Adiciona 1 dia para incluir o dia final completo
    const endOfDay = new Date(filters.endDate);
    endOfDay.setDate(endOfDay.getDate() + 1);
    conditions.push(lt(expenses.createdAt, endOfDay));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const results = await query.orderBy(desc(expenses.createdAt));
  
  // Filtro de valor (aplicado após query pois precisa calcular total)
  if (filters?.minValue !== undefined || filters?.maxValue !== undefined) {
    return results.filter(r => {
      const total = parseFloat(r.expense.amount || '0');
      if (filters.minValue !== undefined && total < filters.minValue) return false;
      if (filters.maxValue !== undefined && total > filters.maxValue) return false;
      return true;
    });
  }
  
  return results;
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

  // Verificar se é conta de Perdas (pelo managementAccountId ou categoryId)
  let isPerdas = false;
  
  // Verificar por managementAccountId
  if (data.managementAccountId) {
    const account = await db.execute(sql.raw(`
      SELECT name FROM managementAccounts WHERE id = ${data.managementAccountId}
    `));
    const accountRows = account[0] as unknown as any[];
    if (accountRows[0]?.name === 'Perdas Estoque' || accountRows[0]?.name === 'Perdas Operacionais') {
      isPerdas = true;
    }
  }
  
  // Verificar por categoryId (compatibilidade)
  if (data.categoryId && !isPerdas) {
    const category = await db.select().from(expenseCategories).where(eq(expenseCategories.id, data.categoryId)).limit(1);
    if (category[0]?.name === 'Perdas') {
      isPerdas = true;
    }
  }
  
  // Se for Perdas, validar e calcular valor automaticamente
  if (isPerdas) {
    // Validar campos obrigatórios para Perdas
    if (!data.productId || !data.lossQuantity) {
      throw new Error("Para categoria Perdas, é necessário informar o produto e a quantidade perdida");
    }
    
    // Buscar produto e calcular valor da perda (custo médio × quantidade)
    const product = await db.select().from(products).where(eq(products.id, data.productId)).limit(1);
    
    if (!product[0]) {
      throw new Error("Produto não encontrado");
    }
    
    // Verificar se há estoque suficiente
    const currentStock = product[0].currentStock || 0;
    if (currentStock < data.lossQuantity) {
      throw new Error(`Estoque insuficiente. Disponível: ${currentStock}, Solicitado: ${data.lossQuantity}`);
    }
    
    // Calcular valor da perda
    const avgCost = parseFloat(product[0].avgCost || '0');
    const lossValue = avgCost * data.lossQuantity;
    
    // Atualizar valor da despesa
    data.amount = lossValue.toFixed(2);
    
    // Baixar estoque
    await db.update(products)
      .set({ 
        currentStock: currentStock - data.lossQuantity,
        updatedAt: new Date()
      })
      .where(eq(products.id, data.productId));
    
    // Registrar movimentação de PERDA (será feito após inserir a despesa)
    // Guardar dados para registro posterior
    (data as any)._shouldRegisterMovement = true;
    (data as any)._productId = data.productId;
    (data as any)._lossQuantity = data.lossQuantity;
    (data as any)._productName = product[0].name;
  }
  
  const result = await db.insert(expenses).values(data);
  const insertId = (result as any)[0]?.insertId || (result as any).insertId;
  const expenseId = insertId ? Number(insertId) : (await db.select().from(expenses).orderBy(desc(expenses.id)).limit(1))[0]?.id || 0;
  
  // Registrar movimentação de PERDA se for categoria Perdas
  if ((data as any)._shouldRegisterMovement) {
    await createProductMovement({
      productId: (data as any)._productId,
      date: new Date(),
      type: "PERDA",
      quantity: (-(data as any)._lossQuantity).toString(),
      documentNumber: `Despesa #${expenseId}`,
      userId: data.createdBy,
      notes: `Perda registrada - Produto: ${(data as any)._productName}`,
    });
  }
  
  return expenseId;
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

export async function deleteExpenseInstallments(expenseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Deletar apenas parcelas pendentes
  await db.delete(expenseInstallments)
    .where(and(
      eq(expenseInstallments.expenseId, expenseId),
      eq(expenseInstallments.status, "PENDENTE")
    ));
}

export async function getExpenseDetails(expenseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar parcelas da despesa
  const installments = await db.select()
    .from(expenseInstallments)
    .where(eq(expenseInstallments.expenseId, expenseId));
  
  return installments;
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
  interestAmount?: string;
  discountAmount?: string;
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
  const interestAmount = data.interestAmount ? parseFloat(data.interestAmount) : 0;
  const discountAmount = data.discountAmount ? parseFloat(data.discountAmount) : 0;
  
  // Valor efetivo pago (valor original + juros - desconto)
  const effectivePaid = paidAmount + interestAmount - discountAmount;
  
  // Atualizar parcela
  await db.update(purchaseInstallments)
    .set({
      paidDate: data.paidDate,
      paidAmount: effectivePaid.toFixed(2),
      paymentMethod: data.paymentMethod,
      interestAmount: interestAmount > 0 ? interestAmount.toFixed(2) : null,
      discountAmount: discountAmount > 0 ? discountAmount.toFixed(2) : null,
      notes: data.notes || null,
      status: paidAmount >= installmentAmount ? "PAID" : "PENDING"
    })
    .where(eq(purchaseInstallments.id, data.installmentId));
  
  // ========== CONTABILIZAÇÃO AUTOMÁTICA ==========
  // D - Fornecedores (valor original)
  // D - Juros Pagos (se houver)
  // C - Caixa/Banco (valor efetivo)
  // C - Descontos Obtidos (se houver)
  try {
    // Buscar dados da compra para obter informações do fornecedor
    const purchaseOrder = await getPurchaseOrderById(installment[0].purchaseOrderId);
    
    const accountingResult = await accountPurchasePayment({
      purchaseOrderId: installment[0].purchaseOrderId,
      installmentId: data.installmentId,
      originalAmount: paidAmount.toFixed(2),
      paidAmount: effectivePaid.toFixed(2),
      interestAmount: interestAmount > 0 ? interestAmount.toFixed(2) : undefined,
      discountAmount: discountAmount > 0 ? discountAmount.toFixed(2) : undefined,
      supplierName: purchaseOrder?.supplier?.tradeName || purchaseOrder?.supplier?.name || "Fornecedor",
      docNumber: purchaseOrder?.purchaseOrder.docNumber || undefined,
      entryDate: data.paidDate,
      createdBy: "system",
    });
    
    if (accountingResult.success) {
      console.log(`[payPurchaseInstallment] Contabilização criada - Journal #${accountingResult.journalId}`);
    } else {
      console.warn(`[payPurchaseInstallment] Erro na contabilização: ${accountingResult.error}`);
    }
  } catch (accountingError) {
    console.error(`[payPurchaseInstallment] Erro ao contabilizar:`, accountingError);
    // Não bloqueia o pagamento - apenas loga o erro
  }
  
  return { success: true, interestAmount, discountAmount };
}

// Pagar parcela de despesa
export async function payExpenseInstallment(data: {
  installmentId: number;
  paidDate: Date;
  paidAmount: string;
  paymentMethod: string;
  interestAmount?: string;
  discountAmount?: string;
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
  const interestAmount = data.interestAmount ? parseFloat(data.interestAmount) : 0;
  const discountAmount = data.discountAmount ? parseFloat(data.discountAmount) : 0;
  const alreadyPaid = parseFloat(installment[0].paymentAmount || "0");
  
  // Valor efetivo pago (valor original + juros - desconto)
  const effectivePaid = paidAmount + interestAmount - discountAmount;
  const newPaidAmount = alreadyPaid + effectivePaid;
  
  // Atualizar parcela
  await db.update(expenseInstallments)
    .set({
      paymentDate: data.paidDate,
      paymentAmount: newPaidAmount.toFixed(2),
      paymentMethod: data.paymentMethod,
      interestAmount: interestAmount > 0 ? interestAmount.toFixed(2) : null,
      discountAmount: discountAmount > 0 ? discountAmount.toFixed(2) : null,
      notes: data.notes,
      status: newPaidAmount >= installmentAmount ? "PAGO" : "PENDENTE"
    })
    .where(eq(expenseInstallments.id, data.installmentId));
  
  // Atualizar status da despesa
  await updateExpenseStatus(installment[0].expenseId);
  
  // ========== CONTABILIZAÇÃO AUTOMÁTICA ==========
  // D - Contas a Pagar (valor original)
  // D - Juros Pagos (se houver)
  // C - Caixa/Banco (valor efetivo)
  // C - Descontos Obtidos (se houver)
  try {
    // Buscar dados da despesa para obter descrição
    const expense = await getExpenseById(installment[0].expenseId);
    
    const accountingResult = await accountExpensePayment({
      expenseId: installment[0].expenseId,
      installmentId: data.installmentId,
      originalAmount: paidAmount.toFixed(2),
      paidAmount: effectivePaid.toFixed(2),
      interestAmount: interestAmount > 0 ? interestAmount.toFixed(2) : undefined,
      discountAmount: discountAmount > 0 ? discountAmount.toFixed(2) : undefined,
      description: expense?.description || `Despesa #${installment[0].expenseId}`,
      entryDate: data.paidDate,
      createdBy: "system",
    });
    
    if (accountingResult.success) {
      console.log(`[payExpenseInstallment] Contabilização criada - Journal #${accountingResult.journalId}`);
    } else {
      console.warn(`[payExpenseInstallment] Erro na contabilização: ${accountingResult.error}`);
    }
  } catch (accountingError) {
    console.error(`[payExpenseInstallment] Erro ao contabilizar:`, accountingError);
    // Não bloqueia o pagamento - apenas loga o erro
  }
  
  return { success: true, interestAmount, discountAmount };
}

// Atualizar status de parcelas vencidas
export async function updateOverdueExpenseInstallments() {
  const db = await getDb();
  if (!db) return;
  
  // Usar dateUtils para consistência de timezone
  const today = getTodayInBrazil();
  
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
  
  // Usar dateUtils para consistência de timezone
  const today = getTodayInBrazil();
  
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
  
  // Usar dateUtils para consistência de timezone
  const today = getTodayInBrazil();
  
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
  
  // Usar dateUtils para consistência de timezone
  const today = getTodayInBrazil();
  
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
  
  // Usar dateUtils para consistência de timezone
  const today = getTodayInBrazil();
  
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
    sql`DATE(CONVERT_TZ(${receivableInstallments.paidDate}, '+00:00', '-03:00')) = DATE(CONVERT_TZ(${today}, '+00:00', '-03:00'))`
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

// Obter total pendente de todos os clientes (usando sistema de conta corrente)
export async function getTotalPendingReceivables() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Soma total de vendas A_PRAZO de todos os clientes
  const [salesResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${sales.finalAmount} AS DECIMAL(10,2))), 0)`
  })
  .from(sales)
  .where(and(
    eq(sales.saleType, "A_PRAZO"),
    ne(sales.status, "CANCELLED")
  ));

  // Soma total de débitos manuais de todos os clientes
  const [debitsResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${customerDebits.debitAmount} AS DECIMAL(10,2))), 0)`
  })
  .from(customerDebits);

  // Soma total de pagamentos de todos os clientes
  const [paymentsResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${customerPayments.paidAmount} AS DECIMAL(10,2))), 0)`
  })
  .from(customerPayments);

  const totalSales = parseFloat(salesResult.total || "0");
  const totalDebits = parseFloat(debitsResult.total || "0");
  const totalPayments = parseFloat(paymentsResult.total || "0");
  
  return totalSales + totalDebits - totalPayments;
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
    eq(sales.saleType, "A_PRAZO"),
    eq(sales.status, "ACTIVE")
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
  const currentBalance = await db.select({ balance: partners.currentBalance, name: partners.name, tradeName: partners.tradeName })
    .from(partners)
    .where(eq(partners.id, data.customerId))
    .limit(1);
  
  const newBalance = parseFloat(currentBalance[0]?.balance || "0") - amount;
  const customerName = currentBalance[0]?.tradeName || currentBalance[0]?.name || `Cliente #${data.customerId}`;
  
  await db.update(partners)
    .set({ currentBalance: newBalance.toFixed(2) })
    .where(eq(partners.id, data.customerId));
  
  // ========== CONTABILIZAÇÃO AUTOMÁTICA ==========
  // D - Caixa/Banco
  // C - Clientes
  try {
    const accountingResult = await accountCustomerPayment({
      paymentId: Date.now(), // ID único para o pagamento
      customerId: data.customerId,
      customerName,
      amount: (amount - remainingAmount).toFixed(2), // Valor efetivamente aplicado
      entryDate: data.paidDate,
      createdBy: "system",
    });
    
    if (accountingResult.success) {
      console.log(`[registerCustomerPayment] Contabilização criada - Journal #${accountingResult.journalId}`);
    } else {
      console.warn(`[registerCustomerPayment] Erro na contabilização: ${accountingResult.error}`);
    }
  } catch (accountingError) {
    console.error(`[registerCustomerPayment] Erro ao contabilizar:`, accountingError);
    // Não bloqueia o recebimento - apenas loga o erro
  }
  
  return { success: true, appliedAmount: amount - remainingAmount };
}



// ==================== CONTAS A PAGAR ====================

// Listar TODOS os fornecedores com histórico (com ou sem saldo pendente)
export async function getAllSuppliersWithHistory() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar todos os fornecedores (tipo SUPPLIER ou BOTH)
  const allSuppliers = await db.select()
    .from(partners)
    .where(or(
      eq(partners.partnerType, 'SUPPLIER'),
      eq(partners.partnerType, 'BOTH')
    ))
    .orderBy(partners.name);
  
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
  
  // Buscar contagem total de transações por fornecedor (compras + despesas)
  const purchaseCounts = await db.select({
    supplierId: purchaseOrders.supplierId,
    count: sql<number>`COUNT(*)`
  })
  .from(purchaseOrders)
  .groupBy(purchaseOrders.supplierId);
  
  const expenseCounts = await db.select({
    supplierId: expenses.supplierId,
    count: sql<number>`COUNT(*)`
  })
  .from(expenses)
  .groupBy(expenses.supplierId);
  
  // Consolidar dados por fornecedor
  const supplierMap = new Map<number, { totalPending: number; transactionCount: number }>();
  
  // Inicializar todos os fornecedores com zero
  for (const supplier of allSuppliers) {
    supplierMap.set(supplier.id, { totalPending: 0, transactionCount: 0 });
  }
  
  // Adicionar pendências de compras
  for (const p of purchasePendings) {
    if (!p.supplierId) continue;
    const current = supplierMap.get(p.supplierId) || { totalPending: 0, transactionCount: 0 };
    current.totalPending += parseFloat(p.totalPending || "0");
    supplierMap.set(p.supplierId, current);
  }
  
  // Adicionar pendências de despesas
  for (const e of expensePendings) {
    if (!e.supplierId) continue;
    const current = supplierMap.get(e.supplierId) || { totalPending: 0, transactionCount: 0 };
    current.totalPending += parseFloat(e.totalPending || "0");
    supplierMap.set(e.supplierId, current);
  }
  
  // Adicionar contagem de compras
  for (const p of purchaseCounts) {
    if (!p.supplierId) continue;
    const current = supplierMap.get(p.supplierId) || { totalPending: 0, transactionCount: 0 };
    current.transactionCount += Number(p.count);
    supplierMap.set(p.supplierId, current);
  }
  
  // Adicionar contagem de despesas
  for (const e of expenseCounts) {
    if (!e.supplierId) continue;
    const current = supplierMap.get(e.supplierId) || { totalPending: 0, transactionCount: 0 };
    current.transactionCount += Number(e.count);
    supplierMap.set(e.supplierId, current);
  }
  
  // Montar resultado
  const results = allSuppliers.map(supplier => {
    const data = supplierMap.get(supplier.id) || { totalPending: 0, transactionCount: 0 };
    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      totalPending: data.totalPending.toFixed(2),
      transactionCount: data.transactionCount,
      hasPendingPayables: data.totalPending > 0
    };
  });
  
  // Ordenar: primeiro os com saldo pendente (maior primeiro), depois os sem saldo (alfabético)
  results.sort((a, b) => {
    if (a.hasPendingPayables && !b.hasPendingPayables) return -1;
    if (!a.hasPendingPayables && b.hasPendingPayables) return 1;
    if (a.hasPendingPayables && b.hasPendingPayables) {
      return parseFloat(b.totalPending) - parseFloat(a.totalPending);
    }
    return a.supplierName.localeCompare(b.supplierName);
  });
  
  return results;
}

// Listar fornecedores com saldo devedor (contas a pagar pendentes) - LEGADO
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
  discountAmount?: string;
  surchargeAmount?: string;
  finalAmount?: string;
  platformOrderId?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  // Patch semantics: só inclui campos que foram explicitamente passados (não undefined)
  const updateData: Record<string, any> = {};
  if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
  if (data.discountAmount !== undefined) updateData.discountAmount = data.discountAmount;
  if (data.surchargeAmount !== undefined) updateData.surchargeAmount = data.surchargeAmount;
  if (data.finalAmount !== undefined) updateData.finalAmount = data.finalAmount;
  if (data.platformOrderId !== undefined) updateData.platformOrderId = data.platformOrderId;
  
  if (Object.keys(updateData).length === 0) return;
  
  await database.update(sales)
    .set(updateData)
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

  // OTIMIZAÇÃO: Usar SQL com filtro de data para evitar carregar 120k+ registros
  // Calcular range de datas para o mês (considerando timezone Brasília = UTC-3)
  const monthStr = month.toString().padStart(2, '0');
  const firstDayOfMonth = `${year}-${monthStr}-01`;
  
  // Último dia do mês
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayOfMonth = `${year}-${monthStr}-${lastDay.toString().padStart(2, '0')}`;
  
  // Query SQL otimizada com GROUP BY dia
  const result = await db.execute(sql.raw(`
    SELECT 
      DAY(CONVERT_TZ(saleDate, '+00:00', '-03:00')) as day,
      saleType,
      COUNT(*) as count,
      COALESCE(SUM(finalAmount), 0) as total
    FROM sales
    WHERE status != 'CANCELLED'
      AND saleDate >= '${firstDayOfMonth} 03:00:00'
      AND saleDate < DATE_ADD('${lastDayOfMonth}', INTERVAL 1 DAY) + INTERVAL 3 HOUR
    GROUP BY DAY(CONVERT_TZ(saleDate, '+00:00', '-03:00')), saleType
    ORDER BY day
  `));
  
  const rows = (result[0] as unknown as any[]) || [];
  
  // Agrupar por dia
  const calendar: Record<number, { day: number; balcao: number; delivery: number; aPrazo: number; total: number; count: number }> = {};
  
  for (const row of rows) {
    const day = parseInt(row.day, 10);
    const total = parseFloat(row.total || '0');
    const count = parseInt(row.count || '0', 10);
    
    if (!calendar[day]) {
      calendar[day] = { day, balcao: 0, delivery: 0, aPrazo: 0, total: 0, count: 0 };
    }
    
    calendar[day].total += total;
    calendar[day].count += count;
    
    if (row.saleType === 'BALCAO') {
      calendar[day].balcao += total;
    } else if (row.saleType === 'DELIVERY') {
      calendar[day].delivery += total;
    } else if (row.saleType === 'A_PRAZO') {
      calendar[day].aPrazo += total;
    }
  }

  return Object.values(calendar);
}


// ==================== CONTA CORRENTE (NOVO MODELO) ====================

/**
 * Calcula o saldo devedor de um cliente
 * Saldo = Σ(vendas A_PRAZO) + Σ(débitos manuais) - Σ(pagamentos)
 */
export async function getCustomerBalance(customerId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Soma total de vendas A_PRAZO (excluindo canceladas)
  const [salesResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${sales.finalAmount} AS DECIMAL(10,2))), 0)`
  })
  .from(sales)
  .where(and(
    eq(sales.customerId, customerId),
    eq(sales.saleType, "A_PRAZO"),
    eq(sales.status, "ACTIVE")
  ));

  // Soma total de débitos manuais
  const [debitsResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${customerDebits.debitAmount} AS DECIMAL(10,2))), 0)`
  })
  .from(customerDebits)
  .where(eq(customerDebits.customerId, customerId));

  // Soma total de pagamentos
  const [paymentsResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${customerPayments.paidAmount} AS DECIMAL(10,2))), 0)`
  })
  .from(customerPayments)
  .where(eq(customerPayments.customerId, customerId));

  const totalSales = parseFloat(salesResult.total || "0");
  const totalDebits = parseFloat(debitsResult.total || "0");
  const totalPayments = parseFloat(paymentsResult.total || "0");
  
  return totalSales + totalDebits - totalPayments;
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
  .where(and(
    eq(sales.saleType, "A_PRAZO"),
    eq(sales.status, "ACTIVE")
  ))
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
 * Busca histórico completo de um cliente (vendas + pagamentos + débitos manuais)
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
    eq(sales.saleType, "A_PRAZO"),
    eq(sales.status, "ACTIVE")
  ));

  // Buscar produtos de cada venda
  const salesWithItems = await Promise.all(
    customerSales.map(async (sale) => {
      const items = await db.select({
        productId: saleItems.productId,
        productName: products.name,
        quantity: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        totalPrice: saleItems.totalPrice
      })
      .from(saleItems)
      .leftJoin(products, eq(saleItems.productId, products.id))
      .where(eq(saleItems.saleId, sale.id));
      
      return {
        ...sale,
        items
      };
    })
  );

  // Buscar débitos manuais
  const debits = await db.select({
    id: customerDebits.id,
    date: customerDebits.debitDate,
    amount: customerDebits.debitAmount,
    type: sql<string>`'DEBIT'`,
    description: customerDebits.description,
    paymentMethod: sql<string>`NULL`,
    notes: customerDebits.notes
  })
  .from(customerDebits)
  .where(eq(customerDebits.customerId, customerId));

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
  const history = [...salesWithItems, ...debits, ...payments]
    .filter(item => item.date !== null)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());

  // Calcular saldo acumulado
  let balance = 0;
  const historyWithBalance = history.map(item => {
    const amount = parseFloat(item.amount);
    if (item.type === 'SALE' || item.type === 'DEBIT') {
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

/**
 * Registra um débito manual na conta corrente do cliente
 * Usado para lançar valores avulsos (empréstimos, taxas, ajustes)
 */
export async function registerManualDebit(data: {
  customerId: number;
  debitDate: Date;
  debitAmount: string;
  description: string;
  managementAccountId?: number;
  notes?: string;
  createdBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(customerDebits).values({
    customerId: data.customerId,
    debitDate: data.debitDate,
    debitAmount: data.debitAmount,
    description: data.description,
    managementAccountId: data.managementAccountId ?? null,
    notes: data.notes ?? null,
    createdBy: data.createdBy
  });

  return { success: true };
}

// ============================================
// ESTATÍSTICAS DE COMPRAS PARA DASHBOARD
// ============================================

/**
 * Retorna o valor total de compras do mês atual
 */
export async function getPurchaseTotalCurrentMonth() {
  const db = await getDb();
  if (!db) return "0.00";
  
  // Usar dateUtils para consistência de timezone
  const { year, month } = getCurrentBrazilDateInfo();
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59);
  
  const result = await db.select({
    total: sql<string>`COALESCE(SUM(${purchaseOrders.totalAmount}), 0)`
  })
  .from(purchaseOrders)
  .where(
    and(
      eq(purchaseOrders.status, "CONFIRMED"),
      gte(purchaseOrders.postingDate, firstDayOfMonth),
      lte(purchaseOrders.postingDate, lastDayOfMonth)
    )
  );
  
  return result[0]?.total || "0.00";
}

/**
 * Retorna o valor total de compras por tipo de documento (mês atual)
 */
export async function getPurchaseTotalByDocType() {
  const db = await getDb();
  if (!db) return [];
  
  // Usar dateUtils para consistência de timezone
  const { year, month } = getCurrentBrazilDateInfo();
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59);
  
  const result = await db.select({
    docType: purchaseOrders.docType,
    total: sql<string>`COALESCE(SUM(${purchaseOrders.totalAmount}), 0)`
  })
  .from(purchaseOrders)
  .where(
    and(
      eq(purchaseOrders.status, "CONFIRMED"),
      gte(purchaseOrders.postingDate, firstDayOfMonth),
      lte(purchaseOrders.postingDate, lastDayOfMonth)
    )
  )
  .groupBy(purchaseOrders.docType);
  
  return result;
}

/**
 * Retorna margem bruta por categoria (mês atual)
 * Margem% = (1 - Custo/Venda) × 100
 */
export async function getGrossMarginByCategory() {
  const db = await getDb();
  if (!db) return [];
  
  // Usar dateUtils para consistência de timezone
  const { year: currentYear, month: currentMonth } = getCurrentBrazilDateInfo();
  
  // Buscar todas as vendas do mês (exceto canceladas)
  // Usar range amplo e filtrar por timezone depois
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);
  
  const allSales = await db.select({
    saleId: sales.id,
    saleDate: sales.saleDate,
    finalAmount: sales.finalAmount,
    status: sales.status,
  })
  .from(sales)
  .where(
    and(
      ne(sales.status, "CANCELLED"),
      gte(sales.saleDate, new Date(currentYear, currentMonth - 2, 1)), // Mês anterior para margem de segurança
      lte(sales.saleDate, new Date(currentYear, currentMonth, 31, 23, 59, 59)) // Próximo mês para margem
    )
  );
  
  // Filtrar por timezone de Brasília (mesma lógica do Dashboard)
  const monthSales = allSales.filter(s => {
    if (!s.saleDate) return false;
    const saleDateStr = new Date(s.saleDate).toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' });
    const [saleMonth, saleDay, saleYear] = saleDateStr.split('/');
    return parseInt(saleYear) === currentYear && parseInt(saleMonth) === currentMonth;
  });
  
  // Buscar itens de todas as vendas do mês com informações do produto
  const saleIds = monthSales.map(s => s.saleId);
  if (saleIds.length === 0) return [];
  
  const items = await db.select({
    saleItemId: saleItems.id,
    saleId: saleItems.saleId,
    productId: saleItems.productId,
    quantity: saleItems.quantity,
    unitPrice: saleItems.unitPrice,
    productName: products.name,
    categoryId: products.categoryId,
    avgCost: products.avgCost,
    categoryName: categories.name,
  })
  .from(saleItems)
  .innerJoin(products, eq(saleItems.productId, products.id))
  .innerJoin(categories, eq(products.categoryId, categories.id))
  .where(sql`${saleItems.saleId} IN (${sql.join(saleIds.map(id => sql`${id}`), sql`, `)})`);
  
  // Criar mapa de vendas para acessar finalAmount
  const salesMap = new Map(monthSales.map(s => [s.saleId, parseFloat(s.finalAmount?.toString() || "0")]));
  
  // Calcular total de itens por venda para proporcionalizar
  const saleItemTotals = new Map<number, number>();
  for (const item of items) {
    const quantity = parseFloat(item.quantity.toString());
    const unitPrice = parseFloat(item.unitPrice.toString());
    const itemTotal = quantity * unitPrice;
    saleItemTotals.set(item.saleId, (saleItemTotals.get(item.saleId) || 0) + itemTotal);
  }
  
  // Agrupar por categoria usando finalAmount proporcionalizado
  const categoryMap = new Map<number, {
    categoryId: number;
    categoryName: string;
    totalRevenue: number;
    totalCost: number;
  }>();
  
  for (const item of items) {
    const categoryId = item.categoryId;
    const categoryName = item.categoryName;
    const quantity = parseFloat(item.quantity.toString());
    const unitPrice = parseFloat(item.unitPrice.toString());
    const avgCost = parseFloat(item.avgCost?.toString() || "0");
    
    const itemTotal = quantity * unitPrice;
    const saleTotal = saleItemTotals.get(item.saleId) || itemTotal;
    const saleFinalAmount = salesMap.get(item.saleId) || itemTotal;
    
    // Proporcionalizar o finalAmount da venda para este item
    // Se a venda teve desconto, cada item recebe sua parte proporcional
    const proportion = saleTotal > 0 ? itemTotal / saleTotal : 0;
    const revenue = saleFinalAmount * proportion;
    const cost = quantity * avgCost;
    
    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        categoryId,
        categoryName,
        totalRevenue: 0,
        totalCost: 0,
      });
    }
    
    const category = categoryMap.get(categoryId)!;
    category.totalRevenue += revenue;
    category.totalCost += cost;
  }
  
  // Calcular margem e ordenar por faturamento (maior para menor)
  const result = Array.from(categoryMap.values())
    .map(cat => {
      const marginPercent = cat.totalRevenue > 0 
        ? (1 - (cat.totalCost / cat.totalRevenue)) * 100 
        : 0;
      
      return {
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        totalRevenue: cat.totalRevenue.toFixed(2),
        totalCost: cat.totalCost.toFixed(2),
        marginPercent: marginPercent.toFixed(1),
      };
    })
    .sort((a, b) => parseFloat(b.totalRevenue) - parseFloat(a.totalRevenue));
  
  return result;
}

/**
 * Análise de Vendas - Por Valores
 * Retorna faturamento, custo, margem e lucro por produto
 */
export async function getSalesAnalysisByValue(
  startDate: Date, 
  endDate: Date,
  filters?: { 
    productIds?: number[]; 
    subcategoryId?: number;
    channels?: string[];
    paymentMethod?: string;
  }
) {
  const db = await getDb();
  if (!db) return [];

  // Usar dateUtils para consistência de timezone
  const startStr = toDateString(startDate);
  const endStr = toDateString(endDate);

  // Construir condições WHERE dinâmicas
  // Usar CONVERT_TZ para converter UTC para horário local do Brasil (GMT-3)
  let whereConditions = `s.status != 'CANCELLED' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startStr}' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endStr}'`;
  
  if (filters?.productIds && filters.productIds.length > 0) {
    whereConditions += ` AND p.id IN (${filters.productIds.join(',')})`;
  }
  if (filters?.subcategoryId) {
    whereConditions += ` AND p.subcategoryId = ${filters.subcategoryId}`;
  }
  if (filters?.channels && filters.channels.length > 0) {
    const channelList = filters.channels.map(ch => `'${ch}'`).join(',');
    whereConditions += ` AND s.saleType IN (${channelList})`;
  }
  if (filters?.paymentMethod) {
    whereConditions += ` AND s.paymentMethod = '${filters.paymentMethod}'`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      p.id as productId,
      p.name as productName,
      c.name as categoryName,
      SUM(si.quantity) as totalQuantity,
      SUM(si.totalPrice) as totalRevenue,
      SUM(si.quantity * p.avgCost) as totalCost,
      SUM(si.totalPrice) - SUM(si.quantity * p.avgCost) as totalProfit,
      ROUND((1 - (SUM(si.quantity * p.avgCost) / NULLIF(SUM(si.totalPrice), 0))) * 100, 1) as marginPercent
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE ${whereConditions}
    GROUP BY p.id, p.name, c.name
    ORDER BY totalRevenue DESC
  `));

  return (result[0] || []) as any as Array<{
    productId: number;
    productName: string;
    categoryName: string;
    totalQuantity: string;
    totalRevenue: string;
    totalCost: string;
    totalProfit: string;
    marginPercent: string;
  }>;
}

/**
 * Análise de Vendas - Por Quantidades
 * Retorna unidades vendidas e mix de produtos
 */
export async function getSalesAnalysisByQuantity(
  startDate: Date, 
  endDate: Date,
  filters?: { 
    productIds?: number[]; 
    subcategoryId?: number;
    channels?: string[];
    paymentMethod?: string;
  }
) {
  const db = await getDb();
  if (!db) return [];

  // Usar dateUtils para consistência de timezone
  const startStr = toDateString(startDate);
  const endStr = toDateString(endDate);

  // Construir condições WHERE dinâmicas
  // Usar CONVERT_TZ para converter UTC para horário local do Brasil (GMT-3)
  let whereConditions = `s.status != 'CANCELLED' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startStr}' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endStr}'`;
  let subqueryWhere = `s2.status != 'CANCELLED' AND DATE(CONVERT_TZ(s2.saleDate, '+00:00', '-03:00')) >= '${startStr}' AND DATE(CONVERT_TZ(s2.saleDate, '+00:00', '-03:00')) <= '${endStr}'`;
  
  if (filters?.productIds && filters.productIds.length > 0) {
    whereConditions += ` AND p.id IN (${filters.productIds.join(',')})`;
    subqueryWhere += ` AND p2.id IN (${filters.productIds.join(',')})`;
  }
  if (filters?.subcategoryId) {
    whereConditions += ` AND p.subcategoryId = ${filters.subcategoryId}`;
    subqueryWhere += ` AND p2.subcategoryId = ${filters.subcategoryId}`;
  }
  if (filters?.channels && filters.channels.length > 0) {
    const channelList = filters.channels.map(ch => `'${ch}'`).join(',');
    whereConditions += ` AND s.saleType IN (${channelList})`;
    subqueryWhere += ` AND s2.saleType IN (${channelList})`;
  }
  if (filters?.paymentMethod) {
    whereConditions += ` AND s.paymentMethod = '${filters.paymentMethod}'`;
    subqueryWhere += ` AND s2.paymentMethod = '${filters.paymentMethod}'`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      p.id as productId,
      p.name as productName,
      c.name as categoryName,
      p.uom as unit,
      SUM(si.quantity) as totalQuantity,
      SUM(si.totalPrice) as totalRevenue,
      ROUND((SUM(si.quantity) / (
        SELECT SUM(si2.quantity)
        FROM saleItems si2
        INNER JOIN sales s2 ON si2.saleId = s2.id
        INNER JOIN products p2 ON si2.productId = p2.id
        WHERE ${subqueryWhere}
      )) * 100, 2) as quantityMixPercent
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE ${whereConditions}
    GROUP BY p.id, p.name, c.name, p.uom
    ORDER BY totalQuantity DESC
  `));

  return result[0] as any as Array<{
    productId: number;
    productName: string;
    categoryName: string;
    unit: string;
    totalQuantity: string;
    totalRevenue: string;
    quantityMixPercent: string;
  }>;
}

/**
 * Análise de Vendas - Por Categoria (Valores)
 */
export async function getSalesAnalysisByCategoryValue(
  startDate: Date, 
  endDate: Date,
  filters?: { 
    productIds?: number[]; 
    subcategoryId?: number;
    channels?: string[];
    paymentMethod?: string;
  }
) {
  const db = await getDb();
  if (!db) return [];

  // Usar dateUtils para consistência de timezone
  const startStr = toDateString(startDate);
  const endStr = toDateString(endDate);

  // Construir condições WHERE dinâmicas
  // Usar CONVERT_TZ para converter UTC para horário local do Brasil (GMT-3)
  let whereConditions = `s.status != 'CANCELLED' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startStr}' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endStr}'`;
  
  if (filters?.productIds && filters.productIds.length > 0) {
    whereConditions += ` AND p.id IN (${filters.productIds.join(',')})`;
  }
  if (filters?.subcategoryId) {
    whereConditions += ` AND p.subcategoryId = ${filters.subcategoryId}`;
  }
  if (filters?.channels && filters.channels.length > 0) {
    const channelList = filters.channels.map(ch => `'${ch}'`).join(',');
    whereConditions += ` AND s.saleType IN (${channelList})`;
  }
  if (filters?.paymentMethod) {
    whereConditions += ` AND s.paymentMethod = '${filters.paymentMethod}'`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      c.id as categoryId,
      c.name as categoryName,
      SUM(si.quantity) as totalQuantity,
      SUM(si.totalPrice) as totalRevenue,
      SUM(si.quantity * p.avgCost) as totalCost,
      SUM(si.totalPrice) - SUM(si.quantity * p.avgCost) as totalProfit,
      ROUND((1 - (SUM(si.quantity * p.avgCost) / NULLIF(SUM(si.totalPrice), 0))) * 100, 1) as marginPercent
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE ${whereConditions}
    GROUP BY c.id, c.name
    ORDER BY totalRevenue DESC
  `));

  return result[0] as any as Array<{
    categoryId: number;
    categoryName: string;
    totalQuantity: string;
    totalRevenue: string;
    totalCost: string;
    totalProfit: string;
    marginPercent: string;
  }>;
}

/**
 * Análise de Vendas - Por Dia
 * Agrupa vendas por dia com faturamento, custo, lucro e margem
 */
export async function getSalesAnalysisByDay(
  startDate: Date, 
  endDate: Date,
  filters?: { 
    productIds?: number[]; 
    subcategoryId?: number;
    channels?: string[];
    paymentMethod?: string;
  }
) {
  const db = await getDb();
  if (!db) return [];

  // Usar dateUtils para consistência de timezone
  const startStr = toDateString(startDate);
  const endStr = toDateString(endDate);

  // Construir condições WHERE dinâmicas
  // Usar CONVERT_TZ para converter UTC para horário local do Brasil (GMT-3)
  let whereConditions = `s.status != 'CANCELLED' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startStr}' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endStr}'`;
  
  if (filters?.productIds && filters.productIds.length > 0) {
    whereConditions += ` AND p.id IN (${filters.productIds.join(',')})`;
  }
  if (filters?.subcategoryId) {
    whereConditions += ` AND p.subcategoryId = ${filters.subcategoryId}`;
  }
  if (filters?.channels && filters.channels.length > 0) {
    const channelList = filters.channels.map(ch => `'${ch}'`).join(',');
    whereConditions += ` AND s.saleType IN (${channelList})`;
  }
  if (filters?.paymentMethod) {
    whereConditions += ` AND s.paymentMethod = '${filters.paymentMethod}'`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) as saleDate,
      DAYOFWEEK(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) as dayOfWeek,
      SUM(si.quantity) as totalQuantity,
      SUM(si.totalPrice) as totalRevenue,
      SUM(si.quantity * p.avgCost) as totalCost,
      SUM(si.totalPrice) - SUM(si.quantity * p.avgCost) as totalProfit,
      ROUND((1 - (SUM(si.quantity * p.avgCost) / NULLIF(SUM(si.totalPrice), 0))) * 100, 1) as marginPercent
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    WHERE ${whereConditions}
    GROUP BY DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')), DAYOFWEEK(CONVERT_TZ(s.saleDate, '+00:00', '-03:00'))
    ORDER BY saleDate ASC
  `));

  return (result[0] || []) as any as Array<{
    saleDate: string;
    dayOfWeek: number;
    totalQuantity: string;
    totalRevenue: string;
    totalCost: string;
    totalProfit: string;
    marginPercent: string;
  }>;
}

/**
 * Análise de Vendas - Por Semana
 * Agrupa vendas por semana com faturamento, custo, lucro e margem
 */
export async function getSalesAnalysisByWeek(
  startDate: Date, 
  endDate: Date,
  filters?: { 
    productIds?: number[]; 
    subcategoryId?: number;
    channels?: string[];
    paymentMethod?: string;
  }
) {
  const db = await getDb();
  if (!db) return [];

  // Usar dateUtils para consistência de timezone
  const startStr = toDateString(startDate);
  const endStr = toDateString(endDate);

  // Construir condições WHERE dinâmicas
  // Usar CONVERT_TZ para converter UTC para horário local do Brasil (GMT-3)
  let whereConditions = `s.status != 'CANCELLED' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startStr}' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endStr}'`;
  
  if (filters?.productIds && filters.productIds.length > 0) {
    whereConditions += ` AND p.id IN (${filters.productIds.join(',')})`;
  }
  if (filters?.subcategoryId) {
    whereConditions += ` AND p.subcategoryId = ${filters.subcategoryId}`;
  }
  if (filters?.channels && filters.channels.length > 0) {
    const channelList = filters.channels.map(ch => `'${ch}'`).join(',');
    whereConditions += ` AND s.saleType IN (${channelList})`;
  }
  if (filters?.paymentMethod) {
    whereConditions += ` AND s.paymentMethod = '${filters.paymentMethod}'`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      YEARWEEK(CONVERT_TZ(s.saleDate, '+00:00', '-03:00'), 1) as yearWeek,
      MIN(DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00'))) as weekStart,
      MAX(DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00'))) as weekEnd,
      SUM(si.quantity) as totalQuantity,
      SUM(si.totalPrice) as totalRevenue,
      SUM(si.quantity * p.avgCost) as totalCost,
      SUM(si.totalPrice) - SUM(si.quantity * p.avgCost) as totalProfit,
      ROUND((1 - (SUM(si.quantity * p.avgCost) / NULLIF(SUM(si.totalPrice), 0))) * 100, 1) as marginPercent
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    WHERE ${whereConditions}
    GROUP BY YEARWEEK(CONVERT_TZ(s.saleDate, '+00:00', '-03:00'), 1)
    ORDER BY yearWeek ASC
  `));

  return (result[0] || []) as any as Array<{
    yearWeek: string;
    weekStart: string;
    weekEnd: string;
    totalQuantity: string;
    totalRevenue: string;
    totalCost: string;
    totalProfit: string;
    marginPercent: string;
  }>;
}

/**
 * Análise de Vendas - Por Mês
 * Agrupa vendas por mês com faturamento, custo, lucro e margem
 */
export async function getSalesAnalysisByMonth(
  startDate: Date, 
  endDate: Date,
  filters?: { 
    productIds?: number[]; 
    subcategoryId?: number;
    channels?: string[];
    paymentMethod?: string;
  }
) {
  const db = await getDb();
  if (!db) return [];

  // Usar dateUtils para consistência de timezone
  const startStr = toDateString(startDate);
  const endStr = toDateString(endDate);

  // Construir condições WHERE dinâmicas
  // Usar CONVERT_TZ para converter UTC para horário local do Brasil (GMT-3)
  let whereConditions = `s.status != 'CANCELLED' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startStr}' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endStr}'`;
  
  if (filters?.productIds && filters.productIds.length > 0) {
    whereConditions += ` AND p.id IN (${filters.productIds.join(',')})`;
  }
  if (filters?.subcategoryId) {
    whereConditions += ` AND p.subcategoryId = ${filters.subcategoryId}`;
  }
  if (filters?.channels && filters.channels.length > 0) {
    const channelList = filters.channels.map(ch => `'${ch}'`).join(',');
    whereConditions += ` AND s.saleType IN (${channelList})`;
  }
  if (filters?.paymentMethod) {
    whereConditions += ` AND s.paymentMethod = '${filters.paymentMethod}'`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      DATE_FORMAT(s.saleDate, '%Y-%m') as yearMonth,
      YEAR(s.saleDate) as year,
      MONTH(s.saleDate) as month,
      SUM(si.quantity) as totalQuantity,
      SUM(si.totalPrice) as totalRevenue,
      SUM(si.quantity * p.avgCost) as totalCost,
      SUM(si.totalPrice) - SUM(si.quantity * p.avgCost) as totalProfit,
      ROUND((1 - (SUM(si.quantity * p.avgCost) / NULLIF(SUM(si.totalPrice), 0))) * 100, 1) as marginPercent
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    WHERE ${whereConditions}
    GROUP BY DATE_FORMAT(s.saleDate, '%Y-%m'), YEAR(s.saleDate), MONTH(s.saleDate)
    ORDER BY yearMonth ASC
  `));

  return (result[0] || []) as any as Array<{
    yearMonth: string;
    year: number;
    month: number;
    totalQuantity: string;
    totalRevenue: string;
    totalCost: string;
    totalProfit: string;
    marginPercent: string;
  }>;
}

/**
 * Análise de Vendas - Matriz Produto × Dia
 * Retorna vendas diárias agrupadas por produto (para visualização em matriz)
 */
export async function getSalesByProductAndDate(
  startDate: Date, 
  endDate: Date,
  filters?: { 
    productIds?: number[]; 
    subcategoryId?: number;
    channels?: string[];
    paymentMethod?: string;
  }
) {
  const db = await getDb();
  if (!db) return [];

  // Usar dateUtils para consistência de timezone
  const startStr = toDateString(startDate);
  const endStr = toDateString(endDate);

  // Construir condições WHERE dinâmicas
  // Usar CONVERT_TZ para converter UTC para horário local do Brasil (GMT-3)
  let whereConditions = `s.status != 'CANCELLED' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startStr}' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endStr}'`;
  
  if (filters?.productIds && filters.productIds.length > 0) {
    whereConditions += ` AND p.id IN (${filters.productIds.join(',')})`;
  }
  if (filters?.subcategoryId) {
    whereConditions += ` AND p.subcategoryId = ${filters.subcategoryId}`;
  }
  if (filters?.channels && filters.channels.length > 0) {
    const channelList = filters.channels.map(ch => `'${ch}'`).join(',');
    whereConditions += ` AND s.saleType IN (${channelList})`;
  }
  if (filters?.paymentMethod) {
    whereConditions += ` AND s.paymentMethod = '${filters.paymentMethod}'`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      p.id as productId,
      p.name as productName,
      p.categoryId as categoryId,
      c.name as categoryName,
      DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) as saleDate,
      SUM(si.quantity) as quantity,
      SUM(si.totalPrice) as revenue,
      SUM(si.quantity * COALESCE(p.avgCost, 0)) as cost
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    LEFT JOIN categories c ON p.categoryId = c.id
    WHERE ${whereConditions}
    GROUP BY p.id, p.name, p.categoryId, c.name, DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00'))
    ORDER BY p.name, DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00'))
  `));

  return (result[0] || []) as any as Array<{
    productId: number;
    productName: string;
    categoryId: number;
    categoryName: string;
    saleDate: string;
    quantity: string;
    revenue: string;
    cost: string;
  }>;
}


// ==================== EXPORTAÇÃO DE VENDAS ====================
export async function getSalesForExport(filters?: { 
  startDate?: Date; 
  endDate?: Date; 
  saleType?: string; 
  customerId?: number;
  paymentMethod?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  let whereConditions = `s.status != 'CANCELLED'`;

  // Filtro de data (saleDate com timezone) - usar dateUtils
  if (filters?.startDate) {
    const startStr = toDateString(filters.startDate);
    whereConditions += ` AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startStr}'`;
  }
  if (filters?.endDate) {
    const endStr = toDateString(filters.endDate);
    whereConditions += ` AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endStr}'`;
  }

  // Filtro de tipo de venda
  if (filters?.saleType) {
    whereConditions += ` AND s.saleType = '${filters.saleType}'`;
  }

  // Filtro de cliente
  if (filters?.customerId) {
    whereConditions += ` AND s.customerId = ${filters.customerId}`;
  }

  // Filtro de forma de pagamento
  if (filters?.paymentMethod) {
    whereConditions += ` AND s.paymentMethod = '${filters.paymentMethod}'`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      s.id as saleId,
      s.saleType as channel,
      s.platformOrderId as orderNumber,
      p.name as productName,
      si.quantity,
      CONVERT_TZ(s.saleDate, '+00:00', '-03:00') as saleDate,
      si.unitPrice,
      si.totalPrice,
      s.paymentMethod,
      COALESCE(pa.name, 'Consumidor Final') as customerName
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    LEFT JOIN partners pa ON s.customerId = pa.id
    WHERE ${whereConditions}
    ORDER BY s.saleDate DESC, s.id DESC, si.id ASC
  `));

  return (result[0] || []) as any as Array<{
    saleId: number;
    channel: string;
    orderNumber: string | null;
    productName: string;
    quantity: number;
    saleDate: Date;
    unitPrice: string;
    totalPrice: string;
    paymentMethod: string | null;
    customerName: string;
  }>;
}


// ==================== CALENDÁRIO DE CONTAS A PAGAR ====================
export async function getPayablesCalendar(year: number, month: number) {
  const db = await getDb();
  if (!db) return [];

  // Buscar todas as parcelas pendentes do mês
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Último dia do mês

  const result = await db.execute(sql.raw(`
    SELECT 
      DAY(pi.dueDate) as day,
      pi.id as installmentId,
      pi.amount,
      pi.dueDate,
      pi.status,
      po.id as purchaseOrderId,
      po.docNumber,
      po.paymentMethod,
      p.id as supplierId,
      p.name as supplierName
    FROM purchaseInstallments pi
    INNER JOIN purchaseOrders po ON pi.purchaseOrderId = po.id
    INNER JOIN partners p ON po.supplierId = p.id
    WHERE pi.dueDate >= '${toDateString(startDate)}'
      AND pi.dueDate <= '${toDateString(endDate)}'
      AND pi.status IN ('PENDING', 'OVERDUE')
    ORDER BY pi.dueDate ASC, p.name ASC
  `));

  const rows = ((result as any)[0] || []) as any[];

  // Agrupar por dia
  const calendar: Record<number, {
    day: number;
    total: number;
    count: number;
    items: Array<{
      installmentId: number;
      amount: string;
      dueDate: Date;
      status: string;
      purchaseOrderId: number;
      docNumber: string | null;
      paymentMethod: string;
      supplierId: number;
      supplierName: string;
    }>;
  }> = {};

  for (const row of rows) {
    const day = row.day;
    if (!calendar[day]) {
      calendar[day] = { day, total: 0, count: 0, items: [] };
    }
    calendar[day].total += parseFloat(row.amount);
    calendar[day].count += 1;
    calendar[day].items.push({
      installmentId: row.installmentId,
      amount: row.amount,
      dueDate: row.dueDate,
      status: row.status,
      purchaseOrderId: row.purchaseOrderId,
      docNumber: row.docNumber,
      paymentMethod: row.paymentMethod,
      supplierId: row.supplierId,
      supplierName: row.supplierName,
    });
  }

  return Object.values(calendar);
}

// ============================================
// HISTÓRICO DE MOVIMENTAÇÕES DE PRODUTOS
// ============================================

/**
 * Registra uma movimentação de estoque de produto
 */
export async function createProductMovement(data: InsertProductMovement) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(productMovements).values(data);
  return result[0].insertId;
}

/**
 * Busca movimentações de um produto específico
 */
export async function getProductMovements(productId: number, filters?: {
  startDate?: Date;
  endDate?: Date;
  type?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      id: productMovements.id,
      productId: productMovements.productId,
      date: productMovements.date,
      type: productMovements.type,
      quantity: productMovements.quantity,
      documentNumber: productMovements.documentNumber,
      userId: productMovements.userId,
      notes: productMovements.notes,
      createdAt: productMovements.createdAt,
      userName: users.name,
    })
    .from(productMovements)
    .leftJoin(users, eq(productMovements.userId, users.id))
    .where(eq(productMovements.productId, productId))
    .$dynamic();

  if (filters?.startDate) {
    query = query.where(gte(productMovements.date, filters.startDate));
  }

  if (filters?.endDate) {
    query = query.where(lte(productMovements.date, filters.endDate));
  }

  if (filters?.type) {
    query = query.where(eq(productMovements.type, filters.type as any));
  }

  query = query.orderBy(desc(productMovements.date));

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.offset(filters.offset);
  }

  const movements = await query;
  return movements;
}

/**
 * Realiza acerto manual de estoque
 */
export async function adjustProductStock(data: {
  productId: number;
  quantity: number; // Pode ser positivo (entrada) ou negativo (saída)
  userId: string;
  reason: string; // Justificativa obrigatória
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar produto atual
  const product = await getProduct(data.productId);
  if (!product) throw new Error("Product not found");

  // Calcular novo estoque
  const newStock = (product.currentStock || 0) + data.quantity;
  if (newStock < 0) {
    throw new Error("Stock cannot be negative");
  }

  // Atualizar estoque
  await db
    .update(products)
    .set({ currentStock: newStock })
    .where(eq(products.id, data.productId));

  // Registrar movimentação
  await createProductMovement({
    productId: data.productId,
    date: new Date(),
    type: "ACERTO",
    quantity: data.quantity.toString(),
    documentNumber: null,
    userId: data.userId,
    notes: `${data.reason}${data.notes ? ` - ${data.notes}` : ''}`,
  });

  return { success: true, newStock };
}


// ============================================
// DASHBOARD - QUERIES OTIMIZADAS
// ============================================

/**
 * Busca faturamento do mês atual diretamente no SQL
 * Muito mais eficiente que buscar todas as vendas e filtrar em JavaScript
 */
export async function getDashboardMonthlyRevenue() {
  const db = await getDb();
  if (!db) return { 
    total: 0, 
    balcao: 0, 
    delivery: 0, 
    aPrazo: 0,
    count: 0 
  };

  // Usar CONVERT_TZ para garantir que a data seja calculada no horário de Brasília
  const result = await db.execute(sql.raw(`
    SELECT 
      COALESCE(SUM(finalAmount), 0) as total,
      COALESCE(SUM(CASE WHEN saleType = 'BALCAO' THEN finalAmount ELSE 0 END), 0) as balcao,
      COALESCE(SUM(CASE WHEN saleType = 'DELIVERY' THEN finalAmount ELSE 0 END), 0) as delivery,
      COALESCE(SUM(CASE WHEN saleType = 'A_PRAZO' THEN finalAmount ELSE 0 END), 0) as aPrazo,
      COUNT(*) as count
    FROM sales
    WHERE status != 'CANCELLED'
      AND YEAR(CONVERT_TZ(saleDate, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))
      AND MONTH(CONVERT_TZ(saleDate, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))
  `));

  const rows = result[0] as unknown as any[];
  const row = rows?.[0] || {};
  return {
    total: parseFloat(row.total || '0'),
    balcao: parseFloat(row.balcao || '0'),
    delivery: parseFloat(row.delivery || '0'),
    aPrazo: parseFloat(row.aPrazo || '0'),
    count: parseInt(row.count || '0', 10)
  };
}

/**
 * Busca faturamento de hoje diretamente no SQL
 */
export async function getDashboardDailyRevenue() {
  const db = await getDb();
  if (!db) return { 
    total: 0, 
    balcao: 0, 
    delivery: 0, 
    count: 0 
  };

  const result = await db.execute(sql.raw(`
    SELECT 
      COALESCE(SUM(finalAmount), 0) as total,
      COALESCE(SUM(CASE WHEN saleType = 'BALCAO' OR saleType = 'A_PRAZO' THEN finalAmount ELSE 0 END), 0) as balcao,
      COALESCE(SUM(CASE WHEN saleType = 'DELIVERY' THEN finalAmount ELSE 0 END), 0) as delivery,
      COUNT(*) as count
    FROM sales
    WHERE status != 'CANCELLED'
      AND DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) = DATE(CONVERT_TZ(NOW(), '+00:00', '-03:00'))
  `));

  const rows = result[0] as unknown as any[];
  const row = rows?.[0] || {};
  return {
    total: parseFloat(row.total || '0'),
    balcao: parseFloat(row.balcao || '0'),
    delivery: parseFloat(row.delivery || '0'),
    count: parseInt(row.count || '0', 10)
  };
}

/**
 * Busca total de compras do mês atual
 */
export async function getDashboardMonthlyPurchases() {
  const db = await getDb();
  if (!db) return { 
    total: 0, 
    cupom: 0, 
    notaFiscal: 0, 
    semDocumento: 0,
    count: 0 
  };

  const result = await db.execute(sql.raw(`
    SELECT 
      COALESCE(SUM(totalAmount), 0) as total,
      COALESCE(SUM(CASE WHEN docType = 'CUPOM' THEN totalAmount ELSE 0 END), 0) as cupom,
      COALESCE(SUM(CASE WHEN docType = 'NOTA_FISCAL' THEN totalAmount ELSE 0 END), 0) as notaFiscal,
      COALESCE(SUM(CASE WHEN docType IS NULL OR docType = '' THEN totalAmount ELSE 0 END), 0) as semDocumento,
      COUNT(*) as count
    FROM purchaseOrders
    WHERE status = 'CONFIRMED'
      AND YEAR(CONVERT_TZ(createdAt, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))
      AND MONTH(CONVERT_TZ(createdAt, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))
  `));

  const rows = result[0] as unknown as any[];
  const row = rows?.[0] || {};
  return {
    total: parseFloat(row.total || '0'),
    cupom: parseFloat(row.cupom || '0'),
    notaFiscal: parseFloat(row.notaFiscal || '0'),
    semDocumento: parseFloat(row.semDocumento || '0'),
    count: parseInt(row.count || '0', 10)
  };
}


/**
 * Análise Delivery por Produto - Query SQL otimizada
 * Retorna produtos vendidos via delivery com faturamento, custo e margem
 */
export async function getDeliveryProductAnalysis(
  startDate: string,
  endDate: string,
  categoryId?: number
) {
  const db = await getDb();
  if (!db) return [];

  // Construir condições WHERE
  let whereConditions = `s.status != 'CANCELLED' AND s.saleType = 'DELIVERY' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startDate}' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endDate}'`;
  
  if (categoryId) {
    whereConditions += ` AND p.categoryId = ${categoryId}`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      p.id as productId,
      p.name as productName,
      SUM(si.quantity) as totalQuantity,
      SUM(si.totalPrice) as totalRevenue,
      SUM(si.quantity * p.avgCost) as totalCost
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    WHERE ${whereConditions}
    GROUP BY p.id, p.name
    ORDER BY totalRevenue DESC
  `));

  const rows = (result[0] as unknown as any[]) || [];
  
  return rows.map(row => {
    const revenue = parseFloat(row.totalRevenue || '0');
    const cost = parseFloat(row.totalCost || '0');
    const quantity = parseFloat(row.totalQuantity || '0');
    
    const grossProfit = revenue - cost;
    const grossMarginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    
    const ifoodFee = revenue * 0.07;
    const netProfit = grossProfit - ifoodFee;
    const netMarginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    
    return {
      productId: row.productId,
      productName: row.productName,
      quantity: quantity.toFixed(2),
      revenue: revenue.toFixed(2),
      cost: cost.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      grossMarginPercent: grossMarginPercent.toFixed(1),
      ifoodFee: ifoodFee.toFixed(2),
      netProfit: netProfit.toFixed(2),
      netMarginPercent: netMarginPercent.toFixed(1),
    };
  });
}


/**
 * Análise de Vendas - Resumo usando sales.finalAmount
 * Retorna faturamento total correto (inclui vendas sem itens detalhados)
 * Esta função deve ser usada para os cards de resumo na Análise de Vendas
 * 
 * NOTA: Quando filtro de produtos é aplicado, usa saleItems para calcular
 * faturamento apenas dos produtos selecionados
 */
export async function getSalesAnalysisSummary(
  startDate: Date, 
  endDate: Date,
  filters?: { 
    channels?: string[];
    paymentMethod?: string;
    productIds?: number[];
    subcategoryId?: number;
  }
) {
  const db = await getDb();
  if (!db) return { totalRevenue: 0, totalSales: 0, totalCost: 0 };

  // Usar dateUtils para consistência de timezone
  const startStr = toDateString(startDate);
  const endStr = toDateString(endDate);

  // Se tem filtro de produto ou subcategoria, usar saleItems para calcular
  const hasProductFilter = (filters?.productIds && filters.productIds.length > 0) || filters?.subcategoryId;

  if (hasProductFilter) {
    // Query baseada em saleItems para filtrar por produtos específicos
    let whereConditions = `s.status != 'CANCELLED' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startStr}' AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endStr}'`;
    
    if (filters?.channels && filters.channels.length > 0) {
      const channelList = filters.channels.map(ch => `'${ch}'`).join(',');
      whereConditions += ` AND s.saleType IN (${channelList})`;
    }
    if (filters?.paymentMethod) {
      whereConditions += ` AND s.paymentMethod = '${filters.paymentMethod}'`;
    }
    if (filters?.productIds && filters.productIds.length > 0) {
      whereConditions += ` AND p.id IN (${filters.productIds.join(',')})`;
    }
    if (filters?.subcategoryId) {
      whereConditions += ` AND p.subcategoryId = ${filters.subcategoryId}`;
    }

    const result = await db.execute(sql.raw(`
      SELECT 
        COALESCE(SUM(si.totalPrice), 0) as totalRevenue,
        COALESCE(SUM(si.quantity * p.avgCost), 0) as totalCost,
        COUNT(DISTINCT s.id) as totalSales
      FROM saleItems si
      INNER JOIN sales s ON si.saleId = s.id
      INNER JOIN products p ON si.productId = p.id
      WHERE ${whereConditions}
    `));

    const rows = (result[0] as unknown as any[]) || [];
    const row = rows[0] || {};
    
    return {
      totalRevenue: parseFloat(row.totalRevenue || '0'),
      totalCost: parseFloat(row.totalCost || '0'),
      totalSales: parseInt(row.totalSales || '0', 10)
    };
  }

  // Query original usando sales.finalAmount (sem filtro de produto)
  let whereConditions = `status != 'CANCELLED' AND DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) >= '${startStr}' AND DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) <= '${endStr}'`;
  
  if (filters?.channels && filters.channels.length > 0) {
    const channelList = filters.channels.map(ch => `'${ch}'`).join(',');
    whereConditions += ` AND saleType IN (${channelList})`;
  }
  if (filters?.paymentMethod) {
    whereConditions += ` AND paymentMethod = '${filters.paymentMethod}'`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      COALESCE(SUM(finalAmount), 0) as totalRevenue,
      COUNT(*) as totalSales
    FROM sales
    WHERE ${whereConditions}
  `));

  const rows = (result[0] as unknown as any[]) || [];
  const row = rows[0] || {};
  
  return {
    totalRevenue: parseFloat(row.totalRevenue || '0'),
    totalCost: 0, // Não temos custo quando não filtra por produto
    totalSales: parseInt(row.totalSales || '0', 10)
  };
}


// ==================== ANÁLISE DE FATURAMENTO - VISÃO MENSAL ====================

/**
 * Retorna estatísticas mensais de vendas para um ano específico
 * Agrupa por mês e canal de venda
 */
export async function getSalesMonthlyStats(year: number) {
  const db = await getDb();
  if (!db) return [];

  // OTIMIZAÇÃO: Usar SQL com filtro de ano para evitar carregar 120k+ registros
  // Calcular range de datas para o ano (considerando timezone Brasília = UTC-3)
  const firstDayOfYear = `${year}-01-01`;
  const lastDayOfYear = `${year}-12-31`;
  
  // Query SQL otimizada com GROUP BY mês
  const result = await db.execute(sql.raw(`
    SELECT 
      MONTH(CONVERT_TZ(saleDate, '+00:00', '-03:00')) as month,
      saleType,
      COUNT(*) as count,
      COALESCE(SUM(finalAmount), 0) as total
    FROM sales
    WHERE status != 'CANCELLED'
      AND saleDate >= '${firstDayOfYear} 03:00:00'
      AND saleDate < DATE_ADD('${lastDayOfYear}', INTERVAL 1 DAY) + INTERVAL 3 HOUR
    GROUP BY MONTH(CONVERT_TZ(saleDate, '+00:00', '-03:00')), saleType
    ORDER BY month
  `));
  
  const rows = (result[0] as unknown as any[]) || [];
  
  // Estrutura para armazenar dados por mês
  const monthlyData: Record<number, { month: number; balcao: number; delivery: number; aPrazo: number; total: number; count: number }> = {};

  // Inicializar todos os 12 meses
  for (let m = 1; m <= 12; m++) {
    monthlyData[m] = { month: m, balcao: 0, delivery: 0, aPrazo: 0, total: 0, count: 0 };
  }
  
  for (const row of rows) {
    const month = parseInt(row.month, 10);
    const total = parseFloat(row.total || '0');
    const count = parseInt(row.count || '0', 10);
    
    monthlyData[month].total += total;
    monthlyData[month].count += count;
    
    if (row.saleType === 'BALCAO') {
      monthlyData[month].balcao += total;
    } else if (row.saleType === 'DELIVERY') {
      monthlyData[month].delivery += total;
    } else if (row.saleType === 'A_PRAZO') {
      monthlyData[month].aPrazo += total;
    }
  }

  return Object.values(monthlyData);
}


/**
 * Busca margem líquida de delivery do mês atual usando SQL otimizado
 * Calcula faturamento, custo e margem líquida (após dedução de 7% de taxa)
 */
export async function getDeliveryNetMarginOptimized() {
  const db = await getDb();
  if (!db) return {
    deliveryRevenue: '0.00',
    totalCost: '0.00',
    grossProfit: '0.00',
    grossMarginPercent: '0.0',
    ifoodFee: '0.00',
    netProfit: '0.00',
    netMarginPercent: '0.0',
  };

  // Query 1: Buscar faturamento total de delivery (sem JOIN para evitar duplicação)
  const revenueResult = await db.execute(sql.raw(`
    SELECT 
      COALESCE(SUM(finalAmount), 0) as deliveryRevenue
    FROM sales
    WHERE saleType = 'DELIVERY' 
      AND status != 'CANCELLED'
      AND YEAR(CONVERT_TZ(saleDate, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))
      AND MONTH(CONVERT_TZ(saleDate, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))
  `));

  // Query 2: Buscar custo total dos itens vendidos
  const costResult = await db.execute(sql.raw(`
    SELECT 
      COALESCE(SUM(si.quantity * p.avgCost), 0) as totalCost
    FROM sales s
    INNER JOIN saleItems si ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    WHERE s.saleType = 'DELIVERY' 
      AND s.status != 'CANCELLED'
      AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = YEAR(CONVERT_TZ(NOW(), '+00:00', '-03:00'))
      AND MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = MONTH(CONVERT_TZ(NOW(), '+00:00', '-03:00'))
  `));

  const revenueRows = revenueResult[0] as unknown as any[];
  const costRows = costResult[0] as unknown as any[];
  
  const deliveryRevenue = parseFloat(revenueRows?.[0]?.deliveryRevenue || '0');
  const totalCost = parseFloat(costRows?.[0]?.totalCost || '0');
  
  // Calcular margem bruta
  const grossProfit = deliveryRevenue - totalCost;
  const grossMarginPercent = deliveryRevenue > 0 ? (grossProfit / deliveryRevenue) * 100 : 0;
  
  // Calcular margem líquida (deduzindo 7% de taxa)
  const ifoodFee = deliveryRevenue * 0.07;
  const netProfit = grossProfit - ifoodFee;
  const netMarginPercent = deliveryRevenue > 0 ? (netProfit / deliveryRevenue) * 100 : 0;

  return {
    deliveryRevenue: deliveryRevenue.toFixed(2),
    totalCost: totalCost.toFixed(2),
    grossProfit: grossProfit.toFixed(2),
    grossMarginPercent: grossMarginPercent.toFixed(1),
    ifoodFee: ifoodFee.toFixed(2),
    netProfit: netProfit.toFixed(2),
    netMarginPercent: netMarginPercent.toFixed(1),
  };
}


// ==================== ANÁLISE DE DESPESAS ====================

/**
 * Busca análise de despesas por categoria
 * Agrupa despesas por categoria com totais
 */
export async function getExpenseAnalysisByCategory(
  startDate?: string,
  endDate?: string,
  categoryId?: number,
  supplierId?: number
) {
  const db = await getDb();
  if (!db) return [];

  let whereClause = `WHERE e.status != 'CANCELADA'`;
  
  if (startDate) {
    whereClause += ` AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) >= '${startDate}'`;
  }
  if (endDate) {
    whereClause += ` AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) <= '${endDate}'`;
  }
  if (categoryId) {
    whereClause += ` AND e.categoryId = ${categoryId}`;
  }
  if (supplierId) {
    whereClause += ` AND e.supplierId = ${supplierId}`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      ec.id as categoryId,
      ec.name as categoryName,
      COUNT(e.id) as totalLancamentos,
      COALESCE(SUM(e.amount), 0) as totalAmount
    FROM expenses e
    INNER JOIN expenseCategories ec ON e.categoryId = ec.id
    ${whereClause}
    GROUP BY ec.id, ec.name
    ORDER BY totalAmount DESC
  `));

  const rows = result[0] as unknown as any[];
  return rows.map(row => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    totalLancamentos: parseInt(row.totalLancamentos || '0', 10),
    totalAmount: parseFloat(row.totalAmount || '0'),
  }));
}

/**
 * Busca análise de despesas por mês
 * Agrupa despesas por mês/ano com totais
 */
export async function getExpenseAnalysisByMonth(
  startDate?: string,
  endDate?: string,
  categoryId?: number,
  supplierId?: number
) {
  const db = await getDb();
  if (!db) return [];

  let whereClause = `WHERE e.status != 'CANCELADA'`;
  
  if (startDate) {
    whereClause += ` AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) >= '${startDate}'`;
  }
  if (endDate) {
    whereClause += ` AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) <= '${endDate}'`;
  }
  if (categoryId) {
    whereClause += ` AND e.categoryId = ${categoryId}`;
  }
  if (supplierId) {
    whereClause += ` AND e.supplierId = ${supplierId}`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      YEAR(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) as year,
      MONTH(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) as month,
      COUNT(e.id) as totalLancamentos,
      COALESCE(SUM(e.amount), 0) as totalAmount
    FROM expenses e
    ${whereClause}
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `));

  const rows = result[0] as unknown as any[];
  return rows.map(row => ({
    year: parseInt(row.year, 10),
    month: parseInt(row.month, 10),
    totalLancamentos: parseInt(row.totalLancamentos || '0', 10),
    totalAmount: parseFloat(row.totalAmount || '0'),
  }));
}

/**
 * Busca análise de despesas por categoria e mês (matriz)
 * Para comparativo mensal por categoria
 */
export async function getExpenseAnalysisByCategoryAndMonth(
  startDate?: string,
  endDate?: string,
  categoryId?: number,
  supplierId?: number
) {
  const db = await getDb();
  if (!db) return [];

  let whereClause = `WHERE e.status != 'CANCELADA'`;
  
  if (startDate) {
    whereClause += ` AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) >= '${startDate}'`;
  }
  if (endDate) {
    whereClause += ` AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) <= '${endDate}'`;
  }
  if (categoryId) {
    whereClause += ` AND e.categoryId = ${categoryId}`;
  }
  if (supplierId) {
    whereClause += ` AND e.supplierId = ${supplierId}`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      ec.id as categoryId,
      ec.name as categoryName,
      YEAR(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) as year,
      MONTH(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) as month,
      COUNT(e.id) as totalLancamentos,
      COALESCE(SUM(e.amount), 0) as totalAmount
    FROM expenses e
    INNER JOIN expenseCategories ec ON e.categoryId = ec.id
    ${whereClause}
    GROUP BY ec.id, ec.name, year, month
    ORDER BY ec.name, year DESC, month DESC
  `));

  const rows = result[0] as unknown as any[];
  return rows.map(row => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    year: parseInt(row.year, 10),
    month: parseInt(row.month, 10),
    totalLancamentos: parseInt(row.totalLancamentos || '0', 10),
    totalAmount: parseFloat(row.totalAmount || '0'),
  }));
}

/**
 * Busca detalhamento de despesas (lançamentos individuais)
 * Com informações de fornecedor e observação
 */
export async function getExpenseAnalysisDetail(
  startDate?: string,
  endDate?: string,
  categoryId?: number,
  supplierId?: number,
  limit: number = 500
) {
  const db = await getDb();
  if (!db) return [];

  let whereClause = `WHERE e.status != 'CANCELADA'`;
  
  if (startDate) {
    whereClause += ` AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) >= '${startDate}'`;
  }
  if (endDate) {
    whereClause += ` AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) <= '${endDate}'`;
  }
  if (categoryId) {
    whereClause += ` AND e.categoryId = ${categoryId}`;
  }
  if (supplierId) {
    whereClause += ` AND e.supplierId = ${supplierId}`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      e.id,
      e.description,
      e.amount,
      e.notes,
      e.docType,
      e.docNumber,
      e.paymentMethod,
      e.status,
      e.createdAt,
      ec.id as categoryId,
      ec.name as categoryName,
      p.id as supplierId,
      COALESCE(p.tradeName, p.name) as supplierName
    FROM expenses e
    INNER JOIN expenseCategories ec ON e.categoryId = ec.id
    LEFT JOIN partners p ON e.supplierId = p.id
    ${whereClause}
    ORDER BY e.createdAt DESC
    LIMIT ${limit}
  `));

  const rows = result[0] as unknown as any[];
  return rows.map(row => ({
    id: row.id,
    description: row.description,
    amount: parseFloat(row.amount || '0'),
    notes: row.notes,
    docType: row.docType,
    docNumber: row.docNumber,
    paymentMethod: row.paymentMethod,
    status: row.status,
    createdAt: row.createdAt,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
  }));
}

/**
 * Busca resumo geral de despesas
 */
export async function getExpenseAnalysisSummary(
  startDate?: string,
  endDate?: string,
  categoryId?: number,
  supplierId?: number
) {
  const db = await getDb();
  if (!db) return { totalAmount: 0, totalLancamentos: 0, avgPerLancamento: 0 };

  let whereClause = `WHERE e.status != 'CANCELADA'`;
  
  if (startDate) {
    whereClause += ` AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) >= '${startDate}'`;
  }
  if (endDate) {
    whereClause += ` AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) <= '${endDate}'`;
  }
  if (categoryId) {
    whereClause += ` AND e.categoryId = ${categoryId}`;
  }
  if (supplierId) {
    whereClause += ` AND e.supplierId = ${supplierId}`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      COUNT(e.id) as totalLancamentos,
      COALESCE(SUM(e.amount), 0) as totalAmount
    FROM expenses e
    ${whereClause}
  `));

  const rows = result[0] as unknown as any[];
  const row = rows?.[0] || {};
  
  const totalLancamentos = parseInt(row.totalLancamentos || '0', 10);
  const totalAmount = parseFloat(row.totalAmount || '0');
  const avgPerLancamento = totalLancamentos > 0 ? totalAmount / totalLancamentos : 0;

  return {
    totalAmount,
    totalLancamentos,
    avgPerLancamento,
  };
}


/**
 * Busca dados hierárquicos de despesas para matriz expansível
 * Retorna: Categoria > Fornecedor > Lançamento com valores por mês
 */
export async function getExpenseHierarchicalData(
  startDate?: string,
  endDate?: string
) {
  const db = await getDb();
  if (!db) return [];

  let whereClause = `WHERE e.status != 'CANCELADA'`;
  
  if (startDate) {
    whereClause += ` AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) >= '${startDate}'`;
  }
  if (endDate) {
    whereClause += ` AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) <= '${endDate}'`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      e.id as expenseId,
      e.description,
      e.amount,
      e.notes,
      e.docNumber,
      DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) as expenseDate,
      YEAR(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) as year,
      MONTH(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) as month,
      COALESCE(ma.id, ec.id) as categoryId,
      COALESCE(ma.name, ec.name, 'N/A') as categoryName,
      COALESCE(p.id, 0) as supplierId,
      COALESCE(p.tradeName, p.name, 'Sem Fornecedor') as supplierName,
      ma.id as managementAccountId,
      ma.name as managementAccountName,
      am.accountingCode as accountingCode,
      ma.classification as classification
    FROM expenses e
    LEFT JOIN expenseCategories ec ON e.categoryId = ec.id
    LEFT JOIN managementAccounts ma ON e.managementAccountId = ma.id
    LEFT JOIN accountingMappings am ON ma.id = am.managementAccountId
    LEFT JOIN partners p ON e.supplierId = p.id
    ${whereClause}
    ORDER BY COALESCE(ma.name, ec.name), p.tradeName, e.createdAt
  `));

  const rows = result[0] as unknown as any[];
  return rows.map(row => ({
    expenseId: row.expenseId,
    description: row.description,
    amount: parseFloat(row.amount || '0'),
    notes: row.notes,
    docNumber: row.docNumber,
    expenseDate: row.expenseDate,
    year: parseInt(row.year, 10),
    month: parseInt(row.month, 10),
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    managementAccountId: row.managementAccountId,
    managementAccountName: row.managementAccountName,
    accountingCode: row.accountingCode,
    classification: row.classification,
  }));
}


// ==================== METAS DE FATURAMENTO ====================

export async function getRevenueGoals(year?: number) {
  const db = await getDb();
  if (!db) return [];

  let whereClause = '';
  if (year) {
    whereClause = `WHERE year = ${year}`;
  }

  const result = await db.execute(sql.raw(`
    SELECT 
      rg.id,
      rg.year,
      rg.month,
      rg.channelId,
      rg.targetAmount,
      rg.notes,
      rg.createdBy,
      rg.createdAt,
      rg.updatedAt,
      COALESCE(sc.name, 'Geral') as channelName
    FROM revenueGoals rg
    LEFT JOIN salesChannels sc ON rg.channelId = sc.id
    ${whereClause}
    ORDER BY rg.year DESC, rg.month ASC, rg.channelId ASC
  `));

  const rows = result[0] as unknown as any[];
  return rows.map(row => ({
    id: row.id,
    year: row.year,
    month: row.month,
    channelId: row.channelId,
    targetAmount: parseFloat(row.targetAmount || '0'),
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    channelName: row.channelName,
  }));
}

export async function getRevenueGoal(year: number, month: number, channelId?: number | null) {
  const db = await getDb();
  if (!db) return null;

  const channelCondition = channelId === null || channelId === undefined 
    ? 'AND channelId IS NULL' 
    : `AND channelId = ${channelId}`;

  const result = await db.execute(sql.raw(`
    SELECT 
      rg.id,
      rg.year,
      rg.month,
      rg.channelId,
      rg.targetAmount,
      rg.notes,
      rg.createdBy,
      rg.createdAt,
      rg.updatedAt,
      COALESCE(sc.name, 'Geral') as channelName
    FROM revenueGoals rg
    LEFT JOIN salesChannels sc ON rg.channelId = sc.id
    WHERE rg.year = ${year} AND rg.month = ${month} ${channelCondition}
    LIMIT 1
  `));

  const rows = result[0] as unknown as any[];
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    channelId: row.channelId,
    targetAmount: parseFloat(row.targetAmount || '0'),
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    channelName: row.channelName,
  };
}

export async function createRevenueGoal(data: {
  year: number;
  month: number;
  channelId?: number | null;
  targetAmount: number;
  notes?: string;
  createdBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const channelValue = data.channelId === null || data.channelId === undefined ? 'NULL' : data.channelId;
  const notesValue = data.notes ? `'${data.notes.replace(/'/g, "''")}'` : 'NULL';

  await db.execute(sql.raw(`
    INSERT INTO revenueGoals (year, month, channelId, targetAmount, notes, createdBy)
    VALUES (${data.year}, ${data.month}, ${channelValue}, ${data.targetAmount}, ${notesValue}, '${data.createdBy}')
  `));

  return { success: true };
}

export async function updateRevenueGoal(id: number, data: {
  targetAmount?: number;
  notes?: string;
  changedBy?: string;
  changedByName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar valor anterior para histórico
  const currentGoal = await db.execute(sql.raw(`SELECT targetAmount FROM revenueGoals WHERE id = ${id}`));
  const currentRows = currentGoal[0] as unknown as any[];
  const previousAmount = currentRows[0]?.targetAmount ? parseFloat(currentRows[0].targetAmount) : 0;

  const updates: string[] = [];
  if (data.targetAmount !== undefined) {
    updates.push(`targetAmount = ${data.targetAmount}`);
  }
  if (data.notes !== undefined) {
    updates.push(`notes = '${data.notes.replace(/'/g, "''")}'`);
  }

  if (updates.length === 0) return { success: true };

  await db.execute(sql.raw(`
    UPDATE revenueGoals
    SET ${updates.join(', ')}
    WHERE id = ${id}
  `));

  // Registrar histórico se o valor mudou
  if (data.targetAmount !== undefined && data.targetAmount !== previousAmount && data.changedBy) {
    const changedByName = data.changedByName ? `'${data.changedByName.replace(/'/g, "''")}'` : 'NULL';
    await db.execute(sql.raw(`
      INSERT INTO revenueGoalHistory (goalId, previousAmount, newAmount, changedBy, changedByName)
      VALUES (${id}, ${previousAmount}, ${data.targetAmount}, '${data.changedBy}', ${changedByName})
    `));
  }

  return { success: true };
}

export async function deleteRevenueGoal(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.execute(sql.raw(`DELETE FROM revenueGoals WHERE id = ${id}`));
  return { success: true };
}

export async function upsertRevenueGoal(data: {
  year: number;
  month: number;
  channelId?: number | null;
  targetAmount: number;
  notes?: string;
  createdBy: string;
  createdByName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verificar se já existe
  const existing = await getRevenueGoal(data.year, data.month, data.channelId);
  
  if (existing) {
    return updateRevenueGoal(existing.id, {
      targetAmount: data.targetAmount,
      notes: data.notes,
      changedBy: data.createdBy,
      changedByName: data.createdByName,
    });
  } else {
    return createRevenueGoal(data);
  }
}

export async function getRevenueGoalProgress(year: number, month: number) {
  const db = await getDb();
  if (!db) return null;

  // Buscar metas do mês
  const goals = await db.execute(sql.raw(`
    SELECT 
      rg.id,
      rg.channelId,
      rg.targetAmount,
      COALESCE(sc.name, 'Geral') as channelName,
      COALESCE(sc.code, 'ALL') as channelCode
    FROM revenueGoals rg
    LEFT JOIN salesChannels sc ON rg.channelId = sc.id
    WHERE rg.year = ${year} AND rg.month = ${month}
  `));

  const goalsRows = goals[0] as unknown as any[];
  if (goalsRows.length === 0) return null;

  // Buscar faturamento do mês - usar dateUtils para consistência
  const startDate = startOfMonthBrazil(year, month);
  const endDate = endOfMonthBrazil(year, month);

  const revenue = await db.execute(sql.raw(`
    SELECT 
      COALESCE(s.channelId, 0) as channelId,
      SUM(s.finalAmount) as totalRevenue
    FROM sales s
    WHERE s.status = 'ACTIVE'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endDate}'
    GROUP BY s.channelId
  `));

  const revenueRows = revenue[0] as unknown as any[];
  const revenueByChannel: Record<number, number> = {};
  let totalRevenue = 0;

  for (const row of revenueRows) {
    const channelId = row.channelId || 0;
    const amount = parseFloat(row.totalRevenue || '0');
    revenueByChannel[channelId] = amount;
    totalRevenue += amount;
  }

  // Montar resultado
  const result = goalsRows.map(goal => {
    const channelId = goal.channelId;
    const targetAmount = parseFloat(goal.targetAmount || '0');
    let currentRevenue = 0;

    if (channelId === null) {
      // Meta geral - soma de todos os canais
      currentRevenue = totalRevenue;
    } else {
      // Meta específica do canal
      currentRevenue = revenueByChannel[channelId] || 0;
    }

    const progress = targetAmount > 0 ? (currentRevenue / targetAmount) * 100 : 0;
    const remaining = Math.max(0, targetAmount - currentRevenue);

    return {
      id: goal.id,
      channelId,
      channelName: goal.channelName,
      channelCode: goal.channelCode,
      targetAmount,
      currentRevenue,
      progress: Math.round(progress * 10) / 10, // 1 casa decimal
      remaining,
      achieved: currentRevenue >= targetAmount,
    };
  });

  return {
    year,
    month,
    goals: result,
    totalTarget: result.reduce((sum, g) => sum + g.targetAmount, 0),
    totalRevenue,
    overallProgress: result.length > 0 
      ? Math.round((totalRevenue / result.reduce((sum, g) => sum + g.targetAmount, 0)) * 1000) / 10 
      : 0,
  };
}


// ==================== FECHAMENTO MENSAL ====================

export async function getMonthlyClosing(year: number, month: number, skipExtras = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Usar dateUtils para consistência de timezone
  const startDate = startOfMonthBrazil(year, month);
  const endDate = endOfMonthBrazil(year, month);

  // 1. VENDAS - Faturamento por tipo (simplificado para compatibilidade)
  const salesResult = await db.execute(sql.raw(`
    SELECT 
      s.saleType,
      COUNT(*) as salesCount,
      SUM(s.finalAmount) as revenue,
      SUM(s.subtotal) as subtotal
    FROM sales s
    WHERE s.status = 'ACTIVE'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endDate}'
    GROUP BY s.saleType
  `));

  // Buscar custo total separadamente
  const costResult = await db.execute(sql.raw(`
    SELECT 
      SUM(si.quantity * p.avgCost) as totalCost
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    WHERE s.status = 'ACTIVE'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endDate}'
  `));
  const totalCostValue = parseFloat((costResult[0] as unknown as any[])[0]?.totalCost || '0');

  const salesRows = salesResult[0] as unknown as any[];
  const salesByType: Record<string, { count: number; revenue: number; cost: number }> = {};
  let totalSales = { count: 0, revenue: 0, cost: totalCostValue };

  for (const row of salesRows) {
    const type = row.saleType;
    if (!type) continue;
    
    const data = {
      count: parseInt(row.salesCount || '0'),
      revenue: parseFloat(row.revenue || '0'),
      cost: 0, // Custo será distribuído proporcionalmente
    };
    
    salesByType[type] = data;
    totalSales.count += data.count;
    totalSales.revenue += data.revenue;
  }

  // Distribuir custo proporcionalmente por tipo de venda
  if (totalSales.revenue > 0) {
    for (const type of Object.keys(salesByType)) {
      const proportion = salesByType[type].revenue / totalSales.revenue;
      salesByType[type].cost = totalCostValue * proportion;
    }
  }

  // 2. COMPRAS - Total por tipo de documento
  const purchasesResult = await db.execute(sql.raw(`
    SELECT 
      po.docType,
      COUNT(*) as purchaseCount,
      SUM(po.totalAmount) as totalAmount
    FROM purchaseOrders po
    WHERE po.status = 'CONFIRMED'
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) <= '${endDate}'
    GROUP BY po.docType
  `));

  const purchasesRows = purchasesResult[0] as unknown as any[];
  const purchasesByType: Record<string, { count: number; amount: number }> = {};
  let totalPurchases = { count: 0, amount: 0 };

  for (const row of purchasesRows) {
    const type = row.docType;
    if (!type) continue;
    
    const data = {
      count: parseInt(row.purchaseCount || '0'),
      amount: parseFloat(row.totalAmount || '0'),
    };
    
    purchasesByType[type] = data;
    totalPurchases.count += data.count;
    totalPurchases.amount += data.amount;
  }

  // 3. DESPESAS - Total por categoria
  const expensesResult = await db.execute(sql.raw(`
    SELECT 
      ec.id as categoryId,
      ec.name as categoryName,
      COUNT(*) as expenseCount,
      SUM(e.amount) as totalAmount
    FROM expenses e
    LEFT JOIN expenseCategories ec ON e.categoryId = ec.id
    WHERE e.status != 'CANCELADA'
      AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) <= '${endDate}'
    GROUP BY ec.id, ec.name
  `));

  const expensesRows = expensesResult[0] as unknown as any[];
  const expensesByCategory: Array<{ categoryId: number; categoryName: string; count: number; amount: number }> = [];
  let totalExpenses = { count: 0, amount: 0 };

  for (const row of expensesRows) {
    const data = {
      categoryId: row.categoryId || 0,
      categoryName: row.categoryName || 'Sem Categoria',
      count: parseInt(row.expenseCount || '0'),
      amount: parseFloat(row.totalAmount || '0'),
    };
    expensesByCategory.push(data);
    totalExpenses.count += data.count;
    totalExpenses.amount += data.amount;
  }

  // 4. CONTAS A PAGAR - Pagamentos realizados no mês (queries separadas para compatibilidade)
  const purchasePaymentsResult = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM purchaseInstallments 
    WHERE paidDate IS NOT NULL
      AND DATE(CONVERT_TZ(paidDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(paidDate, '+00:00', '-03:00')) <= '${endDate}'
  `));

  const expensePaymentsResult = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(paymentAmount), 0) as total
    FROM expenseInstallments 
    WHERE paymentDate IS NOT NULL
      AND DATE(CONVERT_TZ(paymentDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(paymentDate, '+00:00', '-03:00')) <= '${endDate}'
  `));

  const purchasePaymentsRows = purchasePaymentsResult[0] as unknown as any[];
  const expensePaymentsRows = expensePaymentsResult[0] as unknown as any[];
  const purchasePayments = parseFloat(purchasePaymentsRows[0]?.total || '0');
  const expensePayments = parseFloat(expensePaymentsRows[0]?.total || '0');

  // 5. CONTAS A RECEBER - Recebimentos no mês
  const receivablesResult = await db.execute(sql.raw(`
    SELECT COALESCE(SUM(paidAmount), 0) as totalReceived
    FROM receivablePayments
    WHERE DATE(CONVERT_TZ(paidDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(paidDate, '+00:00', '-03:00')) <= '${endDate}'
  `));

  const receivablesRows = receivablesResult[0] as unknown as any[];
  const totalReceived = parseFloat(receivablesRows[0]?.totalReceived || '0');

  // 6. RECEITAS CONTÁBEIS - Buscar lançamentos de receita
  const revenueResult = await db.execute(sql.raw(`
    SELECT 
      ra.id as accountId,
      ra.code as accountCode,
      ra.name as accountName,
      ra.accountType,
      ra.saleType,
      re.entryType,
      SUM(CAST(re.amount AS DECIMAL(12,2))) as total
    FROM revenueEntries re
    INNER JOIN revenueAccounts ra ON re.revenueAccountId = ra.id
    WHERE DATE(CONVERT_TZ(re.entryDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(re.entryDate, '+00:00', '-03:00')) <= '${endDate}'
    GROUP BY ra.id, ra.code, ra.name, ra.accountType, ra.saleType, re.entryType
    ORDER BY ra.code
  `));

  const revenueRows = revenueResult[0] as unknown as any[];
  let receitaBrutaTotal = 0;
  let deducoesTotal = 0;
  const receitaByAccount: Array<{ code: string; name: string; type: string; saleType: string | null; total: number }> = [];
  const receitaBySaleType: Record<string, number> = { BALCAO: 0, DELIVERY: 0, A_PRAZO: 0 };

  for (const row of revenueRows) {
    const total = parseFloat(row.total || '0');
    const accountType = row.accountType;
    const saleType = row.saleType;
    
    if (accountType === 'RECEITA_BRUTA') {
      receitaBrutaTotal += total;
      if (saleType && receitaBySaleType[saleType] !== undefined) {
        receitaBySaleType[saleType] += total;
      }
    } else if (accountType === 'DEDUCAO') {
      deducoesTotal += total;
    }
    
    receitaByAccount.push({
      code: row.accountCode,
      name: row.accountName,
      type: accountType,
      saleType: saleType,
      total
    });
  }

  const receitaLiquida = receitaBrutaTotal - deducoesTotal;

  // 7. DESPESAS POR CONTA GERENCIAL
  const expensesByAccountResult = await db.execute(sql.raw(`
    SELECT 
      ma.id as accountId,
      ma.code as accountCode,
      ma.name as accountName,
      ma.nature,
      ma.classification,
      SUM(CAST(e.amount AS DECIMAL(12,2))) as total,
      COUNT(*) as count
    FROM expenses e
    INNER JOIN managementAccounts ma ON e.managementAccountId = ma.id
    WHERE e.status != 'CANCELADA'
      AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(e.createdAt, '+00:00', '-03:00')) <= '${endDate}'
    GROUP BY ma.id, ma.code, ma.name, ma.nature, ma.classification
    ORDER BY total DESC
  `));

  const expensesByAccountRows = expensesByAccountResult[0] as unknown as any[];
  const expensesByAccount: Array<{ code: string; name: string; nature: string; classification: string; total: number; count: number }> = [];
  const expensesByClassification: Record<string, number> = {
    OPERACIONAL: 0,
    ADMINISTRATIVA: 0,
    COMERCIAL: 0,
    FINANCEIRA: 0,
    NAO_OPERACIONAL: 0,
    PATRIMONIAL: 0
  };

  for (const row of expensesByAccountRows) {
    const total = parseFloat(row.total || '0');
    const classification = row.classification || 'OPERACIONAL';
    
    expensesByAccount.push({
      code: row.accountCode,
      name: row.accountName,
      nature: row.nature,
      classification: classification,
      total,
      count: parseInt(row.count || '0')
    });
    
    if (expensesByClassification[classification] !== undefined) {
      expensesByClassification[classification] += total;
    }
  }

  // 8. Calcular resultados (DRE)
  const cmv = totalSales.cost; // CMV já calculado anteriormente
  const lucroBruto = receitaLiquida - cmv;
  const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
  
  const despesasOperacionais = expensesByClassification.OPERACIONAL + expensesByClassification.COMERCIAL;
  const despesasAdministrativas = expensesByClassification.ADMINISTRATIVA;
  const despesasFinanceiras = expensesByClassification.FINANCEIRA;
  const outrasDespesas = expensesByClassification.NAO_OPERACIONAL + expensesByClassification.PATRIMONIAL;
  
  const resultadoOperacional = lucroBruto - despesasOperacionais - despesasAdministrativas;
  const resultadoLiquido = resultadoOperacional - despesasFinanceiras - outrasDespesas;
  const margemLiquida = receitaLiquida > 0 ? (resultadoLiquido / receitaLiquida) * 100 : 0;

  // Manter compatibilidade com estrutura antiga
  const grossProfit = totalSales.revenue - totalSales.cost;
  const grossMargin = totalSales.revenue > 0 ? (grossProfit / totalSales.revenue) * 100 : 0;
  const netResult = totalSales.revenue - totalSales.cost - totalExpenses.amount;
  const netMargin = totalSales.revenue > 0 ? (netResult / totalSales.revenue) * 100 : 0;

  // NOVAS SEÇÕES PARA O LAYOUT ATUALIZADO (skip em chamadas recursivas)
  let salesByCategory: any[] = [];
  let purchasesByCategory: any[] = [];
  let salesByPaymentType: any[] = [];
  let stockByCategory: any[] = [];
  let purchasesBySupplier: any[] = [];
  let salesByChannel: any[] = [];
  let goalsProgress: any = null;
  let previousMonthData: any = null;

  if (!skipExtras) {
    [salesByCategory, purchasesByCategory, salesByPaymentType, stockByCategory, purchasesBySupplier, salesByChannel] = await Promise.all([
      getSalesByCategory(startDate, endDate),
      getPurchasesByCategory(startDate, endDate),
      getSalesByPaymentType(startDate, endDate),
      getStockByCategory(startDate, endDate, year, month),
      getPurchasesBySupplier(startDate, endDate),
      getSalesByChannel(startDate, endDate),
    ]);

    // Buscar metas do mês
    goalsProgress = await getRevenueGoalProgress(year, month);

    // Buscar dados do mês anterior para comparação
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    try {
      previousMonthData = await getMonthlyClosing(prevYear, prevMonth, true);
      // Buscar salesByCategory do mês anterior separadamente (skipExtras não inclui)
      const prevStartDate = startOfMonthBrazil(prevYear, prevMonth);
      const prevEndDate = endOfMonthBrazil(prevYear, prevMonth);
      if (previousMonthData) {
        previousMonthData.salesByCategory = await getSalesByCategory(prevStartDate, prevEndDate);
      }
    } catch (e) {
      console.warn(`Não foi possível carregar dados do mês anterior (${prevYear}-${prevMonth})`);
    }
  }

  return {
    period: {
      year,
      month,
      startDate,
      endDate,
      monthName: new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long' }),
    },
    sales: {
      total: totalSales,
      byType: salesByType,
    },
    purchases: {
      total: totalPurchases,
      byType: purchasesByType,
    },
    expenses: {
      total: totalExpenses,
      byCategory: expensesByCategory,
    },
    cashFlow: {
      received: totalReceived,
      paid: purchasePayments + expensePayments,
      purchasePayments,
      expensePayments,
      balance: totalReceived - (purchasePayments + expensePayments),
    },
    // Estrutura antiga (compatibilidade)
    results: {
      revenue: totalSales.revenue,
      cost: totalSales.cost,
      grossProfit,
      grossMargin: Math.round(grossMargin * 10) / 10,
      operationalExpenses: totalExpenses.amount,
      netResult,
      netMargin: Math.round(netMargin * 10) / 10,
    },
    // NOVA ESTRUTURA: DRE Contábil
    dre: {
      receitaBruta: {
        total: receitaBrutaTotal,
        balcao: receitaBySaleType.BALCAO,
        delivery: receitaBySaleType.DELIVERY,
        aPrazo: receitaBySaleType.A_PRAZO,
        byAccount: receitaByAccount.filter(a => a.type === 'RECEITA_BRUTA'),
      },
      deducoes: {
        total: deducoesTotal,
        byAccount: receitaByAccount.filter(a => a.type === 'DEDUCAO'),
      },
      receitaLiquida,
      cmv,
      lucroBruto,
      margemBruta: Math.round(margemBruta * 10) / 10,
      despesas: {
        operacionais: despesasOperacionais,
        administrativas: despesasAdministrativas,
        financeiras: despesasFinanceiras,
        outras: outrasDespesas,
        total: totalExpenses.amount,
        byClassification: expensesByClassification,
        byAccount: expensesByAccount,
      },
      resultadoOperacional,
      resultadoLiquido,
      margemLiquida: Math.round(margemLiquida * 10) / 10,
    },
    // NOVAS SEÇÕES DO LAYOUT ATUALIZADO
    salesByCategory,
    purchasesByCategory,
    salesByPaymentType,
    stockByCategory,
    purchasesBySupplier,
    salesByChannel,
    goals: goalsProgress,
    previousMonth: previousMonthData ? {
      revenue: previousMonthData.results.revenue,
      grossProfit: previousMonthData.results.grossProfit,
      operationalExpenses: previousMonthData.results.operationalExpenses,
      netResult: previousMonthData.results.netResult,
      salesByCategory: previousMonthData.salesByCategory || [],
    } : null,
  };
}

export async function getYearlyClosing(year: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const monthlyData: any[] = [];
  
  // Buscar dados de cada mês
  for (let month = 1; month <= 12; month++) {
    const data = await getMonthlyClosing(year, month);
    monthlyData.push({
      month,
      monthName: data.period.monthName,
      ...data.results,
      salesCount: data.sales.total.count,
      purchasesTotal: data.purchases.total.amount,
      expensesTotal: data.expenses.total.amount,
    });
  }

  // Calcular totais anuais
  const yearTotals = monthlyData.reduce((acc, m) => ({
    revenue: acc.revenue + m.revenue,
    cost: acc.cost + m.cost,
    grossProfit: acc.grossProfit + m.grossProfit,
    operationalExpenses: acc.operationalExpenses + m.operationalExpenses,
    netResult: acc.netResult + m.netResult,
    salesCount: acc.salesCount + m.salesCount,
    purchasesTotal: acc.purchasesTotal + m.purchasesTotal,
    expensesTotal: acc.expensesTotal + m.expensesTotal,
  }), {
    revenue: 0,
    cost: 0,
    grossProfit: 0,
    operationalExpenses: 0,
    netResult: 0,
    salesCount: 0,
    purchasesTotal: 0,
    expensesTotal: 0,
  });

  yearTotals.grossMargin = yearTotals.revenue > 0 
    ? Math.round((yearTotals.grossProfit / yearTotals.revenue) * 1000) / 10 
    : 0;
  yearTotals.netMargin = yearTotals.revenue > 0 
    ? Math.round((yearTotals.netResult / yearTotals.revenue) * 1000) / 10 
    : 0;

  return {
    year,
    months: monthlyData,
    totals: yearTotals,
  };
}


// Buscar histórico de alterações de uma meta
export async function getRevenueGoalHistory(goalId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql.raw(`
    SELECT 
      id,
      goalId,
      previousAmount,
      newAmount,
      changedBy,
      changedByName,
      reason,
      createdAt
    FROM revenueGoalHistory
    WHERE goalId = ${goalId}
    ORDER BY createdAt DESC
  `));

  const rows = result[0] as unknown as any[];
  return rows.map(row => ({
    id: row.id,
    goalId: row.goalId,
    previousAmount: parseFloat(row.previousAmount || '0'),
    newAmount: parseFloat(row.newAmount || '0'),
    changedBy: row.changedBy,
    changedByName: row.changedByName,
    reason: row.reason,
    createdAt: row.createdAt,
  }));
}

// Buscar todo o histórico de metas de um período
export async function getAllRevenueGoalHistory(year: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql.raw(`
    SELECT 
      h.id,
      h.goalId,
      h.previousAmount,
      h.newAmount,
      h.changedBy,
      h.changedByName,
      h.reason,
      CONVERT_TZ(h.createdAt, '+00:00', '-03:00') as createdAt,
      g.year,
      g.month,
      g.notes,
      COALESCE(sc.name, 'Geral') as channelName
    FROM revenueGoalHistory h
    JOIN revenueGoals g ON h.goalId = g.id
    LEFT JOIN salesChannels sc ON g.channelId = sc.id
    WHERE g.year = ${year}
    ORDER BY h.createdAt DESC
    LIMIT 50
  `));

  const rows = result[0] as unknown as any[];
  return rows.map(row => ({
    id: row.id,
    goalId: row.goalId,
    previousAmount: parseFloat(row.previousAmount || '0'),
    newAmount: parseFloat(row.newAmount || '0'),
    changedBy: row.changedBy,
    changedByName: row.changedByName,
    reason: row.reason,
    notes: row.notes,
    createdAt: row.createdAt,
    year: row.year,
    month: row.month,
    channelName: row.channelName,
  }));
}


// ==================== CONTAS GERENCIAIS ====================

// Listar todas as contas gerenciais ativas
export async function listManagementAccounts(filters?: {
  nature?: string;
  classification?: string;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = `
    SELECT 
      ma.id,
      ma.code,
      ma.name,
      ma.description,
      ma.nature,
      ma.costType,
      ma.classification,
      ma.impactMargin,
      ma.impactPayroll,
      ma.isActive,
      ma.displayOrder,
      am.accountingCode,
      am.accountingName
    FROM managementAccounts ma
    LEFT JOIN accountingMappings am ON ma.id = am.managementAccountId 
      AND am.effectiveDate <= NOW() 
      AND (am.endDate IS NULL OR am.endDate > NOW())
    WHERE ma.isActive = 1
  `;
  
  if (filters?.nature) {
    query += ` AND ma.nature = '${filters.nature}'`;
  }
  if (filters?.classification) {
    query += ` AND ma.classification = '${filters.classification}'`;
  }
  if (filters?.search) {
    query += ` AND (ma.name LIKE '%${filters.search}%' OR ma.code LIKE '%${filters.search}%')`;
  }
  
  query += ` ORDER BY ma.displayOrder, ma.name`;
  
  const result = await db.execute(sql.raw(query));
  const rows = result[0] as unknown as any[];
  
  return rows.map(row => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    nature: row.nature,
    costType: row.costType,
    classification: row.classification,
    impactMargin: Boolean(row.impactMargin),
    impactPayroll: Boolean(row.impactPayroll),
    isActive: Boolean(row.isActive),
    displayOrder: row.displayOrder,
    accountingCode: row.accountingCode,
    accountingName: row.accountingName,
  }));
}

// Buscar conta gerencial por ID
export async function getManagementAccountById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.execute(sql.raw(`
    SELECT 
      ma.id,
      ma.code,
      ma.name,
      ma.description,
      ma.nature,
      ma.costType,
      ma.classification,
      ma.impactMargin,
      ma.impactPayroll,
      ma.isActive,
      ma.displayOrder,
      am.accountingCode,
      am.accountingName
    FROM managementAccounts ma
    LEFT JOIN accountingMappings am ON ma.id = am.managementAccountId 
      AND am.effectiveDate <= NOW() 
      AND (am.endDate IS NULL OR am.endDate > NOW())
    WHERE ma.id = ${id}
  `));
  
  const rows = result[0] as unknown as any[];
  if (rows.length === 0) return null;
  
  const row = rows[0];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    nature: row.nature,
    costType: row.costType,
    classification: row.classification,
    impactMargin: Boolean(row.impactMargin),
    impactPayroll: Boolean(row.impactPayroll),
    isActive: Boolean(row.isActive),
    displayOrder: row.displayOrder,
    accountingCode: row.accountingCode,
    accountingName: row.accountingName,
  };
}

// Criar nova conta gerencial
export async function createManagementAccount(data: {
  code: string;
  name: string;
  description?: string;
  nature: 'CUSTO' | 'DESPESA' | 'RECEITA' | 'PATRIMONIAL';
  costType?: 'FIXA' | 'VARIAVEL';
  classification: string;
  impactMargin?: boolean;
  impactPayroll?: boolean;
  accountingCode: string;
  accountingName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Inserir conta gerencial
  const insertResult = await db.insert(managementAccounts).values({
    code: data.code,
    name: data.name,
    description: data.description || data.name,
    nature: data.nature,
    costType: data.costType || null,
    classification: data.classification as any,
    impactMargin: data.impactMargin || false,
    impactPayroll: data.impactPayroll || false,
    isActive: true,
  });
  
  const managementAccountId = (insertResult[0] as any).insertId;
  
  // Inserir mapeamento contábil
  await db.insert(accountingMappings).values({
    managementAccountId,
    accountingCode: data.accountingCode,
    accountingName: data.accountingName || data.name,
    effectiveDate: new Date(),
  });
  
  return managementAccountId;
}

// Atualizar conta gerencial
export async function updateManagementAccount(id: number, data: {
  name?: string;
  description?: string;
  costType?: 'FIXA' | 'VARIAVEL';
  impactMargin?: boolean;
  impactPayroll?: boolean;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.costType !== undefined) updateData.costType = data.costType;
  if (data.impactMargin !== undefined) updateData.impactMargin = data.impactMargin;
  if (data.impactPayroll !== undefined) updateData.impactPayroll = data.impactPayroll;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  
  if (Object.keys(updateData).length > 0) {
    await db.update(managementAccounts)
      .set(updateData)
      .where(eq(managementAccounts.id, id));
  }
  
  return true;
}

// Buscar código contábil por conta gerencial
export async function getAccountingCodeByManagementAccount(managementAccountId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.execute(sql.raw(`
    SELECT accountingCode 
    FROM accountingMappings 
    WHERE managementAccountId = ${managementAccountId}
      AND effectiveDate <= NOW()
      AND (endDate IS NULL OR endDate > NOW())
    ORDER BY effectiveDate DESC
    LIMIT 1
  `));
  
  const rows = result[0] as unknown as any[];
  return rows.length > 0 ? rows[0].accountingCode : null;
}

// Listar contas gerenciais para dropdown (simplificado)
export async function listManagementAccountsForSelect() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.execute(sql.raw(`
    SELECT 
      ma.id,
      ma.code,
      ma.name,
      ma.nature,
      ma.classification,
      am.accountingCode
    FROM managementAccounts ma
    LEFT JOIN accountingMappings am ON ma.id = am.managementAccountId 
      AND am.effectiveDate <= NOW() 
      AND (am.endDate IS NULL OR am.endDate > NOW())
    WHERE ma.isActive = 1
    ORDER BY ma.classification, ma.displayOrder, ma.name
  `));
  
  const rows = result[0] as unknown as any[];
  
  return rows.map(row => ({
    id: row.id,
    code: row.code,
    name: row.name,
    nature: row.nature,
    classification: row.classification,
    accountingCode: row.accountingCode,
    label: `${row.name} (${row.accountingCode})`,
  }));
}

// Buscar contas gerenciais agrupadas por classificação
export async function listManagementAccountsGrouped() {
  const accounts = await listManagementAccountsForSelect();
  
  const grouped: Record<string, typeof accounts> = {};
  
  for (const account of accounts) {
    const classification = account.classification || 'OUTROS';
    if (!grouped[classification]) {
      grouped[classification] = [];
    }
    grouped[classification].push(account);
  }
  
  return grouped;
}


// ==================== FUNÇÕES DE RECEITA ====================

// Buscar conta de receita por tipo de venda
export async function getRevenueAccountBySaleType(saleType: 'BALCAO' | 'DELIVERY' | 'A_PRAZO'): Promise<RevenueAccount | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(revenueAccounts)
    .where(and(
      eq(revenueAccounts.saleType, saleType),
      eq(revenueAccounts.isDefault, true),
      eq(revenueAccounts.isActive, true)
    ))
    .limit(1);
  
  return result[0] || null;
}

// Buscar conta de dedução por tipo
export async function getDeductionAccount(type: 'DESCONTO' | 'TAXA_DELIVERY'): Promise<RevenueAccount | null> {
  const db = await getDb();
  if (!db) return null;
  
  const code = type === 'DESCONTO' ? '4.1.02.001' : '4.1.02.002';
  
  const result = await db.select()
    .from(revenueAccounts)
    .where(and(
      eq(revenueAccounts.code, code),
      eq(revenueAccounts.isActive, true)
    ))
    .limit(1);
  
  return result[0] || null;
}

// Listar todas as contas de receita
export async function listRevenueAccounts(): Promise<RevenueAccount[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(revenueAccounts)
    .where(eq(revenueAccounts.isActive, true))
    .orderBy(revenueAccounts.displayOrder);
}

// Criar lançamento de receita
export async function createRevenueEntry(data: InsertRevenueEntry): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(revenueEntries).values(data);
  return Number((result as any)[0]?.insertId || (result as any).insertId);
}

// Criar lançamentos de receita para uma venda (receita bruta + deduções)
export async function createRevenueEntriesForSale(
  saleId: number,
  saleType: 'BALCAO' | 'DELIVERY' | 'A_PRAZO',
  finalAmount: string | number,
  discountAmount: string | number,
  saleDate: Date
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar conta de receita para o tipo de venda
  const revenueAccount = await getRevenueAccountBySaleType(saleType);
  if (!revenueAccount) {
    console.warn(`[createRevenueEntriesForSale] Conta de receita não encontrada para tipo: ${saleType}`);
    return;
  }
  
  // Calcular receita bruta (valor final + desconto, pois o desconto foi subtraído)
  const finalAmountNum = typeof finalAmount === 'string' ? parseFloat(finalAmount) : finalAmount;
  const discountAmountNum = typeof discountAmount === 'string' ? parseFloat(discountAmount) : discountAmount;
  const grossAmount = finalAmountNum + discountAmountNum;
  
  // Lançamento de receita bruta (CRÉDITO)
  await createRevenueEntry({
    saleId,
    revenueAccountId: revenueAccount.id,
    amount: grossAmount.toFixed(2),
    entryType: 'CREDITO',
    description: `Venda #${saleId} - ${saleType}`,
    entryDate: saleDate
  });
  
  // Se houver desconto, criar lançamento de dedução (DÉBITO)
  if (discountAmountNum > 0) {
    const discountAccount = await getDeductionAccount('DESCONTO');
    if (discountAccount) {
      await createRevenueEntry({
        saleId,
        revenueAccountId: discountAccount.id,
        amount: discountAmountNum.toFixed(2),
        entryType: 'DEBITO',
        description: `Desconto Venda #${saleId}`,
        entryDate: saleDate
      });
    }
  }
  
  // Atualizar revenueAccountId na venda
  await db.update(sales)
    .set({ revenueAccountId: revenueAccount.id })
    .where(eq(sales.id, saleId));
}

// Buscar lançamentos de receita por período
export async function getRevenueEntriesByPeriod(dateFrom: string, dateTo: string) {
  const db = await getDb();
  if (!db) return [];
  
  // Converter para UTC (Brasília = UTC-3)
  const startDate = `${dateFrom} 03:00:00`;
  const endDate = `${dateTo} 03:00:00`;
  
  return await db.select({
    id: revenueEntries.id,
    saleId: revenueEntries.saleId,
    revenueAccountId: revenueEntries.revenueAccountId,
    amount: revenueEntries.amount,
    entryType: revenueEntries.entryType,
    description: revenueEntries.description,
    entryDate: revenueEntries.entryDate,
    accountCode: revenueAccounts.code,
    accountName: revenueAccounts.name,
    accountType: revenueAccounts.accountType
  })
    .from(revenueEntries)
    .innerJoin(revenueAccounts, eq(revenueEntries.revenueAccountId, revenueAccounts.id))
    .where(and(
      sql`${revenueEntries.entryDate} >= ${startDate}`,
      sql`${revenueEntries.entryDate} < DATE_ADD(${endDate}, INTERVAL 1 DAY)`
    ))
    .orderBy(revenueEntries.entryDate);
}

// Calcular totais de receita por período (para DRE)
export async function getRevenueTotalsByPeriod(dateFrom: string, dateTo: string) {
  const db = await getDb();
  if (!db) return {
    receitaBruta: 0,
    deducoes: 0,
    receitaLiquida: 0,
    byAccount: [] as { code: string; name: string; type: string; total: number }[]
  };
  
  // Converter para UTC (Brasília = UTC-3)
  const startDate = `${dateFrom} 03:00:00`;
  const endDate = `${dateTo} 03:00:00`;
  
  // Buscar totais agrupados por conta
  const results = await db.select({
    accountId: revenueAccounts.id,
    accountCode: revenueAccounts.code,
    accountName: revenueAccounts.name,
    accountType: revenueAccounts.accountType,
    entryType: revenueEntries.entryType,
    total: sql<string>`SUM(${revenueEntries.amount})`
  })
    .from(revenueEntries)
    .innerJoin(revenueAccounts, eq(revenueEntries.revenueAccountId, revenueAccounts.id))
    .where(and(
      sql`${revenueEntries.entryDate} >= ${startDate}`,
      sql`${revenueEntries.entryDate} < DATE_ADD(${endDate}, INTERVAL 1 DAY)`
    ))
    .groupBy(revenueAccounts.id, revenueAccounts.code, revenueAccounts.name, revenueAccounts.accountType, revenueEntries.entryType);
  
  let receitaBruta = 0;
  let deducoes = 0;
  const byAccount: { code: string; name: string; type: string; total: number }[] = [];
  
  for (const row of results) {
    const total = parseFloat(row.total || '0');
    
    if (row.accountType === 'RECEITA_BRUTA') {
      receitaBruta += total;
    } else if (row.accountType === 'DEDUCAO') {
      deducoes += total;
    }
    
    byAccount.push({
      code: row.accountCode,
      name: row.accountName,
      type: row.accountType,
      total
    });
  }
  
  return {
    receitaBruta,
    deducoes,
    receitaLiquida: receitaBruta - deducoes,
    byAccount
  };
}

// Calcular CMV (Custo de Mercadoria Vendida) por período
export async function getCMVByPeriod(dateFrom: string, dateTo: string) {
  const db = await getDb();
  if (!db) return { cmvTotal: 0, byProduct: [] as { productId: number; productName: string; quantity: number; avgCost: number; cmv: number }[] };
  
  // Converter para UTC (Brasília = UTC-3)
  const startDate = `${dateFrom} 03:00:00`;
  const endDate = `${dateTo} 03:00:00`;
  
  // Buscar itens de venda com custo médio do produto
  const results = await db.select({
    productId: saleItems.productId,
    productName: products.name,
    quantity: sql<string>`SUM(${saleItems.quantity})`,
    avgCost: products.avgCost
  })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(and(
      sql`${sales.saleDate} >= ${startDate}`,
      sql`${sales.saleDate} < DATE_ADD(${endDate}, INTERVAL 1 DAY)`,
      eq(sales.status, 'ACTIVE')
    ))
    .groupBy(saleItems.productId, products.name, products.avgCost);
  
  let cmvTotal = 0;
  const byProduct: { productId: number; productName: string; quantity: number; avgCost: number; cmv: number }[] = [];
  
  for (const row of results) {
    const quantity = parseInt(row.quantity || '0');
    const avgCost = parseFloat(row.avgCost || '0');
    const cmv = quantity * avgCost;
    
    cmvTotal += cmv;
    
    byProduct.push({
      productId: row.productId,
      productName: row.productName,
      quantity,
      avgCost,
      cmv
    });
  }
  
  return { cmvTotal, byProduct };
}


// ==================== BACKUP LOGS (BUG-05) ====================

/**
 * Criar log de backup iniciado
 */
export async function createBackupLog(triggeredBy: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(backupLogs).values({
    startedAt: new Date(),
    status: "running",
    triggeredBy,
  });
  
  // @ts-ignore - insertId exists on mysql result
  return result[0].insertId;
}

/**
 * Atualizar log com sucesso
 */
export async function updateBackupLogSuccess(
  logId: number,
  data: {
    databaseFile: string;
    databaseSize: number;
    codeFile: string;
    codeSize: number;
    databaseDriveId?: string;
    databaseDriveLink?: string;
    codeDriveId?: string;
    codeDriveLink?: string;
    localFilesDeleted: number;
    driveFilesDeleted: number;
    durationSeconds: number;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(backupLogs)
    .set({
      completedAt: new Date(),
      status: "success",
      databaseFile: data.databaseFile,
      databaseSize: data.databaseSize,
      codeFile: data.codeFile,
      codeSize: data.codeSize,
      databaseDriveId: data.databaseDriveId,
      databaseDriveLink: data.databaseDriveLink,
      codeDriveId: data.codeDriveId,
      codeDriveLink: data.codeDriveLink,
      localFilesDeleted: data.localFilesDeleted,
      driveFilesDeleted: data.driveFilesDeleted,
      durationSeconds: data.durationSeconds.toFixed(2),
    })
    .where(eq(backupLogs.id, logId));
}

/**
 * Atualizar log com sucesso parcial (backup local ok, drive falhou)
 */
export async function updateBackupLogPartial(
  logId: number,
  data: {
    databaseFile: string;
    databaseSize: number;
    codeFile: string;
    codeSize: number;
    localFilesDeleted: number;
    durationSeconds: number;
    errorMessage: string;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(backupLogs)
    .set({
      completedAt: new Date(),
      status: "partial",
      databaseFile: data.databaseFile,
      databaseSize: data.databaseSize,
      codeFile: data.codeFile,
      codeSize: data.codeSize,
      localFilesDeleted: data.localFilesDeleted,
      durationSeconds: data.durationSeconds.toFixed(2),
      errorMessage: data.errorMessage,
    })
    .where(eq(backupLogs.id, logId));
}

/**
 * Atualizar log com falha
 */
export async function updateBackupLogFailed(
  logId: number,
  errorMessage: string,
  durationSeconds: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(backupLogs)
    .set({
      completedAt: new Date(),
      status: "failed",
      errorMessage,
      durationSeconds: durationSeconds.toFixed(2),
    })
    .where(eq(backupLogs.id, logId));
}

/**
 * Listar últimos backups
 */
export async function listBackupLogs(limit: number = 20): Promise<BackupLog[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(backupLogs)
    .orderBy(desc(backupLogs.startedAt))
    .limit(limit);
}

/**
 * Obter último backup bem-sucedido
 */
export async function getLastSuccessfulBackup(): Promise<BackupLog | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(backupLogs)
    .where(eq(backupLogs.status, "success"))
    .orderBy(desc(backupLogs.startedAt))
    .limit(1);
  
  return result[0] || null;
}


// =====================================================
// CONTABILIZAÇÃO AUTOMÁTICA
// =====================================================

/**
 * Códigos de contas contábeis padrão para contabilização automática
 * Baseado no documento MAPEAMENTO-CONTABIL.md
 */
export const ACCOUNTING_CODES = {
  // ATIVO
  CAIXA_GERAL: "1.1.1.01",
  CLIENTES_A_PRAZO: "1.1.2.01",
  ESTOQUE_MERCADORIAS: "1.1.3.01",
  
  // PASSIVO
  FORNECEDORES: "2.1.1.01",
  CONTAS_A_PAGAR: "2.1.2.01",
  
  // RECEITAS
  RECEITA_VENDAS_BALCAO: "4.1.1.01",
  RECEITA_VENDAS_A_PRAZO: "4.1.1.02",
  RECEITA_VENDAS_DELIVERY: "4.1.1.03",
  DESCONTOS_OBTIDOS: "4.3.1.02",
  
  // CUSTOS
  CMV: "5.1.1.01",
  
  // DESPESAS
  JUROS_PAGOS: "6.3.1.01",
  DESCONTOS_CONCEDIDOS: "6.2.1.01",
};

/**
 * Buscar ID da conta contábil pelo código
 */
export async function getAccountIdByCode(code: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({ id: chartOfAccounts.id })
    .from(chartOfAccounts)
    .where(eq(chartOfAccounts.code, code))
    .limit(1);
  
  return result.length > 0 ? result[0].id : null;
}

/**
 * Criar um novo journal (lote contábil)
 */
export async function createJournal(data: {
  competenceMonth: string;
  description: string;
  createdBy: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(journals).values({
    companyId: 1,
    competenceMonth: data.competenceMonth,
    description: data.description,
    status: "DRAFT",
    totalDebit: "0.00",
    totalCredit: "0.00",
    createdBy: data.createdBy,
  });
  
  return (result[0] as any).insertId;
}

/**
 * Adicionar lançamento contábil a um journal
 */
export async function addAccountingEntry(data: {
  journalId: number;
  accountId: number;
  entryDate: Date;
  competenceMonth: string;
  amount: string;
  entryType: "D" | "C";
  description: string;
  sourceType?: string;
  sourceId?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(accountingEntries).values({
    companyId: 1,
    journalId: data.journalId,
    accountId: data.accountId,
    entryDate: data.entryDate,
    competenceMonth: data.competenceMonth,
    amount: data.amount,
    entryType: data.entryType,
    description: data.description,
    sourceType: data.sourceType,
    sourceId: data.sourceId,
  });
  
  return (result[0] as any).insertId;
}

/**
 * Registrar origem do journal (rastreabilidade)
 */
export async function addJournalSource(data: {
  journalId: number;
  sourceType: string;
  sourceId: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(journalSources).values({
    companyId: 1,
    journalId: data.journalId,
    sourceType: data.sourceType,
    sourceId: data.sourceId,
  });
}

/**
 * Atualizar totais do journal e postar
 */
export async function postJournal(journalId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Calcular totais
  const entries = await db.select({
    entryType: accountingEntries.entryType,
    amount: accountingEntries.amount,
  })
  .from(accountingEntries)
  .where(eq(accountingEntries.journalId, journalId));
  
  let totalDebit = 0;
  let totalCredit = 0;
  
  for (const entry of entries) {
    const amount = parseFloat(entry.amount);
    if (entry.entryType === "D") {
      totalDebit += amount;
    } else {
      totalCredit += amount;
    }
  }
  
  // Validar partida dobrada
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { 
      success: false, 
      error: `Partida dobrada inválida: Débito (${totalDebit.toFixed(2)}) ≠ Crédito (${totalCredit.toFixed(2)})` 
    };
  }
  
  // Atualizar journal
  await db.update(journals)
    .set({
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      status: "POSTED",
      postedAt: new Date(),
    })
    .where(eq(journals.id, journalId));
  
  return { success: true };
}

/**
 * Interface para lançamentos contábeis
 */
interface AccountingLedgerEntry {
  accountCode: string;
  accountId?: number;
  amount: string;
  type: "D" | "C";
  description: string;
}

/**
 * Criar lançamentos contábeis completos (journal + entries + source)
 */
export async function createAccountingEntries(data: {
  competenceMonth: string;
  entryDate: Date;
  description: string;
  sourceType: string;
  sourceId: number;
  entries: AccountingLedgerEntry[];
  createdBy: string;
}): Promise<{ success: boolean; journalId?: number; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    // 1. Criar journal
    const journalId = await createJournal({
      competenceMonth: data.competenceMonth,
      description: data.description,
      createdBy: data.createdBy,
    });
    
    // 2. Adicionar lançamentos
    for (const entry of data.entries) {
      // Buscar ID da conta se não fornecido
      let accountId = entry.accountId;
      if (!accountId) {
        accountId = await getAccountIdByCode(entry.accountCode);
        if (!accountId) {
          // Conta não encontrada - log e continua (não bloqueia)
          console.warn(`[Contabilização] Conta não encontrada: ${entry.accountCode}`);
          continue;
        }
      }
      
      await addAccountingEntry({
        journalId,
        accountId,
        entryDate: data.entryDate,
        competenceMonth: data.competenceMonth,
        amount: entry.amount,
        entryType: entry.type,
        description: entry.description,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
      });
    }
    
    // 3. Registrar origem
    await addJournalSource({
      journalId,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
    });
    
    // 4. Journal permanece como DRAFT até contabilização em lote
    // NÃO chamar postJournal automaticamente - isso será feito pelo batch
    
    return { success: true, journalId };
  } catch (error) {
    console.error("[Contabilização] Erro ao criar lançamentos:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Contabilizar compra confirmada
 * D - Estoque de Mercadorias
 * C - Fornecedores
 */
export async function accountPurchaseConfirmation(data: {
  purchaseOrderId: number;
  totalAmount: string;
  supplierId: number;
  supplierName: string;
  docNumber?: string;
  entryDate: Date;
  createdBy: string;
}): Promise<{ success: boolean; journalId?: number; error?: string }> {
  const competenceMonth = getCompetenceMonthBrazil(data.entryDate);
  
  return createAccountingEntries({
    competenceMonth,
    entryDate: data.entryDate,
    description: `Compra NF ${data.docNumber || data.purchaseOrderId} - ${data.supplierName}`,
    sourceType: "purchase",
    sourceId: data.purchaseOrderId,
    entries: [
      {
        accountCode: ACCOUNTING_CODES.ESTOQUE_MERCADORIAS,
        amount: data.totalAmount,
        type: "D",
        description: `Entrada estoque - NF ${data.docNumber || data.purchaseOrderId}`,
      },
      {
        accountCode: ACCOUNTING_CODES.FORNECEDORES,
        amount: data.totalAmount,
        type: "C",
        description: `Fornecedor ${data.supplierName} - NF ${data.docNumber || data.purchaseOrderId}`,
      },
    ],
    createdBy: data.createdBy,
  });
}

/**
 * Contabilizar pagamento de compra
 * D - Fornecedores (valor original)
 * D - Juros Pagos (se houver juros)
 * C - Caixa/Banco (valor total pago)
 * C - Descontos Obtidos (se houver desconto)
 */
export async function accountPurchasePayment(data: {
  purchaseOrderId: number;
  installmentId: number;
  originalAmount: string;
  paidAmount: string;
  interestAmount?: string;
  discountAmount?: string;
  supplierName: string;
  docNumber?: string;
  entryDate: Date;
  createdBy: string;
}): Promise<{ success: boolean; journalId?: number; error?: string }> {
  const competenceMonth = getCompetenceMonthBrazil(data.entryDate);
  const entries: AccountingLedgerEntry[] = [];
  
  const originalAmount = parseFloat(data.originalAmount);
  const interestAmount = data.interestAmount ? parseFloat(data.interestAmount) : 0;
  const discountAmount = data.discountAmount ? parseFloat(data.discountAmount) : 0;
  const effectivePaid = originalAmount + interestAmount - discountAmount;
  
  // D - Fornecedores (valor original)
  entries.push({
    accountCode: ACCOUNTING_CODES.FORNECEDORES,
    amount: originalAmount.toFixed(2),
    type: "D",
    description: `Pgto fornecedor ${data.supplierName} - NF ${data.docNumber || data.purchaseOrderId}`,
  });
  
  // D - Juros Pagos (se houver)
  if (interestAmount > 0) {
    entries.push({
      accountCode: ACCOUNTING_CODES.JUROS_PAGOS,
      amount: interestAmount.toFixed(2),
      type: "D",
      description: `Juros pgto NF ${data.docNumber || data.purchaseOrderId}`,
    });
  }
  
  // C - Caixa/Banco (valor efetivamente pago)
  entries.push({
    accountCode: ACCOUNTING_CODES.CAIXA_GERAL,
    amount: effectivePaid.toFixed(2),
    type: "C",
    description: `Pgto NF ${data.docNumber || data.purchaseOrderId} - ${data.supplierName}`,
  });
  
  // C - Descontos Obtidos (se houver)
  if (discountAmount > 0) {
    entries.push({
      accountCode: ACCOUNTING_CODES.DESCONTOS_OBTIDOS,
      amount: discountAmount.toFixed(2),
      type: "C",
      description: `Desconto pgto NF ${data.docNumber || data.purchaseOrderId}`,
    });
  }
  
  return createAccountingEntries({
    competenceMonth,
    entryDate: data.entryDate,
    description: `Pgto Compra NF ${data.docNumber || data.purchaseOrderId} - ${data.supplierName}`,
    sourceType: "purchase_payment",
    sourceId: data.installmentId,
    entries,
    createdBy: data.createdBy,
  });
}

/**
 * Contabilizar despesa criada
 * D - Conta Gerencial (via amarração)
 * C - Contas a Pagar
 */
export async function accountExpenseCreation(data: {
  expenseId: number;
  amount: string;
  managementAccountId: number;
  supplierName?: string;
  description: string;
  entryDate: Date;
  createdBy: string;
}): Promise<{ success: boolean; journalId?: number; error?: string }> {
  const competenceMonth = getCompetenceMonthBrazil(data.entryDate);
  
  // Buscar código contábil da conta gerencial
  const accountingCode = await getAccountingCodeByManagementAccount(data.managementAccountId);
  if (!accountingCode) {
    return { success: false, error: "Conta gerencial sem amarração contábil" };
  }
  
  return createAccountingEntries({
    competenceMonth,
    entryDate: data.entryDate,
    description: `Despesa: ${data.description}`,
    sourceType: "expense",
    sourceId: data.expenseId,
    entries: [
      {
        accountCode: accountingCode,
        amount: data.amount,
        type: "D",
        description: `Despesa: ${data.description}`,
      },
      {
        accountCode: ACCOUNTING_CODES.CAIXA_GERAL,
        amount: data.amount,
        type: "C",
        description: `Pgto despesa: ${data.description}`,
      },
    ],
    createdBy: data.createdBy,
  });
}

/**
 * Contabilizar pagamento de despesa
 * D - Contas a Pagar (valor original)
 * D - Juros Pagos (se houver juros)
 * C - Caixa/Banco (valor total pago)
 * C - Descontos Obtidos (se houver desconto)
 */
export async function accountExpensePayment(data: {
  expenseId: number;
  installmentId: number;
  originalAmount: string;
  paidAmount: string;
  interestAmount?: string;
  discountAmount?: string;
  description: string;
  entryDate: Date;
  createdBy: string;
}): Promise<{ success: boolean; journalId?: number; error?: string }> {
  const competenceMonth = getCompetenceMonthBrazil(data.entryDate);
  const entries: AccountingLedgerEntry[] = [];
  
  const originalAmount = parseFloat(data.originalAmount);
  const interestAmount = data.interestAmount ? parseFloat(data.interestAmount) : 0;
  const discountAmount = data.discountAmount ? parseFloat(data.discountAmount) : 0;
  const effectivePaid = originalAmount + interestAmount - discountAmount;
  
  // D - Contas a Pagar (valor original)
  entries.push({
    accountCode: ACCOUNTING_CODES.CONTAS_A_PAGAR,
    amount: originalAmount.toFixed(2),
    type: "D",
    description: `Pgto despesa: ${data.description}`,
  });
  
  // D - Juros Pagos (se houver)
  if (interestAmount > 0) {
    entries.push({
      accountCode: ACCOUNTING_CODES.JUROS_PAGOS,
      amount: interestAmount.toFixed(2),
      type: "D",
      description: `Juros pgto despesa: ${data.description}`,
    });
  }
  
  // C - Caixa/Banco (valor efetivamente pago)
  entries.push({
    accountCode: ACCOUNTING_CODES.CAIXA_GERAL,
    amount: effectivePaid.toFixed(2),
    type: "C",
    description: `Pgto despesa: ${data.description}`,
  });
  
  // C - Descontos Obtidos (se houver)
  if (discountAmount > 0) {
    entries.push({
      accountCode: ACCOUNTING_CODES.DESCONTOS_OBTIDOS,
      amount: discountAmount.toFixed(2),
      type: "C",
      description: `Desconto pgto despesa: ${data.description}`,
    });
  }
  
  return createAccountingEntries({
    competenceMonth,
    entryDate: data.entryDate,
    description: `Pgto Despesa: ${data.description}`,
    sourceType: "expense_payment",
    sourceId: data.installmentId,
    entries,
    createdBy: data.createdBy,
  });
}

/**
 * Verificar se uma transação já foi contabilizada
 */
export async function isTransactionAccounted(sourceType: string, sourceId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select({ id: journalSources.id })
    .from(journalSources)
    .where(and(
      eq(journalSources.sourceType, sourceType),
      eq(journalSources.sourceId, sourceId)
    ))
    .limit(1);
  
  return result.length > 0;
}


/**
 * Contabilizar venda realizada
 * Dependendo do canal:
 * - Balcão/Delivery: D-Caixa / C-Receita de Vendas
 * - A Prazo: D-Clientes / C-Receita de Vendas
 * Sempre: D-CMV / C-Estoque
 */
export async function accountSale(data: {
  saleId: number;
  totalAmount: string;
  cmvAmount: string;
  channelType: "BALCAO" | "DELIVERY" | "A_PRAZO";
  customerName?: string;
  entryDate: Date;
  createdBy: string;
}): Promise<{ success: boolean; journalId?: number; error?: string }> {
  const competenceMonth = getCompetenceMonthBrazil(data.entryDate);
  const entries: AccountingLedgerEntry[] = [];
  
  // Determinar contas baseado no tipo de canal
  let debitAccount: string;
  let creditAccount: string;
  
  switch (data.channelType) {
    case "BALCAO":
      debitAccount = ACCOUNTING_CODES.CAIXA_GERAL;
      creditAccount = ACCOUNTING_CODES.RECEITA_VENDAS_BALCAO;
      break;
    case "DELIVERY":
      debitAccount = ACCOUNTING_CODES.CAIXA_GERAL;
      creditAccount = ACCOUNTING_CODES.RECEITA_VENDAS_DELIVERY;
      break;
    case "A_PRAZO":
      debitAccount = ACCOUNTING_CODES.CLIENTES_A_PRAZO;
      creditAccount = ACCOUNTING_CODES.RECEITA_VENDAS_A_PRAZO;
      break;
    default:
      debitAccount = ACCOUNTING_CODES.CAIXA_GERAL;
      creditAccount = ACCOUNTING_CODES.RECEITA_VENDAS_BALCAO;
  }
  
  // Lançamento da receita
  // D - Caixa ou Clientes
  entries.push({
    accountCode: debitAccount,
    amount: data.totalAmount,
    type: "D",
    description: `Venda #${data.saleId}${data.customerName ? ` - ${data.customerName}` : ""}`,
  });
  
  // C - Receita de Vendas
  entries.push({
    accountCode: creditAccount,
    amount: data.totalAmount,
    type: "C",
    description: `Receita venda #${data.saleId}`,
  });
  
  // Lançamento do CMV (se houver)
  const cmv = parseFloat(data.cmvAmount);
  if (cmv > 0) {
    // D - CMV
    entries.push({
      accountCode: ACCOUNTING_CODES.CMV,
      amount: data.cmvAmount,
      type: "D",
      description: `CMV venda #${data.saleId}`,
    });
    
    // C - Estoque
    entries.push({
      accountCode: ACCOUNTING_CODES.ESTOQUE_MERCADORIAS,
      amount: data.cmvAmount,
      type: "C",
      description: `Baixa estoque venda #${data.saleId}`,
    });
  }
  
  return createAccountingEntries({
    competenceMonth,
    entryDate: data.entryDate,
    description: `Venda #${data.saleId}${data.customerName ? ` - ${data.customerName}` : ""}`,
    sourceType: "sale",
    sourceId: data.saleId,
    entries,
    createdBy: data.createdBy,
  });
}

/**
 * Contabilizar recebimento de cliente (Contas a Receber)
 * D - Caixa/Banco
 * C - Clientes
 * D - Descontos Concedidos (se houver)
 * C - Juros Recebidos (se houver)
 */
export async function accountCustomerPayment(data: {
  paymentId: number;
  customerId: number;
  customerName: string;
  amount: string;
  interestAmount?: string;
  discountAmount?: string;
  entryDate: Date;
  createdBy: string;
}): Promise<{ success: boolean; journalId?: number; error?: string }> {
  const competenceMonth = getCompetenceMonthBrazil(data.entryDate);
  const entries: AccountingLedgerEntry[] = [];
  
  const amount = parseFloat(data.amount);
  const interestAmount = data.interestAmount ? parseFloat(data.interestAmount) : 0;
  const discountAmount = data.discountAmount ? parseFloat(data.discountAmount) : 0;
  
  // Valor que entra no caixa = valor recebido + juros
  const cashReceived = amount + interestAmount;
  
  // D - Caixa (valor efetivamente recebido)
  entries.push({
    accountCode: ACCOUNTING_CODES.CAIXA_GERAL,
    amount: cashReceived.toFixed(2),
    type: "D",
    description: `Recebimento ${data.customerName}`,
  });
  
  // C - Clientes (valor original + desconto concedido)
  const clienteCredit = amount + discountAmount;
  entries.push({
    accountCode: ACCOUNTING_CODES.CLIENTES_A_PRAZO,
    amount: clienteCredit.toFixed(2),
    type: "C",
    description: `Baixa débito ${data.customerName}`,
  });
  
  // D - Descontos Concedidos (se houver)
  if (discountAmount > 0) {
    entries.push({
      accountCode: ACCOUNTING_CODES.DESCONTOS_CONCEDIDOS,
      amount: discountAmount.toFixed(2),
      type: "D",
      description: `Desconto concedido ${data.customerName}`,
    });
  }
  
  // C - Juros Recebidos (se houver)
  if (interestAmount > 0) {
    entries.push({
      accountCode: "4.3.1.01", // Juros Recebidos
      amount: interestAmount.toFixed(2),
      type: "C",
      description: `Juros recebidos ${data.customerName}`,
    });
  }
  
  return createAccountingEntries({
    competenceMonth,
    entryDate: data.entryDate,
    description: `Recebimento cliente ${data.customerName}`,
    sourceType: "customer_payment",
    sourceId: data.paymentId,
    entries,
    createdBy: data.createdBy,
  });
}


// =====================================================
// GOVERNANÇA CONTÁBIL
// =====================================================

// Buscar configurações de governança
export async function getGovernanceSettings(companyId: number = 1): Promise<GovernanceSettings | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(governanceSettings)
    .where(eq(governanceSettings.companyId, companyId))
    .limit(1);
  
  return result[0] || null;
}

// Atualizar configurações de governança
export async function updateGovernanceSettings(
  companyId: number,
  settings: Partial<InsertGovernanceSettings>,
  userId: string,
  userName?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar configurações atuais para log
  const current = await getGovernanceSettings(companyId);
  
  // Atualizar
  await db.update(governanceSettings)
    .set({
      ...settings,
      updatedBy: userId,
    })
    .where(eq(governanceSettings.companyId, companyId));
  
  // Registrar no log de auditoria
  await db.insert(governanceAuditLog).values({
    companyId,
    action: "SETTINGS_CHANGED",
    previousValue: current ? JSON.stringify(current) : null,
    newValue: JSON.stringify(settings),
    userId,
    userName,
  });
}

// Buscar período contábil
export async function getAccountingPeriod(companyId: number, competenceMonth: string): Promise<AccountingPeriod | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(accountingPeriods)
    .where(and(
      eq(accountingPeriods.companyId, companyId),
      eq(accountingPeriods.competenceMonth, competenceMonth)
    ))
    .limit(1);
  
  return result[0] || null;
}

// Listar períodos contábeis
export async function listAccountingPeriods(companyId: number = 1): Promise<AccountingPeriod[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(accountingPeriods)
    .where(eq(accountingPeriods.companyId, companyId))
    .orderBy(desc(accountingPeriods.competenceMonth));
}

// Criar período contábil se não existir
export async function ensureAccountingPeriod(companyId: number, competenceMonth: string): Promise<AccountingPeriod> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let period = await getAccountingPeriod(companyId, competenceMonth);
  
  if (!period) {
    await db.insert(accountingPeriods).values({
      companyId,
      competenceMonth,
      status: "OPEN",
    });
    period = await getAccountingPeriod(companyId, competenceMonth);
  }
  
  return period!;
}

// Fechar período contábil
export async function closeAccountingPeriod(
  companyId: number,
  competenceMonth: string,
  userId: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const period = await getAccountingPeriod(companyId, competenceMonth);
  
  if (!period) {
    return { success: false, error: "Período não encontrado" };
  }
  
  if (period.status === "CLOSED") {
    return { success: false, error: "Período já está fechado" };
  }
  
  // Fechar período
  await db.update(accountingPeriods)
    .set({
      status: "CLOSED",
      closedAt: new Date(),
      closedBy: userId,
    })
    .where(eq(accountingPeriods.id, period.id));
  
  // Registrar no log
  await db.insert(governanceAuditLog).values({
    companyId,
    action: "PERIOD_CLOSED",
    entityType: "period",
    entityId: period.id,
    previousValue: JSON.stringify({ status: period.status }),
    newValue: JSON.stringify({ status: "CLOSED" }),
    userId,
    userName,
  });
  
  return { success: true };
}

// Reabrir período contábil
export async function reopenAccountingPeriod(
  companyId: number,
  competenceMonth: string,
  reason: string,
  userId: string,
  userName?: string
): Promise<{ success: boolean; error?: string; expiresAt?: Date }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar configurações
  const settings = await getGovernanceSettings(companyId);
  if (!settings) {
    return { success: false, error: "Configurações de governança não encontradas" };
  }
  
  const period = await getAccountingPeriod(companyId, competenceMonth);
  
  if (!period) {
    return { success: false, error: "Período não encontrado" };
  }
  
  if (period.status === "OPEN") {
    return { success: false, error: "Período já está aberto" };
  }
  
  // Verificar limite de reaberturas
  if (period.reopenCount >= settings.maxReopenCount) {
    return { success: false, error: `Limite de ${settings.maxReopenCount} reaberturas atingido para este período` };
  }
  
  // Verificar prazo máximo após fechamento
  if (period.closedAt) {
    const daysSinceClosed = Math.floor((Date.now() - period.closedAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceClosed > settings.maxReopenDaysAfterClose) {
      return { success: false, error: `Prazo máximo de ${settings.maxReopenDaysAfterClose} dias após fechamento excedido` };
    }
  }
  
  // Calcular data de expiração
  const expiresAt = new Date(Date.now() + settings.reopenWindowHours * 60 * 60 * 1000);
  
  // Reabrir período
  await db.update(accountingPeriods)
    .set({
      status: "REOPENED",
      reopenedAt: new Date(),
      reopenedBy: userId,
      reopenReason: reason,
      reopenCount: period.reopenCount + 1,
      reopenExpiresAt: expiresAt,
    })
    .where(eq(accountingPeriods.id, period.id));
  
  // Registrar no log
  await db.insert(governanceAuditLog).values({
    companyId,
    action: "PERIOD_REOPENED",
    entityType: "period",
    entityId: period.id,
    previousValue: JSON.stringify({ status: period.status }),
    newValue: JSON.stringify({ status: "REOPENED", reason, expiresAt }),
    reason,
    userId,
    userName,
  });
  
  return { success: true, expiresAt };
}

// Verificar se período permite edição
export async function isPeriodEditable(companyId: number, competenceMonth: string): Promise<{ editable: boolean; reason?: string }> {
  const period = await getAccountingPeriod(companyId, competenceMonth);
  
  if (!period) {
    // Período não existe, está aberto por padrão
    return { editable: true };
  }
  
  if (period.status === "OPEN") {
    return { editable: true };
  }
  
  if (period.status === "REOPENED") {
    // Verificar se ainda está dentro da janela de reabertura
    if (period.reopenExpiresAt && new Date() < period.reopenExpiresAt) {
      return { editable: true };
    }
    return { editable: false, reason: "Janela de reabertura expirada" };
  }
  
  return { editable: false, reason: "Período fechado" };
}

// Verificar se entidade pode ser editada (compra, despesa, venda)
export async function canEditEntity(
  entityType: "sale" | "expense" | "purchase",
  entityId: number,
  companyId: number = 1
): Promise<{ canEdit: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) return { canEdit: false, reason: "Database not available" };
  
  const settings = await getGovernanceSettings(companyId);
  if (!settings) {
    return { canEdit: false, reason: "Configurações de governança não encontradas" };
  }
  
  // Buscar entidade
  let entity: any = null;
  let createdAt: Date | null = null;
  let competenceMonth: string | null = null;
  
  if (entityType === "sale") {
    const result = await db.select().from(sales).where(eq(sales.id, entityId)).limit(1);
    entity = result[0];
    createdAt = entity?.createdAt;
    // Vendas usam saleDate para competência
    if (entity?.saleDate) {
      const d = new Date(entity.saleDate);
      competenceMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  } else if (entityType === "expense") {
    const result = await db.select().from(expenses).where(eq(expenses.id, entityId)).limit(1);
    entity = result[0];
    createdAt = entity?.entryDate || entity?.createdAt;
    competenceMonth = entity?.competenceMonth;
  } else if (entityType === "purchase") {
    const result = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, entityId)).limit(1);
    entity = result[0];
    createdAt = entity?.createdAt;
    if (entity?.postingDate) {
      const d = new Date(entity.postingDate);
      competenceMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }
  
  if (!entity) {
    return { canEdit: false, reason: "Entidade não encontrada" };
  }
  
  // Verificar se competência está fechada
  if (competenceMonth) {
    const periodCheck = await isPeriodEditable(companyId, competenceMonth);
    if (!periodCheck.editable) {
      return { canEdit: false, reason: `Competência ${competenceMonth} ${periodCheck.reason}` };
    }
  }
  
  // Verificar se já foi contabilizado (journal POSTED)
  const journalSource = await db.select()
    .from(journalSources)
    .where(and(
      eq(journalSources.sourceType, entityType),
      eq(journalSources.sourceId, entityId)
    ))
    .limit(1);
  
  if (journalSource[0]) {
    const journal = await db.select()
      .from(journals)
      .where(eq(journals.id, journalSource[0].journalId))
      .limit(1);
    
    if (journal[0]?.status === "POSTED") {
      return { canEdit: false, reason: "Registro já contabilizado (journal POSTED)" };
    }
  }
  
  // Verificar janela de edição
  if (createdAt) {
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    
    if (entityType === "sale") {
      const windowMs = settings.salesEditWindowHours * 60 * 60 * 1000;
      if (diffMs > windowMs) {
        return { canEdit: false, reason: `Prazo de ${settings.salesEditWindowHours}h para edição expirado` };
      }
    } else if (entityType === "expense") {
      const windowMs = settings.expensesEditWindowDays * 24 * 60 * 60 * 1000;
      if (diffMs > windowMs) {
        return { canEdit: false, reason: `Prazo de ${settings.expensesEditWindowDays} dias para edição expirado` };
      }
    } else if (entityType === "purchase") {
      const windowMs = settings.purchasesEditWindowDays * 24 * 60 * 60 * 1000;
      if (diffMs > windowMs) {
        return { canEdit: false, reason: `Prazo de ${settings.purchasesEditWindowDays} dias para edição expirado` };
      }
    }
  }
  
  return { canEdit: true };
}

// Registrar bloqueio de edição no log
export async function logEditBlocked(
  companyId: number,
  entityType: string,
  entityId: number,
  reason: string,
  userId: string,
  userName?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(governanceAuditLog).values({
    companyId,
    action: "EDIT_BLOCKED",
    entityType,
    entityId,
    reason,
    userId,
    userName,
  });
}

// Fechar períodos reabertos expirados (executar periodicamente)
export async function closeExpiredReopenedPeriods(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const now = new Date();
  
  // Buscar períodos reabertos com janela expirada
  const expiredPeriods = await db.select()
    .from(accountingPeriods)
    .where(and(
      eq(accountingPeriods.status, "REOPENED"),
      lt(accountingPeriods.reopenExpiresAt, now)
    ));
  
  for (const period of expiredPeriods) {
    await db.update(accountingPeriods)
      .set({
        status: "CLOSED",
        closedAt: now,
        closedBy: "SYSTEM",
      })
      .where(eq(accountingPeriods.id, period.id));
    
    await db.insert(governanceAuditLog).values({
      companyId: period.companyId,
      action: "PERIOD_AUTO_CLOSED",
      entityType: "period",
      entityId: period.id,
      previousValue: JSON.stringify({ status: "REOPENED" }),
      newValue: JSON.stringify({ status: "CLOSED", reason: "Janela de reabertura expirada" }),
      reason: "Fechamento automático - janela de reabertura expirada",
      userId: "SYSTEM",
    });
  }
  
  return expiredPeriods.length;
}

// Registrar execução de contabilização em lote
export async function logAccountingBatch(data: InsertAccountingBatchLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(accountingBatchLog).values(data);
  return Number(result[0].insertId);
}

// Atualizar log de contabilização em lote
export async function updateAccountingBatchLog(
  id: number,
  data: Partial<InsertAccountingBatchLog>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(accountingBatchLog)
    .set(data)
    .where(eq(accountingBatchLog.id, id));
}

// Buscar último batch de contabilização
export async function getLastAccountingBatch(companyId: number = 1): Promise<AccountingBatchLog | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(accountingBatchLog)
    .where(eq(accountingBatchLog.companyId, companyId))
    .orderBy(desc(accountingBatchLog.startedAt))
    .limit(1);
  
  return result[0] || null;
}

// Buscar histórico de batches de contabilização
export async function getAccountingBatchHistory(
  companyId: number = 1,
  limit: number = 20
): Promise<AccountingBatchLog[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(accountingBatchLog)
    .where(eq(accountingBatchLog.companyId, companyId))
    .orderBy(desc(accountingBatchLog.startedAt))
    .limit(limit);
}

// Buscar log de auditoria de governança
export async function getGovernanceAuditHistory(
  companyId: number = 1,
  filters?: {
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
  },
  limit: number = 100
): Promise<GovernanceAuditLog[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [eq(governanceAuditLog.companyId, companyId)];
  
  if (filters?.action) {
    conditions.push(eq(governanceAuditLog.action, filters.action as any));
  }
  if (filters?.entityType) {
    conditions.push(eq(governanceAuditLog.entityType, filters.entityType));
  }
  if (filters?.startDate) {
    conditions.push(gte(governanceAuditLog.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(governanceAuditLog.createdAt, filters.endDate));
  }
  
  return db.select()
    .from(governanceAuditLog)
    .where(and(...conditions))
    .orderBy(desc(governanceAuditLog.createdAt))
    .limit(limit);
}


/**
 * Trocar cliente em uma venda a prazo
 * Regras de governança:
 * - Venda não contabilizada: permitir troca com log
 * - Venda contabilizada (journal POSTED): bloquear
 * - Competência fechada: bloquear em qualquer cenário
 */
export async function changeSaleCustomer(
  saleId: number,
  newCustomerId: number,
  reason: string,
  userId: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  // Buscar venda
  const sale = await getSale(saleId);
  if (!sale) {
    return { success: false, error: "Venda não encontrada" };
  }

  // Verificar se é venda a prazo
  if (sale.saleType !== "A_PRAZO") {
    return { success: false, error: "Apenas vendas a prazo podem ter o cliente alterado" };
  }

  // Verificar se já tem cliente
  const oldCustomerId = sale.customerId;
  if (!oldCustomerId) {
    return { success: false, error: "Venda não possui cliente associado" };
  }

  // Verificar se o novo cliente é diferente
  if (oldCustomerId === newCustomerId) {
    return { success: false, error: "O novo cliente é o mesmo da venda atual" };
  }

  // Buscar novo cliente para validar
  const newCustomer = await getPartner(newCustomerId);
  if (!newCustomer) {
    return { success: false, error: "Novo cliente não encontrado" };
  }
  if (newCustomer.partnerType !== "CUSTOMER" && newCustomer.partnerType !== "BOTH") {
    return { success: false, error: "O parceiro selecionado não é um cliente" };
  }

  // Verificar governança
  const canEditResult = await canEditEntity("sale", saleId, 1);
  if (!canEditResult.canEdit) {
    // Registrar tentativa bloqueada
    await logEditBlocked(1, "sale_customer_change", saleId, canEditResult.reason || "Bloqueado", userId, userName);
    return { success: false, error: canEditResult.reason };
  }

  // Buscar cliente antigo para log
  const oldCustomer = await getPartner(oldCustomerId);

  // Atualizar venda
  await db.update(sales)
    .set({ customerId: newCustomerId })
    .where(eq(sales.id, saleId));

  // Atualizar recebível associado
  const receivable = await getReceivableBySaleId(saleId);
  if (receivable) {
    await db.update(receivables)
      .set({ customerId: newCustomerId })
      .where(eq(receivables.id, receivable.id));
  }

  // Registrar no log de auditoria
  await db.insert(governanceAuditLog).values({
    companyId: 1,
    action: "CUSTOMER_CHANGED",
    entityType: "sale",
    entityId: saleId,
    reason,
    details: JSON.stringify({
      oldCustomerId,
      oldCustomerName: oldCustomer?.name,
      newCustomerId,
      newCustomerName: newCustomer.name,
      saleAmount: sale.finalAmount,
    }),
    userId,
    userName,
  });

  return { success: true };
}

/**
 * Buscar histórico de alterações de cliente em vendas
 */
export async function getSaleCustomerChangeHistory(saleId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(governanceAuditLog)
    .where(
      and(
        eq(governanceAuditLog.entityType, "sale"),
        eq(governanceAuditLog.entityId, saleId),
        eq(governanceAuditLog.action, "CUSTOMER_CHANGED")
      )
    )
    .orderBy(desc(governanceAuditLog.createdAt));
}


/**
 * Contabilizar Outra Receita
 * D - Caixa/Banco (se recebido) ou Contas a Receber (se a prazo)
 * C - Conta Gerencial de Receita (via amarração contábil)
 */
export async function accountOtherRevenue(data: {
  otherRevenueId: number;
  amount: string;
  managementAccountId: number;
  description: string;
  entryDate: Date;
  isPaid: boolean;
  createdBy: string;
}): Promise<{ success: boolean; journalId?: number; error?: string }> {
  const competenceMonth = getCompetenceMonthBrazil(data.entryDate);
  
  // Buscar código contábil da conta gerencial de receita
  const accountingCode = await getAccountingCodeByManagementAccount(data.managementAccountId);
  if (!accountingCode) {
    return { success: false, error: "Conta gerencial sem amarração contábil" };
  }
  
  // Débito: Caixa (se recebido) ou poderia ser Contas a Receber (futuro)
  const debitAccount = data.isPaid ? ACCOUNTING_CODES.CAIXA_GERAL : ACCOUNTING_CODES.CAIXA_GERAL;
  
  return createAccountingEntries({
    competenceMonth,
    entryDate: data.entryDate,
    description: `Outra Receita: ${data.description}`,
    sourceType: "other_revenue",
    sourceId: data.otherRevenueId,
    entries: [
      {
        accountCode: debitAccount,
        amount: data.amount,
        type: "D",
        description: `Receita: ${data.description}`,
      },
      {
        accountCode: accountingCode,
        amount: data.amount,
        type: "C",
        description: `Receita: ${data.description}`,
      },
    ],
    createdBy: data.createdBy,
  });
}

// ============================================================
// CONTAS A PAGAR
// ============================================================

/**
 * Criar registro no Contas a Pagar vinculado a uma despesa
 */
export async function createAccountPayable(data: InsertAccountPayable) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(accountsPayable).values(data);
  return Number((result as any).insertId);
}

/**
 * Buscar registros do Contas a Pagar por expenseId
 */
export async function getAccountsPayableByExpenseId(expenseId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(accountsPayable).where(eq(accountsPayable.expenseId, expenseId));
}

/**
 * Deletar TODOS os journals de uma despesa (usado ao editar despesa)
 * IMPORTANTE: Deleta todos os journals, não apenas o primeiro
 */
export async function deleteExpenseJournal(expenseId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar TODOS os journal sources da despesa (sem LIMIT)
  const journalSources_list = await db.select()
    .from(journalSources)
    .where(and(
      eq(journalSources.sourceType, 'expense'),
      eq(journalSources.sourceId, expenseId)
    ));
  
  if (journalSources_list.length === 0) {
    console.log(`[deleteExpenseJournal] Nenhum journal encontrado para despesa #${expenseId}`);
    return;
  }
  
  console.log(`[deleteExpenseJournal] Encontrados ${journalSources_list.length} journal(s) para despesa #${expenseId}`);
  
  // Deletar cada journal encontrado
  for (const source of journalSources_list) {
    const journalId = source.journalId;
    
    // Deletar lançamentos contábeis do journal
    await db.delete(accountingEntries)
      .where(eq(accountingEntries.journalId, journalId));
    
    // Deletar journal source
    await db.delete(journalSources)
      .where(eq(journalSources.id, source.id));
    
    // Deletar journal
    await db.delete(journals)
      .where(eq(journals.id, journalId));
    
    console.log(`[deleteExpenseJournal] Journal #${journalId} deletado`);
  }
  
  console.log(`[deleteExpenseJournal] Total: ${journalSources_list.length} journal(s) deletado(s) para despesa #${expenseId}`);
}

/**
 * Reprocessar contabilização de uma venda (wrapper que busca dados e chama accountSale)
 * Usado para reprocessamento em lote de vendas
 */
export async function reprocessSaleAccounting(saleId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Buscar venda completa
    const sale = await getSale(saleId);
    if (!sale) {
      return { success: false, error: `Venda #${saleId} não encontrada` };
    }
    
    // Buscar itens da venda para calcular CMV
    const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
    
    // Calcular CMV total
    let cmvTotal = 0;
    for (const item of items) {
      const product = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (product.length > 0) {
        const avgCost = parseFloat(product[0].avgCost || "0");
        cmvTotal += avgCost * parseFloat(item.quantity);
      }
    }
    
    // Chamar accountSale com todos os parâmetros
    return await accountSale({
      saleId: sale.id,
      totalAmount: sale.finalAmount,
      cmvAmount: cmvTotal.toFixed(2),
      channelType: sale.saleType,
      customerName: sale.customerName || undefined,
      entryDate: new Date(sale.saleDate),
      createdBy: sale.createdBy
    });
  } catch (error) {
    console.error(`[reprocessSaleAccounting] Erro ao reprocessar venda #${saleId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Reprocessar contabilização de uma compra (wrapper)
 */
export async function reprocessPurchaseAccounting(purchaseId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Buscar compra completa
    const purchase = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, purchaseId)).limit(1);
    if (purchase.length === 0) {
      return { success: false, error: `Compra #${purchaseId} não encontrada` };
    }
    
    const po = purchase[0];
    
    // Chamar accountPurchaseConfirmation com todos os parâmetros
    return await accountPurchaseConfirmation({
      purchaseOrderId: po.id,
      supplierId: po.supplierId,
      supplierName: "", // Buscar do banco se necessário
      totalAmount: po.totalAmount,
      entryDate: po.confirmedAt!,
      createdBy: po.createdBy
    });
  } catch (error) {
    console.error(`[reprocessPurchaseAccounting] Erro ao reprocessar compra #${purchaseId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Reprocessar contabilização de uma despesa (wrapper)
 */
export async function reprocessExpenseAccounting(expenseId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Buscar despesa completa
    const expense = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
    if (expense.length === 0) {
      return { success: false, error: `Despesa #${expenseId} não encontrada` };
    }
    
    const exp = expense[0];
    
    // Chamar accountExpenseCreation com todos os parâmetros
    return await accountExpenseCreation({
      expenseId: exp.id,
      managementAccountId: exp.managementAccountId!,
      amount: exp.amount,
      description: exp.description,
      entryDate: exp.entryDate || exp.issueDate || new Date(),
      createdBy: exp.createdBy
    });
  } catch (error) {
    console.error(`[reprocessExpenseAccounting] Erro ao reprocessar despesa #${expenseId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}


/**
 * Deletar compra completamente (PERIGOSO - usar apenas para correções)
 * Deleta journals, parcelas, itens e a compra
 * Reverte estoque
 */
export async function deletePurchaseCompletely(purchaseOrderId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    console.log(`[deletePurchaseCompletely] Iniciando exclusão da compra #${purchaseOrderId}...`);
    
    // 1. Buscar compra
    const po = await getPurchaseOrderById(purchaseOrderId);
    if (!po) {
      return { success: false, error: "Compra não encontrada" };
    }
    
    // 2. Deletar journals contábeis (confirmação + pagamentos)
    console.log(`[deletePurchaseCompletely] Deletando journals...`);
    
    // Journal de confirmação
    const confirmationJournals = await db.select()
      .from(journalSources)
      .where(and(
        eq(journalSources.sourceType, 'purchase'),
        eq(journalSources.sourceId, purchaseOrderId)
      ));
    
    for (const js of confirmationJournals) {
      await db.delete(accountingEntries).where(eq(accountingEntries.journalId, js.journalId));
      await db.delete(journalSources).where(eq(journalSources.id, js.id));
      await db.delete(journals).where(eq(journals.id, js.journalId));
      console.log(`[deletePurchaseCompletely] Journal #${js.journalId} deletado`);
    }
    
    // Journals de pagamentos
    const installments = await getPurchaseInstallments(purchaseOrderId);
    for (const inst of installments) {
      const paymentJournals = await db.select()
        .from(journalSources)
        .where(and(
          eq(journalSources.sourceType, 'purchase_payment'),
          eq(journalSources.sourceId, inst.id)
        ));
      
      for (const js of paymentJournals) {
        await db.delete(accountingEntries).where(eq(accountingEntries.journalId, js.journalId));
        await db.delete(journalSources).where(eq(journalSources.id, js.id));
        await db.delete(journals).where(eq(journals.id, js.journalId));
        console.log(`[deletePurchaseCompletely] Journal de pagamento #${js.journalId} deletado`);
      }
    }
    
    // 3. Deletar parcelas do Contas a Pagar
    console.log(`[deletePurchaseCompletely] Deletando parcelas do Contas a Pagar...`);
    await db.delete(accountsPayable).where(eq(accountsPayable.purchaseOrderId, purchaseOrderId));
    
    // 4. Deletar parcelas
    console.log(`[deletePurchaseCompletely] Deletando parcelas...`);
    await db.delete(purchaseInstallments).where(eq(purchaseInstallments.purchaseOrderId, purchaseOrderId));
    
    // 5. Reverter estoque
    console.log(`[deletePurchaseCompletely] Revertendo estoque...`);
    const items = await getPurchaseOrderItems(purchaseOrderId);
    for (const item of items) {
      const product = await db.select().from(products).where(eq(products.id, item.productId || 0)).limit(1);
      if (product.length === 0) continue;
      const prod = product[0];
      
      const currentStock = parseFloat(prod.currentStock?.toString() || "0");
      const quantityPurchased = parseFloat(item.quantity.toString());
      const newStock = currentStock - quantityPurchased;
      
      await updateProduct(prod.id, { currentStock: newStock.toString() });
      console.log(`[deletePurchaseCompletely] Estoque do produto #${prod.id} revertido: ${currentStock} → ${newStock}`);
    }
    
    // 6. Deletar itens
    console.log(`[deletePurchaseCompletely] Deletando itens...`);
    await deletePurchaseOrderItems(purchaseOrderId);
    
    // 7. Deletar compra
    console.log(`[deletePurchaseCompletely] Deletando compra...`);
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, purchaseOrderId));
    
    console.log(`[deletePurchaseCompletely] Compra #${purchaseOrderId} deletada com sucesso!`);
    return { success: true };
  } catch (error) {
    console.error(`[deletePurchaseCompletely] Erro ao deletar compra #${purchaseOrderId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
