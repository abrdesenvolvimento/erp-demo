/**
 * Script de Retroação Contábil - Janeiro e Fevereiro 2026
 * 
 * Este script gera lançamentos contábeis para:
 * 1. Compras confirmadas (D-Estoque / C-Fornecedores)
 * 2. Pagamentos de compras (D-Fornecedores / C-Caixa)
 * 3. Vendas Balcão/Delivery (D-Caixa / C-Receita)
 * 4. Vendas A Prazo (D-Clientes / C-Receita)
 * 5. CMV de todas as vendas (D-CMV / C-Estoque)
 * 6. Recebimentos de clientes (D-Caixa / C-Clientes)
 */

import mysql from 'mysql2/promise';

// Configuração das contas contábeis (IDs verificados no plano de contas)
const ACCOUNTS = {
  CAIXA: 4,                    // 1.1.1.01 - Caixa Geral
  CLIENTES: 10,                // 1.1.2.01 - Clientes A Prazo
  ESTOQUE: 14,                 // 1.1.3.01 - Mercadorias para Revenda
  FORNECEDORES: 30,            // 2.1.1.01 - Fornecedores Nacionais
  RECEITA_BALCAO: 54,          // 4.1.1.01 - Receita de Vendas (Balcão)
  RECEITA_APRAZO: 55,          // 4.1.1.02 - Receita de Vendas (A Prazo)
  RECEITA_DELIVERY: 56,        // 4.1.1.03 - Receita de Vendas (Delivery)
  CMV: 72,                     // 5.1.1.01 - CMV - Custo sobre Vendas
};

// Período de retroação
const START_DATE = '2026-01-01';
const END_DATE = '2026-02-28';

let connection;
let journalCounter = 0;
let entryCounter = 0;

async function getNextJournalId() {
  const [result] = await connection.execute('SELECT MAX(id) as maxId FROM journals');
  return (result[0]?.maxId || 60000) + 1;
}

async function createJournal(data) {
  const id = await getNextJournalId() + journalCounter++;
  
  await connection.execute(
    `INSERT INTO journals (id, companyId, competenceMonth, description, status, createdBy, createdAt)
     VALUES (?, 1, ?, ?, 'POSTED', 'retroacao', NOW())`,
    [id, data.competenceMonth, data.description]
  );
  
  return id;
}

async function createEntry(journalId, data) {
  entryCounter++;
  
  await connection.execute(
    `INSERT INTO accountingEntries (companyId, journalId, accountId, entryDate, competenceMonth, amount, entryType, description, sourceType, sourceId, createdAt)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      journalId,
      data.accountId,
      data.entryDate,
      data.competenceMonth,
      data.amount,
      data.entryType,
      data.description,
      data.sourceType || null,
      data.sourceId || null
    ]
  );
}

function getCompetenceMonth(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// =====================================================
// 1. CONTABILIZAR COMPRAS CONFIRMADAS
// =====================================================
async function contabilizarCompras() {
  console.log('\n📦 Contabilizando Compras Confirmadas...');
  
  // Buscar compras confirmadas no período
  const [compras] = await connection.execute(`
    SELECT po.id, po.issueDate, po.totalAmount, po.status, p.tradeName, p.name
    FROM purchaseOrders po
    LEFT JOIN partners p ON po.supplierId = p.id
    WHERE po.status = 'CONFIRMED'
    AND po.issueDate >= ? AND po.issueDate <= ?
  `, [START_DATE, END_DATE]);
  
  console.log(`   Encontradas ${compras.length} compras confirmadas`);
  
  for (const compra of compras) {
    const supplierName = compra.tradeName || compra.name || `Fornecedor #${compra.id}`;
    const competenceMonth = getCompetenceMonth(compra.issueDate);
    const amount = parseFloat(compra.totalAmount || 0);
    
    if (amount <= 0) continue;
    
    // Verificar se já existe lançamento para esta compra (via accountingEntries)
    const [existing] = await connection.execute(
      `SELECT id FROM accountingEntries WHERE sourceType = 'PURCHASE' AND sourceId = ? LIMIT 1`,
      [compra.id]
    );
    
    if (existing.length > 0) {
      console.log(`   ⏭️  Compra #${compra.id} já contabilizada`);
      continue;
    }
    
    // Criar journal
    const journalId = await createJournal({
      competenceMonth,
      description: `Compra #${compra.id} - ${supplierName}`,
      sourceType: 'PURCHASE',
      sourceId: compra.id
    });
    
    // D - Estoque
    await createEntry(journalId, {
      accountId: ACCOUNTS.ESTOQUE,
      entryDate: compra.issueDate,
      competenceMonth,
      amount: amount.toFixed(2),
      entryType: 'D',
      description: `Compra #${compra.id} - ${supplierName}`,
      sourceType: 'PURCHASE',
      sourceId: compra.id
    });
    
    // C - Fornecedores
    await createEntry(journalId, {
      accountId: ACCOUNTS.FORNECEDORES,
      entryDate: compra.issueDate,
      competenceMonth,
      amount: amount.toFixed(2),
      entryType: 'C',
      description: `Compra #${compra.id} - ${supplierName}`,
      sourceType: 'PURCHASE',
      sourceId: compra.id
    });
    
    console.log(`   ✅ Compra #${compra.id}: R$ ${amount.toFixed(2)}`);
  }
}

