import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Verificar vendas duplicadas (mesmo valor, mesmo dia, muitas ocorrências)
  console.log('VERIFICANDO POSSÍVEIS DUPLICATAS EM MAIO-AGOSTO 2024:');
  console.log('─'.repeat(70));
  
  const [dups] = await connection.execute(`
    SELECT 
      DATE(saleDate) as data,
      finalAmount,
      COUNT(*) as qtd
    FROM sales
    WHERE YEAR(saleDate) = 2024 
      AND MONTH(saleDate) BETWEEN 5 AND 8
      AND status != 'CANCELLED'
    GROUP BY DATE(saleDate), finalAmount
    HAVING COUNT(*) > 10
    ORDER BY qtd DESC
    LIMIT 30
  `);
  
  console.log('Combinações (data + valor) com mais de 10 ocorrências:');
  for (const r of dups) {
    const d = new Date(r.data);
    console.log(`  ${d.getDate()}/${d.getMonth()+1}: R$ ${Number(r.finalAmount).toFixed(2)} aparece ${r.qtd}x = R$ ${(Number(r.finalAmount) * r.qtd).toFixed(2)}`);
  }
  
  // Verificar IDs sequenciais para ver se há gaps ou duplicações
  console.log('\n\nVERIFICANDO RANGE DE IDs POR MÊS:');
  console.log('─'.repeat(70));
  
  for (let mes = 5; mes <= 8; mes++) {
    const [range] = await connection.execute(`
      SELECT 
        MIN(id) as min_id,
        MAX(id) as max_id,
        COUNT(*) as total,
        MAX(id) - MIN(id) + 1 as range_esperado
      FROM sales
      WHERE YEAR(saleDate) = 2024 AND MONTH(saleDate) = ?
        AND status != 'CANCELLED'
    `, [mes]);
    
    const r = range[0];
    const meses = ['', '', '', '', '', 'Mai', 'Jun', 'Jul', 'Ago'];
    console.log(`${meses[mes]}/2024: IDs ${r.min_id} a ${r.max_id} | Total: ${r.total} | Range: ${r.range_esperado} | Diff: ${r.range_esperado - r.total}`);
  }
  
  // Verificar se há vendas com IDs muito diferentes do esperado para a data
  console.log('\n\nVERIFICANDO VENDAS COM IDs FORA DO PADRÃO:');
  console.log('─'.repeat(70));
  
  const [outliers] = await connection.execute(`
    SELECT 
      id,
      DATE(saleDate) as data,
      finalAmount
    FROM sales
    WHERE YEAR(saleDate) = 2024 
      AND MONTH(saleDate) BETWEEN 5 AND 8
      AND status != 'CANCELLED'
      AND id < 2400000
    ORDER BY id
    LIMIT 20
  `);
  
  console.log('Vendas com IDs baixos (possível migração errada):');
  for (const r of outliers) {
    const d = new Date(r.data);
    console.log(`  ID ${r.id}: ${d.getDate()}/${d.getMonth()+1}/2024 | R$ ${Number(r.finalAmount).toFixed(2)}`);
  }
  
  await connection.end();
}
check().catch(console.error);
