import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('FATURAMENTO POR ANO (GMT-3 - Horário Brasil):');
  console.log('=' .repeat(60));
  
  const [rows] = await conn.execute(`
    SELECT 
      YEAR(CONVERT_TZ(saleDate, '+00:00', '-03:00')) as ano,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE status != 'CANCELLED'
    GROUP BY YEAR(CONVERT_TZ(saleDate, '+00:00', '-03:00'))
    ORDER BY ano
  `);
  
  console.log('\nAno    | Vendas   | Faturamento');
  console.log('-'.repeat(50));
  
  let total = 0;
  for (const row of rows) {
    total += Number(row.faturamento);
    console.log(`${row.ano}   | ${String(row.vendas).padStart(8)} | R$ ${Number(row.faturamento).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }
  
  console.log('-'.repeat(50));
  console.log(`TOTAL  | ${' '.repeat(8)} | R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  
  // Comparação com valores esperados
  console.log('\n' + '=' .repeat(60));
  console.log('COMPARAÇÃO COM VALORES ESPERADOS:');
  console.log('=' .repeat(60));
  
  const esperados = {
    2022: 578369,
    2023: 833471,
    2024: 881735,
    2025: 906104
  };
  
  for (const row of rows) {
    if (esperados[row.ano]) {
      const diff = Number(row.faturamento) - esperados[row.ano];
      const pct = (diff / esperados[row.ano]) * 100;
      const status = Math.abs(pct) < 1 ? '✅' : Math.abs(pct) < 2 ? '⚠️' : '❌';
      console.log(`${row.ano}: Sistema R$ ${Number(row.faturamento).toLocaleString('pt-BR')} | Esperado R$ ${esperados[row.ano].toLocaleString('pt-BR')} | Diff ${pct > 0 ? '+' : ''}${pct.toFixed(2)}% ${status}`);
    }
  }
  
  await conn.end();
}
check().catch(console.error);
