import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb, logPriceChange } from "../db";
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
import { getNowInBrazil } from '../../shared/dateUtils';

// Constantes
const IFOOD_CHANNEL_ID = 2; // Canal iFood/Delivery
const IFOOD_CUSTOMER_ID = null; // Sem cliente específico para iFood

/**
 * Normaliza SKU/EAN para garantir consistência na busca
 * - Converte para string
 * - Remove espaços em branco
 * - Mantém zeros à esquerda
 * - Remove caracteres não numéricos (exceto se for SKU alfanumérico)
 */
function normalizeSku(sku: unknown): string {
  if (sku === null || sku === undefined) return '';
  // Converter para string e fazer trim
  let normalized = String(sku).trim();
  // Se for apenas dígitos, manter como está (preserva zeros à esquerda)
  // Se tiver letras, manter como está (SKU alfanumérico)
  return normalized;
}

/**
 * Converte data do iFood (formato "YYYY-MM-DD HH:MM:SS" em horário de Brasília)
 * para um Date UTC correto.
 * 
 * O iFood exporta datas no horário local de Brasília (GMT-3),
 * mas sem indicador de timezone. Se usarmos new Date() diretamente,
 * o Node.js interpreta como timezone do servidor (que pode ser UTC, 
 * America/New_York, etc.), causando deslocamento.
 * 
 * Esta função adiciona explicitamente o offset -03:00 (Brasília)
 * para garantir conversão correta para UTC.
 */
