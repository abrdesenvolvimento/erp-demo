/**
 * Script para corrigir parentCode das contas no Plano de Contas
 * Deriva o parentCode a partir do código da conta
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Buscar todas as contas
    const [accounts] = await connection.execute(
      'SELECT id, code, level, parentCode FROM chartOfAccounts ORDER BY code'
    );
    
    console.log(`Total de contas: ${accounts.length}`);
    
    let updated = 0;
    
    for (const account of accounts) {
      // Nível 1 não tem parent
      if (account.level === 1) continue;
      
      // Derivar parentCode a partir do código
      const parts = account.code.split('.');
      parts.pop(); // Remove o último segmento
      const expectedParentCode = parts.join('.');
      
      if (account.parentCode !== expectedParentCode) {
        await connection.execute(
          'UPDATE chartOfAccounts SET parentCode = ? WHERE id = ?',
          [expectedParentCode, account.id]
        );
        console.log(`Atualizado: ${account.code} -> parentCode: ${expectedParentCode}`);
        updated++;
      }
    }
    
    console.log(`\nTotal atualizado: ${updated}`);
    
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
