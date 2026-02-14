import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, sql } from "drizzle-orm";
import {
  sales,
  saleItems,
  products,
  journals,
  accountingEntries,
  journalSources,
  chartOfAccounts,
} from "./drizzle/schema.ts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

// Códigos contábeis
const ACCOUNTING_CODES = {
  CAIXA_GERAL: "1.1.1.01",
  CLIENTES_A_PRAZO: "1.1.2.01",
  ESTOQUE_MERCADORIAS: "1.1.3.01",
  CMV: "5.1.1.01",
  RECEITA_VENDAS_BALCAO: "4.1.1.01",
  RECEITA_VENDAS_A_PRAZO: "4.1.1.02",
  RECEITA_VENDAS_DELIVERY: "4.1.1.03",
};

// Cache de IDs de contas
const accountIdCache = {};

async function getAccountIdByCode(code) {
  if (accountIdCache[code]) return accountIdCache[code];
  const result = await db
    .select({ id: chartOfAccounts.id })
    .from(chartOfAccounts)
    .where(eq(chartOfAccounts.code, code))
    .limit(1);
  if (result.length > 0) {
    accountIdCache[code] = result[0].id;
    return result[0].id;
  }
  return null;
}

async function main() {
  console.log("=== REPROCESSAMENTO DE JANEIRO/2026 ===\n");
  const startTime = Date.now();

  // 1. Buscar todas as vendas de janeiro
  console.log("1. Buscando vendas de janeiro/2026...");
  const allSales = await db.select().from(sales);
  const januarySales = allSales.filter((s) => {
    const d = new Date(s.saleDate);
    return d.getFullYear() === 2026 && d.getMonth() === 0; // Janeiro = 0
  });
  console.log(`   Total de vendas no banco: ${allSales.length}`);
  console.log(`   Vendas de janeiro: ${januarySales.length}\n`);

  if (januarySales.length === 0) {
    console.log("Nenhuma venda de janeiro encontrada.");
    process.exit(0);
  }

  // 2. Processar cada venda
  console.log("2. Criando journals para cada venda...");
  let successCount = 0;
  let errorCount = 0;
  let journalIds = [];

  for (let i = 0; i < januarySales.length; i++) {
    const sale = januarySales[i];

    try {
      // Buscar itens da venda para calcular CMV
      const items = await db
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, sale.id));

      let cmvTotal = 0;
      for (const item of items) {
        const product = await db
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);
        if (product.length > 0) {
          const avgCost = parseFloat(product[0].avgCost || "0");
          cmvTotal += avgCost * parseFloat(item.quantity);
        }
      }

      // Determinar contas
      let debitAccount, creditAccount;
      switch (sale.saleType) {
        case "BALCAO":
          debitAccount = ACCOUNTING_CODES.CAIXA_GERAL;
          creditAccount = ACCOUNTING_CODES.RECEITA_VENDAS_BALCAO;
          break;
        case "DELIVERY":
          debitAccount = ACCOUNTING_CODES.CAIXA_GERAL;
          creditAccount = ACCOUNTING_CODES.RECEITA_VENDAS_DELIVERY;
          break;
        case "A_PRAZO":
          debitAccount = ACCOUNTING_CODES.CLIENTES_A_PRAZO;
          creditAccount = ACCOUNTING_CODES.RECEITA_VENDAS_A_PRAZO;
          break;
        default:
          debitAccount = ACCOUNTING_CODES.CAIXA_GERAL;
          creditAccount = ACCOUNTING_CODES.RECEITA_VENDAS_BALCAO;
      }

      const entryDate = new Date(sale.saleDate);
      const competenceMonth = entryDate.toISOString().slice(0, 7);
      const totalAmount = sale.finalAmount;

      // Criar journal
      const [journalResult] = await db.insert(journals).values({
        companyId: 1,
        competenceMonth,
        description: `Venda #${sale.id}${sale.customerName ? ` - ${sale.customerName}` : ""}`,
        status: "DRAFT",
        totalDebit: "0.00",
        totalCredit: "0.00",
        createdBy: sale.createdBy || "system",
      });

      const journalId = journalResult.insertId;

      // Entries de receita
      const debitAccountId = await getAccountIdByCode(debitAccount);
      const creditAccountId = await getAccountIdByCode(creditAccount);

      if (debitAccountId) {
        await db.insert(accountingEntries).values({
          companyId: 1,
          journalId,
          accountId: debitAccountId,
          entryDate,
          competenceMonth,
          amount: totalAmount,
          entryType: "D",
          description: `Venda #${sale.id}${sale.customerName ? ` - ${sale.customerName}` : ""}`,
          sourceType: "sale",
          sourceId: sale.id,
        });
      }

      if (creditAccountId) {
        await db.insert(accountingEntries).values({
          companyId: 1,
          journalId,
          accountId: creditAccountId,
          entryDate,
          competenceMonth,
          amount: totalAmount,
          entryType: "C",
          description: `Receita venda #${sale.id}`,
          sourceType: "sale",
          sourceId: sale.id,
        });
      }

      // CMV entries
      if (cmvTotal > 0) {
        const cmvAccountId = await getAccountIdByCode(ACCOUNTING_CODES.CMV);
        const estoqueAccountId = await getAccountIdByCode(
          ACCOUNTING_CODES.ESTOQUE_MERCADORIAS
        );

        if (cmvAccountId) {
          await db.insert(accountingEntries).values({
            companyId: 1,
            journalId,
            accountId: cmvAccountId,
            entryDate,
            competenceMonth,
            amount: cmvTotal.toFixed(2),
            entryType: "D",
            description: `CMV venda #${sale.id}`,
            sourceType: "sale",
            sourceId: sale.id,
          });
        }

        if (estoqueAccountId) {
          await db.insert(accountingEntries).values({
            companyId: 1,
            journalId,
            accountId: estoqueAccountId,
            entryDate,
            competenceMonth,
            amount: cmvTotal.toFixed(2),
            entryType: "C",
            description: `Baixa estoque venda #${sale.id}`,
            sourceType: "sale",
            sourceId: sale.id,
          });
        }
      }

      // Journal source
      await db.insert(journalSources).values({
        companyId: 1,
        journalId,
        sourceType: "sale",
        sourceId: sale.id,
      });

      journalIds.push(journalId);
      successCount++;
    } catch (error) {
      errorCount++;
      if (errorCount <= 5) {
        console.error(`   Erro venda #${sale.id}: ${error.message}`);
      }
    }

    // Progresso a cada 200 vendas
    if ((i + 1) % 200 === 0) {
      console.log(
        `   Processadas ${i + 1}/${januarySales.length} vendas (${successCount} ok, ${errorCount} erros)`
      );
    }
  }

  console.log(
    `\n   TOTAL: ${successCount} journals criados, ${errorCount} erros\n`
  );

  // 3. Contabilizar todos os journals DRAFT de janeiro (DRAFT → POSTED)
  console.log("3. Contabilizando journals (DRAFT → POSTED)...");

  const draftJournals = await db
    .select({ id: journals.id })
    .from(journals)
    .where(
      and(
        eq(journals.status, "DRAFT"),
        eq(journals.competenceMonth, "2026-01")
      )
    );

  console.log(`   Journals DRAFT a contabilizar: ${draftJournals.length}`);

  let postedCount = 0;
  for (const journal of draftJournals) {
    try {
      // Calcular totais
      const entries = await db
        .select({
          entryType: accountingEntries.entryType,
          amount: accountingEntries.amount,
        })
        .from(accountingEntries)
        .where(eq(accountingEntries.journalId, journal.id));

      let totalDebit = 0;
      let totalCredit = 0;

      for (const entry of entries) {
        const amount = parseFloat(entry.amount);
        if (entry.entryType === "D") {
          totalDebit += amount;
        } else {
          totalCredit += amount;
        }
      }

      // Atualizar journal para POSTED
      await db
        .update(journals)
        .set({
          status: "POSTED",
          totalDebit: totalDebit.toFixed(2),
          totalCredit: totalCredit.toFixed(2),
          postedAt: new Date(),
        })
        .where(eq(journals.id, journal.id));

      postedCount++;
    } catch (error) {
      console.error(`   Erro ao postar journal #${journal.id}: ${error.message}`);
    }

    if (postedCount % 200 === 0 && postedCount > 0) {
      console.log(`   Contabilizados ${postedCount}/${draftJournals.length}...`);
    }
  }

  console.log(`   TOTAL contabilizados: ${postedCount}\n`);

  // 4. Verificação final
  console.log("=== VERIFICAÇÃO FINAL ===");
  const finalStatus = await db
    .select({
      status: journals.status,
      count: sql`COUNT(*)`.as("count"),
    })
    .from(journals)
    .where(eq(journals.competenceMonth, "2026-01"))
    .groupBy(journals.status);

  for (const row of finalStatus) {
    console.log(`   ${row.status}: ${row.count} journals`);
  }

  // Verificar receitas
  const revenueSum = await db
    .select({
      code: chartOfAccounts.code,
      name: chartOfAccounts.name,
      total: sql`SUM(CAST(${accountingEntries.amount} AS DECIMAL(15,2)))`.as("total"),
    })
    .from(accountingEntries)
    .innerJoin(journals, eq(accountingEntries.journalId, journals.id))
    .innerJoin(chartOfAccounts, eq(accountingEntries.accountId, chartOfAccounts.id))
    .where(
      and(
        eq(journals.status, "POSTED"),
        eq(journals.competenceMonth, "2026-01"),
        eq(accountingEntries.entryType, "C"),
        sql`${chartOfAccounts.code} LIKE '4%'`
      )
    )
    .groupBy(chartOfAccounts.code, chartOfAccounts.name);

  console.log("\n=== RECEITAS POSTED DE JANEIRO ===");
  for (const row of revenueSum) {
    console.log(`   ${row.code} - ${row.name}: R$ ${parseFloat(row.total).toFixed(2)}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== CONCLUÍDO em ${elapsed}s ===`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
