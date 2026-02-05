import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Ver journals
const [journals] = await connection.execute('SELECT * FROM journals ORDER BY id DESC LIMIT 20');
console.log('=== JOURNALS ===');
console.log(JSON.stringify(journals, null, 2));

// Ver accountingEntries
const [entries] = await connection.execute('SELECT * FROM accountingEntries ORDER BY id DESC LIMIT 30');
console.log('\n=== ACCOUNTING ENTRIES ===');
console.log(JSON.stringify(entries, null, 2));

await connection.end();
