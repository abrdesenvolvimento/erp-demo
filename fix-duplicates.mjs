import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // IDs das vendas duplicadas a remover (as 6 primeiras importações)
  const idsToRemove = [12210001, 12210002, 12210003, 12210004, 12210005, 12210006];
  
  console.log('🔄 Iniciando remoção de vendas duplicadas...\n');
  
  for (const saleId of idsToRemove) {
    // Buscar itens da venda para restaurar estoque
    const [items] = await connection.execute(
      'SELECT productId, quantity FROM saleItems WHERE saleId = ?',
      [saleId]
    );
    
    // Restaurar estoque
    for (const item of items) {
      await connection.execute(
        'UPDATE products SET currentStock = currentStock + ? WHERE id = ?',
        [item.quantity, item.productId]
      );
    }
    
    // Remover itens da venda
    await connection.execute(
      'DELETE FROM saleItems WHERE saleId = ?',
      [saleId]
    );
    
    // Remover venda
    await connection.execute(
      'DELETE FROM sales WHERE id = ?',
      [saleId]
    );
    
    console.log(`✓ Venda #${saleId} removida`);
  }
  
  console.log('\n✓ Todas as vendas duplicadas foram removidas');
  console.log('✓ Estoque foi restaurado');
  
  // Verificar saldo final
  const [sales] = await connection.execute(
    'SELECT SUM(finalAmount) as total FROM sales WHERE customerId = 270011'
  );
  
  console.log(`\n✓ Saldo final do Josivan: R$ ${parseFloat(sales[0].total).toFixed(2)}`);
  
} catch (error) {
  console.error('Erro:', error.message);
  process.exit(1);
} finally {
  await connection.end();
}
