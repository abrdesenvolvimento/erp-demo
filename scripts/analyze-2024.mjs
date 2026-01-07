import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function analyze2024() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('\n📊 FATURAMENTO 2024 - MÊS A MÊS:');
  console.log('─'.repeat(60));
  
  const [rows] = await connection.execute(`
    SELECT 
      MONTH(saleDate) as mes,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE YEAR(saleDate) = 2024 AND (status != 'CANCELLED' OR status IS NULL)
    GROUP BY MONTH(saleDate)
    ORDER BY mes
  `);
  
  let total = 0;
  for (const row of rows) {
    const meses = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    total += Number(row.faturamento);
    console.log(`${meses[row.mes].padEnd(3)}/2024: ${String(row.vendas).padStart(5)} vendas | R$ ${Number(row.faturamento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }
  console.log('─'.repeat(60));
  console.log(`TOTAL 2024: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  
  // Verificar vendas na virada do ano (dez/2024 e jan/2025)
  console.log('\n📊 VENDAS NA VIRADA DO ANO (Dez/2024 e Jan/2025):');
  console.log('─'.repeat(60));
  
  const [virada] = await connection.execute(`
    SELECT 
      DATE(saleDate) as data,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE saleDate >= '2024-12-25' AND saleDate <= '2025-01-05'
      AND (status != 'CANCELLED' OR status IS NULL)
    GROUP BY DATE(saleDate)
    ORDER BY data
  `);
  
  for (const row of virada) {
    console.log(`${row.data}: ${String(row.vendas).padStart(4)} vendas | R$ ${Number(row.faturamento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }
  
  // Verificar se há vendas com datas estranhas
  console.log('\n📊 VERIFICAÇÃO DE DATAS ESTRANHAS EM 2024:');
  console.log('─'.repeat(60));
  
  const [estranhas] = await connection.execute(`
    SELECT 
      id,
      saleDate,
      finalAmount,
      channel
    FROM sales
    WHERE YEAR(saleDate) = 2024 
      AND (MONTH(saleDate) = 1 OR MONTH(saleDate) = 12)
      AND (status != 'CANCELLED' OR status IS NULL)
    ORDER BY saleDate
    LIMIT 20
  `);
  
  console.log('Primeiras vendas de Jan/2024:');
  for (const row of estranhas.filter(r => new Date(r.saleDate).getMonth() === 0).slice(0, 5)) {
    console.log(`  ID ${row.id}: ${row.saleDate} | R$ ${Number(row.finalAmount).toFixed(2)} | ${row.channel}`);
  }
  
  console.log('\nÚltimas vendas de Dez/2024:');
  const [ultimasDez] = await connection.execute(`
    SELECT 
      id,
      saleDate,
      finalAmount,
      channel
    FROM sales
    WHERE YEAR(saleDate) = 2024 AND MONTH(saleDate) = 12
      AND (status != 'CANCELLED' OR status IS NULL)
    ORDER BY saleDate DESC
    LIMIT 10
  `);
  
  for (const row of ultimasDez) {
    console.log(`  ID ${row.id}: ${row.saleDate} | R$ ${Number(row.finalAmount).toFixed(2)} | ${row.channel}`);
  }
  
  await connection.end();
}

analyze2024().catch(console.error);
