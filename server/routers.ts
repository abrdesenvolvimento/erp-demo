import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, consultorProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { getNowInBrazil, formatDateForInput } from '../shared/dateUtils';
import { accountingRouter } from './routers/accounting';
import { ifoodImportRouter } from './routers/ifoodImport';
import { stockAnalysisRouter } from './routers/stockAnalysis';
import { companyRouter } from './routers/company';

export const appRouter = router({
  system: systemRouter,
  accounting: accountingRouter,
  ifoodImport: ifoodImportRouter,
  stockAnalysis: stockAnalysisRouter,
  company: companyRouter,

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
    list: adminProcedure
      .query(async () => {
        return await db.getAllUsers();
      }),
    
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(['user', 'admin', 'operacional', 'consultor']).default('user'),
      }))
      .mutation(async ({ input }) => {
        // Gerar ID único para o usuário
        const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await db.upsertUser({
          id: userId,
          name: input.name,
          email: input.email,
          role: input.role,
          loginMethod: 'manual',
        });
        return { id: userId, success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        userId: z.string(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        role: z.enum(['user', 'admin', 'operacional', 'consultor']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Não pode alterar o próprio role
        if (input.userId === ctx.user.id && input.role && input.role !== ctx.user.role) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Você não pode alterar seu próprio nível de acesso' });
        }
        await db.updateUser(input.userId, {
          name: input.name,
          email: input.email,
          role: input.role,
        });
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Não pode deletar a si mesmo
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Você não pode deletar sua própria conta' });
        }
        await db.deleteUser(input.userId);
        return { success: true };
      }),
  }),

  // ==================== CATEGORIAS ====================
  categories: router({
    list: protectedProcedure
      .input(z.object({ activeOnly: z.boolean().optional().default(true) }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getCategories(input?.activeOnly ?? true, ctx.activeCompanyId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        active: z.boolean().optional().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createCategory({ ...input, companyId: ctx.activeCompanyId, branchId: ctx.activeBranchId });
        return { id, success: true };
      }),
  }),

  // ==================== SUBCATEGORIAS ====================
  subcategories: router({
    list: protectedProcedure
      .input(z.object({ categoryId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getSubcategories(input?.categoryId, ctx.activeCompanyId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        categoryId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createSubcategory({ ...input, companyId: ctx.activeCompanyId, branchId: ctx.activeBranchId });
        return { id, success: true };
      }),
  }),

  // ==================== CANAIS DE VENDA ====================
  salesChannels: router({
    list: protectedProcedure
      .input(z.object({ activeOnly: z.boolean().optional().default(true) }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getSalesChannels(input?.activeOnly ?? true, ctx.activeCompanyId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        type: z.enum(["BALCAO", "DELIVERY"]),
        active: z.boolean().optional().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createSalesChannel({ ...input, companyId: ctx.activeCompanyId, branchId: ctx.activeBranchId });
        return { id, success: true };
      }),
  }),

  // ==================== PRODUTOS ====================
  products: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        categoryId: z.number().optional(),
        subcategoryId: z.number().optional(),
        activeOnly: z.boolean().optional().default(true),
        includePrices: z.boolean().optional(), // OTIMIZAÇÃO: não carregar preços no autocomplete
      }).optional())
      .query(async ({ input, ctx }) => {
        console.log('[products.list] Input:', JSON.stringify(input), 'includePrices:', input?.includePrices);
        const products = await db.getProducts({ ...input, companyId: ctx.activeCompanyId });
        console.log('[products.list] Total produtos:', products.length);
        if (products.length > 0) {
          console.log('[products.list] Primeiro produto preços:', JSON.stringify(products[0].prices));
        }
        
        // Se for operacional, retornar apenas campos permitidos
        if (ctx.user?.role === 'operacional') {
          return products.map(p => ({
            id: p.id,
            name: p.name,
            ean: p.ean,
            uom: p.uom,
            currentStock: p.currentStock,
            minStock: p.minStock,
            active: p.active,
            isComposite: p.isComposite,
            prices: p.prices, // Preços por canal
          }));
        }
        
        return products;
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProduct(input.id);
      }),
    
    // Endpoint específico para exportação com preços (sempre inclui preços)
    exportWithPrices: protectedProcedure
      .query(async ({ ctx }) => {
        console.log('[exportWithPrices] Iniciando busca de produtos com preços...');
        const products = await db.getProducts({ activeOnly: false, includePrices: true, companyId: ctx.activeCompanyId });
        console.log('[exportWithPrices] Total produtos:', products.length);
        if (products.length > 0) {
          console.log('[exportWithPrices] Primeiro produto:', products[0].name);
          console.log('[exportWithPrices] Preços do primeiro produto:', JSON.stringify(products[0].prices));
        }
        return products;
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
      .mutation(async ({ input, ctx }) => {
        console.log('[products.create] Received input:', JSON.stringify(input, null, 2));
        const { prices, compositions, ...productData } = input;
        console.log('[products.create] Compositions extracted:', compositions);
        const id = await db.createProduct({ ...productData, companyId: ctx.activeCompanyId, branchId: ctx.activeBranchId });
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
    
    // OTIMIZAÇÃO: Buscar produto com preços (para seleção na venda)
    getWithPrices: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await db.getProduct(input.id);
        if (!product) return null;
        const prices = await db.getProductPrices(input.id);
        return { ...product, prices };
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
    
    // Histórico de movimentações
    getMovements: protectedProcedure
      .input(z.object({
        productId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        type: z.enum(["ENTRADA", "SAIDA", "PERDA", "ACERTO", "ESTORNO"]).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getProductMovements(input.productId, ctx.activeCompanyId, {
          startDate: input.startDate,
          endDate: input.endDate,
          type: input.type,
          limit: input.limit,
          offset: input.offset,
        });
      }),
    
    adjustStock: adminProcedure
      .input(z.object({
        productId: z.number(),
        quantity: z.number(),
        reason: z.string().min(1),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.adjustProductStock({
          productId: input.productId,
          quantity: input.quantity,
          userId: ctx.user.id,
          reason: input.reason,
          notes: input.notes,
        });
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
      .query(async ({ input, ctx }) => {
        return await db.getPartners({ ...input, companyId: ctx.activeCompanyId });
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
      .mutation(async ({ input, ctx }) => {
        const id = await db.createPartner({ ...input, companyId: ctx.activeCompanyId, branchId: ctx.activeBranchId });
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
    
    // Retorna crédito disponível em tempo real (calcula saldo devedor atual)
    getAvailableCredit: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        const customer = await db.getPartner(input.customerId);
        if (!customer) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Calcular saldo devedor usando a mesma lógica de getCustomerBalance
        // Saldo = Σ(vendas A_PRAZO) + Σ(débitos manuais) - Σ(pagamentos)
        const currentBalance = await db.getCustomerBalance(input.customerId);
        
        const creditLimit = parseFloat(customer.creditLimit || '0');
        const available = creditLimit - currentBalance;
        
        return {
          creditLimit: creditLimit.toFixed(2),
          currentBalance: currentBalance.toFixed(2),
          available: available.toFixed(2),
        };
      }),
  }),

  // ==================== VENDAS ====================
  sales: router({
    list: protectedProcedure
      .input(z.object({
        saleType: z.enum(["BALCAO", "DELIVERY", "A_PRAZO"]).optional(),
        customerId: z.number().optional(),
        limit: z.number().optional().default(500), // Reduzido - usar filtro de data para performance
        dateFrom: z.string().optional(), // Formato: YYYY-MM-DD
        dateTo: z.string().optional(),   // Formato: YYYY-MM-DD
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getSales({ ...input, companyId: ctx.activeCompanyId });
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
            // Calcular saldo devedor usando a mesma lógica de getCustomerBalance
            const currentBalance = await db.getCustomerBalance(saleData.customerId);
            
            const creditLimit = parseFloat(customer.creditLimit || '0');
            const saleAmount = parseFloat(saleData.finalAmount);
            
            if (currentBalance + saleAmount > creditLimit) {
              throw new Error(
                `Limite de crédito excedido. Disponível: R$ ${(creditLimit - currentBalance).toFixed(2)}`
              );
            }
          }
        }
        
        const { dueDates, ...saleDataWithoutDueDates } = saleData;
        
        const id = await db.createSale(
          { ...saleDataWithoutDueDates, createdBy: ctx.user.id, companyId: ctx.activeCompanyId ?? 1, branchId: ctx.activeBranchId ?? 1 },
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
        dateFrom: z.string().optional(), // Formato: YYYY-MM-DD
        dateTo: z.string().optional(),   // Formato: YYYY-MM-DD
        channel: z.enum(['BALCAO', 'DELIVERY', 'A_PRAZO', 'all']).optional().default('all'),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getSalesStats(
          input?.period || 'month',
          input?.dateFrom,
          input?.dateTo,
          input?.channel === 'all' ? undefined : input?.channel,
          ctx.activeCompanyId
        );
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
        discountAmount: z.string().optional(),
        surchargeAmount: z.string().optional(),
        platformOrderId: z.string().optional(), // Número do pedido delivery (padronizado)
      }))
      .mutation(async ({ input, ctx }) => {
        const { saleId, items, discountAmount, surchargeAmount, platformOrderId } = input;
        
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
        // Usar dateUtils para consistência de timezone
        const now = getNowInBrazil();
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
        
        const discount = parseFloat(discountAmount || sale.discountAmount || '0');
        const surcharge = parseFloat(surchargeAmount || sale.surchargeAmount || '0');
        const finalAmount = (parseFloat(subtotal) - discount + surcharge).toFixed(2);
        
        // 9. Atualizar venda (patch semantics: só atualiza platformOrderId se foi passado)
        await db.updateSale(saleId, {
          subtotal,
          discountAmount: discount.toFixed(2),
          surchargeAmount: surcharge.toFixed(2),
          finalAmount,
          ...(platformOrderId !== undefined && { platformOrderId }),
        });
        
        // 10. Atualizar recebível (se for venda A_PRAZO)
        if (sale.saleType === 'A_PRAZO') {
          await db.updateReceivableBySaleId(saleId, {
            totalAmount: finalAmount,
          });
        }
        
        return { success: true, newTotal: finalAmount };
      }),
    
    calendar: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getSalesCalendar(input.year, input.month, ctx.activeCompanyId);
      }),

    // Estatísticas mensais para visão anual
    monthlyStats: protectedProcedure
      .input(z.object({
        year: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getSalesMonthlyStats(input.year, ctx.activeCompanyId);
      }),

    cancel: adminProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.cancelSale(input.id, ctx.user.id, input.reason, ctx.activeCompanyId);
        return { success: true };
      }),

    exportSales: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        saleType: z.enum(["BALCAO", "DELIVERY", "A_PRAZO"]).optional(),
        customerId: z.number().optional(),
        paymentMethod: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getSalesForExport({ ...input, companyId: ctx.activeCompanyId });
      }),

    // Trocar cliente em venda a prazo
    changeCustomer: adminProcedure
      .input(z.object({
        saleId: z.number(),
        newCustomerId: z.number(),
        reason: z.string().min(10, "Justificativa deve ter pelo menos 10 caracteres"),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.changeSaleCustomer(
          input.saleId,
          input.newCustomerId,
          input.reason,
          ctx.user.id,
          ctx.user.name || undefined
        );
        
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Erro ao trocar cliente",
          });
        }
        
        return { success: true };
      }),

    // Histórico de alterações de cliente
    customerChangeHistory: protectedProcedure
      .input(z.object({
        saleId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getSaleCustomerChangeHistory(input.saleId);
      }),
  }),

  // ==================== COMPRAS ====================
  purchases: router({
    list: consultorProcedure
      .input(z.object({
        status: z.string().optional(),
        supplierId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        docNumber: z.string().optional(),
        minValue: z.number().optional(),
        maxValue: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getPurchaseOrders({ ...input, companyId: ctx.activeCompanyId });
      }),
    
    getById: consultorProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getPurchaseOrderById(input.id);
      }),
    
    getItems: consultorProcedure
      .input(z.object({ purchaseOrderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPurchaseOrderItems(input.purchaseOrderId);
      }),
    
    searchProducts: adminProcedure
      .input(z.object({ search: z.string() }))
      .query(async ({ input, ctx }) => {
        return await db.searchProducts(input.search, ctx.activeCompanyId);
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
        discount: z.string().optional(),
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
        const discount = parseFloat(purchaseData.discount || "0");
        const freightCost = parseFloat(purchaseData.freightCost || "0");
        const chargesCost = parseFloat(purchaseData.chargesCost || "0");
        const totalAmount = subtotal - discount + freightCost + chargesCost;
        
        // Criar ordem de compra
        const purchaseOrderData: any = {
          supplierId: purchaseData.supplierId,
          docType: purchaseData.docType,
          issueDate: new Date(purchaseData.issueDate),
          postingDate: new Date(purchaseData.postingDate),
          totalAmount: totalAmount.toFixed(2),
          discount: discount.toFixed(2),
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
        
        const purchaseOrderId = await db.createPurchaseOrder({ ...purchaseOrderData, companyId: ctx.activeCompanyId ?? 1, branchId: ctx.activeBranchId ?? 1 });
        
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
        // Se for À Vista, criar já com status PAID e data de pagamento
        const isAVista = purchaseData.paymentMethod === 'À Vista';
        
        for (let i = 0; i < installments.length; i++) {
          await db.addPurchaseInstallment({
            purchaseOrderId,
            installmentNumber: i + 1,
            dueDate: new Date(installments[i].dueDate),
            amount: installments[i].amount.toFixed(2),
            status: isAVista ? "PAID" : "PENDING",
            paidDate: isAVista ? new Date(installments[i].dueDate) : undefined,
            paidAmount: isAVista ? installments[i].amount.toFixed(2) : undefined,
            paymentMethod: isAVista ? purchaseData.paymentMethod : undefined,
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
        await db.cancelPurchaseOrder(input.id);
        return { success: true };
      }),
    
    // [TEMP] Deletar compra completamente (incluindo journals) - usar apenas para correções
    deleteCompletely: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deletePurchaseCompletely(input.id);
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        docType: z.enum(["NOTA_FISCAL", "CUPOM", "SEM_DOCUMENTO"]).optional(),
        docNumber: z.string().optional(),
        freightCost: z.string().optional(),
        chargesCost: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.string(),
          unitCost: z.string(),
          expiryDate: z.string().optional().nullable(),
        })),
      }))
      .mutation(async ({ input }) => {
        const { id, items, docType, docNumber, freightCost, chargesCost } = input;
        
        // Atualizar dados da compra (patch semantics - só atualiza se definido)
        const updateData: any = {};
        if (docType !== undefined) updateData.docType = docType;
        if (docNumber !== undefined) updateData.docNumber = docNumber;
        if (freightCost !== undefined) updateData.freightCost = freightCost;
        if (chargesCost !== undefined) updateData.chargesCost = chargesCost;
        
        if (Object.keys(updateData).length > 0) {
          await db.updatePurchaseOrder(id, updateData);
        }
        
        // Atualizar itens com novos custos (passa valores para recalcular total)
        const itemsWithDates = items.map(item => ({
          ...item,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
        }));
        
        await db.updatePurchaseOrderItems(id, itemsWithDates, {
          freightCost: freightCost !== undefined ? freightCost : undefined,
          chargesCost: chargesCost !== undefined ? chargesCost : undefined,
        });
        
        return { success: true };
      }),
  }),

  // ==================== DESPESAS OPERACIONAIS ====================
  expenses: router({
    // Categorias
    categories: router({
      list: consultorProcedure
        .input(z.object({ activeOnly: z.boolean().optional().default(true) }).optional())
        .query(async ({ input, ctx }) => {
          return await db.getExpenseCategories(input?.activeOnly ?? true, ctx.activeCompanyId);
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
    list: consultorProcedure
      .input(z.object({
        categoryId: z.number().optional(),
        status: z.enum(["ATIVA", "CANCELADA"]).optional(),
        supplierId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        docNumber: z.string().optional(),
        minValue: z.number().optional(),
        maxValue: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getExpenses({ ...input, companyId: ctx.activeCompanyId });
      }),
    
    get: consultorProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getExpenseById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        supplierId: z.number().optional(),
        issueDate: z.date().optional(),
        entryDate: z.date().optional(),
        competenceMonth: z.string().optional(),
        docType: z.enum(["NOTA_FISCAL", "CUPOM", "FATURA", "CONTRATO", "RECIBO", "BOLETO", "OUTROS"]),
        docNumber: z.string().optional(),
        categoryId: z.number().optional(),
        managementAccountId: z.number().optional(),
        accountingCode: z.string().optional(),
        description: z.string().min(3),
        amount: z.string(),
        paymentMethod: z.string(),
        dueDates: z.array(z.object({
          date: z.date(),
          amount: z.string()
        })).min(1), // Array de datas e valores de vencimento
        notes: z.string().optional(),
        // Campos para Perdas
        productId: z.number().optional(),
        lossQuantity: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Se tiver managementAccountId, buscar o código contábil
        let accountingCode = input.accountingCode;
        if (input.managementAccountId && !accountingCode) {
          accountingCode = await db.getAccountingCodeByManagementAccount(input.managementAccountId) || undefined;
        }

        const expenseId = await db.createExpense({ companyId: ctx.activeCompanyId ?? 1, branchId: ctx.activeBranchId ?? 1,
          supplierId: input.supplierId,
          issueDate: input.issueDate,
          entryDate: input.entryDate,
          competenceMonth: input.competenceMonth,
          docType: input.docType,
          docNumber: input.docNumber,
          categoryId: input.categoryId || 0, // Usar 0 como padrão se não informado
          managementAccountId: input.managementAccountId,
          accountingCode: accountingCode,
          description: input.description,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          status: "ATIVA",
          createdBy: ctx.user.id,
          productId: input.productId,
          lossQuantity: input.lossQuantity,
        });
        
        // Criar parcelas com valores individuais
        // Se for À Vista, criar já com status PAGO e data de pagamento
        const isAVista = input.paymentMethod === 'À Vista';
        
        for (let i = 0; i < input.dueDates.length; i++) {
          await db.createExpenseInstallment({
            expenseId,
            installmentNumber: i + 1,
            amount: input.dueDates[i].amount,
            dueDate: input.dueDates[i].date,
            status: isAVista ? "PAGO" : "PENDENTE",
            paymentDate: isAVista ? input.dueDates[i].date : undefined,
            paymentAmount: isAVista ? input.dueDates[i].amount : undefined,
            paymentMethod: isAVista ? input.paymentMethod : undefined,
          });
          
          // Criar registro em Contas a Pagar para cada parcela
          await db.createAccountPayable({
            description: `${input.description} - Parcela ${i + 1}/${input.dueDates.length}`,
            amount: input.dueDates[i].amount,
            dueDate: input.dueDates[i].date,
            status: isAVista ? "PAID" : "PENDING",
            paidDate: isAVista ? input.dueDates[i].date : undefined,
            supplierId: input.supplierId,
            expenseId: expenseId,
            notes: input.notes,
          });
        }

        // NOTA: O movimento de estoque para Perdas já é registrado automaticamente
        // dentro de db.createExpense quando detecta que é uma conta de Perdas
        
        // ========== CONTABILIZAÇÃO AUTOMÁTICA ==========
        // D - Conta Gerencial (via amarração)
        // C - Contas a Pagar
        if (input.managementAccountId) {
          try {
            const accountingResult = await db.accountExpenseCreation({
              expenseId,
              amount: input.amount,
              managementAccountId: input.managementAccountId,
              supplierName: undefined, // Será buscado se necessário
              description: input.description,
              entryDate: input.entryDate || input.issueDate || new Date(),
              createdBy: ctx.user.id,
            });
            
            if (accountingResult.success) {
              console.log(`[expenses.create] Contabilização criada - Journal #${accountingResult.journalId}`);
            } else {
              console.warn(`[expenses.create] Erro na contabilização: ${accountingResult.error}`);
            }
          } catch (accountingError) {
            console.error(`[expenses.create] Erro ao contabilizar:`, accountingError);
            // Não bloqueia a criação - apenas loga o erro
          }
        }
        
        return { id: expenseId, success: true };
      }),
    
    cancel: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.cancelExpense(input.id);
        return { success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        supplierId: z.number().optional(),
        issueDate: z.date().optional(),
        entryDate: z.date().optional(),
        competenceMonth: z.string().optional(),
        docType: z.enum(["NOTA_FISCAL", "CUPOM", "FATURA", "CONTRATO", "RECIBO", "BOLETO", "OUTROS"]),
        docNumber: z.string().optional(),
        categoryId: z.number().optional(),
        managementAccountId: z.number().optional(),
        accountingCode: z.string().optional(),
        description: z.string().min(3),
        amount: z.string(),
        paymentMethod: z.string(),
        dueDates: z.array(z.object({
          date: z.date(),
          amount: z.string()
        })).min(1),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Se tiver managementAccountId, buscar o código contábil
        let accountingCode = input.accountingCode;
        if (input.managementAccountId && !accountingCode) {
          accountingCode = await db.getAccountingCodeByManagementAccount(input.managementAccountId) || undefined;
        }

        // Buscar despesa atual
        const currentExpense = await db.getExpenseById(input.id);
        
        // SEMPRE reprocessar journal ao editar despesa
        // Qualquer alteração (data, valor, fornecedor, conta gerencial) requer novo journal
        console.log(`[UPDATE EXPENSE] Reprocessando journal da despesa #${input.id}`);
        
        try {
          // Deletar journal antigo (se existir)
          await db.deleteExpenseJournal(input.id);
          console.log(`[UPDATE EXPENSE] Journal antigo deletado`);
        } catch (error: any) {
          console.warn(`[UPDATE EXPENSE] Erro ao deletar journal antigo: ${error.message}`);
        }
        
        await db.updateExpense(input.id, {
          supplierId: input.supplierId,
          issueDate: input.issueDate,
          entryDate: input.entryDate,
          competenceMonth: input.competenceMonth,
          docType: input.docType,
          docNumber: input.docNumber,
          categoryId: input.categoryId,
          managementAccountId: input.managementAccountId,
          accountingCode: accountingCode,
          description: input.description,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
        });
        
        // Recriar journal com os novos dados (se tem conta gerencial)
        if (input.managementAccountId) {
          try {
            const accountingResult = await db.accountExpenseCreation({
              expenseId: input.id,
              amount: input.amount,
              managementAccountId: input.managementAccountId,
              description: input.description,
              entryDate: input.entryDate || input.issueDate || new Date(),
              createdBy: 'system',
            });
            
            if (accountingResult.success) {
              console.log(`[UPDATE EXPENSE] Novo journal criado - Journal #${accountingResult.journalId}`);
            } else {
              console.warn(`[UPDATE EXPENSE] Erro ao criar novo journal: ${accountingResult.error}`);
            }
          } catch (accountingError: any) {
            console.error(`[UPDATE EXPENSE] Erro ao recriar journal:`, accountingError.message);
          }
        }
        
        // Atualizar parcelas: deletar antigas e criar novas
        await db.deleteExpenseInstallments(input.id);
        for (let i = 0; i < input.dueDates.length; i++) {
          await db.createExpenseInstallment({
            expenseId: input.id,
            installmentNumber: i + 1,
            amount: input.dueDates[i].amount,
            dueDate: input.dueDates[i].date,
            status: "PENDENTE",
          });
        }
        
        return { success: true };
      }),
    
    getDetails: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getExpenseDetails(input.id);
      }),
    
    // Parcelas
    installments: router({
      pending: protectedProcedure
        .input(z.object({
          categoryId: z.number().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        }).optional())
        .query(async ({ input, ctx }) => {
          return await db.getPendingExpenseInstallments({ ...input, companyId: ctx.activeCompanyId });
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
      .query(async ({ input, ctx }) => {
        return await db.listReceivables({ ...input, companyId: ctx.activeCompanyId });
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getReceivableById(input.id);
      }),
    
    summary: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getReceivablesSummary(ctx.activeCompanyId);
      }),
    
    // Gestão por cliente
    byCustomer: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getCustomersWithPendingReceivables(ctx.activeCompanyId);
      }),
    
    totalPending: protectedProcedure
      .query(async ({ ctx }) => {
        const total = await db.getTotalPendingReceivables(ctx.activeCompanyId);
        return { total: total.toFixed(2) };
      }),
    
    customerDetail: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input, ctx }) => {
        return await db.getCustomerReceivableDetail(input.customerId, ctx.activeCompanyId);
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
      .mutation(async ({ input, ctx }) => {
        return await db.registerCustomerPayment(input);
      }),
    
    // Exportar PDF
    exportPDF: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { generateReceivablesPDF } = await import('./receivablesPdf');
        // Usar getCustomerAccountHistory que tem o saldo correto (currentBalance)
        const customerDetail = await db.getCustomerAccountHistory(input.customerId);
        
        if (!customerDetail) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Cliente não encontrado',
          });
        }
        
        // ===== MOSTRAR APENAS VENDAS QUE FORMAM O SALDO DEVEDOR ATUAL =====
        // Lógica: percorrer vendas de trás para frente (mais recentes primeiro)
        // e incluir até que a soma atinja o saldo devedor atual
        const history = customerDetail.history || [];
        const saldoAtual = parseFloat(customerDetail.currentBalance || '0');
        
        console.log('[exportPDF] Cliente:', customerDetail.customer.name);
        console.log('[exportPDF] Total histórico:', history.length);
        console.log('[exportPDF] Saldo atual:', saldoAtual);
        
        let transacoesEmAberto: typeof history = [];
        
        // Se saldo atual é 0 ou negativo, não há débitos pendentes
        if (saldoAtual <= 0) {
          console.log('[exportPDF] Saldo zerado ou negativo, sem transações em aberto');
          transacoesEmAberto = [];
        } else {
          // Filtrar apenas vendas e débitos
          const vendasDebitos = history.filter(item => item.type === 'SALE' || item.type === 'DEBIT');
          
          // Ordenar por data (mais recente primeiro)
          const vendasOrdenadas = [...vendasDebitos].sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA; // Mais recente primeiro
          });
          
          // Percorrer de trás para frente até atingir o saldo
          let somaAcumulada = 0;
          const vendasEmAberto: typeof history = [];
          
          for (const venda of vendasOrdenadas) {
            const valor = parseFloat(venda.amount);
            
            // Incluir esta venda se ainda não atingimos o saldo
            if (somaAcumulada < saldoAtual) {
              vendasEmAberto.push(venda);
              somaAcumulada += valor;
              console.log(`[exportPDF] Incluindo venda #${venda.id}: R$${valor.toFixed(2)}, soma=${somaAcumulada.toFixed(2)}`);
              
              // Se atingimos ou ultrapassamos o saldo, podemos parar
              if (somaAcumulada >= saldoAtual - 0.01) {
                console.log(`[exportPDF] Soma atingiu saldo atual, parando`);
                break;
              }
            }
          }
          
          // Ordenar de volta por data (mais antiga primeiro) para exibição
          transacoesEmAberto = vendasEmAberto.sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateA - dateB; // Mais antiga primeiro
          });
          
          console.log(`[exportPDF] Total de vendas em aberto: ${transacoesEmAberto.length}`);
          console.log(`[exportPDF] Soma das vendas em aberto: R$${somaAcumulada.toFixed(2)}`);
        }
        
        // Criar objeto filtrado para o PDF
        const filteredData = {
          ...customerDetail,
          history: transacoesEmAberto
        };
        
        // Gerar PDF (função assíncrona para baixar logo)
        const pdfStream = await generateReceivablesPDF(filteredData as any);
        
        // Converter stream para buffer
        const chunks: Buffer[] = [];
        
        return new Promise<{ pdf: string; filename: string }>((resolve, reject) => {
          pdfStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          pdfStream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const base64 = buffer.toString('base64');
            resolve({
              pdf: base64,
              filename: `extrato-contas-receber-${customerDetail.customer.name.replace(/\s+/g, '-')}-${formatDateForInput(new Date())}.pdf`,
            });
          });
          pdfStream.on('error', reject);
        });
      }),
    
    // Enviar extrato via WhatsApp
    sendViaWhatsApp: protectedProcedure
      .input(z.object({
        customerId: z.number(),
        phoneNumber: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { sendWhatsAppDocument, isWhatsAppConfigured } = await import('./_core/whatsapp');
        const { storagePut } = await import('./storage');
        const { generateReceivablesPDF } = await import('./receivablesPdf');
        
        // Verificar se WhatsApp está configurado
        if (!isWhatsAppConfigured()) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'WhatsApp não está configurado. Configure as credenciais no painel de administração.',
          });
        }
        
        // Buscar dados do cliente
        const customerDetail = await db.getCustomerAccountHistory(input.customerId);
        
        if (!customerDetail) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Cliente não encontrado',
          });
        }
        
        // ===== MOSTRAR APENAS VENDAS QUE FORMAM O SALDO DEVEDOR ATUAL =====
        const history = customerDetail.history || [];
        const saldoAtual = parseFloat(customerDetail.currentBalance || '0');
        
        let transacoesEmAberto: typeof history = [];
        
        if (saldoAtual <= 0) {
          transacoesEmAberto = [];
        } else {
          // Filtrar apenas vendas e débitos
          const vendasDebitos = history.filter(item => item.type === 'SALE' || item.type === 'DEBIT');
          
          // Ordenar por data (mais recente primeiro)
          const vendasOrdenadas = [...vendasDebitos].sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
          });
          
          // Percorrer até atingir o saldo
          let somaAcumulada = 0;
          const vendasEmAberto: typeof history = [];
          
          for (const venda of vendasOrdenadas) {
            const valor = parseFloat(venda.amount);
            if (somaAcumulada < saldoAtual) {
              vendasEmAberto.push(venda);
              somaAcumulada += valor;
              if (somaAcumulada >= saldoAtual - 0.01) break;
            }
          }
          
          // Ordenar de volta por data (mais antiga primeiro)
          transacoesEmAberto = vendasEmAberto.sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateA - dateB;
          });
        }
        
        // Criar objeto filtrado para o PDF
        const filteredData = {
          ...customerDetail,
          history: transacoesEmAberto
        };
        
        // Gerar PDF
        const pdfStream = await generateReceivablesPDF(filteredData as any);
        
        // Converter stream para buffer
        const chunks: Buffer[] = [];
        const buffer = await new Promise<Buffer>((resolve, reject) => {
          pdfStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          pdfStream.on('end', () => resolve(Buffer.concat(chunks)));
          pdfStream.on('error', reject);
        });
        
        // Upload para S3
        const filename = `extrato-${customerDetail.customer.name.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
        const { url: pdfUrl } = await storagePut(
          `whatsapp-extratos/${filename}`,
          buffer,
          'application/pdf'
        );
        
        // Formatar mensagem
        const saldoFormatado = saldoAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const limiteCredito = parseFloat(customerDetail.customer.creditLimit || '0');
        const limiteFormatado = limiteCredito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const creditoDisponivel = Math.max(0, limiteCredito - saldoAtual);
        const disponivelFormatado = creditoDisponivel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        const caption = `Olá ${customerDetail.customer.name.split(' ')[0]}! \n\nSegue seu extrato de Contas a Receber atualizado.\n\nSaldo Devedor: ${saldoFormatado}\nLimite de Crédito: ${limiteFormatado}\nCrédito Disponível: ${disponivelFormatado}\n\nQualquer dúvida, entre em contato!\n\nAdega Beira Rio`;
        
        // Enviar documento via WhatsApp
        const result = await sendWhatsAppDocument(
          input.phoneNumber,
          pdfUrl,
          filename,
          caption
        );
        
        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erro ao enviar WhatsApp: ${result.error}`,
          });
        }
        
        console.log(`[WhatsApp] Extrato enviado para ${customerDetail.customer.name} (${input.phoneNumber})`);
        
        return {
          success: true,
          messageId: result.messageId,
          customerName: customerDetail.customer.name,
        };
      }),
    
    // Parcelas
    installments: router({
      pending: protectedProcedure
        .input(z.object({
          customerId: z.number().optional(),
        }).optional())
        .query(async ({ input, ctx }) => {
          return await db.listPendingReceivableInstallments(input?.customerId, ctx.activeCompanyId);
        }),
      
      overdue: protectedProcedure
        .query(async ({ ctx }) => {
          return await db.listOverdueReceivableInstallments(ctx.activeCompanyId);
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
    // Listar fornecedores com saldo devedor (legado)
    bySupplier: adminProcedure
      .query(async ({ ctx }) => {
        return await db.getSuppliersWithPendingPayables(ctx.activeCompanyId);
      }),
    
    // Listar TODOS os fornecedores com histórico (com ou sem saldo pendente)
    allSuppliers: adminProcedure
      .query(async ({ ctx }) => {
        return await db.getAllSuppliersWithHistory(ctx.activeCompanyId);
      }),
    
    // Total pendente de pagamento
    totalPending: adminProcedure
      .query(async ({ ctx }) => {
        const total = await db.getTotalPendingPayables(ctx.activeCompanyId);
        return { total: total.toFixed(2) };
      }),
    
    // Detalhamento de um fornecedor
    supplierDetail: adminProcedure
      .input(z.object({ supplierId: z.number() }))
      .query(async ({ input, ctx }) => {
        return await db.getSupplierPayableDetail(input.supplierId, ctx.activeCompanyId);
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
      .mutation(async ({ input, ctx }) => {
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
        interestAmount: z.string().optional(),
        discountAmount: z.string().optional(),
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
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getPaymentHistory({ ...(input || {}), companyId: ctx.activeCompanyId });
      }),
    
    // Calendário de contas a pagar
    calendar: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getPayablesCalendar(input.year, input.month, ctx.activeCompanyId);
      }),
  }),

  // ==================== CONTA CORRENTE (NOVO MODELO) ====================
  accountReceivable: router({
    // Listar clientes com saldo devedor
    customers: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getCustomersWithBalance(ctx.activeCompanyId);
      }),
    
    // Buscar histórico de um cliente (vendas + pagamentos)
    history: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input, ctx }) => {
        return await db.getCustomerAccountHistory(input.customerId, ctx.activeCompanyId);
      }),
    
    // Registrar pagamento
    registerPayment: protectedProcedure
      .input(z.object({
        customerId: z.number(),
        paidDate: z.date(),
        paidAmount: z.string(),
        paymentMethod: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.registerPaymentToBalance({
          ...input,
          createdBy: ctx.user.id,
          companyId: ctx.activeCompanyId ?? undefined
        });
      }),
    
    // Registrar débito manual
    registerManualDebit: protectedProcedure
      .input(z.object({
        customerId: z.number(),
        debitDate: z.date(),
        debitAmount: z.string(),
        description: z.string(),
        managementAccountId: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.registerManualDebit({
          ...input,
          createdBy: ctx.user.id,
          companyId: ctx.activeCompanyId ?? undefined
        });
      }),
  }),

  // ==================== DASHBOARD ====================
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const products = await db.getProducts({ activeOnly: false, companyId: ctx.activeCompanyId });
      const recentSales = await db.getSales({ limit: 10, companyId: ctx.activeCompanyId });
      
      // Usar horário de Brasília (GMT-3) para cálculos de data
      const todayDateStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' });
      const [month, day, year] = todayDateStr.split('/');
      const today = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
      
      // Produtos com estoque baixo
      const lowStockProducts = products.filter(p => 
        p.currentStock !== null && p.minStock !== null && p.currentStock < p.minStock
      );
      
      // OTIMIZAÇÃO: Usar queries SQL diretas ao invés de buscar todas as vendas e filtrar em JavaScript
      // Isso resolve o problema de limite de 10.000 vendas e melhora performance significativamente
      const dailyRevenue = await db.getDashboardDailyRevenue(ctx.activeCompanyId);
      const monthlyRevenue = await db.getDashboardMonthlyRevenue(ctx.activeCompanyId);
      const monthlyPurchases = await db.getDashboardMonthlyPurchases(ctx.activeCompanyId);
      
      const todayRevenue = dailyRevenue.total;
      const todayRevenueBalcao = dailyRevenue.balcao;
      const todayRevenueDelivery = dailyRevenue.delivery;
      
      const monthRevenue = monthlyRevenue.total;
      const monthRevenueBalcao = monthlyRevenue.balcao + monthlyRevenue.aPrazo; // Balcão + A Prazo
      const monthRevenueDelivery = monthlyRevenue.delivery;
      
      // Total pendente a receber
      const totalPendingReceivables = await db.getTotalPendingReceivables(ctx.activeCompanyId);
      
      // Valor total em estoque (excluindo produtos compostos)
      const totalStockValue = products
        .filter(p => p.active && !p.isComposite && p.currentStock && p.avgCost)
        .reduce((sum, p) => sum + (parseFloat(p.currentStock!.toString()) * parseFloat(p.avgCost!.toString())), 0);
      
      // Valor em estoque por categoria (excluindo produtos compostos)
      const categories = await db.getCategories(true, ctx.activeCompanyId);
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
      
      // Produtos próximos ao vencimento (30 dias) - apenas com estoque > 0
      const expiringProducts = products.filter(p => {
        if (!p.active || !p.expirationDate) return false;
        const stock = parseFloat(p.currentStock?.toString() || "0");
        if (stock <= 0) return false; // Ignorar produtos sem estoque
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
      const channels = await db.getSalesChannels(true, ctx.activeCompanyId);
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
    
    // Estatísticas de compras
    purchaseStats: protectedProcedure.query(async ({ ctx }) => {
      const totalCurrentMonth = await db.getPurchaseTotalCurrentMonth(ctx.activeCompanyId);
      const totalByDocType = await db.getPurchaseTotalByDocType(ctx.activeCompanyId);
      
      // Mapear tipos de documento para labels amigáveis
      const docTypeLabels: Record<string, string> = {
        'NOTA_FISCAL': 'Nota Fiscal',
        'CUPOM': 'Cupom',
        'SEM_DOCUMENTO': 'Sem Documento',
      };
      
      const byDocType = totalByDocType.map(item => ({
        docType: item.docType,
        label: docTypeLabels[item.docType] || item.docType,
        total: item.total,
      }));
      
      return {
        totalCurrentMonth,
        byDocType,
      };
    }),
    
    // Margem bruta por categoria
    grossMarginByCategory: protectedProcedure.query(async ({ ctx }) => {
      const margins = await db.getGrossMarginByCategory(ctx.activeCompanyId);
      return margins;
    }),
    
    // Análise detalhada por produto delivery - usando query SQL otimizada
    deliveryProductAnalysis: protectedProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        categoryId: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
      // Determinar strings de data para filtro
      let startDateStr: string;
      let endDateStr: string;
      
      if (input?.startDate && input?.endDate) {
        startDateStr = input.startDate;
        endDateStr = input.endDate;
      } else {
        // Padrão: mês atual
        const todayDateStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' });
        const [month, day, year] = todayDateStr.split('/');
        startDateStr = `${year}-${month.padStart(2, '0')}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        endDateStr = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      }
      
      // Usar query SQL otimizada com CONVERT_TZ
      return await db.getDeliveryProductAnalysis(startDateStr, endDateStr, input?.categoryId, ctx.activeCompanyId);
    }),
    
    // Margem líquida delivery (deduzindo 7% de taxa iFood)
    // Usa query SQL otimizada para garantir consistência com outros cálculos do dashboard
    deliveryNetMargin: protectedProcedure.query(async ({ ctx }) => {
      return await db.getDeliveryNetMarginOptimized(ctx.activeCompanyId);
    }),
  }),

  // ==================== ANÁLISE DE VENDAS ====================
  salesAnalysis: router({
    // Resumo usando sales.finalAmount (valor correto para totais)
    // Quando filtro de produto é aplicado, calcula apenas para produtos selecionados
    summary: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        channels: z.array(z.string()).optional(),
        paymentMethod: z.string().optional(),
        productIds: z.array(z.number()).optional(),
        subcategoryId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getSalesAnalysisSummary(input.startDate, input.endDate, ctx.activeCompanyId, {
          channels: input.channels,
          paymentMethod: input.paymentMethod,
          productIds: input.productIds,
          subcategoryId: input.subcategoryId,
        });
      }),

    // Análise por valores (faturamento, margem, lucro)
    byValue: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        productIds: z.array(z.number()).optional(),
        subcategoryId: z.number().optional(),
        channels: z.array(z.string()).optional(),
        paymentMethod: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getSalesAnalysisByValue(input.startDate, input.endDate, ctx.activeCompanyId, {
          productIds: input.productIds,
          subcategoryId: input.subcategoryId,
          channels: input.channels,
          paymentMethod: input.paymentMethod,
        });
      }),

    // Análise por quantidades (unidades vendidas, mix)
    byQuantity: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        productIds: z.array(z.number()).optional(),
        subcategoryId: z.number().optional(),
        channels: z.array(z.string()).optional(),
        paymentMethod: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getSalesAnalysisByQuantity(input.startDate, input.endDate, ctx.activeCompanyId, {
          productIds: input.productIds,
          subcategoryId: input.subcategoryId,
          channels: input.channels,
          paymentMethod: input.paymentMethod,
        });
      }),

    // Análise por categoria (valores)
    byCategoryValue: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        productIds: z.array(z.number()).optional(),
        subcategoryId: z.number().optional(),
        channels: z.array(z.string()).optional(),
        paymentMethod: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getSalesAnalysisByCategoryValue(input.startDate, input.endDate, ctx.activeCompanyId, {
          productIds: input.productIds,
          subcategoryId: input.subcategoryId,
          channels: input.channels,
          paymentMethod: input.paymentMethod,
        });
      }),

    // Análise por dia
    byDay: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        productIds: z.array(z.number()).optional(),
        subcategoryId: z.number().optional(),
        channels: z.array(z.string()).optional(),
        paymentMethod: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getSalesAnalysisByDay(input.startDate, input.endDate, ctx.activeCompanyId, {
          productIds: input.productIds,
          subcategoryId: input.subcategoryId,
          channels: input.channels,
          paymentMethod: input.paymentMethod,
        });
      }),

    // Análise por semana
    byWeek: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        productIds: z.array(z.number()).optional(),
        subcategoryId: z.number().optional(),
        channels: z.array(z.string()).optional(),
        paymentMethod: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getSalesAnalysisByWeek(input.startDate, input.endDate, ctx.activeCompanyId, {
          productIds: input.productIds,
          subcategoryId: input.subcategoryId,
          channels: input.channels,
          paymentMethod: input.paymentMethod,
        });
      }),

    // Análise por mês
    byMonth: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        productIds: z.array(z.number()).optional(),
        subcategoryId: z.number().optional(),
        channels: z.array(z.string()).optional(),
        paymentMethod: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getSalesAnalysisByMonth(input.startDate, input.endDate, ctx.activeCompanyId, {
          productIds: input.productIds,
          subcategoryId: input.subcategoryId,
          channels: input.channels,
          paymentMethod: input.paymentMethod,
        });
      }),

    // Matriz Produto × Dia (para Evolução Diária)
    byProductAndDate: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        productIds: z.array(z.number()).optional(),
        subcategoryId: z.number().optional(),
        channels: z.array(z.string()).optional(),
        paymentMethod: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getSalesByProductAndDate(input.startDate, input.endDate, ctx.activeCompanyId, {
          productIds: input.productIds,
          subcategoryId: input.subcategoryId,
          channels: input.channels,
          paymentMethod: input.paymentMethod,
        });
      }),

    // Comparação de Períodos
    comparePeriods: adminProcedure
      .input(z.object({
        period1: z.object({
          startDate: z.date(),
          endDate: z.date(),
        }),
        period2: z.object({
          startDate: z.date(),
          endDate: z.date(),
        }),
        comparisonType: z.enum(["value", "quantity"]).default("value"),
        productIds: z.array(z.number()).optional(),
        subcategoryId: z.number().optional(),
        channels: z.array(z.string()).optional(),
        paymentMethod: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const filters = {
          productIds: input.productIds,
          subcategoryId: input.subcategoryId,
          channels: input.channels,
          paymentMethod: input.paymentMethod,
        };

        // Escolher função de busca baseado no tipo de comparação
        const fetchFunction = input.comparisonType === "quantity" 
          ? db.getSalesAnalysisByQuantity 
          : db.getSalesAnalysisByValue;

        // Buscar dados dos dois períodos em paralelo + totais usando finalAmount
        const [period1Data, period2Data, period1Summary, period2Summary] = await Promise.all([
          fetchFunction(input.period1.startDate, input.period1.endDate, ctx.activeCompanyId, filters),
          fetchFunction(input.period2.startDate, input.period2.endDate, ctx.activeCompanyId, filters),
          db.getSalesAnalysisSummary(input.period1.startDate, input.period1.endDate, ctx.activeCompanyId, filters),
          db.getSalesAnalysisSummary(input.period2.startDate, input.period2.endDate, ctx.activeCompanyId, filters),
        ]);

        return {
          period1: period1Data,
          period2: period2Data,
          period1Total: {
            revenue: period1Summary.totalRevenue,
            sales: period1Summary.totalSales,
          },
          period2Total: {
            revenue: period2Summary.totalRevenue,
            sales: period2Summary.totalSales,
          },
        };
      }),
  }),

  // ==================== ANÁLISE DE DESPESAS ====================
  expenseAnalysis: router({
    // Resumo geral de despesas
    summary: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        categoryId: z.number().optional(),
        supplierId: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getExpenseAnalysisSummary(ctx.activeCompanyId,
          input?.startDate,
          input?.endDate,
          input?.categoryId,
          input?.supplierId
        );
      }),

    // Análise por categoria
    byCategory: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        categoryId: z.number().optional(),
        supplierId: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getExpenseAnalysisByCategory(ctx.activeCompanyId,
          input?.startDate,
          input?.endDate,
          input?.categoryId,
          input?.supplierId
        );
      }),

    // Análise por mês
    byMonth: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        categoryId: z.number().optional(),
        supplierId: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getExpenseAnalysisByMonth(ctx.activeCompanyId,
          input?.startDate,
          input?.endDate,
          input?.categoryId,
          input?.supplierId
        );
      }),

    // Análise por categoria e mês (matriz)
    byCategoryAndMonth: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        categoryId: z.number().optional(),
        supplierId: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getExpenseAnalysisByCategoryAndMonth(ctx.activeCompanyId,
          input?.startDate,
          input?.endDate,
          input?.categoryId,
          input?.supplierId
        );
      }),

    // Dados hierárquicos para matriz expansível
    hierarchical: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getExpenseHierarchicalData(ctx.activeCompanyId,
          input?.startDate,
          input?.endDate
        );
      }),

    // Detalhamento de lançamentos
    detail: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        categoryId: z.number().optional(),
        supplierId: z.number().optional(),
        limit: z.number().optional().default(500),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getExpenseAnalysisDetail(ctx.activeCompanyId,
          input?.startDate,
          input?.endDate,
          input?.categoryId,
          input?.supplierId,
          input?.limit
        );
      }),
  }),

  // ==================== FECHAMENTO MENSAL ====================
  closing: router({
    monthly: consultorProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getMonthlyClosing(input.year, input.month, ctx.activeCompanyId);
      }),

    yearly: consultorProcedure
      .input(z.object({
        year: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getYearlyClosing(input.year, ctx.activeCompanyId);
      }),
  }),

  // ==================== METAS DE FATURAMENTO ====================
  goals: router({
    list: adminProcedure
      .input(z.object({
        year: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getRevenueGoals(input?.year, ctx.activeCompanyId);
      }),

    get: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
        channelId: z.number().nullable().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getRevenueGoal(input.year, input.month, input.channelId, ctx.activeCompanyId);
      }),

    upsert: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
        channelId: z.number().nullable().optional(),
        targetAmount: z.number().positive(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.upsertRevenueGoal({
          year: input.year,
          month: input.month,
          channelId: input.channelId,
          targetAmount: input.targetAmount,
          notes: input.notes,
          createdBy: ctx.user.id,
          createdByName: ctx.user.name || undefined,
        });
      }),

    progress: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getRevenueGoalProgress(input.year, input.month, ctx.activeCompanyId);
      }),

    history: adminProcedure
      .input(z.object({
        year: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getAllRevenueGoalHistory(input.year, ctx.activeCompanyId);
      }),
  }),

  // ==================== CONTAS GERENCIAIS ====================
  managementAccounts: router({
    // Listar todas as contas gerenciais
    list: protectedProcedure
      .input(z.object({
        nature: z.enum(['CUSTO', 'DESPESA', 'RECEITA', 'PATRIMONIAL']).optional(),
        classification: z.enum(['OPERACIONAL', 'ADMINISTRATIVA', 'COMERCIAL', 'FINANCEIRA', 'NAO_OPERACIONAL', 'PATRIMONIAL']).optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.listManagementAccounts({ ...input, companyId: ctx.activeCompanyId });
      }),

    // Listar para dropdown (simplificado)
    forSelect: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.listManagementAccountsForSelect(ctx.activeCompanyId);
      }),

    // Listar agrupadas por classificação
    grouped: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.listManagementAccountsGrouped(ctx.activeCompanyId);
      }),

    // Buscar por ID
    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getManagementAccountById(input.id);
      }),

    // Criar nova conta gerencial (admin only)
    create: adminProcedure
      .input(z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        nature: z.enum(['CUSTO', 'DESPESA', 'RECEITA', 'PATRIMONIAL']),
        costType: z.enum(['FIXA', 'VARIAVEL']).optional(),
        classification: z.enum(['OPERACIONAL', 'ADMINISTRATIVA', 'COMERCIAL', 'FINANCEIRA', 'NAO_OPERACIONAL', 'PATRIMONIAL']),
        impactMargin: z.boolean().optional(),
        impactPayroll: z.boolean().optional(),
        accountingCode: z.string().min(1),
        accountingName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createManagementAccount(input);
        return { id, success: true };
      }),

    // Atualizar conta gerencial (admin only)
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        costType: z.enum(['FIXA', 'VARIAVEL']).optional(),
        impactMargin: z.boolean().optional(),
        impactPayroll: z.boolean().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateManagementAccount(id, data);
        return { success: true };
      }),
  }),

  // ==================== GOVERNANÇA CONTÁBIL ====================
  governance: router({
    // Buscar configurações de governança
    getSettings: adminProcedure
      .input(z.object({ companyId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getGovernanceSettings(ctx.activeCompanyId || input?.companyId || 1);
      }),

    // Atualizar configurações de governança
    updateSettings: adminProcedure
      .input(z.object({
        companyId: z.number().optional(),
        salesEditWindowHours: z.number().min(1).max(720).optional(),
        expensesEditWindowDays: z.number().min(1).max(30).optional(),
        purchasesEditWindowDays: z.number().min(1).max(30).optional(),
        allowRetroactivePosting: z.boolean().optional(),
        retroactiveLimitDay: z.number().min(1).max(15).optional(),
        maxReopenCount: z.number().min(1).max(5).optional(),
        reopenWindowHours: z.number().min(1).max(168).optional(),
        maxReopenDaysAfterClose: z.number().min(1).max(90).optional(),
        autoAccountingEnabled: z.boolean().optional(),
        autoAccountingDay: z.number().min(0).max(6).optional(),
        autoAccountingHour: z.number().min(0).max(23).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { companyId, ...settings } = input;
        await db.updateGovernanceSettings(
          companyId || 1,
          settings,
          ctx.user.id,
          ctx.user.name || undefined
        );
        return { success: true };
      }),

    // Listar períodos contábeis
    listPeriods: protectedProcedure
      .input(z.object({ companyId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        return await db.listAccountingPeriods(ctx.activeCompanyId || input?.companyId || 1);
      }),

    // Buscar período específico
    getPeriod: protectedProcedure
      .input(z.object({
        companyId: z.number().optional(),
        competenceMonth: z.string(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getAccountingPeriod(ctx.activeCompanyId || input.companyId || 1, input.competenceMonth);
      }),

    // Fechar período contábil
    closePeriod: adminProcedure
      .input(z.object({
        companyId: z.number().optional(),
        competenceMonth: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.closeAccountingPeriod(
          input.companyId || 1,
          input.competenceMonth,
          ctx.user.id,
          ctx.user.name || undefined
        );
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        }
        return result;
      }),

    // Reabrir período contábil
    reopenPeriod: adminProcedure
      .input(z.object({
        companyId: z.number().optional(),
        competenceMonth: z.string(),
        reason: z.string().min(20, "Justificativa deve ter pelo menos 20 caracteres"),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.reopenAccountingPeriod(
          input.companyId || 1,
          input.competenceMonth,
          input.reason,
          ctx.user.id,
          ctx.user.name || undefined
        );
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        }
        return result;
      }),

    // Verificar se entidade pode ser editada
    canEdit: protectedProcedure
      .input(z.object({
        entityType: z.enum(['sale', 'expense', 'purchase']),
        entityId: z.number(),
        companyId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.canEditEntity(
          input.entityType,
          input.entityId,
          input.companyId || 1
        );
      }),

    // Buscar histórico de auditoria
    getAuditHistory: adminProcedure
      .input(z.object({
        companyId: z.number().optional(),
        action: z.string().optional(),
        entityType: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(500).optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getGovernanceAuditHistory(
          input?.companyId || 1,
          {
            action: input?.action,
            entityType: input?.entityType,
            startDate: input?.startDate,
            endDate: input?.endDate,
          },
          input?.limit || 100
        );
      }),

    // Buscar histórico de batches de contabilização
    getBatchHistory: adminProcedure
      .input(z.object({
        companyId: z.number().optional(),
        limit: z.number().min(1).max(100).optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAccountingBatchHistory(
          input?.companyId || 1,
          input?.limit || 20
        );
      }),

    // Buscar último batch de contabilização
    getLastBatch: protectedProcedure
      .input(z.object({ companyId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getLastAccountingBatch(input?.companyId || 1);
      }),
  }),
});
export type AppRouter = typeof appRouter;;

