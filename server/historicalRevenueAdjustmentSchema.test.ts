import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
const schemaContent = fs.readFileSync(schemaPath, "utf-8");
const adjustmentSchema = schemaContent.slice(
  schemaContent.indexOf("export const historicalRevenueAdjustments"),
  schemaContent.indexOf("export type HistoricalRevenueAdjustment")
);

describe("Parcelas de faturamento histórico", () => {
  it("permite mais de uma parcela auditável para a mesma empresa, canal e data", () => {
    expect(adjustmentSchema).toContain("companyChannelDateIdx: index(\"historical_revenue_company_channel_date_idx\")");
    expect(adjustmentSchema).not.toContain("uniqueIndex(\"historical_revenue_company_channel_date_uq\")");
  });

  it("mantém status e metadados de aprovação e cancelamento para cada parcela", () => {
    expect(adjustmentSchema).toContain('status: mysqlEnum("status", ["DRAFT", "APPROVED", "CANCELLED"])');
    expect(adjustmentSchema).toContain('approvedAt: timestamp("approvedAt")');
    expect(adjustmentSchema).toContain('cancelledAt: timestamp("cancelledAt")');
    expect(adjustmentSchema).toContain('cancellationReason: varchar("cancellationReason", { length: 500 })');
  });
});