// =====================================================
// 2. CONTABILIZAR PAGAMENTOS DE COMPRAS
// =====================================================
async function contabilizarPagamentosCompras() {
  console.log('\n💳 Contabilizando Pagamentos de Compras...');
  
  // Buscar parcelas pagas no período
  const [parcelas] = await connection.execute(`
    SELECT pi.id, pi.purchaseOrderId, pi.paidDate, pi.paidAmount, pi.amount, po.id as orderId, p.tradeName, p.name
    FROM purchaseInstallments pi
    INNER JOIN purchaseOrders po ON pi.purchaseOrderId = po.id
    LEFT JOIN partners p ON po.supplierId = p.id
    WHERE pi.status = 'PAID'
    AND pi.paidDate >= ? AND pi.paidDate <= ?
  `, [START_DATE, END_DATE]);
  
  console.log(`   Encontradas ${parcelas.length} parcelas pagas`);
  
  for (const parcela of parcelas) {
    const supplierName = parcela.tradeName || parcela.name || `Fornecedor`;
    const competenceMonth = getCompetenceMonth(parcela.paidDate);
    const amount = parseFloat(parcela.paidAmount || parcela.amount || 0);
    
    if (amount <= 0) continue;
    
    // Verificar se já existe lançamento para este pagamento (via accountingEntries)
    const [existing] = await connection.execute(
      `SELECT id FROM accountingEntries WHERE sourceType = 'PURCHASE_PAYMENT' AND sourceId = ? LIMIT 1`,
      [parcela.id]
    );
    
    if (existing.length > 0) {
      console.log(`   ⏭️  Pagamento #${parcela.id} já contabilizado`);
      continue;
    }
    
    // Criar journal
    const journalId = await createJournal({
      competenceMonth,
      description: `Pagamento Compra #${parcela.purchaseOrderId} - ${supplierName}`,
      sourceType: 'PURCHASE_PAYMENT',
      sourceId: parcela.id
    });
    
    // D - Fornecedores
    await createEntry(journalId, {
      accountId: ACCOUNTS.FORNECEDORES,
      entryDate: parcela.paidDate,
      competenceMonth,
      amount: amount.toFixed(2),
      entryType: 'D',
      description: `Pagamento Compra #${parcela.purchaseOrderId}`,
      sourceType: 'PURCHASE_PAYMENT',
      sourceId: parcela.id
    });
    
    // C - Caixa
    await createEntry(journalId, {
      accountId: ACCOUNTS.CAIXA,
      entryDate: parcela.paidDate,
      competenceMonth,
      amount: amount.toFixed(2),
      entryType: 'C',
      description: `Pagamento Compra #${parcela.purchaseOrderId}`,
      sourceType: 'PURCHASE_PAYMENT',
      sourceId: parcela.id
    });
    
    console.log(`   ✅ Pagamento #${parcela.id}: R$ ${amount.toFixed(2)}`);
  }
}

