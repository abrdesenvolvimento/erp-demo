import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check how sales store channel info
const [salesSample] = await conn.execute(`
  SELECT id, channelId, saleType, paymentMethod, finalAmount 
  FROM sales WHERE status = 'ACTIVE' 
  ORDER BY id DESC LIMIT 10
`);
console.log("=== SALES SAMPLE (recent) ===");
salesSample.forEach(s => console.log(`id: ${s.id}, channelId: ${s.channelId}, saleType: '${s.saleType}', payment: '${s.paymentMethod}', total: ${s.finalAmount}`));

// Check distinct saleTypes
const [saleTypes] = await conn.execute(`
  SELECT saleType, COUNT(*) as cnt, SUM(finalAmount) as total
  FROM sales WHERE status = 'ACTIVE'
    AND DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) >= '2026-02-01'
    AND DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) <= '2026-02-28'
  GROUP BY saleType ORDER BY total DESC
`);
console.log("\n=== SALE TYPES FEB 2026 ===");
saleTypes.forEach(s => console.log(`saleType: '${s.saleType}', cnt: ${s.cnt}, total: ${s.total}`));

// Check goals for Feb 2026
const [goals] = await conn.execute(`SELECT * FROM revenueGoals WHERE year = 2026 AND month = 2`);
console.log("\n=== GOALS FEB 2026 ===");
console.log(JSON.stringify(goals, null, 2));

// Check all goals
const [allGoals] = await conn.execute(`SELECT * FROM revenueGoals ORDER BY year DESC, month DESC LIMIT 10`);
console.log("\n=== ALL GOALS (recent) ===");
console.log(JSON.stringify(allGoals, null, 2));

// Check how getMonthlyClosing fetches channel data - check salesChannels table
const [tables] = await conn.execute(`SHOW TABLES LIKE '%channel%'`);
console.log("\n=== TABLES WITH 'channel' ===");
console.log(tables);

const [tables2] = await conn.execute(`SHOW TABLES LIKE '%goal%'`);
console.log("\n=== TABLES WITH 'goal' ===");
console.log(tables2);

// Check salesChannels table structure
const [salesChannels] = await conn.execute(`SHOW TABLES LIKE 'salesChannels'`);
console.log("\n=== salesChannels table exists? ===");
console.log(salesChannels);

// Check how the existing getMonthlyClosing function works - look at salesByChannel
const [salesByChannel] = await conn.execute(`
  SELECT saleType as channel, COUNT(*) as count, SUM(finalAmount) as revenue
  FROM sales
  WHERE status = 'ACTIVE'
    AND DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) >= '2026-02-01'
    AND DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) <= '2026-02-28'
  GROUP BY saleType ORDER BY revenue DESC
`);
console.log("\n=== SALES BY CHANNEL (saleType) FEB 2026 ===");
salesByChannel.forEach(s => console.log(`channel: '${s.channel}', count: ${s.count}, revenue: ${s.revenue}`));

// Check expenses by managementAccount
const [expenses] = await conn.execute(`
  SELECT ma.name as accountName, ma.classification, SUM(e.totalAmount) as amount
  FROM expenses e
  INNER JOIN managementAccounts ma ON e.managementAccountId = ma.id
  WHERE e.competenceMonth = '2026-02'
  GROUP BY ma.id, ma.name, ma.classification
  ORDER BY amount DESC
`);
console.log("\n=== EXPENSES BY ACCOUNT FEB 2026 ===");
expenses.forEach(e => console.log(`${e.accountName} (${e.classification}): R$ ${parseFloat(e.amount).toFixed(2)}`));

await conn.end();
