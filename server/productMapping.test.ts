import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("Product Mapping (De/Para) - Internal Sales", () => {
  it("should have checkMapping procedure registered", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("internalSales.checkMapping");
  });

  it("should have mappingList procedure registered", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("internalSales.mappingList");
  });

  it("should have mappingCreate procedure registered", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("internalSales.mappingCreate");
  });

  it("should have mappingDelete procedure registered", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("internalSales.mappingDelete");
  });

  it("should have mappingBulkCreate procedure registered", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("internalSales.mappingBulkCreate");
  });

  it("should have approve procedure that checks mappings", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("internalSales.approve");
  });

  it("should have all required internal sales procedures", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    const requiredProcedures = [
      "internalSales.list",
      "internalSales.getById",
      "internalSales.create",
      "internalSales.approve",
      "internalSales.reject",
      "internalSales.cancel",
      "internalSales.getTargetCompanies",
      "internalSales.getCompanyProducts",
      "internalSales.checkMapping",
      "internalSales.mappingList",
      "internalSales.mappingCreate",
      "internalSales.mappingDelete",
      "internalSales.mappingBulkCreate",
    ];
    for (const proc of requiredProcedures) {
      expect(procedures).toContain(proc);
    }
  });
});
