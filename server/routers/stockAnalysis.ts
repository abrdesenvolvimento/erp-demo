/**
 * Router tRPC para Análise de Estoque
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getStockAnalysisByCategory, getStockAnalysisByProduct, getStockMonthlyEvolution, getStockOutProducts } from "../stockAnalysisQueries";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { getNowInBrazil } from '../../shared/dateUtils';

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getPeriodDates(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonth = getDaysInMonth(year, month);
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  // Período anterior
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear--;
  }
  const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
  const prevDays = getDaysInMonth(prevYear, prevMonth);
  const prevEndDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevDays).padStart(2, '0')}`;

  // Para o mês atual, usar apenas os dias passados (horário de Brasília)
  const nowBrazil = getNowInBrazil();
  const currentYear = nowBrazil.getFullYear();
  const currentMonth = nowBrazil.getMonth() + 1;
  const currentDay = nowBrazil.getDate();

  let effectiveDays = daysInMonth;
  if (year === currentYear && month === currentMonth) {
    effectiveDays = currentDay;
  }

  return { startDate, endDate, prevStartDate, prevEndDate, daysInPeriod: effectiveDays };
}

export const stockAnalysisRouter = router({
  /**
   * Resumo por categoria
   */
  byCategory: protectedProcedure
    .input(z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
    }))
    .query(async ({ input, ctx }) => {
      const companyId = ctx.activeCompanyId;
      const { startDate, endDate, prevStartDate, prevEndDate, daysInPeriod } = getPeriodDates(input.year, input.month);
      return await getStockAnalysisByCategory(startDate, endDate, prevStartDate, prevEndDate, daysInPeriod, companyId);
    }),

  /**
   * Detalhe por produto
   */
  byProduct: protectedProcedure
    .input(z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
      categoryId: z.number().optional(),
      subcategory: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const companyId = ctx.activeCompanyId;
      const { startDate, endDate, prevStartDate, prevEndDate, daysInPeriod } = getPeriodDates(input.year, input.month);
      return await getStockAnalysisByProduct(startDate, endDate, prevStartDate, prevEndDate, daysInPeriod, input.categoryId, input.subcategory, companyId);
    }),

  /**
   * Lista de subcategorias disponíveis
   */
  /**
   * Evolução mensal do estoque (últimos N meses)
   */
  monthlyEvolution: protectedProcedure
    .input(z.object({
      months: z.number().min(3).max(24).optional(),
      categoryId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const companyId = ctx.activeCompanyId;
      return await getStockMonthlyEvolution(input.months || 12, companyId, input.categoryId);
    }),

  /**
   * Produtos com estoque zerado (ruptura)
   */
  stockOut: protectedProcedure
    .input(z.object({
      categoryId: z.number().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const companyId = ctx.activeCompanyId;
      return await getStockOutProducts(companyId, input?.categoryId);
    }),

  subcategories: protectedProcedure
    .input(z.object({
      categoryId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const companyId = ctx.activeCompanyId;
      const catFilter = input.categoryId ? `AND categoryId = ${input.categoryId}` : '';
      const companyFilter = companyId ? `AND companyId = ${companyId}` : '';
      const result = await db.execute(sql.raw(`
        SELECT DISTINCT subcategory 
        FROM products 
        WHERE subcategory IS NOT NULL AND subcategory != '' 
          AND active = 1
          ${catFilter}
          ${companyFilter}
        Order by subcategory
      `));
      return (result[0] as unknown as any[]).map((r: any) => r.subcategory as string);
    }),
});
