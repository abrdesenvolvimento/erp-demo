/**
 * Script de Validação de Produtos Antes da Migração
 * 
 * Verifica quais produtos da planilha Excel existem no banco de dados
 * e gera relatório de produtos não encontrados.
 */

import { drizzle } from 'drizzle-orm/mysql2';
import { writeFileSync } from 'fs';
import XLSX from 'xlsx';

const EXCEL_FILE = process.argv[2] || '/home/ubuntu/upload/MigraçãodeDados.xlsx';

console.log('🔍 Validando produtos da planilha...\n');

// Conectar ao banco
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada');
  process.exit(1);
}

const db = drizzle(process.env.DATABASE_URL);

// Ler planilha
console.log(`📖 Lendo: ${EXCEL_FILE}`);
const workbook = XLSX.readFile(EXCEL_FILE);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(`✅ ${data.length} linhas encontradas\n`);

// Extrair produtos únicos
const produtosUnicos = new Map(); // nome → count
data.forEach(row => {
  const produto = row.Item || row.item || '';
  if (produto) {
    produtosUnicos.set(produto, (produtosUnicos.get(produto) || 0) + 1);
  }
});

console.log(`📦 ${produtosUnicos.size} produtos únicos encontrados\n`);
console.log('🔎 Verificando no banco de dados...\n');

// Buscar todos os produtos do banco
const [dbProducts] = await db.execute('SELECT id, name FROM products');
const dbProductMap = new Map();
dbProducts.forEach(p => {
  dbProductMap.set(p.name.toLowerCase(), p);
});

console.log(`💾 ${dbProducts.length} produtos cadastrados no ERP\n`);

// Validar cada produto
const encontrados = [];
const naoEncontrados = [];
const fuzzyMatches = [];

for (const [nomePlanilha, ocorrencias] of produtosUnicos.entries()) {
  const nomeLower = nomePlanilha.toLowerCase();
  
  // Busca exata
  if (dbProductMap.has(nomeLower)) {
    encontrados.push({
      planilha: nomePlanilha,
      erp: dbProductMap.get(nomeLower).name,
      id: dbProductMap.get(nomeLower).id,
      ocorrencias,
      match: 'exato'
    });
    continue;
  }
  
  // Busca fuzzy (parcial)
  let fuzzyFound = false;
  for (const [nomeErp, produto] of dbProductMap.entries()) {
    if (nomeErp.includes(nomeLower) || nomeLower.includes(nomeErp)) {
      fuzzyMatches.push({
        planilha: nomePlanilha,
        erp: produto.name,
        id: produto.id,
        ocorrencias,
        match: 'parcial'
      });
      fuzzyFound = true;
      break;
    }
  }
  
  if (!fuzzyFound) {
    naoEncontrados.push({
      planilha: nomePlanilha,
      ocorrencias
    });
  }
}

// Gerar relatório
console.log('📊 RESULTADOS:\n');
console.log(`✅ Encontrados (match exato): ${encontrados.length}`);
console.log(`⚠️  Encontrados (match parcial): ${fuzzyMatches.length}`);
console.log(`❌ Não encontrados: ${naoEncontrados.length}\n`);

// Calcular impacto
const totalLinhasEncontradas = encontrados.reduce((sum, p) => sum + p.ocorrencias, 0);
const totalLinhasFuzzy = fuzzyMatches.reduce((sum, p) => sum + p.ocorrencias, 0);
const totalLinhasNaoEncontradas = naoEncontrados.reduce((sum, p) => sum + p.ocorrencias, 0);

console.log('📈 IMPACTO NA MIGRAÇÃO:\n');
console.log(`  Linhas que serão migradas (match exato): ${totalLinhasEncontradas.toLocaleString('pt-BR')}`);
console.log(`  Linhas com match parcial (revisar): ${totalLinhasFuzzy.toLocaleString('pt-BR')}`);
console.log(`  Linhas que serão rejeitadas: ${totalLinhasNaoEncontradas.toLocaleString('pt-BR')}`);
console.log(`  Taxa de sucesso: ${((totalLinhasEncontradas / data.length) * 100).toFixed(2)}%\n`);

