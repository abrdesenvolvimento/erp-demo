import { drizzle } from "drizzle-orm/mysql2";
import { purchaseOrders } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const testData = {
  supplierId: 30001,
  docType: "NOTA_FISCAL",
  docNumber: "999888",
  accessKey: "35251000063960000796552000005413761339333010",
  issueDate: new Date("2025-10-20"),
  postingDate: new Date("2025-10-20"),
  totalAmount: "85.00",
  freightCost: "0.00",
  chargesCost: "0.00",
  paymentMethod: "Boleto",
  status: "DRAFT",
  notes: null,
  invoiceFilePath: null,
  createdBy: "3sp2FmLhkenyjqMFmfLoex",
};

console.log("Tentando inserir:", JSON.stringify(testData, null, 2));

try {
  const result = await db.insert(purchaseOrders).values(testData);
  console.log("Sucesso!", result);
} catch (error) {
  console.error("Erro:", error.message);
  console.error("SQL:", error.sql);
  console.error("Stack:", error.stack);
}

process.exit(0);

