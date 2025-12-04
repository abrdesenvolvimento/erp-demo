import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar vendas de novembro
const [sales] = await conn.query(`
  SELECT 
    saleDate,
    createdAt,
    finalAmount
  FROM sales
  WHERE saleDate >= '2025-11-01' AND saleDate < '2025-12-01'
  ORDER BY saleDate
`);

// Agrupar por dia
const dayMap = new Map();
sales.forEach(sale => {
  // Converter para timezone de Brasília
  const dateStr = new Date(sale.saleDate || sale.createdAt).toLocaleString('en-US', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [month, day, year] = dateStr.split('/');
  const dayKey = `${year}-${month}-${day}`;
  
  if (!dayMap.has(dayKey)) {
    dayMap.set(dayKey, 0);
  }
  dayMap.set(dayKey, dayMap.get(dayKey) + parseFloat(sale.finalAmount));
});

console.log('Dias com vendas em novembro:', dayMap.size);
console.log('Total de vendas:', sales.length);
console.log('\nDetalhamento por dia:');
Array.from(dayMap.entries()).sort().forEach(([day, total]) => {
  console.log(`  ${day}: R$ ${total.toFixed(2)}`);
});

const totalMonth = Array.from(dayMap.values()).reduce((a, b) => a + b, 0);
console.log('\nTotal do mês: R$', totalMonth.toFixed(2));
console.log('Média por dia com vendas:', (totalMonth / dayMap.size).toFixed(2));
console.log('Média por dia do mês (30 dias):', (totalMonth / 30).toFixed(2));

await conn.end();
