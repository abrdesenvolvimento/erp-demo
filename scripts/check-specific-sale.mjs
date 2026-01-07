import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Verificar vendas do dia 04/05/2024 (maior diferença: -R$ 2.383,25)
  console.log('VENDAS DO DIA 04/05/2024 NO BANCO:');
  console.log('=' .repeat(70));
  
  const [vendas] = await conn.execute(`
    SELECT id, finalAmount, totalAmount, discountAmount
    FROM sales
    WHERE DATE(saleDate) = '2024-05-04'
    ORDER BY finalAmount DESC
    LIMIT 20
  `);
  
  let total = 0;
  console.log('ID         | Final     | Total     | Desconto');
  console.log('-'.repeat(50));
  for (const v of vendas) {
    total += Number(v.finalAmount);
    console.log(`${v.id} | R$ ${Number(v.finalAmount).toFixed(2).padStart(7)} | R$ ${Number(v.totalAmount).toFixed(2).padStart(7)} | R$ ${Number(v.discountAmount || 0).toFixed(2).padStart(7)}`);
  }
  
  // Total do dia
  const [totalDia] = await conn.execute(`
    SELECT SUM(finalAmount) as total, SUM(totalAmount) as total_bruto, COUNT(*) as qtd
    FROM sales
    WHERE DATE(saleDate) = '2024-05-04'
  `);
  
  console.log('\n' + '=' .repeat(70));
  console.log(`Total do dia 04/05/2024:`);
  console.log(`  Quantidade: ${totalDia[0].qtd}`);
  console.log(`  Total Bruto (totalAmount): R$ ${Number(totalDia[0].total_bruto).toFixed(2)}`);
  console.log(`  Total Final (finalAmount): R$ ${Number(totalDia[0].total).toFixed(2)}`);
  console.log(`  Arquivo de migração: R$ 9.126,75`);
  console.log(`  Diferença: R$ ${(Number(totalDia[0].total) - 9126.75).toFixed(2)}`);
  
  await conn.end();
}
check().catch(console.error);
