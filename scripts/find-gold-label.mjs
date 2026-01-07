import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Buscar vendas com valor >= 200 no dia 04/05/2024
  console.log('Vendas >= R$ 200 no dia 04/05/2024:');
  const [vendas] = await conn.execute(`
    SELECT s.id, s.finalAmount, si.quantity, si.unitPrice, p.name
    FROM sales s
    JOIN saleItems si ON s.id = si.saleId
    LEFT JOIN products p ON si.productId = p.id
    WHERE DATE(s.saleDate) = '2024-05-04'
      AND s.finalAmount >= 200
    ORDER BY s.finalAmount DESC
  `);
  
  for (const v of vendas) {
    console.log(`  Venda ${v.id}: R$ ${Number(v.finalAmount).toFixed(2)} | ${v.name || 'N/A'} | ${v.quantity} x R$ ${Number(v.unitPrice).toFixed(2)}`);
  }
  
  // Buscar produto Gold Label
  console.log('\n\nProdutos com "Gold" no nome:');
  const [produtos] = await conn.execute(`
    SELECT id, name FROM products WHERE name LIKE '%Gold%'
  `);
  
  for (const p of produtos) {
    console.log(`  ID ${p.id}: ${p.name}`);
  }
  
  // Verificar se há vendas de Gold Label em todo o período
  if (produtos.length > 0) {
    const ids = produtos.map(p => p.id).join(',');
    const [vendasGold] = await conn.execute(`
      SELECT DATE(s.saleDate) as data, COUNT(*) as qtd, SUM(si.quantity * si.unitPrice) as total
      FROM sales s
      JOIN saleItems si ON s.id = si.saleId
      WHERE si.productId IN (${ids})
        AND YEAR(s.saleDate) = 2024
      GROUP BY DATE(s.saleDate)
      ORDER BY data
      LIMIT 20
    `);
    
    console.log('\nVendas de Gold Label em 2024:');
    for (const v of vendasGold) {
      console.log(`  ${v.data}: ${v.qtd} vendas | R$ ${Number(v.total).toFixed(2)}`);
    }
  }
  
  await conn.end();
}
check().catch(console.error);
