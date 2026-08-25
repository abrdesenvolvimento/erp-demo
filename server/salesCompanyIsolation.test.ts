import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const dbPath = path.resolve(__dirname, "db.ts");
const routerPath = path.resolve(__dirname, "routers.ts");
const dbContent = fs.readFileSync(dbPath, "utf-8");
const routerContent = fs.readFileSync(routerPath, "utf-8");

describe("Isolamento empresarial das vendas", () => {
  it("exige empresa ativa antes de listar, consultar indicadores, exportar ou movimentar vendas", () => {
    expect(routerContent).toContain("function requireActiveCompanyId");
    expect(routerContent).toContain("Selecione uma empresa antes de consultar ou movimentar vendas.");

    const salesRouter = routerContent.slice(
      routerContent.indexOf("// ==================== VENDAS ===================="),
      routerContent.indexOf("// ==================== CONTAS A RECEBER ====================")
    );
    expect(salesRouter).toContain("const companyId = requireActiveCompanyId(ctx.activeCompanyId);");
  });

  it("filtra listagem e indicadores obrigatoriamente pelo companyId", () => {
    expect(dbContent).toContain("companyId: number }) {");
    expect(dbContent).toContain("companyId válido é obrigatório para consultar vendas");
    expect(dbContent).toContain("companyId válido é obrigatório para consultar indicadores de vendas");

    const listSection = dbContent.slice(
      dbContent.indexOf("export async function getSales("),
      dbContent.indexOf("export async function getSale(")
    );
    expect(listSection).toContain("whereConditions += ` AND companyId = ${filters.companyId}`");

    const statsSection = dbContent.slice(
      dbContent.indexOf("export async function getSalesStats(")
    );
    expect(statsSection).toContain("whereConditions += ` AND companyId = ${companyId}`");
  });

  it("não permite abrir por ID uma venda pertencente a outra empresa", () => {
    expect(routerContent).toContain("db.getSale(input.id, companyId)");
    expect(dbContent).toContain("AND s.companyId = ${companyId}");
  });
});
