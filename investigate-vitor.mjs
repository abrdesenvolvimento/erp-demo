import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar clientes com Vitor ou Hugo
const [partners] = await connection.execute(
  "SELECT id, name FROM partners WHERE name LIKE '%Vitor%' OR name LIKE '%Hugo%' ORDER BY name"
);

console.log("=== CLIENTES ===");
console.table(partners);

for (const partner of partners) {
  console.log(`\n=== ANÁLISE: ${partner.name} (ID: ${partner.id}) ===`);
  
  // Cálculo da LISTA (getCustomersWithPendingReceivables)
  const [listCalc] = await connection.execute(`
    SELECT 
      SUM(CAST(totalAmount AS DECIMAL(10,2)) - CAST(receivedAmount AS DECIMAL(10,2))) as total_pending_list
    FROM receivables
    WHERE customerId = ? AND status IN ('PENDENTE', 'PARCIAL', 'VENCIDO')
  `, [partner.id]);
  
  // Cálculo do DETALHE (getCustomerReceivableDetail)
  const [sales] = await connection.execute(`
    SELECT 
      s.id as sale_id,
      s.finalAmount as sale_final,
      r.totalAmount as receivable_total,
      r.receivedAmount,
      r.status,
      (CAST(s.finalAmount AS DECIMAL(10,2)) - CAST(COALESCE(r.receivedAmount, '0') AS DECIMAL(10,2))) as pending_detail
    FROM sales s
    LEFT JOIN receivables r ON s.id = r.saleId
    WHERE s.customerId = ? AND s.saleType = 'A_PRAZO'
    ORDER BY s.saleDate DESC
  `, [partner.id]);
  
  console.log("\n--- Cálculo LISTA (receivables table) ---");
  console.log("Total Pendente:", listCalc[0].total_pending_list);
  
  console.log("\n--- Cálculo DETALHE (sales.finalAmount - receivables.receivedAmount) ---");
  console.table(sales);
  
  const detailTotal = sales.reduce((sum, s) => sum + parseFloat(s.pending_detail || 0), 0);
  console.log("Total Pendente (soma):", detailTotal.toFixed(2));
  
  console.log("\n--- DIVERGÊNCIA ---");
  console.log("Lista:", listCalc[0].total_pending_list);
  console.log("Detalhe:", detailTotal.toFixed(2));
  console.log("Diferença:", (parseFloat(listCalc[0].total_pending_list || 0) - detailTotal).toFixed(2));
}

await connection.end();
