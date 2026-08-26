import XLSX from "xlsx";
import mysql from "mysql2/promise";
import fs from "fs";

const inputPath = "/home/ubuntu/upload/Lançamentomanuais.xlsx";
const outputPath = "/tmp/manual-stock-reconciliation.json";
const companyId = 1;

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

function scoreName(source, target) {
  const sourceTokens = new Set(normalize(source).split(" ").filter(Boolean));
  const targetTokens = new Set(normalize(target).split(" ").filter(Boolean));
  if (!sourceTokens.size || !targetTokens.size) return 0;
  let intersection = 0;
  for (const token of sourceTokens) if (targetTokens.has(token)) intersection += 1;
  return intersection / new Set([...sourceTokens, ...targetTokens]).size;
}

const workbook = XLSX.readFile(inputPath, { cellDates: true });
const manualProducts = new Map();
for (const sheetName of workbook.SheetNames) {
  for (const row of XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: true })) {
    const code = String(row["Código"] ?? "").trim();
    const productName = String(row["Produto"] ?? "").trim();
    const quantity = toNumber(row["Quantidade"]);
    const total = toNumber(row["Total"]);
    if (!code || quantity <= 0) continue;
    const item = manualProducts.get(code) || { code, sourceName: productName, quantity: 0, revenue: 0, sheets: new Set() };
    item.quantity += quantity;
    item.revenue += total;
    item.sheets.add(sheetName);
    manualProducts.set(code, item);
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
    "SELECT id, name, ean, uom, currentStock, active FROM products WHERE companyId = ? AND active = 1",
    [companyId]
  );
  const [movements] = await connection.query(
    "SELECT productId, COUNT(*) AS movementCount, SUM(quantity) AS movementQuantity FROM productMovements WHERE companyId = ? AND date >= '2026-08-22 00:00:00' AND date < '2026-08-24 00:00:00' GROUP BY productId",
    [companyId]
  );
  const movementByProduct = new Map(movements.map((item) => [item.productId, item]));

  const matches = [];
  for (const source of manualProducts.values()) {
    const exact = products.filter((product) => normalize(product.name) === normalize(source.sourceName));
    const candidates = products
      .map((product) => ({ product, score: scoreName(source.sourceName, product.name) }))
      .filter((item) => item.score >= 0.5)
      .sort((a, b) => b.score - a.score);
    const selected = exact.length === 1 ? { product: exact[0], score: 1, matchType: "exact" } : candidates[0] ? { ...candidates[0], matchType: candidates[0].score >= 0.85 && (candidates[1]?.score ?? 0) < candidates[0].score ? "high_confidence" : "review" } : null;
    const movement = selected ? movementByProduct.get(selected.product.id) : null;

    matches.push({
      code: source.code,
      sourceName: source.sourceName,
      quantity: source.quantity,
      revenue: Number(source.revenue.toFixed(2)),
      sheets: [...source.sheets],
      matchType: selected?.matchType ?? "unmatched",
      confidence: selected?.score ?? 0,
      product: selected ? {
        id: selected.product.id,
        name: selected.product.name,
        ean: selected.product.ean,
        uom: selected.product.uom,
        currentStock: Number(selected.product.currentStock),
        existingMovementCount: Number(movement?.movementCount ?? 0),
        existingMovementQuantity: Number(movement?.movementQuantity ?? 0),
      } : null,
      alternatives: candidates.slice(0, 3).map((candidate) => ({ id: candidate.product.id, name: candidate.product.name, score: Number(candidate.score.toFixed(3)) })),
    });
  }

  const result = {
    generatedAt: new Date().toISOString(),
    companyId,
    totals: {
      sourceProducts: matches.length,
      sourceQuantity: matches.reduce((sum, item) => sum + item.quantity, 0),
      sourceRevenue: Number(matches.reduce((sum, item) => sum + item.revenue, 0).toFixed(2)),
      exact: matches.filter((item) => item.matchType === "exact").length,
      highConfidence: matches.filter((item) => item.matchType === "high_confidence").length,
      review: matches.filter((item) => item.matchType === "review").length,
      unmatched: matches.filter((item) => item.matchType === "unmatched").length,
      withExistingMovements: matches.filter((item) => item.product?.existingMovementCount).length,
    },
    matches: matches.sort((a, b) => a.sourceName.localeCompare(b.sourceName)),
  };
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ outputPath, totals: result.totals }, null, 2));
} finally {
  await connection.end();
}
