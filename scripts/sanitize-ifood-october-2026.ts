import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { normalizeIfoodOrderPricing, centsToNumber } from "../server/ifoodPricing";

const COMPANY_ID = 1;
const BRANCH_ID = 1;
const USER_ID = process.env.SANITIZATION_USER_ID || "3sp2FmLhkenyjqMFmfLoex";
const USER_NAME = "Saneamento iFood Outubro/2026";
const MONTH_START_UTC = "2026-10-01 03:00:00";
const MONTH_END_UTC = "2026-11-01 03:00:00";
const DOCUMENT_PREFIX = "SANEAMENTO-IFOOD-202610";
const ROOT = "/home/ubuntu";
const ORDERS_PATH = process.env.IFOOD_ORDERS_JSON || path.join(ROOT, "upload", "Vendas-Out.json");
const ITEMS_PATH = process.env.IFOOD_ITEMS_JSON || path.join(ROOT, "upload", "Itens-Out.json");
const OUTPUT_DIR = path.join(ROOT, "upload", "analise-ifood-outubro-2026");
const APPLY = process.argv.includes("--apply");
const ALLOW_NEGATIVE = process.argv.includes("--allow-negative");

const COMBO_OVERRIDES: Record<string, { productId: number; multiplier: number; name: string }> = {
  VP3752667205938: { productId: 9150001, multiplier: 6, name: "Combo 6 Heineken Ultimate 330ml" },
  VP9366898220104: { productId: 480001, multiplier: 8, name: "Combo 8 Cervejas Amstel Ultra 269ml" },
};

type SourceOrder = Record<string, any>;
type SourceItem = Record<string, any>;
type ExpectedItem = {
  sku: string;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sourceQuantity: number;
  priceMode: string;
};

function parseNdjson(filePath: string): any[] {
  const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
  if (!content) return [];
  return content.startsWith("[") ? JSON.parse(content) : content.split("\n").filter(Boolean).map(line => JSON.parse(line));
}

function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function normalizeSku(value: unknown): string {
  return String(value ?? "").trim();
}

