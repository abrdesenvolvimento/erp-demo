import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { companies, branches, userCompanies } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

export const companyRouter = router({
  // Lista empresas que o usuário tem acesso
  myCompanies: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const results = await db
      .select({
        companyId: userCompanies.companyId,
        branchId: userCompanies.branchId,
        role: userCompanies.role,
        isDefault: userCompanies.isDefault,
        companyName: companies.tradeName,
        companyLegalName: companies.name,
        segment: companies.segment,
        branchName: branches.name,
        branchCity: branches.city,
        branchState: branches.state,
      })
      .from(userCompanies)
      .innerJoin(companies, eq(userCompanies.companyId, companies.id))
      .leftJoin(branches, eq(userCompanies.branchId, branches.id))
      .where(eq(userCompanies.userId, ctx.user.id));

    return results;
  }),

  // Troca empresa/filial ativa (salva no cookie)
  setActive: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      branchId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verificar se o usuário tem acesso a essa empresa/filial
      const access = await db
        .select()
        .from(userCompanies)
        .where(
          and(
            eq(userCompanies.userId, ctx.user.id),
            eq(userCompanies.companyId, input.companyId),
          )
        )
        .limit(1);

      if (access.length === 0) {
        throw new Error("Acesso negado a esta empresa");
      }

      // Setar cookies para persistir a seleção
      const cookieOpts = {
        httpOnly: false, // Frontend precisa ler para enviar no header
        secure: ctx.req.secure || ctx.req.headers['x-forwarded-proto'] === 'https',
        sameSite: 'lax' as const,
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 ano
        path: '/',
      };

      ctx.res.cookie('activeCompanyId', String(input.companyId), cookieOpts);
      ctx.res.cookie('activeBranchId', String(input.branchId), cookieOpts);

      return { success: true, companyId: input.companyId, branchId: input.branchId };
    }),

  // Detalhes de uma empresa
  getCompany: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const result = await db
        .select()
        .from(companies)
        .where(eq(companies.id, input.id))
        .limit(1);

      return result[0] || null;
    }),

  // Listar filiais de uma empresa
  getBranches: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(branches)
        .where(
          and(
            eq(branches.companyId, input.companyId),
            eq(branches.active, true),
          )
        );
    }),
});
