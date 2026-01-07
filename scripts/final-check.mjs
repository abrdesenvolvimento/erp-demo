import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const [rows] = await conn.execute(`
    SELECT 
      MONTH(saleDate) as mes,
      COUNT(*) as total_vendas,
      COUNT(DISTINCT id) as ids_unicos,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE YEAR(saleDate) = 2024 
      AND status != 'CANCELLED'
    GROUP BY MONTH(saleDate)
    ORDER BY mes
  `);
  
  const meses = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  console.log('Mês     | Vendas | IDs únicos | Faturamento');
  console.log('--------|--------|------------|------------');
  for (const r of rows) {
    console.log(`${meses[r.mes].padEnd(7)} | ${String(r.total_vendas).padStart(6)} | ${String(r.ids_unicos).padStart(10)} | R$ ${Number(r.faturamento).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }
  
  await conn.end();
}
check();