// Salvar relatório detalhado
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

// CSV de produtos não encontrados
if (naoEncontrados.length > 0) {
  const csvLines = ['Produto,Ocorrências'];
  naoEncontrados
    .sort((a, b) => b.ocorrencias - a.ocorrencias)
    .forEach(p => {
      csvLines.push(`"${p.planilha}",${p.ocorrencias}`);
    });
  
  const csvFile = `produtos-nao-encontrados-${timestamp}.csv`;
  writeFileSync(csvFile, csvLines.join('\n'));
  console.log(`📄 Produtos não encontrados salvos: ${csvFile}`);
  
  // Mostrar top 20
  console.log('\n❌ TOP 20 PRODUTOS NÃO ENCONTRADOS:\n');
  naoEncontrados.slice(0, 20).forEach((p, i) => {
    console.log(`  ${i + 1}. "${p.planilha}" - ${p.ocorrencias} ocorrências`);
  });
}

// CSV de matches parciais (para revisão)
if (fuzzyMatches.length > 0) {
  const csvLines = ['Produto Planilha,Produto ERP,ID,Ocorrências'];
  fuzzyMatches
    .sort((a, b) => b.ocorrencias - a.ocorrencias)
    .forEach(p => {
      csvLines.push(`"${p.planilha}","${p.erp}",${p.id},${p.ocorrencias}`);
    });
  
  const csvFile = `produtos-match-parcial-${timestamp}.csv`;
  writeFileSync(csvFile, csvLines.join('\n'));
  console.log(`📄 Matches parciais salvos: ${csvFile}`);
  
  // Mostrar top 10
  console.log('\n⚠️  TOP 10 MATCHES PARCIAIS (REVISAR):\n');
  fuzzyMatches.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. "${p.planilha}" → "${p.erp}" (${p.ocorrencias} ocorrências)`);
  });
}

// CSV de produtos encontrados
const csvLines = ['Produto Planilha,Produto ERP,ID,Ocorrências,Match'];
[...encontrados, ...fuzzyMatches]
  .sort((a, b) => b.ocorrencias - a.ocorrencias)
  .forEach(p => {
    csvLines.push(`"${p.planilha}","${p.erp}",${p.id},${p.ocorrencias},${p.match}`);
  });

const csvFile = `produtos-encontrados-${timestamp}.csv`;
writeFileSync(csvFile, csvLines.join('\n'));
console.log(`📄 Produtos encontrados salvos: ${csvFile}\n`);

// Recomendações
console.log('💡 PRÓXIMOS PASSOS:\n');

if (naoEncontrados.length > 0) {
  console.log('  1. Revisar arquivo: produtos-nao-encontrados-*.csv');
  console.log('  2. Cadastrar produtos faltantes no ERP OU');
  console.log('  3. Ajustar nomes na planilha Excel OU');
  console.log('  4. Criar mapeamento manual (De-Para)\n');
}

if (fuzzyMatches.length > 0) {
  console.log('  5. Revisar arquivo: produtos-match-parcial-*.csv');
  console.log('  6. Confirmar se matches parciais estão corretos\n');
}

if (naoEncontrados.length === 0 && fuzzyMatches.length === 0) {
  console.log('  ✅ Todos os produtos foram encontrados!');
  console.log('  ✅ Pronto para executar migração:\n');
  console.log(`     node migrate-sales-from-excel.mjs "${EXCEL_FILE}"\n`);
} else {
  const taxaErro = (totalLinhasNaoEncontradas / data.length) * 100;
  if (taxaErro > 5) {
    console.log(`  ⚠️  ATENÇÃO: Taxa de erro de ${taxaErro.toFixed(2)}% é alta!`);
    console.log('  ⚠️  Recomenda-se resolver produtos não encontrados antes da migração.\n');
  } else {
    console.log(`  ℹ️  Taxa de erro de ${taxaErro.toFixed(2)}% é aceitável.`);
    console.log('  ℹ️  Pode prosseguir com migração (linhas com erro serão rejeitadas).\n');
  }
}

process.exit(0);
