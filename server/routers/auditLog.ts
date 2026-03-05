/**
 * Router tRPC para Log de Alterações (Auditoria)
 * 
 * Permite consultar o histórico de alterações feitas em cadastros do sistema.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const auditLogRouter = router({
  /**
   * Buscar logs de auditoria com filtros e paginação
   */
  list: protectedProcedure
    .input(z.object({
      entityType: z.string().optional(),
      action: z.string().optional(),
      search: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(50),
    }).optional())
    .query(async ({ input, ctx }) => {
      const filters = input || {};
      return await db.getAuditLogs({
        companyId: ctx.activeCompanyId,
        entityType: filters.entityType,
        action: filters.action,
        search: filters.search,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        page: filters.page,
        pageSize: filters.pageSize,
      });
    }),

  /**
   * Buscar logs de uma entidade específica
   */
  getByEntity: protectedProcedure
    .input(z.object({
      entityType: z.string(),
      entityId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      return await db.getAuditLogs({
        companyId: ctx.activeCompanyId,
        entityType: input.entityType,
        entityId: input.entityId,
        pageSize: 100,
      });
    }),

  /**
   * Estatísticas de auditoria
   */
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      return await db.getAuditStats(ctx.activeCompanyId);
    }),
});
