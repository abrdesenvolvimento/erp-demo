/**
 * Script para importar contas gerenciais e mapeamentos contábeis
 * Baseado no plano aprovado pela contabilidade
 */

import mysql from 'mysql2/promise';

// Estrutura de códigos contábeis:
// 3.1.xx.xxx - Custos Operacionais (impactam margem)
// 3.2.xx.xxx - Despesas Operacionais
// 3.3.xx.xxx - Despesas Administrativas
// 3.4.xx.xxx - Despesas Comerciais
// 3.5.xx.xxx - Despesas Financeiras
// 3.6.xx.xxx - Despesas Não Operacionais
// 1.x.xx.xxx - Contas Patrimoniais (Ativo)

const managementAccounts = [
  // CUSTOS OPERACIONAIS (3.1.xx.xxx) - Impactam Margem
  { code: 'COP001', name: 'Embalagens', nature: 'CUSTO', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: true, impactPayroll: true, accountingCode: '3.1.01.001', accountingName: 'Embalagens' },
  { code: 'COP002', name: 'Material de Limpeza', nature: 'CUSTO', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: true, impactPayroll: true, accountingCode: '3.1.01.002', accountingName: 'Material de Limpeza' },
  { code: 'COP003', name: 'Gás Encanado', nature: 'CUSTO', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: true, impactPayroll: true, accountingCode: '3.1.01.003', accountingName: 'Gás Encanado' },
  { code: 'COP004', name: 'Fretes', nature: 'CUSTO', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: true, impactPayroll: true, accountingCode: '3.1.01.004', accountingName: 'Fretes' },
  { code: 'COP005', name: 'Aluguel de Equipamentos', nature: 'CUSTO', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: true, impactPayroll: true, accountingCode: '3.1.01.005', accountingName: 'Aluguel de Equipamentos' },
  { code: 'COP006', name: 'Material de Consumo', nature: 'CUSTO', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: true, impactPayroll: true, accountingCode: '3.1.01.006', accountingName: 'Material de Consumo' },
  { code: 'COP007', name: 'Terceirizado', nature: 'CUSTO', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: true, impactPayroll: true, accountingCode: '3.1.01.007', accountingName: 'Terceirizado' },
  { code: 'COP008', name: 'PJ', nature: 'CUSTO', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: true, impactPayroll: true, accountingCode: '3.1.01.008', accountingName: 'PJ' },
  { code: 'COP009', name: 'Equipamentos', nature: 'CUSTO', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: true, impactPayroll: true, accountingCode: '3.1.01.009', accountingName: 'Equipamentos' },
  { code: 'COP010', name: 'Perdas Estoque', nature: 'CUSTO', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: true, impactPayroll: false, accountingCode: '3.1.02.001', accountingName: 'Perdas de Estoque' },
  { code: 'COP011', name: 'Perdas Operacionais', nature: 'CUSTO', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: true, impactPayroll: false, accountingCode: '3.1.02.002', accountingName: 'Perdas Operacionais' },
  { code: 'COP012', name: 'Manutenção das Instalações', nature: 'CUSTO', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: true, impactPayroll: true, accountingCode: '3.1.03.001', accountingName: 'Manutenção das Instalações' },

  // DESPESAS OPERACIONAIS (3.2.xx.xxx)
  { code: 'DOP001', name: 'Aluguel', nature: 'DESPESA', costType: 'FIXA', classification: 'OPERACIONAL', impactMargin: false, impactPayroll: false, accountingCode: '3.2.01.001', accountingName: 'Aluguel' },
  { code: 'DOP002', name: 'Energia Elétrica', nature: 'DESPESA', costType: 'FIXA', classification: 'OPERACIONAL', impactMargin: false, impactPayroll: false, accountingCode: '3.2.01.002', accountingName: 'Energia Elétrica' },
  { code: 'DOP003', name: 'Água', nature: 'DESPESA', costType: 'FIXA', classification: 'OPERACIONAL', impactMargin: false, impactPayroll: false, accountingCode: '3.2.01.003', accountingName: 'Água' },
  { code: 'DOP004', name: 'IPTU', nature: 'DESPESA', costType: 'FIXA', classification: 'OPERACIONAL', impactMargin: false, impactPayroll: false, accountingCode: '3.2.01.004', accountingName: 'IPTU' },
  { code: 'DOP005', name: 'Internet', nature: 'DESPESA', costType: 'FIXA', classification: 'OPERACIONAL', impactMargin: false, impactPayroll: false, accountingCode: '3.2.01.005', accountingName: 'Internet' },
  { code: 'DOP006', name: 'Telefone', nature: 'DESPESA', costType: 'FIXA', classification: 'OPERACIONAL', impactMargin: false, impactPayroll: false, accountingCode: '3.2.01.006', accountingName: 'Telefone' },
  { code: 'DOP007', name: 'Seguro Empresa', nature: 'DESPESA', costType: 'FIXA', classification: 'OPERACIONAL', impactMargin: false, impactPayroll: false, accountingCode: '3.2.01.007', accountingName: 'Seguro Empresa' },
  { code: 'DOP008', name: 'Manutenção de Equipamentos', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: false, impactPayroll: false, accountingCode: '3.2.02.001', accountingName: 'Manutenção de Equipamentos' },
  { code: 'DOP009', name: 'Copa e Limpeza', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'OPERACIONAL', impactMargin: false, impactPayroll: false, accountingCode: '3.2.02.002', accountingName: 'Copa e Limpeza' },

  // DESPESAS ADMINISTRATIVAS (3.3.xx.xxx)
  { code: 'DAD001', name: 'Consultoria e Assessoria', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.01.001', accountingName: 'Consultoria e Assessoria' },
  { code: 'DAD002', name: 'Software e Sistemas', nature: 'DESPESA', costType: 'FIXA', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.01.002', accountingName: 'Software e Sistemas' },
  { code: 'DAD003', name: 'Contabilidade', nature: 'DESPESA', costType: 'FIXA', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.01.003', accountingName: 'Contabilidade' },
  { code: 'DAD004', name: 'Jurídico', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.01.004', accountingName: 'Jurídico' },
  { code: 'DAD005', name: 'Marcas e Patentes', nature: 'DESPESA', costType: 'FIXA', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.01.005', accountingName: 'Marcas e Patentes' },
  { code: 'DAD006', name: 'Treinamento', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.01.006', accountingName: 'Treinamento' },
  { code: 'DAD007', name: 'Serviços de RH', nature: 'DESPESA', costType: 'FIXA', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.01.007', accountingName: 'Serviços de RH' },
  { code: 'DAD008', name: 'Pró-Labore', nature: 'DESPESA', costType: 'FIXA', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.02.001', accountingName: 'Pró-Labore' },
  { code: 'DAD009', name: 'Salários', nature: 'DESPESA', costType: 'FIXA', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: true, accountingCode: '3.3.02.002', accountingName: 'Salários' },
  { code: 'DAD010', name: 'Premiação', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.02.003', accountingName: 'Premiação' },
  { code: 'DAD011', name: 'Vale Transporte', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.02.004', accountingName: 'Vale Transporte' },
  { code: 'DAD012', name: 'Vale Refeição', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.02.005', accountingName: 'Vale Refeição' },
  { code: 'DAD013', name: 'Hora Extra', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: true, accountingCode: '3.3.02.006', accountingName: 'Hora Extra' },
  { code: 'DAD014', name: 'Seguro de Vida', nature: 'DESPESA', costType: 'FIXA', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.02.007', accountingName: 'Seguro de Vida' },
  { code: 'DAD015', name: 'FGTS', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.02.008', accountingName: 'FGTS' },
  { code: 'DAD016', name: 'INSS', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.02.009', accountingName: 'INSS' },
  { code: 'DAD017', name: 'Viagens', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.03.001', accountingName: 'Viagens' },
  { code: 'DAD018', name: 'Material de Escritório', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.03.002', accountingName: 'Material de Escritório' },
  { code: 'DAD019', name: 'Reembolso de Despesas', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.03.003', accountingName: 'Reembolso de Despesas' },
  { code: 'DAD020', name: 'Imóvel Alugado', nature: 'DESPESA', costType: 'FIXA', classification: 'ADMINISTRATIVA', impactMargin: false, impactPayroll: false, accountingCode: '3.3.03.004', accountingName: 'Imóvel Alugado' },

  // DESPESAS COMERCIAIS (3.4.xx.xxx)
  { code: 'DCO001', name: 'Propaganda', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'COMERCIAL', impactMargin: false, impactPayroll: false, accountingCode: '3.4.01.001', accountingName: 'Propaganda' },

  // DESPESAS FINANCEIRAS (3.5.xx.xxx)
  { code: 'DFI001', name: 'Tarifa Cartões', nature: 'CUSTO', costType: 'VARIAVEL', classification: 'FINANCEIRA', impactMargin: true, impactPayroll: false, accountingCode: '3.5.01.001', accountingName: 'Tarifa Cartões' },
  { code: 'DFI002', name: 'Despesa Bancária', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'FINANCEIRA', impactMargin: false, impactPayroll: false, accountingCode: '3.5.01.002', accountingName: 'Despesa Bancária' },
  { code: 'DFI003', name: 'Despesas com Juros', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'FINANCEIRA', impactMargin: false, impactPayroll: false, accountingCode: '3.5.01.003', accountingName: 'Despesas com Juros' },

  // DESPESAS NÃO OPERACIONAIS (3.6.xx.xxx)
  { code: 'DNO001', name: 'Reclamação Trabalhista', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'NAO_OPERACIONAL', impactMargin: false, impactPayroll: false, accountingCode: '3.6.01.001', accountingName: 'Reclamação Trabalhista' },
  { code: 'DNO002', name: 'Despesas Extra', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'NAO_OPERACIONAL', impactMargin: false, impactPayroll: false, accountingCode: '3.6.01.002', accountingName: 'Despesas Extra' },
  { code: 'DNO003', name: 'IR / CSLL', nature: 'DESPESA', costType: 'VARIAVEL', classification: 'NAO_OPERACIONAL', impactMargin: false, impactPayroll: false, accountingCode: '3.6.01.003', accountingName: 'IR / CSLL' },

  // CONTAS PATRIMONIAIS (1.x.xx.xxx)
  { code: 'PAT001', name: 'Imobilizados Equipamentos', nature: 'PATRIMONIAL', costType: null, classification: 'PATRIMONIAL', impactMargin: false, impactPayroll: false, accountingCode: '1.2.01.001', accountingName: 'Imobilizado - Equipamentos' },
  { code: 'PAT002', name: 'Imobilizados Benfeitoria', nature: 'PATRIMONIAL', costType: null, classification: 'PATRIMONIAL', impactMargin: false, impactPayroll: false, accountingCode: '1.2.01.002', accountingName: 'Imobilizado - Benfeitorias' },
];

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('🚀 Iniciando importação de contas gerenciais...\n');
  
  try {
    // Limpar tabelas existentes (se necessário)
    console.log('🗑️  Limpando dados existentes...');
    await connection.execute('DELETE FROM accountingMappings');
    await connection.execute('DELETE FROM managementAccounts');
    
    // Inserir contas gerenciais
    console.log('\n📝 Inserindo contas gerenciais...');
    let order = 1;
    
    for (const account of managementAccounts) {
      // Inserir conta gerencial
      const [result] = await connection.execute(
        `INSERT INTO managementAccounts 
         (code, name, description, nature, costType, classification, impactMargin, impactPayroll, isActive, displayOrder)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, true, ?)`,
        [
          account.code,
          account.name,
          account.name, // description = name por padrão
          account.nature,
          account.costType,
          account.classification,
          account.impactMargin,
          account.impactPayroll,
          order++
        ]
      );
      
      const managementAccountId = result.insertId;
      
      // Inserir mapeamento contábil
      await connection.execute(
        `INSERT INTO accountingMappings 
         (managementAccountId, accountingCode, accountingName, effectiveDate)
         VALUES (?, ?, ?, '2026-01-01 00:00:00')`,
        [
          managementAccountId,
          account.accountingCode,
          account.accountingName
        ]
      );
      
      console.log(`  ✅ ${account.code} - ${account.name} → ${account.accountingCode}`);
    }
    
    console.log(`\n✅ Importação concluída! ${managementAccounts.length} contas gerenciais importadas.`);
    
    // Verificar importação
    const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM managementAccounts');
    const [mappingCount] = await connection.execute('SELECT COUNT(*) as total FROM accountingMappings');
    
    console.log(`\n📊 Resumo:`);
    console.log(`   - Contas Gerenciais: ${countResult[0].total}`);
    console.log(`   - Mapeamentos Contábeis: ${mappingCount[0].total}`);
    
  } catch (error) {
    console.error('❌ Erro na importação:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
