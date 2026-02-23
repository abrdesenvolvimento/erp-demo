/**
 * Router tRPC para Módulo de Contabilidade
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import * as accounting from "../accounting";

export const accountingRouter = router({
  // Plano de Contas
  chartOfAccounts: router({
    list: publicProcedure
      .input(z.object({
        companyId: z.number().optional().default(1)
      }).optional())
      .query(async ({ input }) => {
        return accounting.getChartOfAccounts(input?.companyId || 1);
      }),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return accounting.getAccountById(input.id);
      }),
    
    getByCode: publicProcedure
      .input(z.object({
        code: z.string(),
        companyId: z.number().optional().default(1)
      }))
      .query(async ({ input }) => {
        return accounting.getAccountByCode(input.code, input.companyId);
      }),
    
    analytical: publicProcedure
      .input(z.object({
        companyId: z.number().optional().default(1)
      }).optional())
      .query(async ({ input }) => {
        return accounting.getAnalyticalAccounts(input?.companyId || 1);
      }),
    
    create: protectedProcedure
      .input(z.object({
        companyId: z.number().optional().default(1),
        parentId: z.number().optional(),
        code: z.string(),
        name: z.string(),
        parentCode: z.string().optional(),
        level: z.number(),
        accountType: z.enum(["ATIVO", "PASSIVO", "PL", "PATRIMONIO_LIQUIDO", "RECEITA", "CUSTO", "DESPESA"]),
        nature: z.enum(["DEVEDORA", "CREDORA"]).optional().default("DEVEDORA"),
        isAnalytical: z.boolean().optional().default(true),
        allowsEntries: z.boolean().optional().default(true),
        displayOrder: z.number().optional().default(0)
      }))
      .mutation(async ({ input }) => {
        return accounting.createAccount(input);
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        isActive: z.boolean().optional(),
        allowsEntries: z.boolean().optional(),
        displayOrder: z.number().optional()
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return accounting.updateAccount(id, data);
      }),
    
    deactivate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return accounting.deactivateAccount(input.id);
      })
  }),
  
  // Períodos Contábeis
  periods: router({
    get: publicProcedure
      .input(z.object({
        competenceMonth: z.string(),
        companyId: z.number().optional().default(1)
      }))
      .query(async ({ input }) => {
        return accounting.getAccountingPeriod(input.competenceMonth, input.companyId);
      }),
    
    ensureOpen: protectedProcedure
      .input(z.object({
        competenceMonth: z.string(),
        companyId: z.number().optional().default(1)
      }))
      .mutation(async ({ input }) => {
        return accounting.ensurePeriodOpen(input.competenceMonth, input.companyId);
      }),
    
    close: protectedProcedure
      .input(z.object({
        competenceMonth: z.string(),
        companyId: z.number().optional().default(1)
      }))
      .mutation(async ({ input, ctx }) => {
        return accounting.closePeriod(input.competenceMonth, ctx.user.id, input.companyId);
      })
  }),
  
  // Journals (Lotes Contábeis)
  journals: router({
    create: protectedProcedure
      .input(z.object({
        competenceMonth: z.string(),
        description: z.string().optional(),
        companyId: z.number().optional().default(1)
      }))
      .mutation(async ({ input, ctx }) => {
        return accounting.createJournal({
          ...input,
          createdBy: ctx.user.id
        });
      }),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return accounting.getJournalById(input.id);
      }),
    
    list: publicProcedure
      .input(z.object({
        companyId: z.number().optional(),
        competenceMonth: z.string().optional(),
        status: z.enum(["DRAFT", "POSTED", "REVERSED"]).optional(),
        limit: z.number().optional().default(100)
      }).optional())
      .query(async ({ input }) => {
        return accounting.getJournals(input || {});
      }),
    
    addEntries: protectedProcedure
      .input(z.object({
        journalId: z.number(),
        entries: z.array(z.object({
          accountId: z.number(),
          amount: z.number(),
          entryType: z.enum(["D", "C"]),
          description: z.string().optional(),
          sourceType: z.string().optional(),
          sourceId: z.number().optional()
        })),
        entryDate: z.string().transform(s => new Date(s)),
        competenceMonth: z.string()
      }))
      .mutation(async ({ input }) => {
        return accounting.addEntriesToJournal(
          input.journalId,
          input.entries,
          input.entryDate,
          input.competenceMonth
        );
      }),
    
    getEntries: publicProcedure
      .input(z.object({ journalId: z.number() }))
      .query(async ({ input }) => {
        return accounting.getJournalEntries(input.journalId);
      }),
    
    post: protectedProcedure
      .input(z.object({ journalId: z.number() }))
      .mutation(async ({ input }) => {
        return accounting.postJournal(input.journalId);
      }),
    
    linkSource: protectedProcedure
      .input(z.object({
        journalId: z.number(),
        sourceType: z.string(),
        sourceId: z.number(),
        companyId: z.number().optional()
      }))
      .mutation(async ({ input }) => {
        return accounting.linkJournalSource(input);
      }),
    
    getBySource: publicProcedure
      .input(z.object({
        sourceType: z.string(),
        sourceId: z.number(),
        companyId: z.number().optional().default(1)
      }))
      .query(async ({ input }) => {
        return accounting.getJournalBySource(input.sourceType, input.sourceId, input.companyId);
      })
  }),
  
  // Relatórios
  reports: router({
    razao: publicProcedure
      .input(z.object({
        accountId: z.number(),
        startDate: z.string().transform(s => new Date(s)),
        endDate: z.string().transform(s => new Date(s)),
        companyId: z.number().optional().default(1)
      }))
      .query(async ({ input }) => {
        return accounting.getRazao(
          input.accountId,
          input.startDate,
          input.endDate,
          input.companyId
        );
      }),
    
    razaoMultiple: publicProcedure
      .input(z.object({
        accountIds: z.array(z.number()),
        startDate: z.string().transform(s => new Date(s)),
        endDate: z.string().transform(s => new Date(s)),
        companyId: z.number().optional().default(1)
      }))
      .query(async ({ input }) => {
        if (input.accountIds.length === 0) {
          return { entries: [], totalDebits: 0, totalCredits: 0, balance: 0 };
        }
        
        const results = await Promise.all(
          input.accountIds.map(accountId =>
            accounting.getRazao(accountId, input.startDate, input.endDate, input.companyId)
          )
        );
        
        let totalDebits = 0;
        let totalCredits = 0;
        const allEntries: any[] = [];
        
        results.forEach(result => {
          const entries = result.entries || [];
          const account = result.account;
          
          entries.forEach((entry: any) => {
            allEntries.push({
              ...entry,
              accountCode: account?.code || '',
              accountName: account?.name || ''
            });
            totalDebits += entry.debit || 0;
            totalCredits += entry.credit || 0;
          });
        });
        
        // Ordenar por data
        allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        return {
          entries: allEntries,
          totalDebits,
          totalCredits,
          balance: totalDebits - totalCredits
        };
      }),
    
    balancete: publicProcedure
      .input(z.object({
        competenceMonth: z.string(),
        companyId: z.number().optional().default(1)
      }))
      .query(async ({ input }) => {
        return accounting.getBalancete(input.competenceMonth, input.companyId);
      }),
    
    dre: publicProcedure
      .input(z.object({
        competenceMonth: z.string(),
        companyId: z.number().optional().default(1)
      }))
      .query(async ({ input }) => {
        return accounting.getDRE(input.competenceMonth, input.companyId);
      })
  }),

  // Outras Receitas
  listOtherRevenues: protectedProcedure
    .input(z.object({
      competenceMonth: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return accounting.listOtherRevenues(input?.competenceMonth, ctx.activeCompanyId);
    }),

  createOtherRevenue: protectedProcedure
    .input(z.object({
      partnerId: z.number(),
      issueDate: z.string(),
      entryDate: z.string(),
      competenceMonth: z.string(),
      documentType: z.string().optional(),
      documentNumber: z.string().optional(),
      managementAccountId: z.number(),
      description: z.string(),
      creditDate: z.string().optional(),
      paymentMethod: z.string(),
      notes: z.string().optional(),
      amount: z.number(),
      status: z.enum(["ACTIVE", "CANCELLED"]).optional().default("ACTIVE"),
    }))
    .mutation(async ({ input, ctx }) => {
      return accounting.createOtherRevenue({
        ...input,
        companyId: ctx.activeCompanyId || 1,
        issueDate: new Date(input.issueDate),
        entryDate: new Date(input.entryDate),
        creditDate: input.creditDate ? new Date(input.creditDate) : undefined,
        createdBy: ctx.user.id
      });
    }),

  updateOtherRevenue: protectedProcedure
    .input(z.object({
      id: z.number(),
      partnerId: z.number().optional(),
      issueDate: z.string().optional(),
      entryDate: z.string().optional(),
      competenceMonth: z.string().optional(),
      documentType: z.string().optional(),
      documentNumber: z.string().optional(),
      managementAccountId: z.number().optional(),
      description: z.string().optional(),
      creditDate: z.string().optional(),
      paymentMethod: z.string().optional(),
      notes: z.string().optional(),
      amount: z.number().optional(),
      status: z.enum(["ACTIVE", "CANCELLED"]).optional()
    }))
    .mutation(async ({ input }) => {
      const { id, issueDate, entryDate, creditDate, ...rest } = input;
      return accounting.updateOtherRevenue(id, {
        ...rest,
        issueDate: issueDate ? new Date(issueDate) : undefined,
        entryDate: entryDate ? new Date(entryDate) : undefined,
        creditDate: creditDate ? new Date(creditDate) : undefined
      });
    }),

  deleteOtherRevenue: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return accounting.deleteOtherRevenue(input.id);
    }),

  // Listar Plano de Contas (atalho para frontend)
  listChartOfAccounts: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return accounting.getChartOfAccounts(ctx.activeCompanyId || 1);
    }),

  // Contas Gerenciais
  listManagementAccounts: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return accounting.listManagementAccounts(ctx.activeCompanyId || 1);
    }),

  createManagementAccount: protectedProcedure
    .input(z.object({
      code: z.string(),
      name: z.string(),
      description: z.string().optional(),
      nature: z.enum(["CUSTO", "DESPESA", "RECEITA", "PATRIMONIAL"]),
      costType: z.enum(["FIXA", "VARIAVEL"]).nullable().optional(),
      classification: z.enum(["OPERACIONAL", "ADMINISTRATIVA", "COMERCIAL", "FINANCEIRA", "NAO_OPERACIONAL", "PATRIMONIAL"]),
      impactMargin: z.boolean().optional().default(false),
      impactPayroll: z.boolean().optional().default(false),
      isActive: z.boolean().optional().default(true)
    }))
    .mutation(async ({ input }) => {
      return accounting.createManagementAccount(input);
    }),

  updateManagementAccount: protectedProcedure
    .input(z.object({
      id: z.number(),
      code: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      nature: z.enum(["CUSTO", "DESPESA", "RECEITA", "PATRIMONIAL"]).optional(),
      costType: z.enum(["FIXA", "VARIAVEL"]).nullable().optional(),
      classification: z.enum(["OPERACIONAL", "ADMINISTRATIVA", "COMERCIAL", "FINANCEIRA", "NAO_OPERACIONAL", "PATRIMONIAL"]).optional(),
      impactMargin: z.boolean().optional(),
      impactPayroll: z.boolean().optional(),
      isActive: z.boolean().optional(),
      accountingCode: z.string().nullable().optional()
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return accounting.updateManagementAccount(id, data as any);
    }),

  updateAccountingMapping: protectedProcedure
    .input(z.object({
      managementAccountId: z.number(),
      accountingCode: z.string(),
      notes: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      return accounting.updateAccountingMapping(input);
    }),

  // [TEMP] Reprocessar janeiro - endpoint temporário para recuperar journals deletados
  reprocessJanuary: protectedProcedure.mutation(async () => {
    const { reprocessSaleAccounting, reprocessPurchaseAccounting, reprocessExpenseAccounting } = await import('../db');
    const { getDb } = await import('../db');
    const { sales, purchaseOrders, expenses } = await import('../../drizzle/schema');
    
    console.log('[Reprocessamento] Iniciando reprocessamento de janeiro/2026...');
    
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    let salesCount = 0;
    let purchasesCount = 0;
    let expensesCount = 0;
    
    try {
      // 1. Buscar TODAS as vendas
      console.log('[Reprocessamento] Buscando vendas...');
      const allSales = await db.select().from(sales);
      console.log(`[Reprocessamento] Total de vendas no banco: ${allSales.length}`);
      
      // Filtrar vendas de janeiro/2026
      const januarySales = allSales.filter(s => {
        if (!s.saleDate) return false;
        const year = s.saleDate.getFullYear();
        const month = s.saleDate.getMonth() + 1;
        return year === 2026 && month === 1 && s.status === 'ACTIVE';
      });
      
      console.log(`[Reprocessamento] Vendas de janeiro encontradas: ${januarySales.length}`);
      
      // Processar cada venda
      for (const sale of januarySales) {
        const result = await reprocessSaleAccounting(sale.id);
        if (result.success) {
          salesCount++;
          if (salesCount % 100 === 0) {
            console.log(`[Reprocessamento] Processadas ${salesCount} vendas...`);
          }
        } else {
          console.error(`[Reprocessamento] Erro ao reprocessar venda ${sale.id}: ${result.error}`);
        }
      }
      
      // 2. Buscar TODAS as compras
      console.log('[Reprocessamento] Buscando compras...');
      const allPurchases = await db.select().from(purchaseOrders);
      console.log(`[Reprocessamento] Total de compras no banco: ${allPurchases.length}`);
      
      // Filtrar compras de janeiro/2026
      const januaryPurchases = allPurchases.filter(p => {
        if (!p.confirmedAt) return false;
        const year = p.confirmedAt.getFullYear();
        const month = p.confirmedAt.getMonth() + 1;
        return year === 2026 && month === 1 && p.status === 'CONFIRMED';
      });
      
      console.log(`[Reprocessamento] Compras de janeiro encontradas: ${januaryPurchases.length}`);
      
      // Processar cada compra
      for (const purchase of januaryPurchases) {
        const result = await reprocessPurchaseAccounting(purchase.id);
        if (result.success) {
          purchasesCount++;
        } else {
          console.error(`[Reprocessamento] Erro ao reprocessar compra ${purchase.id}: ${result.error}`);
        }
      }
      
      // 3. Buscar TODAS as despesas
      console.log('[Reprocessamento] Buscando despesas...');
      const allExpenses = await db.select().from(expenses);
      console.log(`[Reprocessamento] Total de despesas no banco: ${allExpenses.length}`);
      
      // Filtrar despesas de janeiro/2026
      const januaryExpenses = allExpenses.filter(e => {
        if (!e.competenceDate) return false;
        const year = e.competenceDate.getFullYear();
        const month = e.competenceDate.getMonth() + 1;
        return year === 2026 && month === 1 && e.status === 'ACTIVE';
      });
      
      console.log(`[Reprocessamento] Despesas de janeiro encontradas: ${januaryExpenses.length}`);
      
      // Processar cada despesa
      for (const expense of januaryExpenses) {
        const result = await reprocessExpenseAccounting(expense.id);
        if (result.success) {
          expensesCount++;
        } else {
          console.error(`[Reprocessamento] Erro ao reprocessar despesa ${expense.id}: ${result.error}`);
        }
      }
      
      console.log('[Reprocessamento] Concluído!');
      console.log(`[Reprocessamento] Vendas: ${salesCount}, Compras: ${purchasesCount}, Despesas: ${expensesCount}`);
      
      return {
        success: true,
        salesCount,
        purchasesCount,
        expensesCount
      };
    } catch (error) {
      console.error('[Reprocessamento] Erro geral:', error);
      throw error;
    }
  }),

  // [TEMP] Debug journals de janeiro
  debugJanuaryJournals: publicProcedure.query(async () => {
    const { getDb } = await import('../db');
    const { journals, accountingEntries, journalSources, chartOfAccounts } = await import('../../drizzle/schema');
    const { eq, and, sql } = await import('drizzle-orm');
    
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    // Contar journals por status
    const statusCounts = await db.execute(sql`
      SELECT j.status, COUNT(DISTINCT j.id) as total_journals, COUNT(ae.id) as total_entries
      FROM journals j 
      LEFT JOIN accountingEntries ae ON ae.journalId = j.id
      WHERE j.competenceMonth = '2026-01' 
      GROUP BY j.status
    `);
    
    // Contar por sourceType
    const sourceCounts = await db.execute(sql`
      SELECT js.sourceType, j.status, COUNT(DISTINCT j.id) as total
      FROM journals j 
      LEFT JOIN journalSources js ON js.journalId = j.id
      WHERE j.competenceMonth = '2026-01' 
      GROUP BY js.sourceType, j.status
    `);
    
    // Amostra de entries de receita
    const revenueEntries = await db.execute(sql`
      SELECT ae.id, ae.accountId, coa.code, coa.name, ae.entryType, ae.amount, j.status
      FROM accountingEntries ae
      INNER JOIN journals j ON ae.journalId = j.id
      INNER JOIN chartOfAccounts coa ON ae.accountId = coa.id
      WHERE ae.competenceMonth = '2026-01'
        AND coa.code LIKE '4%'
      LIMIT 20
    `);
    
    return {
      statusCounts: statusCounts[0],
      sourceCounts: sourceCounts[0],
      revenueEntries: revenueEntries[0]
    };
  })
});
