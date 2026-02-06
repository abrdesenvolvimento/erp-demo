# Documentação Completa - Importador iFood

## Problema Atual
Na versão anterior, todos os itens dos pedidos estavam sendo localizados corretamente e havia apenas divergência de valor. Agora, muitos produtos estão aparecendo como "Produto não localizado" quando não deveriam.

---

## 1. Backend - Router (server/routers/ifoodImport.ts)

```typescript
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { 
  ifoodProductMappings, 
  ifoodImportLogs, 
  ifoodImportedOrders, 
  ifoodPriceDivergences,
  products,
  productPrices,
  sales,
  saleItems,
  productMovements
} from "../../drizzle/schema";
import { eq, like, and, sql, desc, inArray } from "drizzle-orm";

// Constantes
const IFOOD_CHANNEL_ID = 2; // Canal iFood/Delivery
const IFOOD_CUSTOMER_ID = null; // Sem cliente específico para iFood

export const ifoodImportRouter = router({
  // Listar mapeamentos De/Para (alias para compatibilidade com frontend)
  listMappings: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      onlyUnmapped: z.boolean().optional(),
      page: z.number().default(1),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;
      
      let query = db.select().from(ifoodProductMappings);
      
      const conditions = [];
      if (input.search) {
        conditions.push(
          sql`(${ifoodProductMappings.ifoodProductName} LIKE ${`%${input.search}%`} OR ${ifoodProductMappings.ifoodSku} LIKE ${`%${input.search}%`})`
        );
      }
      if (input.onlyUnmapped) {
        conditions.push(sql`${ifoodProductMappings.productId} IS NULL`);
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const mappings = await query
        .orderBy(ifoodProductMappings.ifoodProductName)
        .limit(input.limit)
        .offset(offset);

      // Buscar nomes dos produtos vinculados
      const productIds = mappings.filter(m => m.productId).map(m => m.productId!);
      let productsMap: Record<number, string> = {};
      
      if (productIds.length > 0) {
        const prods = await db.select({ id: products.id, name: products.name })
          .from(products)
          .where(inArray(products.id, productIds));
        productsMap = Object.fromEntries(prods.map(p => [p.id, p.name]));
      }

      // Contar total
      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(ifoodProductMappings);
      const total = countResult?.count || 0;

      return mappings.map(m => ({
        ...m,
        productName: m.productId ? productsMap[m.productId] : null,
      }));
    }),

  // Buscar produtos para vincular
  searchProducts: protectedProcedure
    .input(z.object({ search: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const searchTerm = `%${input.search}%`;
      
      const prods = await db.select({
        id: products.id,
        name: products.name,
        ean: products.ean,
        avgCost: products.avgCost,
      })
      .from(products)
      .where(and(
        eq(products.active, true),
        sql`(LOWER(${products.name}) LIKE LOWER(${searchTerm}) OR ${products.ean} LIKE ${searchTerm})`
      ))
      .limit(20);

      // Buscar preços do canal iFood para cada produto
      const productIds = prods.map(p => p.id);
      let pricesMap: Record<number, string> = {};
      
      if (productIds.length > 0) {
        const prices = await db.select({
          productId: productPrices.productId,
          price: productPrices.price,
        })
        .from(productPrices)
        .where(and(
          inArray(productPrices.productId, productIds),
          eq(productPrices.channelId, IFOOD_CHANNEL_ID)
        ));
        pricesMap = Object.fromEntries(prices.map(p => [p.productId, p.price]));
      }

      return prods.map(p => ({
        ...p,
        salePrice: pricesMap[p.id] || p.avgCost,
      }));
    }),

  // Atualizar mapeamento
  updateMapping: adminProcedure
    .input(z.object({
      id: z.number().optional(),
      ifoodSku: z.string(),
      ifoodProductName: z.string().optional(),
      productId: z.number().nullable(),
      situation: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verificar se o mapeamento existe pelo SKU
      const [existing] = await db.select()
        .from(ifoodProductMappings)
        .where(eq(ifoodProductMappings.ifoodSku, input.ifoodSku))
        .limit(1);

      if (existing) {
        // Atualizar existente
        await db.update(ifoodProductMappings)
          .set({
            productId: input.productId,
            situation: input.situation || existing.situation,
            updatedBy: ctx.user.id,
          })
          .where(eq(ifoodProductMappings.ifoodSku, input.ifoodSku));
      } else if (input.ifoodProductName) {
        // Criar novo
        await db.insert(ifoodProductMappings).values({
          ifoodSku: input.ifoodSku,
          ifoodProductName: input.ifoodProductName,
          productId: input.productId,
          situation: input.situation || "Manual",
          createdBy: ctx.user.id,
        });
      }

      return { success: true };
    }),

  // Criar novo mapeamento
  createMapping: adminProcedure
    .input(z.object({
      ifoodSku: z.string(),
      ifoodProductName: z.string(),
      productId: z.number().nullable(),
      situation: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.insert(ifoodProductMappings).values({
        ifoodSku: input.ifoodSku,
        ifoodProductName: input.ifoodProductName,
        productId: input.productId,
        situation: input.situation || "Manual",
        createdBy: ctx.user.id,
      });

      return { success: true };
    }),

  // Processar arquivos JSON do iFood
  processFiles: adminProcedure
    .input(z.object({
      ordersJson: z.string(),
      itemsJson: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Parse dos JSONs - suporta tanto array quanto NDJSON (Newline Delimited JSON)
      const parseJsonOrNdjson = (jsonStr: string): any[] => {
        const trimmed = jsonStr.trim();
        // Se começa com [, é um array JSON normal
        if (trimmed.startsWith('[')) {
          return JSON.parse(trimmed);
        }
        // Caso contrário, tenta NDJSON (uma linha por objeto)
        const lines = trimmed.split('\n').filter(line => line.trim());
        return lines.map(line => JSON.parse(line.trim()));
      };

      const orders = parseJsonOrNdjson(input.ordersJson);
      const items = parseJsonOrNdjson(input.itemsJson);

      // Criar mapa de itens por pedido
      const itemsByOrder: Record<string, any[]> = {};
      for (const item of items) {
        const orderId = item.id_pedido_ifood;
        if (!itemsByOrder[orderId]) {
          itemsByOrder[orderId] = [];
        }
        itemsByOrder[orderId].push(item);
      }

      // Buscar pedidos já importados
      const orderIds = orders.map((o: any) => o.id_pedido_ifood);
      const importedOrders = await db.select({ ifoodOrderId: ifoodImportedOrders.ifoodOrderId })
        .from(ifoodImportedOrders)
        .where(inArray(ifoodImportedOrders.ifoodOrderId, orderIds));
      const importedSet = new Set(importedOrders.map(o => o.ifoodOrderId));

      // Buscar mapeamentos existentes
      const allSkus = [...new Set(items.map((i: any) => i.sku))];
      const mappings = await db.select()
        .from(ifoodProductMappings)
        .where(inArray(ifoodProductMappings.ifoodSku, allSkus));
      const mappingsMap = Object.fromEntries(mappings.map(m => [m.ifoodSku, m]));

      // Buscar preços do canal iFood e nomes dos produtos
      const productIds = mappings.filter(m => m.productId).map(m => m.productId!);
      let pricesMap: Record<number, number> = {};
      let productNamesMap: Record<number, string> = {};
      
      if (productIds.length > 0) {
        const prices = await db.select({
          productId: productPrices.productId,
          price: productPrices.price,
        })
        .from(productPrices)
        .where(and(
          inArray(productPrices.productId, productIds),
          eq(productPrices.channelId, IFOOD_CHANNEL_ID)
        ));
        pricesMap = Object.fromEntries(prices.map(p => [p.productId, parseFloat(p.price)]));

        // Buscar nomes dos produtos
        const prods = await db.select({ id: products.id, name: products.name })
          .from(products)
          .where(inArray(products.id, productIds));
        productNamesMap = Object.fromEntries(prods.map(p => [p.id, p.name]));
      }

      // Processar pedidos
      const categorized = {
        ready: [] as any[],
        unmapped: [] as any[],
        divergent: [] as any[],
        alreadyImported: [] as any[],
        cancelled: [] as any[],
      };

      let totalValueReady = 0;

      for (const order of orders) {
        const orderId = order.id_pedido_ifood;
        const orderCode = order.id_pedido_curto || orderId.substring(0, 8);
        const status = order.status_pedido;
        const orderItems = itemsByOrder[orderId] || [];
        const orderTotal = parseFloat(order.valor_total_dos_itens) || 0;

        // Ignorar cancelados
        if (status === "CANCELLED" || status === "DECLINED") {
          categorized.cancelled.push({
            ifoodOrderId: orderId,
            ifoodOrderCode: orderCode,
            orderDate: order.data_de_finalizacao_do_pedido,
            totalValue: orderTotal,
            status: "cancelled" as const,
            items: [],
          });
          continue;
        }

        // Verificar se já foi importado
        if (importedSet.has(orderId)) {
          categorized.alreadyImported.push({
            ifoodOrderId: orderId,
            ifoodOrderCode: orderCode,
            orderDate: order.data_de_finalizacao_do_pedido,
            totalValue: orderTotal,
            items: [],
          });
          continue;
        }

        // Verificar itens
        let hasUnmapped = false;
        let hasDivergence = false;
        const processedItems: any[] = [];

        for (const item of orderItems) {
          const sku = item.sku;
          const mapping = mappingsMap[sku];
          const ifoodPrice = parseFloat(item.valor) || 0;
          const quantity = parseInt(item.quantidade) || 1;

          if (!mapping || !mapping.productId) {
            hasUnmapped = true;
            processedItems.push({
              ifoodSku: sku,
              ifoodProductName: item.produto,
              quantity: quantity,
              ifoodPrice: ifoodPrice,
              productId: null,
              productName: null,
              abrwfPrice: null,
              hasPriceDivergence: false,
              divergencePercent: null,
              isMapped: false,
            });
          } else {
            const abrwfPrice = pricesMap[mapping.productId] || 0;
            const divergencePercent = abrwfPrice > 0 
              ? ((ifoodPrice - abrwfPrice) / abrwfPrice * 100) 
              : 0;
            const hasPriceDivergence = Math.abs(divergencePercent) > 1; // Mais de 1% de divergência
            
            if (hasPriceDivergence) {
              hasDivergence = true;
            }

            processedItems.push({
              ifoodSku: sku,
              ifoodProductName: item.produto,
              quantity: quantity,
              ifoodPrice: ifoodPrice,
              productId: mapping.productId,
              productName: productNamesMap[mapping.productId] || null,
              abrwfPrice: abrwfPrice,
              hasPriceDivergence: hasPriceDivergence,
              divergencePercent: divergencePercent,
              isMapped: true,
            });
          }
        }

        const orderData = {
          ifoodOrderId: orderId,
          ifoodOrderCode: orderCode,
          orderDate: order.data_de_finalizacao_do_pedido,
          totalValue: orderTotal,
          paymentMethod: order.forma_de_pagamento,
          items: processedItems,
          issues: [] as string[],
        };

        if (hasUnmapped) {
          const unmappedItems = processedItems.filter(i => !i.isMapped);
          orderData.issues = unmappedItems.map(i => `Produto não mapeado: ${i.ifoodProductName}`);
          categorized.unmapped.push({ ...orderData, status: "missing_product" as const });
        } else if (hasDivergence) {
          const divergentItems = processedItems.filter(i => i.hasPriceDivergence);
          orderData.issues = divergentItems.map(i => 
            `Divergência de preço: ${i.ifoodProductName} (iFood: R$${i.ifoodPrice.toFixed(2)} vs ABRWF: R$${i.abrwfPrice?.toFixed(2)})`
          );
          categorized.divergent.push({ ...orderData, status: "price_divergence" as const });
          totalValueReady += orderTotal;
        } else {
          categorized.ready.push({ ...orderData, status: "ready" as const });
          totalValueReady += orderTotal;
        }
      }

      // Montar resposta no formato esperado pelo frontend
      const allOrders = [
        ...categorized.ready,
        ...categorized.divergent,
        ...categorized.unmapped,
        ...categorized.alreadyImported,
        ...categorized.cancelled,
      ];

      return {
        orders: allOrders,
        summary: {
          totalOrders: orders.length,
          readyCount: categorized.ready.length,
          priceDivergenceCount: categorized.divergent.length,
          missingProductCount: categorized.unmapped.length,
          skippedCount: categorized.alreadyImported.length + categorized.cancelled.length,
          totalValue: totalValueReady,
        },
      };
    }),

  // Importar pedidos selecionados
  importOrders: adminProcedure
    .input(z.object({
      orders: z.array(z.object({
        ifoodOrderId: z.string(),
        ifoodOrderCode: z.string(),
        orderDate: z.string(),
        totalValue: z.number(),
        paymentMethod: z.string().optional(),
        items: z.array(z.object({
          ifoodSku: z.string(),
          ifoodProductName: z.string(),
          quantity: z.number(),
          ifoodPrice: z.number(),
          productId: z.number().nullable(),
          productName: z.string().nullable().optional(),
          abrwfPrice: z.number().nullable().optional(),
          hasPriceDivergence: z.boolean().optional(),
          divergencePercent: z.number().nullable().optional(),
          isMapped: z.boolean().optional(),
        })),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Criar log de importação
      const [logResult] = await db.insert(ifoodImportLogs).values({
        totalOrders: input.orders.length,
        importedOrders: 0,
        skippedOrders: 0,
        totalValue: "0",
        status: "SUCCESS",
        createdBy: ctx.user.id,
      });
      const logId = logResult.insertId;

      let importedCount = 0;
      let totalValue = 0;
      const errors: string[] = [];

      for (const order of input.orders) {
        try {
          // Verificar se já foi importado
          const [existing] = await db.select()
            .from(ifoodImportedOrders)
            .where(eq(ifoodImportedOrders.ifoodOrderId, order.ifoodOrderId))
            .limit(1);

          if (existing) {
            continue; // Pular se já importado
          }

          // Calcular totais
          const subtotal = order.items.reduce((sum, item) => sum + (item.ifoodPrice * item.quantity), 0);

          // Criar venda
          const [saleResult] = await db.insert(sales).values({
            saleType: "DELIVERY",
            saleDate: new Date(order.orderDate),
            customerId: IFOOD_CUSTOMER_ID,
            channelId: IFOOD_CHANNEL_ID,
            platformOrderId: order.ifoodOrderId,
            subtotal: subtotal.toFixed(2),
            discountAmount: "0.00",
            surchargeAmount: "0.00",
            finalAmount: subtotal.toFixed(2),
            paymentMethod: "Pago na Plataforma",
            notes: `Importado iFood - Pedido #${order.ifoodOrderCode}`,
            status: "ACTIVE",
            createdBy: ctx.user.id,
          });
          const saleId = saleResult.insertId;

          // Criar itens da venda
          for (const item of order.items) {
            await db.insert(saleItems).values({
              saleId,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.ifoodPrice.toFixed(2),
              totalPrice: (item.ifoodPrice * item.quantity).toFixed(2),
            });

            // Baixar estoque
            await db.insert(productMovements).values({
              productId: item.productId,
              date: new Date(order.orderDate),
              type: "SAIDA",
              quantity: (-item.quantity).toString(),
              documentNumber: `IFOOD-${order.ifoodOrderCode}`,
              userId: ctx.user.id,
              notes: `Venda iFood #${order.ifoodOrderCode}`,
            });

            // Atualizar estoque do produto
            await db.update(products)
              .set({
                currentStock: sql`${products.currentStock} - ${item.quantity}`,
              })
              .where(eq(products.id, item.productId));

            // Registrar divergência de preço se houver
            if (item.hasPriceDivergence && item.abrwfPrice) {
              await db.insert(ifoodPriceDivergences).values({
                ifoodOrderId: order.ifoodOrderId,
                productId: item.productId,
                ifoodPrice: item.ifoodPrice.toFixed(2),
                abrwfPrice: item.abrwfPrice.toFixed(2),
                divergencePercent: item.divergencePercent?.toFixed(2) || "0",
              });
            }
          }

          // Registrar pedido importado
          await db.insert(ifoodImportedOrders).values({
            ifoodOrderId: order.ifoodOrderId,
            ifoodOrderCode: order.ifoodOrderCode,
            saleId,
            importLogId: logId,
          });

          importedCount++;
          totalValue += subtotal;
        } catch (error: any) {
          errors.push(`Pedido ${order.ifoodOrderCode}: ${error.message}`);
        }
      }

      // Atualizar log
      await db.update(ifoodImportLogs)
        .set({
          importedOrders: importedCount,
          skippedOrders: input.orders.length - importedCount,
          totalValue: totalValue.toFixed(2),
          status: errors.length > 0 ? "PARTIAL" : "SUCCESS",
          errorMessage: errors.length > 0 ? errors.join("; ") : null,
        })
        .where(eq(ifoodImportLogs.id, logId));

      return {
        success: true,
        importedCount,
        skipped: input.orders.length - importedCount,
        totalValue,
        errors,
      };
    }),

  // Listar histórico de importações (alias para compatibilidade com frontend)
  listImportHistory: adminProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;

      const logs = await db.select()
        .from(ifoodImportLogs)
        .orderBy(desc(ifoodImportLogs.importedAt))
        .limit(input.limit)
        .offset(offset);

      return logs;
    }),

  // Buscar detalhes de uma importação
  getImportDetails: adminProcedure
    .input(z.object({ logId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [log] = await db.select()
        .from(ifoodImportLogs)
        .where(eq(ifoodImportLogs.id, input.logId))
        .limit(1);

      if (!log) {
        throw new Error("Log não encontrado");
      }

      const orders = await db.select()
        .from(ifoodImportedOrders)
        .where(eq(ifoodImportedOrders.importLogId, input.logId));

      return {
        log,
        orders,
      };
    }),
});
```

---

## 2. Schema do Banco de Dados (drizzle/schema.ts - tabelas relevantes)

```typescript
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

