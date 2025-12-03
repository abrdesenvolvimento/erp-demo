import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // Buscar todas as vendas do Josivan
  const [sales] = await connection.execute(
    `SELECT s.id, s.saleDate, s.subtotal, s.finalAmount
     FROM sales s 
     WHERE s.customerId = 270011 
     ORDER BY s.saleDate DESC`
  );
  
  console.log('Total de vendas do Josivan:', sales.length);
  console.log('\nDetalhes das vendas:');
  
  let totalAmount = 0;
  
  sales.forEach((sale, idx) => {
    const date = new Date(sale.saleDate).toLocaleDateString('pt-BR');
    console.log(`${idx + 1}. ID: ${sale.id} | Data: ${date} | Valor: R$ ${parseFloat(sale.finalAmount).toFixed(2)}`);
    totalAmount += parseFloat(sale.finalAmount);
  });
  
  console.log(`\nTotal geral: R$ ${totalAmount.toFixed(2)}`);
  
} catch (error) {
  console.error('Erro:', error.message);
} finally {
  await connection.end();
}
