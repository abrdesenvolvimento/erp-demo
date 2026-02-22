import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL);

async function testQuery(name, sqlStr) {
  const start = Date.now();
  try {
    const result = await db.execute(sql.raw(sqlStr));
    const elapsed = Date.now() - start;
    const rows = result[0] || result;
    const count = Array.isArray(rows) ? rows.length : 0;
    console.log(`✅ ${name}: ${elapsed}ms (${count} rows)`);
    return { name, elapsed, success: true };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ ${name}: ${elapsed}ms - ERROR: ${err.message}`);
    return { name, elapsed, success: false, error: err.message };
  }
}

const startDate = '2026-02-01';
const endDate = '2026-02-28';

console.log(`\nTestando queries de fechamento para ${startDate} a ${endDate}...\n`);

const queries = [
  ['salesByCategory', `SELECT c.id as categoryId, c.name as categoryName, 
    SUM(si.quantity * si.unitPrice) as revenue,
    SUM(si.quantity * COALESCE(p.costPrice, 0)) as cost
    FROM saleItems si 
    INNER JOIN sales s ON si.saleId = s.id 
    INNER JOIN products p ON si.productId = p.id 
    LEFT JOIN categories c ON p.categoryId = c.id 
    WHERE DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startDate}'
    AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endDate}'
    GROUP BY c.id, c.name ORDER BY revenue DESC`],
  
  ['purchasesByCategory', `SELECT c.id as categoryId, c.name as categoryName, 
    SUM(poi.quantity * poi.unitCost) as amount 
    FROM purchaseOrderItems poi 
    INNER JOIN purchaseOrders po ON poi.purchaseOrderId = po.id 
    INNER JOIN products p ON poi.productId = p.id 
    INNER JOIN categories c ON p.categoryId = c.id 
    WHERE po.status = 'CONFIRMED' 
    AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) >= '${startDate}'
    AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) <= '${endDate}'
    GROUP BY c.id, c.name ORDER BY amount DESC`],
  
  ['paymentTypes', `SELECT s.paymentMethod, COUNT(*) as count, SUM(s.finalAmount) as amount 
    FROM sales s 
    WHERE DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '${startDate}'
    AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '${endDate}'
    GROUP BY s.paymentMethod ORDER BY amount DESC`],
  
  ['stockByCategory', `SELECT c.id as categoryId, c.name as categoryName,
    SUM(p.currentStock) as currentStock,
    SUM(p.currentStock * COALESCE(p.costPrice, 0)) as stockValue
    FROM products p 
    LEFT JOIN categories c ON p.categoryId = c.id 
    WHERE p.isActive = 1 
    GROUP BY c.id, c.name ORDER BY stockValue DESC`],
  
  ['purchasesBySupplier', `SELECT pa.id as supplierId, pa.name as supplierName,
    SUM(po.totalAmount) as amount, COUNT(po.id) as invoiceCount
    FROM purchaseOrders po 
    INNER JOIN partners pa ON po.supplierId = pa.id 
    WHERE po.status = 'CONFIRMED'
    AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) >= '${startDate}'
    AND DATE(CONVERT_TZ(po.postingDate, '+00:00', '-03:00')) <= '${endDate}'
    GROUP BY pa.id, pa.name ORDER BY amount DESC`],
  
  ['expensesByAccount', `SELECT eg.id, eg.name, eg.classification, SUM(e.amount) as total
    FROM expenses e 
    INNER JOIN expenseGroups eg ON e.expenseGroupId = eg.id 
    WHERE DATE(CONVERT_TZ(e.date, '+00:00', '-03:00')) >= '${startDate}'
    AND DATE(CONVERT_TZ(e.date, '+00:00', '-03:00')) <= '${endDate}'
    GROUP BY eg.id, eg.name, eg.classification ORDER BY total DESC`],
];

let totalTime = 0;
for (const [name, sqlStr] of queries) {
  const result = await testQuery(name, sqlStr);
  totalTime += result.elapsed;
}

console.log(`\nTempo total: ${totalTime}ms`);
process.exit(0);
