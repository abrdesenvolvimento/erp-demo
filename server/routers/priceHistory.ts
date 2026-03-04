/**
 * Router tRPC para Histórico de Preços (Auditoria)
 * 
 * Permite consultar o histórico de alterações de preços de venda e custo médio.
 * O registro é feito automaticamente ao alterar preços via produtos.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const priceHistoryRouter = router({
  /**
   * Buscar histórico de preços de um produto específico
   */
  getByProduct: protectedProcedure
    .input(z.object({
      productId: z.number(),
      limit: z.number().optional().default(100),
    }))
    .query(async ({ input, ctx }) => {
      return await db.getPriceHistoryByProduct(
        input.productId,
        ctx.activeCompanyId,
        input.limit,
      );
    }),

  /**
   * Buscar histórico recente com filtros e paginação
   */
  getRecent: protectedProcedure
    .input(z.object({
      changeType: z.enum(['PRECO_VENDA', 'CUSTO_MEDIO']).optional(),
      channelId: z.number().optional(),
      productId: z.number().optional(),
      startDate: z.string().optional(), // ISO date string
      endDate: z.string().optional(),   // ISO date string
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(50),
    }).optional())
    .query(async ({ input, ctx }) => {
      const filters = input || {};
      return await db.getRecentPriceHistory({
        companyId: ctx.activeCompanyId,
        changeType: filters.changeType,
        channelId: filters.channelId,
        productId: filters.productId,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        page: filters.page,
        pageSize: filters.pageSize,
      });
    }),

  /**
   * Estatísticas de alterações de preço
   */
  getStats: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return await db.getPriceHistoryStats(
        ctx.activeCompanyId!,
        input?.startDate ? new Date(input.startDate) : undefined,
        input?.endDate ? new Date(input.endDate) : undefined,
      );
    }),
});
