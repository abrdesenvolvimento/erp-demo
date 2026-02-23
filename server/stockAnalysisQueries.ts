/**
 * Queries para o módulo de Análise de Estoque
 * Inclui: resumo por categoria, detalhe por produto, giro, dias de estoque, variação de custo
 */

import { sql } from "drizzle-orm";
import { getDb } from "./db";

// ==================== INTERFACES ====================

export interface StockAnalysisCategorySummary {
  categoryId: number;
  categoryName: string;
  stockValue: number;       // Valor em estoque atual
  stockPercentage: number;  // % do total
  productCount: number;     // Qtd de produtos com estoque
  cmv: number;              // CMV do período
  avgStock: number;         // Estoque médio (inicial + final) / 2
  turnover: number;         // Giro = CMV / Estoque Médio
  daysOfStock: number;      // Dias de estoque = Estoque Final / (CMV / dias do período)
  costVariation: number;    // Variação de custo médio vs período anterior (%)
}

export interface StockAnalysisProduct {
  productId: number;
  productName: string;
  categoryId: number;
  categoryName: string;
  subcategory: string | null; // Subcategoria do produto
  currentStock: number;       // Qtd em estoque
  avgCost: number;            // Custo médio atual
  stockValue: number;         // Valor em estoque (qtd * custo)
  cmv: number;                // CMV do período
  qtdSold: number;            // Quantidade vendida no período
  qtdSoldBalcao: number;      // Vendido Balcão/A Prazo
  qtdSoldDelivery: number;    // Vendido Delivery (iFood+99+Próprio)
  turnover: number;           // Giro do produto
  daysOfStock: number;        // Dias de estoque
  lastPurchaseDate: string | null;  // Data da última compra
  lastPurchaseCost: number | null;  // Custo unitário da última compra
  previousAvgCost: number | null;   // Custo médio do período anterior
  costVariation: number | null;     // Variação % do custo
  entriesInPeriod: number;    // Qtd de entradas no período
  totalPurchased: number;     // Qtd total comprada no período
  abcClass?: string;          // Classificação ABC (A, B, C)
  lastSaleDate?: string | null; // Data da última venda
  daysSinceLastSale?: number;   // Dias desde última venda
}

// ==================== QUERIES ====================

/**
 * Resumo de estoque por categoria com giro, dias de estoque e variação de custo
 */
