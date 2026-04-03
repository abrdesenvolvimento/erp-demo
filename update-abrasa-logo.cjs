const mysql = require('mysql2/promise');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.error('No DATABASE_URL'); process.exit(1); }
  
  const conn = await mysql.createConnection(dbUrl);
  
  const [rows] = await conn.execute('SELECT id, name, tradeName, logoUrl FROM companies');
  console.log('Companies:');
  rows.forEach(r => console.log(`  id=${r.id} | ${r.tradeName || r.name} | logo=${r.logoUrl}`));
  
  const newLogoUrl = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663140687549/7RkrCeS5KipYf8hkuNqrCk/logo-abrasa-reune-v2_862dd2da.svg';
  const [result] = await conn.execute('UPDATE companies SET logoUrl = ? WHERE id = 2', [newLogoUrl]);
  console.log('\nUpdated rows:', result.affectedRows);
  
  const [updated] = await conn.execute('SELECT id, tradeName, logoUrl FROM companies WHERE id = 2');
  console.log('New logo URL:', updated[0].logoUrl);
  
  await conn.end();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
