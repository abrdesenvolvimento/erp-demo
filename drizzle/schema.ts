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

// Usuários do sistema
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "operacional", "consultor"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Categorias de produtos
export const categories = mysqlTable("categories", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// Subcategorias
export const subcategories = mysqlTable("subcategories", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  categoryId: int("categoryId").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Subcategory = typeof subcategories.$inferSelect;
export type InsertSubcategory = typeof subcategories.$inferInsert;

// Canais de venda
export const salesChannels = mysqlTable("salesChannels", {
  id: int("id").primaryKey().autoincrement(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["BALCAO", "DELIVERY"]).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type SalesChannel = typeof salesChannels.$inferSelect;
export type InsertSalesChannel = typeof salesChannels.$inferInsert;

// Produtos
export const products = mysqlTable("products", {
  id: int("id").primaryKey().autoincrement(),
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
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  eanIdx: index("ean_idx").on(table.ean),
  nameIdx: index("name_idx").on(table.name),
}));

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// Composição de produtos (para packs)
export const productCompositions = mysqlTable("productCompositions", {
  id: int("id").primaryKey().autoincrement(),
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
}));

export type ProductMovement = typeof productMovements.$inferSelect;
export type InsertProductMovement = typeof productMovements.$inferInsert;

// Parceiros (clientes e fornecedores)
export const partners = mysqlTable("partners", {
  id: int("id").primaryKey().autoincrement(),
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
}));

export type Partner = typeof partners.$inferSelect;
export type InsertPartner = typeof partners.$inferInsert;

// Vendas
export const sales = mysqlTable("sales", {
  id: int("id").primaryKey().autoincrement(),
  saleType: mysqlEnum("saleType", ["BALCAO", "DELIVERY", "A_PRAZO"]).notNull(),
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
  purchaseOrderId: int("purchaseOrderId").notNull(),
  installmentNumber: int("installmentNumber").notNull(),
  dueDate: timestamp("dueDate").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paidDate: timestamp("paidDate"),
  status: mysqlEnum("status", ["PENDING", "PAID", "OVERDUE", "CANCELLED"]).default("PENDING").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  poIdx: index("po_idx").on(table.purchaseOrderId),
  dueDateIdx: index("due_date_idx").on(table.dueDate),
}));

export type PurchaseInstallment = typeof purchaseInstallments.$inferSelect;
export type InsertPurchaseInstallment = typeof purchaseInstallments.$inferInsert;



// ============================================
// MÓDULO DE DESPESAS OPERACIONAIS
// ============================================

// Categorias de Despesas
export const expenseCategories = mysqlTable("expenseCategories", {
  id: int("id").primaryKey().autoincrement(),
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
  supplierId: int("supplierId"), // FK para fornecedor (opcional) - PRIMEIRO CAMPO
  purchaseOrderId: int("purchaseOrderId"), // FK para ordem de compra (se origem for Compra)
  docType: mysqlEnum("docType", ["NOTA_FISCAL", "CUPOM"]).notNull(), // Tipo de documento
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
  expenseId: int("expenseId").notNull(),
  installmentNumber: int("installmentNumber").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  paymentDate: timestamp("paymentDate"),
  paymentAmount: decimal("paymentAmount", { precision: 10, scale: 2 }),
  paymentMethod: varchar("paymentMethod", { length: 50 }), // Mesmas formas de Compras
  status: mysqlEnum("status", ["PENDENTE", "PAGO", "VENCIDO", "CANCELADO"]).default("PENDENTE").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  expenseIdx: index("expense_idx").on(table.expenseId),
  dueDateIdx: index("due_date_idx").on(table.dueDate),
  statusIdx: index("status_idx").on(table.status),
}));

export type ExpenseInstallment = typeof expenseInstallments.$inferSelect;
export type InsertExpenseInstallment = typeof expenseInstallments.$inferInsert;


// ==================== CONTAS A RECEBER ====================

// Recebíveis (vinculados às vendas A_PRAZO)
export const receivables = mysqlTable("receivables", {
  id: int("id").primaryKey().autoincrement(),
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
  receivableId: int("receivableId").notNull(),
  installmentNumber: int("installmentNumber").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  paidDate: timestamp("paidDate"),
  paidAmount: decimal("paidAmount", { precision: 10, scale: 2 }),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  status: mysqlEnum("status", ["PENDENTE", "PAGO", "VENCIDO", "PARCIAL"]).default("PENDENTE").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  receivableIdx: index("receivable_idx").on(table.receivableId),
  dueDateIdx: index("due_date_idx").on(table.dueDate),
  statusIdx: index("status_idx").on(table.status),
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
  notes: text("notes"), // Observações
  createdBy: varchar("createdBy", { length: 64 }).notNull(), // Usuário que registrou
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
  notes: text("notes"),
  createdBy: varchar("createdBy", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type CustomerDebit = typeof customerDebits.$inferSelect;
export type InsertCustomerDebit = typeof customerDebits.$inferInsert;


// ==================== METAS DE FATURAMENTO ====================

// Metas mensais de faturamento
export const revenueGoals = mysqlTable("revenueGoals", {
  id: int("id").primaryKey().autoincrement(),
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
  code: varchar("code", { length: 20 }).notNull(),  // Código contábil (ex: "3.2.01.001")
  name: varchar("name", { length: 150 }).notNull(),  // Nome da conta
  parentCode: varchar("parentCode", { length: 20 }),  // Código da conta pai (para hierarquia)
  level: int("level").notNull(),  // Nível na hierarquia (1, 2, 3, 4)
  accountType: mysqlEnum("accountType", [
    "ATIVO",
    "PASSIVO", 
    "PATRIMONIO_LIQUIDO",
    "RECEITA",
    "CUSTO",
    "DESPESA"
  ]).notNull(),
  isAnalytical: boolean("isAnalytical").default(true),  // Conta analítica (permite lançamentos) ou sintética
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  codeIdx: uniqueIndex("chart_code_idx").on(table.code),
  parentIdx: index("parent_idx").on(table.parentCode),
  typeIdx: index("type_idx").on(table.accountType),
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
  saleType: mysqlEnum("saleType", ["BALCAO", "DELIVERY", "A_PRAZO"]),  // NULL = não é receita de venda
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
