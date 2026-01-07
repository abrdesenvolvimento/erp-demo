import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('COMPARAÇÃO DE FATURAMENTO 2025 (UTC vs GMT-3):');
  console.log('=' .repeat(60));
  
  // Usando UTC (como a query direta faz)
  const [utc] = await conn.execute(`
    SELECT 
      ROUND(SUM(finalAmount), 2) as total
    FROM sales
    WHERE YEAR(saleDate) = 2025
      AND status != 'CANCELLED'
  `);
  console.log(`\n1. Usando YEAR(saleDate) direto (UTC): R$ ${Number(utc[0].total).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  
  // Usando CONVERT_TZ (como a análise de vendas faz)
  const [gmt3] = await conn.execute(`
    SELECT 
      ROUND(SUM(finalAmount), 2) as total
    FROM sales
    WHERE YEAR(CONVERT_TZ(saleDate, '+00:00', '-03:00')) = 2025
      AND status != 'CANCELLED'
  `);
  console.log(`2. Usando CONVERT_TZ para GMT-3: R$ ${Number(gmt3[0].total).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  
  // Verificar diferença
  const diff = Number(gmt3[0].total) - Number(utc[0].total);
  console.log(`\nDiferença: R$ ${diff.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  
  // Verificar vendas na virada do ano
  console.log('\n' + '=' .repeat(60));
  console.log('VENDAS NA VIRADA DO ANO (31/12/2025 e 01/01/2026):');
  
  const [virada] = await conn.execute(`
    SELECT 
      id,
      saleDate,
      CONVERT_TZ(saleDate, '+00:00', '-03:00') as saleDate_gmt3,
      finalAmount
    FROM sales
    WHERE (
      (DATE(saleDate) = '2025-12-31' AND HOUR(saleDate) >= 21) OR
      (DATE(saleDate) = '2026-01-01' AND HOUR(saleDate) < 3)
    )
    AND status != 'CANCELLED'
    ORDER BY saleDate
    LIMIT 30
  `);
  
  console.log('\nVendas entre 31/12 21h e 01/01 03h UTC:');
  let totalVirada = 0;
  for (const v of virada) {
    totalVirada += Number(v.finalAmount);
    const utcDate = new Date(v.saleDate);
    const gmt3Date = new Date(v.saleDate_gmt3);
    console.log(`  ID ${v.id}: UTC ${utcDate.toISOString()} | GMT-3 ${gmt3Date.toISOString()} | R$ ${Number(v.finalAmount).toFixed(2)}`);
  }
  console.log(`\nTotal vendas na virada: R$ ${totalVirada.toFixed(2)}`);
  
  await conn.end();
}
check().catch(console.error);
