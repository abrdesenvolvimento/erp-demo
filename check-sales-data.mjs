import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // Buscar dados das vendas do Josivan
  const [sales] = await connection.execute(
    `SELECT s.id, s.saleDate, s.createdAt, s.saleType, s.paymentMethod, s.finalAmount
     FROM sales s
     WHERE s.customerId = 270011 
     AND s.id IN (12210007, 12210008, 12210009, 12210010, 12210011, 12210012)
     ORDER BY s.id DESC`
  );
  
  console.log('Dados das vendas do Josivan:\n');
  
  sales.forEach((sale) => {
    console.log(`ID: ${sale.id}`);
    console.log(`  saleDate: ${sale.saleDate}`);
    console.log(`  createdAt: ${sale.createdAt}`);
    console.log(`  saleType: ${sale.saleType}`);
    console.log(`  paymentMethod: ${sale.paymentMethod}`);
    console.log(`  finalAmount: R$ ${parseFloat(sale.finalAmount).toFixed(2)}`);
    console.log('');
  });
  
} catch (error) {
  console.error('Erro:', error.message);
} finally {
  await connection.end();
}
