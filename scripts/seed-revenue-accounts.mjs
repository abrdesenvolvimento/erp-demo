/**
 * Script para criar contas gerenciais de Receita
 * Baseado nas contas contábeis do grupo 4 (Receitas)
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL não encontrada');
  process.exit(1);
}

// Contas gerenciais de Receita a serem criadas
const revenueAccounts = [
  // Receitas Operacionais
  { code: 'ROP001', name: 'Receita de Vendas (Balcão)', classification: 'OPERACIONAL', accountingCode: '4.1.1.01' },
  { code: 'ROP002', name: 'Receita de Vendas (A Prazo)', classification: 'OPERACIONAL', accountingCode: '4.1.1.02' },
  { code: 'ROP003', name: 'Receita de Vendas (Delivery)', classification: 'OPERACIONAL', accountingCode: '4.1.1.03' },
  
  // Outras Receitas Operacionais
  { code: 'ROR001', name: 'Receita de Aluguel', classification: 'OPERACIONAL', accountingCode: '4.2.1.01' },
  { code: 'ROR002', name: 'Receita de Serviços', classification: 'OPERACIONAL', accountingCode: '4.2.1.02' },
  { code: 'ROR003', name: 'Outras Receitas', classification: 'OPERACIONAL', accountingCode: '4.2.1.03' },
  
  // Receitas Financeiras
  { code: 'RFI001', name: 'Juros Recebidos', classification: 'FINANCEIRA', accountingCode: '4.3.1.01' },
  { code: 'RFI002', name: 'Descontos Obtidos', classification: 'FINANCEIRA', accountingCode: '4.3.1.02' },
];

async function main() {
  // Extrair partes da URL
  const url = new URL(DATABASE_URL);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1).split('?')[0],
    ssl: DATABASE_URL.includes('ssl=') ? { rejectUnauthorized: false } : undefined
  });

  console.log('Conectado ao banco de dados');

  try {
    // Obter próximo displayOrder
    const [maxOrderResult] = await connection.query(
      'SELECT MAX(displayOrder) as maxOrder FROM managementAccounts'
    );
    let nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;

    for (const account of revenueAccounts) {
      // Verificar se já existe
      const [existing] = await connection.query(
        'SELECT id FROM managementAccounts WHERE code = ?',
        [account.code]
      );

      if (existing.length > 0) {
        console.log(`Conta ${account.code} já existe, pulando...`);
        continue;
      }

      // Inserir conta gerencial
      const [result] = await connection.query(
        `INSERT INTO managementAccounts (code, name, description, nature, costType, classification, impactMargin, impactPayroll, isActive, displayOrder)
         VALUES (?, ?, ?, 'RECEITA', NULL, ?, 0, 0, 1, ?)`,
        [account.code, account.name, account.name, account.classification, nextOrder++]
      );

      const managementAccountId = result.insertId;
      console.log(`Criada conta gerencial: ${account.code} - ${account.name} (ID: ${managementAccountId})`);

      // Criar mapeamento com conta contábil
      const [mappingResult] = await connection.query(
        `INSERT INTO accountingMappings (managementAccountId, accountingCode, effectiveDate)
         VALUES (?, ?, NOW())`,
        [managementAccountId, account.accountingCode]
      );

      console.log(`  -> Amarrada à conta contábil: ${account.accountingCode}`);
    }

    console.log('\\nContas gerenciais de receita criadas com sucesso!');
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await connection.end();
  }
}

main();
