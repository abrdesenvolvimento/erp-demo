import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function removeDuplicates() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('=' .repeat(70));
  console.log('ETAPA 3: REMOVER VENDAS DUPLICADAS');
  console.log('=' .repeat(70));
  
  // Carregar lista de IDs a remover
  const vendas_a_remover = JSON.parse(fs.readFileSync('/home/ubuntu/vendas_a_remover.json', 'utf8'));
  console.log(`\n1. Carregados ${vendas_a_remover.length} IDs para remoção`);
  
  // Verificar quantos desses IDs existem no banco
  const [existentes] = await conn.execute(`
    SELECT COUNT(*) as total FROM sales WHERE id IN (${vendas_a_remover.join(',')})
  `);
  console.log(`2. Verificação: ${existentes[0].total} vendas encontradas no banco`);
  
  // Calcular valor total que será removido
  const [valorTotal] = await conn.execute(`
    SELECT SUM(finalAmount) as total FROM sales WHERE id IN (${vendas_a_remover.join(',')})
  `);
  console.log(`3. Valor total a ser removido: R$ ${Number(valorTotal[0].total).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  
  // Primeiro, remover os itens de venda (saleItems)
  console.log('\n4. Removendo itens de venda (saleItems)...');
  const [resultItens] = await conn.execute(`
    DELETE FROM saleItems WHERE saleId IN (${vendas_a_remover.join(',')})
  `);
  console.log(`   ✅ ${resultItens.affectedRows} itens removidos`);
  
  // Depois, remover as vendas
  console.log('\n5. Removendo vendas (sales)...');
  const [resultVendas] = await conn.execute(`
    DELETE FROM sales WHERE id IN (${vendas_a_remover.join(',')})
  `);
  console.log(`   ✅ ${resultVendas.affectedRows} vendas removidas`);
  
  // Verificar resultado
  console.log('\n6. Verificando resultado...');
  const [novoTotal] = await conn.execute(`
    SELECT 
      MONTH(saleDate) as mes,
      COUNT(*) as vendas,
      ROUND(SUM(finalAmount), 2) as faturamento
    FROM sales
    WHERE YEAR(saleDate) = 2024 AND MONTH(saleDate) BETWEEN 5 AND 8
      AND status != 'CANCELLED'
    GROUP BY MONTH(saleDate)
    ORDER BY mes
  `);
  
  console.log('\n   Novo faturamento por mês:');
  const meses = ['', '', '', '', '', 'Mai', 'Jun', 'Jul', 'Ago'];
  for (const row of novoTotal) {
    console.log(`   ${meses[row.mes]}/2024: ${row.vendas} vendas | R$ ${Number(row.faturamento).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }
  
  await conn.end();
  console.log('\n✅ Remoção concluída!');
}

removeDuplicates().catch(console.error);
