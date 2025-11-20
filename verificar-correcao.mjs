import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const [result] = await connection.execute(
  'SELECT id, name, currentStock FROM products WHERE id = 510003'
);

if (result.length > 0) {
  console.log('✅ Produto 510003 após correção:');
  console.log(`   Nome: ${result[0].name}`);
  console.log(`   Estoque: ${result[0].currentStock} unidades`);
  
  if (result[0].currentStock === 33) {
    console.log('\n🎉 CORREÇÃO APLICADA COM SUCESSO!');
  } else {
    console.log(`\n⚠️ Estoque ainda incorreto: ${result[0].currentStock} (esperado: 33)`);
  }
}

await connection.end();
