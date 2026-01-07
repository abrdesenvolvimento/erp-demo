import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const [rows] = await conn.execute(`
    SELECT 
      MONTH(saleDate) as mes,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE YEAR(saleDate) = 2025
      AND status != 'CANCELLED'
    GROUP BY MONTH(saleDate)
    ORDER BY mes
  `);
  
  console.log('FATURAMENTO 2025 POR MÊS:');
  console.log('=' .repeat(50));
  
  const meses = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  let total = 0;
  
  for (const row of rows) {
    total += Number(row.faturamento);
    console.log(`${meses[row.mes]}: ${row.vendas} vendas | R$ ${Number(row.faturamento).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }
  
  console.log('-'.repeat(50));
  console.log(`TOTAL: R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`Esperado: R$ 906.104,00`);
  console.log(`Diferença: R$ ${(total - 906104).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  
  await conn.end();
}
check().catch(console.error);
