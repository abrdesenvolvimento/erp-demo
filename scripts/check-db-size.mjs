import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabaseSize() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('\n========================================');
  console.log('📊 RELATÓRIO DE TAMANHO DO BANCO DE DADOS');
  console.log('========================================\n');
  
  // Tamanho total do banco
  const [totalSize] = await connection.execute(`
    SELECT 
      ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS total_mb,
      ROUND(SUM(data_length) / 1024 / 1024, 2) AS dados_mb,
      ROUND(SUM(index_length) / 1024 / 1024, 2) AS indices_mb
    FROM information_schema.tables 
    WHERE table_schema = DATABASE()
  `);
  
  console.log('📦 TAMANHO TOTAL DO BANCO:');
  console.log(`   Dados:   ${totalSize[0].dados_mb} MB`);
  console.log(`   Índices: ${totalSize[0].indices_mb} MB`);
  console.log(`   TOTAL:   ${totalSize[0].total_mb} MB`);
  console.log('');
  
  // Tamanho por tabela
  const [tables] = await connection.execute(`
    SELECT 
      table_name AS tabela,
      table_rows AS registros,
      ROUND(data_length / 1024 / 1024, 2) AS dados_mb,
      ROUND(index_length / 1024 / 1024, 2) AS indices_mb,
      ROUND((data_length + index_length) / 1024 / 1024, 2) AS total_mb
    FROM information_schema.tables 
    WHERE table_schema = DATABASE()
    ORDER BY (data_length + index_length) DESC
  `);
  
  console.log('📋 DETALHAMENTO POR TABELA:');
  console.log('─'.repeat(80));
  console.log(`${'Tabela'.padEnd(30)} ${'Registros'.padStart(12)} ${'Dados (MB)'.padStart(12)} ${'Índices (MB)'.padStart(12)} ${'Total (MB)'.padStart(12)}`);
  console.log('─'.repeat(80));
  
  for (const table of tables) {
    console.log(
      `${table.tabela.padEnd(30)} ${String(table.registros || 0).padStart(12)} ${String(table.dados_mb).padStart(12)} ${String(table.indices_mb).padStart(12)} ${String(table.total_mb).padStart(12)}`
    );
  }
  console.log('─'.repeat(80));
  
  // Contagem exata de registros nas tabelas principais
  console.log('\n📈 CONTAGEM EXATA DE REGISTROS (tabelas principais):');
  console.log('─'.repeat(50));
  
  const mainTables = ['sales', 'saleItems', 'products', 'partners', 'purchaseOrders', 'purchaseOrderItems', 'expenses', 'receivables', 'productMovements'];
  
  for (const tableName of mainTables) {
    try {
      const [count] = await connection.execute(`SELECT COUNT(*) as total FROM ${tableName}`);
      console.log(`   ${tableName.padEnd(25)} ${String(count[0].total).padStart(12)} registros`);
    } catch (e) {
      // Tabela pode não existir
    }
  }
  console.log('─'.repeat(50));
  
  // Período dos dados de vendas
  const [salesPeriod] = await connection.execute(`
    SELECT 
      MIN(saleDate) as data_inicial,
      MAX(saleDate) as data_final,
      COUNT(*) as total_vendas,
      ROUND(SUM(finalAmount), 2) as faturamento_total
    FROM sales
    WHERE status != 'CANCELLED'
  `);
  
  console.log('\n📅 PERÍODO DOS DADOS DE VENDAS:');
  console.log(`   Data inicial:     ${salesPeriod[0].data_inicial}`);
  console.log(`   Data final:       ${salesPeriod[0].data_final}`);
  console.log(`   Total de vendas:  ${salesPeriod[0].total_vendas.toLocaleString('pt-BR')}`);
  console.log(`   Faturamento:      R$ ${Number(salesPeriod[0].faturamento_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  
  // Vendas por ano
  const [salesByYear] = await connection.execute(`
    SELECT 
      YEAR(saleDate) as ano,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE status != 'CANCELLED'
    GROUP BY YEAR(saleDate)
    ORDER BY ano
  `);
  
  console.log('\n📊 VENDAS POR ANO:');
  console.log('─'.repeat(50));
  for (const year of salesByYear) {
    console.log(`   ${year.ano}:  ${String(year.vendas).padStart(8)} vendas  |  R$ ${Number(year.faturamento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }
  console.log('─'.repeat(50));
  
  await connection.end();
  
  console.log('\n✅ Relatório concluído!');
  console.log('\n💡 RECOMENDAÇÕES PARA BACKUP:');
  console.log('   - Tamanho atual permite backup diário sem problemas');
  console.log('   - Considerar backup incremental para economia de espaço');
  console.log('   - Manter pelo menos 7 dias de backups');
  console.log('');
}

checkDatabaseSize().catch(console.error);
