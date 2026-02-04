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
  })
});
