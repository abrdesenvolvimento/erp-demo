/**
 * Script para investigar divergências entre valores do sistema e DRE
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== INVESTIGAÇÃO DE DIVERGÊNCIAS - JANEIRO/2026 ===\n');

// 1. Vendas por tipo (valores esperados pelo Gabriel)
console.log('1. VENDAS POR TIPO (Janeiro/2026):');
console.log('   Valores esperados: Balcão R$ 56.493,25 | A Prazo R$ 7.115,40 | Delivery R$ 23.522,32\n');

const [salesByType] = await conn.execute(`
  SELECT 
    saleType,
    COUNT(*) as qtd_total,
    SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as qtd_ativas,
    SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as qtd_canceladas,
    ROUND(SUM(finalAmount), 2) as total_geral,
    ROUND(SUM(CASE WHEN status = 'ACTIVE' THEN finalAmount ELSE 0 END), 2) as total_ativas,
    ROUND(SUM(CASE WHEN status = 'CANCELLED' THEN finalAmount ELSE 0 END), 2) as total_canceladas,
    ROUND(SUM(subtotal), 2) as total_subtotal,
    ROUND(SUM(CASE WHEN status = 'ACTIVE' THEN subtotal ELSE 0 END), 2) as subtotal_ativas
  FROM sales
  WHERE DATE_FORMAT(saleDate, '%Y-%m') = '2026-01'
  GROUP BY saleType
  ORDER BY saleType
`);

for (const row of salesByType) {
  console.log(`   ${row.saleType}:`);
  console.log(`     - Total vendas: ${row.qtd_total} (${row.qtd_ativas} ativas, ${row.qtd_canceladas} canceladas)`);
  console.log(`     - finalAmount total: R$ ${row.total_geral} (ativas: R$ ${row.total_ativas})`);
  console.log(`     - subtotal total: R$ ${row.total_subtotal} (ativas: R$ ${row.subtotal_ativas})`);
}

// 2. Verificar o que está no DRE (accountingEntries)
console.log('\n2. LANÇAMENTOS CONTÁBEIS (Janeiro/2026):');

const [entries] = await conn.execute(`
  SELECT 
    j.description,
    j.totalDebit,
    j.totalCredit,
    ae.entryType,
    ca.code,
    ca.name,
    ae.amount,
    ae.description as entry_desc
  FROM journals j
  JOIN accountingEntries ae ON j.id = ae.journalId
  JOIN chartOfAccounts ca ON ae.accountId = ca.id
  WHERE j.competenceMonth = '2026-01'
  ORDER BY j.description, ae.entryType
`);

let currentJournal = '';
for (const row of entries) {
  if (row.description !== currentJournal) {
    currentJournal = row.description;
    console.log(`\n   ${currentJournal} (D: ${row.totalDebit} | C: ${row.totalCredit}):`);
  }
  console.log(`     ${row.entryType} ${row.code} ${row.name}: R$ ${row.amount}`);
}

// 3. Verificar compras
console.log('\n\n3. COMPRAS (Janeiro/2026):');
console.log('   Valor esperado: R$ 60.193,90\n');

const [purchases] = await conn.execute(`
  SELECT 
    status,
    COUNT(*) as qtd,
    ROUND(SUM(totalAmount), 2) as total
  FROM purchaseOrders
  WHERE DATE_FORMAT(postingDate, '%Y-%m') = '2026-01'
  GROUP BY status
`);

for (const row of purchases) {
  console.log(`   ${row.status}: ${row.qtd} compras, R$ ${row.total}`);
}

// 4. Verificar despesas
console.log('\n4. DESPESAS (Janeiro/2026):');
console.log('   Valor esperado: R$ 39.813,46\n');

const [expenses] = await conn.execute(`
  SELECT 
    status,
    COUNT(*) as qtd,
    ROUND(SUM(amount), 2) as total
  FROM expenses
  WHERE competenceMonth = '2026-01'
  GROUP BY status
`);

for (const row of expenses) {
  console.log(`   ${row.status}: ${row.qtd} despesas, R$ ${row.total}`);
}

// 5. Verificar se há duplicação de journals
console.log('\n5. JOURNALS DUPLICADOS:');

const [duplicates] = await conn.execute(`
  SELECT 
    competenceMonth,
    description,
    COUNT(*) as qtd
  FROM journals
  GROUP BY competenceMonth, description
  HAVING COUNT(*) > 1
`);

if (duplicates.length === 0) {
  console.log('   Nenhum journal duplicado encontrado');
} else {
  for (const row of duplicates) {
    console.log(`   ${row.competenceMonth} - ${row.description}: ${row.qtd} duplicatas`);
  }
}

// 6. Verificar todos os journals
console.log('\n6. TODOS OS JOURNALS:');

const [allJournals] = await conn.execute(`
  SELECT 
    id,
    competenceMonth,
    description,
    totalDebit,
    totalCredit
  FROM journals
  ORDER BY competenceMonth, description
`);

for (const row of allJournals) {
  console.log(`   ${row.id}: ${row.competenceMonth} - ${row.description} (D: ${row.totalDebit} | C: ${row.totalCredit})`);
}

await conn.end();
console.log('\n=== FIM DA INVESTIGAÇÃO ===');