export async function getStockAnalysisByCategory(
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string,
  daysInPeriod: number,
  companyId?: number
): Promise<StockAnalysisCategorySummary[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Estoque atual por categoria (excluindo compostos)
  const stockResult = await db.execute(sql.raw(`
    SELECT 
      c.id as categoryId,
      c.name as categoryName,
      SUM(p.currentStock * p.avgCost) as stockValue,
      COUNT(CASE WHEN p.currentStock > 0 THEN 1 END) as productCount
    FROM products p
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE p.active = 1
      AND (p.isComposite = 0 OR p.isComposite IS NULL)
      ${companyId ? `AND p.companyId = ${companyId}` : ''}
    GROUP BY c.id, c.name
    HAVING stockValue > 0
  `));

  // 2. CMV por categoria no período
  const cmvResult = await db.execute(sql.raw(`
    SELECT 
      c.id as categoryId,
      SUM(si.quantity * p.avgCost) as cmv
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE s.status = 'ACTIVE'
      AND (p.isComposite = 0 OR p.isComposite IS NULL)
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endDate}'
      ${companyId ? `AND s.companyId = ${companyId}` : ''}
    GROUP BY c.id
  `));

  // 3. Movimentações para calcular estoque inicial
  const movResult = await db.execute(sql.raw(`
    SELECT 
      c.id as categoryId,
      SUM(CASE WHEN pm.type = 'ENTRADA' THEN ABS(pm.quantity) * p.avgCost ELSE 0 END) as totalIn,
      SUM(CASE WHEN pm.type IN ('SAIDA', 'PERDA') THEN ABS(pm.quantity) * p.avgCost ELSE 0 END) as totalOut,
      SUM(CASE WHEN pm.type = 'ACERTO' AND pm.quantity > 0 THEN pm.quantity * p.avgCost ELSE 0 END) as adjustIn,
      SUM(CASE WHEN pm.type = 'ACERTO' AND pm.quantity < 0 THEN ABS(pm.quantity) * p.avgCost ELSE 0 END) as adjustOut
    FROM productMovements pm
    INNER JOIN products p ON pm.productId = p.id
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE (p.isComposite = 0 OR p.isComposite IS NULL)
      AND DATE(CONVERT_TZ(pm.createdAt, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(pm.createdAt, '+00:00', '-03:00')) <= '${endDate}'
      ${companyId ? `AND p.companyId = ${companyId}` : ''}
    GROUP BY c.id
  `));

  // 4. Custo médio ponderado do período atual vs anterior por categoria
  const costCurrentResult = await db.execute(sql.raw(`
    SELECT 
      c.id as categoryId,
      SUM(poi.quantity * poi.unitCost) / NULLIF(SUM(poi.quantity), 0) as avgPurchaseCost
    FROM purchaseOrderItems poi
    INNER JOIN purchaseOrders po ON poi.purchaseOrderId = po.id
    INNER JOIN products p ON poi.productId = p.id
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE po.status = 'CONFIRMED'
      AND (p.isComposite = 0 OR p.isComposite IS NULL)
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) <= '${endDate}'
      ${companyId ? `AND po.companyId = ${companyId}` : ''}
    GROUP BY c.id
  `));

  const costPrevResult = await db.execute(sql.raw(`
    SELECT 
      c.id as categoryId,
      SUM(poi.quantity * poi.unitCost) / NULLIF(SUM(poi.quantity), 0) as avgPurchaseCost
    FROM purchaseOrderItems poi
    INNER JOIN purchaseOrders po ON poi.purchaseOrderId = po.id
    INNER JOIN products p ON poi.productId = p.id
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE po.status = 'CONFIRMED'
      AND (p.isComposite = 0 OR p.isComposite IS NULL)
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) >= '${prevStartDate}'
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) <= '${prevEndDate}'
      ${companyId ? `AND po.companyId = ${companyId}` : ''}
    GROUP BY c.id
  `));

  // Mapear resultados
  const stockRows = stockResult[0] as unknown as any[];
  const cmvRows = cmvResult[0] as unknown as any[];
  const movRows = movResult[0] as unknown as any[];
  const costCurrRows = costCurrentResult[0] as unknown as any[];
  const costPrevRows = costPrevResult[0] as unknown as any[];

  const cmvMap: Record<number, number> = {};
  for (const r of cmvRows) cmvMap[r.categoryId] = parseFloat(r.cmv || '0');

  const movMap: Record<number, { totalIn: number; totalOut: number }> = {};
  for (const r of movRows) {
    movMap[r.categoryId] = {
      totalIn: parseFloat(r.totalIn || '0') + parseFloat(r.adjustIn || '0'),
      totalOut: parseFloat(r.totalOut || '0') + parseFloat(r.adjustOut || '0'),
    };
  }

  const costCurrMap: Record<number, number> = {};
  for (const r of costCurrRows) costCurrMap[r.categoryId] = parseFloat(r.avgPurchaseCost || '0');

  const costPrevMap: Record<number, number> = {};
  for (const r of costPrevRows) costPrevMap[r.categoryId] = parseFloat(r.avgPurchaseCost || '0');

  const totalStockValue = stockRows.reduce((sum, r) => sum + parseFloat(r.stockValue || '0'), 0);

  const results: StockAnalysisCategorySummary[] = [];
  for (const row of stockRows) {
    const catId = row.categoryId;
    const stockValue = parseFloat(row.stockValue || '0');
    const cmv = cmvMap[catId] || 0;
    const mov = movMap[catId] || { totalIn: 0, totalOut: 0 };
    const initialStock = stockValue - mov.totalIn + mov.totalOut;
    const avgStock = (initialStock + stockValue) / 2;
    const turnover = avgStock > 0 ? cmv / avgStock : 0;
    const dailyCmv = daysInPeriod > 0 ? cmv / daysInPeriod : 0;
    const daysOfStock = dailyCmv > 0 ? stockValue / dailyCmv : 999;

    const costCurr = costCurrMap[catId];
    const costPrev = costPrevMap[catId];
    let costVariation = 0;
    if (costCurr && costPrev && costPrev > 0) {
      costVariation = ((costCurr - costPrev) / costPrev) * 100;
    }

    results.push({
      categoryId: catId,
      categoryName: row.categoryName,
      stockValue: Math.round(stockValue * 100) / 100,
      stockPercentage: totalStockValue > 0 ? Math.round((stockValue / totalStockValue) * 1000) / 10 : 0,
      productCount: parseInt(row.productCount || '0'),
      cmv: Math.round(cmv * 100) / 100,
      avgStock: Math.round(avgStock * 100) / 100,
      turnover: Math.round(turnover * 100) / 100,
      daysOfStock: Math.min(Math.round(daysOfStock), 999),
      costVariation: Math.round(costVariation * 10) / 10,
    });
  }

  return results.sort((a, b) => b.stockValue - a.stockValue);
}

