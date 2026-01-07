import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Verificar vendas do dia 04/05/2024 (maior diferença: -R$ 2.383,25)
  console.log('VENDAS DO DIA 04/05/2024 NO BANCO (maiores valores):');
  console.log('=' .repeat(70));
  
  const [vendas] = await conn.execute(`
    SELECT id, finalAmount, subtotal, discountAmount, surchargeAmount
    FROM sales
    WHERE DATE(saleDate) = '2024-05-04'
    ORDER BY finalAmount DESC
    LIMIT 20
  `);
  
  console.log('ID         | Final     | Subtotal  | Desconto  | Acréscimo');
  console.log('-'.repeat(65));
  for (const v of vendas) {
    console.log(`${v.id} | R$ ${Number(v.finalAmount).toFixed(2).padStart(7)} | R$ ${Number(v.subtotal).toFixed(2).padStart(7)} | R$ ${Number(v.discountAmount || 0).toFixed(2).padStart(7)} | R$ ${Number(v.surchargeAmount || 0).toFixed(2).padStart(7)}`);
  }
  
  // Total do dia
  const [totalDia] = await conn.execute(`
    SELECT SUM(finalAmount) as total, SUM(subtotal) as subtotal, COUNT(*) as qtd
    FROM sales
    WHERE DATE(saleDate) = '2024-05-04'
  `);
  
  console.log('\n' + '=' .repeat(70));
  console.log(`Total do dia 04/05/2024:`);
  console.log(`  Quantidade: ${totalDia[0].qtd}`);
  console.log(`  Subtotal: R$ ${Number(totalDia[0].subtotal).toFixed(2)}`);
  console.log(`  Final: R$ ${Number(totalDia[0].total).toFixed(2)}`);
  console.log(`  Arquivo de migração: R$ 9.126,75`);
  console.log(`  Diferença: R$ ${(Number(totalDia[0].total) - 9126.75).toFixed(2)}`);
  
  // Verificar itens de uma venda específica
  console.log('\n' + '=' .repeat(70));
  console.log('ITENS DA MAIOR VENDA DO DIA:');
  
  const [itens] = await conn.execute(`
    SELECT si.*, p.name as productName
    FROM saleItems si
    LEFT JOIN products p ON si.productId = p.id
    WHERE si.saleId = ?
  `, [vendas[0].id]);
  
  console.log(`Venda ID ${vendas[0].id} - Final: R$ ${Number(vendas[0].finalAmount).toFixed(2)}`);
  let totalItens = 0;
  for (const item of itens) {
    const itemTotal = Number(item.quantity) * Number(item.unitPrice);
    totalItens += itemTotal;
    console.log(`  ${item.productName || 'Produto ' + item.productId}: ${item.quantity} x R$ ${Number(item.unitPrice).toFixed(2)} = R$ ${itemTotal.toFixed(2)}`);
  }
  console.log(`  TOTAL ITENS: R$ ${totalItens.toFixed(2)}`);
  
  await conn.end();
}
check().catch(console.error);
