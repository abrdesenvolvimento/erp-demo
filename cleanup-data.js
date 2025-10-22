import { getDb } from "./server/db.js";
import { sales, saleItems, partners, receivables, receivableInstallments } from "./drizzle/schema.js";
import { sql, eq } from "drizzle-orm";

async function cleanupData() {
  const db = await getDb();
  console.log("=== LIMPEZA DE DADOS DE TESTE ===\n");
  
  // 1. Remover itens de vendas
  console.log("1. Removendo itens de vendas...");
  const deletedItems = await db.delete(saleItems);
  console.log(`   ✓ ${deletedItems.rowsAffected || 0} itens removidos`);
  
  // 2. Remover vendas
  console.log("2. Removendo vendas...");
  const deletedSales = await db.delete(sales);
  console.log(`   ✓ ${deletedSales.rowsAffected || 0} vendas removidas`);
  
  // 3. Remover parcelas de recebíveis
  console.log("3. Removendo parcelas de recebíveis...");
  const deletedInstallments = await db.delete(receivableInstallments);
  console.log(`   ✓ ${deletedInstallments.rowsAffected || 0} parcelas removidas`);
  
  // 4. Remover recebíveis
  console.log("4. Removendo recebíveis...");
  const deletedReceivables = await db.delete(receivables);
  console.log(`   ✓ ${deletedReceivables.rowsAffected || 0} recebíveis removidos`);
  
  // 5. Remover fornecedores duplicados "Teste"
  console.log("5. Removendo fornecedores 'Teste' duplicados...");
  const testSuppliers = await db.select().from(partners).where(eq(partners.name, 'Teste'));
  for (const supplier of testSuppliers) {
    await db.delete(partners).where(eq(partners.id, supplier.id));
  }
  console.log(`   ✓ ${testSuppliers.length} fornecedores 'Teste' removidos`);
  
  console.log("\n✅ Limpeza concluída com sucesso!");
  process.exit(0);
}

cleanupData().catch(console.error);
