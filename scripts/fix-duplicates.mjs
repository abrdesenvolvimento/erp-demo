import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function fixDuplicates() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('=' .repeat(70));
  console.log('ETAPA 1: BACKUP DAS VENDAS DE MAI-AGO 2024');
  console.log('=' .repeat(70));
  
  // Fazer backup das vendas
  const [vendas] = await conn.execute(`
    SELECT * FROM sales 
    WHERE YEAR(saleDate) = 2024 
      AND MONTH(saleDate) BETWEEN 5 AND 8
  `);
  
  // Fazer backup dos itens de venda
  const [itens] = await conn.execute(`
    SELECT si.* FROM saleItems si
    INNER JOIN sales s ON si.saleId = s.id
    WHERE YEAR(s.saleDate) = 2024 
      AND MONTH(s.saleDate) BETWEEN 5 AND 8
  `);
  
  // Salvar backup em arquivo JSON
  const backup = {
    timestamp: new Date().toISOString(),
    sales: vendas,
    saleItems: itens
  };
  
  fs.writeFileSync('/home/ubuntu/backup_mai_ago_2024.json', JSON.stringify(backup, null, 2));
  console.log(`✅ Backup salvo: ${vendas.length} vendas e ${itens.length} itens`);
  console.log(`   Arquivo: /home/ubuntu/backup_mai_ago_2024.json`);
  
  await conn.end();
  console.log('\n✅ Backup concluído!');
}

fixDuplicates().catch(console.error);
