import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar vendas A_PRAZO
const [sales] = await connection.execute(`
  SELECT s.id, s.saleDate, s.finalAmount
  FROM sales s
  JOIN partners p ON s.customerId = p.id
  WHERE p.name LIKE '%Vitor Hugo%' AND s.saleType = 'A_PRAZO'
  ORDER BY s.saleDate
`);

console.log('\n=== VENDAS A_PRAZO ===');
let totalVendas = 0;
sales.forEach(s => {
  const valor = parseFloat(s.finalAmount);
  totalVendas += valor;
  console.log(`Venda #${s.id} - ${s.saleDate.toISOString().slice(0,16).replace('T', ' ')} - R$ ${valor.toFixed(2)}`);
});
console.log(`\nTOTAL VENDAS: R$ ${totalVendas.toFixed(2)}`);

// Buscar pagamentos
const [payments] = await connection.execute(`
  SELECT cp.id, cp.paidDate, cp.paidAmount, cp.paymentMethod
  FROM customerPayments cp
  JOIN partners p ON cp.customerId = p.id
  WHERE p.name LIKE '%Vitor Hugo%'
  ORDER BY cp.paidDate
`);

console.log('\n=== PAGAMENTOS ===');
let totalPagamentos = 0;
payments.forEach(p => {
  const valor = parseFloat(p.paidAmount);
  totalPagamentos += valor;
  console.log(`Pagamento #${p.id} - ${p.paidDate.toISOString().slice(0,16).replace('T', ' ')} - R$ ${valor.toFixed(2)} (${p.paymentMethod})`);
});
console.log(`\nTOTAL PAGAMENTOS: R$ ${totalPagamentos.toFixed(2)}`);

console.log(`\n=== SALDO ===`);
console.log(`Vendas: R$ ${totalVendas.toFixed(2)}`);
console.log(`Pagamentos: R$ ${totalPagamentos.toFixed(2)}`);
console.log(`SALDO DEVEDOR: R$ ${(totalVendas - totalPagamentos).toFixed(2)}`);

await connection.end();
