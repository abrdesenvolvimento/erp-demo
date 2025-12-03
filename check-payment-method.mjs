import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const [sales] = await connection.execute(
    `SELECT id, paymentMethod, HEX(paymentMethod) as hex_value
     FROM sales 
     WHERE customerId = 270011 
     AND id IN (12210007, 12210008, 12210009, 12210010, 12210011, 12210012)
     LIMIT 1`
  );
  
  if (sales.length > 0) {
    const sale = sales[0];
    console.log(`ID: ${sale.id}`);
    console.log(`paymentMethod: "${sale.paymentMethod}"`);
    console.log(`paymentMethod (hex): ${sale.hex_value}`);
    console.log(`paymentMethod length: ${sale.paymentMethod.length}`);
  }
  
} catch (error) {
  console.error('Erro:', error.message);
} finally {
  await connection.end();
}
