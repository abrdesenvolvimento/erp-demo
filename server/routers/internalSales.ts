import { z } from "zod";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { internalSales, internalSaleItems, products, companies, partners, purchaseOrders, purchaseOrderItems } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const internalSalesRouter = router({
  // List internal sales (visible to both source and target companies)
  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "ALL"]).optional().default("ALL"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions = [
        or(
          eq(internalSales.sourceCompanyId, input.companyId),
          eq(internalSales.targetCompanyId, input.companyId)
        ),
      ];

      if (input.status !== "ALL") {
        conditions.push(eq(internalSales.status, input.status));
      }

      const results = await db
        .select()
        .from(internalSales)
        .where(and(...conditions))
        .orderBy(desc(internalSales.createdAt))
        .limit(100);

      // Enrich with company names
      const allCompanyIds = [...new Set(results.flatMap(r => [r.sourceCompanyId, r.targetCompanyId]))];
      const companyNames: Record<number, string> = {};
      if (allCompanyIds.length > 0) {
        const comps = await db.select({ id: companies.id, tradeName: companies.tradeName, name: companies.name })
          .from(companies)
          .where(sql`${companies.id} IN (${sql.join(allCompanyIds.map(id => sql`${id}`), sql`, `)})`);
        for (const c of comps) {
          companyNames[c.id] = c.tradeName || c.name;
        }
      }

      return results.map(r => ({
        ...r,
        sourceCompanyName: companyNames[r.sourceCompanyId] || `Empresa #${r.sourceCompanyId}`,
        targetCompanyName: companyNames[r.targetCompanyId] || `Empresa #${r.targetCompanyId}`,
        direction: r.sourceCompanyId === input.companyId ? 'SENT' as const : 'RECEIVED' as const,
      }));
    }),

  // Get details of a single internal sale with items
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [sale] = await db.select().from(internalSales).where(eq(internalSales.id, input.id)).limit(1);
      if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Venda interna não encontrada" });

      const items = await db.select().from(internalSaleItems).where(eq(internalSaleItems.internalSaleId, input.id));

      // Get company names
      const [sourceCompany] = await db.select({ tradeName: companies.tradeName, name: companies.name })
        .from(companies).where(eq(companies.id, sale.sourceCompanyId)).limit(1);
      const [targetCompany] = await db.select({ tradeName: companies.tradeName, name: companies.name })
        .from(companies).where(eq(companies.id, sale.targetCompanyId)).limit(1);

      return {
        ...sale,
        sourceCompanyName: sourceCompany?.tradeName || sourceCompany?.name || `Empresa #${sale.sourceCompanyId}`,
        targetCompanyName: targetCompany?.tradeName || targetCompany?.name || `Empresa #${sale.targetCompanyId}`,
        items,
      };
    }),

  // Create a new internal sale (transfer from source to target)
  create: protectedProcedure
    .input(z.object({
      sourceCompanyId: z.number(),
      sourceBranchId: z.number().default(1),
      targetCompanyId: z.number(),
      targetBranchId: z.number().default(1),
      notes: z.string().optional(),
      items: z.array(z.object({
        sourceProductId: z.number(),
        productName: z.string(),
        quantity: z.number().positive(),
        unitCost: z.number().min(0),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      if (input.sourceCompanyId === input.targetCompanyId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa de origem e destino não podem ser a mesma" });
      }

      // Calculate total
      const totalAmount = input.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

      // Create the internal sale
      const [result] = await db.insert(internalSales).values({
        sourceCompanyId: input.sourceCompanyId,
        sourceBranchId: input.sourceBranchId,
        targetCompanyId: input.targetCompanyId,
        targetBranchId: input.targetBranchId,
        totalAmount: totalAmount.toFixed(2),
        notes: input.notes || null,
        status: "PENDING",
        createdBy: ctx.user.id,
      });

      const internalSaleId = result.insertId;

      // Create items
      for (const item of input.items) {
        await db.insert(internalSaleItems).values({
          internalSaleId: Number(internalSaleId),
          sourceProductId: item.sourceProductId,
          productName: item.productName,
          quantity: item.quantity.toString(),
          unitCost: item.unitCost.toFixed(4),
          totalCost: (item.quantity * item.unitCost).toFixed(2),
        });
      }

      return { id: Number(internalSaleId), totalAmount };
    }),

  // Approve an internal sale (admin only)
  approve: protectedProcedure
    .input(z.object({
      id: z.number(),
      productMapping: z.array(z.object({
        sourceProductId: z.number(),
        targetProductId: z.number(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem aprovar vendas internas" });
      }

      const [sale] = await db.select().from(internalSales).where(eq(internalSales.id, input.id)).limit(1);
      if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Venda interna não encontrada" });
      if (sale.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Venda interna já está com status: ${sale.status}` });
      }

      const items = await db.select().from(internalSaleItems).where(eq(internalSaleItems.internalSaleId, input.id));

      // 1. Deduct stock from source company products
      for (const item of items) {
        const [prod] = await db.select().from(products)
          .where(and(
            eq(products.id, item.sourceProductId),
            eq(products.companyId, sale.sourceCompanyId)
          )).limit(1);

        if (prod) {
          const currentStock = parseFloat(prod.currentStock?.toString() || "0");
          const qty = parseFloat(item.quantity?.toString() || "0");
          const newStock = Math.max(0, Math.round(currentStock - qty));
          await db.update(products)
            .set({ currentStock: newStock })
            .where(eq(products.id, item.sourceProductId));
        }
      }

      // 2. Find or create the source company as a supplier in the target company
      const [sourceCompany] = await db.select().from(companies).where(eq(companies.id, sale.sourceCompanyId)).limit(1);
      const sourceCompanyName = sourceCompany?.tradeName || sourceCompany?.name || `Empresa #${sale.sourceCompanyId}`;

      let supplierId: number;
      const [existingPartner] = await db.select().from(partners)
        .where(and(
          eq(partners.companyId, sale.targetCompanyId),
          eq(partners.name, sourceCompanyName),
          or(eq(partners.partnerType, "SUPPLIER"), eq(partners.partnerType, "BOTH"))
        )).limit(1);

      if (existingPartner) {
        supplierId = existingPartner.id;
      } else {
        const [newPartner] = await db.insert(partners).values({
          companyId: sale.targetCompanyId,
          branchId: sale.targetBranchId,
          name: sourceCompanyName,
          tradeName: sourceCompany?.tradeName,
          docNumber: sourceCompany?.docNumber,
          partnerType: "SUPPLIER",
          phone: sourceCompany?.phone,
        });
        supplierId = Number(newPartner.insertId);
      }

      // 3. Create a purchase order in the target company
      const [poResult] = await db.insert(purchaseOrders).values({
        companyId: sale.targetCompanyId,
        branchId: sale.targetBranchId,
        supplierId: supplierId,
        docType: "SEM_DOCUMENTO",
        issueDate: new Date(),
        postingDate: new Date(),
        totalAmount: sale.totalAmount?.toString() || "0",
        paymentMethod: "TRANSFERENCIA_INTERNA",
        status: "CONFIRMED",
        notes: `Venda Interna #${sale.id} - Origem: ${sourceCompanyName}`,
        createdBy: ctx.user.id,
      });

      const purchaseOrderId = Number(poResult.insertId);

      // 4. Create purchase order items and update stock in target company
      const productMappingMap = new Map(
        (input.productMapping || []).map(m => [m.sourceProductId, m.targetProductId])
      );

      for (const item of items) {
        const targetProductId = productMappingMap.get(item.sourceProductId);

        if (targetProductId) {
          const qty = parseFloat(item.quantity?.toString() || "0");
          const unitCost = parseFloat(item.unitCost?.toString() || "0");

          await db.insert(purchaseOrderItems).values({
            companyId: sale.targetCompanyId,
            branchId: sale.targetBranchId,
            purchaseOrderId,
            productId: targetProductId,
            quantity: qty.toString(),
            unitCost: unitCost.toFixed(4),
            totalCost: (qty * unitCost).toFixed(2),
          });

          // Update stock in target company
          const [targetProd] = await db.select().from(products)
            .where(eq(products.id, targetProductId)).limit(1);

          if (targetProd) {
            const currentStock = parseFloat(targetProd.currentStock?.toString() || "0");
            const currentAvgCost = parseFloat(targetProd.avgCost?.toString() || "0");
            const newStock = currentStock + qty;
            const newAvgCost = currentStock > 0
              ? (currentStock * currentAvgCost + qty * unitCost) / newStock
              : unitCost;

            await db.update(products)
              .set({ currentStock: Math.round(newStock), avgCost: newAvgCost.toFixed(2) })
              .where(eq(products.id, targetProductId));
          }

          await db.update(internalSaleItems)
            .set({ targetProductId })
            .where(eq(internalSaleItems.id, item.id));
        }
      }

      // 5. Update internal sale status
      await db.update(internalSales)
        .set({
          status: "APPROVED",
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          generatedPurchaseOrderId: purchaseOrderId,
        })
        .where(eq(internalSales.id, input.id));

      return { success: true, purchaseOrderId };
    }),

  // Reject an internal sale (admin only)
  reject: protectedProcedure
    .input(z.object({
      id: z.number(),
      reason: z.string().min(1, "Motivo da rejeição é obrigatório"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem rejeitar vendas internas" });
      }

      const [sale] = await db.select().from(internalSales).where(eq(internalSales.id, input.id)).limit(1);
      if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Venda interna não encontrada" });
      if (sale.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Venda interna já está com status: ${sale.status}` });
      }

      await db.update(internalSales)
        .set({
          status: "REJECTED",
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          rejectionReason: input.reason,
        })
        .where(eq(internalSales.id, input.id));

      return { success: true };
    }),

  // Cancel an internal sale (only by creator, only if PENDING)
  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [sale] = await db.select().from(internalSales).where(eq(internalSales.id, input.id)).limit(1);
      if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Venda interna não encontrada" });
      if (sale.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Só é possível cancelar vendas internas pendentes" });
      }
      if (sale.createdBy !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o criador ou admin pode cancelar" });
      }

      await db.update(internalSales)
        .set({ status: "CANCELLED" })
        .where(eq(internalSales.id, input.id));

      return { success: true };
    }),

  // Get products from a specific company (for selecting items to transfer)
  getCompanyProducts: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const results = await db.select({
        id: products.id,
        name: products.name,
        currentStock: products.currentStock,
        avgCost: products.avgCost,
        uom: products.uom,
      })
        .from(products)
        .where(and(
          eq(products.companyId, input.companyId),
          eq(products.active, true),
        ))
        .orderBy(products.name)
        .limit(200);

      if (input.search) {
        const searchLower = input.search.toLowerCase();
        return results.filter(p => p.name.toLowerCase().includes(searchLower));
      }

      return results;
    }),

  // Get available target companies (all companies except the source)
  getTargetCompanies: protectedProcedure
    .input(z.object({ sourceCompanyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db.select({
        id: companies.id,
        name: companies.name,
        tradeName: companies.tradeName,
      })
        .from(companies)
        .where(and(
          eq(companies.active, true),
          sql`${companies.id} != ${input.sourceCompanyId}`
        ));

      return result;
    }),
});