/**
 * Detalhe de estoque por produto com giro, dias de estoque, variação de custo
 */
export async function getStockAnalysisByProduct(
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string,
  daysInPeriod: number,
  categoryId?: number,
  subcategory?: string,
  companyId?: number
): Promise<StockAnalysisProduct[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const categoryFilter = categoryId ? `AND p.categoryId = ${categoryId}` : '';

  const subcategoryFilter = subcategory ? `AND p.subcategory = '${subcategory.replace(/'/g, "''")}'` : '';

  // 1. Produtos com estoque atual
  const productsResult = await db.execute(sql.raw(`
    SELECT 
      p.id as productId,
      p.name as productName,
      c.id as categoryId,
      c.name as categoryName,
      p.subcategory,
      p.currentStock,
      CAST(p.avgCost AS DECIMAL(12,4)) as avgCost
    FROM products p
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE p.active = 1
      AND (p.isComposite = 0 OR p.isComposite IS NULL)
      AND p.currentStock > 0
      ${categoryFilter}
      ${subcategoryFilter}
      ${companyId ? `AND p.companyId = ${companyId}` : ''}
    ORDER BY (p.currentStock * p.avgCost) DESC
  `));

  const productRows = productsResult[0] as unknown as any[];
  if (productRows.length === 0) return [];

  const productIds = productRows.map((r: any) => r.productId).join(',');

  // 2. CMV e quantidade vendida por produto no período (com separação por canal)
  const cmvResult = await db.execute(sql.raw(`
    SELECT 
      si.productId,
      SUM(si.quantity * p.avgCost) as cmv,
      SUM(si.quantity) as qtdSold,
      SUM(CASE WHEN s.saleType IN ('BALCAO','A_PRAZO') THEN si.quantity ELSE 0 END) as qtdSoldBalcao,
      SUM(CASE WHEN s.saleType = 'DELIVERY' THEN si.quantity ELSE 0 END) as qtdSoldDelivery
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    WHERE s.status = 'ACTIVE'
      AND si.productId IN (${productIds})
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endDate}'
      ${companyId ? `AND s.companyId = ${companyId}` : ''}
    GROUP BY si.productId
  `));

  // 2b. Última venda por produto (para Produtos Parados)
  const lastSaleResult = await db.execute(sql.raw(`
    SELECT 
      si.productId,
      MAX(DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00'))) as lastSaleDate
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    WHERE s.status = 'ACTIVE'
      AND si.productId IN (${productIds})
    GROUP BY si.productId
  `));

  // 3. Última compra por produto
  const lastPurchaseResult = await db.execute(sql.raw(`
    SELECT 
      poi.productId,
      MAX(DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00'))) as lastPurchaseDate
    FROM purchaseOrderItems poi
    INNER JOIN purchaseOrders po ON poi.purchaseOrderId = po.id
    WHERE po.status = 'CONFIRMED'
      AND poi.productId IN (${productIds})
    GROUP BY poi.productId
  `));

  // 4. Custo da última compra por produto
  const lastCostResult = await db.execute(sql.raw(`
    SELECT t.productId, t.unitCost as lastPurchaseCost
    FROM (
      SELECT 
        poi.productId,
        CAST(poi.unitCost AS DECIMAL(12,4)) as unitCost,
        ROW_NUMBER() OVER (PARTITION BY poi.productId ORDER BY po.postingDate DESC) as rn
      FROM purchaseOrderItems poi
      INNER JOIN purchaseOrders po ON poi.purchaseOrderId = po.id
      WHERE po.status = 'CONFIRMED'
        AND poi.productId IN (${productIds})
    ) t
    WHERE t.rn = 1
  `));

  // 5. Custo médio de compra no período atual e anterior por produto
  const costCurrResult = await db.execute(sql.raw(`
    SELECT 
      poi.productId,
      SUM(poi.quantity * poi.unitCost) / NULLIF(SUM(poi.quantity), 0) as avgPurchaseCost
    FROM purchaseOrderItems poi
    INNER JOIN purchaseOrders po ON poi.purchaseOrderId = po.id
    WHERE po.status = 'CONFIRMED'
      AND poi.productId IN (${productIds})
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) <= '${endDate}'
    GROUP BY poi.productId
  `));

  const costPrevResult = await db.execute(sql.raw(`
    SELECT 
      poi.productId,
      SUM(poi.quantity * poi.unitCost) / NULLIF(SUM(poi.quantity), 0) as avgPurchaseCost
    FROM purchaseOrderItems poi
    INNER JOIN purchaseOrders po ON poi.purchaseOrderId = po.id
    WHERE po.status = 'CONFIRMED'
      AND poi.productId IN (${productIds})
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) >= '${prevStartDate}'
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) <= '${prevEndDate}'
    GROUP BY poi.productId
  `));

  // 6. Entradas no período (quantidade de compras e total comprado)
  const entriesResult = await db.execute(sql.raw(`
    SELECT 
      poi.productId,
      COUNT(DISTINCT po.id) as entriesCount,
      SUM(poi.quantity) as totalPurchased
    FROM purchaseOrderItems poi
    INNER JOIN purchaseOrders po ON poi.purchaseOrderId = po.id
    WHERE po.status = 'CONFIRMED'
      AND poi.productId IN (${productIds})
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) <= '${endDate}'
    GROUP BY poi.productId
  `));

  // Mapear tudo
  const cmvMap: Record<number, { cmv: number; qtdSold: number; qtdSoldBalcao: number; qtdSoldDelivery: number }> = {};
  for (const r of (cmvResult[0] as unknown as any[])) {
    cmvMap[r.productId] = {
      cmv: parseFloat(r.cmv || '0'),
      qtdSold: parseFloat(r.qtdSold || '0'),
      qtdSoldBalcao: parseFloat(r.qtdSoldBalcao || '0'),
      qtdSoldDelivery: parseFloat(r.qtdSoldDelivery || '0'),
    };
  }

  const lastSaleMap: Record<number, string> = {};
  for (const r of (lastSaleResult[0] as unknown as any[])) {
    const d = r.lastSaleDate;
    lastSaleMap[r.productId] = d instanceof Date ? d.toISOString().split('T')[0] : String(d || '').split('T')[0];
  }

  const lastPurchaseMap: Record<number, string> = {};
  for (const r of (lastPurchaseResult[0] as unknown as any[])) {
    const d = r.lastPurchaseDate;
    lastPurchaseMap[r.productId] = d instanceof Date ? d.toISOString().split('T')[0] : String(d || '').split('T')[0];
  }

  const lastCostMap: Record<number, number> = {};
  for (const r of (lastCostResult[0] as unknown as any[])) {
    lastCostMap[r.productId] = parseFloat(r.lastPurchaseCost || '0');
  }

  const costCurrMap: Record<number, number> = {};
  for (const r of (costCurrResult[0] as unknown as any[])) {
    costCurrMap[r.productId] = parseFloat(r.avgPurchaseCost || '0');
  }

  const costPrevMap: Record<number, number> = {};
  for (const r of (costPrevResult[0] as unknown as any[])) {
    costPrevMap[r.productId] = parseFloat(r.avgPurchaseCost || '0');
  }

  const entriesMap: Record<number, { count: number; total: number }> = {};
  for (const r of (entriesResult[0] as unknown as any[])) {
    entriesMap[r.productId] = { count: parseInt(r.entriesCount || '0'), total: parseFloat(r.totalPurchased || '0') };
  }

  // Montar resultado
  const results: StockAnalysisProduct[] = [];
  for (const row of productRows) {
    const pid = row.productId;
    const currentStock = parseFloat(row.currentStock || '0');
    const avgCost = parseFloat(row.avgCost || '0');
    const stockValue = currentStock * avgCost;
    const cmvData = cmvMap[pid] || { cmv: 0, qtdSold: 0, qtdSoldBalcao: 0, qtdSoldDelivery: 0 };
    const dailyCmv = daysInPeriod > 0 ? cmvData.cmv / daysInPeriod : 0;
    const turnover = stockValue > 0 ? cmvData.cmv / stockValue : 0;
    const daysOfStock = dailyCmv > 0 ? stockValue / dailyCmv : 999;

    const costCurr = costCurrMap[pid];
    const costPrev = costPrevMap[pid];
    let costVariation: number | null = null;
    if (costCurr && costPrev && costPrev > 0) {
      costVariation = Math.round(((costCurr - costPrev) / costPrev) * 1000) / 10;
    }

    const entries = entriesMap[pid] || { count: 0, total: 0 };

    // Calcular dias desde última venda
    const lastSaleDateStr = lastSaleMap[pid] || null;
    let daysSinceLastSale: number | undefined;
    if (lastSaleDateStr) {
      const lastSale = new Date(lastSaleDateStr + 'T12:00:00');
      const now = new Date();
      daysSinceLastSale = Math.floor((now.getTime() - lastSale.getTime()) / (1000 * 60 * 60 * 24));
    }

    results.push({
      productId: pid,
      productName: row.productName,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      subcategory: row.subcategory || null,
      currentStock,
      avgCost: Math.round(avgCost * 100) / 100,
      stockValue: Math.round(stockValue * 100) / 100,
      cmv: Math.round(cmvData.cmv * 100) / 100,
      qtdSold: Math.round(cmvData.qtdSold * 100) / 100,
      qtdSoldBalcao: Math.round(cmvData.qtdSoldBalcao * 100) / 100,
      qtdSoldDelivery: Math.round(cmvData.qtdSoldDelivery * 100) / 100,
      turnover: Math.round(turnover * 100) / 100,
      daysOfStock: Math.min(Math.round(daysOfStock), 999),
      lastPurchaseDate: lastPurchaseMap[pid] || null,
      lastPurchaseCost: lastCostMap[pid] ? Math.round(lastCostMap[pid] * 100) / 100 : null,
      previousAvgCost: costPrev ? Math.round(costPrev * 100) / 100 : null,
      costVariation,
      entriesInPeriod: entries.count,
      totalPurchased: Math.round(entries.total * 100) / 100,
      lastSaleDate: lastSaleDateStr,
      daysSinceLastSale,
    });
  }

  // Calcular classificação ABC por faturamento (usando CMV como proxy)
  // Ordenar por CMV desc, acumular %, classificar A=80%, B=15%, C=5%
  const sortedByCmv = [...results].sort((a, b) => b.cmv - a.cmv);
  const totalCmv = sortedByCmv.reduce((s, p) => s + p.cmv, 0);
  let accumulated = 0;
  for (const prod of sortedByCmv) {
    accumulated += prod.cmv;
    const pct = totalCmv > 0 ? (accumulated / totalCmv) * 100 : 100;
    if (pct <= 80) {
      prod.abcClass = 'A';
    } else if (pct <= 95) {
      prod.abcClass = 'B';
    } else {
      prod.abcClass = 'C';
    }
  }
  // Atualizar no array original
  const abcMap: Record<number, string> = {};
  for (const p of sortedByCmv) abcMap[p.productId] = p.abcClass || 'C';
  for (const r of results) r.abcClass = abcMap[r.productId] || 'C';

  return results;
}
