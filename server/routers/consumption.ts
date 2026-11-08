import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as consumption from "../consumption";
import type { TrpcContext } from "../_core/context";

const scope = z.object({
  companyId: z.number().int().positive(),
  branchId: z.number().int().positive(),
});
const reason = z
  .string()
  .trim()
  .min(3, "Informe um motivo de pelo menos 3 caracteres.")
  .max(2000);
const id = z.number().int().positive();
const businessDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Data inválida.");

async function authorized(
  ctx: TrpcContext,
  input: consumption.ConsumptionScope,
  action: "read" | "write" | "admin"
) {
  // Before getDb(): missing context and forged cache scope are never authorized by input IDs.
  consumption.assertConsumptionContext(ctx, input);
  const db = await consumption.consumptionDatabase();
  const repo = consumption.makeConsumptionRepository(db);
  const actor = await consumption.authorizeConsumption(
    ctx,
    input,
    action,
    repo
  );
  return { db, repo, actor };
}

export const consumptionRouter = router({
  employees: protectedProcedure
    .input(scope.extend({ includeInactive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const { db, actor } = await authorized(ctx, input, "read");
      return consumption.getConsumptionEmployees(
        db,
        actor,
        input.includeInactive
      );
    }),
  saveEmployee: protectedProcedure
    .input(
      scope.extend({
        id: id.optional(),
        name: z.string().trim().min(2).max(200),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, actor } = await authorized(ctx, input, "admin");
      return consumption.saveConsumptionEmployee(db, actor, input);
    }),
  products: protectedProcedure
    .input(scope.extend({ search: z.string().trim().max(200).optional() }))
    .query(async ({ ctx, input }) => {
      const { db, actor } = await authorized(ctx, input, "read");
      return consumption.getConsumptionProducts(db, actor, input.search);
    }),
  list: protectedProcedure
    .input(
      scope
        .extend({
          startDate: businessDate.optional(),
          endDate: businessDate.optional(),
          employeeId: id.optional(),
          status: z.enum(["ACTIVE", "CANCELLED"]).optional(),
          page: z.number().int().min(1).max(100000).default(1),
          pageSize: z.number().int().min(1).max(100).default(20),
        })
        .refine(
          input =>
            !input.startDate ||
            !input.endDate ||
            input.startDate <= input.endDate,
          "A data inicial deve ser anterior à final."
        )
    )
    .query(async ({ ctx, input }) => {
      const { db, actor } = await authorized(ctx, input, "read");
      return consumption.listConsumption(db, {
        ...input,
        companyId: actor.companyId,
        branchId: actor.branchId,
      });
    }),
  get: protectedProcedure
    .input(scope.extend({ id }))
    .query(async ({ ctx, input }) => {
      const { db, actor } = await authorized(ctx, input, "read");
      return consumption.getConsumption(db, actor, input.id);
    }),
  create: protectedProcedure
    .input(
      scope.extend({
        employeeId: id,
        reason,
        requestKey: z.string().uuid(),
        consumedAt: z.date().optional(),
        items: z
          .array(
            z.object({
              productId: id,
              quantity: z.number().int().positive().max(2147483647),
            })
          )
          .min(1)
          .max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { repo, actor } = await authorized(ctx, input, "write");
      return consumption.createConsumption(actor, input, repo);
    }),
  cancel: protectedProcedure
    .input(scope.extend({ id, reason }))
    .mutation(async ({ ctx, input }) => {
      const { repo, actor } = await authorized(ctx, input, "admin");
      return consumption.cancelConsumption(actor, input.id, input.reason, repo);
    }),
});
