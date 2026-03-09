import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb, createSale } from "../db";
import {
  salonTables,
  salonOrders,
  salonOrderItems,
  salonOrderPayments,
  salonConfig,
  waiterCheckIns,
  products,
  productPrices,
  salesChannels,
  userCompanies,
  users,
} from "../../drizzle/schema";
import { eq, and, or, inArray, gte, lte, lt, sql, isNull } from "drizzle-orm";
import { getNowInBrazil } from "../../shared/dateUtils";
import { sendPushToCompany, savePushSubscription, removePushSubscription } from "../webPush";
import { pushSubscriptions } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";

// Throttle: avoid spamming admin with check-in notifications (max once per 10min per waiter)
const waiterNotifyThrottle = new Map<string, number>();
const NOTIFY_THROTTLE_MS = 10 * 60 * 1000; // 10 minutes

function shouldNotifyAdmin(waiterId: string, companyId: number): boolean {
  const key = `${companyId}:${waiterId}`;
  const lastNotified = waiterNotifyThrottle.get(key) || 0;
  const now = Date.now();
  if (now - lastNotified < NOTIFY_THROTTLE_MS) return false;
  waiterNotifyThrottle.set(key, now);
  return true;
}

// ==================== CONFIGURAÇÕES DO SALÃO ==