function parseIfoodDate(dateStr: string): Date {
  if (!dateStr) return new Date(); // Fallback: se não tem data, usar UTC atual (raro)
  // Formato esperado: "YYYY-MM-DD HH:MM:SS" ou "YYYY-MM-DDTHH:MM:SS"
  // Normalizar para formato ISO com offset de Brasília
  const normalized = dateStr.trim().replace(' ', 'T');
  // Se já tem offset, usar como está
  if (normalized.includes('+') || normalized.includes('Z') || /T.*-\d{2}:?\d{2}$/.test(normalized)) {
    return new Date(normalized);
  }
  // Adicionar offset de Brasília (GMT-3)
  return new Date(normalized + '-03:00');
}

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
      
      // Incluir products.name no select para que o leftJoin funcione corretamente no Drizzle
      let query = db.select({
        id: ifoodProductMappings.id,
        ifoodSku: ifoodProductMappings.ifoodSku,
        ifoodProductName: ifoodProductMappings.ifoodProductName,
        productId: ifoodProductMappings.productId,
        situation: ifoodProductMappings.situation,
        companyId: ifoodProductMappings.companyId,
        createdBy: ifoodProductMappings.createdBy,
        updatedBy: ifoodProductMappings.updatedBy,
        createdAt: ifoodProductMappings.createdAt,
        updatedAt: ifoodProductMappings.updatedAt,
        productName: products.name,
      }).from(ifoodProductMappings)
        .leftJoin(products, eq(ifoodProductMappings.productId, products.id));
      
      const conditions = [];
      if (input.search) {
        const searchTerm = `%${input.search.toLowerCase()}%`;
        conditions.push(
          sql`(LOWER(${ifoodProductMappings.ifoodProductName}) LIKE ${searchTerm} OR LOWER(${ifoodProductMappings.ifoodSku}) LIKE ${searchTerm} OR LOWER(${products.name}) LIKE ${searchTerm})`
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

      // Contar total
      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(ifoodProductMappings);
      const total = countResult?.count || 0;

      return mappings.map(m => ({
        ...m,
        productName: m.productName || null,
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
      ifoodProductName: z.string().nullable().optional(),
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
      } else {
        // Criar novo
           await db.insert(ifoodProductMappings).values({
          ifoodSku: input.ifoodSku,
          ifoodProductName: input.ifoodProductName || input.ifoodSku,
          productId: input.productId,
          situation: input.situation || "Manual",
          createdBy: ctx.user.id,
          companyId: ctx.activeCompanyId ?? 1,
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
        companyId: ctx.activeCompanyId ?? 1,
      });
      return { success: true };
    }),

  // Atualizar preço do canal iFood
  updateChannelPrice: adminProcedure
    .input(z.object({
      productId: z.number(),
      channelId: z.number(),
      newPrice: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verificar se já existe preço para este produto/canal
      const existing = await db.select()
        .from(productPrices)
        .where(and(
          eq(productPrices.productId, input.productId),
          eq(productPrices.channelId, input.channelId)
        ))
        .limit(1);

      const oldPrice = existing.length > 0 ? existing[0].price?.toString() || '0.00' : '0.00';
      const newPriceStr = input.newPrice.toFixed(2);

      // Se o preço já é o mesmo (ex: já foi corrigido por outro pedido com o mesmo produto),
      // pular a atualização e o registro de auditoria para evitar duplicação
      if (parseFloat(oldPrice) === parseFloat(newPriceStr)) {
        return { success: true, skipped: true, message: 'Preço já está atualizado' };
      }

      if (existing.length > 0) {
        // Atualizar preço existente
        await db.update(productPrices)
          .set({ 
            price: newPriceStr,
            updatedAt: getNowInBrazil()
          })
          .where(and(
            eq(productPrices.productId, input.productId),
            eq(productPrices.channelId, input.channelId)
          ));
      } else {
        // Criar novo preço
        await db.insert(productPrices).values({
          productId: input.productId,
          channelId: input.channelId,
          price: newPriceStr,
          companyId: ctx.activeCompanyId ?? 1,
        });
      }

      // === AUDITORIA: Rastrear alteração de preço via divergência iFood ===
      try {
        await logPriceChange({
          companyId: ctx.activeCompanyId ?? 1,
          branchId: ctx.activeBranchId ?? 1,
          productId: input.productId,
          changeType: 'PRECO_VENDA',
          channelId: input.channelId,
          previousValue: oldPrice,
          newValue: newPriceStr,
          userId: ctx.user?.id || 'system',
          userName: `iFood Divergência (${ctx.user?.name || 'Sistema'})`,
        });
      } catch (e) {
        console.error('[priceHistory] Erro ao registrar alteração de preço via iFood:', e);
      }

      return { success: true, skipped: false };
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

      // Buscar mapeamentos existentes (com normalização de SKU)
      const allSkus = [...new Set(items.map((i: any) => normalizeSku(i.sku)))];
      const mappings = await db.select()
        .from(ifoodProductMappings)
        .where(inArray(ifoodProductMappings.ifoodSku, allSkus));
      // Criar mapa com SKU normalizado como chave
      const mappingsMap = Object.fromEntries(mappings.map(m => [normalizeSku(m.ifoodSku), m]));

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
        // Usar o código do pedido no iFood (número curto que aparece no app)
        const orderCode = order.codigo_do_pedido_no_ifood || orderId.slice(-8, -4).toUpperCase();
        // Suportar ambos os formatos: status_pedido (antigo) ou status (novo)
        const status = order.status_pedido || order.status;
        const orderItems = itemsByOrder[orderId] || [];
        // Calcular total do pedido somando os itens (valor * quantidade)
        const orderTotal = orderItems.reduce((sum: number, item: any) => {
          return sum + (parseFloat(item.valor) || 0) * (parseInt(item.quantidade) || 1);
        }, 0);
        // Usar inicio_da_entrega como data do pedido (formato: YYYY-MM-DD HH:MM:SS)
        const orderDate = order.inicio_da_entrega || order.data_de_finalizacao_do_pedido || order.dt_pedido;
        // Suportar ambos os formatos de forma de pagamento
        const paymentMethod = order.forma_de_pagamento || order.forma_pgto;

        // Ignorar pedidos sem itens
        if (orderItems.length === 0) {
          categorized.cancelled.push({
            ifoodOrderId: orderId,
            ifoodOrderCode: orderCode,
            orderDate: orderDate,
            totalValue: 0,
            status: "cancelled" as const,
            items: [],
          });
          continue;
        }

        // Ignorar cancelados
        if (status === "CANCELLED" || status === "DECLINED") {
          categorized.cancelled.push({
            ifoodOrderId: orderId,
            ifoodOrderCode: orderCode,
            orderDate: orderDate,
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
            orderDate: orderDate,
            totalValue: orderTotal,
            status: "already_imported" as const,
            items: [],
          });
          continue;
        }

        // Verificar itens
        let hasUnmapped = false;
        let hasDivergence = false;
        const processedItems: any[] = [];

        for (const item of orderItems) {
          // Normalizar SKU para busca consistente
          const sku = normalizeSku(item.sku);
          const mapping = mappingsMap[sku];
          const ifoodPrice = parseFloat(item.valor) || 0;
          const quantity = parseInt(item.quantidade) || 1;

          if (!mapping || !mapping.productId) {
            // Sem mapeamento ou mapeamento sem productId = não localizado
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
            // Buscar preço do canal iFood
            const abrwfPrice = pricesMap[mapping.productId];
            
            // Se não tem preço cadastrado no canal iFood, tratar como divergência
            const hasNoPrice = abrwfPrice === undefined || abrwfPrice === null;
            
            // Calcular divergência com tolerância absoluta (> R$ 0.01)
            let divergencePercent = 0;
            let hasPriceDivergence = false;
            
            if (hasNoPrice) {
              // Sem preço cadastrado = divergência (alerta)
              hasPriceDivergence = true;
              divergencePercent = 100; // Indicar que não tem preço de referência
            } else {
              // Calcular diferença absoluta
              const priceDiff = Math.abs(ifoodPrice - abrwfPrice);
              hasPriceDivergence = priceDiff > 0.01; // Tolerância de R$ 0.01
              
              if (abrwfPrice > 0) {
                divergencePercent = ((ifoodPrice - abrwfPrice) / abrwfPrice) * 100;
              }
            }
            
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
              abrwfPrice: hasNoPrice ? null : abrwfPrice,
              hasPriceDivergence: hasPriceDivergence,
              divergencePercent: divergencePercent,
              isMapped: true,
              hasNoPrice: hasNoPrice, // Flag para indicar que não tem preço cadastrado
            });
          }
        }

        const orderData = {
          ifoodOrderId: orderId,
          ifoodOrderCode: orderCode,
          orderDate: orderDate,
          totalValue: orderTotal,
          paymentMethod: paymentMethod,
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
      // NÃO incluir pedidos cancelados na lista - eles não devem aparecer na tela
      const allOrders = [
        ...categorized.ready,
        ...categorized.divergent,
        ...categorized.unmapped,
        ...categorized.alreadyImported,
        // categorized.cancelled - NÃO incluir pedidos cancelados
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
      const now = getNowInBrazil();
      let logId: number;
      
      try {
        const logResult = await db.insert(ifoodImportLogs).values({
          importedAt: now,
          ordersFileName: "upload",
          itemsFileName: "upload",
          totalOrders: input.orders.length,
          importedOrders: 0,
          skippedOrders: 0,
          ordersWithDivergence: 0,
          totalValue: "0.00",
          status: "PROCESSING",
          errorMessage: null,
          createdBy: ctx.user.id,
          companyId: ctx.activeCompanyId ?? 1,
        });
        
        // Drizzle com MySQL retorna um array com o resultado do insert
        // O insertId pode estar em logResult[0].insertId ou logResult.insertId
        if (Array.isArray(logResult) && logResult.length > 0) {
          logId = (logResult[0] as any).insertId;
        } else {
          logId = (logResult as any).insertId;
        }
        
        if (!logId) {
          throw new Error("Falha ao obter ID do log de importação");
        }
      } catch (insertError: any) {
        console.error("[ifoodImport] Erro ao criar log de importação:", {
          message: insertError.message,
          code: insertError.code,
          errno: insertError.errno,
          sqlMessage: insertError.sqlMessage,
          sql: insertError.sql,
        });
        throw new Error(`Erro ao criar log de importação: ${insertError.sqlMessage || insertError.message}`);
      }

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
          const companyId = ctx.activeCompanyId ?? 1;
          const branchId = ctx.activeBranchId ?? 1;
          const [saleResult] = await db.insert(sales).values({
            saleType: "DELIVERY",
            saleDate: parseIfoodDate(order.orderDate),
            customerId: IFOOD_CUSTOMER_ID,
            channelId: IFOOD_CHANNEL_ID,
            platformOrderId: order.ifoodOrderCode,
            subtotal: subtotal.toFixed(2),
            discountAmount: "0.00",
            surchargeAmount: "0.00",
            finalAmount: subtotal.toFixed(2),
            paymentMethod: "Pago na Plataforma",
            notes: `Importado iFood - Pedido #${order.ifoodOrderCode}`,
            status: "ACTIVE",
            createdBy: ctx.user.id,
            companyId,
            branchId,
          });
          const saleId = saleResult.insertId;

          // Criar itens da venda
          for (const item of order.items) {
            // Validar se o item tem productId válido
            if (!item.productId) {
              throw new Error(`Produto "${item.ifoodProductName}" não está mapeado no De/Para`);
            }

            await db.insert(saleItems).values({
              saleId,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.ifoodPrice.toFixed(2),
              totalPrice: (item.ifoodPrice * item.quantity).toFixed(2),
              companyId,
            });

            // Baixar estoque
            await db.insert(productMovements).values({
              productId: item.productId,
              date: parseIfoodDate(order.orderDate),
              type: "SAIDA",
              quantity: (-item.quantity).toString(),
              documentNumber: `IFOOD-${order.ifoodOrderCode}`,
              userId: ctx.user.id,
              notes: `Venda iFood #${order.ifoodOrderCode}`,
              companyId,
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
                companyId,
              });
            }
          }

          // Registrar pedido importado
          await db.insert(ifoodImportedOrders).values({
            ifoodOrderId: order.ifoodOrderId,
            ifoodOrderCode: order.ifoodOrderCode,
            saleId,
            importLogId: logId,
            companyId,
          });

          importedCount++;
          totalValue += subtotal;
        } catch (error: any) {
          errors.push(`Pedido ${order.ifoodOrderCode}: ${error.message}`);
        }
      }

      // Atualizar log
      // Determinar status: SUCCESS (todos importados), PARTIAL (alguns importados), ERROR (nenhum importado)
      let finalStatus: "SUCCESS" | "PARTIAL" | "ERROR" = "SUCCESS";
      if (errors.length > 0) {
        finalStatus = importedCount > 0 ? "PARTIAL" : "ERROR";
      }
      
      await db.update(ifoodImportLogs)
        .set({
          importedOrders: importedCount,
          skippedOrders: input.orders.length - importedCount,
          totalValue: totalValue.toFixed(2),
          status: finalStatus,
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

  // Excluir importação (reverter vendas, itens, movimentações e registros)
  deleteImport: adminProcedure
    .input(z.object({ logId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar log de importação
      const [log] = await db.select()
        .from(ifoodImportLogs)
        .where(eq(ifoodImportLogs.id, input.logId))
        .limit(1);

      if (!log) {
        throw new Error("Log de importação não encontrado");
      }

      // Buscar pedidos importados
      const importedOrders = await db.select()
        .from(ifoodImportedOrders)
        .where(eq(ifoodImportedOrders.importLogId, input.logId));

      if (importedOrders.length === 0) {
        // Apenas excluir o log se não houver pedidos
        await db.delete(ifoodImportLogs)
          .where(eq(ifoodImportLogs.id, input.logId));
        return { success: true, deletedOrders: 0 };
      }

      let deletedCount = 0;

      for (const order of importedOrders) {
        if (order.saleId) {
          // Buscar itens da venda para reverter estoque
          const items = await db.select()
            .from(saleItems)
            .where(eq(saleItems.saleId, order.saleId));

          // Reverter estoque de cada item
          for (const item of items) {
            // Atualizar estoque do produto (adicionar de volta)
            await db.update(products)
              .set({
                currentStock: sql`${products.currentStock} + ${item.quantity}`,
              })
              .where(eq(products.id, item.productId));

            // Excluir movimentação de estoque relacionada
            await db.delete(productMovements)
              .where(and(
                eq(productMovements.productId, item.productId),
                like(productMovements.documentNumber, `IFOOD-${order.ifoodOrderCode}%`)
              ));
          }

          // Excluir itens da venda
          await db.delete(saleItems)
            .where(eq(saleItems.saleId, order.saleId));

          // Excluir venda
          await db.delete(sales)
            .where(eq(sales.id, order.saleId));
        }

        deletedCount++;
      }

      // Excluir divergências de preço relacionadas
      await db.delete(ifoodPriceDivergences)
        .where(eq(ifoodPriceDivergences.importLogId, input.logId));

      // Excluir pedidos importados
      await db.delete(ifoodImportedOrders)
        .where(eq(ifoodImportedOrders.importLogId, input.logId));

      // Excluir log de importação
      await db.delete(ifoodImportLogs)
        .where(eq(ifoodImportLogs.id, input.logId));

      return { success: true, deletedOrders: deletedCount };
    }),
});
