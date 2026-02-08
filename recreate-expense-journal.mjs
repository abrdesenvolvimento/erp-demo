import { drizzle } from "drizzle-orm/mysql2";
import { accountExpenseCreation } from "./server/db.ts";

const db = drizzle(process.env.DATABASE_URL);

// Dados da despesa de impostos
const expenseId = 1230001;
const amount = "2667.87";
const managementAccountId = 2130001;
const description = "Imposto sobre faturamento do mês anterior";
const entryDate = new Date("2026-01-31");

console.log("[Recreate Journal] Criando journal para despesa #" + expenseId);
console.log("[Recreate Journal] Valor:", amount);
console.log("[Recreate Journal] Conta Gerencial:", managementAccountId);
console.log("[Recreate Journal] Data de Entrada:", entryDate);
console.log("[Recreate Journal] Competência:", entryDate.toISOString().slice(0, 7));

try {
  const result = await accountExpenseCreation({
    expenseId,
    amount,
    managementAccountId,
    description,
    entryDate,
    createdBy: "system",
  });
  
  if (result.success) {
    console.log("[Recreate Journal] ✅ Journal criado com sucesso! ID:", result.journalId);
  } else {
    console.error("[Recreate Journal] ❌ Erro:", result.error);
  }
} catch (error) {
  console.error("[Recreate Journal] ❌ Exceção:", error.message);
}

process.exit(0);
