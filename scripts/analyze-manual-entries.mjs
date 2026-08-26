import XLSX from "xlsx";
import fs from "fs";

const inputPath = "/home/ubuntu/upload/Lançamentomanuais.xlsx";
const outputPath = "/tmp/manual-entries-summary.json";
const workbook = XLSX.readFile(inputPath, { cellDates: true });

function toNumber(value) {
  if (typeof value === "number") return value;
  if (value == null || value === "") return 0;
  return Number(String(value).replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

function normalize(value) {
  return String(value ?? "").trim();
}

const summary = { sheets: [], consolidated: [], exceptions: [] };
const products = new Map();

for (const sheetName of workbook.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: true });
  const sheet = {
    sheet: sheetName,
    rows: rows.length,
    validRevenueRows: 0,
    quantityRows: 0,
    grossRevenue: 0,
    quantity: 0,
    zeroValueRows: 0,
    missingCodeRows: 0,
    unresolvedCodeRows: 0,
    exceptions: [],
  };

  for (const [offset, row] of rows.entries()) {
    const code = normalize(row["Código"]);
    const product = normalize(row["Produto"]);
    const quantity = toNumber(row["Quantidade"]);
    const unitPrice = toNumber(row["Valor unitário"]);
    const total = toNumber(row["Total"]);
    const record = { sheet: sheetName, row: offset + 2, code, product, quantity, unitPrice, total, note: normalize(row["Observação"]) };

    if (quantity > 0) {
      sheet.quantityRows += 1;
      sheet.quantity += quantity;
    }
    if (total > 0) {
      sheet.validRevenueRows += 1;
      sheet.grossRevenue += total;
    } else {
      sheet.zeroValueRows += 1;
    }
    if (!code) {
      sheet.missingCodeRows += 1;
      sheet.exceptions.push({ ...record, issue: "missing_code" });
    }
    if (product.toUpperCase().includes("CÓDIGO NÃO ENCONTRADO")) {
      sheet.unresolvedCodeRows += 1;
      sheet.exceptions.push({ ...record, issue: "unresolved_code" });
    }
    if (quantity <= 0 || total <= 0) {
      sheet.exceptions.push({ ...record, issue: quantity <= 0 ? "missing_quantity" : "zero_total" });
    }

    if (code && quantity > 0) {
      const existing = products.get(code) || { code, product, quantity: 0, total: 0, rows: 0, sheets: new Set() };
      existing.quantity += quantity;
      existing.total += total;
      existing.rows += 1;
      existing.sheets.add(sheetName);
      products.set(code, existing);
    }
  }
  summary.sheets.push(sheet);
  summary.exceptions.push(...sheet.exceptions);
}

summary.consolidated = [...products.values()]
  .map((item) => ({ ...item, sheets: [...item.sheets], averageUnitPrice: item.quantity ? Number((item.total / item.quantity).toFixed(2)) : 0 }))
  .sort((a, b) => a.code.localeCompare(b.code));

summary.totals = summary.sheets.reduce((acc, sheet) => ({
  rows: acc.rows + sheet.rows,
  quantity: acc.quantity + sheet.quantity,
  grossRevenue: Number((acc.grossRevenue + sheet.grossRevenue).toFixed(2)),
  validRevenueRows: acc.validRevenueRows + sheet.validRevenueRows,
  zeroValueRows: acc.zeroValueRows + sheet.zeroValueRows,
  missingCodeRows: acc.missingCodeRows + sheet.missingCodeRows,
  unresolvedCodeRows: acc.unresolvedCodeRows + sheet.unresolvedCodeRows,
}), { rows: 0, quantity: 0, grossRevenue: 0, validRevenueRows: 0, zeroValueRows: 0, missingCodeRows: 0, unresolvedCodeRows: 0 });

fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ outputPath, totals: summary.totals, sheets: summary.sheets.map(({ exceptions, ...sheet }) => sheet), uniqueCodes: summary.consolidated.length }, null, 2));
