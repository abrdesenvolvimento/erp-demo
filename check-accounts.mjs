import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Ver contas de estoque
const [accounts] = await connection.execute("SELECT id, code, name FROM chartOfAccounts WHERE code LIKE '1.1.3%' LIMIT 10");
console.log('=== CONTAS DE ESTOQUE ===');
console.log(JSON.stringify(accounts, null, 2));

// Ver lançamentos para essas contas
if (accounts.length > 0) {
  const accountIds = accounts.map(a => a.id).join(',');
  const [entries] = await connection.execute(`SELECT ae.*, j.status as journalStatus FROM accountingEntries ae LEFT JOIN journals j ON ae.journalId = j.id WHERE ae.accountId IN (${accountIds}) ORDER BY ae.id DESC LIMIT 20`);
  console.log('\n=== LANÇAMENTOS PARA CONTAS DE ESTOQUE ===');
  console.log(JSON.stringify(entries, null, 2));
}

// Ver conta 4 (Caixa) que aparece nos lançamentos
const [caixa] = await connection.execute("SELECT id, code, name FROM chartOfAccounts WHERE id = 4");
console.log('\n=== CONTA ID 4 ===');
console.log(JSON.stringify(caixa, null, 2));

// Ver lançamentos para conta 4
const [entriesCaixa] = await connection.execute("SELECT ae.*, j.status as journalStatus FROM accountingEntries ae LEFT JOIN journals j ON ae.journalId = j.id WHERE ae.accountId = 4 ORDER BY ae.id DESC LIMIT 10");
console.log('\n=== LANÇAMENTOS PARA CONTA 4 ===');
console.log(JSON.stringify(entriesCaixa, null, 2));

await connection.end();
