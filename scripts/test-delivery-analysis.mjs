import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('TESTANDO LÓGICA DA ANÁLISE DELIVERY:');
  console.log('=' .repeat(60));
  
  // Simular os parâmetros que o frontend envia
  const startDateStr = '2025-12-01';
  const endDateStr = '2025-12-31';
  
  console.log(`\nPeríodo: ${startDateStr} a ${endDateStr}`);
  
  // Buscar vendas como a função faz (limit 10000)
  const [allSales] = await conn.execute(`
    SELECT id, saleDate, saleType, status, finalAmount
    FROM sales
    ORDER BY saleDate DESC
    LIMIT 10000
  `);
  
  console.log(`\nTotal de vendas retornadas: ${allSales.length}`);
  
  // Filtrar vendas delivery como a função faz
  const deliverySales = allSales.filter(s => {
    if (!s.saleDate || s.status === 'CANCELLED' || s.saleType !== 'DELIVERY') return false;
    
    // Converter para data no timezone de Brasília (como a função corrigida faz)
    const saleDateStr = new Date(s.saleDate).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    return saleDateStr >= startDateStr && saleDateStr <= endDateStr;
  });
  
  console.log(`Vendas delivery filtradas: ${deliverySales.length}`);
  
  if (deliverySales.length > 0) {
    const total = deliverySales.reduce((sum, s) => sum + parseFloat(s.finalAmount || '0'), 0);
    console.log(`Faturamento total: R$ ${total.toFixed(2)}`);
    
    // Mostrar algumas vendas
    console.log('\nPrimeiras 5 vendas delivery:');
    for (const s of deliverySales.slice(0, 5)) {
      const saleDateStr = new Date(s.saleDate).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      console.log(`  ID ${s.id}: ${saleDateStr} | R$ ${parseFloat(s.finalAmount).toFixed(2)}`);
    }
  }
  
  // Verificar se o problema é o ORDER BY
  console.log('\n' + '=' .repeat(60));
  console.log('VERIFICANDO ORDEM DAS VENDAS:');
  
  const [firstSales] = await conn.execute(`
    SELECT MIN(DATE(saleDate)) as minDate, MAX(DATE(saleDate)) as maxDate
    FROM (
      SELECT saleDate FROM sales ORDER BY saleDate DESC LIMIT 10000
    ) sub
  `);
  
  console.log(`Range das 10000 vendas mais recentes:`);
  console.log(`  Min: ${firstSales[0].minDate}`);
  console.log(`  Max: ${firstSales[0].maxDate}`);
  
  await conn.end();
}
test().catch(console.error);
