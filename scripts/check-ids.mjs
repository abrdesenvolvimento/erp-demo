import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const [range] = await conn.execute(`
    SELECT MIN(id) as min_id, MAX(id) as max_id, COUNT(*) as total 
    FROM sales 
    WHERE YEAR(saleDate) = 2024 AND MONTH(saleDate) BETWEEN 5 AND 8
  `);
  
  console.log('Range de IDs no banco (Mai-Ago 2024):');
  console.log(`  Min ID: ${range[0].min_id}`);
  console.log(`  Max ID: ${range[0].max_id}`);
  console.log(`  Total: ${range[0].total}`);
  
  // Verificar alguns IDs específicos
  const [sample] = await conn.execute(`
    SELECT id, DATE(saleDate) as data, finalAmount 
    FROM sales 
    WHERE YEAR(saleDate) = 2024 AND MONTH(saleDate) = 5
    ORDER BY id DESC
    LIMIT 5
  `);
  
  console.log('\nÚltimos 5 IDs de Mai/2024:');
  for (const row of sample) {
    console.log(`  ID ${row.id}: ${row.data} | R$ ${row.finalAmount}`);
  }
  
  await conn.end();
}
check().catch(console.error);
