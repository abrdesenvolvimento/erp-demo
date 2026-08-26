import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const scriptPath = path.resolve(__dirname, "../scripts/apply-exact-manual-stock-adjustments.mjs");
const scriptContent = fs.readFileSync(scriptPath, "utf-8");

describe("Baixa histórica de estoque a partir do Excel", () => {
  it("aceita somente correspondência única e exata do nome normalizado", () => {
    expect(scriptContent).toContain("const candidates = productsByName.get(normalize(entry.sourceName)) || []");
    expect(scriptContent).toContain("candidates.length !== 1");
    expect(scriptContent).toContain("reason: entry.quantity <= 0 ? \"missing_quantity\" : candidates.length === 0 ? \"not_exact_match\" : \"ambiguous_exact_name\"");
  });

  it("exige autorização explícita para permitir saldo negativo", () => {
    expect(scriptContent).toContain('const allowNegative = process.argv.includes("--allow-negative")');
    expect(scriptContent).toContain("stockWarnings.length > 0 && !allowNegative");
    expect(scriptContent).toContain("currentStock - entry.quantity < 0 && !allowNegative");
  });

  it("mantém a baixa idempotente e auditável por produto e data", () => {
    expect(scriptContent).toContain("HIST-EXCEL-${entry.adjustmentDate.replaceAll(\"-\", \"\")}-EXACT");
    expect(scriptContent).toContain("SELECT id FROM productMovements WHERE companyId = ? AND productId = ? AND documentNumber = ? LIMIT 1");
    expect(scriptContent).toContain("Baixa histórica pós-backup — Excel");
  });
});
