import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log('🔄 Criando recebíveis para as vendas do Josivan...\n');
  
  // Buscar todas as vendas A_PRAZO do Josivan que não têm recebível
  const [sales] = await connection.execute(
    `SELECT s.id, s.finalAmount, s.saleDate
     FROM sales s
     WHERE s.customerId = 270011 
     AND s.saleType = 'A_PRAZO'
     AND s.id NOT IN (SELECT DISTINCT saleId FROM receivables WHERE saleId IS NOT NULL)
     ORDER BY s.saleDate DESC`
  );
  
  console.log(`Encontradas ${sales.length} vendas sem recebível\n`);
  
  for (const sale of sales) {
    // Criar recebível
    const [receivableResult] = await connection.execute(
      `INSERT INTO receivables (saleId, customerId, totalAmount, receivedAmount, status, createdBy, createdAt, updatedAt)
       VALUES (?, 270011, ?, 0, 'PENDENTE', 'system', NOW(), NOW())`,
      [sale.id, sale.finalAmount]
    );
    
    const receivableId = receivableResult.insertId;
    
    // Criar parcela única (30 dias após a venda)
    const dueDate = new Date(sale.saleDate);
    dueDate.setDate(dueDate.getDate() + 30);
    
    await connection.execute(
      `INSERT INTO receivableInstallments (receivableId, installmentNumber, amount, dueDate, status, createdAt)
       VALUES (?, 1, ?, ?, 'PENDENTE', NOW())`,
      [receivableId, sale.finalAmount, dueDate]
    );
    
    console.log(`✓ Venda #${sale.id} (R$ ${parseFloat(sale.finalAmount).toFixed(2)}) - Recebível criado`);
  }
  
  console.log('\n✓ Todos os recebíveis foram criados com sucesso!');
  
  // Verificar saldo final
  const [summary] = await connection.execute(
    `SELECT SUM(CAST(totalAmount AS DECIMAL(10,2)) - CAST(receivedAmount AS DECIMAL(10,2))) as total
     FROM receivables
     WHERE customerId = 270011 AND status IN ('PENDENTE', 'PARCIAL', 'VENCIDO')`
  );
  
  console.log(`\n✓ Saldo total do Josivan em recebíveis: R$ ${parseFloat(summary[0].total || 0).toFixed(2)}`);
  
} catch (error) {
  console.error('Erro:', error.message);
  process.exit(1);
} finally {
  await connection.end();
}
