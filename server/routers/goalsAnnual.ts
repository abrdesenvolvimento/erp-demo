import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { branches, userCompanies } from "../../drizzle/schema";
import { protectedProcedure } from "../_core/trpc";
import { getDb, getAnnualRevenueGoalProgress } from "../db";

export const annualGoalsProgressProcedure = protectedProcedure
  .input(z.object({ year: z.number().int().min(2000).max(2100) }).strict())
  .query(async ({ input, ctx }) => {
    const companyId = ctx.activeCompanyId;
    const branchId = ctx.activeBranchId;
    if (!Number.isSafeInteger(companyId) || !companyId || companyId < 1 ||
        !Number.isSafeInteger(branchId) || !branchId || branchId < 1) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Selecione uma empresa e uma filial para acompanhar as metas." });
    }
    const database = await getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível consultar as metas. Tente novamente." });
    // O contexto vem de headers/cookies: validar também o vínculo de filial.
    // branchId null no vínculo representa acesso a todas as filiais da empresa.
    const access = await database.select({ id: userCompanies.id })
      .from(userCompanies)
      .innerJoin(branches, and(eq(branches.id, branchId), eq(branches.companyId, companyId), eq(branches.active, true)))
      .where(and(eq(userCompanies.userId, ctx.user.id), eq(userCompanies.companyId, companyId),
        or(eq(userCompanies.branchId, branchId), isNull(userCompanies.branchId))))
      .limit(1);
    if (!access.length) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado às metas desta empresa/filial." });
    return getAnnualRevenueGoalProgress(input.year, companyId, branchId);
  });
