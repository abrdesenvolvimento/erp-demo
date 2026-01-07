import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function investigate() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  const meses = [
    { num: 5, nome: 'Maio', real: 71761 },
    { num: 6, nome: 'Junho', real: 80836 },
    { num: 7, nome: 'Julho', real: 69314 },
    { num: 8, nome: 'Agosto', real: 69287 }
  ];
  
  for (const mes of meses) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📊 ${mes.nome.toUpperCase()} 2024 - Diferença: Sistema tem R$ ${(mes.real).toLocaleString('pt-BR')} a mais`);
    console.log('═'.repeat(70));
    
    // Faturamento por dia
    const [porDia] = await connection.execute(`
      SELECT 
        DATE(saleDate) as data,
        DAYOFWEEK(saleDate) as dia_semana,
        COUNT(*) as vendas,
        ROUND(SUM(finalAmount), 2) as faturamento
      FROM sales
      WHERE YEAR(saleDate) = 2024 AND MONTH(saleDate) = ?
        AND (status != 'CANCELLED' OR status IS NULL)
      GROUP BY DATE(saleDate)
      ORDER BY data
    `, [mes.num]);
    
    const diasSemana = ['', 'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    let totalMes = 0;
    
    console.log('\nFaturamento por dia:');
    console.log('─'.repeat(50));
    for (const row of porDia) {
      const dia = new Date(row.data).getDate();
      totalMes += Number(row.faturamento);
      console.log(`  ${String(dia).padStart(2)}/${mes.num} (${diasSemana[row.dia_semana]}): ${String(row.vendas).padStart(4)} vendas | R$ ${Number(row.faturamento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }
    console.log('─'.repeat(50));
    console.log(`  TOTAL: R$ ${totalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  REAL:  R$ ${mes.real.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  DIFF:  R$ ${(totalMes - mes.real).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    
    // Verificar vendas com valores altos (possíveis duplicatas ou erros)
    const [vendasAltas] = await connection.execute(`
      SELECT 
        id,
        saleDate,
        finalAmount,
        salesChannelId
      FROM sales
      WHERE YEAR(saleDate) = 2024 AND MONTH(saleDate) = ?
        AND (status != 'CANCELLED' OR status IS NULL)
        AND finalAmount > 200
      ORDER BY finalAmount DESC
      LIMIT 10
    `, [mes.num]);
    
    console.log('\nVendas de maior valor (>R$ 200):');
    for (const row of vendasAltas) {
      const data = new Date(row.saleDate);
      console.log(`  ID ${row.id}: ${data.getDate()}/${mes.num} | R$ ${Number(row.finalAmount).toFixed(2)}`);
    }
  }
  
  // Verificar se há IDs duplicados ou padrões estranhos
  console.log(`\n${'═'.repeat(70)}`);
  console.log('📊 VERIFICAÇÃO DE DUPLICATAS');
  console.log('═'.repeat(70));
  
  const [duplicatas] = await connection.execute(`
    SELECT 
      DATE(saleDate) as data,
      finalAmount,
      COUNT(*) as qtd
    FROM sales
    WHERE YEAR(saleDate) = 2024 AND MONTH(saleDate) BETWEEN 5 AND 8
      AND (status != 'CANCELLED' OR status IS NULL)
    GROUP BY DATE(saleDate), finalAmount
    HAVING COUNT(*) > 5
    ORDER BY qtd DESC
    LIMIT 20
  `);
  
  console.log('\nCombinações data+valor que aparecem mais de 5 vezes:');
  for (const row of duplicatas) {
    console.log(`  ${row.data}: R$ ${Number(row.finalAmount).toFixed(2)} aparece ${row.qtd} vezes`);
  }
  
  await connection.end();
}

investigate().catch(console.error);
