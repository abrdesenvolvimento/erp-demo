import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar todas as contas
const [accounts] = await conn.execute(`
  SELECT id, code, name, level, nature, isAnalytical
  FROM chartOfAccounts
  WHERE isActive = 1
  ORDER BY displayOrder
`);

// Buscar saldos das contas analíticas
const [saldos] = await conn.execute(`
  SELECT 
    ae.accountId,
    COALESCE(SUM(CASE WHEN ae.entryType = 'D' THEN ae.amount ELSE 0 END), 0) as debit,
    COALESCE(SUM(CASE WHEN ae.entryType = 'C' THEN ae.amount ELSE 0 END), 0) as credit
  FROM accountingEntries ae
  INNER JOIN journals j ON ae.journalId = j.id
  WHERE ae.companyId = 1
    AND j.status = 'POSTED'
    AND ae.competenceMonth = '2026-02'
  GROUP BY ae.accountId
`);

console.log('=== SALDOS DAS CONTAS ANALÍTICAS ===');
console.log(JSON.stringify(saldos, null, 2));

// Criar mapa de saldos
const saldoMap = new Map();
for (const s of saldos) {
  saldoMap.set(s.accountId, {
    debit: parseFloat(s.debit),
    credit: parseFloat(s.credit)
  });
}

// Montar balancete com hierarquia
const balanceItems = accounts.map(account => {
  const saldo = saldoMap.get(account.id) || { debit: 0, credit: 0 };
  const balance = account.nature === 'DEVEDORA'
    ? saldo.debit - saldo.credit
    : saldo.credit - saldo.debit;
  
  return {
    accountId: account.id,
    code: account.code,
    name: account.name,
    level: account.level,
    nature: account.nature,
    isAnalytical: account.isAnalytical === 1,
    debit: saldo.debit,
    credit: saldo.credit,
    balance
  };
});

// Calcular saldos das contas sintéticas (soma dos filhos)
const maxLevel = Math.max(...balanceItems.map(b => b.level));

for (let level = maxLevel - 1; level >= 1; level--) {
  for (const item of balanceItems.filter(b => b.level === level)) {
    // Encontrar filhos diretos
    const children = balanceItems.filter(b => 
      b.code.startsWith(item.code + '.') && 
      b.level === level + 1
    );
    
    item.debit = children.reduce((sum, c) => sum + c.debit, 0);
    item.credit = children.reduce((sum, c) => sum + c.credit, 0);
    item.balance = item.nature === 'DEVEDORA'
      ? item.debit - item.credit
      : item.credit - item.debit;
  }
}

// Filtrar apenas grupos 4, 5 e 6 (Receitas, Custos, Despesas)
const receitas = balanceItems.filter(b => b.code.startsWith('4'));
const custos = balanceItems.filter(b => b.code.startsWith('5'));
const despesas = balanceItems.filter(b => b.code.startsWith('6'));

console.log('\n=== RECEITAS (Grupo 4) ===');
receitas.forEach(r => {
  if (r.balance !== 0) {
    console.log(`${r.code} - ${r.name}: ${r.balance}`);
  }
});

console.log('\n=== CUSTOS (Grupo 5) ===');
custos.forEach(c => {
  if (c.balance !== 0) {
    console.log(`${c.code} - ${c.name}: ${c.balance}`);
  }
});

console.log('\n=== DESPESAS (Grupo 6) ===');
despesas.forEach(d => {
  if (d.balance !== 0) {
    console.log(`${d.code} - ${d.name}: ${d.balance}`);
  }
});

// Calcular totais
const totalReceitas = receitas.find(r => r.code === '4')?.balance || 0;
const totalCustos = custos.find(c => c.code === '5')?.balance || 0;
const totalDespesas = despesas.find(d => d.code === '6')?.balance || 0;

console.log('\n=== TOTAIS ===');
console.log(`Total Receitas: ${totalReceitas}`);
console.log(`Total Custos: ${totalCustos}`);
console.log(`Total Despesas: ${totalDespesas}`);
console.log(`Lucro Bruto: ${totalReceitas - totalCustos}`);
console.log(`Resultado: ${totalReceitas - totalCustos - totalDespesas}`);

await conn.end();