// Log de Importações iFood
export const ifoodImportLogs = mysqlTable("ifoodImportLogs", {
  id: int("id").primaryKey().autoincrement(),
  importedAt: timestamp("importedAt").defaultNow(),
  ordersFileName: varchar("ordersFileName", { length: 255 }),
  itemsFileName: varchar("itemsFileName", { length: 255 }),
  totalOrders: int("totalOrders").default(0),
  importedOrders: int("importedOrders").default(0),
  skippedOrders: int("skippedOrders").default(0),
  totalValue: decimal("totalValue", { precision: 15, scale: 2 }),
  status: mysqlEnum("status", ["SUCCESS", "PARTIAL", "FAILED"]).default("SUCCESS"),
  errorMessage: text("errorMessage"),
  createdBy: varchar("createdBy", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

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
```

---

## 3. Estrutura dos Arquivos JSON do iFood

### VendasePedidos.json
```json
{
  "id_pedido_ifood": "f7d52294-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "id_pedido_curto": "f7d52294",
  "status_pedido": "CONCLUDED",
  "data_de_finalizacao_do_pedido": "2026-02-02T00:00:00",
  "valor_total_dos_itens": "75.06",
  "forma_de_pagamento": "PIX"
}
```

### ItensporPedido.json
```json
{
  "id_pedido_ifood": "f7d52294-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "sku": "7891234567890",
  "produto": "Cerveja Brahma 350ml",
  "quantidade": "6",
  "valor": "5.99"
}
```

---

## 4. Fluxo de Processamento

1. **Upload dos arquivos**: Usuário faz upload dos 2 arquivos JSON
2. **Processamento**: Backend processa os arquivos e:
   - Agrupa itens por pedido
   - Busca mapeamentos existentes na tabela `ifoodProductMappings` pelo SKU
   - Busca preços do canal iFood (channelId = 2) na tabela `productPrices`
   - Categoriza pedidos em: ready, unmapped, divergent, alreadyImported, cancelled
3. **Preview**: Frontend exibe resumo e lista de pedidos
4. **Importação**: Usuário seleciona pedidos e importa

---

## 5. Problema Identificado

Na versão anterior, os produtos estavam sendo localizados corretamente pelo SKU na tabela `ifoodProductMappings`. Agora, 14 dos 20 pedidos estão aparecendo como "Produto não localizado", quando antes funcionavam.

**Possíveis causas:**
1. Os mapeamentos foram perdidos ou alterados na tabela `ifoodProductMappings`
2. O campo `ifoodSku` não está correspondendo ao campo `sku` do arquivo JSON
3. Alguma alteração no código de busca de mapeamentos

**Verificar:**
- Conteúdo da tabela `ifoodProductMappings`
- Se os SKUs dos arquivos JSON correspondem aos SKUs cadastrados
- Se o campo `productId` está preenchido nos mapeamentos


---

## 6. Dados do Banco de Dados (Verificação Atual)

### SKUs do arquivo de teste vs mapeamentos existentes

**SKUs no arquivo ItensporPedido-Teste.json:**
```
7892021040713, 7891991303347, 7894900061512, 7891991295086, 70847033301, 
7622210673831, 7896010002362, 7896045505319, 7804300123512, 7891149102808,
7894900027013, 7622210674050, 7894900701609, 9002490264093, 7896855901431,
7804300121853, 99958853, 9002490100049, 70847022015, 7896855901417,
7891149105564, 7898605254132, 7894900011159, 7897395099329, 7894900701517
```

**Consulta realizada:**
```sql
SELECT ifoodSku, ifoodProductName, productId, situation 
FROM ifoodProductMappings 
WHERE ifoodSku IN ('7892021040713', '7891991303347', '7894900061512', ...);
```

**Resultado:** 9 mapeamentos encontrados dos 10 SKUs consultados

### Contagem de mapeamentos
```sql
SELECT 
  COUNT(*) as total_mapeamentos,
  SUM(CASE WHEN productId IS NOT NULL THEN 1 ELSE 0 END) as com_produto_vinculado,
  SUM(CASE WHEN productId IS NULL THEN 1 ELSE 0 END) as sem_produto_vinculado
FROM ifoodProductMappings;
```

---

## 7. Hipóteses para o Problema

1. **Mapeamentos sem productId**: Alguns mapeamentos podem existir na tabela mas com `productId = NULL`
2. **SKUs não cadastrados**: Alguns SKUs do arquivo podem não estar cadastrados na tabela de mapeamentos
3. **Diferença de formato**: O SKU pode estar com formato diferente (espaços, zeros à esquerda, etc.)

---

## 8. Ações Sugeridas

1. Verificar se todos os SKUs únicos do arquivo de teste existem na tabela `ifoodProductMappings`
2. Verificar se os mapeamentos existentes têm `productId` preenchido
3. Comparar com a versão anterior do código para identificar mudanças na lógica de busca
