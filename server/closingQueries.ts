/**
 * Queries adicionais para o novo layout da tela de Fechamento
 * Separado para manter db.ts organizado
 */

import { sql } from "drizzle-orm";
import { getDb } from "./db";

export interface SalesByCategory {
  categoryId: number;
  categoryName: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  margin: number;
  percentage: number;
}

export interface PurchasesByCategory {
  categoryId: number;
  categoryName: string;
  amount: number;
  percentage: number;
}

export interface SalesByPaymentType {
  paymentType: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface StockByCategory {
  categoryId: number;
  categoryName: string;
  initialStock: number;
  finalStock: number;
  variation: number;
  turnover: number; // Giro de estoque
}

export interface PurchasesBySupplier {
  supplierId: number;
  supplierName: string;
  amount: number;
  percentage: number;
  invoiceCount: number;
}

export interface SalesByChannel {
  channelId: number;
  channelName: string;
  channelCode: string;
  count: number;
  revenue: number;
  percentage: number;
  ticketMedio: number;
}

/**
 * Vendas por Canal (usando salesChannels + channelId da venda)
 * Agrupa por canal real: iFood, 99Food, Balcão, A Prazo
 */
export async function getSalesByChannel(startDate: string, endDate: string, companyId?: number): Promise<SalesByChannel[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.execute(sql.raw(`
    SELECT 
      s.channelId,
      sc.name as channelName,
      sc.code as channelCode,
      s.saleType,
      COUNT(*) as count,
      SUM(s.finalAmount) as revenue
    FROM sales s
    LEFT JOIN salesChannels sc ON s.channelId = sc.id
    WHERE s.status = 'ACTIVE'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endDate}'
      ${companyId ? `AND s.companyId = ${companyId}` : ''}
    GROUP BY s.channelId, sc.name, sc.code, s.saleType
    ORDER BY revenue DESC
  `));

  const rows = result[0] as unknown as any[];
  const totalRevenue = rows.reduce((sum, row) => sum + parseFloat(row.revenue || '0'), 0);

  // Mapear nomes amigáveis para os canais
  const channelNameMap: Record<string, string> = {
    'IFOOD': 'iFood',
    '99FOOD': '99',
    'PROPRIO': 'Delivery Próprio',
    'BALCAO': 'Balcão',
  };

  // Agrupar por canal - separar A_PRAZO do Balcão
  const channelMap = new Map<string, SalesByChannel>();

  for (const row of rows) {
    const saleType = row.saleType || 'BALCAO';
    const channelCode = row.channelCode || 'BALCAO';
    
    // A_PRAZO é um "canal" separado mesmo que use channelId=1 (Balcão)
    let key: string;
    let displayName: string;
    
    if (saleType === 'A_PRAZO') {
      key = 'A_PRAZO';
      displayName = 'A Prazo';
    } else {
      key = channelCode;
      displayName = channelNameMap[channelCode] || row.channelName || channelCode;
    }

    const existing = channelMap.get(key);
    const count = parseInt(row.count || '0');
    const revenue = parseFloat(row.revenue || '0');

    if (existing) {
      existing.count += count;
      existing.revenue += revenue;
    } else {
      channelMap.set(key, {
        channelId: row.channelId || 0,
        channelName: displayName,
        channelCode: key,
        count,
        revenue,
        percentage: 0,
        ticketMedio: 0,
      });
    }
  }

  // Calcular percentuais e ticket médio
  const results: SalesByChannel[] = [];
  for (const [, channel] of channelMap) {
    channel.percentage = totalRevenue > 0 ? Math.round((channel.revenue / totalRevenue) * 1000) / 10 : 0;
    channel.ticketMedio = channel.count > 0 ? Math.round((channel.revenue / channel.count) * 100) / 100 : 0;
    results.push(channel);
  }

  return results.sort((a, b) => b.revenue - a.revenue);
}

/**
 * Vendas por Categoria de Produtos
 */
export async function getSalesByCategory(startDate: string, endDate: string, companyId?: number): Promise<SalesByCategory[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.execute(sql.raw(`
    SELECT 
      c.id as categoryId,
      c.name as categoryName,
      SUM(si.quantity * si.unitPrice) as revenue,
      SUM(si.quantity * p.avgCost) as cost
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE s.status = 'ACTIVE'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endDate}'
      ${companyId ? `AND s.companyId = ${companyId}` : ''}
    GROUP BY c.id, c.name
    ORDER BY revenue DESC
  `));

  const rows = result[0] as unknown as any[];
  const totalRevenue = rows.reduce((sum, row) => sum + parseFloat(row.revenue || '0'), 0);

  return rows.map(row => {
    const revenue = parseFloat(row.revenue || '0');
    const cost = parseFloat(row.cost || '0');
    const grossProfit = revenue - cost;
    const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const percentage = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;

    return {
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      revenue,
      cost,
      grossProfit,
      margin: Math.round(margin * 10) / 10,
      percentage: Math.round(percentage * 10) / 10,
    };
  });
}

/**
 * Compras por Categoria de Produtos
 */
export async function getPurchasesByCategory(startDate: string, endDate: string, companyId?: number): Promise<PurchasesByCategory[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.execute(sql.raw(`
    SELECT 
      c.id as categoryId,
      c.name as categoryName,
      SUM(poi.quantity * poi.unitCost) as amount
    FROM purchaseOrderItems poi
    INNER JOIN purchaseOrders po ON poi.purchaseOrderId = po.id
    INNER JOIN products p ON poi.productId = p.id
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE po.status = 'CONFIRMED'
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) <= '${endDate}'
      ${companyId ? `AND po.companyId = ${companyId}` : ''}
    GROUP BY c.id, c.name
    ORDER BY amount DESC
  `));

  const rows = result[0] as unknown as any[];
  const totalAmount = rows.reduce((sum, row) => sum + parseFloat(row.amount || '0'), 0);

  return rows.map(row => {
    const amount = parseFloat(row.amount || '0');
    const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;

    return {
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      amount,
      percentage: Math.round(percentage * 10) / 10,
    };
  });
}

/**
 * Vendas por Tipo de Pagamento
 */
export async function getSalesByPaymentType(startDate: string, endDate: string, companyId?: number): Promise<SalesByPaymentType[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.execute(sql.raw(`
    SELECT 
      s.paymentMethod as paymentType,
      COUNT(*) as count,
      SUM(s.finalAmount) as revenue
    FROM sales s
    WHERE s.status = 'ACTIVE'
      AND s.paymentMethod IS NOT NULL
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endDate}'
      ${companyId ? `AND s.companyId = ${companyId}` : ''}
    GROUP BY s.paymentMethod
    ORDER BY revenue DESC
  `));

  const rows = result[0] as unknown as any[];
  const totalRevenue = rows.reduce((sum, row) => sum + parseFloat(row.revenue || '0'), 0);

  return rows.map(row => {
    const revenue = parseFloat(row.revenue || '0');
    const percentage = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;

    return {
      paymentType: row.paymentType || 'Não Informado',
      count: parseInt(row.count || '0'),
      revenue,
      percentage: Math.round(percentage * 10) / 10,
    };
  });
}

/**
 * Estoque por Categoria com Giro
 * Calcula estoque inicial retroativamente: estoque atual + saídas - entradas do período
 */
export async function getStockByCategory(
  startDate: string,
  endDate: string,
  year: number,
  month: number,
  companyId?: number
): Promise<StockByCategory[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Estoque FINAL (snapshot atual) por categoria
  // Excluir produtos compostos (isComposite=1) para alinhar com o Dashboard
  const finalStockResult = await db.execute(sql.raw(`
    SELECT 
      c.id as categoryId,
      c.name as categoryName,
      SUM(p.currentStock * p.avgCost) as finalStock
    FROM products p
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE p.active = 1
      AND (p.isComposite = 0 OR p.isComposite IS NULL)
      ${companyId ? `AND p.companyId = ${companyId}` : ''}
    GROUP BY c.id, c.name
  `));

  // Movimentações de estoque no período (entradas e saídas)
  // Excluir produtos compostos para consistência
  const movementsResult = await db.execute(sql.raw(`
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
      ${companyId ? `AND pm.companyId = ${companyId}` : ''}
    GROUP BY c.id
  `));

  // CMV por categoria (custo das vendas) para cálculo do giro
  // Excluir produtos compostos para consistência
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

  const finalRows = finalStockResult[0] as unknown as any[];
  const movementRows = movementsResult[0] as unknown as any[];
  const cmvRows = cmvResult[0] as unknown as any[];

  // Mapear movimentações por categoria
  const movementsByCategory: Record<number, { totalIn: number; totalOut: number }> = {};
  for (const row of movementRows) {
    const totalIn = parseFloat(row.totalIn || '0') + parseFloat(row.adjustIn || '0');
    const totalOut = parseFloat(row.totalOut || '0') + parseFloat(row.adjustOut || '0');
    movementsByCategory[row.categoryId] = {
      totalIn,
      totalOut,
    };
  }

  // Mapear CMV por categoria
  const cmvByCategory: Record<number, number> = {};
  for (const row of cmvRows) {
    cmvByCategory[row.categoryId] = parseFloat(row.cmv || '0');
  }

  // Calcular estoque inicial e giro
  const result: StockByCategory[] = [];
  for (const row of finalRows) {
    const categoryId = row.categoryId;
    const finalStock = parseFloat(row.finalStock || '0');
    const movements = movementsByCategory[categoryId] || { totalIn: 0, totalOut: 0 };
    
    // Estoque Inicial = Estoque Final - Entradas + Saídas
    const initialStock = finalStock - movements.totalIn + movements.totalOut;
    const variation = finalStock - initialStock;
    
    // Giro = CMV / Estoque Médio
    const avgStock = (initialStock + finalStock) / 2;
    const cmv = cmvByCategory[categoryId] || 0;
    const turnover = avgStock > 0 ? cmv / avgStock : 0;

    result.push({
      categoryId,
      categoryName: row.categoryName,
      initialStock: Math.round(initialStock * 100) / 100,
      finalStock: Math.round(finalStock * 100) / 100,
      variation: Math.round(variation * 100) / 100,
      turnover: Math.round(turnover * 100) / 100,
    });
  }

  return result.sort((a, b) => b.finalStock - a.finalStock);
}

/**
 * Compras por Fornecedor - usa COALESCE(tradeName, name) para evitar "Sem Nome"
 */
export async function getPurchasesBySupplier(startDate: string, endDate: string, companyId?: number): Promise<PurchasesBySupplier[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.execute(sql.raw(`
    SELECT 
      pa.id as supplierId,
      COALESCE(NULLIF(pa.tradeName, 'null'), pa.name) as supplierName,
      SUM(po.totalAmount) as amount,
      COUNT(po.id) as invoiceCount
    FROM purchaseOrders po
    INNER JOIN partners pa ON po.supplierId = pa.id
    WHERE po.status = 'CONFIRMED'
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) >= '${startDate}'
      AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) <= '${endDate}'
      ${companyId ? `AND po.companyId = ${companyId}` : ''}
    GROUP BY pa.id, pa.name, pa.tradeName
    ORDER BY amount DESC
  `));

  const rows = result[0] as unknown as any[];
  const totalAmount = rows.reduce((sum, row) => sum + parseFloat(row.amount || '0'), 0);

  return rows.map(row => {
    const amount = parseFloat(row.amount || '0');
    const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;

    return {
      supplierId: row.supplierId,
      supplierName: row.supplierName || 'Sem Nome',
      amount,
      percentage: Math.round(percentage * 10) / 10,
      invoiceCount: parseInt(row.invoiceCount || '0'),
    };
  });
}

/**
 * Captura e persiste o snapshot de estoque final por categoria para um mês fechado.
 * Idempotente: se já existir snapshot para o mês, atualiza os valores (não duplica).
 * Retorna o número de categorias salvas.
 */
export async function captureMonthlyStockSnapshot(
  year: number,
  month: number,
  companyId: number = 1,
  capturedBy?: string
): Promise<{ saved: number; competenceMonth: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const competenceMonth = `${year}-${String(month).padStart(2, '0')}`;

  // Buscar estoque atual por categoria (snapshot no momento do fechamento)
  const [rows] = await (db as any).$client.query(`
    SELECT 
      c.id as categoryId,
      c.name as categoryName,
      COUNT(p.id) as totalItems,
      COALESCE(SUM(p.currentStock * p.avgCost), 0) as totalCost
    FROM products p
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE p.active = 1
      AND (p.isComposite = 0 OR p.isComposite IS NULL)
      AND p.companyId = ?
    GROUP BY c.id, c.name
    ORDER BY totalCost DESC
  `, [companyId]);

  let saved = 0;
  for (const row of rows as any[]) {
    await (db as any).$client.query(`
      INSERT INTO monthlyStockSnapshot 
        (companyId, year, month, competenceMonth, categoryId, categoryName, totalItems, totalCost, snapshotDate, capturedBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      ON DUPLICATE KEY UPDATE
        categoryName = VALUES(categoryName),
        totalItems = VALUES(totalItems),
        totalCost = VALUES(totalCost),
        snapshotDate = NOW(),
        capturedBy = VALUES(capturedBy)
    `, [
      companyId,
      year,
      month,
      competenceMonth,
      row.categoryId,
      row.categoryName,
      row.totalItems,
      parseFloat(row.totalCost || '0').toFixed(2),
      capturedBy || null
    ]);
    saved++;
  }

  return { saved, competenceMonth };
}

/**
 * Busca o snapshot de estoque de um mês fechado.
 * Retorna null se não houver snapshot (mês ainda não fechado).
 */
export async function getMonthlyStockSnapshot(
  year: number,
  month: number,
  companyId: number = 1
): Promise<Array<{ categoryId: number; categoryName: string; totalItems: number; totalCost: number; snapshotDate: Date }> | null> {
  const db = await getDb();
  if (!db) return null;

  const competenceMonth = `${year}-${String(month).padStart(2, '0')}`;

  const [rows] = await (db as any).$client.query(`
    SELECT categoryId, categoryName, totalItems, totalCost, snapshotDate
    FROM monthlyStockSnapshot
    WHERE companyId = ? AND competenceMonth = ?
    ORDER BY totalCost DESC
  `, [companyId, competenceMonth]);

  const result = rows as any[];
  if (!result || result.length === 0) return null;

  return result.map(row => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    totalItems: row.totalItems,
    totalCost: parseFloat(row.totalCost || '0'),
    snapshotDate: row.snapshotDate,
  }));
}
