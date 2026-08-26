import XLSX from "xlsx";
import mysql from "mysql2/promise";
import fs from "fs";

const inputPath = "/home/ubuntu/upload/Lançamentomanuais.xlsx";
const outputPath = "/tmp/exact-manual-stock-adjustments.json";
const companyId = 1;
const userId = "3sp2FmLhkenyjqMFmfLoex";
const apply = process.argv.includes("--apply");
const allowNegative = process.argv.includes("--allow-negative");

function toNumber(value) {
  if (typeof value === "number") return value;
  if (value == null || value === "") return 0;
  return Number(String(value).replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sheetToDate(sheetName) {
  const [day, month] = sheetName.split("-");
  if (!day || !month) throw new Error(`Aba inválida: ${sheetName}`);
  return `2026-${month}-${day}`;
}

const workbook = XLSX.readFile(inputPath, { cellDates: true });
const rawEntries = [];
for (const sheetName of workbook.SheetNames) {
  const adjustmentDate = sheetToDate(sheetName);
  for (const [index, row] of XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: true }).entries()) {
    rawEntries.push({
      adjustmentDate,
      sourceSheet: sheetName,
      sourceRow: index + 2,
      code: String(row["Código"] ?? "").trim(),
      sourceName: String(row["Produto"] ?? "").trim(),
      quantity: toNumber(row["Quantidade"]),
      total: toNumber(row["Total"]),
    });
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não configurado");
const parsed = new URL(databaseUrl);
const connection = await mysql.createConnection({
  host: parsed.hostname,
  port: Number(parsed.port || 3306),
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: parsed.pathname.slice(1),
  ssl: { rejectUnauthorized: true },
});

try {
  const [products] = await connection.query(
    "SELECT id, companyId, branchId, name, currentStock FROM products WHERE companyId = ? AND active = 1",
    [companyId]
  );
  const productsByName = new Map();
  for (const product of products) {
    const key = normalize(product.name);
    const values = productsByName.get(key) || [];
    values.push(product);
    productsByName.set(key, values);
  }

  const plannedByProductDate = new Map();
  const skipped = [];
  for (const entry of rawEntries) {
    const candidates = productsByName.get(normalize(entry.sourceName)) || [];
    if (!entry.quantity || candidates.length !== 1) {
      skipped.push({ ...entry, reason: entry.quantity <= 0 ? "missing_quantity" : candidates.length === 0 ? "not_exact_match" : "ambiguous_exact_name" });
      continue;
    }
    const product = candidates[0];
    const key = `${entry.adjustmentDate}:${product.id}`;
    const target = plannedByProductDate.get(key) || {
      adjustmentDate: entry.adjustmentDate,
      productId: product.id,
      productName: product.name,
      branchId: product.branchId,
      quantity: 0,
      revenue: 0,
      sourceRows: [],
      currentStock: Number(product.currentStock),
    };
    target.quantity += entry.quantity;
    target.revenue += entry.total;
    target.sourceRows.push({ sheet: entry.sourceSheet, row: entry.sourceRow, code: entry.code });
    plannedByProductDate.set(key, target);
  }

  const entries = [...plannedByProductDate.values()].sort((a, b) => a.adjustmentDate.localeCompare(b.adjustmentDate) || a.productName.localeCompare(b.productName));
  const totalByProduct = new Map();
  for (const entry of entries) totalByProduct.set(entry.productId, (totalByProduct.get(entry.productId) || 0) + entry.quantity);
  const stockWarnings = entries
    .filter((entry) => entry.currentStock - totalByProduct.get(entry.productId) < 0)
    .map((entry) => ({
      productId: entry.productId,
      productName: entry.productName,
      currentStock: entry.currentStock,
      plannedQuantity: totalByProduct.get(entry.productId),
      projectedStock: entry.currentStock - totalByProduct.get(entry.productId),
    }))
    .filter((warning, index, all) => all.findIndex((item) => item.productId === warning.productId) === index);

  const result = {
    mode: apply ? "apply" : "dry_run",
    allowNegative,
    companyId,
    documentPrefix: "HIST-EXCEL-202608",
    summary: {
      rawRows: rawEntries.length,
      movementEntries: entries.length,
      exactQuantity: entries.reduce((sum, item) => sum + item.quantity, 0),
      exactRevenue: Number(entries.reduce((sum, item) => sum + item.revenue, 0).toFixed(2)),
      skippedRows: skipped.length,
      skippedQuantity: skipped.reduce((sum, item) => sum + item.quantity, 0),
      skippedRevenue: Number(skipped.reduce((sum, item) => sum + item.total, 0).toFixed(2)),
      stockWarnings: stockWarnings.length,
    },
    stockWarnings,
    entries,
    skipped,
  };

  if (apply) {
    if (stockWarnings.length > 0 && !allowNegative) throw new Error(`Baixa bloqueada: ${stockWarnings.length} produto(s) ficariam com estoque negativo`);
    await connection.beginTransaction();
    try {
      let inserted = 0;
      let alreadyApplied = 0;
      for (const entry of entries) {
        const documentNumber = `HIST-EXCEL-${entry.adjustmentDate.replaceAll("-", "")}-EXACT`;
        const [existing] = await connection.query(
          "SELECT id FROM productMovements WHERE companyId = ? AND productId = ? AND documentNumber = ? LIMIT 1",
          [companyId, entry.productId, documentNumber]
        );
        if (existing.length > 0) {
          alreadyApplied += 1;
          continue;
        }
        const [productRows] = await connection.query(
          "SELECT currentStock FROM products WHERE id = ? AND companyId = ? FOR UPDATE",
          [entry.productId, companyId]
        );
        if (productRows.length !== 1) throw new Error(`Produto ${entry.productId} não encontrado na Adega`);
        const currentStock = Number(productRows[0].currentStock);
        if (currentStock - entry.quantity < 0 && !allowNegative) throw new Error(`Baixa bloqueada para ${entry.productName}: saldo atual insuficiente`);

        await connection.query(
          "INSERT INTO productMovements (companyId, branchId, productId, date, type, quantity, documentNumber, userId, notes) VALUES (?, ?, ?, ?, 'ACERTO', ?, ?, ?, ?)",
          [companyId, entry.branchId, entry.productId, `${entry.adjustmentDate} 03:00:00`, (-entry.quantity).toString(), documentNumber, userId, `Baixa histórica pós-backup — Excel ${entry.sourceRows.map((row) => `${row.sheet}:L${row.row}`).join(", ")}${currentStock - entry.quantity < 0 ? "; saldo negativo autorizado pelo gestor" : ""}`]
        );
        await connection.query(
          "UPDATE products SET currentStock = currentStock - ? WHERE id = ? AND companyId = ?",
          [entry.quantity, entry.productId, companyId]
        );
        inserted += 1;
      }
      await connection.commit();
      result.applied = { inserted, alreadyApplied };
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ outputPath, mode: result.mode, summary: result.summary, applied: result.applied ?? null }, null, 2));
} finally {
  await connection.end();
}
