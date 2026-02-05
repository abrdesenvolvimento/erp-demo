/**
 * Script para atualizar mapeamentos de contas gerenciais para contas contábeis
 * Os mapeamentos atuais usam códigos do grupo 3.x que não existem no plano de contas
 * Precisamos mapear para os grupos corretos: 5.x (Custos) e 6.x (Despesas)
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Mapeamento de códigos gerenciais para contas contábeis corretas
const MAPPINGS = {
  // CUSTOS OPERACIONAIS (COP) -> Grupo 5
  'COP001': '5.2.1.01', // Embalagens
  'COP002': '5.2.1.02', // Material de Limpeza
  'COP003': '5.2.1.03', // Gás Encanado
  'COP004': '5.2.1.04', // Fretes
  'COP005': '5.2.1.05', // Aluguel de Equipamentos -> Material de Consumo (mais próximo)
  'COP006': '5.2.1.05', // Material de Consumo
  'COP007': '5.2.1.05', // Terceirizado -> Material de Consumo
  'COP008': '5.2.1.05', // PJ -> Material de Consumo
  'COP009': '5.2.1.05', // Equipamentos -> Material de Consumo
  'COP010': '5.2.2.01', // Perdas Estoque
  'COP011': '5.2.2.02', // Perdas Operacionais
  'COP012': '5.3.1.01', // Manutenção das Instalações
  
  // DESPESAS OPERACIONAIS (DOP) -> Grupo 6.1.1
  'DOP001': '6.1.1.01', // Aluguel
  'DOP002': '6.1.1.03', // Energia Elétrica
  'DOP003': '6.1.1.04', // Água
  'DOP004': '6.1.1.02', // IPTU
  'DOP005': '6.1.2.02', // Internet -> Software e Sistemas
  'DOP006': '6.1.2.02', // Telefone -> Software e Sistemas
  'DOP007': '6.1.1.01', // Seguro Empresa -> Aluguel (ocupação)
  'DOP008': '5.3.1.01', // Manutenção de Equipamentos -> Manutenção
  'DOP009': '5.2.1.02', // Copa e Limpeza -> Material de Limpeza
  
  // DESPESAS ADMINISTRATIVAS (DAD) -> Grupo 6.1.2
  'DAD001': '6.1.2.01', // Consultoria e Assessoria
  'DAD002': '6.1.2.02', // Software e Sistemas
  'DAD003': '6.1.2.03', // Contabilidade
  'DAD004': '6.1.2.01', // Jurídico -> Consultoria
  'DAD005': '6.1.2.01', // Marcas e Patentes -> Consultoria
  'DAD006': '6.4.1.03', // Treinamento -> Benefícios
  'DAD007': '6.4.1.01', // Serviços de RH -> Salários
  'DAD008': '6.4.1.01', // Pró-Labore -> Salários
  'DAD009': '6.4.1.01', // Salários
  'DAD010': '6.4.1.03', // Premiação -> Benefícios
  'DAD011': '6.4.1.03', // Vale Transporte -> Benefícios
  'DAD012': '6.4.1.03', // Vale Refeição -> Benefícios
  'DAD013': '6.4.1.01', // Hora Extra -> Salários
  'DAD014': '6.4.1.03', // Seguro de Vida -> Benefícios
  'DAD015': '6.4.1.02', // FGTS -> Encargos Sociais
  'DAD016': '6.4.1.02', // INSS -> Encargos Sociais
  'DAD017': '6.1.2.01', // Viagens -> Consultoria
  'DAD018': '6.1.2.02', // Material de Escritório -> Software e Sistemas
  'DAD019': '6.1.2.01', // Reembolso de Despesas -> Consultoria
  'DAD020': '6.1.1.01', // Imóvel Alugado -> Aluguel
  
  // DESPESAS COMERCIAIS (DCO) -> Grupo 6.2
  'DCO001': '6.2.1.01', // Propaganda -> Marketing e Publicidade
  
  // DESPESAS FINANCEIRAS (DFI) -> Grupo 6.3
  'DFI001': '6.3.1.03', // Tarifa Cartões -> Taxas de Cartão
  'DFI002': '6.3.1.02', // Despesa Bancária -> Tarifas Bancárias
  'DFI003': '6.3.1.01', // Despesas com Juros -> Juros Pagos
  
  // DESPESAS NÃO OPERACIONAIS (DNO) -> Grupo 6.3 (mais próximo)
  'DNO001': '6.4.1.02', // Reclamação Trabalhista -> Encargos Sociais
  'DNO002': '6.3.1.01', // Despesas Extra -> Juros Pagos
  'DNO003': '6.3.1.02', // IR / CSLL -> Tarifas Bancárias
};

async function main() {
  console.log('Atualizando mapeamentos de contas gerenciais...\n');
  
  // Buscar contas gerenciais
  const [accounts] = await conn.execute(`
    SELECT id, code, name FROM managementAccounts 
    WHERE nature IN ('DESPESA', 'CUSTO')
  `);
  
  let updated = 0;
  let created = 0;
  
  for (const account of accounts) {
    const newCode = MAPPINGS[account.code];
    if (!newCode) {
      console.log(`  ⚠️ ${account.code} ${account.name}: sem mapeamento definido`);
      continue;
    }
    
    // Verificar se já existe mapeamento
    const [existing] = await conn.execute(
      `SELECT id FROM accountingMappings WHERE managementAccountId = ?`,
      [account.id]
    );
    
    if (existing.length > 0) {
      // Atualizar mapeamento existente
      await conn.execute(
        `UPDATE accountingMappings SET accountingCode = ? WHERE managementAccountId = ?`,
        [newCode, account.id]
      );
      updated++;
      console.log(`  ✅ ${account.code} ${account.name} -> ${newCode} (atualizado)`);
    } else {
      // Criar novo mapeamento
      await conn.execute(
        `INSERT INTO accountingMappings (managementAccountId, accountingCode) VALUES (?, ?)`,
        [account.id, newCode]
      );
      created++;
      console.log(`  ✅ ${account.code} ${account.name} -> ${newCode} (criado)`);
    }
  }
  
  console.log(`\n✅ Mapeamentos atualizados: ${updated}`);
  console.log(`✅ Mapeamentos criados: ${created}`);
  
  await conn.end();
}

main().catch(console.error);
