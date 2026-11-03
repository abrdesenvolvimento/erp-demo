import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { assertOperatorActive } from "../operatorSecurity";
import { readProductionTerminal, productionRequestAllowed } from "../productionTerminalSecurity";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });
export const router = t.router;
export const publicProcedure = t.procedure;

// Reservado a status, configuração inicial e desbloqueio. Não dá acesso às operações de negócio.
export const identityProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  await assertOperatorActive(ctx.user, ctx.operatorSessionId, ctx.activeCompanyId);
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  return next({ ctx });
});
export const operationalProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "operacional" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado. Apenas usuários operacionais ou administradores." });
  return next({ ctx });
});
export const consultorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "consultor" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado. Apenas consultores ou administradores." });
  return next({ ctx });
});

// Consulta automática de terminal pareado: não permite alterar status, cancelar, vender ou receber.
export const productionReadProcedure = t.procedure.use(async ({ ctx, next, path, type, getRawInput }) => {
  const raw = await getRawInput() as { companyId?: number } | undefined;
  const terminal = await readProductionTerminal(ctx.req);
  if (terminal && productionRequestAllowed(path, type, raw?.companyId, terminal.companyId)) return next({ ctx });
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  await assertOperatorActive(ctx.user, ctx.operatorSessionId, raw?.companyId);
  return next({ ctx });
});