export const salonRouter = router({

  // --- Config ---
  getConfig: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [config] = await db
        .select()
        .from(salonConfig)
        .where(eq(salonConfig.companyId, input.companyId))
        .limit(1);
      return config ?? null;
    }),

  saveConfig: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      defaultTipPercent: z.number().min(0).max(100),
      tipEnabled: z.boolean(),
      gratuityLabel: z.string().max(100),
      kitchenLabel: z.string().max(100).optional().default("Cozinha"),
      barLabel: z.string().max(100).optional().default("Bar"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .insert(salonConfig)
        .values({
          companyId: input.companyId,
          defaultTipPercent: String(input.defaultTipPercent),
          tipEnabled: input.tipEnabled,
          gratuityLabel: input.gratuityLabel,
          kitchenLabel: input.kitchenLabel,
          barLabel: input.barLabel,
        })
        .onDuplicateKeyUpdate({
          set: {
            defaultTipPercent: String(input.defaultTipPercent),
            tipEnabled: input.tipEnabled,
            gratuityLabel: input.gratuityLabel,
            kitchenLabel: input.kitchenLabel,
            barLabel: input.barLabel,
          },
        });
      return { success: true };
    }),

  // --- Mesas ---
  listTables: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const tables = await db
        .select()
        .from(salonTables)
        .where(and(eq(salonTables.companyId, input.companyId), eq(salonTables.active, true)))
        .orderBy(salonTables.number);

      // For each occupied table, get the active order
      const occupiedTableIds = tables
        .filter(t => t.status !== "FREE")
        .map(t => t.id);

      let activeOrders: Array<{ tableId: number; id: number; guestCount: number; totalAmount: string | null; openedAt: Date | null; waiterName: string | null; status: string }> = [];
      if (occupiedTableIds.length > 0) {
        activeOrders = await db
          .select({
            tableId: salonOrders.tableId,
            id: salonOrders.id,
            guestCount: salonOrders.guestCount,
            totalAmount: salonOrders.totalAmount,
            openedAt: salonOrders.openedAt,
            waiterName: salonOrders.waiterName,
            status: salonOrders.status,
          })
          .from(salonOrders)
          .where(
            and(
              inArray(salonOrders.tableId, occupiedTableIds),
              inArray(salonOrders.status, ["OPEN", "WAITING_PAYMENT"])
            )
          );
      }

      // Count ready items per order for notification badges
      const orderIds = activeOrders.map(o => o.id);
      let readyCountByOrder = new Map<number, number>();
      if (orderIds.length > 0) {
        const readyCounts = await db
          .select({
            orderId: salonOrderItems.orderId,
            count: sql<number>`COUNT(*)`,
          })
          .from(salonOrderItems)
          .where(
            and(
              inArray(salonOrderItems.orderId, orderIds),
              eq(salonOrderItems.status, "READY")
            )
          )
          .groupBy(salonOrderItems.orderId);
        readyCountByOrder = new Map(readyCounts.map(r => [r.orderId, Number(r.count)]));
      }

      const ordersByTable = new Map(activeOrders.map(o => [o.tableId, { ...o, readyItems: readyCountByOrder.get(o.id) ?? 0 }]));

      return tables.map(t => ({
        ...t,
        activeOrder: ordersByTable.get(t.id) ?? null,
      }));
    }),

  createTable: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      number: z.number().min(1),
      name: z.string().optional(),
      capacity: z.number().min(1).default(4),
      positionX: z.number().default(0),
      positionY: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(salonTables).values({
        companyId: input.companyId,
        number: input.number,
        name: input.name,
        capacity: input.capacity,
        positionX: input.positionX,
        positionY: input.positionY,
      });
      return { id: (result as any).insertId };
    }),

  updateTable: protectedProcedure
    .input(z.object({
      id: z.number(),
      companyId: z.number(),
      number: z.number().min(1).optional(),
      name: z.string().optional(),
      capacity: z.number().min(1).optional(),
      positionX: z.number().optional(),
      positionY: z.number().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, companyId, ...updates } = input;
      await db
        .update(salonTables)
        .set(updates)
        .where(and(eq(salonTables.id, id), eq(salonTables.companyId, companyId)));
      return { success: true };
    }),

  deleteTable: protectedProcedure
    .input(z.object({ id: z.number(), companyId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Soft delete
      await db
        .update(salonTables)
        .set({ active: false })
        .where(and(eq(salonTables.id, input.id), eq(salonTables.companyId, input.companyId)));
      return { success: true };
    }),

  // --- Comandas ---
  openOrder: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      tableId: z.number(),
      tableNumber: z.number(),
      guestCount: z.number().min(1).default(1),
      waiterId: z.string().optional(),
      waiterName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Check if table already has an open order
      const [existing] = await db
        .select({ id: salonOrders.id })
        .from(salonOrders)
        .where(
          and(
            eq(salonOrders.tableId, input.tableId),
            inArray(salonOrders.status, ["OPEN", "WAITING_PAYMENT"])
          )
        )
        .limit(1);

      if (existing) {
        throw new Error(`Mesa ${input.tableNumber} já possui uma comanda aberta (#${existing.id})`);
      }

      // Create order
      const [result] = await db.insert(salonOrders).values({
        companyId: input.companyId,
        tableId: input.tableId,
        tableNumber: input.tableNumber,
        guestCount: input.guestCount,
        waiterId: input.waiterId ?? ctx.user?.id,
        waiterName: input.waiterName ?? ctx.user?.name ?? null,
        status: "OPEN",
      });

      const orderId = (result as any).insertId;

      // Update table status
      await db
        .update(salonTables)
        .set({ status: "OCCUPIED" })
        .where(eq(salonTables.id, input.tableId));

      return { id: orderId };
    }),

  getOrder: protectedProcedure
    .input(z.object({ orderId: z.number(), companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [order] = await db
        .select()
        .from(salonOrders)
        .where(and(eq(salonOrders.id, input.orderId), eq(salonOrders.companyId, input.companyId)))
        .limit(1);

      if (!order) return null;

      const items = await db
        .select()
        .from(salonOrderItems)
        .where(and(eq(salonOrderItems.orderId, input.orderId), eq(salonOrderItems.companyId, input.companyId)))
        .orderBy(salonOrderItems.createdAt);

      const payments = await db
        .select()
        .from(salonOrderPayments)
        .where(eq(salonOrderPayments.orderId, input.orderId));

      return { ...order, items, payments };
    }),

  listOpenOrders: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const orders = await db
        .select()
        .from(salonOrders)
        .where(
          and(
            eq(salonOrders.companyId, input.companyId),
            inArray(salonOrders.status, ["OPEN", "WAITING_PAYMENT"])
          )
        )
        .orderBy(salonOrders.openedAt);

      return orders;
    }),

  addItem: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      companyId: z.number(),
      productId: z.number(),
      quantity: z.number().min(0.001),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Get product info
      const [product] = await db
        .select({
          id: products.id,
          name: products.name,
          productionDestination: products.productionDestination,
          availableInSalon: products.availableInSalon,
          active: products.active,
        })
        .from(products)
        .where(and(eq(products.id, input.productId), eq(products.companyId, input.companyId)))
        .limit(1);

      // Get the sale price: prefer SALAO channel, fallback to BALCAO
      let salePrice = 0;
      try {
        // Try SALAO channel first
        const salaoChannel = await db
          .select({ id: salesChannels.id })
          .from(salesChannels)
          .where(and(eq(salesChannels.companyId, input.companyId), eq(salesChannels.type, 'SALAO')))
          .limit(1);
        if (salaoChannel.length > 0) {
          const [priceRow] = await db
            .select({ price: productPrices.price })
            .from(productPrices)
            .where(and(eq(productPrices.productId, input.productId), eq(productPrices.channelId, salaoChannel[0].id)))
            .limit(1);
          if (priceRow) salePrice = parseFloat(String(priceRow.price));
        }
        // Fallback to BALCAO if no SALAO price
        if (salePrice === 0) {
          const balcaoChannel = await db
            .select({ id: salesChannels.id })
            .from(salesChannels)
            .where(and(eq(salesChannels.companyId, input.companyId), eq(salesChannels.type, 'BALCAO')))
            .limit(1);
          if (balcaoChannel.length > 0) {
            const [priceRow] = await db
              .select({ price: productPrices.price })
              .from(productPrices)
              .where(and(eq(productPrices.productId, input.productId), eq(productPrices.channelId, balcaoChannel[0].id)))
              .limit(1);
            if (priceRow) salePrice = parseFloat(String(priceRow.price));
          }
        }
      } catch (e) {
        console.error('[addItem] Price lookup failed:', e);
      }

      if (!product) throw new Error("Produto não encontrado");
      if (!product.active) throw new Error("Produto inativo");
      // Allow products with null availableInSalon (not yet configured) — only block explicit false
      if (product.availableInSalon === false) throw new Error("Produto não disponível no salão");

      const unitPrice = salePrice;
      const totalPrice = unitPrice * input.quantity;

      // Items with no production destination (NONE) go straight to DELIVERED
      // (e.g., water, napkins — waiter picks them up directly)
      const destination = product.productionDestination ?? "NONE";
      const initialStatus = destination === "NONE" ? "DELIVERED" : "PENDING";

      const [result] = await db.insert(salonOrderItems).values({
        orderId: input.orderId,
        companyId: input.companyId,
        productId: input.productId,
        productName: product.name,
        quantity: String(input.quantity),
        unitPrice: String(unitPrice),
        totalPrice: String(totalPrice),
        notes: input.notes,
        productionDestination: destination,
        status: initialStatus,
        sentAt: new Date(),
        ...(initialStatus === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      });

      // Recalculate order totals
      await recalcOrderTotals(db, input.orderId);

      return { id: (result as any).insertId };
    }),

  removeItem: protectedProcedure
    .input(z.object({
      itemId: z.number(),
      orderId: z.number(),
      companyId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db
        .update(salonOrderItems)
        .set({ status: "CANCELLED" })
        .where(
          and(
            eq(salonOrderItems.id, input.itemId),
            eq(salonOrderItems.orderId, input.orderId),
            eq(salonOrderItems.companyId, input.companyId)
          )
        );

      await recalcOrderTotals(db, input.orderId);
      return { success: true };
    }),

  // Diminuir quantidade de um item (em vez de remover completamente)
  decreaseItemQuantity: protectedProcedure
    .input(z.object({
      itemId: z.number(),
      orderId: z.number(),
      companyId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Buscar item atual
      const [item] = await db
        .select()
        .from(salonOrderItems)
        .where(
          and(
            eq(salonOrderItems.id, input.itemId),
            eq(salonOrderItems.orderId, input.orderId),
            eq(salonOrderItems.companyId, input.companyId)
          )
        )
        .limit(1);

      if (!item) throw new Error("Item n\u00e3o encontrado");
      if (item.status === "CANCELLED") throw new Error("Item j\u00e1 cancelado");

      const currentQty = parseFloat(String(item.quantity));
      if (currentQty <= 1) {
        // Se quantidade = 1, cancelar o item
        await db
          .update(salonOrderItems)
          .set({ status: "CANCELLED" })
          .where(eq(salonOrderItems.id, input.itemId));
      } else {
        // Diminuir quantidade e recalcular totalPrice
        const newQty = currentQty - 1;
        const unitPrice = parseFloat(String(item.unitPrice));
        const newTotal = newQty * unitPrice;
        await db
          .update(salonOrderItems)
          .set({
            quantity: String(newQty),
            totalPrice: String(newTotal.toFixed(2)),
          })
          .where(eq(salonOrderItems.id, input.itemId));
      }

      await recalcOrderTotals(db, input.orderId);
      return { success: true, newQuantity: currentQty <= 1 ? 0 : currentQty - 1 };
    }),

  updateItemStatus: protectedProcedure
    .input(z.object({
      itemId: z.number(),
      status: z.enum(["PENDING", "IN_PROGRESS", "READY", "DELIVERED", "CANCELLED"]),
      companyId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const now = new Date();
      const updates: Record<string, unknown> = { status: input.status };
      if (input.status === "IN_PROGRESS") updates.sentAt = now;
      if (input.status === "READY") updates.readyAt = now;
      if (input.status === "DELIVERED") updates.deliveredAt = now;

      await db
        .update(salonOrderItems)
        .set(updates)
        .where(eq(salonOrderItems.id, input.itemId));

      // Send push notification when item becomes READY
      if (input.status === "READY") {
        // Get companyId from input or from the order itself
        let pushCompanyId = input.companyId;
        if (!pushCompanyId) {
          const orderItem = await db
            .select({ orderId: salonOrderItems.orderId })
            .from(salonOrderItems)
            .where(eq(salonOrderItems.id, input.itemId))
            .limit(1);
          if (orderItem[0]) {
            const orderRow = await db
              .select({ companyId: salonOrders.companyId })
              .from(salonOrders)
              .where(eq(salonOrders.id, orderItem[0].orderId))
              .limit(1);
            pushCompanyId = orderRow[0]?.companyId;
          }
        }
        if (pushCompanyId) {
        // Get item details for the notification
        const item = await db
          .select({
            productName: salonOrderItems.productName,
            orderId: salonOrderItems.orderId,
          })
          .from(salonOrderItems)
          .where(eq(salonOrderItems.id, input.itemId))
          .limit(1);

        const order = item[0] ? await db
          .select({ tableNumber: salonOrders.tableNumber })
          .from(salonOrders)
          .where(eq(salonOrders.id, item[0].orderId))
          .limit(1) : [];

        const productName = item[0]?.productName || "Item";
        const tableNum = order[0]?.tableNumber || "?";

        // Fire and forget — don't block the mutation response
        sendPushToCompany(pushCompanyId, {
          title: `🔔 Pronto para servir!`,
          body: `Mesa ${tableNum}: ${productName} está pronto!`,
          icon: "/logo-abrwf.png",
          data: { url: "/salao/mesas" },
        }).catch((err) => console.error("[WebPush] Error sending push:", err));
        }
      }

      return { success: true };
    }),

  // --- KDS ---
  getKDSItems: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      destination: z.enum(["KITCHEN", "BAR", "BOTH", "ALL"]),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const destinations = input.destination === "ALL"
        ? ["KITCHEN", "BAR", "BOTH"] as const
        : input.destination === "BOTH"
          ? ["KITCHEN", "BAR", "BOTH"] as const
          : [input.destination, "BOTH"] as const;

      const items = await db
        .select({
          id: salonOrderItems.id,
          orderId: salonOrderItems.orderId,
          tableNumber: salonOrders.tableNumber,
          waiterName: salonOrders.waiterName,
          productName: salonOrderItems.productName,
          quantity: salonOrderItems.quantity,
          notes: salonOrderItems.notes,
          productionDestination: salonOrderItems.productionDestination,
          status: salonOrderItems.status,
          sentAt: salonOrderItems.sentAt,
          createdAt: salonOrderItems.createdAt,
        })
        .from(salonOrderItems)
        .innerJoin(salonOrders, eq(salonOrderItems.orderId, salonOrders.id))
        .where(
          and(
            eq(salonOrderItems.companyId, input.companyId),
            inArray(salonOrderItems.status, ["PENDING", "IN_PROGRESS"]),
            inArray(salonOrderItems.productionDestination, destinations as any),
            sql`${salonOrders.status} != 'CANCELLED'`
          )
        )
        .orderBy(salonOrderItems.sentAt, salonOrderItems.createdAt);

      return items;
    }),

  // --- Encerramento de Conta ---
  requestCheckout: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      companyId: z.number(),
      tipPercent: z.number().min(0).max(100).default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [order] = await db
        .select()
        .from(salonOrders)
        .where(and(eq(salonOrders.id, input.orderId), eq(salonOrders.companyId, input.companyId)))
        .limit(1);

      if (!order) throw new Error("Comanda não encontrada");
      if (order.status !== "OPEN") throw new Error("Comanda não está aberta");

      const subtotal = parseFloat(order.subtotal ?? "0");
      const tipAmount = subtotal * (input.tipPercent / 100);
      const totalAmount = subtotal + tipAmount;

      await db
        .update(salonOrders)
        .set({
          status: "WAITING_PAYMENT",
          tipPercent: String(input.tipPercent),
          tipAmount: String(tipAmount.toFixed(2)),
          totalAmount: String(totalAmount.toFixed(2)),
        })
        .where(eq(salonOrders.id, input.orderId));

      await db
        .update(salonTables)
        .set({ status: "WAITING_PAYMENT" })
        .where(eq(salonTables.id, order.tableId));

      return { subtotal, tipAmount, totalAmount };
    }),

  closeOrder: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      companyId: z.number(),
      branchId: z.number().default(1),
      payments: z.array(z.object({
        method: z.enum(["CASH", "CREDIT", "DEBIT", "PIX", "VOUCHER"]),
        amount: z.number().min(0.01),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [order] = await db
        .select()
        .from(salonOrders)
        .where(and(eq(salonOrders.id, input.orderId), eq(salonOrders.companyId, input.companyId)))
        .limit(1);

      if (!order) throw new Error("Comanda não encontrada");
      if (!["OPEN", "WAITING_PAYMENT"].includes(order.status)) {
        throw new Error("Comanda já foi encerrada");
      }

      // Get active items
      const items = await db
        .select()
        .from(salonOrderItems)
        .where(
          and(
            eq(salonOrderItems.orderId, input.orderId),
            inArray(salonOrderItems.status, ["PENDING", "IN_PROGRESS", "READY", "DELIVERED"])
          )
        );

      const subtotal = parseFloat(order.subtotal ?? "0");
      const tipAmount = parseFloat(order.tipAmount ?? "0");
      const totalAmount = parseFloat(order.totalAmount ?? "0") || subtotal + tipAmount;

      // Record payments
      for (const payment of input.payments) {
        await db.insert(salonOrderPayments).values({
          orderId: input.orderId,
          companyId: input.companyId,
          method: payment.method,
          amount: String(payment.amount),
        });
      }

      // Create sale record (integração com módulo de vendas)
      const now = getNowInBrazil();
      const paymentMethod = mapPaymentMethod(input.payments);

      // Use the existing createSale helper which handles stock, movements and accounting
      const saleItems = items.map(item => ({
        productId: item.productId,
        quantity: parseInt(String(Math.round(parseFloat(String(item.quantity))))),
        unitPrice: String(item.unitPrice),
        totalPrice: String(item.totalPrice),
        branchId: input.branchId,
      }));

      const saleId = await createSale(
        {
          companyId: input.companyId,
          branchId: input.branchId,
          saleType: "SALAO" as const,
          saleDate: now,
          subtotal: String(subtotal.toFixed(2)),
          discountAmount: "0.00",
          surchargeAmount: "0.00",
          finalAmount: String(subtotal.toFixed(2)),
          paymentMethod,
          notes: `Comanda #${input.orderId} - Mesa ${order.tableNumber} - ${order.guestCount} pessoa(s) - SALÃO${tipAmount > 0 ? ` | Taxa serviço: R$ ${tipAmount.toFixed(2)}` : ""}`,
          status: "ACTIVE",
          createdBy: ctx.user?.id ?? "",
        },
        saleItems
      );

      // Close order
      await db
        .update(salonOrders)
        .set({
          status: "CLOSED",
          closedAt: now,
          saleId,
          totalAmount: String(totalAmount.toFixed(2)),
        })
        .where(eq(salonOrders.id, input.orderId));

      // Free the table
      await db
        .update(salonTables)
        .set({ status: "FREE" })
        .where(eq(salonTables.id, order.tableId));

      return { success: true, saleId, totalAmount };
    }),

  cancelOrder: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      companyId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [order] = await db
        .select()
        .from(salonOrders)
        .where(and(eq(salonOrders.id, input.orderId), eq(salonOrders.companyId, input.companyId)))
        .limit(1);

      if (!order) throw new Error("Comanda não encontrada");
      if (order.status === "CLOSED") throw new Error("Comanda já encerrada");

      await db
        .update(salonOrders)
        .set({ status: "CANCELLED" })
        .where(eq(salonOrders.id, input.orderId));

      // Cancel all items in KDS (kitchen/bar) that are not yet delivered
      await db
        .update(salonOrderItems)
        .set({ status: "CANCELLED" })
        .where(
          and(
            eq(salonOrderItems.orderId, input.orderId),
            inArray(salonOrderItems.status, ["PENDING", "IN_PROGRESS", "READY"])
          )
        );

      await db
        .update(salonTables)
        .set({ status: "FREE" })
        .where(eq(salonTables.id, order.tableId));

      return { success: true };
    }),

  // --- Produtos disponíveis no salão ---
  listSalonProducts: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // First try to get products explicitly marked as available in salon
      let rows = await db
        .select({
          id: products.id,
          name: products.name,
          productionDestination: products.productionDestination,
          currentStock: products.currentStock,
          uom: products.uom,
        })
        .from(products)
        .where(
          and(
            eq(products.companyId, input.companyId),
            eq(products.active, true),
            eq(products.availableInSalon, true)
          )
        )
        .orderBy(products.name);

      // Fallback: if no products are configured for salon yet, show all active products
      // This handles backward compatibility when products haven't been configured yet
      if (rows.length === 0) {
        rows = await db
          .select({
            id: products.id,
            name: products.name,
            productionDestination: products.productionDestination,
            currentStock: products.currentStock,
            uom: products.uom,
          })
          .from(products)
          .where(
            and(
              eq(products.companyId, input.companyId),
              eq(products.active, true)
            )
          )
          .orderBy(products.name);
      }

      // Get prices: prefer SALAO channel, fallback to BALCAO
      const productIds = rows.map(r => r.id);
      let priceMap = new Map<number, number>();

      if (productIds.length > 0) {
        try {
          // Try SALAO channel first
          const salaoChannel = await db
            .select({ id: salesChannels.id })
            .from(salesChannels)
            .where(
              and(
                eq(salesChannels.companyId, input.companyId),
                eq(salesChannels.type, 'SALAO')
              )
            )
            .limit(1);

          if (salaoChannel.length > 0) {
            const priceRows = await db
              .select({ productId: productPrices.productId, price: productPrices.price })
              .from(productPrices)
              .where(
                and(
                  inArray(productPrices.productId, productIds),
                  eq(productPrices.channelId, salaoChannel[0].id)
                )
              );
            for (const row of priceRows) {
              priceMap.set(row.productId, parseFloat(String(row.price)));
            }
          }

          // Fallback: fill missing prices from BALCAO channel
          const missingIds = productIds.filter(id => !priceMap.has(id));
          if (missingIds.length > 0) {
            const balcaoChannel = await db
              .select({ id: salesChannels.id })
              .from(salesChannels)
              .where(
                and(
                  eq(salesChannels.companyId, input.companyId),
                  eq(salesChannels.type, 'BALCAO')
                )
              )
              .limit(1);

            if (balcaoChannel.length > 0) {
              const priceRows = await db
                .select({ productId: productPrices.productId, price: productPrices.price })
                .from(productPrices)
                .where(
                  and(
                    inArray(productPrices.productId, missingIds),
                    eq(productPrices.channelId, balcaoChannel[0].id)
                  )
                );
              for (const row of priceRows) {
                priceMap.set(row.productId, parseFloat(String(row.price)));
              }
            }
          }
        } catch (priceErr) {
          console.error('[listSalonProducts] Price query failed:', priceErr);
          // Continue without prices rather than failing the whole request
        }
      }

      const result = rows.map(r => ({
        ...r,
        salePrice: priceMap.get(r.id) ?? 0,
      }));

      if (input.search) {
        const q = input.search.toLowerCase();
        return result.filter(r => r.name.toLowerCase().includes(q));
      }

      return result;
    }),

  // --- Relatório de gorjeta por garçom ---
  getTipReport: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      end.setUTCDate(end.getUTCDate() + 1); // include full end day

      const orders = await db
        .select({
          waiterId: salonOrders.waiterId,
          waiterName: salonOrders.waiterName,
          tipAmount: salonOrders.tipAmount,
          totalAmount: salonOrders.totalAmount,
          closedAt: salonOrders.closedAt,
          tableNumber: salonOrders.tableNumber,
        })
        .from(salonOrders)
        .where(
          and(
            eq(salonOrders.companyId, input.companyId),
            eq(salonOrders.status, "CLOSED"),
            gte(salonOrders.closedAt, start),
            lte(salonOrders.closedAt, end)
          )
        )
        .orderBy(salonOrders.waiterName);

      // Group by waiter
      const byWaiter = new Map<string, {
        waiterId: string | null;
        waiterName: string | null;
        totalTip: number;
        totalSales: number;
        orderCount: number;
      }>();

      for (const o of orders) {
        const key = o.waiterId ?? "unknown";
        const existing = byWaiter.get(key) ?? {
          waiterId: o.waiterId,
          waiterName: o.waiterName,
          totalTip: 0,
          totalSales: 0,
          orderCount: 0,
        };
        existing.totalTip += parseFloat(String(o.tipAmount ?? "0"));
        existing.totalSales += parseFloat(String(o.subtotal ?? o.totalAmount ?? "0"));
        existing.orderCount += 1;
        byWaiter.set(key, existing);
      }

      return Array.from(byWaiter.values());
    }),

  // --- Gestão de Garçons ---
  listWaiters: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const waiters = await db
        .select({
          id: userCompanies.id,
          userId: userCompanies.userId,
          companyId: userCompanies.companyId,
          role: userCompanies.role,
          userName: users.name,
          userEmail: users.email,
          createdAt: userCompanies.createdAt,
        })
        .from(userCompanies)
        .innerJoin(users, eq(users.id, userCompanies.userId))
        .where(
          and(
            eq(userCompanies.companyId, input.companyId),
            eq(userCompanies.role, 'garcom')
          )
        )
        .orderBy(users.name);

      return waiters;
    }),

  getWaiterPerformance: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Use Brazil timezone: startDate at 00:00 BRT = 03:00 UTC, endDate at 23:59:59 BRT = next day 02:59:59 UTC
      const start = new Date(input.startDate + 'T00:00:00-03:00');
      const end = new Date(input.endDate + 'T23:59:59-03:00');

      const orders = await db
        .select({
          waiterId: salonOrders.waiterId,
          waiterName: salonOrders.waiterName,
          totalAmount: salonOrders.totalAmount,
          tipAmount: salonOrders.tipAmount,
          subtotal: salonOrders.subtotal,
          guests: salonOrders.guestCount,
          closedAt: salonOrders.closedAt,
          openedAt: salonOrders.openedAt,
        })
        .from(salonOrders)
        .where(
          and(
            eq(salonOrders.companyId, input.companyId),
            eq(salonOrders.status, "CLOSED"),
            gte(salonOrders.closedAt, start),
            lte(salonOrders.closedAt, end)
          )
        );
      // Group by waiter
      const byWaiter = new Map<string, {
        waiterId: string | null;
        waiterName: string | null;
        totalSales: number;
        totalTips: number;
        orderCount: number;
        totalGuests: number;
        avgServiceTime: number;
        totalServiceTime: number;
      }>();

      for (const o of orders) {
        const key = o.waiterId ?? "unknown";
        const existing = byWaiter.get(key) ?? {
          waiterId: o.waiterId,
          waiterName: o.waiterName,
          totalSales: 0,
          totalTips: 0,
          orderCount: 0,
          totalGuests: 0,
          avgServiceTime: 0,
          totalServiceTime: 0,
        };
        existing.totalSales += parseFloat(String(o.subtotal ?? "0"));
        existing.totalTips += parseFloat(String(o.tipAmount ?? "0"));
        existing.orderCount += 1;
        existing.totalGuests += Number(o.guests ?? 0);
        if (o.openedAt && o.closedAt) {
          const serviceTime = (new Date(o.closedAt).getTime() - new Date(o.openedAt).getTime()) / 60000;
          existing.totalServiceTime += serviceTime;
        }
        byWaiter.set(key, existing);
      }

      return Array.from(byWaiter.values()).map(w => ({
        ...w,
        avgTicket: w.orderCount > 0 ? w.totalSales / w.orderCount : 0,
        avgServiceTime: w.orderCount > 0 ? w.totalServiceTime / w.orderCount : 0,
      }));
    }),

  // --- Dashboard stats ---
  getDashboardStats: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const companyId = ctx.activeCompanyId;
      if (!companyId) throw new Error("Empresa não selecionada");

      // Calculate "today" in Brazil timezone (UTC-3)
      // Get current date string in Brazil timezone, then convert to UTC boundaries
      const nowStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
      const todayStart = new Date(nowStr + 'T00:00:00-03:00'); // midnight BRT = 03:00 UTC
      const nextDay = new Date(nowStr + 'T00:00:00-03:00');
      nextDay.setDate(nextDay.getDate() + 1);

      // Total tables configured
      const [totalTablesRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(salonTables)
        .where(and(eq(salonTables.companyId, companyId), eq(salonTables.active, true)));

      // Open/waiting tables count
      const [openTablesRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(salonOrders)
        .where(
          and(
            eq(salonOrders.companyId, companyId),
            inArray(salonOrders.status, ["OPEN", "WAITING_PAYMENT"])
          )
        );

      // Today's revenue from salon (subtotal only, excluding service fee/tip)
      const [todayRevenueRow] = await db
        .select({
          total: sql<string>`COALESCE(SUM(subtotal), 0)`,
          totalTips: sql<string>`COALESCE(SUM(tipAmount), 0)`,
        })
        .from(salonOrders)
        .where(
          and(
            eq(salonOrders.companyId, companyId),
            eq(salonOrders.status, "CLOSED"),
            gte(salonOrders.closedAt, todayStart),
            lt(salonOrders.closedAt, nextDay)
          )
        );

      // Today's order count
      const [todayOrdersRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(salonOrders)
        .where(
          and(
            eq(salonOrders.companyId, companyId),
            eq(salonOrders.status, "CLOSED"),
            gte(salonOrders.closedAt, todayStart),
            lt(salonOrders.closedAt, nextDay)
          )
        );

      const todayRevenue = parseFloat(String(todayRevenueRow?.total ?? "0"));
      const todayTips = parseFloat(String(todayRevenueRow?.totalTips ?? "0"));
      const todayOrders = Number(todayOrdersRow?.count ?? 0);
      const avgTicket = todayOrders > 0 ? todayRevenue / todayOrders : 0;

      return {
        totalTables: Number(totalTablesRow?.count ?? 0),
        occupiedTables: Number(openTablesRow?.count ?? 0),
        todayRevenue: todayRevenue.toFixed(2),
        todayTips: todayTips.toFixed(2),
        todayOrders,
        avgTicket: avgTicket.toFixed(2),
      };
    }),

  // ==================== FECHAMENTO DE GARÇOM ====================

  getWaiterClosingReport: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      waiterId: z.string().optional(), // se vazio, retorna todos
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Brazil timezone boundaries
      const start = new Date(input.startDate + 'T00:00:00-03:00');
      const end = new Date(input.endDate + 'T23:59:59-03:00');

      const conditions = [
        eq(salonOrders.companyId, input.companyId),
        eq(salonOrders.status, "CLOSED"),
        gte(salonOrders.closedAt, start),
        lte(salonOrders.closedAt, end),
      ];
      if (input.waiterId) {
        conditions.push(eq(salonOrders.waiterId, input.waiterId));
      }

      // Get all closed orders in the period
      const orders = await db
        .select({
          id: salonOrders.id,
          waiterId: salonOrders.waiterId,
          waiterName: salonOrders.waiterName,
          tableNumber: salonOrders.tableNumber,
          guestCount: salonOrders.guestCount,
          subtotal: salonOrders.subtotal,
          tipPercent: salonOrders.tipPercent,
          tipAmount: salonOrders.tipAmount,
          totalAmount: salonOrders.totalAmount,
          openedAt: salonOrders.openedAt,
          closedAt: salonOrders.closedAt,
        })
        .from(salonOrders)
        .where(and(...conditions))
        .orderBy(salonOrders.closedAt);

      if (orders.length === 0) {
        return { waiters: [], totals: { totalSales: 0, totalSubtotal: 0, totalTips: 0, totalOrders: 0, totalGuests: 0, avgTicket: 0, avgServiceTime: 0 } };
      }

      // Get all items for these orders
      const orderIds = orders.map(o => o.id);
      const allItems = await db
        .select({
          orderId: salonOrderItems.orderId,
          productId: salonOrderItems.productId,
          productName: salonOrderItems.productName,
          quantity: salonOrderItems.quantity,
          unitPrice: salonOrderItems.unitPrice,
          totalPrice: salonOrderItems.totalPrice,
          status: salonOrderItems.status,
        })
        .from(salonOrderItems)
        .where(
          and(
            inArray(salonOrderItems.orderId, orderIds),
            inArray(salonOrderItems.status, ["PENDING", "IN_PROGRESS", "READY", "DELIVERED"])
          )
        );

      // Get payments for these orders
      const allPayments = await db
        .select({
          orderId: salonOrderPayments.orderId,
          method: salonOrderPayments.method,
          amount: salonOrderPayments.amount,
        })
        .from(salonOrderPayments)
        .where(inArray(salonOrderPayments.orderId, orderIds));

      // Group items by order
      const itemsByOrder = new Map<number, typeof allItems>();
      for (const item of allItems) {
        const list = itemsByOrder.get(item.orderId) ?? [];
        list.push(item);
        itemsByOrder.set(item.orderId, list);
      }

      // Group payments by order
      const paymentsByOrder = new Map<number, typeof allPayments>();
      for (const p of allPayments) {
        const list = paymentsByOrder.get(p.orderId) ?? [];
        list.push(p);
        paymentsByOrder.set(p.orderId, list);
      }

      // Group by waiter
      const byWaiter = new Map<string, {
        waiterId: string | null;
        waiterName: string | null;
        totalSales: number;
        totalSubtotal: number;
        totalTips: number;
        orderCount: number;
        totalGuests: number;
        totalServiceTime: number;
        productsSold: Map<number, { productId: number; productName: string; quantity: number; totalRevenue: number }>;
        paymentBreakdown: Map<string, number>;
        orders: Array<{
          id: number;
          tableNumber: number;
          guestCount: number;
          subtotal: number;
          tipAmount: number;
          totalAmount: number;
          openedAt: Date | null;
          closedAt: Date | null;
          serviceTimeMin: number;
          items: Array<{ productName: string; quantity: number; unitPrice: number; totalPrice: number }>;
          payments: Array<{ method: string; amount: number }>;
        }>;
      }>();

      for (const o of orders) {
        const key = o.waiterId ?? "unknown";
        const existing = byWaiter.get(key) ?? {
          waiterId: o.waiterId,
          waiterName: o.waiterName,
          totalSales: 0,
          totalSubtotal: 0,
          totalTips: 0,
          orderCount: 0,
          totalGuests: 0,
          totalServiceTime: 0,
          productsSold: new Map(),
          paymentBreakdown: new Map(),
          orders: [] as Array<{
            id: number;
            tableNumber: number;
            guestCount: number;
            subtotal: number;
            tipAmount: number;
            totalAmount: number;
            openedAt: Date | null;
            closedAt: Date | null;
            serviceTimeMin: number;
            items: Array<{ productName: string; quantity: number; unitPrice: number; totalPrice: number }>;
            payments: Array<{ method: string; amount: number }>;
          }>,
        };

        const subtotal = parseFloat(String(o.subtotal ?? "0"));
        const tipAmount = parseFloat(String(o.tipAmount ?? "0"));
        const totalAmount = parseFloat(String(o.totalAmount ?? "0"));
        const serviceTime = (o.openedAt && o.closedAt)
          ? (new Date(o.closedAt).getTime() - new Date(o.openedAt).getTime()) / 60000
          : 0;

        existing.totalSales += subtotal;
        existing.totalSubtotal += subtotal;
        existing.totalTips += tipAmount;
        existing.orderCount += 1;
        existing.totalGuests += Number(o.guestCount ?? 0);
        existing.totalServiceTime += serviceTime;

        // Aggregate products
        const orderItems = itemsByOrder.get(o.id) ?? [];
        for (const item of orderItems) {
          const qty = parseFloat(String(item.quantity));
          const rev = parseFloat(String(item.totalPrice));
          const prev = existing.productsSold.get(item.productId);
          if (prev) {
            prev.quantity += qty;
            prev.totalRevenue += rev;
          } else {
            existing.productsSold.set(item.productId, {
              productId: item.productId,
              productName: item.productName,
              quantity: qty,
              totalRevenue: rev,
            });
          }
        }

        // Aggregate payments
        const orderPayments = paymentsByOrder.get(o.id) ?? [];
        for (const p of orderPayments) {
          const amt = parseFloat(String(p.amount));
          existing.paymentBreakdown.set(p.method, (existing.paymentBreakdown.get(p.method) ?? 0) + amt);
        }

        // Add order detail
        existing.orders.push({
          id: o.id,
          tableNumber: o.tableNumber,
          guestCount: Number(o.guestCount ?? 0),
          subtotal,
          tipAmount,
          totalAmount,
          openedAt: o.openedAt,
          closedAt: o.closedAt,
          serviceTimeMin: Math.round(serviceTime),
          items: orderItems.map(i => ({
            productName: i.productName,
            quantity: parseFloat(String(i.quantity)),
            unitPrice: parseFloat(String(i.unitPrice)),
            totalPrice: parseFloat(String(i.totalPrice)),
          })),
          payments: orderPayments.map(p => ({
            method: p.method,
            amount: parseFloat(String(p.amount)),
          })),
        });

        byWaiter.set(key, existing);
      }

      // Convert to serializable format
      const waiters = Array.from(byWaiter.values()).map(w => ({
        waiterId: w.waiterId,
        waiterName: w.waiterName,
        totalSales: w.totalSales,
        totalSubtotal: w.totalSubtotal,
        totalTips: w.totalTips,
        orderCount: w.orderCount,
        totalGuests: w.totalGuests,
        avgTicket: w.orderCount > 0 ? w.totalSales / w.orderCount : 0,
        avgServiceTime: w.orderCount > 0 ? w.totalServiceTime / w.orderCount : 0,
        productsSold: Array.from(w.productsSold.values()).sort((a, b) => b.totalRevenue - a.totalRevenue),
        paymentBreakdown: Object.fromEntries(w.paymentBreakdown),
        orders: w.orders,
      })).sort((a, b) => b.totalSales - a.totalSales);

      // Global totals
      const totals = waiters.reduce(
        (acc, w) => ({
          totalSales: acc.totalSales + w.totalSales,
          totalSubtotal: acc.totalSubtotal + w.totalSubtotal,
          totalTips: acc.totalTips + w.totalTips,
          totalOrders: acc.totalOrders + w.orderCount,
          totalGuests: acc.totalGuests + w.totalGuests,
          avgTicket: 0,
          avgServiceTime: 0,
        }),
        { totalSales: 0, totalSubtotal: 0, totalTips: 0, totalOrders: 0, totalGuests: 0, avgTicket: 0, avgServiceTime: 0 }
      );
      totals.avgTicket = totals.totalOrders > 0 ? totals.totalSales / totals.totalOrders : 0;
      const totalServiceTime = waiters.reduce((sum, w) => sum + w.avgServiceTime * w.orderCount, 0);
      totals.avgServiceTime = totals.totalOrders > 0 ? totalServiceTime / totals.totalOrders : 0;

      return { waiters, totals };
    }),

  // ==================== KDS ANALYTICS ====================

  getKDSStats: protectedProcedure
    .input(z.object({ companyId: z.number(), destination: z.enum(["KITCHEN", "BAR"]) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { todayOrders: 0, todayItems: 0, avgPrepTimeMin: 0, lastOrderTime: null, itemStats: [] };

      const todayStart = new Date();
      todayStart.setUTCHours(3, 0, 0, 0); // BRT midnight
      if (todayStart > new Date()) todayStart.setDate(todayStart.getDate() - 1);

      // Items completed today (READY or DELIVERED) with timing — exclude cancelled
      const completedItems = await db
        .select({
          id: salonOrderItems.id,
          productName: salonOrderItems.productName,
          sentAt: salonOrderItems.sentAt,
          readyAt: salonOrderItems.readyAt,
          quantity: salonOrderItems.quantity,
          orderId: salonOrderItems.orderId,
        })
        .from(salonOrderItems)
        .innerJoin(salonOrders, eq(salonOrderItems.orderId, salonOrders.id))
        .where(
          and(
            eq(salonOrderItems.companyId, input.companyId),
            inArray(salonOrderItems.productionDestination, [input.destination, "BOTH"]),
            inArray(salonOrderItems.status, ["READY", "DELIVERED"]),
            gte(salonOrderItems.sentAt, todayStart),
            sql`${salonOrders.status} != 'CANCELLED'`
          )
        );

      // All items sent today (including pending/in progress) — exclude cancelled orders/items
      const allItemsToday = await db
        .select({
          id: salonOrderItems.id,
          orderId: salonOrderItems.orderId,
          sentAt: salonOrderItems.sentAt,
        })
        .from(salonOrderItems)
        .innerJoin(salonOrders, eq(salonOrderItems.orderId, salonOrders.id))
        .where(
          and(
            eq(salonOrderItems.companyId, input.companyId),
            inArray(salonOrderItems.productionDestination, [input.destination, "BOTH"]),
            gte(salonOrderItems.sentAt, todayStart),
            sql`${salonOrders.status} != 'CANCELLED'`,
            sql`${salonOrderItems.status} != 'CANCELLED'`
          )
        );

      const todayItems = allItemsToday.length;
      const uniqueOrders = new Set(allItemsToday.map(i => i.orderId));
      const todayOrders = uniqueOrders.size;

      // Last order time
      let lastOrderTime: string | null = null;
      if (allItemsToday.length > 0) {
        const sorted = allItemsToday.filter(i => i.sentAt).sort((a, b) => new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime());
        if (sorted[0]?.sentAt) lastOrderTime = new Date(sorted[0].sentAt).toISOString();
      }

      // Avg prep time
      const prepTimes: number[] = [];
      const productPrepTimes: Record<string, { name: string; times: number[]; count: number }> = {};

      for (const item of completedItems) {
        if (item.sentAt && item.readyAt) {
          const prepMin = (new Date(item.readyAt).getTime() - new Date(item.sentAt).getTime()) / 60000;
          if (prepMin > 0 && prepMin < 180) { // ignore outliers > 3h
            prepTimes.push(prepMin);
            if (!productPrepTimes[item.productName]) {
              productPrepTimes[item.productName] = { name: item.productName, times: [], count: 0 };
            }
            productPrepTimes[item.productName].times.push(prepMin);
            productPrepTimes[item.productName].count += parseFloat(String(item.quantity));
          }
        }
      }

      const avgPrepTimeMin = prepTimes.length > 0 ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length : 0;

      const itemStats = Object.values(productPrepTimes)
        .map(p => ({
          name: p.name,
          avgPrepMin: Math.round(p.times.reduce((a, b) => a + b, 0) / p.times.length),
          count: p.count,
        }))
        .sort((a, b) => b.count - a.count);

      return { todayOrders, todayItems, avgPrepTimeMin: Math.round(avgPrepTimeMin), lastOrderTime, itemStats };
    }),

  // ==================== KDS ANALYTICS (DATE RANGE) ====================

  getKDSAnalytics: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
      destination: z.enum(["KITCHEN", "BAR", "ALL"]).default("ALL"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { totalOrders: 0, totalItems: 0, avgPrepTimeMin: 0, peakHour: null, productStats: [], dailyStats: [], destinationBreakdown: { kitchen: 0, bar: 0 } };

      // BRT = UTC-3. Day X in BRT: starts at X T03:00:00Z, ends at (X+1) T02:59:59Z
      const start = new Date(input.startDate + "T03:00:00.000Z");
      // End of endDate in BRT = (endDate + 1 day) at 02:59:59 UTC
      const endBase = new Date(input.endDate + "T03:00:00.000Z");
      endBase.setUTCDate(endBase.getUTCDate() + 1);
      const end = new Date(endBase.getTime() - 1); // 02:59:59.999Z of next day

      const destinations = input.destination === "ALL"
        ? ["KITCHEN", "BAR", "BOTH"] as const
        : [input.destination, "BOTH"] as const;

      // All completed items in range (READY or DELIVERED), excluding cancelled orders
      const completedItems = await db
        .select({
          id: salonOrderItems.id,
          productName: salonOrderItems.productName,
          sentAt: salonOrderItems.sentAt,
          readyAt: salonOrderItems.readyAt,
          quantity: salonOrderItems.quantity,
          orderId: salonOrderItems.orderId,
          productionDestination: salonOrderItems.productionDestination,
        })
        .from(salonOrderItems)
        .innerJoin(salonOrders, eq(salonOrderItems.orderId, salonOrders.id))
        .where(
          and(
            eq(salonOrderItems.companyId, input.companyId),
            inArray(salonOrderItems.productionDestination, destinations as any),
            inArray(salonOrderItems.status, ["READY", "DELIVERED"]),
            gte(salonOrderItems.sentAt, start),
            lte(salonOrderItems.sentAt, end),
            sql`${salonOrders.status} != 'CANCELLED'`
          )
        );

      // All non-cancelled items in range
      const allItems = await db
        .select({
          id: salonOrderItems.id,
          orderId: salonOrderItems.orderId,
          sentAt: salonOrderItems.sentAt,
          productionDestination: salonOrderItems.productionDestination,
        })
        .from(salonOrderItems)
        .innerJoin(salonOrders, eq(salonOrderItems.orderId, salonOrders.id))
        .where(
          and(
            eq(salonOrderItems.companyId, input.companyId),
            inArray(salonOrderItems.productionDestination, destinations as any),
            gte(salonOrderItems.sentAt, start),
            lte(salonOrderItems.sentAt, end),
            sql`${salonOrders.status} != 'CANCELLED'`,
            sql`${salonOrderItems.status} != 'CANCELLED'`
          )
        );

      const totalItems = allItems.length;
      const uniqueOrders = new Set(allItems.map(i => i.orderId));
      const totalOrders = uniqueOrders.size;

      // Destination breakdown
      let kitchenCount = 0, barCount = 0;
      for (const item of allItems) {
        if (item.productionDestination === "KITCHEN" || item.productionDestination === "BOTH") kitchenCount++;
        if (item.productionDestination === "BAR" || item.productionDestination === "BOTH") barCount++;
      }

      // Prep times and product stats
      const prepTimes: number[] = [];
      const productPrepTimes: Record<string, { name: string; times: number[]; count: number }> = {};
      const hourCounts: Record<number, number> = {};
      const hourKitchenCounts: Record<number, number> = {};
      const hourBarCounts: Record<number, number> = {};
      const dayCounts: Record<string, { date: string; orders: Set<number>; items: number; prepTimes: number[] }> = {};

      for (const item of completedItems) {
        if (item.sentAt && item.readyAt) {
          const prepMin = (new Date(item.readyAt).getTime() - new Date(item.sentAt).getTime()) / 60000;
          if (prepMin > 0 && prepMin < 180) {
            prepTimes.push(prepMin);
            const name = item.productName;
            if (!productPrepTimes[name]) productPrepTimes[name] = { name, times: [], count: 0 };
            productPrepTimes[name].times.push(prepMin);
            productPrepTimes[name].count += parseFloat(String(item.quantity));
          }
        }
        // Peak hour + destination breakdown
        if (item.sentAt) {
          const brHour = new Date(new Date(item.sentAt).getTime() - 3 * 3600000).getUTCHours();
          hourCounts[brHour] = (hourCounts[brHour] || 0) + 1;
          const dest = item.productionDestination;
          if (dest === "KITCHEN" || dest === "BOTH") hourKitchenCounts[brHour] = (hourKitchenCounts[brHour] || 0) + 1;
          if (dest === "BAR" || dest === "BOTH") hourBarCounts[brHour] = (hourBarCounts[brHour] || 0) + 1;
        }
        // Daily stats
        if (item.sentAt) {
          const brDate = new Date(new Date(item.sentAt).getTime() - 3 * 3600000);
          const dayKey = brDate.toISOString().split("T")[0];
          if (!dayCounts[dayKey]) dayCounts[dayKey] = { date: dayKey, orders: new Set(), items: 0, prepTimes: [] };
          dayCounts[dayKey].orders.add(item.orderId);
          dayCounts[dayKey].items++;
          if (item.sentAt && item.readyAt) {
            const pm = (new Date(item.readyAt).getTime() - new Date(item.sentAt).getTime()) / 60000;
            if (pm > 0 && pm < 180) dayCounts[dayKey].prepTimes.push(pm);
          }
        }
      }

      const avgPrepTimeMin = prepTimes.length > 0 ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) : 0;

      // Peak hour
      let peakHour: string | null = null;
      let peakCount = 0;
      for (const [h, c] of Object.entries(hourCounts)) {
        if (c > peakCount) { peakCount = c; peakHour = `${h.padStart(2, "0")}:00`; }
      }

      // Hourly stats (all 24 hours for chart, with destination breakdown)
      const hourlyStats: { hour: string; count: number; kitchen: number; bar: number }[] = [];
      for (let h = 0; h < 24; h++) {
        hourlyStats.push({
          hour: `${String(h).padStart(2, "0")}:00`,
          count: hourCounts[h] || 0,
          kitchen: hourKitchenCounts[h] || 0,
          bar: hourBarCounts[h] || 0,
        });
      }

      const productStats = Object.values(productPrepTimes)
        .map(p => ({
          name: p.name,
          avgPrepMin: Math.round(p.times.reduce((a, b) => a + b, 0) / p.times.length),
          count: p.count,
        }))
        .sort((a, b) => b.count - a.count);

      const dailyStats = Object.values(dayCounts)
        .map(d => ({
          date: d.date,
          orders: d.orders.size,
          items: d.items,
          avgPrepMin: d.prepTimes.length > 0 ? Math.round(d.prepTimes.reduce((a, b) => a + b, 0) / d.prepTimes.length) : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { totalOrders, totalItems, avgPrepTimeMin, peakHour, hourlyStats, productStats, dailyStats, destinationBreakdown: { kitchen: kitchenCount, bar: barCount } };
    }),

  // ==================== CONTROLE DE ACESSO GARÇOM ====================

  // Salvar configurações de acesso do garçom
  saveAccessConfig: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      waiterAccessControl: z.boolean(),
      openingTime: z.string().regex(/^\d{2}:\d{2}$/),
      closingTime: z.string().regex(/^\d{2}:\d{2}$/),
      requireCheckIn: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .insert(salonConfig)
        .values({
          companyId: input.companyId,
          waiterAccessControl: input.waiterAccessControl,
          openingTime: input.openingTime,
          closingTime: input.closingTime,
          requireCheckIn: input.requireCheckIn,
        })
        .onDuplicateKeyUpdate({
          set: {
            waiterAccessControl: input.waiterAccessControl,
            openingTime: input.openingTime,
            closingTime: input.closingTime,
            requireCheckIn: input.requireCheckIn,
          },
        });
      return { success: true };
    }),

  // Verificar se garçom tem acesso (chamado pelo frontend)
  checkWaiterAccess: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { allowed: true, reason: null };

      // Buscar role do usuário na empresa
      const [uc] = await db
        .select({ role: userCompanies.role })
        .from(userCompanies)
        .where(and(eq(userCompanies.userId, ctx.user.id), eq(userCompanies.companyId, input.companyId)))
        .limit(1);

      // Se não é garçom, acesso liberado
      if (!uc || uc.role !== 'garcom') return { allowed: true, reason: null };

      // Buscar config
      const [config] = await db
        .select()
        .from(salonConfig)
        .where(eq(salonConfig.companyId, input.companyId))
        .limit(1);

      // Se controle de acesso desativado, libera
      if (!config || !config.waiterAccessControl) return { allowed: true, reason: null };

      // Verificar horário de funcionamento
      const now = getNowInBrazil();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const opening = config.openingTime || '11:00';
      const closing = config.closingTime || '23:00';

      // Suporta horários que cruzam meia-noite (ex: 18:00 - 02:00)
      let withinHours = false;
      if (closing > opening) {
        withinHours = currentTime >= opening && currentTime <= closing;
      } else {
        withinHours = currentTime >= opening || currentTime <= closing;
      }

      if (!withinHours) {
        return { allowed: false, reason: `Acesso permitido apenas entre ${opening} e ${closing}`, outsideHours: true };
      }

      // Verificar check-in
      if (config.requireCheckIn) {
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const [checkIn] = await db
          .select()
          .from(waiterCheckIns)
          .where(
            and(
              eq(waiterCheckIns.companyId, input.companyId),
              eq(waiterCheckIns.userId, ctx.user.id),
              eq(waiterCheckIns.date, todayStr),
              isNull(waiterCheckIns.checkedOutAt)
            )
          )
          .limit(1);

        if (!checkIn) {
          // Notificar admin que garçom está aguardando liberação (throttled: 1x a cada 10min)
          const waiterName = ctx.user.name || 'Garçom';
          if (shouldNotifyAdmin(ctx.user.id, input.companyId)) {
            void notifyOwner({
              title: `🔔 ${waiterName} aguardando check-in`,
              content: `O garçom ${waiterName} está tentando acessar o sistema e precisa de liberação.`,
            }).catch(() => {});
            void sendPushToCompany(
              input.companyId,
              `🔔 ${waiterName} aguardando check-in`,
              `Acesse Salão > Configurar para liberar o acesso.`
            ).catch(() => {});
          }
          return { allowed: false, reason: 'Aguardando liberação do administrador. Solicite o check-in ao gerente.', needsCheckIn: true };
        }
      }

      return { allowed: true, reason: null };
    }),

  // Admin: listar garçons da empresa com status de check-in de hoje
  listWaiters: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const now = getNowInBrazil();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const waiters = await db
        .select({
          userId: userCompanies.userId,
          userName: users.name,
          userEmail: users.email,
        })
        .from(userCompanies)
        .innerJoin(users, eq(userCompanies.userId, users.id))
        .where(
          and(
            eq(userCompanies.companyId, input.companyId),
            eq(userCompanies.role, 'garcom')
          )
        );

      // Buscar check-ins de hoje
      const todayCheckIns = waiters.length > 0
        ? await db
            .select()
            .from(waiterCheckIns)
            .where(
              and(
                eq(waiterCheckIns.companyId, input.companyId),
                eq(waiterCheckIns.date, todayStr)
              )
            )
        : [];

      return waiters.map(w => {
        const checkIn = todayCheckIns.find(c => c.userId === w.userId);
        return {
          userId: w.userId,
          name: w.userName || w.userEmail || 'Sem nome',
          checkedIn: !!checkIn && !checkIn.checkedOutAt,
          checkInId: checkIn?.id || null,
          checkedInAt: checkIn?.checkedInAt || null,
          checkedOutAt: checkIn?.checkedOutAt || null,
        };
      });
    }),

  // Admin: fazer check-in do garçom
  waiterCheckIn: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      waiterId: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const now = getNowInBrazil();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      await db
        .insert(waiterCheckIns)
        .values({
          companyId: input.companyId,
          userId: input.waiterId,
          date: todayStr,
          checkedInBy: ctx.user.id,
          notes: input.notes || null,
        })
        .onDuplicateKeyUpdate({
          set: {
            checkedInAt: new Date(),
            checkedInBy: ctx.user.id,
            checkedOutAt: null,
            notes: input.notes || null,
          },
        });

      return { success: true };
    }),

  // Admin: fazer check-out do garçom
  waiterCheckOut: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      waiterId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const now = getNowInBrazil();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      await db
        .update(waiterCheckIns)
        .set({ checkedOutAt: new Date() })
        .where(
          and(
            eq(waiterCheckIns.companyId, input.companyId),
            eq(waiterCheckIns.userId, input.waiterId),
            eq(waiterCheckIns.date, todayStr)
          )
        );

      return { success: true };
    }),

  // ==================== PAINEL DE PRESENÇA (DASHBOARD) ====================

  waiterPresence: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { waiters: [], config: null };

      const companyId = ctx.activeCompanyId;
      if (!companyId) return { waiters: [], config: null };

      const now = getNowInBrazil();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Get salon config for opening/closing times
      const [config] = await db
        .select({
          waiterAccessControl: salonConfig.waiterAccessControl,
          requireCheckIn: salonConfig.requireCheckIn,
          openingTime: salonConfig.openingTime,
          closingTime: salonConfig.closingTime,
        })
        .from(salonConfig)
        .where(eq(salonConfig.companyId, companyId))
        .limit(1);

      // Get all waiters for this company
      const waiters = await db
        .select({
          userId: userCompanies.userId,
          userName: users.name,
          userEmail: users.email,
        })
        .from(userCompanies)
        .innerJoin(users, eq(userCompanies.userId, users.id))
        .where(
          and(
            eq(userCompanies.companyId, companyId),
            eq(userCompanies.role, 'garcom')
          )
        );

      if (waiters.length === 0) return { waiters: [], config: config || null };

      // Get today's check-ins
      const todayCheckIns = await db
        .select()
        .from(waiterCheckIns)
        .where(
          and(
            eq(waiterCheckIns.companyId, companyId),
            eq(waiterCheckIns.date, todayStr)
          )
        );

      // Get today's order count per waiter (closed orders)
      const nowStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const todayStart = new Date(nowStr + 'T00:00:00-03:00');
      const nextDay = new Date(nowStr + 'T00:00:00-03:00');
      nextDay.setDate(nextDay.getDate() + 1);

      const waiterIds = waiters.map(w => w.userId);
      const orderCounts = await db
        .select({
          waiterId: salonOrders.waiterId,
          count: sql<number>`COUNT(*)`,
          revenue: sql<string>`COALESCE(SUM(subtotal), 0)`,
        })
        .from(salonOrders)
        .where(
          and(
            eq(salonOrders.companyId, companyId),
            eq(salonOrders.status, 'CLOSED'),
            inArray(salonOrders.waiterId, waiterIds),
            gte(salonOrders.closedAt, todayStart),
            lt(salonOrders.closedAt, nextDay)
          )
        )
        .groupBy(salonOrders.waiterId);

      const result = waiters.map(w => {
        const checkIn = todayCheckIns.find(c => c.userId === w.userId);
        const orders = orderCounts.find(o => o.waiterId === w.userId);
        return {
          userId: w.userId,
          name: w.userName || w.userEmail || 'Sem nome',
          status: checkIn && !checkIn.checkedOutAt ? 'active' as const : checkIn?.checkedOutAt ? 'checked_out' as const : 'absent' as const,
          checkedInAt: checkIn?.checkedInAt || null,
          checkedOutAt: checkIn?.checkedOutAt || null,
          todayOrders: Number(orders?.count ?? 0),
          todayRevenue: orders?.revenue ?? '0',
        };
      });

      // Sort: active first, then checked_out, then absent
      const statusOrder = { active: 0, checked_out: 1, absent: 2 };
      result.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

      return { waiters: result, config: config || null };
    }),

  // ==================== WEB PUSH SUBSCRIPTIONS ====================

  pushSubscribe: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      subscription: z.object({
        endpoint: z.string(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      return await savePushSubscription(
        ctx.user.id,
        input.companyId,
        input.subscription
      );
    }),

  pushUnsubscribe: protectedProcedure
    .input(z.object({
      endpoint: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await removePushSubscription(input.endpoint);
    }),

  testPush: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ input }) => {
      return await sendPushToCompany(input.companyId, {
        title: "\ud83d\udd14 Teste de Notifica\u00e7\u00e3o",
        body: "As notifica\u00e7\u00f5es push est\u00e3o funcionando!",
        icon: "/logo-abrwf.png",
        data: { url: "/salao/mesas" },
      });
    }),

  // --- Transferência de Comanda ---
  getWaiterActiveOrders: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Get all waiters for this company
      const waiters = await db
        .select({
          userId: userCompanies.userId,
          role: userCompanies.role,
          userName: users.name,
          userEmail: users.email,
        })
        .from(userCompanies)
        .innerJoin(users, eq(users.id, userCompanies.userId))
        .where(
          and(
            eq(userCompanies.companyId, input.companyId),
            inArray(userCompanies.role, ['garcom', 'admin'])
          )
        )
        .orderBy(users.name);

      // Get all open/waiting_payment orders for this company
      const orders = await db
        .select({
          id: salonOrders.id,
          tableNumber: salonOrders.tableNumber,
          waiterId: salonOrders.waiterId,
          waiterName: salonOrders.waiterName,
          guestCount: salonOrders.guestCount,
          status: salonOrders.status,
          subtotal: salonOrders.subtotal,
          totalAmount: salonOrders.totalAmount,
          openedAt: salonOrders.openedAt,
          notes: salonOrders.notes,
        })
        .from(salonOrders)
        .where(
          and(
            eq(salonOrders.companyId, input.companyId),
            inArray(salonOrders.status, ["OPEN", "WAITING_PAYMENT"])
          )
        )
        .orderBy(salonOrders.openedAt);

      // Get item count per order
      const orderIds = orders.map(o => o.id);
      let itemCounts: Record<number, number> = {};
      if (orderIds.length > 0) {
        const counts = await db
          .select({
            orderId: salonOrderItems.orderId,
            count: sql<number>`COUNT(*)`,
          })
          .from(salonOrderItems)
          .where(inArray(salonOrderItems.orderId, orderIds))
          .groupBy(salonOrderItems.orderId);
        for (const c of counts) {
          itemCounts[c.orderId] = Number(c.count);
        }
      }

      // Group orders by waiter
      const waiterMap: Record<string, {
        userId: string;
        userName: string | null;
        userEmail: string | null;
        role: string;
        orders: typeof orders;
      }> = {};

      for (const w of waiters) {
        waiterMap[w.userId] = {
          userId: w.userId,
          userName: w.userName,
          userEmail: w.userEmail,
          role: w.role,
          orders: [],
        };
      }

      for (const order of orders) {
        const wId = order.waiterId ?? 'unknown';
        if (!waiterMap[wId]) {
          waiterMap[wId] = {
            userId: wId,
            userName: order.waiterName,
            userEmail: null,
            role: 'garcom',
            orders: [],
          };
        }
        (waiterMap[wId].orders as any[]).push({
          ...order,
          itemCount: itemCounts[order.id] ?? 0,
        });
      }

      return Object.values(waiterMap);
    }),

  transferOrder: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      companyId: z.number(),
      newWaiterId: z.string(),
      newWaiterName: z.string(),
      reason: z.string().min(1, "Motivo é obrigatório"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Only admin can transfer
      if (ctx.user?.role !== 'admin') {
        throw new Error("Apenas administradores podem transferir comandas");
      }

      // Get current order
      const [order] = await db
        .select()
        .from(salonOrders)
        .where(
          and(
            eq(salonOrders.id, input.orderId),
            eq(salonOrders.companyId, input.companyId)
          )
        )
        .limit(1);

      if (!order) throw new Error("Comanda não encontrada");
      if (order.status === 'CLOSED' || order.status === 'CANCELLED') {
        throw new Error("Não é possível transferir comanda encerrada ou cancelada");
      }

      const oldWaiterId = order.waiterId;
      const oldWaiterName = order.waiterName;
      const now = getNowInBrazil();

      // Build transfer log
      const transferLog = {
        type: 'TRANSFER',
        timestamp: now.toISOString(),
        adminId: ctx.user.id,
        adminName: ctx.user.name,
        fromWaiterId: oldWaiterId,
        fromWaiterName: oldWaiterName,
        toWaiterId: input.newWaiterId,
        toWaiterName: input.newWaiterName,
        reason: input.reason,
      };

      // Append to existing notes as JSON log
      const existingNotes = order.notes ?? '';
      const separator = existingNotes ? '\n---TRANSFER---\n' : '';
      const updatedNotes = existingNotes + separator + JSON.stringify(transferLog);

      // Update the order
      await db
        .update(salonOrders)
        .set({
          waiterId: input.newWaiterId,
          waiterName: input.newWaiterName,
          notes: updatedNotes,
        })
        .where(eq(salonOrders.id, input.orderId));

      return {
        success: true,
        transfer: {
          orderId: input.orderId,
          tableNumber: order.tableNumber,
          from: oldWaiterName,
          to: input.newWaiterName,
          reason: input.reason,
          timestamp: now.toISOString(),
        },
      };
    }),

  getTransferHistory: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Search orders that have transfer logs in notes
      const conditions = [
        eq(salonOrders.companyId, input.companyId),
        sql`${salonOrders.notes} LIKE '%TRANSFER%'`,
      ];

      if (input.startDate) {
        conditions.push(gte(salonOrders.openedAt, new Date(input.startDate)));
      }
      if (input.endDate) {
        conditions.push(lte(salonOrders.openedAt, new Date(input.endDate)));
      }

      const orders = await db
        .select({
          id: salonOrders.id,
          tableNumber: salonOrders.tableNumber,
          status: salonOrders.status,
          notes: salonOrders.notes,
          openedAt: salonOrders.openedAt,
          closedAt: salonOrders.closedAt,
        })
        .from(salonOrders)
        .where(and(...conditions))
        .orderBy(sql`${salonOrders.openedAt} DESC`)
        .limit(100);

      // Parse transfer logs from notes
      const transfers: any[] = [];
      for (const order of orders) {
        const notes = order.notes ?? '';
        const parts = notes.split('---TRANSFER---');
        for (let i = 1; i < parts.length; i++) {
          try {
            const log = JSON.parse(parts[i].trim());
            transfers.push({
              orderId: order.id,
              tableNumber: order.tableNumber,
              orderStatus: order.status,
              ...log,
            });
          } catch { /* skip malformed */ }
        }
      }

      transfers.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return transfers;
    }),
});

