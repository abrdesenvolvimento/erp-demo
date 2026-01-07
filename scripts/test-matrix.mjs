import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

async function test() {
  try {
    const result = await db.execute(sql.raw(`
      SELECT 
        p.id as productId,
        p.name as productName,
        DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) as saleDate,
        SUM(si.quantity) as quantity,
        SUM(si.totalPrice) as revenue,
        SUM(si.quantity * COALESCE(p.costPrice, 0)) as cost
      FROM saleItems si
      INNER JOIN sales s ON si.saleId = s.id
      INNER JOIN products p ON si.productId = p.id
      WHERE s.status != 'CANCELLED' 
        AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '2025-12-31' 
        AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '2025-12-31'
        AND p.name LIKE '%Gelo 5Kg%'
      GROUP BY p.id, p.name, DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00'))
      ORDER BY p.name
    `));
    
    console.log("Resultado:", JSON.stringify(result[0], null, 2));
  } catch (error) {
    console.error("Erro:", error.message);
  }
  process.exit(0);
}

test();
