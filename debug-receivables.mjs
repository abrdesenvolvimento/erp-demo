import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const [receivables] = await connection.execute(`
  SELECT 
    id,
    saleId,
    totalAmount,
    receivedAmount,
    status,
    CAST(totalAmount AS DECIMAL(10,2)) as total_dec,
    CAST(receivedAmount AS DECIMAL(10,2)) as received_dec,
    (CAST(totalAmount AS DECIMAL(10,2)) - CAST(receivedAmount AS DECIMAL(10,2))) as pending,
    GREATEST(0, CAST(totalAmount AS DECIMAL(10,2)) - CAST(receivedAmount AS DECIMAL(10,2))) as pending_greatest
  FROM receivables
  WHERE customerId = 360009
    AND status IN ('PENDENTE', 'PARCIAL', 'VENCIDO')
  ORDER BY saleId
`);

console.log("=== RECEIVABLES INDIVIDUAIS ===");
console.table(receivables);

const sumPending = receivables.reduce((sum, r) => sum + parseFloat(r.pending), 0);
const sumGreatest = receivables.reduce((sum, r) => sum + parseFloat(r.pending_greatest), 0);

console.log("\nSoma pending:", sumPending.toFixed(2));
console.log("Soma pending_greatest:", sumGreatest.toFixed(2));

await connection.end();
