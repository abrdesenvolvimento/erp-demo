import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { printers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const printersRouter = router({
  // List printers for the active company
  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return await db
        .select()
        .from(printers)
        .where(eq(printers.companyId, input.companyId))
        .orderBy(printers.department, printers.name);
    }),

  // Get active printers by department
  getByDepartment: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      department: z.enum(["KITCHEN", "BAR", "CASHIER"]),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return await db
        .select()
        .from(printers)
        .where(
          and(
            eq(printers.companyId, input.companyId),
            eq(printers.department, input.department),
            eq(printers.active, true)
          )
        );
    }),

  // Create a new printer (admin only)
  create: adminProcedure
    .input(z.object({
      companyId: z.number(),
      name: z.string().min(1).max(100),
      department: z.enum(["KITCHEN", "BAR", "CASHIER"]),
      connectionType: z.enum(["NETWORK", "USB", "BLUETOOTH"]).default("NETWORK"),
      ipAddress: z.string().max(45).optional(),
      port: z.number().min(1).max(65535).default(9100),
      paperWidth: z.enum(["58mm", "80mm"]).default("80mm"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(printers).values({
        companyId: input.companyId,
        name: input.name,
        department: input.department,
        connectionType: input.connectionType,
        ipAddress: input.ipAddress || null,
        port: input.port,
        paperWidth: input.paperWidth,
      });
      return { id: (result as any).insertId };
    }),

  // Update a printer (admin only)
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      companyId: z.number(),
      name: z.string().min(1).max(100).optional(),
      department: z.enum(["KITCHEN", "BAR", "CASHIER"]).optional(),
      connectionType: z.enum(["NETWORK", "USB", "BLUETOOTH"]).optional(),
      ipAddress: z.string().max(45).optional().nullable(),
      port: z.number().min(1).max(65535).optional(),
      paperWidth: z.enum(["58mm", "80mm"]).optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, companyId, ...updates } = input;
      // Remove undefined fields
      const cleanUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) cleanUpdates[key] = value;
      }
      if (Object.keys(cleanUpdates).length === 0) return { success: true };
      await db
        .update(printers)
        .set(cleanUpdates)
        .where(and(eq(printers.id, id), eq(printers.companyId, companyId)));
      return { success: true };
    }),

  // Delete a printer (admin only)
  delete: adminProcedure
    .input(z.object({ id: z.number(), companyId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .delete(printers)
        .where(and(eq(printers.id, input.id), eq(printers.companyId, input.companyId)));
      return { success: true };
    }),

  // Get printer configuration summary (which departments have printers configured)
  getConfigSummary: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const allPrinters = await db
        .select()
        .from(printers)
        .where(and(eq(printers.companyId, input.companyId), eq(printers.active, true)));
      
      return {
        kitchen: allPrinters.filter(p => p.department === "KITCHEN"),
        bar: allPrinters.filter(p => p.department === "BAR"),
        cashier: allPrinters.filter(p => p.department === "CASHIER"),
        total: allPrinters.length,
      };
    }),
});
