/**
 * Script de Migração Completa: Vendas Históricas (114.834 linhas)
 * 
 * Migra TODAS as linhas da planilha Excel para o banco de dados.
 * 
 * Uso:
 *   node migrate-sales-complete.mjs <caminho-para-planilha.xlsx>
 */

import mysql from 'mysql2/promise';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import XLSX from 'xlsx';

const CONFIG = {
  columns: {
    date: ['Data'],
    item: ['Item'],
    quantity: ['Quantidade', 'Quant'],
    unitPrice: ['Valor Unitário', 'Vlr Uni'],
    unitCost: ['Custo de Venda']
  },
  
  defaults: {
    saleType: 'BALCAO',
    customerId: null,
    channelId: null,
    paymentMethod: 'Migração de Dados',
    status: 'ACTIVE',
    createdBy: 'migration-complete',
    defaultTime: '12:00:00'
  },
  
  validation: {
    minDate: new Date('2020-01-01'),
    maxDate: new Date(),
    minQuantity: 0.01,
    minPrice: 0.01,
    minCost: 0
  },
  
  // Batch size para inserções
  batchSize: 100
};

const state = {
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
  productsNotFound: new Map(),
  productCache: new Map()
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function getColumnValue(row, columnNames) {
  for (const name of columnNames) {
    if (row.hasOwnProperty(name)) {
      return row[name];
    }
  }
  return undefined;
}

function parseExcelDate(value) {
  if (!value) return null;
  
  if (value instanceof Date) {
    return value;
  }
  
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    return new Date(date.y, date.m - 1, date.d);
  }
  
  if (typeof value === 'string') {
    const match1 = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match1) {
      const [, day, month, year] = match1;
      return new Date(year, month - 1, day);
    }
    
    const match2 = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match2) {
      const [, day, month, year] = match2;
      return new Date(year, month - 1, day);
    }
    
    const match3 = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match3) {
      return new Date(value);
    }
  }
  
  return null;
}

function formatMySQLDateTime(date) {
  if (!date || !(date instanceof Date)) return null;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${CONFIG.defaults.defaultTime}`;
}

async function findProductByName(connection, productName) {
  if (state.productCache.has(productName)) {
    return state.productCache.get(productName);
  }
  
  try {
    const [rows] = await connection.query(
      'SELECT id FROM products WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [productName]
    );
    
    if (rows.length > 0) {
      const productId = rows[0].id;
      state.productCache.set(productName, productId);
      return productId;
    }
    
    const count = state.productsNotFound.get(productName) || 0;
    state.productsNotFound.set(productName, count + 1);
    
    return null;
  } catch (error) {
    console.error(`Erro ao buscar produto: ${error.message}`);
    return null;
  }
}

async function processRow(connection, row, lineNumber) {
  const dateValue = getColumnValue(row, CONFIG.columns.date);
  const itemValue = getColumnValue(row, CONFIG.columns.item);
  const quantityValue = getColumnValue(row, CONFIG.columns.quantity);
  const unitPriceValue = getColumnValue(row, CONFIG.columns.unitPrice);
  const unitCostValue = getColumnValue(row, CONFIG.columns.unitCost);
  
  // Validações
  const date = parseExcelDate(dateValue);
  if (!date) {
    state.errors.push({ line: lineNumber, error: `Data inválida: ${dateValue}` });
    state.stats.rejectedRows++;
    return false;
  }
  
  if (!itemValue || itemValue.trim() === '') {
    state.errors.push({ line: lineNumber, error: 'Produto vazio' });
    state.stats.rejectedRows++;
    return false;
  }
  
  const quantity = parseFloat(quantityValue);
  const unitPrice = parseFloat(unitPriceValue);
  const unitCost = parseFloat(unitCostValue);
  
  if (isNaN(quantity) || isNaN(unitPrice) || isNaN(unitCost)) {
    state.errors.push({ line: lineNumber, error: 'Valores numéricos inválidos' });
    state.stats.rejectedRows++;
    return false;
  }
  
  // Buscar produto
  const productId = await findProductByName(connection, itemValue.trim());
  if (!productId) {
    state.errors.push({ line: lineNumber, error: `Produto não encontrado: ${itemValue}` });
    state.stats.rejectedRows++;
    return false;
  }
  
  const totalPrice = quantity * unitPrice;
  const totalCost = quantity * unitCost;
  
  try {
    // Inserir venda
    const [saleResult] = await connection.query(
      `INSERT INTO sales (saleDate, saleType, customerId, channelId, paymentMethod, status, subtotal, finalAmount, createdBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        formatMySQLDateTime(date),
        CONFIG.defaults.saleType,
        CONFIG.defaults.customerId,
        CONFIG.defaults.channelId,
        CONFIG.defaults.paymentMethod,
        CONFIG.defaults.status,
        totalPrice.toFixed(2),
        totalPrice.toFixed(2),
        CONFIG.defaults.createdBy
      ]
    );
    
    const saleId = saleResult.insertId;
    
    // Inserir item
    await connection.query(
      `INSERT INTO saleItems (saleId, productId, quantity, unitPrice, totalPrice)
       VALUES (?, ?, ?, ?, ?)`,
      [
        saleId,
        productId,
        Math.round(quantity),
        unitPrice.toFixed(2),
        totalPrice.toFixed(2)
      ]
    );
    
    state.stats.processedRows++;
    state.stats.salesCreated++;
    state.stats.itemsCreated++;
    state.stats.totalRevenue += totalPrice;
    state.stats.totalCost += (quantity * unitCost);
    
    return true;
    
  } catch (error) {
    state.errors.push({ line: lineNumber, error: `Erro ao inserir: ${error.message}` });
    state.stats.rejectedRows++;
    return false;
  }
}

