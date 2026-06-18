import { z } from "zod";
import { eq, and, desc, sql, or, ne, SQL } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { internalSales, internalSaleItems, products, companies, partners, accountsPayable, receivables, receivableInstallments, productMapping, productMovements } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const internalSalesRouter = router({
  // Dashboard stats for internal sales
  dashboardStats: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Total vendido internamente no mês (como source)
      const [soldThisMonth] = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${internalSales.totalAmount} AS DECIMAL(10,2))), 0)`
      })
        .from(internalSales)
        .where(and(
          eq(internalSales.sourceCompanyId, input.companyId),
          eq(internalSales.status, "APPROVED"),
          sql`${internalSales.confirmedAt} >= ${firstDayOfMonth}`
        ));

      // Saldo a Receber (receivables linked to internalSaleId where companyId = source)
      const [receivableBalance] = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${receivables.totalAmount} AS DECIMAL(10,2)) - CAST(${receivables.receivedAmount} AS DECIMAL(10,2))), 0)`
      })
        .from(receivables)
        .where(and(
          eq(receivables.companyId, input.companyId),
          sql`${receivables.internalSaleId} IS NOT NULL`,
          sql`${receivables.status} IN ('PENDENTE', 'PARCIAL', 'VENCIDO')`
        ));

      // Saldo a Pagar (accountsPayable linked to internalSaleId where target company)
      const [payableBalance] = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(${accountsPayable.amount} AS DECIMAL(10,2))), 0)`
      })
        .from(accountsPayable)
        .where(and(
          sql`${accountsPayable.internalSaleId} IS NOT NULL`,
          eq(accountsPayable.status, "PENDING"),
          sql`${accountsPayable.internalSaleId} IN (SELECT id FROM internalSales WHERE targetCompanyId = ${input.companyId})`
        ));

      // Pendentes de confirmação (where this company is source or target)
      const [pendingCount] = await db.select({
        count: sql<number>`COUNT(*)`
      })
        .from(internalSales)
        .where(and(
          eq(internalSales.status, "PENDING"),
          or(
            eq(internalSales.sourceCompanyId, input.companyId),
            eq(internalSales.targetCompanyId, input.companyId)
          )
        ));

      return {
        totalSoldThisMonth: parseFloat(soldThisMonth?.total || "0"),
        totalReceivable: parseFloat(receivableBalance?.total || "0"),
        totalPayable: parseFloat(payableBalance?.total || "0"),
        pendingCount: pendingCount?.count || 0,
      };
    }),

  // List internal sales (visible to both source and target companies)
  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "ALL"]).optional().default("ALL"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions: SQL[] = [
        or(
          eq(internalSales.sourceCompanyId, input.companyId),
          eq(internalSales.targetCompanyId, input.companyId)
        )!,
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
      marginPercent: z.number().min(0).max(100).default(15),
      notes: z.string().optional(),
      items: z.array(z.object({
        sourceProductId: z.number(),
        productName: z.string(),
        quantity: z.number().positive(),
        unitCost: z.number().min(0),
        unitSalePrice: z.number().min(0),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      if (input.sourceCompanyId === input.targetCompanyId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa de origem e destino não podem ser a mesma" });
      }

      // Generate sequential docNumber: VI-YYYY-NNN
      const year = new Date().getFullYear();
      const [lastDoc] = await db.select({ docNumber: internalSales.docNumber })
        .from(internalSales)
        .where(sql`${internalSales.docNumber} LIKE ${'VI-' + year + '-%'}`)
        .orderBy(desc(internalSales.id))
        .limit(1);

      let nextNum = 1;
      if (lastDoc?.docNumber) {
        const parts = lastDoc.docNumber.split('-');
        const lastNum = parseInt(parts[2] || '0', 10);
        nextNum = lastNum + 1;
      }
      const docNumber = `VI-${year}-${String(nextNum).padStart(3, '0')}`;

      // Calculate total using sale prices
      const totalAmount = input.items.reduce((sum, item) => sum + (item.quantity * item.unitSalePrice), 0);

      // Create the internal sale
      const [result] = await db.insert(internalSales).values({
        sourceCompanyId: input.sourceCompanyId,
        sourceBranchId: input.sourceBranchId,
        targetCompanyId: input.targetCompanyId,
        targetBranchId: input.targetBranchId,
        docNumber,
        totalAmount: totalAmount.toFixed(2),
        marginPercent: input.marginPercent.toFixed(2),
        dueDays: 25,
        notes: input.notes || null,
        status: "PENDING",
        createdBy: ctx.user.id,
      });

      const internalSaleId = Number(result.insertId);

      // Create items
      for (const item of input.items) {
        const totalCost = item.quantity * item.unitCost;
        const totalSalePrice = item.quantity * item.unitSalePrice;
        await db.insert(internalSaleItems).values({
          internalSaleId,
          sourceProductId: item.sourceProductId,
          productName: item.productName,
          quantity: item.quantity.toString(),
          unitCost: item.unitCost.toFixed(4),
          totalCost: totalCost.toFixed(2),
          unitSalePrice: item.unitSalePrice.toFixed(4),
          totalSalePrice: totalSalePrice.toFixed(2),
        });
      }

      return { id: internalSaleId, totalAmount, docNumber };
    }),

  // Check unmapped products for an internal sale (used before approval)
  checkMapping: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [sale] = await db.select().from(internalSales).where(eq(internalSales.id, input.id)).limit(1);
      if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Venda interna não encontrada" });

      const items = await db.select().from(internalSaleItems).where(eq(internalSaleItems.internalSaleId, input.id));

      // Get existing mappings for this source->target pair
      const mappings = await db.select().from(productMapping)
        .where(and(
          eq(productMapping.sourceCompanyId, sale.sourceCompanyId),
          eq(productMapping.targetCompanyId, sale.targetCompanyId)
        ));

      const mappingMap = new Map(mappings.map(m => [m.sourceProductId, m.targetProductId]));

      const mapped: { sourceProductId: number; productName: string; targetProductId: number; targetProductName?: string }[] = [];
      const unmapped: { sourceProductId: number; productName: string }[] = [];

      for (const item of items) {
        const targetId = mappingMap.get(item.sourceProductId);
        if (targetId) {
          const [targetProd] = await db.select({ name: products.name }).from(products).where(eq(products.id, targetId)).limit(1);
          mapped.push({ sourceProductId: item.sourceProductId, productName: item.productName, targetProductId: targetId, targetProductName: targetProd?.name });
        } else {
          unmapped.push({ sourceProductId: item.sourceProductId, productName: item.productName });
        }
      }

      return { mapped, unmapped, allMapped: unmapped.length === 0 };
    }),

  // Product Mapping CRUD (De/Para)
  mappingList: protectedProcedure
    .input(z.object({
      sourceCompanyId: z.number(),
      targetCompanyId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const mappings = await db.select().from(productMapping)
        .where(and(
          eq(productMapping.sourceCompanyId, input.sourceCompanyId),
          eq(productMapping.targetCompanyId, input.targetCompanyId)
        ));

      // Enrich with product names
      const result = [];
      for (const m of mappings) {
        const [sourceProd] = await db.select({ name: products.name }).from(products).where(eq(products.id, m.sourceProductId)).limit(1);
        const [targetProd] = await db.select({ name: products.name }).from(products).where(eq(products.id, m.targetProductId)).limit(1);
        result.push({
          ...m,
          sourceProductName: sourceProd?.name || `Produto #${m.sourceProductId}`,
          targetProductName: targetProd?.name || `Produto #${m.targetProductId}`,
        });
      }

      return result;
    }),

  mappingCreate: protectedProcedure
    .input(z.object({
      sourceCompanyId: z.number(),
      targetCompanyId: z.number(),
      sourceProductId: z.number(),
      targetProductId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerenciar o De/Para" });
      }

      const [existing] = await db.select().from(productMapping)
        .where(and(
          eq(productMapping.sourceCompanyId, input.sourceCompanyId),
          eq(productMapping.targetCompanyId, input.targetCompanyId),
          eq(productMapping.sourceProductId, input.sourceProductId)
        )).limit(1);

      if (existing) {
        await db.update(productMapping)
          .set({ targetProductId: input.targetProductId })
          .where(eq(productMapping.id, existing.id));
        return { id: existing.id, updated: true };
      }

      const [result] = await db.insert(productMapping).values({
        sourceCompanyId: input.sourceCompanyId,
        targetCompanyId: input.targetCompanyId,
        sourceProductId: input.sourceProductId,
        targetProductId: input.targetProductId,
        createdBy: ctx.user.id,
      });

      return { id: Number(result.insertId), updated: false };
    }),

  mappingDelete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerenciar o De/Para" });
      }

      await db.delete(productMapping).where(eq(productMapping.id, input.id));
      return { success: true };
    }),

  mappingBulkCreate: protectedProcedure
    .input(z.object({
      sourceCompanyId: z.number(),
      targetCompanyId: z.number(),
      mappings: z.array(z.object({
        sourceProductId: z.number(),
        targetProductId: z.number(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerenciar o De/Para" });
      }

      let created = 0;
      let updated = 0;

      for (const m of input.mappings) {
        const [existing] = await db.select().from(productMapping)
          .where(and(
            eq(productMapping.sourceCompanyId, input.sourceCompanyId),
            eq(productMapping.targetCompanyId, input.targetCompanyId),
            eq(productMapping.sourceProductId, m.sourceProductId)
          )).limit(1);

        if (existing) {
          await db.update(productMapping)
            .set({ targetProductId: m.targetProductId })
            .where(eq(productMapping.id, existing.id));
          updated++;
        } else {
          await db.insert(productMapping).values({
            sourceCompanyId: input.sourceCompanyId,
            targetCompanyId: input.targetCompanyId,
            sourceProductId: m.sourceProductId,
            targetProductId: m.targetProductId,
            createdBy: ctx.user.id,
          });
          created++;
        }
      }

      return { created, updated };
    }),

  // Approve an internal sale (admin only) - v2 with financial records
  approve: protectedProcedure
    .input(z.object({ id: z.number() }))
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

      // Verify that the approver is from the target (receiving) company
      const userActiveCompanyId = ctx.activeCompanyId;
      if (userActiveCompanyId && userActiveCompanyId !== sale.targetCompanyId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas a empresa destino (que recebe) pode aprovar a venda interna" });
      }

      const items = await db.select().from(internalSaleItems).where(eq(internalSaleItems.internalSaleId, input.id));

      // Get mappings from productMapping table
      const mappings = await db.select().from(productMapping)
        .where(and(
          eq(productMapping.sourceCompanyId, sale.sourceCompanyId),
          eq(productMapping.targetCompanyId, sale.targetCompanyId)
        ));
      const mappingMap = new Map(mappings.map(m => [m.sourceProductId, m.targetProductId]));

      // Check all items are mapped
      const unmappedItems = items.filter(item => !mappingMap.has(item.sourceProductId));
      if (unmappedItems.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Existem ${unmappedItems.length} produto(s) sem De/Para configurado. Configure o mapeamento antes de aprovar.`,
        });
      }

      const confirmedAt = new Date();
      const dueDays = sale.dueDays || 25;
      const dueDate = new Date(confirmedAt.getTime() + dueDays * 24 * 60 * 60 * 1000);
      const totalAmount = parseFloat(sale.totalAmount?.toString() || "0");

      const docRef = sale.docNumber || `VI-${sale.id}`;

      // 1. Deduct stock from source company products + create SAIDA movement
      for (const item of items) {
        const [prod] = await db.select().from(products)
          .where(and(
            eq(products.id, item.sourceProductId),
            eq(products.companyId, sale.sourceCompanyId)
          )).limit(1);

        if (prod) {
          const currentStock = parseFloat(prod.currentStock?.toString() || "0");
          const qty = parseFloat(item.quantity?.toString() || "0");
          const newStock = Math.max(0, currentStock - qty);
          await db.update(products)
            .set({ currentStock: newStock })
            .where(eq(products.id, item.sourceProductId));

          // Register stock movement (SAIDA) in source company
          await db.insert(productMovements).values({
            companyId: sale.sourceCompanyId,
            branchId: sale.sourceBranchId,
            productId: item.sourceProductId,
            date: confirmedAt,
            type: "SAIDA",
            quantity: (-qty).toString(),
            documentNumber: docRef,
            userId: ctx.user.id,
            notes: `Venda Interna ${docRef} - Saída para ${sale.targetCompanyId === 1 ? 'Adega Beira Rio' : 'A Brasa Reune'}`,
          });
        }
      }

      // 2. Add stock to target company products (via De/Para mapping) + create ENTRADA movement
      for (const item of items) {
        const targetProductId = mappingMap.get(item.sourceProductId)!;
        const qty = parseFloat(item.quantity?.toString() || "0");
        const unitCost = parseFloat(item.unitCost?.toString() || "0");

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

          // Register stock movement (ENTRADA) in target company
          await db.insert(productMovements).values({
            companyId: sale.targetCompanyId,
            branchId: sale.targetBranchId,
            productId: targetProductId,
            date: confirmedAt,
            type: "ENTRADA",
            quantity: qty.toString(),
            documentNumber: docRef,
            userId: ctx.user.id,
            notes: `Venda Interna ${docRef} - Entrada de ${sale.sourceCompanyId === 1 ? 'Adega Beira Rio' : 'A Brasa Reune'}`,
          });
        }

        await db.update(internalSaleItems)
          .set({ targetProductId })
          .where(eq(internalSaleItems.id, item.id));
      }

      // 3. Create Contas a Receber in source company
      const [sourceCompany] = await db.select().from(companies).where(eq(companies.id, sale.sourceCompanyId)).limit(1);
      const [targetCompany] = await db.select().from(companies).where(eq(companies.id, sale.targetCompanyId)).limit(1);

      // Find target company as a customer/partner in source company's partners table
      const targetCompanyName = targetCompany?.tradeName || targetCompany?.name || `Empresa #${sale.targetCompanyId}`;
      let receivableCustomerId: number | null = null;
      const [existingCustomerPartner] = await db.select().from(partners)
        .where(and(
          eq(partners.companyId, sale.sourceCompanyId),
          eq(partners.name, targetCompanyName),
        )).limit(1);

      if (existingCustomerPartner) {
        receivableCustomerId = existingCustomerPartner.id;
      } else {
        // Try matching by company legal name
        const [matchByLegalName] = await db.select().from(partners)
          .where(and(
            eq(partners.companyId, sale.sourceCompanyId),
            sql`${partners.name} LIKE CONCAT('%', ${targetCompany?.name || ''}, '%')`,
          )).limit(1);
        if (matchByLegalName) {
          receivableCustomerId = matchByLegalName.id;
        } else {
          // Create the target company as a partner in source company
          const [newCustomerPartner] = await db.insert(partners).values({
            companyId: sale.sourceCompanyId,
            branchId: sale.sourceBranchId,
            name: targetCompanyName,
            tradeName: targetCompany?.tradeName,
            docNumber: targetCompany?.docNumber,
            partnerType: "CUSTOMER",
            phone: targetCompany?.phone,
          });
          receivableCustomerId = Number(newCustomerPartner.insertId);
        }
      }

      const [receivableResult] = await db.insert(receivables).values({
        companyId: sale.sourceCompanyId,
        branchId: sale.sourceBranchId,
        customerId: receivableCustomerId,
        internalSaleId: sale.id,
        totalAmount: totalAmount.toFixed(2),
        receivedAmount: "0.00",
        status: "PENDENTE",
        createdBy: ctx.user.id,
      });

      const receivableId = Number(receivableResult.insertId);

      // Create single installment for the receivable
      await db.insert(receivableInstallments).values({
        companyId: sale.sourceCompanyId,
        branchId: sale.sourceBranchId,
        receivableId,
        installmentNumber: 1,
        amount: totalAmount.toFixed(2),
        dueDate,
        status: "PENDENTE",
      });

      // 4. Create Contas a Pagar in target company
      const sourceCompanyName = sourceCompany?.tradeName || sourceCompany?.name || `Empresa #${sale.sourceCompanyId}`;

      // Find or create source company as supplier in target company
      let supplierId: number | null = null;
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

      await db.insert(accountsPayable).values({
        companyId: sale.targetCompanyId,
        branchId: sale.targetBranchId,
        description: `Venda Interna ${sale.docNumber || '#' + sale.id} - ${sourceCompanyName}`,
        amount: totalAmount.toFixed(2),
        dueDate,
        status: "PENDING",
        supplierId,
        internalSaleId: sale.id,
        notes: `Ref: ${sale.docNumber || 'VI-' + sale.id}`,
      });

      // 5. Update internal sale status
      await db.update(internalSales)
        .set({
          status: "APPROVED",
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          confirmedAt,
          dueDate,
        })
        .where(eq(internalSales.id, input.id));

      return { success: true, dueDate, receivableId };
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
        ean: products.ean,
      })
        .from(products)
        .where(and(
          eq(products.companyId, input.companyId),
          eq(products.active, true),
        ))
        .orderBy(products.name)
        .limit(500);

      if (input.search) {
        const searchLower = input.search.toLowerCase();
        return results.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          (p.ean && p.ean.includes(input.search!))
        );
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
          ne(companies.id, input.sourceCompanyId)
        ));

      return result;
    }),
});
