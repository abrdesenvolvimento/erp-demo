import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  journals,
  accountingEntries,
  journalSources,
} from "./drizzle/schema.ts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

async function main() {
  console.log("=== LIMPEZA DE JOURNALS DRAFT DE JANEIRO ===\n");

  // 1. Buscar todos os journals DRAFT de janeiro (sourceType = sale)
  console.log("1. Buscando journals DRAFT de janeiro...");
  const draftJournals = await db
    .select({ id: journals.id })
    .from(journals)
    .where(
      and(
        eq(journals.status, "DRAFT"),
        eq(journals.competenceMonth, "2026-01")
      )
    );

  console.log(`   Encontrados: ${draftJournals.length} journals DRAFT\n`);

  if (draftJournals.length === 0) {
    console.log("Nenhum journal DRAFT encontrado. Nada a fazer.");
    process.exit(0);
  }

  const journalIds = draftJournals.map((j) => j.id);

  // Processar em lotes de 500 para evitar query muito grande
  const BATCH_SIZE = 500;
  let totalEntries = 0;
  let totalSources = 0;

  for (let i = 0; i < journalIds.length; i += BATCH_SIZE) {
    const batch = journalIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(journalIds.length / BATCH_SIZE);

    console.log(`   Lote ${batchNum}/${totalBatches} (${batch.length} journals)...`);

    // 2. Deletar accountingEntries dos journals DRAFT
    const entriesResult = await db
      .delete(accountingEntries)
      .where(inArray(accountingEntries.journalId, batch));
    
    // 3. Deletar journalSources dos journals DRAFT
    const sourcesResult = await db
      .delete(journalSources)
      .where(inArray(journalSources.journalId, batch));

    // 4. Deletar os journals DRAFT
    const journalsResult = await db
      .delete(journals)
      .where(inArray(journals.id, batch));

    console.log(`   Lote ${batchNum} concluído.`);
  }

  console.log(`\n=== LIMPEZA CONCLUÍDA ===`);
  console.log(`   Journals DRAFT deletados: ${journalIds.length}`);

  // 5. Verificar estado final
  console.log("\n=== VERIFICAÇÃO FINAL ===");
  const remaining = await db
    .select({
      status: journals.status,
      count: sql`COUNT(*)`.as("count"),
    })
    .from(journals)
    .where(eq(journals.competenceMonth, "2026-01"))
    .groupBy(journals.status);

  for (const row of remaining) {
    console.log(`   ${row.status}: ${row.count} journals`);
  }

  if (remaining.length === 0) {
    console.log("   Nenhum journal restante para janeiro/2026");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
