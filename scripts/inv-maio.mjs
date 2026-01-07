import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function inv() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('MAIO 2024 - Por dia:');
  const [rows] = await connection.execute(`
    SELECT 
      DAY(saleDate) as dia,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as fat
    FROM sales
    WHERE YEAR(saleDate) = 2024 AND MONTH(saleDate) = 5
      AND status != 'CANCELLED'
    GROUP BY DAY(saleDate)
    ORDER BY dia
  `);
  
  let total = 0;
  for (const r of rows) {
    total += Number(r.fat);
    console.log(`${String(r.dia).padStart(2)}/05: ${String(r.vendas).padStart(4)} vendas | R$ ${Number(r.fat).toFixed(2)}`);
  }
  console.log(`TOTAL: R$ ${total.toFixed(2)}`);
  console.log(`REAL:  R$ 71761.00`);
  console.log(`DIFF:  R$ ${(total - 71761).toFixed(2)}`);
  
  await connection.end();
}
inv().catch(console.error);
