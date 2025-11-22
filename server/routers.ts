import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== USUÁRIOS ====================
  users: router({
    list: protectedProcedure
      .query(async ({ ctx }) => {
        // Apenas admins podem listar usuários
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem listar usuários' });
        }
        return await db.getAllUsers();
      }),
    
    updateRole: protectedProcedure
      .input(z.object({
        userId: z.string(),
        role: z.enum(['admin', 'user'])
      }))
      .mutation(async ({ ctx, input }) => {
        // Apenas admins podem alterar roles
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem alterar permissões' });
        }
        // Não pode alterar o próprio role
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Você não pode alterar seu próprio nível de acesso' });
        }
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),
  }),

  // ==================== CATEGORIAS ====================
  categories: router({
    list: protectedProcedure
      .input(z.object({ activeOnly: z.boolean().optional().default(true) }).optional())
      .query(async ({ input }) => {
        return await db.getCategories(input?.activeOnly ?? true);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        active: z.boolean().optional().default(true),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createCategory(input);
        return { id, success: true };
      }),
  }),

  // ==================== SUBCATEGORIAS ====================
  subcategories: router({
    list: protectedProcedure
      .input(z.object({ categoryId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getSubcategories(input?.categoryId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        categoryId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createSubcategory(input);
        return { id, success: true };
      }),
  }),

  // ==================== CANAIS DE VENDA ====================
  salesChannels: router({
    list: protectedProcedure
      .input(z.object({ activeOnly: z.boolean().optional().default(true) }).optional())
      .query(async ({ input }) => {
        return await db.getSalesChannels(input?.activeOnly ?? true);
      }),
    
    create: protectedProcedure
      .input(z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        type: z.enum(["BALCAO", "DELIVERY"]),
        active: z.boolean().optional().default(true),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createSalesChannel(input);
        return { id, success: true };
      }),
  }),

  // ==================== PRODUTOS ====================
  products: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        categoryId: z.number().optional(),
        activeOnly: z.boolean().optional().default(true),
      }).optional())
      .query(async ({ input }) => {
        return await db.getProducts(input);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProduct(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        categoryId: z.number(),
        subcategoryId: z.number().optional(),
        subcategory: z.string().optional(),
        ean: z.string().optional(),
        uom: z.string().min(1),
        minStock: z.number().optional().default(0),
        currentStock: z.number().optional().default(0),
        avgCost: z.string().optional().default("0.00"),
        active: z.boolean().optional().default(true),
        isComposite: z.boolean().optional().default(false),
        notes: z.string().optional(),
        prices: z.record(z.string(), z.string()).optional(),
        compositions: z.array(z.object({
          childProductId: z.number(),
          quantity: z.union([z.number(), z.string()]).transform(val => typeof val === 'number' ? val : parseFloat(val)),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        console.log('[products.create] Received input:', JSON.stringify(input, null, 2));
        const { prices, compositions, ...productData } = input;
        console.log('[products.create] Compositions extracted:', compositions);
        const id = await db.createProduct(productData);
        console.log('[products.create] Product created with ID:', id);
        
        if (!id || isNaN(id)) {
          throw new Error("Failed to create product: invalid ID returned");
        }
        
        // Salvar preços por canal
        if (prices) {
          for (const [channelId, price] of Object.entries(prices)) {
            if (price && parseFloat(price) > 0) {
              await db.setProductPrice({
                productId: id,
                channelId: parseInt(channelId),
                price: price,
              });
            }
          }
        }
        
        // Salvar composições se for produto composto
        console.log('[products.create] Checking compositions:', { hasCompositions: !!compositions, length: compositions?.length });
        if (compositions && compositions.length > 0) {
          console.log('[products.create] Saving compositions for product', id, ':', compositions);
          await db.setProductCompositions(id, compositions);
          console.log('[products.create] Compositions saved successfully');
        } else {
          console.log('[products.create] No compositions to save');
        }
        
        return { id, success: true };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          name: z.string().optional(),
          categoryId: z.number().optional(),
          subcategoryId: z.number().optional(),
          subcategory: z.string().optional(),
          ean: z.string().optional(),
          uom: z.string().optional(),
          minStock: z.number().optional(),
          currentStock: z.number().optional(),
          avgCost: z.string().optional(),
          isComposite: z.boolean().optional(),
          notes: z.string().optional(),
          active: z.boolean().optional(),
          prices: z.record(z.string(), z.string()).optional(),
          compositions: z.array(z.object({
            childProductId: z.number(),
            quantity: z.union([z.number(), z.string()]).transform(val => typeof val === 'number' ? val : parseFloat(val)),
          })).optional(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        const { prices, compositions, ...updateData } = input.data;
        
        // Validar permissão de admin para ativar/desativar produtos
        if (updateData.active !== undefined && ctx.user?.role !== "admin") {
          throw new Error("Apenas administradores podem ativar/desativar produtos");
        }
        
        await db.updateProduct(input.id, updateData);
        
        // Atualizar preços por canal
        if (prices) {
          for (const [channelId, price] of Object.entries(prices)) {
            if (price && parseFloat(price) > 0) {
              await db.setProductPrice({
                productId: input.id,
                channelId: parseInt(channelId),
                price: price,
              });
            }
          }
        }
        
        // Atualizar composições se for produto composto
        console.log('[products.update] Compositions received:', { hasCompositions: compositions !== undefined, length: compositions?.length, compositions });
        if (compositions !== undefined) {
          console.log('[products.update] Updating compositions for product', input.id);
          await db.setProductCompositions(input.id, compositions);
        } else {
          console.log('[products.update] Compositions not provided, skipping update');
        }
        
        return { success: true };
      }),
    
    getPrices: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProductPrices(input.productId);
      }),
    
    setPrice: protectedProcedure
      .input(z.object({
        productId: z.number(),
        channelId: z.number(),
        price: z.string(),
        effectiveFrom: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.setProductPrice(input);
        return { id, success: true };
      }),
    
    getCompositions: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProductCompositionsWithDetails(input.productId);
      }),
    
    setCompositions: protectedProcedure
      .input(z.object({
        productId: z.number(),
        compositions: z.array(z.object({
          childProductId: z.number(),
          quantity: z.union([z.number(), z.string()]).transform(val => typeof val === 'number' ? val : parseFloat(val)),
        })),
      }))
      .mutation(async ({ input }) => {
        await db.setProductCompositions(input.productId, input.compositions);
        return { success: true };
      }),
  }),

  // ==================== PARCEIROS ====================
  partners: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        partnerType: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]).optional(),
        activeOnly: z.boolean().optional().default(true),
      }).optional())
      .query(async ({ input }) => {
        return await db.getPartners(input);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getPartner(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        tradeName: z.string().optional(),
        docNumber: z.string().optional(),
        partnerType: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
        phone: z.string().optional(),
        email: z.string().optional(),
        // Endereço separado
        street: z.string().optional(),
        streetNumber: z.string().optional(),
        complement: z.string().optional(),
        neighborhood: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        notes: z.string().optional(),
        creditLimit: z.string().optional().default("0.00"),
        creditPolicy: z.enum(["ACTIVE", "BLOCKED"]).optional().default("ACTIVE"),
        active: z.boolean().optional().default(true),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createPartner(input);
        return { id, success: true };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1),
        tradeName: z.string().optional(),
        docNumber: z.string().optional(),
        partnerType: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
        phone: z.string().optional(),
        email: z.string().optional(),
        street: z.string().optional(),
        streetNumber: z.string().optional(),
        complement: z.string().optional(),
        neighborhood: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        notes: z.string().optional(),
        creditLimit: z.string().optional(),
        creditPolicy: z.enum(["ACTIVE", "BLOCKED"]).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updatePartner(id, data);
        return { success: true };
      }),
  }),

  // ==================== VENDAS ====================
  sales: router({
    list: protectedProcedure
      .input(z.object({
        saleType: z.enum(["BALCAO", "DELIVERY", "A_PRAZO"]).optional(),
        customerId: z.number().optional(),
        limit: z.number().optional().default(50),
      }).optional())
      .query(async ({ input }) => {
        return await db.getSales(input);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const sale = await db.getSale(input.id);
        if (!sale) return null;
        
        const items = await db.getSaleItems(input.id);
        return { ...sale, items };
      }),
    
    create: protectedProcedure
      .input(z.object({
        saleType: z.enum(["BALCAO", "DELIVERY", "A_PRAZO"]),
        customerId: z.number().optional(),
        channelId: z.number().optional(),
        platformOrderId: z.string().optional(),
        subtotal: z.string(),
        discountAmount: z.string().optional().default("0.00"),
        surchargeAmount: z.string().optional().default("0.00"),
        finalAmount: z.string(),
        paymentMethod: z.string().optional(),
        adminApprovedBy: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number(),
          unitPrice: z.string(),
          totalPrice: z.string(),
        })),
        dueDates: z.array(z.object({
          date: z.date(),
          amount: z.string(),
        })).optional(), // Para vendas A_PRAZO
      }))
      .mutation(async ({ input, ctx }) => {
        const { items, ...saleData } = input;
        
        // Validar limite de crédito para vendas a prazo
        if (saleData.saleType === 'A_PRAZO' && saleData.customerId) {
          const customer = await db.getPartner(saleData.customerId);
          if (customer) {
            const currentBalance = parseFloat(customer.currentBalance || '0');
            const creditLimit = parseFloat(customer.creditLimit || '0');
            const saleAmount = parseFloat(saleData.finalAmount);
            
            if (currentBalance + saleAmount > creditLimit) {
              throw new Error('Limite de crédito excedido');
            }
          }
        }
        
        const { dueDates, ...saleDataWithoutDueDates } = saleData;
        
        const id = await db.createSale(
          { ...saleDataWithoutDueDates, createdBy: ctx.user.id },
          items
        );
        
        // Criar recebível automaticamente para vendas A_PRAZO
        if (saleData.saleType === 'A_PRAZO' && saleData.customerId) {
          const receivableId = await db.createReceivable({
            saleId: id,
            customerId: saleData.customerId,
            totalAmount: saleData.finalAmount,
            receivedAmount: "0.00",
            status: "PENDENTE",
            createdBy: ctx.user.id,
          });
          
          // Criar parcelas
          if (dueDates && dueDates.length > 0) {
            // Se dueDates foi fornecido, criar parcelas conforme especificado
            for (let i = 0; i < dueDates.length; i++) {
              await db.createReceivableInstallment({
                receivableId: receivableId.id,
                installmentNumber: i + 1,
                amount: dueDates[i].amount,
                dueDate: dueDates[i].date,
                status: "PENDENTE",
              });
            }
          } else {
            // Se não foi fornecido, criar uma única parcela com vencimento padrão (30 dias)
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);
            
            await db.createReceivableInstallment({
              receivableId: receivableId.id,
              installmentNumber: 1,
              amount: saleData.finalAmount,
              dueDate,
              status: "PENDENTE",
            });
          }
        }
        
        return { id, success: true };
      }),
    
    stats: protectedProcedure
      .input(z.object({
        period: z.enum(['today', 'week', 'month', 'all']).optional().default('month'),
      }).optional())
      .query(async ({ input }) => {
        return await db.getSalesStats(input?.period || 'month');
      }),
    
    update: adminProcedure
      .input(z.object({
        saleId: z.number(),
        items: z.array(z.object({
          id: z.number().optional(), // Se tem ID, é item existente; se não, é novo
          productId: z.number(),
          quantity: z.number(),
          unitPrice: z.string(),
          totalPrice: z.string(),
          _deleted: z.boolean().optional(), // Marca item para exclusão
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const { saleId, items } = input;
        
        // 1. Buscar venda existente
        const sale = await db.getSale(saleId);
        if (!sale) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Venda não encontrada' });
        }
        
        // 2. Validar limite de 24 horas
        if (!sale.saleDate) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Data da venda inválida' });
        }
        const saleDate = new Date(sale.saleDate);
        const now = new Date();
        const hoursDiff = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Não é possível editar vendas com mais de 24 horas' 
          });
        }
        
        // 3. Validar se recebível já foi pago (para vendas A_PRAZO)
        if (sale.saleType === 'A_PRAZO') {
          const receivable = await db.getReceivableBySaleId(saleId);
          if (receivable && parseFloat(receivable.receivedAmount) > 0) {
            throw new TRPCError({ 
              code: 'BAD_REQUEST', 
              message: 'Não é possível editar vendas com pagamento já recebido' 
            });
          }
        }
        
        // 4. Buscar itens atuais da venda
        const currentItems = await db.getSaleItems(saleId);
        
        // 5. Processar alterações de estoque
        // Devolver estoque dos itens antigos
        for (const oldItem of currentItems) {
          await db.updateProductStock(oldItem.productId, oldItem.quantity); // Adiciona de volta
        }
        
        // Descontar estoque dos novos itens
        for (const newItem of items) {
          if (!newItem._deleted) {
            await db.updateProductStock(newItem.productId, -newItem.quantity); // Remove
          }
        }
        
        // 6. Deletar todos os itens antigos
        await db.deleteSaleItems(saleId);
        
        // 7. Inserir novos itens (exceto os marcados como deletados)
        const activeItems = items.filter(item => !item._deleted);
        for (const item of activeItems) {
          await db.createSaleItem({
            saleId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          });
        }
        
        // 8. Recalcular valores totais
        const subtotal = activeItems.reduce((sum, item) => 
          sum + parseFloat(item.totalPrice), 0
        ).toFixed(2);
        
        const discountAmount = parseFloat(sale.discountAmount || '0');
        const surchargeAmount = parseFloat(sale.surchargeAmount || '0');
        const finalAmount = (parseFloat(subtotal) - discountAmount + surchargeAmount).toFixed(2);
        
        // 9. Atualizar venda
        await db.updateSale(saleId, {
          subtotal,
          finalAmount,
        });
        
        // 10. Atualizar recebível (se for venda A_PRAZO)
        if (sale.saleType === 'A_PRAZO') {
          await db.updateReceivableBySaleId(saleId, {
            totalAmount: finalAmount,
          });
        }
        
        return { success: true, newTotal: finalAmount };
      }),
  }),

  // ==================== COMPRAS ====================
  purchases: router({
    list: adminProcedure
      .input(z.object({
        status: z.string().optional(),
        supplierId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getPurchaseOrders(input);
      }),
    
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getPurchaseOrderById(input.id);
      }),
    
    getItems: adminProcedure
      .input(z.object({ purchaseOrderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPurchaseOrderItems(input.purchaseOrderId);
      }),
    
    searchProducts: adminProcedure
      .input(z.object({ search: z.string() }))
      .query(async ({ input }) => {
        return await db.searchProducts(input.search);
      }),
    
    create: adminProcedure
      .input(z.object({
        supplierId: z.number(),
        docType: z.enum(["NOTA_FISCAL", "CUPOM", "SEM_DOCUMENTO"]),
        docNumber: z.string().optional(),
        accessKey: z.string().optional(),
        issueDate: z.string(),
        postingDate: z.string(),
        paymentMethod: z.string(),
        freightCost: z.string().optional(),
        chargesCost: z.string().optional(),
        notes: z.string().optional(),
        installments: z.array(z.object({
          dueDate: z.string(),
          amount: z.number(),
        })),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number(),
          unitCost: z.number(),
          expiryDate: z.string().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const { items, installments, ...purchaseData } = input;
        
        // Calcular total
        const subtotal = items.reduce((sum, item) => 
          sum + (item.quantity * item.unitCost), 0
        );
        const freightCost = parseFloat(purchaseData.freightCost || "0");
        const chargesCost = parseFloat(purchaseData.chargesCost || "0");
        const totalAmount = subtotal + freightCost + chargesCost;
        
        // Criar ordem de compra
        const purchaseOrderData: any = {
          supplierId: purchaseData.supplierId,
          docType: purchaseData.docType,
          issueDate: new Date(purchaseData.issueDate),
          postingDate: new Date(purchaseData.postingDate),
          totalAmount: totalAmount.toFixed(2),
          freightCost: freightCost.toFixed(2),
          chargesCost: chargesCost.toFixed(2),
          paymentMethod: purchaseData.paymentMethod,
          status: "DRAFT",
          notes: purchaseData.notes || null,
          invoiceFilePath: null,
          createdBy: ctx.user.id,
        };
        
        // Adicionar campos opcionais apenas se tiverem valor
        if (purchaseData.docNumber) {
          purchaseOrderData.docNumber = purchaseData.docNumber;
        }
        if (purchaseData.accessKey) {
          purchaseOrderData.accessKey = purchaseData.accessKey;
        }
        
        const purchaseOrderId = await db.createPurchaseOrder(purchaseOrderData);
        
        // Adicionar itens
        for (const item of items) {
          const totalCost = item.quantity * item.unitCost;
          await db.addPurchaseOrderItem({
            purchaseOrderId,
            productId: item.productId,
            quantity: item.quantity.toString(),
            unitCost: item.unitCost.toFixed(4),
            totalCost: totalCost.toFixed(2),
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          });
        }
        
        // Adicionar parcelas
        for (let i = 0; i < installments.length; i++) {
          await db.addPurchaseInstallment({
            purchaseOrderId,
            installmentNumber: i + 1,
            dueDate: new Date(installments[i].dueDate),
            amount: installments[i].amount.toFixed(2),
            status: "PENDING",
          });
        }
        
        return { id: purchaseOrderId, success: true };
      }),
    
    confirm: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.confirmPurchaseOrder(input.id);
        return { success: true };
      }),
    
    cancel: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updatePurchaseOrder(input.id, { status: "CANCELLED" });
        return { success: true };
      }),
  }),

  // ==================== DESPESAS OPERACIONAIS ====================
  expenses: router({
    // Categorias
    categories: router({
      list: adminProcedure
        .input(z.object({ activeOnly: z.boolean().optional().default(true) }).optional())
        .query(async ({ input }) => {
          return await db.getExpenseCategories(input?.activeOnly ?? true);
        }),
      
      create: adminProcedure
        .input(z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          active: z.boolean().optional().default(true),
        }))
        .mutation(async ({ input }) => {
          const id = await db.createExpenseCategory(input);
          return { id, success: true };
        }),
      
      update: adminProcedure
        .input(z.object({
          id: z.number(),
          data: z.object({
            name: z.string().optional(),
            description: z.string().optional(),
            active: z.boolean().optional(),
          }),
        }))
        .mutation(async ({ input }) => {
          await db.updateExpenseCategory(input.id, input.data);
          return { success: true };
        }),
    }),
    
    // Despesas
    list: adminProcedure
      .input(z.object({
        categoryId: z.number().optional(),
        status: z.enum(["ATIVA", "CANCELADA"]).optional(),
        supplierId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getExpenses(input);
      }),
    
    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getExpenseById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        supplierId: z.number().optional(),
        docType: z.enum(["NOTA_FISCAL", "CUPOM"]),
        docNumber: z.string().optional(),
        categoryId: z.number(),
        description: z.string().min(3),
        amount: z.string(),
        paymentMethod: z.string(),
        dueDates: z.array(z.object({
          date: z.date(),
          amount: z.string()
        })).min(1), // Array de datas e valores de vencimento
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const expenseId = await db.createExpense({
          supplierId: input.supplierId,
          docType: input.docType,
          docNumber: input.docNumber,
          categoryId: input.categoryId,
          description: input.description,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          status: "ATIVA",
          createdBy: ctx.user.id,
        });
        
        // Criar parcelas com valores individuais
        for (let i = 0; i < input.dueDates.length; i++) {
          await db.createExpenseInstallment({
            expenseId,
            installmentNumber: i + 1,
            amount: input.dueDates[i].amount,
            dueDate: input.dueDates[i].date,
            status: "PENDENTE",
          });
        }
        
        return { id: expenseId, success: true };
      }),
    
    cancel: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.cancelExpense(input.id);
        return { success: true };
      }),
    
    // Parcelas
    installments: router({
      pending: protectedProcedure
        .input(z.object({
          categoryId: z.number().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        }).optional())
        .query(async ({ input }) => {
          return await db.getPendingExpenseInstallments(input);
        }),
      
      pay: protectedProcedure
        .input(z.object({
          id: z.number(),
          paymentDate: z.date(),
          paymentAmount: z.string(),
          paymentMethod: z.enum([
            "DINHEIRO",
            "PIX",
            "CARTAO_DEBITO",
            "CARTAO_CREDITO",
            "TRANSFERENCIA",
            "BOLETO"
          ]),
          notes: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          await db.payExpenseInstallment({ installmentId: input.id, paidDate: input.paymentDate, paidAmount: input.paymentAmount, paymentMethod: input.paymentMethod, notes: input.notes });
          return { success: true };
        }),
    }),
  }),

  // ==================== CONTAS A RECEBER ====================
  receivables: router({
    list: protectedProcedure
      .input(z.object({
        customerId: z.number().optional(),
        status: z.enum(["PENDENTE", "PARCIAL", "QUITADO", "VENCIDO"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.listReceivables(input);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getReceivableById(input.id);
      }),
    
    summary: protectedProcedure
      .query(async () => {
        return await db.getReceivablesSummary();
      }),
    
    // Gestão por cliente
    byCustomer: protectedProcedure
      .query(async () => {
        return await db.getCustomersWithPendingReceivables();
      }),
    
    totalPending: protectedProcedure
      .query(async () => {
        const total = await db.getTotalPendingReceivables();
        return { total: total.toFixed(2) };
      }),
    
    customerDetail: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCustomerReceivableDetail(input.customerId);
      }),
    
    registerPayment: protectedProcedure
      .input(z.object({
        customerId: z.number(),
        saleId: z.number().optional(),
        paidDate: z.date(),
        paidAmount: z.string(),
        paymentMethod: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.registerCustomerPayment(input);
      }),
    
    // Parcelas
    installments: router({
      pending: protectedProcedure
        .input(z.object({
          customerId: z.number().optional(),
        }).optional())
        .query(async ({ input }) => {
          return await db.listPendingReceivableInstallments(input?.customerId);
        }),
      
      overdue: protectedProcedure
        .query(async () => {
          return await db.listOverdueReceivableInstallments();
        }),
      
      pay: protectedProcedure
        .input(z.object({
          id: z.number(),
          paidDate: z.date(),
          paidAmount: z.string(),
          paymentMethod: z.string(),
          notes: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          await db.payReceivableInstallment(input.id, input);
          return { success: true };
        }),
    }),
  }),

  // ==================== CONTAS A PAGAR ====================
  payables: router({
    // Listar fornecedores com saldo devedor
    bySupplier: adminProcedure
      .query(async () => {
        return await db.getSuppliersWithPendingPayables();
      }),
    
    // Total pendente de pagamento
    totalPending: adminProcedure
      .query(async () => {
        const total = await db.getTotalPendingPayables();
        return { total: total.toFixed(2) };
      }),
    
    // Detalhamento de um fornecedor
    supplierDetail: adminProcedure
      .input(z.object({ supplierId: z.number() }))
      .query(async ({ input }) => {
        return await db.getSupplierPayableDetail(input.supplierId);
      }),
    
    // Registrar pagamento
    registerPayment: adminProcedure
      .input(z.object({
        supplierId: z.number(),
        expenseId: z.number().optional(),
        paidDate: z.date(),
        paidAmount: z.string(),
        paymentMethod: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.registerSupplierPayment(input);
      }),
    
    // Pagar parcela individual (compra ou despesa)
    payInstallment: adminProcedure
      .input(z.object({
        installmentId: z.number(),
        type: z.enum(['purchase', 'expense']),
        paidDate: z.date(),
        paidAmount: z.string(),
        paymentMethod: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        if (input.type === 'purchase') {
          return await db.payPurchaseInstallment(input);
        } else {
          return await db.payExpenseInstallment(input);
        }
      }),
    
    // Histórico de pagamentos
    paymentHistory: adminProcedure
      .input(z.object({
        supplierId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        docNumber: z.string().optional(),
        paymentMethod: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getPaymentHistory(input);
      }),
  }),

  // ==================== DASHBOARD ====================
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      const products = await db.getProducts({ activeOnly: false });
      const recentSales = await db.getSales({ limit: 10 });
      
      // Buscar TODAS as vendas do mês atual para cálculos corretos
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const allMonthSales = await db.getSales({ limit: 10000 }); // Buscar todas as vendas
      
      // Produtos com estoque baixo
      const lowStockProducts = products.filter(p => 
        p.currentStock !== null && p.minStock !== null && p.currentStock < p.minStock
      );
      
      // Vendas de hoje
      const todaySales = allMonthSales.filter(s => {
        const saleDate = new Date(s.saleDate!);
        return saleDate.toDateString() === today.toDateString();
      });
      
      const todayRevenue = todaySales.reduce((sum, sale) => 
        sum + parseFloat(sale.finalAmount || '0'), 0
      );
      
      // Faturamento diário por canal
      const todayRevenueBalcao = todaySales
        .filter(s => s.saleType === 'BALCAO' || s.saleType === 'A_PRAZO')
        .reduce((sum, sale) => sum + parseFloat(sale.finalAmount || '0'), 0);
      
      const todayRevenueDelivery = todaySales
        .filter(s => s.saleType === 'DELIVERY')
        .reduce((sum, sale) => sum + parseFloat(sale.finalAmount || '0'), 0);
      
      // Faturamento do mês atual - TODAS as vendas do mês
      const monthSales = allMonthSales.filter(s => {
        const saleDate = new Date(s.saleDate!);
        return saleDate >= firstDayOfMonth;
      });
      
      const monthRevenue = monthSales.reduce((sum, sale) => 
        sum + parseFloat(sale.finalAmount || '0'), 0
      );
      
      // Faturamento por canal
      const monthRevenueBalcao = monthSales
        .filter(s => s.saleType === 'BALCAO' || s.saleType === 'A_PRAZO')
        .reduce((sum, sale) => sum + parseFloat(sale.finalAmount || '0'), 0);
      
      const monthRevenueDelivery = monthSales
        .filter(s => s.saleType === 'DELIVERY')
        .reduce((sum, sale) => sum + parseFloat(sale.finalAmount || '0'), 0);
      
      // Total pendente a receber
      const totalPendingReceivables = await db.getTotalPendingReceivables();
      
      // Valor total em estoque (excluindo produtos compostos)
      const totalStockValue = products
        .filter(p => p.active && !p.isComposite && p.currentStock && p.avgCost)
        .reduce((sum, p) => sum + (parseFloat(p.currentStock!.toString()) * parseFloat(p.avgCost!.toString())), 0);
      
      // Valor em estoque por categoria (excluindo produtos compostos)
      const categories = await db.getCategories();
      const stockValueByCategory = categories.map(cat => {
        const categoryProducts = products.filter(p => p.active && !p.isComposite && p.categoryId === cat.id);
        const value = categoryProducts.reduce((sum, p) => {
          if (p.currentStock && p.avgCost) {
            return sum + (parseFloat(p.currentStock.toString()) * parseFloat(p.avgCost.toString()));
          }
          return sum;
        }, 0);
        
        // Mapear produtos com seus valores individuais
        const productsWithValue = categoryProducts
          .filter(p => p.currentStock && p.avgCost)
          .map(p => {
            const productValue = parseFloat(p.currentStock!.toString()) * parseFloat(p.avgCost!.toString());
            return {
              id: p.id,
              name: p.name,
              currentStock: p.currentStock,
              avgCost: parseFloat(p.avgCost!.toString()).toFixed(2),
              value: productValue.toFixed(2),
            };
          })
          .sort((a, b) => parseFloat(b.value) - parseFloat(a.value)); // Ordenar por valor (maior para menor)
        
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          value: value.toFixed(2),
          products: productsWithValue,
        };
      }).filter(c => parseFloat(c.value) > 0).sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
      
      // Produtos próximos ao vencimento (30 dias)
      const expiringProducts = products.filter(p => {
        if (!p.active || !p.expirationDate) return false;
        const expDate = new Date(p.expirationDate);
        const daysUntilExpiration = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiration <= 30;
      }).map(p => {
        const expDate = new Date(p.expirationDate!);
        const daysUntilExpiration = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: p.id,
          name: p.name,
          expirationDate: p.expirationDate,
          daysUntilExpiration,
          currentStock: p.currentStock,
        };
      }).sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
      
      // Buscar vendas recentes com detalhes (cliente e canal)
      const channels = await db.getSalesChannels();
      const recentSalesWithDetails = [];
      for (const sale of recentSales.slice(0, 5)) {
        const customer = sale.customerId ? await db.getPartner(sale.customerId) : null;
        const channel = sale.channelId ? channels.find(c => c.id === sale.channelId) : null;
        recentSalesWithDetails.push({
          ...sale,
          customerTradeName: customer?.tradeName || null,
          channelName: channel?.name || null,
        });
      }
      
      return {
        lowStockCount: lowStockProducts.length,
        lowStockProducts: lowStockProducts.map(p => ({
          id: p.id,
          name: p.name,
          currentStock: p.currentStock,
          minStock: p.minStock,
        })),
        todayRevenue: todayRevenue.toFixed(2),
        todayRevenueBalcao: todayRevenueBalcao.toFixed(2),
        todayRevenueDelivery: todayRevenueDelivery.toFixed(2),
        monthRevenue: monthRevenue.toFixed(2),
        monthRevenueBalcao: monthRevenueBalcao.toFixed(2),
        monthRevenueDelivery: monthRevenueDelivery.toFixed(2),
        totalPendingReceivables: totalPendingReceivables.toFixed(2),
        totalStockValue: totalStockValue.toFixed(2),
        stockValueByCategory,
        expiringProductsCount: expiringProducts.length,
        expiringProducts,
        recentSales: recentSalesWithDetails,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;

