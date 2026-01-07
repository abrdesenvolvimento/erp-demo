import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('VENDAS DELIVERY EM JANEIRO 2026:');
  console.log('=' .repeat(60));
  
  // Verificar vendas delivery no período
  const [vendas] = await conn.execute(`
    SELECT 
      COUNT(*) as qtd,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE saleType = 'DELIVERY'
      AND status != 'CANCELLED'
      AND DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) >= '2026-01-01'
      AND DATE(CONVERT_TZ(saleDate, '+00:00', '-03:00')) <= '2026-01-06'
  `);
  
  console.log(`\nVendas Delivery 01/01 a 06/01/2026:`);
  console.log(`  Quantidade: ${vendas[0].qtd}`);
  console.log(`  Faturamento: R$ ${Number(vendas[0].faturamento || 0).toFixed(2)}`);
  
  // Verificar itens dessas vendas
  const [itens] = await conn.execute(`
    SELECT 
      p.id as productId,
      p.name as productName,
      SUM(si.quantity) as totalQtd,
      ROUND(SUM(si.totalPrice), 2) as totalRevenue
    FROM sales s
    JOIN saleItems si ON s.id = si.saleId
    JOIN products p ON si.productId = p.id
    WHERE s.saleType = 'DELIVERY'
      AND s.status != 'CANCELLED'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '2026-01-01'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '2026-01-06'
    GROUP BY p.id, p.name
    ORDER BY totalRevenue DESC
    LIMIT 10
  `);
  
  console.log(`\nTop 10 produtos delivery:`);
  for (const item of itens) {
    console.log(`  ${item.productName}: ${item.totalQtd} un | R$ ${Number(item.totalRevenue).toFixed(2)}`);
  }
  
  // Verificar se o problema é a query da análise
  console.log('\n' + '=' .repeat(60));
  console.log('VERIFICANDO QUERY DA ANÁLISE DELIVERY:');
  
  // Simular a query que a análise faz
  const [analise] = await conn.execute(`
    SELECT 
      p.id as productId,
      p.name as productName,
      c.name as categoryName,
      SUM(si.quantity) as totalQuantity,
      SUM(si.totalPrice) as totalRevenue,
      SUM(si.quantity * p.avgCost) as totalCost
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    INNER JOIN categories c ON p.categoryId = c.id
    WHERE s.status != 'CANCELLED' 
      AND s.saleType = 'DELIVERY'
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) >= '2026-01-01' 
      AND DATE(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) <= '2026-01-06'
    GROUP BY p.id, p.name, c.name
    ORDER BY totalRevenue DESC
  `);
  
  console.log(`\nResultado da query de análise: ${analise.length} produtos`);
  if (analise.length > 0) {
    for (const item of analise.slice(0, 5)) {
      console.log(`  ${item.productName}: R$ ${Number(item.totalRevenue).toFixed(2)}`);
    }
  }
  
  await conn.end();
}
check().catch(console.error);