// ==================== HELPERS ====================

async function recalcOrderTotals(db: any, orderId: number) {
  const [row] = await db
    .select({ subtotal: sql<string>`COALESCE(SUM(totalPrice), 0)` })
    .from(salonOrderItems)
    .where(
      and(
        eq(salonOrderItems.orderId, orderId),
        inArray(salonOrderItems.status, ["PENDING", "IN_PROGRESS", "READY", "DELIVERED"])
      )
    );

  const subtotal = parseFloat(String(row?.subtotal ?? "0"));

  // Get current tip percent
  const [order] = await db
    .select({ tipPercent: salonOrders.tipPercent })
    .from(salonOrders)
    .where(eq(salonOrders.id, orderId))
    .limit(1);

  const tipPercent = parseFloat(String(order?.tipPercent ?? "0"));
  const tipAmount = subtotal * (tipPercent / 100);
  const totalAmount = subtotal + tipAmount;

  await db
    .update(salonOrders)
    .set({
      subtotal: String(subtotal.toFixed(2)),
      tipAmount: String(tipAmount.toFixed(2)),
      totalAmount: String(totalAmount.toFixed(2)),
    })
    .where(eq(salonOrders.id, orderId));
}

function mapPaymentMethod(payments: Array<{ method: string; amount: number }>): string {
  const map: Record<string, string> = {
    CASH: "DINHEIRO",
    CREDIT: "CREDITO",
    DEBIT: "DEBITO",
    PIX: "PIX",
    VOUCHER: "VOUCHER",
  };
  if (payments.length === 1) {
    return map[payments[0].method] ?? "DINHEIRO";
  }
  // List each method used (e.g. "DINHEIRO + PIX")
  const uniqueMethods = [...new Set(payments.map(p => map[p.method] ?? p.method))];
  return uniqueMethods.join(" + ");
}
