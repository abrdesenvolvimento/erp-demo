import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL);

async function main() {
  console.log("=== CORREÇÃO DESPESAS E OUTRAS RECEITAS JAN/2026 ===\n");

  // ============================================================
  // PASSO 1: Reprocessar DESPESAS de janeiro
  // ============================================================
  console.log("--- PASSO 1: Reprocessar DESPESAS de janeiro ---");
  
  const { reprocessExpenseAccounting } = await import("./server/db.ts");
  
  const expensesResult = await db.execute(sql`
    SELECT id, description, amount, competenceMonth, status, managementAccountId
    FROM expenses
    WHERE competenceMonth = '2026-01'
      AND status = 'ATIVA'
    ORDER BY id
  `);
  
  const expenses = expensesResult[0];
  console.log(`   Despesas de janeiro (ativas): ${expenses.length}`);
  
  let expensesProcessed = 0;
  let expensesErrors = 0;
  let expensesTotal = 0;
  
  for (const expense of expenses) {
    try {
      const result = await reprocessExpenseAccounting(expense.id);
      if (result.success) {
        expensesProcessed++;
        expensesTotal += parseFloat(expense.amount);
        console.log(`   ✅ Despesa #${expense.id}: ${expense.description} | R$ ${parseFloat(expense.amount).toFixed(2)}`);
      } else {
        expensesErrors++;
        console.log(`   ❌ Despesa #${expense.id}: ${expense.description} | Erro: ${result.error}`);
      }
    } catch (err) {
      expensesErrors++;
      console.log(`   ❌ Despesa #${expense.id}: ${expense.description} | Erro: ${err.message}`);
    }
  }
  
  console.log(`\n✅ Despesas processadas: ${expensesProcessed} (erros: ${expensesErrors})`);
  console.log(`   Total: R$ ${expensesTotal.toFixed(2)}`);

  // ============================================================
  // PASSO 2: Reprocessar OUTRAS RECEITAS de janeiro
  // ============================================================
  console.log("\n--- PASSO 2: Reprocessar OUTRAS RECEITAS de janeiro ---");
  
  // Buscar dados completos da outra receita
  const otherRevsResult = await db.execute(sql`
    SELECT or2.id, or2.description, or2.amount, or2.revenueDate, or2.competenceMonth,
           or2.managementAccountId, ma.chartAccountId
    FROM otherRevenues or2
    LEFT JOIN managementAccounts ma ON or2.managementAccountId = ma.id
    WHERE or2.competenceMonth = '2026-01'
      AND or2.status = 'ACTIVE'
  `);
  
  const otherRevs = otherRevsResult[0];
  console.log(`   Outras Receitas de janeiro: ${otherRevs.length}`);
  
  for (const rev of otherRevs) {
    console.log(`   ID: ${rev.id} | ${rev.description} | R$ ${parseFloat(rev.amount).toFixed(2)}`);
    console.log(`   managementAccountId: ${rev.managementAccountId} | chartAccountId: ${rev.chartAccountId}`);
    
    if (!rev.chartAccountId) {
      console.log(`   ⚠️ Sem amarração contábil! Buscando conta 4.2.1.03...`);
      // Buscar conta 4.2.1.03 diretamente
      const accResult = await db.execute(sql`
        SELECT id FROM chartOfAccounts WHERE code = '4.2.1.03'
      `);
      if (accResult[0].length > 0) {
        rev.chartAccountId = accResult[0][0].id;
        console.log(`   ✅ Usando conta 4.2.1.03 (id: ${rev.chartAccountId})`);
      }
    }
    
    if (rev.chartAccountId) {
      // Buscar conta Caixa Geral (1.1.1.01)
      const caixaAcc = await db.execute(sql`
        SELECT id FROM chartOfAccounts WHERE code = '1.1.1.01'
      `);
      const caixaId = caixaAcc[0][0]?.id;
      
      if (caixaId) {
        // Criar journal
        const journalResult = await db.execute(sql`
          INSERT INTO journals (description, entryDate, competenceMonth, status, createdBy)
          VALUES (
            ${`Outra Receita: ${rev.description}`},
            ${rev.revenueDate || '2026-01-30'},
            '2026-01',
            'DRAFT',
            'system-reprocess'
          )
        `);
        
        const journalId = journalResult[0].insertId;
        
        // D - Caixa / C - Receita
        await db.execute(sql`
          INSERT INTO accountingEntries (journalId, accountId, entryType, amount, description)
          VALUES 
            (${journalId}, ${caixaId}, 'D', ${rev.amount}, ${`Outra Receita: ${rev.description}`}),
            (${journalId}, ${rev.chartAccountId}, 'C', ${rev.amount}, ${`Outra Receita: ${rev.description}`})
        `);
        
        // Adicionar source
        await db.execute(sql`
          INSERT INTO journalSources (journalId, sourceType, sourceId)
          VALUES (${journalId}, 'otherRevenue', ${rev.id})
        `);
        
        console.log(`   ✅ Journal #${journalId} criado | R$ ${parseFloat(rev.amount).toFixed(2)}`);
      }
    }
  }

  // ============================================================
  // PASSO 3: Contabilizar DRAFT → POSTED
  // ============================================================
  console.log("\n--- PASSO 3: Contabilizar DRAFT → POSTED ---");
  
  const draftCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM journals WHERE competenceMonth = '2026-01' AND status = 'DRAFT'
  `);
  console.log(`   Journals DRAFT para contabilizar: ${draftCount[0][0].cnt}`);
  
  await db.execute(sql`
    UPDATE journals SET status = 'POSTED' WHERE competenceMonth = '2026-01' AND status = 'DRAFT'
  `);
  
  console.log("✅ Todos os DRAFT contabilizados");

  // ============================================================
  // PASSO 4: Validação final completa
  // ============================================================
  console.log("\n--- PASSO 4: Validação final ---");
  
  // Receitas
  const recCheck = await db.execute(sql`
    SELECT ca.code, ca.name, ae.entryType,
      COUNT(*) as qty,
      SUM(CAST(ae.amount AS DECIMAL(15,2))) as total
    FROM accountingEntries ae
    JOIN journals j ON ae.journalId = j.id
    JOIN chartOfAccounts ca ON ae.accountId = ca.id
    WHERE j.status = 'POSTED'
      AND j.competenceMonth = '2026-01'
      AND ca.code LIKE '4%'
    GROUP BY ca.code, ca.name, ae.entryType
    ORDER BY ca.code
  `);
  
  console.log("\n   RECEITAS POSTED:");
  for (const row of recCheck[0]) {
    console.log(`   ${row.code} - ${row.name} (${row.entryType}): ${row.qty} entries | R$ ${parseFloat(row.total).toFixed(2)}`);
  }
  
  // Despesas
  const despCheck = await db.execute(sql`
    SELECT ca.code, ca.name, ae.entryType,
      COUNT(*) as qty,
      SUM(CAST(ae.amount AS DECIMAL(15,2))) as total
    FROM accountingEntries ae
    JOIN journals j ON ae.journalId = j.id
    JOIN chartOfAccounts ca ON ae.accountId = ca.id
    WHERE j.status = 'POSTED'
      AND j.competenceMonth = '2026-01'
      AND ca.code LIKE '6%'
    GROUP BY ca.code, ca.name, ae.entryType
    ORDER BY ca.code
  `);
  
  console.log("\n   DESPESAS POSTED:");
  for (const row of despCheck[0]) {
    console.log(`   ${row.code} - ${row.name} (${row.entryType}): ${row.qty} entries | R$ ${parseFloat(row.total).toFixed(2)}`);
  }
  
  // CMV
  const cmvCheck = await db.execute(sql`
    SELECT ca.code, ca.name, ae.entryType,
      COUNT(*) as qty,
      SUM(CAST(ae.amount AS DECIMAL(15,2))) as total
    FROM accountingEntries ae
    JOIN journals j ON ae.journalId = j.id
    JOIN chartOfAccounts ca ON ae.accountId = ca.id
    WHERE j.status = 'POSTED'
      AND j.competenceMonth = '2026-01'
      AND ca.code LIKE '5%'
    GROUP BY ca.code, ca.name, ae.entryType
    ORDER BY ca.code
  `);
  
  console.log("\n   CMV POSTED:");
  for (const row of cmvCheck[0]) {
    console.log(`   ${row.code} - ${row.name} (${row.entryType}): ${row.qty} entries | R$ ${parseFloat(row.total).toFixed(2)}`);
  }

  // Resumo total
  const totalCheck = await db.execute(sql`
    SELECT j.status, COUNT(*) as cnt
    FROM journals j
    WHERE j.competenceMonth = '2026-01'
    GROUP BY j.status
  `);
  
  console.log("\n   RESUMO JOURNALS JANEIRO:");
  for (const row of totalCheck[0]) {
    console.log(`   ${row.status}: ${row.cnt}`);
  }

  console.log("\n=== CORREÇÃO COMPLETA ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
