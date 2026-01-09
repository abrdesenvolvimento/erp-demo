import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, sql } from "drizzle-orm";
import { sales, partners, customerPayments } from "./drizzle/schema";

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);
  
  // Buscar cliente Victor Hugo
  const customers = await db.select().from(partners).where(sql`name LIKE '%Victor Hugo%'`);
  console.log('Cliente:', customers[0]?.name, 'ID:', customers[0]?.id);
  const customerId = customers[0]?.id;
  
  if (!customerId) {
    console.log('Cliente não encontrado');
    return;
  }
  
  // Buscar vendas ATIVAS A_PRAZO
  const salesData = await db.select({
    id: sales.id,
    saleDate: sales.saleDate,
    finalAmount: sales.finalAmount,
    status: sales.status
  })
  .from(sales)
  .where(and(
    eq(sales.customerId, customerId),
    eq(sales.saleType, "A_PRAZO"),
    eq(sales.status, "ACTIVE")
  ))
  .orderBy(sales.saleDate);
  
  console.log('\n=== VENDAS ATIVAS ===');
  let totalVendas = 0;
  for (const sale of salesData) {
    const valor = parseFloat(sale.finalAmount);
    console.log(`Venda #${sale.id} - ${sale.saleDate?.toLocaleString('pt-BR')} - R$ ${valor.toFixed(2)}`);
    totalVendas += valor;
  }
  console.log(`Total vendas: R$ ${totalVendas.toFixed(2)} (${salesData.length} vendas)`);
  
  // Buscar pagamentos
  const paymentsData = await db.select({
    id: customerPayments.id,
    paidDate: customerPayments.paidDate,
    paidAmount: customerPayments.paidAmount
  })
  .from(customerPayments)
  .where(eq(customerPayments.customerId, customerId))
  .orderBy(customerPayments.paidDate);
  
  console.log('\n=== PAGAMENTOS ===');
  let totalPagamentos = 0;
  for (const payment of paymentsData) {
    const valor = parseFloat(payment.paidAmount);
    console.log(`Pagamento #${payment.id} - ${payment.paidDate?.toLocaleString('pt-BR')} - R$ ${valor.toFixed(2)}`);
    totalPagamentos += valor;
  }
  console.log(`Total pagamentos: R$ ${totalPagamentos.toFixed(2)} (${paymentsData.length} pagamentos)`);
  
  console.log('\n=== SALDO ===');
  console.log(`Saldo devedor: R$ ${(totalVendas - totalPagamentos).toFixed(2)}`);
  
  process.exit(0);
}

main().catch(console.error);