// =====================================================
// 3. CONTABILIZAR VENDAS
// =====================================================
async function contabilizarVendas() {
  console.log('\n🛒 Contabilizando Vendas...');
  
  // Buscar vendas no período (excluindo canceladas)
  const [vendas] = await connection.execute(`
    SELECT s.id, s.saleDate, s.finalAmount, s.channelId, s.customerId, 
           sc.name as channelName, p.tradeName, p.name as customerName
    FROM sales s
    LEFT JOIN salesChannels sc ON s.channelId = sc.id
    LEFT JOIN partners p ON s.customerId = p.id
    WHERE s.saleDate >= ? AND s.saleDate <= ?
    AND (s.status IS NULL OR s.status != 'CANCELLED')
  `, [START_DATE, END_DATE]);
  
  console.log(`   Encontradas ${vendas.length} vendas`);
  
  // Buscar itens das vendas para calcular CMV (buscar custo médio do produto)
  const [itens] = await connection.execute(`
    SELECT si.saleId, si.quantity, si.productId, p.avgCost
    FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    LEFT JOIN products p ON si.productId = p.id
    WHERE s.saleDate >= ? AND s.saleDate <= ?
  `, [START_DATE, END_DATE]);
  
  // Agrupar itens por venda
  const itensPorVenda = {};
  for (const item of itens) {
    if (!itensPorVenda[item.saleId]) {
      itensPorVenda[item.saleId] = [];
    }
    itensPorVenda[item.saleId].push(item);
  }
  
  for (const venda of vendas) {
    const competenceMonth = getCompetenceMonth(venda.saleDate);
    const totalAmount = parseFloat(venda.finalAmount || 0);
    const channelName = venda.channelName || 'Venda';
    const isAPrazo = venda.channelId === 3; // Canal 3 = A Prazo
    
    if (totalAmount <= 0) continue;
    
    // Verificar se já existe lançamento para esta venda (via accountingEntries)
    const [existing] = await connection.execute(
      `SELECT id FROM accountingEntries WHERE sourceType = 'SALE' AND sourceId = ? LIMIT 1`,
      [venda.id]
    );
    
    if (existing.length > 0) {
      console.log(`   ⏭️  Venda #${venda.id} já contabilizada`);
      continue;
    }
    
    // Calcular CMV
    const itensVenda = itensPorVenda[venda.id] || [];
    let cmvTotal = 0;
    for (const item of itensVenda) {
      const costPrice = parseFloat(item.avgCost || 0);
      const quantity = parseFloat(item.quantity || 0);
      cmvTotal += costPrice * quantity;
    }
    
    // Criar journal para a venda
    const journalId = await createJournal({
      competenceMonth,
      description: `Venda #${venda.id} - ${channelName}`,
      sourceType: 'SALE',
      sourceId: venda.id
    });
    
    // Lançamento da Receita
    if (isAPrazo) {
      // D - Clientes
      await createEntry(journalId, {
        accountId: ACCOUNTS.CLIENTES,
        entryDate: venda.saleDate,
        competenceMonth,
        amount: totalAmount.toFixed(2),
        entryType: 'D',
        description: `Venda A Prazo #${venda.id} - ${venda.customerName || 'Cliente'}`,
        sourceType: 'SALE',
        sourceId: venda.id
      });
    } else {
      // D - Caixa
      await createEntry(journalId, {
        accountId: ACCOUNTS.CAIXA,
        entryDate: venda.saleDate,
        competenceMonth,
        amount: totalAmount.toFixed(2),
        entryType: 'D',
        description: `Venda ${channelName} #${venda.id}`,
        sourceType: 'SALE',
        sourceId: venda.id
      });
    }
    
    // C - Receita de Vendas (conta específica por canal)
    let receitaAccountId = ACCOUNTS.RECEITA_BALCAO; // Default: Balcão
    if (venda.channelId === 2) receitaAccountId = ACCOUNTS.RECEITA_DELIVERY; // Delivery
    if (venda.channelId === 3) receitaAccountId = ACCOUNTS.RECEITA_APRAZO; // A Prazo
    
    await createEntry(journalId, {
      accountId: receitaAccountId,
      entryDate: venda.saleDate,
      competenceMonth,
      amount: totalAmount.toFixed(2),
      entryType: 'C',
      description: `Venda ${channelName} #${venda.id}`,
      sourceType: 'SALE',
      sourceId: venda.id
    });
    
    // Lançamento do CMV (se houver custo)
    if (cmvTotal > 0) {
      // D - CMV
      await createEntry(journalId, {
        accountId: ACCOUNTS.CMV,
        entryDate: venda.saleDate,
        competenceMonth,
        amount: cmvTotal.toFixed(2),
        entryType: 'D',
        description: `CMV Venda #${venda.id}`,
        sourceType: 'SALE_CMV',
        sourceId: venda.id
      });
      
      // C - Estoque
      await createEntry(journalId, {
        accountId: ACCOUNTS.ESTOQUE,
        entryDate: venda.saleDate,
        competenceMonth,
        amount: cmvTotal.toFixed(2),
        entryType: 'C',
        description: `Baixa Estoque Venda #${venda.id}`,
        sourceType: 'SALE_CMV',
        sourceId: venda.id
      });
    }
    
    console.log(`   ✅ Venda #${venda.id}: R$ ${totalAmount.toFixed(2)} (CMV: R$ ${cmvTotal.toFixed(2)})`);
  }
}

