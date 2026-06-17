import { describe, it, expect } from "vitest";

describe("Internal Sales Router", () => {
  it("should have the internalSales router module exported", async () => {
    const { internalSalesRouter } = await import("./routers/internalSales");
    expect(internalSalesRouter).toBeDefined();
  });

  it("should have all required procedures", async () => {
    const { internalSalesRouter } = await import("./routers/internalSales");
    const procedures = Object.keys(internalSalesRouter._def.procedures);
    expect(procedures).toContain("list");
    expect(procedures).toContain("getById");
    expect(procedures).toContain("create");
    expect(procedures).toContain("approve");
    expect(procedures).toContain("reject");
    expect(procedures).toContain("cancel");
    expect(procedures).toContain("getCompanyProducts");
    expect(procedures).toContain("getTargetCompanies");
  });

  it("should be registered in the main app router", async () => {
    const { appRouter } = await import("./routers");
    // tRPC flattens router keys with dots, e.g. "internalSales.list"
    const procedures = Object.keys(appRouter._def.procedures);
    const hasInternalSales = procedures.some(p => p.startsWith("internalSales."));
    expect(hasInternalSales).toBe(true);
  });

  it("should have internalSales and internalSaleItems tables in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.internalSales).toBeDefined();
    expect(schema.internalSaleItems).toBeDefined();
  });

  it("internalSales table should have required columns", async () => {
    const schema = await import("../drizzle/schema");
    const columns = Object.keys(schema.internalSales);
    // Check key columns exist in the table definition
    expect(columns.length).toBeGreaterThan(0);
    // Verify the table has the expected structure
    const tableColumns = Object.keys((schema.internalSales as any).$inferSelect || {});
    // At minimum we expect these fields
    expect(schema.internalSales).toHaveProperty("id");
    expect(schema.internalSales).toHaveProperty("sourceCompanyId");
    expect(schema.internalSales).toHaveProperty("targetCompanyId");
    expect(schema.internalSales).toHaveProperty("status");
    expect(schema.internalSales).toHaveProperty("totalAmount");
  });

  it("internalSaleItems table should have required columns", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.internalSaleItems).toHaveProperty("id");
    expect(schema.internalSaleItems).toHaveProperty("internalSaleId");
    expect(schema.internalSaleItems).toHaveProperty("sourceProductId");
    expect(schema.internalSaleItems).toHaveProperty("quantity");
    expect(schema.internalSaleItems).toHaveProperty("unitCost");
    expect(schema.internalSaleItems).toHaveProperty("totalCost");
  });
});
