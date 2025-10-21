import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'erp_demo',
});

try {
  const [rows] = await connection.execute('DESCRIBE partners');
  console.log('Partners table structure:');
  console.table(rows);
  
  const [count] = await connection.execute('SELECT COUNT(*) as count FROM partners');
  console.log('\nPartners count:', count[0].count);
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await connection.end();
}
