import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('ANÁLISE DETALHADA 2025:');
  console.log('=' .repeat(60));
  
  // Total incluindo canceladas
  const [totalGeral] = await conn.execute(`
    SELECT 
      status,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE YEAR(saleDate) = 2025
    GROUP BY status
  `);
  
  console.log('\n1. VENDAS POR STATUS:');
  for (const row of totalGeral) {
    console.log(`   ${row.status}: ${row.vendas} vendas | R$ ${Number(row.faturamento).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }
  
  // Verificar se há vendas com valor 0 ou negativo
  const [zeradas] = await conn.execute(`
    SELECT COUNT(*) as qtd, ROUND(SUM(finalAmount), 2) as total
    FROM sales
    WHERE YEAR(saleDate) = 2025 AND finalAmount <= 0
  `);
  console.log(`\n2. VENDAS COM VALOR <= 0: ${zeradas[0].qtd}`);
  
  // Total com canceladas
  const [comCanceladas] = await conn.execute(`
    SELECT ROUND(SUM(finalAmount), 2) as total
    FROM sales
    WHERE YEAR(saleDate) = 2025
  `);
  console.log(`\n3. TOTAL COM CANCELADAS: R$ ${Number(comCanceladas[0].total).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  
  // Total sem canceladas
  const [semCanceladas] = await conn.execute(`
    SELECT ROUND(SUM(finalAmount), 2) as total
    FROM sales
    WHERE YEAR(saleDate) = 2025 AND status != 'CANCELLED'
  `);
  console.log(`   TOTAL SEM CANCELADAS: R$ ${Number(semCanceladas[0].total).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  
  // Listar vendas canceladas
  const [canceladas] = await conn.execute(`
    SELECT id, DATE_FORMAT(saleDate, '%Y-%m-%d') as data, finalAmount, cancellationReason
    FROM sales
    WHERE YEAR(saleDate) = 2025 AND status = 'CANCELLED'
    ORDER BY finalAmount DESC
    LIMIT 20
  `);
  
  if (canceladas.length > 0) {
    console.log('\n4. VENDAS CANCELADAS (maiores valores):');
    let totalCanc = 0;
    for (const v of canceladas) {
      totalCanc += Number(v.finalAmount);
      console.log(`   ${v.data} | ID ${v.id} | R$ ${Number(v.finalAmount).toFixed(2)} | ${v.cancellationReason || 'Sem motivo'}`);
    }
    console.log(`   TOTAL CANCELADAS: R$ ${totalCanc.toFixed(2)}`);
  }
  
  // Diferença
  console.log('\n' + '=' .repeat(60));
  console.log('RESUMO:');
  console.log(`   Sistema (sem canceladas): R$ 900.104,36`);
  console.log(`   Esperado: R$ 906.104,00`);
  console.log(`   Diferença: R$ -5.999,64`);
  
  await conn.end();
}
check().catch(console.error);
