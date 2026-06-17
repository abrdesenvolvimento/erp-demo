import { describe, it, expect } from "vitest";

describe("Internal Sales Router", () => {
  it("should have the internalSales router module exported", async () => {
    const { internalSalesRouter } = await import("./routers/internalSales");
    expect(internalSalesRouter).toBeDefined();
  });

  it("should have all required procedures including v2 additions", async () => {
    const { internalSalesRouter } = await import("./routers/internalSales");
    const procedures = Object.keys(internalSalesRouter._def.procedures);
    // Core CRUD
    expect(procedures).toContain("list");
    expect(procedures).toContain("getById");
    expect(procedures).toContain("create");
    expect(procedures).toContain("approve");
    expect(procedures).toContain("reject");
    expect(procedures).toContain("cancel");
    expect(procedures).toContain("getCompanyProducts");
    expect(procedures).toContain("getTargetCompanies");
    // v2 additions
    expect(procedures).toContain("dashboardStats");
    expect(procedures).toContain("checkMapping");
    expect(procedures).toContain("mappingList");
    expect(procedures).toContain("mappingCreate");
    expect(procedures).toContain("mappingDelete");
    expect(procedures).toContain("mappingBulkCreate");
  });

  it("should be registered in the main app router", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys(appRouter._def.procedures);
    const hasInternalSales = procedures.some(p => p.startsWith("internalSales."));
    expect(hasInternalSales).toBe(true);
    // Verify key v2 procedures are accessible from the root router
    expect(procedures).toContain("internalSales.dashboardStats");
    expect(procedures).toContain("internalSales.create");
    expect(procedures).toContain("internalSales.approve");
  });

  it("should have internalSales and internalSaleItems tables in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.internalSales).toBeDefined();
    expect(schema.internalSaleItems).toBeDefined();
    expect(schema.productMapping).toBeDefined();
  });

  it("internalSales table should have all v2 columns", async () => {
    const schema = await import("../drizzle/schema");
    // Original columns
    expect(schema.internalSales).toHaveProperty("id");
    expect(schema.internalSales).toHaveProperty("sourceCompanyId");
    expect(schema.internalSales).toHaveProperty("targetCompanyId");
    expect(schema.internalSales).toHaveProperty("status");
    expect(schema.internalSales).toHaveProperty("totalAmount");
    expect(schema.internalSales).toHaveProperty("createdBy");
    expect(schema.internalSales).toHaveProperty("notes");
    // v2 columns
    expect(schema.internalSales).toHaveProperty("docNumber");
    expect(schema.internalSales).toHaveProperty("marginPercent");
    expect(schema.internalSales).toHaveProperty("dueDays");
    expect(schema.internalSales).toHaveProperty("dueDate");
    expect(schema.internalSales).toHaveProperty("confirmedAt");
    expect(schema.internalSales).toHaveProperty("reviewedBy");
    expect(schema.internalSales).toHaveProperty("reviewedAt");
    expect(schema.internalSales).toHaveProperty("rejectionReason");
  });

  it("internalSaleItems table should have v2 columns (unitSalePrice, totalSalePrice)", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.internalSaleItems).toHaveProperty("id");
    expect(schema.internalSaleItems).toHaveProperty("internalSaleId");
    expect(schema.internalSaleItems).toHaveProperty("sourceProductId");
    expect(schema.internalSaleItems).toHaveProperty("productName");
    expect(schema.internalSaleItems).toHaveProperty("quantity");
    expect(schema.internalSaleItems).toHaveProperty("unitCost");
    expect(schema.internalSaleItems).toHaveProperty("totalCost");
    // v2 additions
    expect(schema.internalSaleItems).toHaveProperty("unitSalePrice");
    expect(schema.internalSaleItems).toHaveProperty("totalSalePrice");
    expect(schema.internalSaleItems).toHaveProperty("targetProductId");
  });

  it("accountsPayable table should have internalSaleId column for financial integration", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.accountsPayable).toBeDefined();
    expect(schema.accountsPayable).toHaveProperty("internalSaleId");
    expect(schema.accountsPayable).toHaveProperty("amount");
    expect(schema.accountsPayable).toHaveProperty("dueDate");
    expect(schema.accountsPayable).toHaveProperty("status");
  });

  it("receivables table should have internalSaleId column for financial integration", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.receivables).toBeDefined();
    expect(schema.receivables).toHaveProperty("internalSaleId");
    expect(schema.receivables).toHaveProperty("totalAmount");
    expect(schema.receivables).toHaveProperty("receivedAmount");
    expect(schema.receivables).toHaveProperty("status");
  });

  it("productMapping table should have required columns for De/Para", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.productMapping).toHaveProperty("id");
    expect(schema.productMapping).toHaveProperty("sourceCompanyId");
    expect(schema.productMapping).toHaveProperty("targetCompanyId");
    expect(schema.productMapping).toHaveProperty("sourceProductId");
    expect(schema.productMapping).toHaveProperty("targetProductId");
  });
});
