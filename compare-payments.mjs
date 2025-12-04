import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar pagamentos ANTIGOS (receivablePayments)
const [oldPayments] = await connection.execute(`
  SELECT rp.id, rp.paidDate, rp.paidAmount, rp.paymentMethod
  FROM receivablePayments rp
  JOIN partners p ON rp.customerId = p.id
  WHERE p.name LIKE '%Vitor Hugo%'
  ORDER BY rp.paidDate
`);

console.log('\n=== PAGAMENTOS ANTIGOS (receivablePayments) ===');
let totalAntigo = 0;
oldPayments.forEach(p => {
  const valor = parseFloat(p.paidAmount);
  totalAntigo += valor;
  console.log(`#${p.id} - ${p.paidDate.toISOString().slice(0,16).replace('T', ' ')} - R$ ${valor.toFixed(2)} (${p.paymentMethod})`);
});
console.log(`TOTAL ANTIGO: R$ ${totalAntigo.toFixed(2)}`);

// Buscar pagamentos NOVOS (customerPayments)
const [newPayments] = await connection.execute(`
  SELECT cp.id, cp.paidDate, cp.paidAmount, cp.paymentMethod
  FROM customerPayments cp
  JOIN partners p ON cp.customerId = p.id
  WHERE p.name LIKE '%Vitor Hugo%'
  ORDER BY cp.paidDate
`);

console.log('\n=== PAGAMENTOS NOVOS (customerPayments) ===');
let totalNovo = 0;
newPayments.forEach(p => {
  const valor = parseFloat(p.paidAmount);
  totalNovo += valor;
  console.log(`#${p.id} - ${p.paidDate.toISOString().slice(0,16).replace('T', ' ')} - R$ ${valor.toFixed(2)} (${p.paymentMethod})`);
});
console.log(`TOTAL NOVO: R$ ${totalNovo.toFixed(2)}`);

console.log(`\n=== RESUMO ===`);
console.log(`Pagamentos antigos: R$ ${totalAntigo.toFixed(2)}`);
console.log(`Pagamentos novos: R$ ${totalNovo.toFixed(2)}`);
console.log(`DIFERENÇA: R$ ${(totalAntigo - totalNovo).toFixed(2)}`);

await connection.end();