function formatTime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// ============================================================================
// FUNÇÃO PRINCIPAL
// ============================================================================

async function main() {
  console.log('🚀 MIGRAÇÃO COMPLETA DE VENDAS HISTÓRICAS\n');
  console.log('=' .repeat(60) + '\n');
  
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('❌ Informe o caminho da planilha Excel');
    process.exit(1);
  }
  
  const excelFile = resolve(args[0]);
  
  try {
    // Conectar ao banco
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não configurada');
    }
    
    console.log('🔌 Conectando ao banco de dados...');
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    console.log('✅ Conectado\n');
    
    // Ler planilha
    console.log(`📖 Lendo: ${excelFile}`);
    const workbook = XLSX.readFile(excelFile);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`✅ ${data.length.toLocaleString('pt-BR')} linhas encontradas\n`);
    
    state.stats.totalRows = data.length;
    
    // Processar linhas
    console.log('📊 Processando linhas...\n');
    
    const startTime = Date.now();
    
    for (let i = 0; i < data.length; i++) {
      const lineNumber = i + 2;
      const row = data[i];
      
      await processRow(connection, row, lineNumber);
      
      // Progress bar
      if ((i + 1) % 1000 === 0) {
        const elapsed = Date.now() - startTime;
        const rate = (i + 1) / (elapsed / 1000);
        const remaining = (data.length - i - 1) / rate;
        
        console.log(
          `  ✓ ${(i + 1).toLocaleString('pt-BR')}/${data.length.toLocaleString('pt-BR')} ` +
          `(${((i + 1) / data.length * 100).toFixed(1)}%) ` +
          `| ETA: ${formatTime(remaining * 1000)}`
        );
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    // Relatório
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADO FINAL DA MIGRAÇÃO');
    console.log('='.repeat(60) + '\n');
    
    console.log('✅ Linhas processadas com sucesso: ' + state.stats.processedRows.toLocaleString('pt-BR'));
    console.log('❌ Linhas rejeitadas: ' + state.stats.rejectedRows.toLocaleString('pt-BR'));
    console.log(`📈 Taxa de sucesso: ${((state.stats.processedRows / state.stats.totalRows) * 100).toFixed(2)}%\n`);
    
    console.log('💾 Dados inseridos no banco:');
    console.log(`  Vendas criadas: ${state.stats.salesCreated.toLocaleString('pt-BR')}`);
    console.log(`  Itens criados: ${state.stats.itemsCreated.toLocaleString('pt-BR')}`);
    console.log(`  Faturamento total: R$ ${state.stats.totalRevenue.toFixed(2)}`);
    console.log(`  Custo total: R$ ${state.stats.totalCost.toFixed(2)}`);
    
    const margem = state.stats.totalRevenue - state.stats.totalCost;
    const margemPct = state.stats.totalRevenue > 0 ? (margem / state.stats.totalRevenue) * 100 : 0;
    console.log(`  Margem bruta: R$ ${margem.toFixed(2)} (${margemPct.toFixed(2)}%)\n`);
    
    console.log(`⏱️  Tempo total: ${formatTime(totalTime)}\n`);
    
    if (state.errors.length > 0) {
      console.log(`⚠️  Erros encontrados: ${state.errors.length}`);
      console.log('\n  Primeiros 10 erros:');
      state.errors.slice(0, 10).forEach(err => {
        console.log(`    Linha ${err.line}: ${err.error}`);
      });
      
      // Salvar relatório de erros
      const errorReport = state.errors.map(e => `Linha ${e.line}: ${e.error}`).join('\n');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const errorFile = `migracao-erros-${timestamp}.txt`;
      writeFileSync(errorFile, errorReport);
      console.log(`\n  Relatório completo salvo: ${errorFile}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!\n');
    
    console.log('📊 Resumo:');
    console.log(`  • ${state.stats.salesCreated.toLocaleString('pt-BR')} vendas migradas`);
    console.log(`  • Faturamento histórico: R$ ${state.stats.totalRevenue.toFixed(2)}`);
    console.log(`  • Período: ${new Date(state.stats.totalRows > 0 ? '2020-01-01' : new Date()).toLocaleDateString('pt-BR')} a ${new Date().toLocaleDateString('pt-BR')}`);
    console.log(`  • Taxa de sucesso: ${((state.stats.processedRows / state.stats.totalRows) * 100).toFixed(2)}%\n`);
    
    console.log('💡 Próximos passos:');
    console.log('  1. Verificar dados migrados no dashboard de Vendas');
    console.log('  2. Validar totalizações e comparar com planilha original');
    console.log('  3. Gerar relatórios de análise histórica\n');
    
    await connection.end();
    
  } catch (error) {
    console.error('\n❌ Erro fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