function cents(value: unknown): number {
  const normalized = String(value ?? 0).replace(",", ".");
  const [whole = "0", fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}

function money(centsValue: number): number {
  return Number((centsValue / 100).toFixed(2));
}

function legacyQuantity(value: unknown): number {
  const quantity = Number.parseInt(String(value ?? ""), 10);
  return quantity > 0 ? quantity : 1;
}

function toBrazilDate(value: string): Date {
  const normalized = String(value).trim().replace(" ", "T");
  return new Date(/(?:Z|[+-]\d\d:?\d\d)$/.test(normalized) ? normalized : `${normalized}-03:00`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const orders = parseNdjson(ORDERS_PATH) as SourceOrder[];
const sourceItems = parseNdjson(ITEMS_PATH) as SourceItem[];
const octoberOrders = orders.filter(order =>
  order.status_pedido === "CONCLUDED" && String(order.data_de_finalizacao_do_pedido || "").startsWith("2026-10"),
);
const itemsByOrder = new Map<string, SourceItem[]>();
for (const item of sourceItems) {
  const existing = itemsByOrder.get(item.id_pedido_ifood) ?? [];
  existing.push(item);
  itemsByOrder.set(item.id_pedido_ifood, existing);
}

const sourceHashes = { orders: sha256(ORDERS_PATH), items: sha256(ITEMS_PATH) };
const databaseUrl = process.env.DATABASE_URL;
assert(databaseUrl, "DATABASE_URL não configurado");
const parsedUrl = new URL(databaseUrl);
const connection = await mysql.createConnection({
  host: parsedUrl.hostname,
  port: Number(parsedUrl.port || 3306),
  user: decodeURIComponent(parsedUrl.username),
  password: decodeURIComponent(parsedUrl.password),
  database: parsedUrl.pathname.slice(1),
  ssl: { rejectUnauthorized: true },
});

async function queryRows<T = any>(query: string, params: any[] = []): Promise<T[]> {
  const [rows] = await connection.query(query, params);
  return rows as T[];
}

function auditPayload(before: unknown, after: unknown, context: Record<string, unknown>) {
  return JSON.stringify({
    batch: DOCUMENT_PREFIX,
    sourceHashes,
    context,
    before,
    after,
  });
}

try {
  const allSkus = [...new Set(sourceItems.map(item => normalizeSku(item.sku)).filter(Boolean))];
  const mappingRows = allSkus.length > 0
    ? await queryRows<any>(`SELECT m.ifoodSku, m.ifoodProductName, m.productId, m.quantityMultiplier, p.name AS productName
        FROM ifoodProductMappings m
        LEFT JOIN products p ON p.id = m.productId
        WHERE m.ifoodSku IN (${allSkus.map(() => "?").join(",")})`, allSkus)
    : [];
  const mappings = new Map(mappingRows.map(row => [normalizeSku(row.ifoodSku), row]));

  for (const [sku, override] of Object.entries(COMBO_OVERRIDES)) {
    mappings.set(sku, {
      ifoodSku: sku,
      ifoodProductName: override.name,
      productId: override.productId,
      quantityMultiplier: override.multiplier,
      productName: null,
    });
  }

  const candidates = octoberOrders.map(order => {
    const orderItems = itemsByOrder.get(order.id_pedido_ifood) ?? [];
    const officialCents = cents(order.valor_total_dos_itens);
    const legacyCents = orderItems.reduce((sum, item) => sum + cents(item.valor) * legacyQuantity(item.quantidade), 0);
    return { order, orderItems, officialCents, legacyCents };
  }).filter(candidate => candidate.legacyCents !== candidate.officialCents);

  const plan: any[] = [];
  const validationErrors: string[] = [];

  for (const candidate of candidates) {
    const { order, orderItems, officialCents, legacyCents } = candidate;
    const orderId = String(order.id_pedido_ifood);
    const code = String(order.codigo_do_pedido_no_ifood || "").padStart(4, "0");
    const pricing = normalizeIfoodOrderPricing(
      orderItems.map(item => ({
        ...item,
        quantidadeMultiplicadora: mappings.get(normalizeSku(item.sku))?.quantityMultiplier ?? 1,
      })),
      order.valor_total_dos_itens,
    );

    if (!pricing.ok) {
      validationErrors.push(`Pedido #${code} (${orderId}): ${pricing.reason}`);
      continue;
    }

    const expectedItems: ExpectedItem[] = [];
    for (const normalized of pricing.items) {
      const sourceItem = orderItems[normalized.sourceIndex];
      const sku = normalizeSku(sourceItem.sku);
      const mapping = mappings.get(sku);
      if (!mapping?.productId) {
        validationErrors.push(`Pedido #${code} (${orderId}): SKU ${sku || "sem SKU"} não possui produto ABRWF mapeado.`);
        continue;
      }
      const [product] = await queryRows<any>("SELECT id, name FROM products WHERE id = ? AND companyId = ? LIMIT 1", [mapping.productId, COMPANY_ID]);
      if (!product) {
        validationErrors.push(`Pedido #${code} (${orderId}): produto mapeado ${mapping.productId} não pertence à Adega.`);
        continue;
      }
      expectedItems.push({
        sku,
        productId: Number(mapping.productId),
        productName: product.name,
        quantity: normalized.quantity,
        unitPrice: centsToNumber(normalized.unitPriceCents),
        totalPrice: centsToNumber(normalized.lineTotalCents),
        sourceQuantity: normalized.sourceQuantity,
        priceMode: normalized.priceMode,
      });
    }

    const expectedCents = expectedItems.reduce((sum, item) => sum + cents(item.totalPrice), 0);
    if (expectedCents !== officialCents) {
      validationErrors.push(`Pedido #${code} (${orderId}): itens normalizados R$ ${money(expectedCents)} não fecham o total oficial R$ ${money(officialCents)}.`);
      continue;
    }

    const importedLinks = await queryRows<any>("SELECT * FROM ifoodImportedOrders WHERE ifoodOrderId = ? FOR UPDATE", [orderId]);
    if (importedLinks.length > 1) {
      validationErrors.push(`Pedido #${code} (${orderId}): há mais de um vínculo de idempotência no banco.`);
      continue;
    }

    const sales = await queryRows<any>(`
      SELECT s.* FROM sales s
      WHERE s.companyId = ? AND s.branchId = ? AND s.saleType = 'DELIVERY'
        AND s.platformOrderId = ? AND s.saleDate >= ? AND s.saleDate < ?
      ORDER BY s.id ASC
      FOR UPDATE`, [COMPANY_ID, BRANCH_ID, code, MONTH_START_UTC, MONTH_END_UTC]);
    const activeSales = sales.filter(sale => sale.status === "ACTIVE");
    const linkedSaleId = importedLinks[0]?.saleId ? Number(importedLinks[0].saleId) : null;
    const canonical = (linkedSaleId
      ? activeSales.find(sale => Number(sale.id) === linkedSaleId)
      : undefined) ?? activeSales[0];
    const duplicates = canonical ? activeSales.filter(sale => Number(sale.id) !== Number(canonical.id)) : [];
    const relevantSaleIds = [canonical?.id, ...duplicates.map(sale => sale.id)].filter(Boolean).map(Number);
    const financialArtifacts = relevantSaleIds.length > 0
      ? await queryRows<any>(`
          SELECT s.id AS saleId,
                 (SELECT COUNT(*) FROM revenueEntries re WHERE re.saleId = s.id) AS revenueEntries,
                 (SELECT COUNT(*) FROM journalSources js WHERE js.sourceType = 'sale' AND js.sourceId = s.id) AS journalSources,
                 (SELECT COUNT(*) FROM journalSources js JOIN journals j ON j.id = js.journalId WHERE js.sourceType = 'sale' AND js.sourceId = s.id AND j.status = 'POSTED') AS postedJournals
            FROM sales s WHERE s.id IN (${relevantSaleIds.map(() => "?").join(",")})`, relevantSaleIds)
      : [];
    if (financialArtifacts.some(row => Number(row.revenueEntries) > 0 || Number(row.journalSources) > 0 || Number(row.postedJournals) > 0)) {
      validationErrors.push(`Pedido #${code} (${orderId}): possui lançamento de receita ou diário contábil relacionado; o lote foi bloqueado para exigir estorno contábil formal.`);
      continue;
    }

    const currentItems = canonical
      ? await queryRows<any>("SELECT * FROM saleItems WHERE saleId = ? ORDER BY id FOR UPDATE", [canonical.id])
      : [];
    const oldByProduct = new Map<number, number>();
    const newByProduct = new Map<number, number>();
    for (const item of currentItems) oldByProduct.set(Number(item.productId), (oldByProduct.get(Number(item.productId)) ?? 0) + Number(item.quantity));
    for (const item of expectedItems) newByProduct.set(item.productId, (newByProduct.get(item.productId) ?? 0) + item.quantity);

    const stockDeltas = [...new Set([...oldByProduct.keys(), ...newByProduct.keys()])]
      .map(productId => ({ productId, quantity: (oldByProduct.get(productId) ?? 0) - (newByProduct.get(productId) ?? 0) }))
      .filter(delta => delta.quantity !== 0);

    plan.push({
      ifoodOrderId: orderId,
      ifoodOrderCode: code,
      saleDate: order.data_de_finalizacao_do_pedido,
      officialTotal: money(officialCents),
      legacyTotal: money(legacyCents),
      expectedItems,
      canonicalSaleId: canonical ? Number(canonical.id) : null,
      canonicalBefore: canonical ? { subtotal: Number(canonical.subtotal), finalAmount: Number(canonical.finalAmount), items: currentItems } : null,
      duplicates: duplicates.map(sale => ({ id: Number(sale.id), subtotal: Number(sale.subtotal), finalAmount: Number(sale.finalAmount) })),
      financialArtifacts,
      stockDeltas,
      linkId: importedLinks[0]?.id ? Number(importedLinks[0].id) : null,
    });
  }

  const report = {
    batch: DOCUMENT_PREFIX,
    mode: APPLY ? "apply" : "dry_run",
    sourceFiles: { ordersPath: ORDERS_PATH, itemsPath: ITEMS_PATH, hashes: sourceHashes },
    summary: {
      ordersConcludedOctober: octoberOrders.length,
      candidates: candidates.length,
      planned: plan.length,
      validationErrors: validationErrors.length,
      sourceLegacyTotal: money(plan.reduce((sum, entry) => sum + cents(entry.legacyTotal), 0)),
      sourceOfficialTotal: money(plan.reduce((sum, entry) => sum + cents(entry.officialTotal), 0)),
      sourceExcess: money(plan.reduce((sum, entry) => sum + cents(entry.legacyTotal) - cents(entry.officialTotal), 0)),
      existingCanonicalSales: plan.filter(entry => entry.canonicalSaleId).length,
      missingSalesToCreate: plan.filter(entry => !entry.canonicalSaleId).length,
      duplicateSalesToCancel: plan.reduce((sum, entry) => sum + entry.duplicates.length, 0),
      stockAdjustments: plan.reduce((sum, entry) => sum + entry.stockDeltas.length, 0),
    },
    validationErrors,
    plan,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `saneamento-ifood-outubro-2026-${APPLY ? "aplicado" : "dry-run"}.json`);

  if (!APPLY) {
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ outputPath, ...report.summary }, null, 2));
    if (validationErrors.length) process.exitCode = 2;
  } else {
    assert(validationErrors.length === 0, `Lote bloqueado por ${validationErrors.length} erro(s) de validação.`);
    await connection.beginTransaction();
    try {
      const [alreadyApplied] = await queryRows<any>("SELECT id FROM auditLog WHERE entityType = 'SANEAMENTO_IFOOD_202610' AND entityName = ? LIMIT 1 FOR UPDATE", [DOCUMENT_PREFIX]);
      if (alreadyApplied) throw new Error("Este lote de saneamento já foi aplicado. A operação é idempotente e foi bloqueada.");

      // Corrigir os dois vínculos de combo comprovados no catálogo iFood.
      for (const [sku, override] of Object.entries(COMBO_OVERRIDES)) {
        const [mapping] = await queryRows<any>("SELECT id FROM ifoodProductMappings WHERE ifoodSku = ? FOR UPDATE", [sku]);
        if (mapping) {
          await connection.query("UPDATE ifoodProductMappings SET productId = ?, ifoodProductName = ?, quantityMultiplier = ?, situation = ?, updatedBy = ? WHERE id = ?", [override.productId, override.name, override.multiplier, "Combo iFood normalizado", USER_ID, mapping.id]);
        } else {
          await connection.query("INSERT INTO ifoodProductMappings (ifoodSku, ifoodProductName, productId, quantityMultiplier, situation, active, companyId, branchId, createdBy, updatedBy) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)", [sku, override.name, override.productId, override.multiplier, "Combo iFood normalizado", COMPANY_ID, BRANCH_ID, USER_ID, USER_ID]);
        }
      }

      let createdSales = 0;
      let correctedSales = 0;
      let cancelledDuplicates = 0;
      let stockCorrections = 0;

      for (const entry of plan) {
        let saleId = entry.canonicalSaleId as number | null;
        const documentNumber = `${DOCUMENT_PREFIX}-${entry.ifoodOrderCode}-${saleId ?? "NOVO"}`;

        if (saleId) {
          await connection.query("DELETE FROM saleItems WHERE saleId = ?", [saleId]);
          for (const item of entry.expectedItems as ExpectedItem[]) {
            await connection.query("INSERT INTO saleItems (saleId, productId, quantity, unitPrice, totalPrice, companyId, branchId) VALUES (?, ?, ?, ?, ?, ?, ?)", [saleId, item.productId, item.quantity, item.unitPrice.toFixed(2), item.totalPrice.toFixed(2), COMPANY_ID, BRANCH_ID]);
          }
          await connection.query("UPDATE sales SET subtotal = ?, finalAmount = ?, notes = CONCAT(COALESCE(notes, ''), ?) WHERE id = ?", [Number(entry.officialTotal).toFixed(2), Number(entry.officialTotal).toFixed(2), ` | ${DOCUMENT_PREFIX}: valor corrigido pelo UUID ${entry.ifoodOrderId}`, saleId]);
          correctedSales += 1;
        } else {
          const sourceOrder = octoberOrders.find(order => String(order.id_pedido_ifood) === entry.ifoodOrderId)!;
          const [insert] = await connection.query<any>("INSERT INTO sales (companyId, branchId, saleType, saleDate, channelId, platformOrderId, subtotal, discountAmount, surchargeAmount, finalAmount, paymentMethod, notes, status, createdBy, isImported, importSource) VALUES (?, ?, 'DELIVERY', ?, 2, ?, ?, '0.00', '0.00', ?, 'Pago na Plataforma', ?, 'ACTIVE', ?, 1, 'IFOOD')", [COMPANY_ID, BRANCH_ID, toBrazilDate(sourceOrder.data_de_finalizacao_do_pedido), entry.ifoodOrderCode, Number(entry.officialTotal).toFixed(2), Number(entry.officialTotal).toFixed(2), `Importado iFood — saneamento histórico ${DOCUMENT_PREFIX} — UUID ${entry.ifoodOrderId}`, USER_ID]);
          saleId = Number((insert as any).insertId);
          for (const item of entry.expectedItems as ExpectedItem[]) {
            await connection.query("INSERT INTO saleItems (saleId, productId, quantity, unitPrice, totalPrice, companyId, branchId) VALUES (?, ?, ?, ?, ?, ?, ?)", [saleId, item.productId, item.quantity, item.unitPrice.toFixed(2), item.totalPrice.toFixed(2), COMPANY_ID, BRANCH_ID]);
          }
          entry.stockDeltas = (entry.expectedItems as ExpectedItem[]).map(item => ({ productId: item.productId, quantity: -item.quantity }));
          createdSales += 1;
        }

        for (const delta of entry.stockDeltas as Array<{ productId: number; quantity: number }>) {
          if (delta.quantity === 0) continue;
          const [product] = await queryRows<any>("SELECT id, name, currentStock FROM products WHERE id = ? AND companyId = ? FOR UPDATE", [delta.productId, COMPANY_ID]);
          assert(product, `Produto ${delta.productId} não encontrado durante ajuste de estoque.`);
          const projectedStock = Number(product.currentStock) + delta.quantity;
          if (projectedStock < 0 && !ALLOW_NEGATIVE) {
            throw new Error(`Saneamento bloqueado: ${product.name} ficaria negativo (${projectedStock}). Execute somente com autorização explícita --allow-negative.`);
          }
          await connection.query("UPDATE products SET currentStock = ? WHERE id = ? AND companyId = ?", [projectedStock, delta.productId, COMPANY_ID]);
          await connection.query("INSERT INTO productMovements (companyId, branchId, productId, date, type, quantity, documentNumber, userId, notes) VALUES (?, ?, ?, NOW(), 'ACERTO', ?, ?, ?, ?)", [COMPANY_ID, BRANCH_ID, delta.productId, String(delta.quantity), `${DOCUMENT_PREFIX}-${saleId}`, USER_ID, `Saneamento iFood outubro/2026; UUID ${entry.ifoodOrderId}; ajuste de quantidade contra itens originais.`]);
          stockCorrections += 1;
        }

        for (const duplicate of entry.duplicates as Array<{ id: number }>) {
          const duplicateItems = await queryRows<any>("SELECT * FROM saleItems WHERE saleId = ? FOR UPDATE", [duplicate.id]);
          for (const item of duplicateItems) {
            const [product] = await queryRows<any>("SELECT id, currentStock FROM products WHERE id = ? AND companyId = ? FOR UPDATE", [item.productId, COMPANY_ID]);
            assert(product, `Produto ${item.productId} da venda duplicada ${duplicate.id} não encontrado.`);
            await connection.query("UPDATE products SET currentStock = ? WHERE id = ? AND companyId = ?", [Number(product.currentStock) + Number(item.quantity), item.productId, COMPANY_ID]);
            await connection.query("INSERT INTO productMovements (companyId, branchId, productId, date, type, quantity, documentNumber, userId, notes) VALUES (?, ?, ?, NOW(), 'ESTORNO', ?, ?, ?, ?)", [COMPANY_ID, BRANCH_ID, item.productId, String(item.quantity), `${DOCUMENT_PREFIX}-DUP-${duplicate.id}`, USER_ID, `Estorno de venda duplicada do pedido iFood #${entry.ifoodOrderCode}; UUID ${entry.ifoodOrderId}.`]);
          }
          await connection.query("UPDATE sales SET status = 'CANCELLED', cancelledAt = NOW(), cancelledBy = ?, cancellationReason = ? WHERE id = ?", [USER_ID, `Duplicidade histórica iFood — saneamento ${DOCUMENT_PREFIX}; UUID ${entry.ifoodOrderId}.`, duplicate.id]);
          await connection.query("INSERT INTO auditLog (companyId, branchId, entityType, entityId, entityName, action, changes, userId, userName) VALUES (?, ?, 'VENDA_IFOOD_SANEAMENTO', ?, ?, 'EDICAO', ?, ?, ?)", [COMPANY_ID, BRANCH_ID, duplicate.id, `Pedido #${entry.ifoodOrderCode} — venda duplicada`, auditPayload({ status: "ACTIVE", ...duplicate }, { status: "CANCELLED" }, { ifoodOrderId: entry.ifoodOrderId, reason: "duplicidade" }), USER_ID, USER_NAME]);
          cancelledDuplicates += 1;
        }

        const [link] = await queryRows<any>("SELECT id FROM ifoodImportedOrders WHERE ifoodOrderId = ? FOR UPDATE", [entry.ifoodOrderId]);
        if (link) {
          await connection.query("UPDATE ifoodImportedOrders SET saleId = ?, ifoodOrderCode = ?, orderDate = ?, orderValue = ?, companyId = ?, branchId = ? WHERE id = ?", [saleId, entry.ifoodOrderCode, toBrazilDate(entry.saleDate), Number(entry.officialTotal).toFixed(2), COMPANY_ID, BRANCH_ID, link.id]);
        } else {
          await connection.query("INSERT INTO ifoodImportedOrders (ifoodOrderId, ifoodOrderCode, saleId, orderDate, orderValue, companyId, branchId) VALUES (?, ?, ?, ?, ?, ?, ?)", [entry.ifoodOrderId, entry.ifoodOrderCode, saleId, toBrazilDate(entry.saleDate), Number(entry.officialTotal).toFixed(2), COMPANY_ID, BRANCH_ID]);
        }

        await connection.query("INSERT INTO auditLog (companyId, branchId, entityType, entityId, entityName, action, changes, userId, userName) VALUES (?, ?, 'VENDA_IFOOD_SANEAMENTO', ?, ?, 'EDICAO', ?, ?, ?)", [COMPANY_ID, BRANCH_ID, saleId, `Pedido #${entry.ifoodOrderCode}`, auditPayload(entry.canonicalBefore, { officialTotal: entry.officialTotal, items: entry.expectedItems }, { ifoodOrderId: entry.ifoodOrderId, created: !entry.canonicalSaleId }), USER_ID, USER_NAME]);
      }

      await connection.query("INSERT INTO auditLog (companyId, branchId, entityType, entityId, entityName, action, changes, userId, userName) VALUES (?, ?, 'SANEAMENTO_IFOOD_202610', 202610, ?, 'CRIACAO', ?, ?, ?)", [COMPANY_ID, BRANCH_ID, DOCUMENT_PREFIX, auditPayload(null, report.summary, { planOrders: plan.length }), USER_ID, USER_NAME]);
      await connection.commit();
      Object.assign(report, { applied: { createdSales, correctedSales, cancelledDuplicates, stockCorrections } });
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ outputPath, ...report.summary, applied: report.applied }, null, 2));
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
} finally {
  await connection.end();
}
