import {
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  int,
  decimal,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ==================== MULTIEMPRESA ====================

// Empresas
export const companies = mysqlTable("companies", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 200 }).notNull(),
  tradeName: varchar("tradeName", { length: 200 }),
  docNumber: varchar("docNumber", { length: 20 }),
  stateRegistration: varchar("stateRegistration", { length: 30 }),
  segment: varchar("segment", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  logoUrl: text("logoUrl"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// Filiais
export const branches = mysqlTable("branches", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  street: varchar("street", { length: 255 }),
  streetNumber: varchar("streetNumber", { length: 20 }),
  complement: varchar("complement", { length: 100 }),
  neighborhood: varchar("neighborhood", { length: 100 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  companyIdx: index("branch_company_idx").on(table.companyId),
}));

export type Branch = typeof branches.$inferSelect;
export type InsertBranch = typeof branches.$inferInsert;

// Relação Usuário ↔ Empresa/Filial
export const userCompanies = mysqlTable("userCompanies", {
  id: int("id").primaryKey().autoincrement(),
  userId: varchar("userId", { length: 64 }).notNull(),
  companyId: int("companyId").notNull(),
  branchId: int("branchId"),
  role: mysqlEnum("role", ["admin", "operacional", "consultor", "garcom"]).default("operacional").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  userIdx: index("uc_user_idx").on(table.userId),
  companyIdx: index("uc_company_idx").on(table.companyId),
  userCompanyIdx: uniqueIndex("uc_user_company_idx").on(table.userId, table.companyId, table.branchId),
}));

export type UserCompany = typeof userCompanies.$inferSelect;
export type InsertUserCompany = typeof userCompanies.$inferInsert;

// ==================== USUÁRIOS ====================

// Usuários do sistema
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  avatarUrl: text("avatarUrl"),
  role: mysqlEnum("role", ["user", "admin", "operacional", "consultor", "garcom"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Categorias de produtos
export const categories = mysqlTable("categories", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  name: varchar("name", { length: 100 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  companyBranchIdx: index("cat_company_branch_idx").on(table.companyId, table.branchId),
}));

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// Subcategorias
export const subcategories = mysqlTable("subcategories", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  name: varchar("name", { length: 100 }).notNull(),
  categoryId: int("categoryId").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  companyBranchIdx: index("subcat_company_branch_idx").on(table.companyId, table.branchId),
}));

export type Subcategory = typeof subcategories.$inferSelect;
export type InsertSubcategory = typeof subcategories.$inferInsert;

// Canais de venda
export const salesChannels = mysqlTable("salesChannels", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["BALCAO", "DELIVERY", "SALAO"]).notNull(),
  active: boolean("active").default(true).notNull(),
  commissionPercent: decimal("commissionPercent", { precision: 5, scale: 2 }).default("0.00"),
  fixedFeePerOrder: decimal("fixedFeePerOrder", { precision: 10, scale: 2 }).default("0.00"),
  paymentDays: int("paymentDays").default(0),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  companyBranchIdx: index("sc_company_branch_idx").on(table.companyId, table.branchId),
}));

export type SalesChannel = typeof salesChannels.$inferSelect;
export type InsertSalesChannel = typeof salesChannels.$inferInsert;

// Produtos
export const products = mysqlTable("products", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  name: varchar("name", { length: 200 }).notNull(),
  categoryId: int("categoryId").notNull(),
  subcategoryId: int("subcategoryId"),
  subcategory: varchar("subcategory", { length: 100 }),
  ean: varchar("ean", { length: 20 }),
  uom: varchar("uom", { length: 10 }).notNull(), // UN, CX, KG, etc
  minStock: int("minStock").default(0),
  currentStock: int("currentStock").default(0),
  avgCost: decimal("avgCost", { precision: 10, scale: 2 }).default("0.00"),
  active: boolean("active").default(true).notNull(),
  isComposite: boolean("isComposite").default(false).notNull(),
  notes: text("notes"),
  expirationDate: timestamp("expirationDate"),
  // Campos de Salão (visíveis apenas para empresas do segmento Hamburgueria/Restaurante)
  productionDestination: mysqlEnum("productionDestination", ["KITCHEN", "BAR", "BOTH", "NONE"]).default("NONE"),
  availableInSalon: boolean("availableInSalon").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  eanIdx: index("ean_idx").on(table.ean),
  nameIdx: index("name_idx").on(table.name),
  companyBranchIdx: index("prod_company_branch_idx").on(table.companyId, table.branchId),
}));

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// Composição de produtos (para packs)
export const productCompositions = mysqlTable("productCompositions", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  parentProductId: int("parentProductId").notNull(),
  childProductId: int("childProductId").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type ProductComposition = typeof productCompositions.$inferSelect;
export type InsertProductComposition = typeof productCompositions.$inferInsert;

// Preços por canal
export const productPrices = mysqlTable("productPrices", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  productId: int("productId").notNull(),
  channelId: int("channelId").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  effectiveFrom: timestamp("effectiveFrom").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  productChannelIdx: uniqueIndex("product_channel_idx").on(table.productId, table.channelId),
}));

export type ProductPrice = typeof productPrices.$inferSelect;
export type InsertProductPrice = typeof productPrices.$inferInsert;

// Histórico de movimentações de produtos
export const productMovements = mysqlTable("productMovements", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  productId: int("productId").notNull(),
  date: timestamp("date").notNull(),
  type: mysqlEnum("type", ["ENTRADA", "SAIDA", "PERDA", "ACERTO", "ESTORNO"]).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(), // Pode ser negativo para saídas
  documentNumber: varchar("documentNumber", { length: 100 }), // Nota fiscal, ID da venda, etc
  userId: varchar("userId", { length: 64 }).notNull(), // Usuário responsável
  notes: text("notes"), // Observações/Justificativa
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  productIdx: index("product_idx").on(table.productId),
  dateIdx: index("date_idx").on(table.date),
  typeIdx: index("type_idx").on(table.type),
  companyBranchIdx: index("pm_company_branch_idx").on(table.companyId, table.branchId),
}));

export type ProductMovement = typeof productMovements.$inferSelect;
export type InsertProductMovement = typeof productMovements.$inferInsert;

// Parceiros (clientes e fornecedores)
export const partners = mysqlTable("partners", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  name: varchar("name", { length: 200 }).notNull(),
  tradeName: varchar("tradeName", { length: 200 }), // Nome Fantasia
  docNumber: varchar("docNumber", { length: 20 }),
  partnerType: mysqlEnum("partnerType", ["CUSTOMER", "SUPPLIER", "BOTH"]).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  // Endereço separado em campos
  street: varchar("street", { length: 255 }), // Logradouro (apenas rua)
  streetNumber: varchar("streetNumber", { length: 20 }), // Número
  complement: varchar("complement", { length: 100 }), // Complemento
  neighborhood: varchar("neighborhood", { length: 100 }), // Bairro
  city: varchar("city", { length: 100 }), // Cidade
  state: varchar("state", { length: 2 }), // UF (SP, RJ, etc)
  zipCode: varchar("zipCode", { length: 10 }), // CEP
  notes: text("notes"), // Observações
  creditLimit: decimal("creditLimit", { precision: 10, scale: 2 }).default("0.00"),
  currentBalance: decimal("currentBalance", { precision: 10, scale: 2 }).default("0.00"),
  creditPolicy: mysqlEnum("creditPolicy", ["ACTIVE", "BLOCKED"]).default("ACTIVE"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  docIdx: index("doc_idx").on(table.docNumber),
  companyBranchIdx: index("partner_company_branch_idx").on(table.companyId, table.branchId),
}));