// =====================================================
// 4. CONTABILIZAR RECEBIMENTOS DE CLIENTES
// =====================================================
async function contabilizarRecebimentos() {
  console.log('\n💰 Contabilizando Recebimentos de Clientes...');
  
  // Buscar pagamentos de clientes no período (tabela customerPayments)
  const [recebimentos] = await connection.execute(`
    SELECT cp.id, cp.paidDate, cp.paidAmount, cp.customerId, p.tradeName, p.name
    FROM customerPayments cp
    LEFT JOIN partners p ON cp.customerId = p.id
    WHERE cp.paidDate >= ? AND cp.paidDate <= ?
  `, [START_DATE, END_DATE]);
  
  console.log(`   Encontrados ${recebimentos.length} recebimentos`);
  
  for (const recebimento of recebimentos) {
    const customerName = recebimento.tradeName || recebimento.name || `Cliente #${recebimento.customerId}`;
    const competenceMonth = getCompetenceMonth(recebimento.paidDate);
    const amount = parseFloat(recebimento.paidAmount || 0);
    
    if (amount <= 0) continue;
    
    // Verificar se já existe lançamento para este recebimento (via accountingEntries)
    const [existing] = await connection.execute(
      `SELECT id FROM accountingEntries WHERE sourceType = 'CUSTOMER_PAYMENT' AND sourceId = ? LIMIT 1`,
      [recebimento.id]
    );
    
    if (existing.length > 0) {
      console.log(`   ⏭️  Recebimento #${recebimento.id} já contabilizado`);
      continue;
    }
    
    // Criar journal
    const journalId = await createJournal({
      competenceMonth,
      description: `Recebimento - ${customerName}`,
      sourceType: 'CUSTOMER_PAYMENT',
      sourceId: recebimento.id
    });
    
    // D - Caixa
    await createEntry(journalId, {
      accountId: ACCOUNTS.CAIXA,
      entryDate: recebimento.paidDate,
      competenceMonth,
      amount: amount.toFixed(2),
      entryType: 'D',
      description: `Recebimento - ${customerName}`,
      sourceType: 'CUSTOMER_PAYMENT',
      sourceId: recebimento.id
    });
    
    // C - Clientes
    await createEntry(journalId, {
      accountId: ACCOUNTS.CLIENTES,
      entryDate: recebimento.paidDate,
      competenceMonth,
      amount: amount.toFixed(2),
      entryType: 'C',
      description: `Recebimento - ${customerName}`,
      sourceType: 'CUSTOMER_PAYMENT',
      sourceId: recebimento.id
    });
    
    console.log(`   ✅ Recebimento #${recebimento.id}: R$ ${amount.toFixed(2)}`);
  }
}

// =====================================================
// EXECUÇÃO PRINCIPAL
// =====================================================
async function main() {
  console.log('🔄 Iniciando Retroação Contábil - Janeiro e Fevereiro 2026');
  console.log('=' .repeat(60));
  
  try {
    connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    // Verificar IDs das contas
    console.log('\n📋 Verificando contas contábeis...');
    const [contas] = await connection.execute(`
      SELECT id, code, name FROM chartOfAccounts 
      WHERE id IN (?, ?, ?, ?, ?, ?, ?, ?)
    `, [ACCOUNTS.CAIXA, ACCOUNTS.CLIENTES, ACCOUNTS.ESTOQUE, ACCOUNTS.FORNECEDORES, ACCOUNTS.RECEITA_BALCAO, ACCOUNTS.RECEITA_APRAZO, ACCOUNTS.RECEITA_DELIVERY, ACCOUNTS.CMV]);
    
    console.log('   Contas encontradas:');
    for (const conta of contas) {
      console.log(`   - ${conta.code}: ${conta.name} (ID: ${conta.id})`);
    }
    
    if (contas.length < 8) {
      console.error('\n❌ ERRO: Algumas contas contábeis não foram encontradas!');
      console.log('   Por favor, verifique os IDs das contas no plano de contas.');
      process.exit(1);
    }
    
    // Executar retroação
    await contabilizarCompras();
    await contabilizarPagamentosCompras();
    await contabilizarVendas();
    await contabilizarRecebimentos();
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Retroação Contábil Concluída!');
    console.log(`   Journals criados: ${journalCounter}`);
    console.log(`   Lançamentos criados: ${entryCounter}`);
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
