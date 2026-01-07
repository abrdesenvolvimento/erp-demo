import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function compare() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('FATURAMENTO POR DIA NO BANCO (Mai 2024 - primeiros 10 dias):');
  console.log('=' .repeat(50));
  
  const [rows] = await conn.execute(`
    SELECT 
      DATE(saleDate) as data,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE YEAR(saleDate) = 2024 AND MONTH(saleDate) = 5
      AND status != 'CANCELLED'
    GROUP BY DATE(saleDate)
    ORDER BY data
    LIMIT 10
  `);
  
  console.log('Data         | Vendas | Faturamento');
  console.log('-'.repeat(40));
  for (const row of rows) {
    const d = new Date(row.data);
    const dataStr = d.toISOString().split('T')[0];
    console.log(`${dataStr} | ${String(row.vendas).padStart(6)} | R$ ${Number(row.faturamento).toFixed(2)}`);
  }
  
  // Comparar totais por mês
  console.log('\n' + '=' .repeat(50));
  console.log('TOTAIS POR MÊS NO BANCO:');
  console.log('=' .repeat(50));
  
  const [totais] = await conn.execute(`
    SELECT 
      MONTH(saleDate) as mes,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as faturamento,
      ROUND(AVG(finalAmount), 2) as media
    FROM sales
    WHERE YEAR(saleDate) = 2024 AND MONTH(saleDate) BETWEEN 5 AND 8
      AND status != 'CANCELLED'
    GROUP BY MONTH(saleDate)
    ORDER BY mes
  `);
  
  const meses = ['', '', '', '', '', 'Mai', 'Jun', 'Jul', 'Ago'];
  for (const row of totais) {
    console.log(`\n${meses[row.mes]}/2024:`);
    console.log(`  Vendas: ${row.vendas}`);
    console.log(`  Faturamento: R$ ${Number(row.faturamento).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`  Média: R$ ${Number(row.media).toFixed(2)}`);
  }
  
  await conn.end();
}
compare().catch(console.error);
