import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Verificar se há vendas com IDs que aparecem em múltiplos meses
  console.log('VERIFICANDO IDs QUE APARECEM EM MÚLTIPLOS MESES:');
  console.log('─'.repeat(70));
  
  const [overlap] = await connection.execute(`
    SELECT 
      id,
      COUNT(DISTINCT MONTH(saleDate)) as meses_diferentes,
      GROUP_CONCAT(DISTINCT MONTH(saleDate)) as meses
    FROM sales
    WHERE YEAR(saleDate) = 2024 
      AND MONTH(saleDate) BETWEEN 5 AND 8
    GROUP BY id
    HAVING COUNT(DISTINCT MONTH(saleDate)) > 1
    LIMIT 20
  `);
  
  console.log(`Encontrados ${overlap.length} IDs em múltiplos meses`);
  for (const r of overlap) {
    console.log(`  ID ${r.id}: aparece nos meses ${r.meses}`);
  }
  
  // Verificar quantidade de vendas por canal nesses meses
  console.log('\n\nVENDAS POR CANAL (Mai-Ago 2024):');
  console.log('─'.repeat(70));
  
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
  
  // Verificar se há vendas com createdAt diferente de saleDate
  console.log('\n\nVERIFICANDO DATAS DE CRIAÇÃO vs DATA DE VENDA:');
  console.log('─'.repeat(70));
  
  const [datas] = await connection.execute(`
    SELECT 
      id,
      saleDate,
      createdAt,
      finalAmount
    FROM sales
    WHERE YEAR(saleDate) = 2024 
      AND MONTH(saleDate) BETWEEN 5 AND 8
      AND status != 'CANCELLED'
      AND DATE(createdAt) != DATE(saleDate)
    LIMIT 20
  `);
  
  console.log(`Vendas com createdAt diferente de saleDate: ${datas.length}`);
  for (const r of datas) {
    console.log(`  ID ${r.id}: saleDate=${r.saleDate}, createdAt=${r.createdAt} | R$ ${Number(r.finalAmount).toFixed(2)}`);
  }
  
  await connection.end();
}
check().catch(console.error);