export type Partner = typeof partners.$inferSelect;
export type InsertPartner = typeof partners.$inferInsert;

// Vendas
export const sales = mysqlTable("sales", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  saleType: mysqlEnum("saleType", ["BALCAO", "DELIVERY", "A_PRAZO", "SALAO"]).notNull(),
  saleDate: timestamp("saleDate").defaultNow(),
  customerId: int("customerId"),
  channelId: int("channelId"),
  platformOrderId: varchar("platformOrderId", { length: 100 }),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discountAmount", { precision: 10, scale: 2 }).default("0.00"),
  surchargeAmount: decimal("surchargeAmount", { precision: 10, scale: 2 }).default("0.00"),
  finalAmount: decimal("finalAmount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  requiresAdminApproval: boolean("requiresAdminApproval").default(false),
  adminApprovedBy: varchar("adminApprovedBy", { length: 64 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["ACTIVE", "CANCELLED"]).default("ACTIVE").notNull(),
  cancelledAt: timestamp("cancelledAt"),
  cancelledBy: varchar("cancelledBy", { length: 64 }),
  cancellationReason: text("cancellationReason"),
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  revenueAccountId: int("revenueAccountId"),  // FK para conta de receita (atribuída automaticamente)
}, (table) => ({
  dateIdx: index("date_idx").on(table.saleDate),
  customerIdx: index("customer_idx").on(table.customerId),
  revenueAccountIdx: index("revenue_account_idx").on(table.revenueAccountId),
}));

export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;

// Itens de venda
export const saleItems = mysqlTable("saleItems", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  saleId: int("saleId").notNull(),
  productId: int("productId").notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type SaleItem = typeof saleItems.$inferSelect;
export type InsertSaleItem = typeof saleItems.$inferInsert;


// Ordens de Compra
export const purchaseOrders = mysqlTable("purchaseOrders", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  supplierId: int("supplierId").notNull(),
  docType: mysqlEnum("docType", ["NOTA_FISCAL", "CUPOM", "SEM_DOCUMENTO"]).notNull(),
  docNumber: varchar("docNumber", { length: 100 }),
  accessKey: varchar("accessKey", { length: 44 }), // Chave de acesso da NF-e (44 dígitos)
  issueDate: timestamp("issueDate").notNull(),
  postingDate: timestamp("postingDate").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0.00"),
  freightCost: decimal("freightCost", { precision: 10, scale: 2 }).default("0.00"),
  chargesCost: decimal("chargesCost", { precision: 10, scale: 2 }).default("0.00"),
  paymentMethod: varchar("paymentMethod", { length: 50 }).notNull(),
  invoiceFilePath: varchar("invoiceFilePath", { length: 255 }),
  status: mysqlEnum("status", ["DRAFT", "CONFIRMED", "CANCELLED"]).default("DRAFT").notNull(),
  notes: text("notes"),
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  supplierIdx: index("supplier_idx").on(table.supplierId),
  statusIdx: index("status_idx").on(table.status),
  dateIdx: index("date_idx").on(table.postingDate),
}));

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;

// Itens de Ordem de Compra
export const purchaseOrderItems = mysqlTable("purchaseOrderItems", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  productId: int("productId").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unitCost: decimal("unitCost", { precision: 10, scale: 4 }).notNull(),
  totalCost: decimal("totalCost", { precision: 10, scale: 2 }).notNull(),
  expiryDate: timestamp("expiryDate"),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  poIdx: index("po_idx").on(table.purchaseOrderId),
  productIdx: index("product_idx").on(table.productId),
}));

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;

// Contas a Pagar
export const accountsPayable = mysqlTable("accountsPayable", {
  id: int("id").primaryKey().autoincrement(),
  description: varchar("description", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  paidDate: timestamp("paidDate"),
  status: mysqlEnum("status", ["PENDING", "PAID", "OVERDUE", "CANCELLED"]).default("PENDING").notNull(),
  supplierId: int("supplierId"),
  purchaseOrderId: int("purchaseOrderId"),
  expenseId: int("expenseId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  statusIdx: index("status_idx").on(table.status),
  dueDateIdx: index("due_date_idx").on(table.dueDate),
  supplierIdx: index("supplier_idx").on(table.supplierId),
}));

export type AccountPayable = typeof accountsPayable.$inferSelect;
export type InsertAccountPayable = typeof accountsPayable.$inferInsert;

// Parcelas de Compra
export const purchaseInstallments = mysqlTable("purchaseInstallments", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  installmentNumber: int("installmentNumber").notNull(),
  dueDate: timestamp("dueDate").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paidDate: timestamp("paidDate"),
  paidAmount: decimal("paidAmount", { precision: 10, scale: 2 }),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  interestAmount: decimal("interestAmount", { precision: 10, scale: 2 }),
  discountAmount: decimal("discountAmount", { precision: 10, scale: 2 }),
  bankAccountId: int("bankAccountId"),
  notes: text("notes"),
  status: mysqlEnum("status", ["PENDING", "PAID", "OVERDUE", "CANCELLED"]).default("PENDING").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  poIdx: index("po_idx").on(table.purchaseOrderId),
  dueDateIdx: index("due_date_idx").on(table.dueDate),
  companyBranchIdx: index("pi_company_branch_idx").on(table.companyId, table.branchId),
}));

export type PurchaseInstallment = typeof purchaseInstallments.$inferSelect;
export type InsertPurchaseInstallment = typeof purchaseInstallments.$inferInsert;



// ============================================
// MÓDULO DE DESPESAS OPERACIONAIS
// ============================================

