import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('VENDAS POR CANAL (Mai-Ago 2024):');
  const [canais] = await connection.execute(`
    SELECT 
      MONTH(saleDate) as mes,
      salesChannelId,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as fat
    FROM sales
    WHERE YEAR(saleDate) = 2024 
      AND MONTH(saleDate) BETWEEN 5 AND 8
      AND status != 'CANCELLED'
    GROUP BY MONTH(saleDate), salesChannelId
    ORDER BY mes, salesChannelId
  `);
  
  const meses = ['', '', '', '', '', 'Mai', 'Jun', 'Jul', 'Ago'];
  for (const r of canais) {
    console.log(`${meses[r.mes]}: Canal ${r.salesChannelId || 'NULL'} | ${r.vendas} vendas | R$ ${Number(r.fat).toFixed(2)}`);
  }
  
  await connection.end();
}
check().catch(console.error);
