import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
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
      }))
      .mutation(async ({ input }) => {
        const { prices, ...productData } = input;
        const id = await db.createProduct(productData);
        
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
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        const { prices, ...updateData } = input.data;
        
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
          quantity: z.number(),
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
        docNumber: z.string().optional(),
        partnerType: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
        phone: z.string().optional(),
        email: z.string().optional(),
        // Endereço separado
        street: z.string().optional(),
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
        docNumber: z.string().optional(),
        partnerType: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
        phone: z.string().optional(),
        email: z.string().optional(),
        // Endereço separado
        street: z.string().optional(),
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
        
        const id = await db.createSale(
          { ...saleData, createdBy: ctx.user.id },
          items
        );
        
        return { id, success: true };
      }),
  }),

  // ==================== COMPRAS ====================
  purchases: router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        supplierId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getPurchaseOrders(input);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getPurchaseOrderById(input.id);
      }),
    
    getItems: protectedProcedure
      .input(z.object({ purchaseOrderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPurchaseOrderItems(input.purchaseOrderId);
      }),
    
    searchProducts: protectedProcedure
      .input(z.object({ search: z.string() }))
      .query(async ({ input }) => {
        return await db.searchProducts(input.search);
      }),
    
    create: protectedProcedure
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
    
    confirm: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.confirmPurchaseOrder(input.id);
        return { success: true };
      }),
    
    cancel: protectedProcedure
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
      list: protectedProcedure
        .input(z.object({ activeOnly: z.boolean().optional().default(true) }).optional())
        .query(async ({ input }) => {
          return await db.getExpenseCategories(input?.activeOnly ?? true);
        }),
      
      create: protectedProcedure
        .input(z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          active: z.boolean().optional().default(true),
        }))
        .mutation(async ({ input }) => {
          const id = await db.createExpenseCategory(input);
          return { id, success: true };
        }),
      
      update: protectedProcedure
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
    list: protectedProcedure
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
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getExpenseById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        categoryId: z.number(),
        description: z.string().min(3),
        totalAmount: z.string(),
        paymentType: z.enum(["AVISTA", "PARCELADO"]),
        installments: z.number().min(1).max(60).optional().default(1),
        dueDay: z.number().min(1).max(31).optional(),
        firstDueDate: z.date(),
        supplierId: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const expenseId = await db.createExpense({
          ...input,
          firstDueDate: input.firstDueDate,
          status: "ATIVA",
          createdBy: ctx.user.id,
        });
        
        // Criar parcelas
        const amount = parseFloat(input.totalAmount);
        const installmentAmount = (amount / input.installments).toFixed(2);
        
        for (let i = 0; i < input.installments; i++) {
          const dueDate = new Date(input.firstDueDate);
          dueDate.setMonth(dueDate.getMonth() + i);
          
          await db.createExpenseInstallment({
            expenseId,
            installmentNumber: i + 1,
            amount: installmentAmount,
            dueDate,
            status: "PENDENTE",
          });
        }
        
        return { id: expenseId, success: true };
      }),
    
    cancel: protectedProcedure
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
          await db.payExpenseInstallment(input.id, input);
          return { success: true };
        }),
    }),
  }),

  // ==================== DASHBOARD ====================
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      const products = await db.getProducts({ activeOnly: false });
      const partners = await db.getPartners({ activeOnly: false });
      const recentSales = await db.getSales({ limit: 10 });
      
      const totalProducts = products.length;
      const lowStockProducts = products.filter(p => 
        p.currentStock !== null && p.minStock !== null && p.currentStock < p.minStock
      ).length;
      
      const totalCustomers = partners.filter(p => 
        p.partnerType === 'CUSTOMER' || p.partnerType === 'BOTH'
      ).length;
      
      const todaySales = recentSales.filter(s => {
        const today = new Date();
        const saleDate = new Date(s.saleDate!);
        return saleDate.toDateString() === today.toDateString();
      });
      
      const todayRevenue = todaySales.reduce((sum, sale) => 
        sum + parseFloat(sale.finalAmount || '0'), 0
      );
      
      return {
        totalProducts,
        lowStockProducts,
        totalCustomers,
        todaySales: todaySales.length,
        todayRevenue: todayRevenue.toFixed(2),
        recentSales: recentSales.slice(0, 5),
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;