// Categorias de Despesas
export const expenseCategories = mysqlTable("expenseCategories", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = typeof expenseCategories.$inferInsert;

// Despesas Operacionais
export const expenses = mysqlTable("expenses", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  supplierId: int("supplierId"), // FK para fornecedor (opcional) - PRIMEIRO CAMPO
  issueDate: timestamp("issueDate"), // Data de emissão do documento
  entryDate: timestamp("entryDate"), // Data de entrada no sistema (afeta competência)
  competenceMonth: varchar("competenceMonth", { length: 7 }), // Mês de competência (YYYY-MM)
  purchaseOrderId: int("purchaseOrderId"), // FK para ordem de compra (se origem for Compra)
  docType: mysqlEnum("docType", ["NOTA_FISCAL", "CUPOM", "FATURA", "CONTRATO", "RECIBO", "BOLETO", "OUTROS"]).notNull(), // Tipo de documento
  docNumber: varchar("docNumber", { length: 100 }), // Número do documento
  categoryId: int("categoryId").notNull(),  // Categoria antiga (mantida para compatibilidade)
  managementAccountId: int("managementAccountId"),  // FK para conta gerencial (novo sistema)
  accountingCode: varchar("accountingCode", { length: 20 }),  // Código contábil desnormalizado
  description: varchar("description", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Renomeado de totalAmount
  paymentMethod: varchar("paymentMethod", { length: 50 }).notNull(), // Forma de pagamento (igual Compras)
  notes: text("notes"),
  status: mysqlEnum("status", ["ATIVA", "PAGA", "CANCELADA"]).default("ATIVA").notNull(),
  productId: int("productId"), // FK para produto (apenas para categoria Perdas)
  lossQuantity: int("lossQuantity"), // Quantidade perdida (apenas para categoria Perdas)
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  categoryIdx: index("category_idx").on(table.categoryId),
  statusIdx: index("status_idx").on(table.status),
  supplierIdx: index("supplier_idx").on(table.supplierId),
  mgmtAccountIdx: index("mgmt_account_idx").on(table.managementAccountId),
  accountingCodeIdx: index("accounting_code_idx").on(table.accountingCode),
}));

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

// Parcelas de Despesas
export const expenseInstallments = mysqlTable("expenseInstallments", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  expenseId: int("expenseId").notNull(),
  installmentNumber: int("installmentNumber").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  paymentDate: timestamp("paymentDate"),
  paymentAmount: decimal("paymentAmount", { precision: 10, scale: 2 }),
  paymentMethod: varchar("paymentMethod", { length: 50 }), // Mesmas formas de Compras
  interestAmount: decimal("interestAmount", { precision: 10, scale: 2 }),
  discountAmount: decimal("discountAmount", { precision: 10, scale: 2 }),
  bankAccountId: int("bankAccountId"),
  status: mysqlEnum("status", ["PENDENTE", "PAGO", "VENCIDO", "CANCELADO"]).default("PENDENTE").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  expenseIdx: index("expense_idx").on(table.expenseId),
  dueDateIdx: index("due_date_idx").on(table.dueDate),
  statusIdx: index("status_idx").on(table.status),
  companyBranchIdx: index("ei_company_branch_idx").on(table.companyId, table.branchId),
}));

export type ExpenseInstallment = typeof expenseInstallments.$inferSelect;
export type InsertExpenseInstallment = typeof expenseInstallments.$inferInsert;


// ==================== CONTAS A RECEBER ====================

// Recebíveis (vinculados às vendas A_PRAZO)
export const receivables = mysqlTable("receivables", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  saleId: int("saleId").notNull(), // FK para venda
  customerId: int("customerId").notNull(), // FK para cliente
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  receivedAmount: decimal("receivedAmount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  status: mysqlEnum("status", ["PENDENTE", "PARCIAL", "QUITADO", "VENCIDO"]).default("PENDENTE").notNull(),
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  saleIdx: index("sale_idx").on(table.saleId),
  customerIdx: index("customer_idx").on(table.customerId),
  statusIdx: index("status_idx").on(table.status),
}));

export type Receivable = typeof receivables.$inferSelect;
export type InsertReceivable = typeof receivables.$inferInsert;

// Parcelas de Recebíveis
export const receivableInstallments = mysqlTable("receivableInstallments", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  receivableId: int("receivableId").notNull(),
  installmentNumber: int("installmentNumber").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  paidDate: timestamp("paidDate"),
  paidAmount: decimal("paidAmount", { precision: 10, scale: 2 }),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  bankAccountId: int("bankAccountId"),
  status: mysqlEnum("status", ["PENDENTE", "PAGO", "VENCIDO", "PARCIAL"]).default("PENDENTE").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  receivableIdx: index("receivable_idx").on(table.receivableId),
  dueDateIdx: index("due_date_idx").on(table.dueDate),
  statusIdx: index("status_idx").on(table.status),
  companyBranchIdx: index("ri_company_branch_idx").on(table.companyId, table.branchId),
}));

export type ReceivableInstallment = typeof receivableInstallments.$inferSelect;
export type InsertReceivableInstallment = typeof receivableInstallments.$inferInsert;

// Histórico de Pagamentos de Recebíveis (para armazenar múltiplos pagamentos por parcela)
export const receivablePayments = mysqlTable("receivablePayments", {
  id: int("id").primaryKey().autoincrement(),
  installmentId: int("installmentId").notNull(), // Parcela que recebeu o pagamento
  receivableId: int("receivableId").notNull(), // Recebível relacionado
  customerId: int("customerId").notNull(), // Cliente que pagou
  paidDate: timestamp("paidDate").notNull(), // Data do pagamento
  paidAmount: decimal("paidAmount", { precision: 10, scale: 2 }).notNull(), // Valor pago
  paymentMethod: varchar("paymentMethod", { length: 50 }).notNull(), // Forma de pagamento
  bankAccountId: int("bankAccountId"),
  notes: text("notes"), // Observações
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  installmentIdx: index("installment_idx").on(table.installmentId),
  receivableIdx: index("receivable_idx").on(table.receivableId),
  customerIdx: index("customer_idx").on(table.customerId),
  paidDateIdx: index("paid_date_idx").on(table.paidDate),
}));

export type ReceivablePayment = typeof receivablePayments.$inferSelect;
export type InsertReceivablePayment = typeof receivablePayments.$inferInsert;

// Pagamentos de Clientes (Conta Corrente - não vinculados a vendas específicas)
export const customerPayments = mysqlTable("customerPayments", {
  id: int("id").primaryKey().autoincrement(),
  customerId: int("customerId").notNull(), // Cliente que pagou
  paidDate: timestamp("paidDate").notNull(), // Data do pagamento
  paidAmount: decimal("paidAmount", { precision: 10, scale: 2 }).notNull(), // Valor pago
  paymentMethod: varchar("paymentMethod", { length: 50 }).notNull(), // Forma de pagamento (Dinheiro, PIX, Cartão, etc)
  bankAccountId: int("bankAccountId"),
  notes: text("notes"), // Observações
  createdBy: varchar("createdBy", { length: 64 }).notNull(), // Usuário que registrou
  companyId: int("companyId"), // Empresa (multiempresa)
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  customerIdx: index("customer_idx").on(table.customerId),
  paidDateIdx: index("paid_date_idx").on(table.paidDate),
}));

export type CustomerPayment = typeof customerPayments.$inferSelect;
export type InsertCustomerPayment = typeof customerPayments.$inferInsert;

