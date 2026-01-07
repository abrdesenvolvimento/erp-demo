import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const [cols] = await conn.execute(`SHOW COLUMNS FROM sales`);
  
  console.log('Colunas da tabela sales:');
  for (const col of cols) {
    console.log(`  ${col.Field}: ${col.Type}`);
  }
  
  await conn.end();
}
check().catch(console.error);
