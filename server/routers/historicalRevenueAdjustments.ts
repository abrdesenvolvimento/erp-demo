import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

const channelSchema = z.enum(["BALCAO", "DELIVERY", "A_PRAZO", "SALAO"]);
const statusSchema = z.enum(["DRAFT", "APPROVED", "CANCELLED"]);

function competenceFromDate(date: string) {
  return date.slice(0, 7);
}

function requireActiveCompanyId(companyId: number | undefined) {
  if (!Number.isInteger(companyId) || !companyId || companyId < 1) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Selecione uma empresa antes de gerir a implantação histórica." });
  }
  return companyId;
}

export const historicalRevenueAdjustmentsRouter = router({
  list: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: statusSchema.optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return db.listHistoricalRevenueAdjustments(requireActiveCompanyId(ctx.activeCompanyId), input);
    }),

  summary: protectedProcedure
    .query(async ({ ctx }) => {
      return db.getHistoricalRevenueAdjustmentSummary(requireActiveCompanyId(ctx.activeCompanyId));
    }),

  createDraft: adminProcedure
    .input(z.object({
      adjustmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      channel: channelSchema.default("BALCAO"),
      amount: z.number().positive().max(999999999),
      description: z.string().trim().min(3).max(255),
      notes: z.string().trim().max(2000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const companyId = requireActiveCompanyId(ctx.activeCompanyId);
      try {
        return await db.createHistoricalRevenueAdjustment({
          companyId,
          branchId: ctx.activeBranchId || null,
          adjustmentDate: input.adjustmentDate,
          competenceMonth: competenceFromDate(input.adjustmentDate),
          channel: input.channel,
          amount: input.amount.toFixed(2),
          status: "DRAFT",
          source: "POST_BACKUP_IMPLEMENTATION",
          description: input.description,
          notes: input.notes || null,
          createdBy: ctx.user.id,
        });
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe um ajuste histórico para este canal e esta data." });
        }
        throw error;
      }
    }),

  updateDraft: adminProcedure
    .input(z.object({
      id: z.number(),
      adjustmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      amount: z.number().positive().max(999999999).optional(),
      description: z.string().trim().min(3).max(255).optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, adjustmentDate, amount, description, notes } = input;
      return db.updateHistoricalRevenueAdjustmentDraft(id, requireActiveCompanyId(ctx.activeCompanyId), {
        adjustmentDate,
        competenceMonth: adjustmentDate ? competenceFromDate(adjustmentDate) : undefined,
        amount: amount !== undefined ? amount.toFixed(2) : undefined,
        description,
        notes,
      });
    }),

  deleteDraft: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return db.deleteHistoricalRevenueAdjustmentDraft(input.id, requireActiveCompanyId(ctx.activeCompanyId));
    }),

  approveDrafts: adminProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      return db.approveHistoricalRevenueAdjustments(input.ids, requireActiveCompanyId(ctx.activeCompanyId), ctx.user.id);
    }),

  cancelApproved: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      reason: z.string().trim().min(3).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.cancelApprovedHistoricalRevenueAdjustment(
        input.id,
        requireActiveCompanyId(ctx.activeCompanyId),
        ctx.user.id,
        input.reason
      );
    }),
});
