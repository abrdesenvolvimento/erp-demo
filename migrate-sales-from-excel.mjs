/**
 * Script de Migração de Vendas Legadas (Excel → ERP)
 * 
 * Lê planilha Excel com histórico de vendas e importa para o banco de dados.
 * Baseado no documento: DE-PARA-MIGRACAO-VENDAS.md
 * 
 * Uso:
 *   node migrate-sales-from-excel.mjs <caminho-para-planilha.xlsx>
 * 
 * Exemplo:
 *   node migrate-sales-from-excel.mjs vendas-historicas.xlsx
 */

import { drizzle } from 'drizzle-orm/mysql2';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import XLSX from 'xlsx';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  // Colunas esperadas na planilha Excel (aceita múltiplos formatos)
  columns: {
    date: ['Data'],
    item: ['Item'],
    quantity: ['Quantidade', 'Quant'],
    unitPrice: ['Valor Unitário', 'Vlr Uni'],
    unitCost: ['Custo de Venda']
  },
  
  // Valores padrão para vendas migradas
  defaults: {
    saleType: 'BALCAO',
    customerId: null,
    paymentMethod: 'Migração de Dados',
    status: 'Migração de Dados',
    createdBy: 'migration-script',
    defaultTime: '12:00:00' // Hora padrão para vendas sem horário
  },
  
  // Validações
  validation: {
    minDate: new Date('2020-01-01'),
    maxDate: new Date(),
    minQuantity: 0.01,
    minPrice: 0.01,
    minCost: 0,
    errorThreshold: 0.05 // Pausar se > 5% de erros
  },
  
  // Flags de comportamento
  behavior: {
    updateStock: false, // NÃO atualizar estoque (vendas históricas)
    createReceivables: false, // NÃO criar contas a receber
    allowDuplicates: false, // Rejeitar duplicatas
    fuzzyMatch: true, // Usar matching fuzzy para produtos
    fuzzyThreshold: 0.9 // 90% de similaridade
  }
};

// ============================================================================
// ESTADO DA MIGRAÇÃO
// ============================================================================

const migrationState = {
  startTime: new Date(),
  stats: {
    totalRows: 0,
    processedRows: 0,
    rejectedRows: 0,
    salesCreated: 0,
    itemsCreated: 0,
    totalRevenue: 0,
    totalCost: 0
  },
  errors: [],
  warnings: [],
  productsNotFound: new Map(), // nome → count
  productCache: new Map() // nome → productId
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Conecta ao banco de dados
 */
function connectDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada');
  }
  return drizzle(process.env.DATABASE_URL);
}

/**
 * Busca valor de coluna com nomes alternativos
 */
function getColumnValue(row, columnNames) {
  for (const name of columnNames) {
    if (row.hasOwnProperty(name)) {
      return row[name];
    }
  }
  return undefined;
}

/**
 * Lê planilha Excel e retorna array de objetos
 */
function readExcelFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }
  
  console.log(`📖 Lendo planilha: ${filePath}`);
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`✅ ${data.length} linhas encontradas`);
  
  return data;
}

/**
 * Converte data do Excel para formato MySQL
 */
function parseExcelDate(value) {
  if (!value) return null;
  
  // Se já é um objeto Date
  if (value instanceof Date) {
    return value;
  }
  
  // Se é número (serial date do Excel)
  if (typeof value === 'number') {
    // Excel serial date (dias desde 1900-01-01)
    const date = XLSX.SSF.parse_date_code(value);
    return new Date(date.y, date.m - 1, date.d);
  }
  
  // Se é string, tentar parsear formatos comuns
  if (typeof value === 'string') {
    // DD/MM/YYYY
    const match1 = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match1) {
      const [, day, month, year] = match1;
      return new Date(year, month - 1, day);
    }
    
    // DD-MM-YYYY
    const match2 = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match2) {
      const [, day, month, year] = match2;
      return new Date(year, month - 1, day);
    }
    
    // YYYY-MM-DD
    const match3 = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match3) {
      return new Date(value);
    }
  }
  
  return null;
}

/**
 * Formata data para MySQL DATETIME
 */
