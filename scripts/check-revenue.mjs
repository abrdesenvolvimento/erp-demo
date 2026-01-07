import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkRevenue() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('\n📊 FATURAMENTO POR ANO (excluindo canceladas):');
  console.log('─'.repeat(60));
  
  const [rows] = await connection.execute(`
    SELECT 
      YEAR(saleDate) as ano,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE status != 'CANCELLED' OR status IS NULL
    GROUP BY YEAR(saleDate)
    ORDER BY ano
  `);
  
  for (const row of rows) {
    console.log(`${row.ano}: ${String(row.vendas).padStart(6)} vendas | R$ ${Number(row.faturamento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }
  
  console.log('\n📊 FATURAMENTO POR ANO (TODAS as vendas, incluindo canceladas):');
  console.log('─'.repeat(60));
  
  const [rowsAll] = await connection.execute(`
    SELECT 
      YEAR(saleDate) as ano,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as faturamento,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as canceladas
    FROM sales
    GROUP BY YEAR(saleDate)
    ORDER BY ano
  `);
  
  for (const row of rowsAll) {
    console.log(`${row.ano}: ${String(row.vendas).padStart(6)} vendas (${row.canceladas} canceladas) | R$ ${Number(row.faturamento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }
  
  console.log('\n📊 VERIFICAÇÃO DE STATUS:');
  console.log('─'.repeat(60));
  
  const [statusRows] = await connection.execute(`
    SELECT 
      status,
      COUNT(*) as quantidade
    FROM sales
    GROUP BY status
  `);
  
  for (const row of statusRows) {
    console.log(`Status "${row.status || 'NULL'}": ${row.quantidade} vendas`);
  }
  
  await connection.end();
}

checkRevenue().catch(console.error);
