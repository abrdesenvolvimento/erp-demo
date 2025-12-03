import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // Buscar todas as vendas do Josivan
  const [sales] = await connection.execute(
    `SELECT s.id, s.saleDate, s.customerId, s.subtotal, s.finalAmount, s.createdAt 
     FROM sales s 
     WHERE s.customerId = 270011 
     ORDER BY s.id DESC`
  );
  
  console.log('Total de vendas do Josivan:', sales.length);
  console.log('\nDetalhes das vendas:');
  
  let totalAmount = 0;
  sales.forEach((sale, idx) => {
    console.log(`${idx + 1}. ID: ${sale.id} | Data: ${sale.saleDate} | Valor: R$ ${parseFloat(sale.finalAmount).toFixed(2)} | Criado em: ${sale.createdAt}`);
    totalAmount += parseFloat(sale.finalAmount);
  });
  
  console.log(`\nTotal geral: R$ ${totalAmount.toFixed(2)}`);
  
  // Verificar se há vendas duplicadas (mesmo valor, mesma data)
  const [duplicates] = await connection.execute(
    `SELECT saleDate, finalAmount, COUNT(*) as count 
     FROM sales 
     WHERE customerId = 270011 
     GROUP BY saleDate, finalAmount 
     HAVING count > 1`
  );
  
  if (duplicates.length > 0) {
    console.log('\n⚠️ DUPLICATAS ENCONTRADAS:');
    duplicates.forEach(dup => {
      console.log(`Data: ${dup.saleDate} | Valor: R$ ${parseFloat(dup.finalAmount).toFixed(2)} | Quantidade: ${dup.count}`);
    });
  } else {
    console.log('\n✓ Nenhuma duplicata exata encontrada');
  }
  
} catch (error) {
  console.error('Erro:', error.message);
} finally {
  await connection.end();
}
