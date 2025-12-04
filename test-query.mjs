import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const [result] = await connection.execute(`
  SELECT 
    customerId,
    SUM(GREATEST(0, CAST(totalAmount AS DECIMAL(10,2)) - CAST(receivedAmount AS DECIMAL(10,2)))) as total_pending
  FROM receivables
  WHERE customerId = 360009
    AND status IN ('PENDENTE', 'PARCIAL', 'VENCIDO')
  GROUP BY customerId
`);

console.log("Resultado da query:");
console.table(result);

await connection.end();