// Débitos manuais (valores avulsos adicionados à conta do cliente)
export const customerDebits = mysqlTable("customerDebits", {
  id: int("id").primaryKey().autoincrement(),
  customerId: int("customerId").notNull().references(() => partners.id),
  debitDate: timestamp("debitDate").notNull(),
  debitAmount: decimal("debitAmount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(), // Ex: "Empréstimo em dinheiro", "Taxa de serviço"
  managementAccountId: int("managementAccountId").references(() => managementAccounts.id), // Conta gerencial para classificação contábil
  notes: text("notes"),
  createdBy: varchar("createdBy", { length: 64 }),
  companyId: int("companyId"), // Empresa (multiempresa)
  createdAt: timestamp("createdAt").defaultNow(),
});

export type CustomerDebit = typeof customerDebits.$inferSelect;
export type InsertCustomerDebit = typeof customerDebits.$inferInsert;


// ==================== METAS DE FATURAMENTO ====================

// Metas mensais de faturamento
export const revenueGoals = mysqlTable("revenueGoals", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  year: int("year").notNull(), // Ano da meta
  month: int("month").notNull(), // Mês da meta (1-12)
  channelId: int("channelId"), // Canal específico (null = meta geral)
  targetAmount: decimal("targetAmount", { precision: 12, scale: 2 }).notNull(), // Valor da meta
  notes: text("notes"), // Observações
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  yearMonthIdx: index("year_month_idx").on(table.year, table.month),
  channelIdx: index("channel_idx").on(table.channelId),
}));

export type RevenueGoal = typeof revenueGoals.$inferSelect;
export type InsertRevenueGoal = typeof revenueGoals.$inferInsert;


// Histórico de alterações de metas
export const revenueGoalHistory = mysqlTable("revenueGoalHistory", {
  id: int("id").primaryKey().autoincrement(),
  goalId: int("goalId").notNull(), // FK para revenueGoals
  previousAmount: decimal("previousAmount", { precision: 12, scale: 2 }).notNull(),
  newAmount: decimal("newAmount", { precision: 12, scale: 2 }).notNull(),
  changedBy: varchar("changedBy", { length: 64 }).notNull(), // ID do usuário
  changedByName: varchar("changedByName", { length: 200 }), // Nome do usuário
  reason: text("reason"), // Motivo da alteração
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  goalIdx: index("goal_idx").on(table.goalId),
}));

export type RevenueGoalHistory = typeof revenueGoalHistory.$inferSelect;
export type InsertRevenueGoalHistory = typeof revenueGoalHistory.$inferInsert;


// ==================== SISTEMA DE CONTABILIZAÇÃO ====================

// Contas Gerenciais (o que o usuário vê e seleciona)
export const managementAccounts = mysqlTable("managementAccounts", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  code: varchar("code", { length: 20 }).notNull(),  // Código interno (ex: "ALU001")
  name: varchar("name", { length: 100 }).notNull(),  // Nome da conta (ex: "Aluguel")
  description: text("description"),  // Descrição detalhada
  nature: mysqlEnum("nature", ["CUSTO", "DESPESA", "RECEITA", "PATRIMONIAL"]).notNull(),  // Natureza contábil
  costType: mysqlEnum("costType", ["FIXA", "VARIAVEL"]),  // Tipo de custo (Fixa/Variável)
  classification: mysqlEnum("classification", [
    "OPERACIONAL",
    "ADMINISTRATIVA", 
    "COMERCIAL",
    "FINANCEIRA",
    "NAO_OPERACIONAL",
    "PATRIMONIAL"
  ]).notNull(),  // Classificação para DRE
  impactMargin: boolean("impactMargin").default(false),  // Impacta margem de contribuição
  impactPayroll: boolean("impactPayroll").default(false),  // Impacta folha de pagamento
  isActive: boolean("isActive").default(true).notNull(),
  displayOrder: int("displayOrder").default(0),  // Ordem de exibição
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  codeIdx: uniqueIndex("code_idx").on(table.code),
  nameIdx: index("name_idx").on(table.name),
  natureIdx: index("nature_idx").on(table.nature),
  classificationIdx: index("classification_idx").on(table.classification),
}));

export type ManagementAccount = typeof managementAccounts.$inferSelect;
export type InsertManagementAccount = typeof managementAccounts.$inferInsert;

// Mapeamento Contábil (relação entre conta gerencial e código contábil)
export const accountingMappings = mysqlTable("accountingMappings", {
  id: int("id").primaryKey().autoincrement(),
  managementAccountId: int("managementAccountId").notNull(),  // FK para conta gerencial
  accountingCode: varchar("accountingCode", { length: 20 }).notNull(),  // Código contábil (ex: "3.2.01.001")
  accountingName: varchar("accountingName", { length: 150 }),  // Nome da conta contábil
  effectiveDate: timestamp("effectiveDate").notNull(),  // Data de início da vigência
  endDate: timestamp("endDate"),  // Data de fim da vigência (NULL = ainda ativa)
  notes: text("notes"),  // Observações
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  mgmtAccountIdx: index("mgmt_account_idx").on(table.managementAccountId),
  accountingCodeIdx: index("accounting_code_idx").on(table.accountingCode),
  effectiveDateIdx: index("effective_date_idx").on(table.effectiveDate),
}));

export type AccountingMapping = typeof accountingMappings.$inferSelect;
export type InsertAccountingMapping = typeof accountingMappings.$inferInsert;

// Plano de Contas Contábil (estrutura hierárquica do plano contábil)
export const chartOfAccounts = mysqlTable("chartOfAccounts", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  parentId: int("parentId"), // ID da conta pai
  code: varchar("code", { length: 20 }).notNull(),  // Código contábil (ex: "3.2.01.001")
  name: varchar("name", { length: 150 }).notNull(),  // Nome da conta
  parentCode: varchar("parentCode", { length: 20 }),  // Código da conta pai (para hierarquia)
  level: int("level").notNull(),  // Nível na hierarquia (1, 2, 3, 4)
  accountType: mysqlEnum("accountType", [
    "ATIVO",
    "PASSIVO",
    "PL",
    "PATRIMONIO_LIQUIDO",
    "RECEITA",
    "CUSTO",
    "DESPESA"
  ]).notNull(),
  nature: mysqlEnum("nature", ["DEVEDORA", "CREDORA"]).notNull().default("DEVEDORA"),
  isAnalytical: boolean("isAnalytical").default(true),  // Conta analítica (permite lançamentos) ou sintética
  allowsEntries: boolean("allowsEntries").notNull().default(true),
  isActive: boolean("isActive").default(true).notNull(),
  displayOrder: int("displayOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  codeCompanyIdx: uniqueIndex("chart_code_company_idx").on(table.code, table.companyId),
  parentIdx: index("parent_idx").on(table.parentCode),
  typeIdx: index("type_idx").on(table.accountType),
  companyIdx: index("chart_company_idx").on(table.companyId),
}));

export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type InsertChartOfAccount = typeof chartOfAccounts.$inferInsert;


