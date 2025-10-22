import { getDb } from './server/db.js';

const db = getDb();

// Ver a estrutura da tabela
const result = await db.execute('DESCRIBE productCompositions');
console.log('Estrutura da tabela productCompositions:');
console.log(result);

// Ver as composições do Dose Gin Dober
const compositions = await db.execute(`
  SELECT * FROM productCompositions 
  WHERE productId = (SELECT id FROM products WHERE name LIKE '%Dose Gin Dober%')
`);
console.log('\nComposições do Dose Gin Dober:');
console.log(compositions);

process.exit(0);
