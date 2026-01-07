import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('VENDAS DELIVERY DEZEMBRO 2025:');
  console.log('=' .repeat(60));
  
  // Verificar vendas delivery em dezembro 2025
  const [vendas] = await conn.execute(`
    SELECT 
      COUNT(*) as qtd,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE saleType = 'DELIVERY'
      AND status != 'CANCELLED'
      AND DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) >= '2025-12-01'
      AND DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) <= '2025-12-31'
  `);
  
  console.log(`\nVendas Delivery Dez/2025:`);
  console.log(`  Quantidade: ${vendas[0].qtd}`);
  console.log(`  Faturamento: R$ ${Number(vendas[0].faturamento || 0).toFixed(2)}`);
  
  // Verificar vendas delivery em janeiro 2026
  const [vendas2026] = await conn.execute(`
    SELECT 
      COUNT(*) as qtd,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE saleType = 'DELIVERY'
      AND status != 'CANCELLED'
      AND DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) >= '2026-01-01'
      AND DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) <= '2026-01-07'
  `);
  
  console.log(`\nVendas Delivery Jan/2026 (01-07):`);
  console.log(`  Quantidade: ${vendas2026[0].qtd}`);
  console.log(`  Faturamento: R$ ${Number(vendas2026[0].faturamento || 0).toFixed(2)}`);
  
  // Verificar o que getSales retorna
  console.log('\n' + '=' .repeat(60));
  console.log('VERIFICANDO getSales({ limit: 10000 }):');
  
  const [recentSales] = await conn.execute(`
    SELECT 
      MIN(DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00'))) as minDate,
      MAX(DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00'))) as maxDate,
      COUNT(*) as total
    FROM sales
    ORDER BY saleDate DESC
    LIMIT 10000
  `);
  
  console.log(`  Min Date: ${recentSales[0].minDate}`);
  console.log(`  Max Date: ${recentSales[0].maxDate}`);
  console.log(`  Total: ${recentSales[0].total}`);
  
  // Verificar vendas delivery recentes
  const [recentDelivery] = await conn.execute(`
    SELECT 
      DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) as data,
      COUNT(*) as qtd,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE saleType = 'DELIVERY'
      AND status != 'CANCELLED'
    GROUP BY DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00'))
    ORDER BY data DESC
    LIMIT 10
  `);
  
  console.log('\nÚltimas 10 datas com vendas delivery:');
  for (const row of recentDelivery) {
    console.log(`  ${row.data}: ${row.qtd} vendas | R$ ${Number(row.faturamento).toFixed(2)}`);
  }
  
  await conn.end();
}
check().catch(console.error);