// Contas de Receita (para contabilização automática de vendas)
export const revenueAccounts = mysqlTable("revenueAccounts", {
  id: int("id").primaryKey().autoincrement(),
  code: varchar("code", { length: 20 }).notNull(),  // Código contábil (ex: "4.1.01.001")
  name: varchar("name", { length: 100 }).notNull(),  // Nome da conta (ex: "Receita de Vendas Balcão")
  description: text("description"),  // Descrição detalhada
  accountType: mysqlEnum("accountType", [
    "RECEITA_BRUTA",      // Receitas de vendas
    "DEDUCAO",            // Deduções (descontos, taxas)
    "OUTRAS_RECEITAS"     // Outras receitas (juros, etc.)
  ]).notNull(),
  // Mapeamento automático por tipo de venda
  saleType: mysqlEnum("saleType", ["BALCAO", "DELIVERY", "A_PRAZO", "SALAO"]),  // NULL = não é receita de venda
  isDefault: boolean("isDefault").default(false),  // Conta padrão para o tipo
  isActive: boolean("isActive").default(true).notNull(),
  displayOrder: int("displayOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  codeIdx: uniqueIndex("revenue_code_idx").on(table.code),
  saleTypeIdx: index("sale_type_idx").on(table.saleType),
  accountTypeIdx: index("account_type_idx").on(table.accountType),
}));

export type RevenueAccount = typeof revenueAccounts.$inferSelect;
export type InsertRevenueAccount = typeof revenueAccounts.$inferInsert;

// Lançamentos Contábeis de Receita (registro de cada venda para contabilização)
export const revenueEntries = mysqlTable("revenueEntries", {
  id: int("id").primaryKey().autoincrement(),
  saleId: int("saleId").notNull(),  // FK para venda
  revenueAccountId: int("revenueAccountId").notNull(),  // FK para conta de receita
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),  // Valor do lançamento
  entryType: mysqlEnum("entryType", ["CREDITO", "DEBITO"]).notNull(),  // Crédito = receita, Débito = dedução
  description: varchar("description", { length: 200 }),  // Descrição do lançamento
  entryDate: timestamp("entryDate").notNull(),  // Data do lançamento (data da venda)
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  saleIdx: index("sale_idx").on(table.saleId),
  accountIdx: index("account_idx").on(table.revenueAccountId),
  dateIdx: index("entry_date_idx").on(table.entryDate),
}));

export type RevenueEntry = typeof revenueEntries.$inferSelect;
export type InsertRevenueEntry = typeof revenueEntries.$inferInsert;


// Logs de backup (BUG-05)
export const backupLogs = mysqlTable("backupLogs", {
  id: int("id").primaryKey().autoincrement(),
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt"),
  status: mysqlEnum("status", ["running", "success", "partial", "failed"]).notNull(),
  
  // Detalhes do backup
  databaseFile: varchar("databaseFile", { length: 255 }),
  databaseSize: int("databaseSize"), // bytes
  codeFile: varchar("codeFile", { length: 255 }),
  codeSize: int("codeSize"), // bytes
  
  // Google Drive
  databaseDriveId: varchar("databaseDriveId", { length: 100 }),
  databaseDriveLink: varchar("databaseDriveLink", { length: 500 }),
  codeDriveId: varchar("codeDriveId", { length: 100 }),
  codeDriveLink: varchar("codeDriveLink", { length: 500 }),
  
  // Limpeza
  localFilesDeleted: int("localFilesDeleted").default(0),
  driveFilesDeleted: int("driveFilesDeleted").default(0),
  
  // Erro (se houver)
  errorMessage: text("errorMessage"),
  
  // Duração
  durationSeconds: decimal("durationSeconds", { precision: 10, scale: 2 }),
  
  // Metadados
  triggeredBy: varchar("triggeredBy", { length: 50 }), // "scheduled", "manual", "webhook"
  serverVersion: varchar("serverVersion", { length: 50 }),
}, (table) => ({
  startedAtIdx: index("backup_started_at_idx").on(table.startedAt),
  statusIdx: index("backup_status_idx").on(table.status),
}));

export type BackupLog = typeof backupLogs.$inferSelect;
export type InsertBackupLog = typeof backupLogs.$inferInsert;

// =====================================================
// MÓDULO CONTÁBIL
// =====================================================

// Journals (Lotes Contábeis)
export const journals = mysqlTable("journals", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  competenceMonth: varchar("competenceMonth", { length: 7 }).notNull(), // YYYY-MM
  description: varchar("description", { length: 255 }),
  status: mysqlEnum("status", ["DRAFT", "POSTED", "REVERSED"]).notNull().default("DRAFT"),
  totalDebit: decimal("totalDebit", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalCredit: decimal("totalCredit", { precision: 15, scale: 2 }).notNull().default("0.00"),
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  postedAt: timestamp("postedAt"),
}, (table) => ({
  companyIdx: index("journal_company_idx").on(table.companyId),
  competenceIdx: index("journal_competence_idx").on(table.competenceMonth),
  statusIdx: index("journal_status_idx").on(table.status),
}));

export type Journal = typeof journals.$inferSelect;
export type InsertJournal = typeof journals.$inferInsert;

// Lançamentos Contábeis
export const accountingEntries = mysqlTable("accountingEntries", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  journalId: int("journalId").notNull(),
  accountId: int("accountId").notNull(),
  entryDate: timestamp("entryDate").notNull(),
  competenceMonth: varchar("competenceMonth", { length: 7 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  entryType: mysqlEnum("entryType", ["D", "C"]).notNull(), // Débito ou Crédito
  description: varchar("description", { length: 255 }),
  sourceType: varchar("sourceType", { length: 50 }), // sale, purchase, expense, otherRevenue
  sourceId: int("sourceId"),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  journalIdx: index("entry_journal_idx").on(table.journalId),
  accountIdx: index("entry_account_idx").on(table.accountId),
  competenceIdx: index("entry_competence_idx").on(table.competenceMonth),
  sourceIdx: index("entry_source_idx").on(table.sourceType, table.sourceId),
}));

export type AccountingEntry = typeof accountingEntries.$inferSelect;
export type InsertAccountingEntry = typeof accountingEntries.$inferInsert;

// Rastreabilidade de Journals (documentos origem)
export const journalSources = mysqlTable("journalSources", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  journalId: int("journalId").notNull(),
  sourceType: varchar("sourceType", { length: 50 }).notNull(), // sale, purchase, expense, otherRevenue
  sourceId: int("sourceId").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  journalIdx: index("source_journal_idx").on(table.journalId),
  sourceIdx: uniqueIndex("source_unique_idx").on(table.journalId, table.sourceType, table.sourceId),
}));

export type JournalSource = typeof journalSources.$inferSelect;
export type InsertJournalSource = typeof journalSources.$inferInsert;

// Períodos Contábeis
export const accountingPeriods = mysqlTable("accountingPeriods", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  competenceMonth: varchar("competenceMonth", { length: 7 }).notNull(), // YYYY-MM
  status: mysqlEnum("status", ["OPEN", "CLOSED", "REOPENED"]).notNull().default("OPEN"),
  closedAt: timestamp("closedAt"),
  closedBy: varchar("closedBy", { length: 64 }),
  // Campos de reabertura
  reopenedAt: timestamp("reopenedAt"),
  reopenedBy: varchar("reopenedBy", { length: 64 }),
  reopenReason: text("reopenReason"),
  reopenCount: int("reopenCount").default(0).notNull(), // Máximo 2 reaberturas
  reopenExpiresAt: timestamp("reopenExpiresAt"), // Fecha automaticamente após 48h
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  companyCompetenceIdx: uniqueIndex("period_company_competence_idx").on(table.companyId, table.competenceMonth),
}));

