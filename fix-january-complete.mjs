import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

async function main() {
  console.log("=== CORREÇÃO COMPLETA DE JANEIRO/2026 ===\n");
  console.log("Início:", new Date().toISOString());

  // ============================================================
  // PASSO 1: Corrigir valor de Outras Receitas #30002
  // ============================================================
  console.log("\n--- PASSO 1: Corrigir valor de Outras Receitas #30002 ---");
  await db.execute(sql`
    UPDATE otherRevenues SET amount = '121480.34' WHERE id = 30002
  `);
  console.log("✅ Valor corrigido: R$ 12.148.034,00 → R$ 121.480,34");

  // ============================================================
  // PASSO 2: Deletar TODOS os journals de janeiro (limpar tudo)
  // ============================================================
  console.log("\n--- PASSO 2: Deletar TODOS os journals de janeiro ---");
  
  // Buscar IDs dos journals de janeiro
  const janJournals = await db.execute(sql`
    SELECT id FROM journals WHERE competenceMonth = '2026-01'
  `);
  const journalIds = janJournals[0].map(r => r.id);
  console.log(`   Journals encontrados: ${journalIds.length}`);

  if (journalIds.length > 0) {
    // Deletar em lotes de 500
    for (let i = 0; i < journalIds.length; i += 500) {
      const batch = journalIds.slice(i, i + 500);
      const idList = batch.join(',');
      
      await db.execute(sql.raw(`DELETE FROM accountingEntries WHERE journalId IN (${idList})`));
      await db.execute(sql.raw(`DELETE FROM journalSources WHERE journalId IN (${idList})`));
      await db.execute(sql.raw(`DELETE FROM journals WHERE id IN (${idList})`));
      
      console.log(`   Deletados ${Math.min(i + 500, journalIds.length)}/${journalIds.length} journals`);
    }
  }
  console.log("✅ Todos os journals de janeiro deletados");

  // ============================================================
  // PASSO 3: Reprocessar VENDAS com timezone BR (UTC-3)
  // ============================================================
  console.log("\n--- PASSO 3: Reprocessar VENDAS de janeiro (timezone BR) ---");
  
  // Buscar vendas de janeiro usando timezone BR
  // Janeiro BR = 01/01/2026 00:00 BR = 01/01/2026 03:00 UTC
  // Fevereiro BR = 01/02/2026 00:00 BR = 01/02/2026 03:00 UTC
  const salesResult = await db.execute(sql`
    SELECT id, saleType, finalAmount, saleDate, status
    FROM sales 
    WHERE saleDate >= '2026-01-01 03:00:00' 
      AND saleDate < '2026-02-01 03:00:00'
      AND status != 'CANCELADA'
    ORDER BY id
  `);
  
  const sales = salesResult[0];
  console.log(`   Vendas de janeiro (timezone BR): ${sales.length}`);
  
  // Importar funções necessárias
  const { reprocessSaleAccounting } = await import("./server/db.ts");
  
  let salesProcessed = 0;
  let salesErrors = 0;
  let salesByType = { BALCAO: 0, DELIVERY: 0, A_PRAZO: 0 };
  let salesAmountByType = { BALCAO: 0, DELIVERY: 0, A_PRAZO: 0 };
  
  for (const sale of sales) {
    try {
      await reprocessSaleAccounting(sale.id);
      salesProcessed++;
      salesByType[sale.saleType] = (salesByType[sale.saleType] || 0) + 1;
      salesAmountByType[sale.saleType] = (salesAmountByType[sale.saleType] || 0) + parseFloat(sale.finalAmount);
      
      if (salesProcessed % 200 === 0) {
        console.log(`   Processadas ${salesProcessed}/${sales.length} vendas...`);
      }
    } catch (err) {
      salesErrors++;
      if (salesErrors <= 5) {
        console.log(`   ⚠️ Erro venda #${sale.id}: ${err.message}`);
      }
    }
  }
  
  console.log(`✅ Vendas processadas: ${salesProcessed} (erros: ${salesErrors})`);
  for (const [type, count] of Object.entries(salesByType)) {
    console.log(`   ${type}: ${count} vendas | R$ ${salesAmountByType[type].toFixed(2)}`);
  }

  // ============================================================
  // PASSO 4: Reprocessar DESPESAS de janeiro
  // ============================================================
  console.log("\n--- PASSO 4: Reprocessar DESPESAS de janeiro ---");
  
  const { reprocessExpenseAccounting } = await import("./server/db.ts");
  
  const expensesResult = await db.execute(sql`
    SELECT id, description, amount, competenceMonth, status
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
      await reprocessExpenseAccounting(expense.id);
      expensesProcessed++;
      expensesTotal += parseFloat(expense.amount);
    } catch (err) {
      expensesErrors++;
      console.log(`   ⚠️ Erro despesa #${expense.id} (${expense.description}): ${err.message}`);
    }
  }
  
  console.log(`✅ Despesas processadas: ${expensesProcessed} (erros: ${expensesErrors})`);
  console.log(`   Total: R$ ${expensesTotal.toFixed(2)}`);

  // ============================================================
  // PASSO 5: Reprocessar OUTRAS RECEITAS de janeiro
  // ============================================================
  console.log("\n--- PASSO 5: Reprocessar OUTRAS RECEITAS de janeiro ---");
  
  // Buscar função de contabilização de outras receitas
  let otherRevenuesProcessed = 0;
  try {
    const { accountOtherRevenue } = await import("./server/db.ts");
    
    const otherRevsResult = await db.execute(sql`
      SELECT id, description, amount, competenceMonth
      FROM otherRevenues
      WHERE competenceMonth = '2026-01'
        AND status = 'ACTIVE'
      ORDER BY id
    `);
    
    const otherRevs = otherRevsResult[0];
    console.log(`   Outras Receitas de janeiro: ${otherRevs.length}`);
    
    for (const rev of otherRevs) {
      try {
        // Buscar dados completos para contabilizar
        const fullRev = await db.execute(sql`
          SELECT or2.*, ma.chartAccountId
          FROM otherRevenues or2
          LEFT JOIN managementAccounts ma ON or2.managementAccountId = ma.id
          WHERE or2.id = ${rev.id}
        `);
        
        if (fullRev[0].length > 0) {
          const r = fullRev[0][0];
          const chartAccountId = r.chartAccountId;
          
          if (chartAccountId) {
            // Buscar código da conta contábil
            const chartAcc = await db.execute(sql`
              SELECT id, code, name FROM chartOfAccounts WHERE id = ${chartAccountId}
            `);
            
            if (chartAcc[0].length > 0) {
              const acc = chartAcc[0][0];
              console.log(`   Processando #${rev.id}: ${rev.description} | R$ ${parseFloat(rev.amount).toFixed(2)} → Conta ${acc.code} (${acc.name})`);
              
              // Criar journal manualmente
              const journalResult = await db.execute(sql`
                INSERT INTO journals (description, entryDate, competenceMonth, status, createdBy)
                VALUES (
                  ${`Outra Receita: ${rev.description}`},
                  ${r.revenueDate || new Date()},
                  '2026-01',
                  'DRAFT',
                  'system-reprocess'
                )
              `);
              
              const journalId = journalResult[0].insertId;
              
              // Buscar conta Caixa Geral (1.1.1.01)
              const caixaAcc = await db.execute(sql`
                SELECT id FROM chartOfAccounts WHERE code = '1.1.1.01'
              `);
              const caixaId = caixaAcc[0][0]?.id;
              
              if (caixaId) {
                // D - Caixa / C - Receita
                await db.execute(sql`
                  INSERT INTO accountingEntries (journalId, accountId, entryType, amount, description)
                  VALUES 
                    (${journalId}, ${caixaId}, 'D', ${rev.amount}, ${`Outra Receita: ${rev.description}`}),
                    (${journalId}, ${chartAccountId}, 'C', ${rev.amount}, ${`Outra Receita: ${rev.description}`})
                `);
                
                // Adicionar source
                await db.execute(sql`
                  INSERT INTO journalSources (journalId, sourceType, sourceId)
                  VALUES (${journalId}, 'otherRevenue', ${rev.id})
                `);
                
                otherRevenuesProcessed++;
                console.log(`   ✅ Journal #${journalId} criado para Outra Receita #${rev.id}`);
              }
            }
          }
        }
      } catch (err) {
        console.log(`   ⚠️ Erro outra receita #${rev.id}: ${err.message}`);
      }
    }
  } catch (err) {
    console.log(`   ⚠️ Erro ao importar accountOtherRevenue: ${err.message}`);
    console.log("   Tentando criar journals manualmente...");
  }
  
  console.log(`✅ Outras Receitas processadas: ${otherRevenuesProcessed}`);

  // ============================================================
  // PASSO 6: Contabilizar TODOS os DRAFT de janeiro (DRAFT → POSTED)
  // ============================================================
  console.log("\n--- PASSO 6: Contabilizar DRAFT → POSTED ---");
  
  const draftCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM journals WHERE competenceMonth = '2026-01' AND status = 'DRAFT'
  `);
  console.log(`   Journals DRAFT para contabilizar: ${draftCount[0][0].cnt}`);
  
  await db.execute(sql`
    UPDATE journals SET status = 'POSTED' WHERE competenceMonth = '2026-01' AND status = 'DRAFT'
  `);
  
  const postedCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM journals WHERE competenceMonth = '2026-01' AND status = 'POSTED'
  `);
  console.log(`✅ Journals POSTED total: ${postedCount[0][0].cnt}`);

  // ============================================================
  // PASSO 7: Validação final
  // ============================================================
  console.log("\n--- PASSO 7: Validação final ---");
  
  // Receitas por conta
  const revenueCheck = await db.execute(sql`
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
  for (const row of revenueCheck[0]) {
    console.log(`   ${row.code} - ${row.name} (${row.entryType}): ${row.qty} entries | R$ ${parseFloat(row.total).toFixed(2)}`);
  }
  
  // Despesas por conta
  const expenseCheck = await db.execute(sql`
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
  for (const row of expenseCheck[0]) {
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

  console.log("\n=== CORREÇÃO COMPLETA ===");
  console.log("Fim:", new Date().toISOString());
  process.exit(0);
}

main().catch((err) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
