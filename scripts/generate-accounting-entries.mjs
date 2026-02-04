/**
 * Script para gerar lançamentos contábeis (journals) a partir de:
 * - Vendas (Balcão, A Prazo, Delivery)
 * - Despesas
 * - Compras
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// IDs das contas contábeis
const ACCOUNTS = {
  // Caixa e Bancos
  CAIXA_GERAL: 4,        // 1.1.1.01
  BANCO_ITAU: 5,         // 1.1.1.02
  
  // Contas a Receber
  CONTAS_RECEBER: 10,    // 1.1.2.01 (se existir)
  
  // Receitas de Vendas
  RECEITA_BALCAO: 54,    // 4.1.1.01
  RECEITA_A_PRAZO: 55,   // 4.1.1.02
  RECEITA_DELIVERY: 56,  // 4.1.1.03
  
  // Custos
  CMV: 72,               // 5.1.1.01
  
  // Despesas (serão mapeadas dinamicamente)
};

// Mapeamento de saleType para conta de receita
const SALE_TYPE_TO_ACCOUNT = {
  'BALCAO': ACCOUNTS.RECEITA_BALCAO,
  'A_PRAZO': ACCOUNTS.RECEITA_A_PRAZO,
  'DELIVERY': ACCOUNTS.RECEITA_DELIVERY,
};

// Mapeamento de saleType para conta de débito (caixa ou contas a receber)
const SALE_TYPE_TO_DEBIT_ACCOUNT = {
  'BALCAO': ACCOUNTS.CAIXA_GERAL,    // Venda à vista - débito em caixa
  'A_PRAZO': 10,                      // Venda a prazo - débito em contas a receber
  'DELIVERY': ACCOUNTS.CAIXA_GERAL,  // Delivery - débito em caixa
};

async function getOrCreateJournal(competenceMonth, description, createdBy = 'system') {
  // Verificar se já existe journal para este mês
  const [existing] = await conn.execute(
    `SELECT id FROM journals WHERE competenceMonth = ? AND description = ? LIMIT 1`,
    [competenceMonth, description]
  );
  
  if (existing.length > 0) {
    return existing[0].id;
  }
  
  // Criar novo journal
  const [result] = await conn.execute(
    `INSERT INTO journals (companyId, competenceMonth, description, status, createdBy, totalDebit, totalCredit)
     VALUES (1, ?, ?, 'POSTED', ?, '0.00', '0.00')`,
    [competenceMonth, description, createdBy]
  );
  
  return result.insertId;
}

async function createEntry(journalId, accountId, amount, entryType, description, competenceMonth, entryDate) {
  await conn.execute(
    `INSERT INTO accountingEntries 
     (companyId, journalId, accountId, entryDate, competenceMonth, amount, entryType, description)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
    [journalId, accountId, entryDate, competenceMonth, amount.toFixed(2), entryType, description]
  );
}

async function generateSalesEntries() {
  console.log('\n=== Gerando lançamentos de VENDAS ===\n');
  
  // Buscar vendas agrupadas por mês e tipo
  const [sales] = await conn.execute(`
    SELECT 
      DATE_FORMAT(saleDate, '%Y-%m') as competenceMonth,
      saleType,
      SUM(subtotal) as totalVendas,
      COUNT(*) as qtd
    FROM sales
    WHERE status = 'ACTIVE'
    GROUP BY DATE_FORMAT(saleDate, '%Y-%m'), saleType
    ORDER BY competenceMonth, saleType
  `);
  
  for (const sale of sales) {
    const { competenceMonth, saleType, totalVendas, qtd } = sale;
    const amount = parseFloat(totalVendas);
    
    if (amount <= 0) continue;
    
    // Obter conta de receita e conta de débito
    const revenueAccountId = SALE_TYPE_TO_ACCOUNT[saleType];
    let debitAccountId = SALE_TYPE_TO_DEBIT_ACCOUNT[saleType];
    
    if (!revenueAccountId) {
      console.log(`  ⚠️ Tipo de venda não mapeado: ${saleType}`);
      continue;
    }
    
    // Verificar se conta de Contas a Receber existe para vendas A_PRAZO
    if (saleType === 'A_PRAZO') {
      const [contaReceber] = await conn.execute(
        `SELECT id FROM chartOfAccounts WHERE code = '1.1.2.01' LIMIT 1`
      );
      if (contaReceber.length > 0) {
        debitAccountId = contaReceber[0].id;
      } else {
        // Usar caixa se não existir conta a receber
        debitAccountId = ACCOUNTS.CAIXA_GERAL;
      }
    }
    
    // Criar journal para vendas do mês
    const journalDescription = `Vendas ${saleType} - ${competenceMonth}`;
    const journalId = await getOrCreateJournal(competenceMonth, journalDescription);
    
    // Verificar se já existem lançamentos para este journal
    const [existingEntries] = await conn.execute(
      `SELECT COUNT(*) as count FROM accountingEntries WHERE journalId = ?`,
      [journalId]
    );
    
    if (existingEntries[0].count > 0) {
      console.log(`  ⏭️ ${competenceMonth} ${saleType}: já contabilizado`);
      continue;
    }
    
    // Data do lançamento (último dia do mês)
    const [year, month] = competenceMonth.split('-');
    const entryDate = new Date(parseInt(year), parseInt(month), 0); // Último dia do mês
    
    // Criar lançamentos (partida dobrada)
    // Débito: Caixa/Contas a Receber
    await createEntry(
      journalId, 
      debitAccountId, 
      amount, 
      'D', 
      `Vendas ${saleType} (${qtd} vendas)`,
      competenceMonth,
      entryDate
    );
    
    // Crédito: Receita de Vendas
    await createEntry(
      journalId, 
      revenueAccountId, 
      amount, 
      'C', 
      `Receita de Vendas ${saleType} (${qtd} vendas)`,
      competenceMonth,
      entryDate
    );
    
    // Atualizar totais do journal
    await conn.execute(
      `UPDATE journals SET totalDebit = ?, totalCredit = ? WHERE id = ?`,
      [amount.toFixed(2), amount.toFixed(2), journalId]
    );
    
    console.log(`  ✅ ${competenceMonth} ${saleType}: R$ ${amount.toFixed(2)} (${qtd} vendas)`);
  }
}

async function generateExpenseEntries() {
  console.log('\n=== Gerando lançamentos de DESPESAS ===\n');
  
  // Buscar despesas com conta gerencial mapeada para conta contábil
  const [expenses] = await conn.execute(`
    SELECT 
      e.id,
      e.description,
      e.competenceMonth,
      e.createdAt,
      e.managementAccountId,
      e.amount,
      ma.name as managementAccountName,
      am.accountingCode,
      ca.id as accountId,
      ca.name as accountName
    FROM expenses e
    LEFT JOIN managementAccounts ma ON e.managementAccountId = ma.id
    LEFT JOIN accountingMappings am ON ma.id = am.managementAccountId
    LEFT JOIN chartOfAccounts ca ON am.accountingCode = ca.code
    WHERE e.status = 'ATIVA'
    ORDER BY e.competenceMonth, e.createdAt
  `);
  
  // Agrupar por mês para criar journals mensais
  const expensesByMonth = {};
  for (const expense of expenses) {
    const month = expense.competenceMonth || new Date(expense.createdAt).toISOString().slice(0, 7);
    if (!expensesByMonth[month]) {
      expensesByMonth[month] = [];
    }
    expensesByMonth[month].push(expense);
  }
  
  for (const [competenceMonth, monthExpenses] of Object.entries(expensesByMonth)) {
    // Criar journal para despesas do mês
    const journalDescription = `Despesas - ${competenceMonth}`;
    const journalId = await getOrCreateJournal(competenceMonth, journalDescription);
    
    // Verificar se já existem lançamentos para este journal
    const [existingEntries] = await conn.execute(
      `SELECT COUNT(*) as count FROM accountingEntries WHERE journalId = ?`,
      [journalId]
    );
    
    if (existingEntries[0].count > 0) {
      console.log(`  ⏭️ ${competenceMonth}: já contabilizado`);
      continue;
    }
    
    let totalMonth = 0;
    const [year, month] = competenceMonth.split('-');
    const entryDate = new Date(parseInt(year), parseInt(month), 0);
    
    for (const expense of monthExpenses) {
      const amount = parseFloat(expense.amount || 0);
      if (amount <= 0) continue;
      
      // Se não tem conta contábil mapeada, usar conta genérica de despesas
      let accountId = expense.accountId;
      if (!accountId) {
        // Buscar conta genérica de despesas (6.1.1.01 - Aluguel como fallback)
        const [genericAccount] = await conn.execute(
          `SELECT id FROM chartOfAccounts WHERE code = '6.1.1.01' LIMIT 1`
        );
        accountId = genericAccount.length > 0 ? genericAccount[0].id : 89;
      }
      
      // Débito: Conta de Despesa
      await createEntry(
        journalId,
        accountId,
        amount,
        'D',
        expense.description || expense.managementAccountName || 'Despesa',
        competenceMonth,
        entryDate
      );
      
      // Crédito: Caixa Geral
      await createEntry(
        journalId,
        ACCOUNTS.CAIXA_GERAL,
        amount,
        'C',
        `Pagamento: ${expense.description || 'Despesa'}`,
        competenceMonth,
        entryDate
      );
      
      totalMonth += amount;
    }
    
    // Atualizar totais do journal
    await conn.execute(
      `UPDATE journals SET totalDebit = ?, totalCredit = ? WHERE id = ?`,
      [totalMonth.toFixed(2), totalMonth.toFixed(2), journalId]
    );
    
    console.log(`  ✅ ${competenceMonth}: R$ ${totalMonth.toFixed(2)} (${monthExpenses.length} despesas)`);
  }
}

async function generatePurchaseEntries() {
  console.log('\n=== Gerando lançamentos de COMPRAS ===\n');
  
  // Buscar compras agrupadas por mês
  const [purchases] = await conn.execute(`
    SELECT 
      DATE_FORMAT(postingDate, '%Y-%m') as competenceMonth,
      SUM(totalAmount) as totalCompras,
      COUNT(*) as qtd
    FROM purchaseOrders
    WHERE status = 'CONFIRMED'
    GROUP BY DATE_FORMAT(postingDate, '%Y-%m')
    ORDER BY competenceMonth
  `);
  
  for (const purchase of purchases) {
    const { competenceMonth, totalCompras, qtd } = purchase;
    const amount = parseFloat(totalCompras);
    
    if (amount <= 0) continue;
    
    // Criar journal para compras do mês
    const journalDescription = `Compras - ${competenceMonth}`;
    const journalId = await getOrCreateJournal(competenceMonth, journalDescription);
    
    // Verificar se já existem lançamentos para este journal
    const [existingEntries] = await conn.execute(
      `SELECT COUNT(*) as count FROM accountingEntries WHERE journalId = ?`,
      [journalId]
    );
    
    if (existingEntries[0].count > 0) {
      console.log(`  ⏭️ ${competenceMonth}: já contabilizado`);
      continue;
    }
    
    const [year, month] = competenceMonth.split('-');
    const entryDate = new Date(parseInt(year), parseInt(month), 0);
    
    // Débito: CMV (Custo das Mercadorias Vendidas)
    await createEntry(
      journalId,
      ACCOUNTS.CMV,
      amount,
      'D',
      `Compras de mercadorias (${qtd} compras)`,
      competenceMonth,
      entryDate
    );
    
    // Crédito: Caixa Geral
    await createEntry(
      journalId,
      ACCOUNTS.CAIXA_GERAL,
      amount,
      'C',
      `Pagamento de compras (${qtd} compras)`,
      competenceMonth,
      entryDate
    );
    
    // Atualizar totais do journal
    await conn.execute(
      `UPDATE journals SET totalDebit = ?, totalCredit = ? WHERE id = ?`,
      [amount.toFixed(2), amount.toFixed(2), journalId]
    );
    
    console.log(`  ✅ ${competenceMonth}: R$ ${amount.toFixed(2)} (${qtd} compras)`);
  }
}

async function main() {
  try {
    console.log('Iniciando geração de lançamentos contábeis...\n');
    
    await generateSalesEntries();
    await generateExpenseEntries();
    await generatePurchaseEntries();
    
    console.log('\n✅ Lançamentos contábeis gerados com sucesso!');
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await conn.end();
  }
}

main();