export type AccountingPeriod = typeof accountingPeriods.$inferSelect;
export type InsertAccountingPeriod = typeof accountingPeriods.$inferInsert;

// Outras Receitas
export const otherRevenues = mysqlTable("otherRevenues", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  partnerId: int("partnerId"), // Fornecedor
  issueDate: timestamp("issueDate"), // Data Emissão
  entryDate: timestamp("entryDate"), // Data Entrada (contabilização)
  revenueDate: timestamp("revenueDate").notNull(), // Campo legado (manter)
  competenceMonth: varchar("competenceMonth", { length: 7 }).notNull(), // Competência
  documentType: varchar("documentType", { length: 50 }), // Tipo Documento
  documentNumber: varchar("documentNumber", { length: 50 }), // Nº Documento
  managementAccountId: int("managementAccountId").notNull(), // Conta Gerencial de Receita
  description: varchar("description", { length: 255 }).notNull(), // Descrição
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(), // Valor
  creditDate: timestamp("creditDate"), // Data Crédito
  paymentMethod: varchar("paymentMethod", { length: 50 }), // Forma de Recebimento
  isPaid: boolean("isPaid").default(false),
  paidAt: timestamp("paidAt"),
  isRecurring: boolean("isRecurring").default(false),
  recurrenceType: mysqlEnum("recurrenceType", ["MENSAL", "TRIMESTRAL", "ANUAL"]),
  recurrenceEndDate: timestamp("recurrenceEndDate"),
  status: mysqlEnum("status", ["ACTIVE", "CANCELLED"]).notNull().default("ACTIVE"),
  notes: text("notes"),
  isAccounted: boolean("isAccounted").default(false),
  accountedJournalId: int("accountedJournalId"),
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  companyIdx: index("other_revenue_company_idx").on(table.companyId),
  revenueDateIdx: index("other_revenue_date_idx").on(table.revenueDate),
  competenceIdx: index("other_revenue_competence_idx").on(table.competenceMonth),
  statusIdx: index("other_revenue_status_idx").on(table.status),
}));

export type OtherRevenue = typeof otherRevenues.$inferSelect;
export type InsertOtherRevenue = typeof otherRevenues.$inferInsert;


// =====================================================
// GOVERNANÇA CONTÁBIL
// =====================================================

// Configurações de Governança por Empresa
export const governanceSettings = mysqlTable("governanceSettings", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  // Janelas de edição
  salesEditWindowHours: int("salesEditWindowHours").default(72).notNull(), // 72h para vendas
  expensesEditWindowDays: int("expensesEditWindowDays").default(3).notNull(), // 3 dias para despesas
  purchasesEditWindowDays: int("purchasesEditWindowDays").default(3).notNull(), // 3 dias para compras
  // Competência retroativa
  allowRetroactivePosting: boolean("allowRetroactivePosting").default(true).notNull(),
  retroactiveLimitDay: int("retroactiveLimitDay").default(5).notNull(), // Até dia 5 pode retroagir
  // Reabertura de períodos
  maxReopenCount: int("maxReopenCount").default(2).notNull(), // Máximo de reaberturas
  reopenWindowHours: int("reopenWindowHours").default(48).notNull(), // Janela de 48h após reabertura
  maxReopenDaysAfterClose: int("maxReopenDaysAfterClose").default(30).notNull(), // Máximo 30 dias após fechamento
  // Contabilização automática
  autoAccountingEnabled: boolean("autoAccountingEnabled").default(true).notNull(),
  autoAccountingDay: int("autoAccountingDay").default(0).notNull(), // 0 = Domingo
  autoAccountingHour: int("autoAccountingHour").default(3).notNull(), // 03:00
  // Auditoria
  updatedBy: varchar("updatedBy", { length: 64 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  companyIdx: uniqueIndex("governance_company_idx").on(table.companyId),
}));

export type GovernanceSettings = typeof governanceSettings.$inferSelect;
export type InsertGovernanceSettings = typeof governanceSettings.$inferInsert;

// Log de Alterações de Governança
export const governanceAuditLog = mysqlTable("governanceAuditLog", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  action: mysqlEnum("action", [
    "SETTINGS_CHANGED",
    "PERIOD_CLOSED",
    "PERIOD_REOPENED",
    "PERIOD_AUTO_CLOSED",
    "ACCOUNTING_BATCH_RUN",
    "ACCOUNTING_MANUAL_RUN",
    "EDIT_BLOCKED",
    "DELETE_BLOCKED",
    "CUSTOMER_CHANGED"
  ]).notNull(),
  entityType: varchar("entityType", { length: 50 }), // sale, expense, purchase, period
  entityId: int("entityId"),
  previousValue: text("previousValue"), // JSON com valores anteriores
  newValue: text("newValue"), // JSON com valores novos
  reason: text("reason"), // Justificativa (obrigatória para reabertura)
  userId: varchar("userId", { length: 64 }).notNull(),
  userName: varchar("userName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  companyIdx: index("gov_audit_company_idx").on(table.companyId),
  actionIdx: index("gov_audit_action_idx").on(table.action),
  entityIdx: index("gov_audit_entity_idx").on(table.entityType, table.entityId),
  dateIdx: index("gov_audit_date_idx").on(table.createdAt),
}));

export type GovernanceAuditLog = typeof governanceAuditLog.$inferSelect;
export type InsertGovernanceAuditLog = typeof governanceAuditLog.$inferInsert;

// Log de Execução de Contabilização em Lote
export const accountingBatchLog = mysqlTable("accountingBatchLog", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  competenceMonth: varchar("competenceMonth", { length: 7 }).notNull(),
  batchType: mysqlEnum("batchType", ["SCHEDULED", "MANUAL"]).notNull(),
  status: mysqlEnum("status", ["RUNNING", "SUCCESS", "FAILED", "PARTIAL"]).notNull(),
  // Contadores
  salesProcessed: int("salesProcessed").default(0),
  expensesProcessed: int("expensesProcessed").default(0),
  purchasesProcessed: int("purchasesProcessed").default(0),
  otherRevenuesProcessed: int("otherRevenuesProcessed").default(0),
  journalsCreated: int("journalsCreated").default(0),
  entriesCreated: int("entriesCreated").default(0),
  // Erros
  errorCount: int("errorCount").default(0),
  errorDetails: text("errorDetails"), // JSON com detalhes dos erros
  // Timing
  startedAt: timestamp("startedAt").defaultNow(),
  completedAt: timestamp("completedAt"),
  durationMs: int("durationMs"),
  // Usuário (para manual)
  triggeredBy: varchar("triggeredBy", { length: 64 }),
}, (table) => ({
  companyIdx: index("batch_company_idx").on(table.companyId),
  competenceIdx: index("batch_competence_idx").on(table.competenceMonth),
  statusIdx: index("batch_status_idx").on(table.status),
  dateIdx: index("batch_date_idx").on(table.startedAt),
}));

