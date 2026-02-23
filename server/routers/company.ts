import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { companies, branches, userCompanies, users } from "../../drizzle/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";

// Admin procedure for company management
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito a administradores' });
  }
  return next({ ctx });
});

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
        companyLogoUrl: companies.logoUrl,
        companyDocNumber: companies.docNumber,
        segment: companies.segment,
        branchName: branches.name,
        branchStreet: branches.street,
        branchStreetNumber: branches.streetNumber,
        branchNeighborhood: branches.neighborhood,
        branchCity: branches.city,
        branchState: branches.state,
        branchZipCode: branches.zipCode,
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

  // ==================== GESTÃO DE ACESSO POR EMPRESA ====================

  // Listar usuários com acesso a uma empresa específica
  companyUsers: adminProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const results = await db
        .select({
          id: userCompanies.id,
          userId: userCompanies.userId,
          companyId: userCompanies.companyId,
          branchId: userCompanies.branchId,
          role: userCompanies.role,
          isDefault: userCompanies.isDefault,
          userName: users.name,
          userEmail: users.email,
          userRole: users.role,
          lastSignedIn: users.lastSignedIn,
        })
        .from(userCompanies)
        .innerJoin(users, eq(userCompanies.userId, users.id))
        .where(eq(userCompanies.companyId, input.companyId));

      return results;
    }),

  // Listar todas as empresas (para admin gerenciar)
  allCompanies: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];

      const result = await db
        .select({
          id: companies.id,
          name: companies.name,
          tradeName: companies.tradeName,
          segment: companies.segment,
          logoUrl: companies.logoUrl,
          active: companies.active,
        })
        .from(companies)
        .where(eq(companies.active, true));

      return result;
    }),

  // Listar todos os usuários do sistema (para dropdown de adição)
  allUsers: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];

      const result = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users);

      return result;
    }),

  // Conceder acesso de usuário a uma empresa
  grantAccess: adminProcedure
    .input(z.object({
      userId: z.string(),
      companyId: z.number(),
      branchId: z.number().optional().default(1),
      role: z.enum(['admin', 'operacional', 'consultor']).default('operacional'),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Verificar se já tem acesso
      const existing = await db
        .select()
        .from(userCompanies)
        .where(
          and(
            eq(userCompanies.userId, input.userId),
            eq(userCompanies.companyId, input.companyId),
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Usuário já possui acesso a esta empresa',
        });
      }

      await db.insert(userCompanies).values({
        userId: input.userId,
        companyId: input.companyId,
        branchId: input.branchId,
        role: input.role,
        isDefault: false,
      });

      return { success: true };
    }),

  // Revogar acesso de usuário a uma empresa
  revokeAccess: adminProcedure
    .input(z.object({
      userId: z.string(),
      companyId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Não pode revogar o próprio acesso
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Você não pode revogar seu próprio acesso',
        });
      }

      await db.delete(userCompanies)
        .where(
          and(
            eq(userCompanies.userId, input.userId),
            eq(userCompanies.companyId, input.companyId),
          )
        );

      return { success: true };
    }),

  // Atualizar role de usuário em uma empresa
  updateUserRole: adminProcedure
    .input(z.object({
      userId: z.string(),
      companyId: z.number(),
      role: z.enum(['admin', 'operacional', 'consultor']),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Não pode alterar o próprio role
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Você não pode alterar seu próprio nível de acesso',
        });
      }

      await db.update(userCompanies)
        .set({ role: input.role })
        .where(
          and(
            eq(userCompanies.userId, input.userId),
            eq(userCompanies.companyId, input.companyId),
          )
        );

      return { success: true };
    }),
});
