import mysql from "mysql2/promise";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { validateRestoreTarget, sanitizedRestoreError } from "../server/restoreExecution";

const checks = [
  { name: "saleItems sem venda correspondente", sql: "SELECT CAST(c.id AS CHAR) AS id FROM saleItems c LEFT JOIN sales p ON c.saleId=p.id WHERE c.saleId IS NOT NULL AND p.id IS NULL ORDER BY c.id" },
  { name: "vínculos iFood sem venda correspondente", sql: "SELECT CAST(c.id AS CHAR) AS id FROM ifoodImportedOrders c LEFT JOIN sales p ON c.saleId=p.id WHERE c.saleId IS NOT NULL AND p.id IS NULL ORDER BY c.id" },
  { name: "movimentos e produtos com empresas diferentes", sql: "SELECT CAST(c.id AS CHAR) AS id FROM productMovements c JOIN products p ON c.productId=p.id WHERE c.companyId IS NOT NULL AND p.companyId IS NOT NULL AND c.companyId<>p.companyId ORDER BY c.id" },
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("SOURCE_URL_MISSING");
  const target = validateRestoreTarget(process.env.RESTORE_DATABASE_URL, process.env.DATABASE_URL);
  const url = new URL(process.env.DATABASE_URL);
  const source = await mysql.createConnection({
    host: url.hostname, port: Number(url.port || 3306),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)), ssl: { rejectUnauthorized: true },
    dateStrings: true, multipleStatements: false, connectTimeout: 20_000,
  });
  const restored = await mysql.createConnection(target);
  try {
    const result = [];
    for (const check of checks) {
      const [originalRows] = await source.query<mysql.RowDataPacket[]>(check.sql);
      const [restoredRows] = await restored.query<mysql.RowDataPacket[]>(check.sql);
      const digest = (rows: mysql.RowDataPacket[]) => createHash("sha256").update(JSON.stringify(rows.map(row => String(row.id)).sort())).digest("hex");
      result.push({ check: check.name, restoredCount: restoredRows.length, currentSourceCount: originalRows.length, sameIdentifiers: digest(restoredRows) === digest(originalRows) });
    }
    const output = {
      checkedAt: new Date().toISOString(), runId: "backup-1793858873889-a322fe51",
      sourceAccess: "SELECT somente", destinationAccess: "SELECT somente",
      checks: result,
      note: "Igualdade de identificadores comprova que os mesmos casos estão presentes na fonte atual. Não determina a data ou causa original; nenhum registro foi corrigido.",
    };
    const path = "/home/ubuntu/abrwf-restore/backup-1793858873889-a322fe51/relation-baseline.json";
    await fs.writeFile(path, JSON.stringify(output, null, 2) + "\n", { mode: 0o600 });
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await restored.end();
    await source.end();
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(sanitizedRestoreError(error));
  process.exit(1);
});