export type AccountingBatchLog = typeof accountingBatchLog.$inferSelect;
export type InsertAccountingBatchLog = typeof accountingBatchLog.$inferInsert;

// ==================== IMPORTADOR IFOOD ====================

// Mapeamento De/Para de Produtos iFood
export const ifoodProductMappings = mysqlTable("ifoodProductMappings", {
  id: int("id").primaryKey().autoincrement(),
  ifoodSku: varchar("ifoodSku", { length: 50 }).notNull(),
  ifoodProductName: varchar("ifoodProductName", { length: 255 }).notNull(),
  correctEan: varchar("correctEan", { length: 20 }),
  productId: int("productId"),
  situation: varchar("situation", { length: 100 }),
  active: boolean("active").default(true).notNull(),
  createdBy: varchar("createdBy", { length: 64 }),
  updatedBy: varchar("updatedBy", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  skuIdx: uniqueIndex("ifood_sku_idx").on(table.ifoodSku),
}));
export type IfoodProductMapping = typeof ifoodProductMappings.$inferSelect;
export type InsertIfoodProductMapping = typeof ifoodProductMappings.$inferInsert;

// Log de Importações iFood
export const ifoodImportLogs = mysqlTable("ifoodImportLogs", {
  id: int("id").primaryKey().autoincrement(),
  importedAt: timestamp("importedAt").defaultNow(),
  ordersFileName: varchar("ordersFileName", { length: 255 }),
  itemsFileName: varchar("itemsFileName", { length: 255 }),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  totalOrders: int("totalOrders").default(0),
  importedOrders: int("importedOrders").default(0),
  skippedOrders: int("skippedOrders").default(0),
  ordersWithDivergence: int("ordersWithDivergence").default(0),
  totalValue: decimal("totalValue", { precision: 12, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["PROCESSING", "SUCCESS", "PARTIAL", "ERROR"]).default("PROCESSING").notNull(),
  errorMessage: text("errorMessage"),
  createdBy: varchar("createdBy", { length: 64 }),
}, (table) => ({
  importDateIdx: index("ifood_import_date_idx").on(table.importedAt),
  importStatusIdx: index("ifood_import_status_idx").on(table.status),
}));
export type IfoodImportLog = typeof ifoodImportLogs.$inferSelect;
export type InsertIfoodImportLog = typeof ifoodImportLogs.$inferInsert;

// Pedidos Importados do iFood
export const ifoodImportedOrders = mysqlTable("ifoodImportedOrders", {
  id: int("id").primaryKey().autoincrement(),
  ifoodOrderId: varchar("ifoodOrderId", { length: 64 }).notNull(),
  ifoodOrderCode: varchar("ifoodOrderCode", { length: 20 }),
  saleId: int("saleId"),
  importLogId: int("importLogId"),
  importedAt: timestamp("importedAt").defaultNow(),
}, (table) => ({
  orderIdIdx: uniqueIndex("ifood_order_id_idx").on(table.ifoodOrderId),
}));
export type IfoodImportedOrder = typeof ifoodImportedOrders.$inferSelect;
export type InsertIfoodImportedOrder = typeof ifoodImportedOrders.$inferInsert;

// Divergências de Preço iFood
export const ifoodPriceDivergences = mysqlTable("ifoodPriceDivergences", {
  id: int("id").primaryKey().autoincrement(),
  importLogId: int("importLogId"),
  ifoodOrderId: varchar("ifoodOrderId", { length: 64 }),
  productId: int("productId"),
  ifoodSku: varchar("ifoodSku", { length: 50 }),
  ifoodPrice: decimal("ifoodPrice", { precision: 10, scale: 2 }),
  abrwfPrice: decimal("abrwfPrice", { precision: 10, scale: 2 }),
  divergencePercent: decimal("divergencePercent", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow(),
});
export type IfoodPriceDivergence = typeof ifoodPriceDivergences.$inferSelect;
export type InsertIfoodPriceDivergence = typeof ifoodPriceDivergences.$inferInsert;


// ==================== DESTAQUES MANUAIS DO CALENDÁRIO ====================

export const calendarHighlights = mysqlTable("calendarHighlights", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  date: varchar("date", { length: 10 }).notNull(), // formato YYYY-MM-DD
  label: varchar("label", { length: 100 }).notNull(), // ex: "Loja Fechada", "Evento Especial"
  color: varchar("color", { length: 20 }).notNull().default("amber"), // amber, red, blue, green, etc.
  createdBy: varchar("createdBy", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
});
export type CalendarHighlight = typeof calendarHighlights.$inferSelect;
export type InsertCalendarHighlight = typeof calendarHighlights.$inferInsert;

// ==================== SNAPSHOT DE ESTOQUE MENSAL ====================
// Armazena o valor final de estoque por categoria no último dia de cada mês fechado.
// Uma vez gravado, o snapshot não deve ser alterado (imutável por design).
export const monthlyStockSnapshot = mysqlTable("monthlyStockSnapshot", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  year: int("year").notNull(),
  month: int("month").notNull(), // 1-12
  competenceMonth: varchar("competenceMonth", { length: 7 }).notNull(), // YYYY-MM
  categoryId: int("categoryId"),
  categoryName: varchar("categoryName", { length: 200 }),
  totalItems: int("totalItems").default(0),
  totalCost: decimal("totalCost", { precision: 14, scale: 2 }).default("0"),
  snapshotDate: timestamp("snapshotDate").defaultNow(), // quando o snapshot foi capturado
  capturedBy: varchar("capturedBy", { length: 64 }), // userId que disparou o fechamento
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  uniqueMonthCategory: uniqueIndex("monthlyStockSnapshot_month_cat").on(
    table.companyId, table.year, table.month, table.categoryId
  ),
}));
export type MonthlyStockSnapshot = typeof monthlyStockSnapshot.$inferSelect;
export type InsertMonthlyStockSnapshot = typeof monthlyStockSnapshot.$inferInsert;


// ==================== HISTÓRICO DE PREÇOS ====================
// Registra cada alteração de preço de venda (por canal) e custo médio dos produtos.
// Permite rastrear quem alterou, quando e de quanto para quanto.
export const priceHistory = mysqlTable("priceHistory", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  productId: int("productId").notNull(),
  changeType: mysqlEnum("changeType", ["PRECO_VENDA", "CUSTO_MEDIO"]).notNull(),
  channelId: int("channelId"), // null para custo médio (aplica a todos os canais)
  previousValue: decimal("previousValue", { precision: 10, scale: 2 }),
  newValue: decimal("newValue", { precision: 10, scale: 2 }).notNull(),
  changePercent: decimal("changePercent", { precision: 8, scale: 2 }), // variação percentual
  reason: text("reason"), // motivo da alteração (opcional)
  userId: varchar("userId", { length: 64 }).notNull(), // quem alterou
  userName: varchar("userName", { length: 200 }), // nome do usuário para consulta rápida
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  productIdx: index("ph_product_idx").on(table.productId),
  changeTypeIdx: index("ph_change_type_idx").on(table.changeType),
  channelIdx: index("ph_channel_idx").on(table.channelId),
  dateIdx: index("ph_date_idx").on(table.createdAt),
  companyBranchIdx: index("ph_company_branch_idx").on(table.companyId, table.branchId),
}));
export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = typeof priceHistory.$inferInsert;