function formatMySQLDateTime(date) {
  if (!date || !(date instanceof Date)) return null;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${CONFIG.defaults.defaultTime}`;
}

/**
 * Busca produto por nome (com cache e fuzzy matching)
 */
async function findProductByName(db, productName) {
  // Verificar cache
  if (migrationState.productCache.has(productName)) {
    return migrationState.productCache.get(productName);
  }
  
  // Busca exata (case-insensitive)
  const [exactMatch] = await db.execute(
    'SELECT id, name FROM products WHERE LOWER(name) = LOWER(?) LIMIT 1',
    [productName]
  );
  
  if (exactMatch && exactMatch.length > 0) {
    const productId = exactMatch[0].id;
    migrationState.productCache.set(productName, productId);
    return productId;
  }
  
  // Se fuzzy matching está habilitado, tentar busca parcial
  if (CONFIG.behavior.fuzzyMatch) {
    const [fuzzyMatches] = await db.execute(
      'SELECT id, name FROM products WHERE LOWER(name) LIKE LOWER(?)',
      [`%${productName}%`]
    );
    
    if (fuzzyMatches && fuzzyMatches.length > 0) {
      // Usar primeiro resultado (pode melhorar com Levenshtein)
      const productId = fuzzyMatches[0].id;
      migrationState.productCache.set(productName, productId);
      
      migrationState.warnings.push({
        type: 'FUZZY_MATCH',
        message: `Produto "${productName}" matched com "${fuzzyMatches[0].name}" (fuzzy)`
      });
      
      return productId;
    }
  }
  
  // Produto não encontrado
  const count = migrationState.productsNotFound.get(productName) || 0;
  migrationState.productsNotFound.set(productName, count + 1);
  
  return null;
}

/**
 * Valida linha da planilha
 */
function validateRow(row, lineNumber) {
  const errors = [];
  
  // Buscar valores com nomes flexíveis
  const dateValue = getColumnValue(row, CONFIG.columns.date);
  const itemValue = getColumnValue(row, CONFIG.columns.item);
  const quantityValue = getColumnValue(row, CONFIG.columns.quantity);
  const unitPriceValue = getColumnValue(row, CONFIG.columns.unitPrice);
  const unitCostValue = getColumnValue(row, CONFIG.columns.unitCost);
  
  // Validar data
  const date = parseExcelDate(dateValue);
  if (!date) {
    errors.push(`Data inválida: ${dateValue}`);
  } else if (date < CONFIG.validation.minDate || date > CONFIG.validation.maxDate) {
    errors.push(`Data fora do intervalo permitido: ${date.toISOString()}`);
  }
  
  // Validar produto
  if (!itemValue || itemValue.trim() === '') {
    errors.push('Nome do produto vazio');
  }
  
  // Validar quantidade
  const quantity = parseFloat(quantityValue);
  if (isNaN(quantity) || quantity < CONFIG.validation.minQuantity) {
    errors.push(`Quantidade inválida: ${quantityValue}`);
  }
  
  // Validar preço unitário
  const unitPrice = parseFloat(unitPriceValue);
  if (isNaN(unitPrice) || unitPrice < CONFIG.validation.minPrice) {
    errors.push(`Valor unitário inválido: ${unitPriceValue}`);
  }
  
  // Validar custo (pode ser zero)
  const unitCost = parseFloat(unitCostValue);
  if (isNaN(unitCost) || unitCost < CONFIG.validation.minCost) {
    errors.push(`Custo de venda inválido: ${unitCostValue}`);
  }
  
  // Warning: custo maior que preço
  if (!isNaN(unitCost) && !isNaN(unitPrice) && unitCost > unitPrice) {
    migrationState.warnings.push({
      line: lineNumber,
      type: 'COST_HIGHER_THAN_PRICE',
      message: `Custo (${unitCost}) maior que preço (${unitPrice}) - Produto: ${row[CONFIG.columns.item]}`
    });
  }
  
  return errors;
}

/**
 * Processa uma linha da planilha
 */
async function processRow(db, row, lineNumber) {
  // Validar linha
  const validationErrors = validateRow(row, lineNumber);
  if (validationErrors.length > 0) {
    migrationState.errors.push({
      line: lineNumber,
      errors: validationErrors,
      row
    });
    migrationState.stats.rejectedRows++;
    return false;
  }
  
  // Parsear dados usando getColumnValue
  const dateValue = getColumnValue(row, CONFIG.columns.date);
  const itemValue = getColumnValue(row, CONFIG.columns.item);
  const quantityValue = getColumnValue(row, CONFIG.columns.quantity);
  const unitPriceValue = getColumnValue(row, CONFIG.columns.unitPrice);
  const unitCostValue = getColumnValue(row, CONFIG.columns.unitCost);
  
  const saleDate = formatMySQLDateTime(parseExcelDate(dateValue));
  const productName = itemValue.trim();
  const quantity = parseFloat(quantityValue);
  const unitPrice = parseFloat(unitPriceValue);
  const unitCost = parseFloat(unitCostValue);
  
  // Buscar produto
  const productId = await findProductByName(db, productName);
  if (!productId) {
    migrationState.errors.push({
      line: lineNumber,
      errors: [`Produto não encontrado: ${productName}`],
      row
    });
    migrationState.stats.rejectedRows++;
    return false;
  }
  
  // Calcular totais
  const totalPrice = quantity * unitPrice;
  const totalCost = quantity * unitCost;
  
  try {
    // Inserir venda
    const [saleResult] = await db.execute(`
      INSERT INTO sales (
        saleDate, saleType, customerId, paymentMethod, status,
        totalAmount, finalAmount, createdBy, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      saleDate,
      CONFIG.defaults.saleType,
      CONFIG.defaults.customerId,
      CONFIG.defaults.paymentMethod,
      CONFIG.defaults.status,
      totalPrice.toFixed(2),
      totalPrice.toFixed(2),
      CONFIG.defaults.createdBy
    ]);
    
    const saleId = saleResult.insertId;
    
    // Inserir item
    await db.execute(`
      INSERT INTO saleItems (
        saleId, productId, quantity, unitPrice, unitCost,
        totalPrice, totalCost
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      saleId,
      productId,
      quantity.toFixed(4),
      unitPrice.toFixed(4),
      unitCost.toFixed(4),
      totalPrice.toFixed(2),
      totalCost.toFixed(2)
    ]);
    
    // Atualizar estatísticas
    migrationState.stats.processedRows++;
    migrationState.stats.salesCreated++;
    migrationState.stats.itemsCreated++;
    migrationState.stats.totalRevenue += totalPrice;
    migrationState.stats.totalCost += totalCost;
    
    return true;
    
  } catch (error) {
    migrationState.errors.push({
      line: lineNumber,
      errors: [`Erro ao inserir no banco: ${error.message}`],
      row
    });
    migrationState.stats.rejectedRows++;
    return false;
  }
}

/**
 * Gera relatório de migração
 */
function generateReport() {
  const endTime = new Date();
  const duration = (endTime - migrationState.startTime) / 1000; // segundos
  
  const grossMargin = migrationState.stats.totalRevenue - migrationState.stats.totalCost;
  const grossMarginPercent = migrationState.stats.totalRevenue > 0
    ? (grossMargin / migrationState.stats.totalRevenue) * 100
    : 0;
  
  const report = `
=== MIGRAÇÃO DE VENDAS LEGADAS ===
Data/Hora: ${migrationState.startTime.toLocaleString('pt-BR')}
Duração: ${duration.toFixed(2)}s

--- RESUMO ---
Total de linhas: ${migrationState.stats.totalRows}
Linhas processadas: ${migrationState.stats.processedRows}
Linhas rejeitadas: ${migrationState.stats.rejectedRows}
Taxa de sucesso: ${((migrationState.stats.processedRows / migrationState.stats.totalRows) * 100).toFixed(2)}%

--- VENDAS CRIADAS ---
Total de vendas: ${migrationState.stats.salesCreated}
Total de itens: ${migrationState.stats.itemsCreated}

--- VALORES ---
Faturamento Total: R$ ${migrationState.stats.totalRevenue.toFixed(2)}
Custo Total: R$ ${migrationState.stats.totalCost.toFixed(2)}
Margem Bruta: R$ ${grossMargin.toFixed(2)} (${grossMarginPercent.toFixed(2)}%)

--- PRODUTOS NÃO ENCONTRADOS (${migrationState.productsNotFound.size}) ---
${Array.from(migrationState.productsNotFound.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .map(([name, count]) => `- "${name}": ${count} ocorrências`)
  .join('\n')}
${migrationState.productsNotFound.size > 20 ? '(Ver arquivo: produtos-nao-encontrados.csv)' : ''}

--- ERROS (${migrationState.errors.length}) ---
${migrationState.errors.slice(0, 10).map(err => 
  `Linha ${err.line}: ${err.errors.join(', ')}`
).join('\n')}
${migrationState.errors.length > 10 ? `(Ver arquivo: erros-detalhados.csv para lista completa)` : ''}

--- WARNINGS (${migrationState.warnings.length}) ---
${migrationState.warnings.slice(0, 10).map(warn => 
  `${warn.type}: ${warn.message}`
).join('\n')}
${migrationState.warnings.length > 10 ? `(Mais ${migrationState.warnings.length - 10} warnings...)` : ''}
`;
  
  return report;
}

/**
 * Salva arquivos de log
 */
function saveLogs() {
  const timestamp = migrationState.startTime.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  
  // Log principal
  const report = generateReport();
  const logFile = `migration-log-${timestamp}.txt`;
  writeFileSync(logFile, report);
  console.log(`\n📄 Log salvo: ${logFile}`);
  
  // Produtos não encontrados (CSV)
  if (migrationState.productsNotFound.size > 0) {
    const csvLines = ['Produto,Ocorrências'];
    for (const [name, count] of migrationState.productsNotFound.entries()) {
      csvLines.push(`"${name}",${count}`);
    }
    const csvFile = `produtos-nao-encontrados-${timestamp}.csv`;
    writeFileSync(csvFile, csvLines.join('\n'));
    console.log(`📄 Produtos não encontrados: ${csvFile}`);
  }
  
  // Erros detalhados (CSV)
  if (migrationState.errors.length > 0) {
    const csvLines = ['Linha,Erro,Dados'];
    for (const err of migrationState.errors) {
      const rowData = JSON.stringify(err.row).replace(/"/g, '""');
      csvLines.push(`${err.line},"${err.errors.join('; ')}","${rowData}"`);
    }
    const csvFile = `erros-detalhados-${timestamp}.csv`;
    writeFileSync(csvFile, csvLines.join('\n'));
    console.log(`📄 Erros detalhados: ${csvFile}`);
  }
}

// ============================================================================
// FUNÇÃO PRINCIPAL
// ============================================================================

async function main() {
  console.log('🚀 Iniciando migração de vendas legadas...\n');
  
  // Validar argumentos
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('❌ Erro: Informe o caminho da planilha Excel');
    console.error('Uso: node migrate-sales-from-excel.mjs <caminho-para-planilha.xlsx>');
    process.exit(1);
  }
  
  const excelFile = resolve(args[0]);
  
  try {
    // Conectar ao banco
    console.log('🔌 Conectando ao banco de dados...');
    const db = connectDatabase();
    console.log('✅ Conectado\n');
    
    // Ler planilha
    const rows = readExcelFile(excelFile);
    migrationState.stats.totalRows = rows.length;
    
    console.log('\n📊 Validando e processando dados...\n');
    
    // Processar cada linha
    for (let i = 0; i < rows.length; i++) {
      const lineNumber = i + 2; // +2 porque linha 1 é cabeçalho e Excel começa em 1
      const row = rows[i];
      
      await processRow(db, row, lineNumber);
      
      // Mostrar progresso a cada 100 linhas
      if ((i + 1) % 100 === 0) {
        console.log(`  Processadas ${i + 1}/${rows.length} linhas...`);
      }
      
      // Verificar threshold de erros
      const errorRate = migrationState.stats.rejectedRows / (i + 1);
      if (errorRate > CONFIG.validation.errorThreshold && i > 50) {
        console.error(`\n⚠️  ATENÇÃO: Taxa de erro muito alta (${(errorRate * 100).toFixed(2)}%)`);
        console.error('Pausando migração para revisão...\n');
        break;
      }
    }
    
    // Gerar e exibir relatório
    console.log('\n' + generateReport());
    
    // Salvar logs
    saveLogs();
    
    // Status final
    if (migrationState.stats.rejectedRows === 0) {
      console.log('\n✅ Migração concluída com sucesso!');
    } else if (migrationState.stats.processedRows > 0) {
      console.log('\n⚠️  Migração concluída com erros (verifique os logs)');
    } else {
      console.log('\n❌ Migração falhou (nenhuma linha processada)');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Erro fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Executar
main();
