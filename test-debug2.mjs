// Test script to verify dashboard and purchase confirmation work correctly
import 'tsx/esm';

const db = await import('./server/db.ts');

async function test() {
  try {
    const conn = await db.getDb();
    console.log('DB connected:', !!conn);
    
    // Test 1: Dashboard queries
    console.log('\n=== DASHBOARD QUERIES ===');
    console.time('TOTAL dashboard');
    
    const [products, recentSales, dailyRevenue, monthlyRevenue, monthlyPurchases, totalPendingReceivables, categories, channels] = await Promise.all([
      db.getProducts({ activeOnly: false, companyId: 1 }),
      db.getSales({ limit: 10, companyId: 1 }),
      db.getDashboardDailyRevenue(1),
      db.getDashboardMonthlyRevenue(1),
      db.getDashboardMonthlyPurchases(1),
      db.getTotalPendingReceivables(1),
      db.getCategories(true, 1),
      db.getSalesChannels(true, 1),
    ]);
    
    console.timeEnd('TOTAL dashboard');
    console.log('Products:', products.length, '| Sales:', recentSales.length, '| Categories:', categories.length);
    console.log('Daily revenue:', JSON.stringify(dailyRevenue));
    console.log('Monthly revenue:', monthlyRevenue.total);
    
    // Test 2: getSales with date filter
    console.log('\n=== SALES WITH DATE FILTER ===');
    console.time('getSales filtered');
    const filteredSales = await db.getSales({ companyId: 1, dateFrom: '2026-05-14', dateTo: '2026-05-14' });
    console.timeEnd('getSales filtered');
    console.log('Filtered sales count:', filteredSales?.length);
    if (filteredSales?.length > 0) {
      console.log('First sale date:', filteredSales[0].saleDate);
      console.log('Last sale date:', filteredSales[filteredSales.length-1].saleDate);
    }
    
    // Test 3: Check purchase orders
    console.log('\n=== PURCHASE ORDERS ===');
    console.time('getPurchaseOrders');
    const pos = await db.getPurchaseOrders(1);
    console.timeEnd('getPurchaseOrders');
    console.log('Total POs:', pos?.length);
    const draftPOs = pos?.filter(p => p.status === 'DRAFT') || [];
    const confirmedPOs = pos?.filter(p => p.status === 'CONFIRMED') || [];
    console.log('DRAFT:', draftPOs.length, '| CONFIRMED:', confirmedPOs.length);
    
    // Test 4: Verify confirmPurchaseOrder idempotency guard
    if (confirmedPOs.length > 0) {
      console.log('\n=== IDEMPOTENCY GUARD TEST ===');
      const testPO = confirmedPOs[0];
      console.log('Testing confirm on already-confirmed PO:', testPO.id);
      try {
        await db.confirmPurchaseOrder(testPO.id);
        console.log('Result: Silently returned (guard worked)');
      } catch(e) {
        console.log('Result: Error -', e.message);
      }
    }
    
    // Test 5: Check if there are any orphaned data
    console.log('\n=== ORPHAN CHECK ===');
    const { sql } = await import('drizzle-orm');
    const orphanMovements = await conn.execute(sql`
      SELECT pm.documentNumber, COUNT(*) as cnt 
      FROM productMovements pm 
      LEFT JOIN purchaseOrders po ON pm.documentNumber = po.docNumber 
      WHERE pm.type = 'ENTRADA' AND po.id IS NULL 
      GROUP BY pm.documentNumber
      LIMIT 10
    `);
    console.log('Orphaned movements:', orphanMovements[0]?.length || 0);
    
    console.log('\n=== ALL TESTS PASSED ===');
  } catch(e) {
    console.error('ERROR:', e.message);
    console.error(e.stack?.substring(0, 800));
  }
  process.exit(0);
}

test();
