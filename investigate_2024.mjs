import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function investigate() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  console.log('=== INVESTIGAÇÃO FATURAMENTO 2024 ===\n');
  
  // 1. Faturamento total por ano usando sales.finalAmount
  console.log('1. Faturamento por ano (sales.finalAmount):');
  const [salesByYear] = await connection.execute(`
    SELECT 
      YEAR(CONVERT_TZ(saleDate, '+00:00', '-03:00')) as ano,
      SUM(finalAmount) as faturamento,
      COUNT(*) as total_vendas
    FROM sales 
    WHERE status != 'CANCELLED'
    GROUP BY YEAR(CONVERT_TZ(saleDate, '+00:00', '-03:00'))
    ORDER BY ano
  `);
  console.table(salesByYear);
  
  // 2. Faturamento por ano usando saleItems.totalPrice (usado na Análise de Vendas)
  console.log('\n2. Faturamento por ano (saleItems.totalPrice):');
  const [saleItemsByYear] = await connection.execute(`
    SELECT 
      YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) as ano,
      SUM(si.totalPrice) as faturamento_items,
      COUNT(DISTINCT s.id) as total_vendas
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    WHERE s.status != 'CANCELLED'
    GROUP BY YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00'))
    ORDER BY ano
  `);
  console.table(saleItemsByYear);
  
  // 3. Comparar as duas fontes para 2024
  console.log('\n3. Diferença entre sales.finalAmount e saleItems.totalPrice para 2024:');
  const [comparison] = await connection.execute(`
    SELECT 
      (SELECT SUM(finalAmount) FROM sales WHERE status != 'CANCELLED' AND YEAR(CONVERT_TZ(saleDate, '+00:00', '-03:00')) = 2024) as sales_finalAmount,
      (SELECT SUM(si.totalPrice) FROM saleItems si INNER JOIN sales s ON si.saleId = s.id WHERE s.status != 'CANCELLED' AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = 2024) as saleItems_totalPrice
  `);
  console.table(comparison);
  
  // 4. Verificar se há vendas sem itens
  console.log('\n4. Vendas sem itens em 2024:');
  const [salesWithoutItems] = await connection.execute(`
    SELECT COUNT(*) as vendas_sem_itens, SUM(s.finalAmount) as valor_perdido
    FROM sales s
    LEFT JOIN saleItems si ON s.id = si.saleId
    WHERE s.status != 'CANCELLED' 
      AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = 2024
      AND si.id IS NULL
  `);
  console.table(salesWithoutItems);
  
  // 5. Verificar se há itens com productId inválido (não existe na tabela products)
  console.log('\n5. Itens com produto inexistente em 2024:');
  const [itemsWithoutProduct] = await connection.execute(`
    SELECT COUNT(*) as itens_sem_produto, SUM(si.totalPrice) as valor_perdido
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    LEFT JOIN products p ON si.productId = p.id
    WHERE s.status != 'CANCELLED' 
      AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = 2024
      AND p.id IS NULL
  `);
  console.table(itemsWithoutProduct);
  
  // 6. Verificar faturamento por mês em 2024
  console.log('\n6. Faturamento por mês em 2024 (saleItems.totalPrice):');
  const [byMonth] = await connection.execute(`
    SELECT 
      MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) as mes,
      SUM(si.totalPrice) as faturamento
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    WHERE s.status != 'CANCELLED' 
      AND YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')) = 2024
    GROUP BY MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00'))
    ORDER BY mes
  `);
  console.table(byMonth);
  
  // 7. Soma dos meses
  const somaTotal = byMonth.reduce((acc, row) => acc + parseFloat(row.faturamento), 0);
  console.log(`\nSoma dos 12 meses: R$ ${somaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  
  await connection.end();
}

investigate().catch(console.error);
