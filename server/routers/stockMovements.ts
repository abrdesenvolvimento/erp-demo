/**
 * Router tRPC para Auditoria de Movimentações de Estoque
 * 
 * Permite consultar todas as movimentações de estoque (entradas, saídas, estornos, perdas, acertos)
 * de forma consolidada com filtros e paginação.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const stockMovementsRouter = router({
  /**
   * Listar todas as movimentações com filtros e paginação
   */
  list: protectedProcedure
    .input(z.object({
      type: z.enum(['ENTRADA', 'SAIDA', 'PERDA', 'ACERTO', 'ESTORNO']).optional(),
      productId: z.number().optional(),
      search: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      return await db.getAllProductMovements({
        companyId: ctx.activeCompanyId,
        type: input.type,
        productId: input.productId,
        search: input.search,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        page: input.page,
        pageSize: input.pageSize,
      });
    }),

  /**
   * Estatísticas de movimentações
   */
  stats: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return await db.getMovementStats(
        ctx.activeCompanyId!,
        input?.startDate ? new Date(input.startDate) : undefined,
        input?.endDate ? new Date(input.endDate) : undefined,
      );
    }),
});
