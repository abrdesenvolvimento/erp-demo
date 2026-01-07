import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const [rows] = await conn.execute(`
    SELECT 
      YEAR(saleDate) as ano,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE status != 'CANCELLED'
    GROUP BY YEAR(saleDate)
    ORDER BY ano
  `);
  
  console.log('FATURAMENTO POR ANO (BANCO ATUALIZADO):');
  console.log('=' .repeat(50));
  console.log('Ano    | Vendas   | Faturamento');
  console.log('-'.repeat(50));
  
  let total = 0;
  for (const row of rows) {
    total += Number(row.faturamento);
    console.log(`${row.ano}   | ${String(row.vendas).padStart(8)} | R$ ${Number(row.faturamento).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }
  
  console.log('-'.repeat(50));
  console.log(`TOTAL  | ${' '.repeat(8)} | R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  
  await conn.end();
}
check().catch(console.error);
