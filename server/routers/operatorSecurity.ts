import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { parse } from "cookie";
import { COOKIE_NAME } from "../../shared/const";
import { ALLOWED_IDLE_MINUTES } from "../../shared/sessionSecurity";
import { router, publicProcedure, identityProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import * as security from "../operatorSecurity";
import { readProductionTerminal, enableProductionTerminal, listProductionTerminals, revokeProductionTerminal } from "../productionTerminalSecurity";
import { getDb } from "../db";
import { operatorPins, operatorSessions, securityEvents, userCompanies, users } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";

function activeCompany(companyId: number | undefined): number {
  if (!companyId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Selecione a empresa para configurar a segurança." });
  return companyId;
}

export const operatorSecurityRouter = router({
  status: publicProcedure.query(async ({ ctx }) => {
    const status = await security.resolveOperatorStatus(ctx.user, ctx.operatorSessionId, ctx.activeCompanyId);
    if (!ctx.user && parse(ctx.req.headers.cookie ?? "")[COOKIE_NAME]) status.state = "LOGIN_REQUIRED";
    const terminal = await readProductionTerminal(ctx.req);
    return { ...status, productionTerminal: terminal ? { companyId: terminal.companyId, name: terminal.name } : null };
  }),
  activity: identityProcedure.mutation(async ({ ctx }) => security.touchOperatorSession(ctx.user, ctx.operatorSessionId, ctx.activeCompanyId)),
  lock: identityProcedure.mutation(async ({ ctx }) => {
    await security.lockOperatorSession(ctx.user, ctx.operatorSessionId, ctx.activeCompanyId);
    return { success: true } as const;
  }),
  unlock: identityProcedure.input(z.object({ pin: z.string().regex(/^\d{6}$/) })).mutation(async ({ ctx, input }) => security.verifyOperatorPin(ctx.user, ctx.operatorSessionId, input.pin, ctx.activeCompanyId)),
  setupPin: identityProcedure.input(z.object({ pin: z.string().regex(/^\d{6}$/) })).mutation(async ({ ctx, input }) => {
    await security.setupOperatorPin(ctx.user, ctx.operatorSessionId, input.pin, ctx.activeCompanyId);
    return { success: true } as const;
  }),
  policy: protectedProcedure.query(({ ctx }) => security.getSecurityPolicy(ctx.user, activeCompany(ctx.activeCompanyId))),
  updatePolicy: adminProcedure.input(z.object({ idleMinutes: z.number().int().refine(value => (ALLOWED_IDLE_MINUTES as readonly number[]).includes(value)) })).mutation(async ({ ctx, input }) => {
    await security.setSecurityPolicy(ctx.user, activeCompany(ctx.activeCompanyId), input.idleMinutes);
    return { success: true } as const;
  }),
  sessions: protectedProcedure.query(({ ctx }) => security.listOperatorSessions(ctx.user.id, ctx.operatorSessionId)),
  revokeSession: protectedProcedure.input(z.object({ sessionId: z.string().min(1).max(64) })).mutation(async ({ ctx, input }) => {
    await security.revokeOperatorSession(ctx.user.id, input.sessionId);
    return { success: true } as const;
  }),
  events: protectedProcedure.query(({ ctx }) => security.listSecurityEvents(ctx.user.id)),
  terminals: adminProcedure.query(({ ctx }) => listProductionTerminals(ctx.user, ctx.activeCompanyId)),
  enableProductionTerminal: adminProcedure.input(z.object({ name: z.string().trim().min(3).max(100) })).mutation(({ ctx, input }) => enableProductionTerminal(ctx.user, ctx.activeCompanyId, input.name, ctx.req, ctx.res)),
  revokeProductionTerminal: adminProcedure.input(z.object({ terminalId: z.string().min(1).max(64) })).mutation(({ ctx, input }) => revokeProductionTerminal(ctx.user, ctx.activeCompanyId, input.terminalId)),
  resetUserPin: adminProcedure.input(z.object({ userId: z.string().min(1).max(64), reason: z.string().trim().min(10).max(250) })).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível redefinir o próprio PIN por esta operação." });
    const companyId = activeCompany(ctx.activeCompanyId);
    await security.getSecurityPolicy(ctx.user, companyId);
    const db = await getDb();
    if (!db) throw new Error("Banco indisponível.");
    const [adminAccess] = await db.select().from(userCompanies).where(and(eq(userCompanies.userId, ctx.user.id), eq(userCompanies.companyId, companyId))).limit(1);
    const [targetAccess] = await db.select().from(userCompanies).where(and(eq(userCompanies.userId, input.userId), eq(userCompanies.companyId, companyId))).limit(1);
    if (adminAccess?.role !== "admin" || !targetAccess) throw new TRPCError({ code: "FORBIDDEN", message: "Sem autorização sobre este usuário na empresa ativa." });
    await db.transaction(async tx => {
      // Mesmo primeiro lock do fluxo de PIN: nenhuma verificação ou cadastro concorre ao reset.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1).for('update');
      await tx.update(operatorSessions).set({ revokedAt: new Date() }).where(eq(operatorSessions.userId, input.userId));
      await tx.delete(operatorPins).where(eq(operatorPins.userId, input.userId));
      await tx.insert(securityEvents).values({ userId: input.userId, companyId, event: "PIN_REDEFINIDO_ADMIN", details: JSON.stringify({ responsible: ctx.user.id, reason: input.reason }) });
    });
    return { success: true } as const;
  }),
});
