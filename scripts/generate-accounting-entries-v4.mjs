/**
 * Script para gerar lançamentos contábeis (journals) a partir de:
 * - Vendas (Balcão, A Prazo, Delivery) - apenas 2026+
 * - Despesas - apenas 2026+
 * - CMV (Custo das Mercadorias Vendidas) - calculado igual à Análise de Vendas
 * 
 * CORREÇÕES v4:
 * - CMV agora usa SUM(quantity * avgCost) dos itens vendidos (igual à Análise de Vendas)
 * - Não usa mais valor das compras para CMV
 * - Mantém lógica de timezone da Análise de Faturamento (CONVERT_TZ)
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// IDs das contas contábeis
const ACCOUNTS = {
  // Caixa e Bancos
  CAIXA_GERAL: 4,        // 1.1.1.01
  
  // Contas a Receber
  CONTAS_RECEBER: 10,    // 1.1.2.01
  
  // Estoque
  ESTOQUE: 16,           // 1.1.3.01 Estoque de Mercadorias
  
  // Receitas de Vendas
  RECEITA_BALCAO: 54,    // 4.1.1.01
  RECEITA_A_PRAZO: 55,   // 4.1.1.02
  RECEITA_DELIVERY: 56,  // 4.1.1.03
  
  // Custos
  CMV: 72,               // 5.1.1.01
  
  // Despesas genéricas (fallback)
  DESPESA_GENERICA: 89,  // 6.1.1.01 Aluguel
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
  'A_PRAZO': ACCOUNTS.CONTAS_RECEBER, // Venda a prazo - débito em contas a receber
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
  console.log('\n=== Gerando lançamentos de VENDAS (2026+) ===\n');
  
  // USAR MESMA QUERY DA ANÁLISE DE FATURAMENTO
  // Com CONVERT_TZ para timezone de Brasília e status != 'CANCELLED'
  const [sales] = await conn.execute(`
    SELECT 
      CONCAT(YEAR(CONVERT_TZ(saleDate, '+00:00', '-03:00')), '-', 
             LPAD(MONTH(CONVERT_TZ(saleDate, '+00:00', '-03:00')), 2, '0')) as competenceMonth,
      saleType,
      COUNT(*) as qtd,
      COALESCE(SUM(finalAmount), 0) as totalVendas
    FROM sales
    WHERE status != 'CANCELLED'
      AND saleDate >= '2026-01-01 03:00:00'
    GROUP BY CONCAT(YEAR(CONVERT_TZ(saleDate, '+00:00', '-03:00')), '-', 
             LPAD(MONTH(CONVERT_TZ(saleDate, '+00:00', '-03:00')), 2, '0')), saleType
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

/**
 * Gera lançamentos de CMV (Custo das Mercadorias Vendidas)
 * Usa a mesma lógica da Análise de Vendas: SUM(quantity * avgCost)
 */
async function generateCMVEntries() {
  console.log('\n=== Gerando lançamentos de CMV (2026+) ===\n');
  console.log('Calculando CMV igual à Análise de Vendas: SUM(quantity * avgCost)\n');
  
  // Calcular CMV por mês usando a mesma lógica da Análise de Vendas
  // SUM(si.quantity * p.avgCost) - custo médio dos produtos vendidos
  const [cmvByMonth] = await conn.execute(`
    SELECT 
      CONCAT(YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')), '-', 
             LPAD(MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')), 2, '0')) as competenceMonth,
      SUM(si.quantity) as totalQuantity,
      SUM(si.quantity * p.avgCost) as totalCost
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    INNER JOIN products p ON si.productId = p.id
    WHERE s.status != 'CANCELLED'
      AND s.saleDate >= '2026-01-01 03:00:00'
    GROUP BY CONCAT(YEAR(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')), '-', 
             LPAD(MONTH(CONVERT_TZ(s.saleDate, '+00:00', '-03:00')), 2, '0'))
    ORDER BY competenceMonth
  `);
  
  for (const row of cmvByMonth) {
    const { competenceMonth, totalQuantity, totalCost } = row;
    const amount = parseFloat(totalCost);
    const qty = parseInt(totalQuantity);
    
    if (amount <= 0) continue;
    
    // Criar journal para CMV do mês
    const journalDescription = `CMV - ${competenceMonth}`;
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
    
    // Lançamento contábil do CMV:
    // Débito: CMV (conta de resultado - custo)
    // Crédito: Estoque (baixa do estoque)
    
    await createEntry(
      journalId,
      ACCOUNTS.CMV,
      amount,
      'D',
      `Custo das mercadorias vendidas (${qty} itens)`,
      competenceMonth,
      entryDate
    );
    
    await createEntry(
      journalId,
      ACCOUNTS.ESTOQUE,
      amount,
      'C',
      `Baixa de estoque por vendas (${qty} itens)`,
      competenceMonth,
      entryDate
    );
    
    // Atualizar totais do journal
    await conn.execute(
      `UPDATE journals SET totalDebit = ?, totalCredit = ? WHERE id = ?`,
      [amount.toFixed(2), amount.toFixed(2), journalId]
    );
    
    console.log(`  ✅ ${competenceMonth}: R$ ${amount.toFixed(2)} (${qty} itens vendidos)`);
  }
}

async function generateExpenseEntries() {
  console.log('\n=== Gerando lançamentos de DESPESAS (2026+) ===\n');
  
  // Buscar despesas com conta gerencial mapeada para conta contábil - APENAS 2026+
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
      AND e.competenceMonth >= '2026-01'
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
      
      // Usar conta contábil mapeada ou fallback
      let accountId = expense.accountId;
      if (!accountId) {
        accountId = ACCOUNTS.DESPESA_GENERICA;
      }
      
      // Débito: Conta de Despesa (conta correta baseada no mapeamento)
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

async function main() {
  try {
    console.log('Iniciando geração de lançamentos contábeis (apenas 2026+)...');
    console.log('CMV calculado igual à Análise de Vendas: SUM(quantity * avgCost)\n');
    
    // Limpar lançamentos existentes de 2026+
    console.log('Limpando lançamentos existentes...');
    await conn.execute(`DELETE FROM accountingEntries WHERE competenceMonth >= '2026-01'`);
    await conn.execute(`DELETE FROM journals WHERE competenceMonth >= '2026-01'`);
    console.log('✅ Lançamentos limpos\n');
    
    await generateSalesEntries();
    await generateCMVEntries();  // CMV agora usa custo dos produtos vendidos
    await generateExpenseEntries();
    
    console.log('\n✅ Lançamentos contábeis gerados com sucesso!');
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await conn.end();
  }
}

main();