// ==================== AUDITORIA - LOG DE ALTERAÇÕES ====================

export const auditLog = mysqlTable("auditLog", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull().default(1),
  branchId: int("branchId").notNull().default(1),
  entityType: varchar("entityType", { length: 50 }).notNull(), // 'PRODUTO', 'PARCEIRO', 'DESPESA', etc.
  entityId: int("entityId").notNull(), // ID do registro alterado
  entityName: varchar("entityName", { length: 300 }), // nome do registro para consulta rápida
  action: mysqlEnum("action", ["CRIACAO", "EDICAO", "EXCLUSAO", "ATIVACAO", "DESATIVACAO"]).notNull(),
  changes: text("changes"), // JSON com campos alterados: [{field, label, oldValue, newValue}]
  userId: varchar("userId", { length: 64 }).notNull(),
  userName: varchar("userName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  entityIdx: index("audit_entity_idx").on(table.entityType, table.entityId),
  companyIdx: index("audit_company_idx").on(table.companyId),
  dateIdx: index("audit_date_idx").on(table.createdAt),
  userIdx: index("audit_user_idx").on(table.userId),
  actionIdx: index("audit_action_idx").on(table.action),
}));
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;


// ==================== MÓDULO DE SALÃO ====================

// Configurações do salão por empresa
export const salonConfig = mysqlTable("salonConfig", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull(),
  defaultTipPercent: decimal("defaultTipPercent", { precision: 5, scale: 2 }).default("10.00"),
  tipEnabled: boolean("tipEnabled").default(true).notNull(),
  gratuityLabel: varchar("gratuityLabel", { length: 100 }).default("Gorjeta (10%)"),
  kitchenLabel: varchar("kitchenLabel", { length: 100 }).default("Cozinha"),
  barLabel: varchar("barLabel", { length: 100 }).default("Bar"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  companyIdx: uniqueIndex("salon_config_company_idx").on(table.companyId),
}));

export type SalonConfig = typeof salonConfig.$inferSelect;
export type InsertSalonConfig = typeof salonConfig.$inferInsert;

// Mesas do salão
export const salonTables = mysqlTable("salonTables", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull(),
  number: int("number").notNull(),
  name: varchar("name", { length: 100 }),
  capacity: int("capacity").default(4),
  status: mysqlEnum("status", ["FREE", "OCCUPIED", "WAITING_PAYMENT", "RESERVED"]).default("FREE").notNull(),
  positionX: int("positionX").default(0),
  positionY: int("positionY").default(0),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  companyIdx: index("salon_table_company_idx").on(table.companyId),
  numberIdx: index("salon_table_number_idx").on(table.companyId, table.number),
}));

export type SalonTable = typeof salonTables.$inferSelect;
export type InsertSalonTable = typeof salonTables.$inferInsert;

// Comandas (pedidos de salão)
export const salonOrders = mysqlTable("salonOrders", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("companyId").notNull(),
  tableId: int("tableId").notNull(),
  tableNumber: int("tableNumber").notNull(),
  waiterId: varchar("waiterId", { length: 64 }),
  waiterName: varchar("waiterName", { length: 200 }),
  guestCount: int("guestCount").default(1).notNull(),
  status: mysqlEnum("status", ["OPEN", "WAITING_PAYMENT", "CLOSED", "CANCELLED"]).default("OPEN").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0.00"),
  tipPercent: decimal("tipPercent", { precision: 5, scale: 2 }).default("0.00"),
  tipAmount: decimal("tipAmount", { precision: 10, scale: 2 }).default("0.00"),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).default("0.00"),
  notes: text("notes"),
  openedAt: timestamp("openedAt").defaultNow(),
  closedAt: timestamp("closedAt"),
  saleId: int("saleId"), // referência à venda criada ao fechar
}, (table) => ({
  companyIdx: index("salon_order_company_idx").on(table.companyId),
  tableIdx: index("salon_order_table_idx").on(table.tableId),
  statusIdx: index("salon_order_status_idx").on(table.status),
  openedIdx: index("salon_order_opened_idx").on(table.openedAt),
}));

export type SalonOrder = typeof salonOrders.$inferSelect;
export type InsertSalonOrder = typeof salonOrders.$inferInsert;

// Itens da comanda
export const salonOrderItems = mysqlTable("salonOrderItems", {
  id: int("id").primaryKey().autoincrement(),
  orderId: int("orderId").notNull(),
  companyId: int("companyId").notNull(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 200 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  productionDestination: mysqlEnum("productionDestination", ["KITCHEN", "BAR", "BOTH", "NONE"]).default("NONE"),
  status: mysqlEnum("status", ["PENDING", "IN_PROGRESS", "READY", "DELIVERED", "CANCELLED"]).default("PENDING").notNull(),
  sentAt: timestamp("sentAt"),
  readyAt: timestamp("readyAt"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  orderIdx: index("salon_item_order_idx").on(table.orderId),
  companyIdx: index("salon_item_company_idx").on(table.companyId),
  statusIdx: index("salon_item_status_idx").on(table.status),
  destinationIdx: index("salon_item_dest_idx").on(table.productionDestination),
}));

export type SalonOrderItem = typeof salonOrderItems.$inferSelect;
export type InsertSalonOrderItem = typeof salonOrderItems.$inferInsert;

// Pagamentos da comanda
export const salonOrderPayments = mysqlTable("salonOrderPayments", {
  id: int("id").primaryKey().autoincrement(),
  orderId: int("orderId").notNull(),
  companyId: int("companyId").notNull(),
  method: mysqlEnum("method", ["CASH", "CREDIT", "DEBIT", "PIX", "VOUCHER"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  orderIdx: index("salon_payment_order_idx").on(table.orderId),
  companyIdx: index("salon_payment_company_idx").on(table.companyId),
}));

export type SalonOrderPayment = typeof salonOrderPayments.$inferSelect;
export type InsertSalonOrderPayment = typeof salonOrderPayments.$inferInsert;


// ==================== WEB PUSH SUBSCRIPTIONS ====================

export const pushSubscriptions = mysqlTable("pushSubscriptions", {
  id: int("id").primaryKey().autoincrement(),
  userId: varchar("userId", { length: 64 }).notNull(),
  companyId: int("companyId").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  userIdx: index("push_sub_user_idx").on(table.userId),
  companyIdx: index("push_sub_company_idx").on(table.companyId),
}));

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;
