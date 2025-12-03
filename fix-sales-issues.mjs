import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log('🔄 Corrigindo problemas nas vendas do Josivan...\n');
  
  // Problema 1: Corrigir paymentMethod de "PENDENTE" para "A_PRAZO"
  const [result1] = await connection.execute(
    `UPDATE sales 
     SET paymentMethod = 'A_PRAZO'
     WHERE customerId = 270011 
     AND id IN (12210007, 12210008, 12210009, 12210010, 12210011, 12210012)
     AND paymentMethod = 'PENDENTE'`
  );
  
  console.log(`✓ Corrigido paymentMethod: ${result1.affectedRows} vendas atualizadas`);
  
  // Problema 2: Corrigir saleDate para que seja igual ao saleDate original
  // (já está correto no banco, mas vamos confirmar)
  const [sales] = await connection.execute(
    `SELECT id, saleDate FROM sales 
     WHERE customerId = 270011 
     AND id IN (12210007, 12210008, 12210009, 12210010, 12210011, 12210012)`
  );
  
  console.log(`\n✓ Verificação de saleDate:`);
  sales.forEach(sale => {
    const date = new Date(sale.saleDate);
    console.log(`  Venda #${sale.id}: ${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR')}`);
  });
  
  console.log('\n✓ Todas as correções foram aplicadas com sucesso!');
  
} catch (error) {
  console.error('Erro:', error.message);
  process.exit(1);
} finally {
  await connection.end();
}
