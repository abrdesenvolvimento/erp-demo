import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

async function main() {
  console.log("=== INVESTIGAÇÃO DE DIVERGÊNCIAS - JANEIRO/2026 ===\n");

  // 1. Vendas por canal (usando timezone BR: UTC-3)
  console.log("1. VENDAS POR CANAL (Janeiro/2026 - timezone BR):");
  const salesByChannel = await db.execute(sql`
    SELECT 
      saleType,
      COUNT(*) as qty,
      SUM(CAST(finalAmount AS DECIMAL(15,2))) as total,
      SUM(CASE WHEN status = 'CANCELADA' THEN 1 ELSE 0 END) as cancelled_count,
      SUM(CASE WHEN status = 'CANCELADA' THEN CAST(finalAmount AS DECIMAL(15,2)) ELSE 0 END) as cancelled_total,
      SUM(CASE WHEN status != 'CANCELADA' THEN CAST(finalAmount AS DECIMAL(15,2)) ELSE 0 END) as active_total
    FROM sales 
    WHERE saleDate >= '2026-01-01 03:00:00' 
      AND saleDate < '2026-02-01 03:00:00'
    GROUP BY saleType
    ORDER BY saleType
  `);
  
  let totalVendas = 0;
  let totalAtivo = 0;
  for (const row of salesByChannel[0]) {
    console.log(`   ${row.saleType}: ${row.qty} vendas | Total: R$ ${parseFloat(row.total).toFixed(2)} | Canceladas: ${row.cancelled_count} (R$ ${parseFloat(row.cancelled_total).toFixed(2)}) | Ativo: R$ ${parseFloat(row.active_total).toFixed(2)}`);
    totalVendas += parseFloat(row.total);
    totalAtivo += parseFloat(row.active_total);
  }
  console.log(`   TOTAL: R$ ${totalVendas.toFixed(2)} | ATIVO: R$ ${totalAtivo.toFixed(2)}\n`);

  // 1b. Vendas SEM timezone (UTC puro)
  console.log("1b. VENDAS POR CANAL (Janeiro/2026 - UTC puro):");
  const salesUTC = await db.execute(sql`
    SELECT 
      saleType,
      COUNT(*) as qty,
      SUM(CAST(finalAmount AS DECIMAL(15,2))) as total,
      SUM(CASE WHEN status != 'CANCELADA' THEN CAST(finalAmount AS DECIMAL(15,2)) ELSE 0 END) as active_total
    FROM sales 
    WHERE saleDate >= '2026-01-01 00:00:00' 
      AND saleDate < '2026-02-01 00:00:00'
    GROUP BY saleType
    ORDER BY saleType
  `);
  
  let totalUTC = 0;
  for (const row of salesUTC[0]) {
    console.log(`   ${row.saleType}: ${row.qty} vendas | Total: R$ ${parseFloat(row.total).toFixed(2)} | Ativo: R$ ${parseFloat(row.active_total).toFixed(2)}`);
    totalUTC += parseFloat(row.active_total);
  }
  console.log(`   TOTAL ATIVO (UTC): R$ ${totalUTC.toFixed(2)}\n`);

  // 2. Journals de receita por conta
  console.log("2. JOURNALS DE RECEITA POSTED (Janeiro/2026):");
  const revenueJournals = await db.execute(sql`
    SELECT 
      ca.code,
      ca.name,
      ae.entryType,
      COUNT(*) as qty,
      SUM(CAST(ae.amount AS DECIMAL(15,2))) as total
    FROM accountingEntries ae
    JOIN journals j ON ae.journalId = j.id
    JOIN chartOfAccounts ca ON ae.accountId = ca.id
    WHERE j.status = 'POSTED'
      AND j.competenceMonth = '2026-01'
      AND ca.code LIKE '4%'
    GROUP BY ca.code, ca.name, ae.entryType
    ORDER BY ca.code, ae.entryType
  `);
  
  for (const row of revenueJournals[0]) {
    console.log(`   ${row.code} - ${row.name} (${row.entryType}): ${row.qty} entries | R$ ${parseFloat(row.total).toFixed(2)}`);
  }

  // 3. Despesas contabilizadas
  console.log("\n3. DESPESAS CONTABILIZADAS (Janeiro/2026):");
  const expenseJournals = await db.execute(sql`
    SELECT 
      ca.code,
      ca.name,
      ae.entryType,
      COUNT(*) as qty,
      SUM(CAST(ae.amount AS DECIMAL(15,2))) as total
    FROM accountingEntries ae
    JOIN journals j ON ae.journalId = j.id
    JOIN chartOfAccounts ca ON ae.accountId = ca.id
    WHERE j.status = 'POSTED'
      AND j.competenceMonth = '2026-01'
      AND ca.code LIKE '6%'
    GROUP BY ca.code, ca.name, ae.entryType
    ORDER BY ca.code, ae.entryType
  `);
  
  for (const row of expenseJournals[0]) {
    console.log(`   ${row.code} - ${row.name} (${row.entryType}): ${row.qty} entries | R$ ${parseFloat(row.total).toFixed(2)}`);
  }

  // 3b. Total de despesas no módulo de despesas
  console.log("\n3b. DESPESAS NO MÓDULO (Janeiro/2026):");
  const expenses = await db.execute(sql`
    SELECT 
      status,
      COUNT(*) as qty,
      SUM(CAST(amount AS DECIMAL(15,2))) as total
    FROM expenses
    WHERE competenceMonth = '2026-01'
    GROUP BY status
  `);
  
  for (const row of expenses[0]) {
    console.log(`   Status ${row.status}: ${row.qty} despesas | R$ ${parseFloat(row.total).toFixed(2)}`);
  }

  // 4. CMV contabilizado
  console.log("\n4. CMV CONTABILIZADO (Janeiro/2026):");
  const cmv = await db.execute(sql`
    SELECT 
      ca.code,
      ca.name,
      ae.entryType,
      COUNT(*) as qty,
      SUM(CAST(ae.amount AS DECIMAL(15,2))) as total
    FROM accountingEntries ae
    JOIN journals j ON ae.journalId = j.id
    JOIN chartOfAccounts ca ON ae.accountId = ca.id
    WHERE j.status = 'POSTED'
      AND j.competenceMonth = '2026-01'
      AND ca.code LIKE '5%'
    GROUP BY ca.code, ca.name, ae.entryType
    ORDER BY ca.code, ae.entryType
  `);
  
  for (const row of cmv[0]) {
    console.log(`   ${row.code} - ${row.name} (${row.entryType}): ${row.qty} entries | R$ ${parseFloat(row.total).toFixed(2)}`);
  }

  // 5. Outras Receitas
  console.log("\n5. OUTRAS RECEITAS (Janeiro/2026):");
  const otherRevenues = await db.execute(sql`
    SELECT 
      id, description, amount, revenueDate, status
    FROM otherRevenues
    WHERE competenceMonth = '2026-01'
    ORDER BY revenueDate
  `);
  
  let totalOR = 0;
  for (const row of otherRevenues[0]) {
    console.log(`   #${row.id}: ${row.description} | R$ ${parseFloat(row.amount).toFixed(2)} | ${row.status}`);
    totalOR += parseFloat(row.amount);
  }
  console.log(`   TOTAL Outras Receitas: R$ ${totalOR.toFixed(2)}`);

  // 6. Vendas processadas no script vs vendas no sistema
  console.log("\n6. COMPARAÇÃO: Script vs Sistema:");
  const scriptSales = await db.execute(sql`
    SELECT 
      saleType,
      COUNT(*) as qty,
      SUM(CAST(finalAmount AS DECIMAL(15,2))) as total
    FROM sales 
    WHERE YEAR(saleDate) = 2026 AND MONTH(saleDate) = 1
    GROUP BY saleType
    ORDER BY saleType
  `);
  
  console.log("   Filtro do script (YEAR=2026, MONTH=1 em UTC):");
  let scriptTotal = 0;
  for (const row of scriptSales[0]) {
    console.log(`   ${row.saleType}: ${row.qty} vendas | R$ ${parseFloat(row.total).toFixed(2)}`);
    scriptTotal += parseFloat(row.total);
  }
  console.log(`   TOTAL script: R$ ${scriptTotal.toFixed(2)}`);

  // 7. Vendas na fronteira (31 jan / 1 fev)
  console.log("\n7. VENDAS NA FRONTEIRA (31/jan - 01/fev):");
  const borderSales = await db.execute(sql`
    SELECT 
      id, saleType, finalAmount, saleDate, status
    FROM sales 
    WHERE saleDate >= '2026-01-31 00:00:00' 
      AND saleDate < '2026-02-01 06:00:00'
    ORDER BY saleDate
    LIMIT 20
  `);
  
  for (const row of borderSales[0]) {
    console.log(`   #${row.id}: ${row.saleType} | R$ ${parseFloat(row.finalAmount).toFixed(2)} | ${row.saleDate} | ${row.status}`);
  }

  // 8. Quantas vendas o script contabilizou vs quantas existem
  console.log("\n8. JOURNALS DE VENDAS (Janeiro/2026):");
  const saleJournals = await db.execute(sql`
    SELECT 
      j.status,
      COUNT(*) as qty
    FROM journals j
    JOIN journalSources js ON j.id = js.journalId
    WHERE j.competenceMonth = '2026-01'
      AND js.sourceType = 'sale'
    GROUP BY j.status
  `);
  
  for (const row of saleJournals[0]) {
    console.log(`   ${row.status}: ${row.qty} journals de vendas`);
  }

  console.log("\n=== FIM DA INVESTIGAÇÃO ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
