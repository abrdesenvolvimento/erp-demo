/**
 * Script de Migração de Despesas para Contas Gerenciais
 * Baseado no De-Para fornecido pelo usuário
 * 
 * Mapeamento:
 * - Aluguel → Aluguel
 * - Consultoria e Assessoria → Consultoria e Assessoria
 * - Software e Sistemas → Software e Sistemas
 * - Embalagens → Embalagens
 * - Tarifa Cartões → Tarifa Cartões
 * - Energia Elétrica → Energia Elétrica
 * - Manutenção de Equipamentos → Manutenção de Equipamentos
 * - Imóvel Alugado → Imóvel Alugado
 * - Despesa Bancária → Despesa Bancária
 * - Terceirizado → Terceirizado
 * - Pró-Labore → Pró-Labore
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(DATABASE_URL);
const config = {
  host: url.hostname,
  port: parseInt(url.port) || 4000,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: {
    rejectUnauthorized: true
  }
};

async function main() {
  const connection = await mysql.createConnection(config);
  
  try {
    console.log('Conectado ao banco de dados');
    
    // 1. Buscar todas as contas gerenciais
    const [accounts] = await connection.execute(
      `SELECT ma.id, ma.name, am.accountingCode 
       FROM managementAccounts ma
       LEFT JOIN accountingMappings am ON ma.id = am.managementAccountId`
    );
    
    console.log(`\nContas gerenciais encontradas: ${accounts.length}`);
    
    // Criar mapa de nome para ID e código contábil
    const accountMap = {};
    for (const acc of accounts) {
      accountMap[acc.name.toLowerCase()] = {
        id: acc.id,
        accountingCode: acc.accountingCode
      };
    }
    
    // 2. Buscar despesas sem conta gerencial
    const [expenses] = await connection.execute(
      `SELECT e.id, e.description, e.amount, p.name as supplierName
       FROM expenses e
       LEFT JOIN partners p ON e.supplierId = p.id
       WHERE e.status != 'CANCELADA' 
       AND (e.managementAccountId IS NULL OR e.accountingCode IS NULL)
       ORDER BY e.createdAt DESC`
    );
    
    console.log(`\nDespesas para migrar: ${expenses.length}`);
    
    // 3. Mapeamento De-Para baseado no arquivo Excel
    const deParaMap = {
      // Por fornecedor
      'jocineide pereira costa silva': 'aluguel',
      'jaine barros de oliveira': 'consultoria e assessoria',
      'manus ia': 'software e sistemas',
      'embrasplast comercio de utilidades ltda': 'embalagens',
      'picpay': 'tarifa cartões',
      'rm embalagens': 'embalagens',
      'rm osasco comercio de embalagens': 'embalagens',
      'enel': 'energia elétrica',
      'enel ': 'energia elétrica',
      'depósito cruzeiro do sul': 'imóvel alugado',
      'deposito cruzeiro do sul': 'imóvel alugado',
      'reginaldo faria coelho': 'imóvel alugado',
      'itau': 'despesa bancária',
      'studio teixeira arquitetura': 'imóvel alugado',
      'studio teixeira arquitetura ltda': 'imóvel alugado',
      'gabriel': 'pró-labore',
      'gabriel morais santos': 'pró-labore',
      'ricardo': 'pró-labore',
      
      // Adega Beira Rio - verificar descrição para determinar conta
      'adega beira rio': null,
      'adega beira rio comércio de bebidas ltda': null,
    };
    
    // Mapeamento por descrição (para casos especiais)
    const descriptionMap = {
      'manutenção': 'manutenção de equipamentos',
      'conserto': 'manutenção de equipamentos',
      'terceirizado': 'terceirizado',
      'limpeza': 'terceirizado',
      'gustavo': 'terceirizado',
      'caique': 'terceirizado',
      'frete': 'frete',
      'combustível': 'combustível',
      'gasolina': 'combustível',
      'internet': 'internet',
      'telefone': 'telefone',
      'água': 'água',
      'contador': 'contador',
      'contabilidade': 'contador',
      'energia': 'energia elétrica',
      'registro de dominio': 'software e sistemas',
      'domínio': 'software e sistemas',
      'projeto': 'imóvel alugado',
      'obra': 'imóvel alugado',
    };
    
    let migrated = 0;
    let skipped = 0;
    
    for (const expense of expenses) {
      const supplierName = (expense.supplierName || '').toLowerCase();
      const description = (expense.description || '').toLowerCase();
      
      let accountName = null;
      
      // Primeiro tentar pelo fornecedor
      if (deParaMap[supplierName] !== undefined) {
        accountName = deParaMap[supplierName];
      }
      
      // Se não encontrou ou é null (Adega Beira Rio), tentar pela descrição
      if (!accountName) {
        for (const [keyword, account] of Object.entries(descriptionMap)) {
          if (description.includes(keyword)) {
            accountName = account;
            break;
          }
        }
      }
      
      // Se ainda não encontrou, pular
      if (!accountName) {
        console.log(`  ⚠️ Não mapeado: ID ${expense.id} - ${expense.supplierName || 'Sem fornecedor'} - ${expense.description}`);
        skipped++;
        continue;
      }
      
      // Buscar conta gerencial
      const account = accountMap[accountName];
      if (!account) {
        console.log(`  ❌ Conta não encontrada: "${accountName}" para despesa ID ${expense.id}`);
        skipped++;
        continue;
      }
      
      // Atualizar despesa
      await connection.execute(
        `UPDATE expenses SET managementAccountId = ?, accountingCode = ? WHERE id = ?`,
        [account.id, account.accountingCode, expense.id]
      );
      
      console.log(`  ✅ Migrado: ID ${expense.id} - ${expense.description} → ${accountName} (${account.accountingCode})`);
      migrated++;
    }
    
    console.log(`\n========================================`);
    console.log(`Migração concluída!`);
    console.log(`  ✅ Migradas: ${migrated}`);
    console.log(`  ⚠️ Não mapeadas: ${skipped}`);
    console.log(`========================================`);
    
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
