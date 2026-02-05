import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(`
  SELECT j.id, j.status, j.description, js.sourceType, js.sourceId, s.saleDate
  FROM journals j
  JOIN journalSources js ON js.journalId = j.id
  JOIN sales s ON s.id = js.sourceId AND js.sourceType = 'sale'
  WHERE s.saleDate >= '2026-02-05'
  ORDER BY s.saleDate DESC
  LIMIT 10
`);

console.log("Journals de vendas de hoje:");
console.log(JSON.stringify(rows, null, 2));

await conn.end();
