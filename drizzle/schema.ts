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
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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
  quantity: int("quantity").notNull(),
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

// Parceiros (clientes e fornecedores)
export const partners = mysqlTable("partners", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 200 }).notNull(),
  docNumber: varchar("docNumber", { length: 20 }),
  partnerType: mysqlEnum("partnerType", ["CUSTOMER", "SUPPLIER", "BOTH"]).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  address: text("address"),
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
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  dateIdx: index("date_idx").on(table.saleDate),
  customerIdx: index("customer_idx").on(table.customerId),
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

