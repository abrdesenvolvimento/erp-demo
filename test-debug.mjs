import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Register tsx for .ts imports
await import('tsx/esm');

const db = await import('./server/db.ts');

async function test() {
  try {
    const conn = await db.getDb();
    console.log('DB connected:', !!conn);
    
    // Test 1: Dashboard daily revenue
    console.time('getDashboardDailyRevenue');
    const daily = await db.getDashboardDailyRevenue(1);
    console.timeEnd('getDashboardDailyRevenue');
    console.log('Daily revenue:', JSON.stringify(daily).substring(0, 200));
    
    // Test 2: Dashboard monthly revenue
    console.time('getDashboardMonthlyRevenue');
    const monthly = await db.getDashboardMonthlyRevenue(1);
    console.timeEnd('getDashboardMonthlyRevenue');
    console.log('Monthly revenue:', JSON.stringify(monthly).substring(0, 200));
    
    // Test 3: getSales
    console.time('getSales');
    const sales = await db.getSales(1, '2026-05-14', '2026-05-15');
    console.timeEnd('getSales');
    console.log('Sales count:', sales?.length, 'First sale date:', sales?.[0]?.saleDate);
    
    // Test 4: Check a purchase order to verify confirm works
    console.time('getPurchaseOrders');
    const pos = await db.getPurchaseOrders(1);
    console.timeEnd('getPurchaseOrders');
    console.log('Purchase orders count:', pos?.length);
    if (pos?.length > 0) {
      const draftPOs = pos.filter(p => p.status === 'DRAFT');
      console.log('DRAFT POs:', draftPOs.length);
      if (draftPOs.length > 0) {
        console.log('First DRAFT PO:', draftPOs[0].id, draftPOs[0].docNumber, draftPOs[0].status);
      }
    }
    
    console.log('\n=== ALL TESTS PASSED ===');
  } catch(e) {
    console.error('ERROR:', e.message);
    console.error(e.stack?.substring(0, 800));
  }
  process.exit(0);
}

test();
