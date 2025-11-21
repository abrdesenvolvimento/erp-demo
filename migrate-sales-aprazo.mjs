import { drizzle } from 'drizzle-orm/mysql2';
import { createConnection } from 'mysql2/promise';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada');
  process.exit(1);
}

const connection = await createConnection(DATABASE_URL);
const db = drizzle(connection);

// Ler e processar CSV
const csvContent = fs.readFileSync('/home/ubuntu/upload/MigraçãoVendasaPrazo.csv', 'utf-8');
const lines = csvContent.split('\n').slice(1); // Pular cabeçalho

// Agrupar vendas por cliente e data
const salesByClientAndDate = {};

for (const line of lines) {
  if (!line.trim() || line.startsWith(';;')) continue;
  
  const [cliente, data, codigoProduto, produto, quantidade, precoUnitario, total] = line.split(';');
  
  if (!cliente || !data) continue;
  
  const key = `${cliente.trim()}_${data.trim()}`;
  
  if (!salesByClientAndDate[key]) {
    salesByClientAndDate[key] = {
      cliente: cliente.trim(),
      data: data.trim(),
      items: []
    };
  }
  
  salesByClientAndDate[key].items.push({
    codigoProduto: codigoProduto.trim().toLowerCase(),
    produto: produto.trim(),
    quantidade: parseInt(quantidade),
    precoUnitario: parseFloat(precoUnitario.replace(',', '.')),
    total: parseFloat(total.replace(',', '.'))
  });
}

console.log(`📦 Total de vendas agrupadas: ${Object.keys(salesByClientAndDate).length}`);

// Buscar clientes no banco
const clientesMap = {};
const [clientes] = await connection.execute(
  'SELECT id, name, tradeName FROM partners WHERE partnerType IN ("CUSTOMER", "BOTH")'
);

for (const cliente of clientes) {
  const nameKey = (cliente.tradeName || cliente.name).toLowerCase().trim();
  clientesMap[nameKey] = cliente.id;
  // Também mapear por nome completo se tiver nome fantasia
  if (cliente.tradeName) {
    clientesMap[cliente.name.toLowerCase().trim()] = cliente.id;
  }
}

console.log(`👥 Clientes encontrados no banco: ${Object.keys(clientesMap).length}`);

// Buscar produtos no banco por nome
const [produtos] = await connection.execute(
  'SELECT id, name FROM products WHERE active = 1'
);

const produtosMap = {};
for (const produto of produtos) {
  // Normalizar nome para busca: remover acentos, espaços extras, lowercase
  const normalizedName = produto.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim();
  produtosMap[normalizedName] = {
    id: produto.id,
    name: produto.name
  };
}

// Função para buscar produto por nome aproximado
function findProductByName(searchName) {
  const normalized = searchName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Busca exata primeiro
  if (produtosMap[normalized]) {
    return produtosMap[normalized];
  }
  
  // Busca parcial - encontra produto que contenha o termo
  for (const [key, value] of Object.entries(produtosMap)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return value;
    }
  }
  
  return null;
}

console.log(`📦 Produtos encontrados no banco: ${Object.keys(produtosMap).length}`);

// Processar cada venda
let vendasCriadas = 0;
let erros = 0;

for (const [key, venda] of Object.entries(salesByClientAndDate)) {
  try {
    // Buscar cliente
    const clienteKey = venda.cliente.toLowerCase();
    const customerId = clientesMap[clienteKey];
    
    if (!customerId) {
      console.log(`⚠️  Cliente não encontrado: ${venda.cliente}`);
      erros++;
      continue;
    }
    
    // Converter data DD/MM/YYYY para YYYY-MM-DD
    const [dia, mes, ano] = venda.data.split('/');
    const saleDate = `${ano}-${mes}-${dia}`;
    
    // Calcular total da venda
    const totalAmount = venda.items.reduce((sum, item) => sum + item.total, 0);
    
    // Criar venda
    const [result] = await connection.execute(
      `INSERT INTO sales (customerId, saleType, subtotal, discountAmount, surchargeAmount, finalAmount, paymentMethod, notes, saleDate, createdBy, createdAt) 
       VALUES (?, 'A_PRAZO', ?, 0, 0, ?, 'FIADO', 'Migração histórica', ?, 'SYSTEM', ?)`,
      [customerId, totalAmount.toFixed(2), totalAmount.toFixed(2), saleDate, saleDate]
    );
    
    const saleId = result.insertId;
    
    // Adicionar itens da venda
    for (const item of venda.items) {
      // Buscar produto pelo nome (coluna Produto do CSV)
      const produtoData = findProductByName(item.produto);
      
      if (!produtoData) {
        console.log(`⚠️  Produto não encontrado: ${item.produto}`);
        continue;
      }
      
      await connection.execute(
        `INSERT INTO saleItems (saleId, productId, quantity, unitPrice, totalPrice) 
         VALUES (?, ?, ?, ?, ?)`,
        [saleId, produtoData.id, item.quantidade, item.precoUnitario.toFixed(2), item.total.toFixed(2)]
      );
    }
    
    // Criar recebível
    const [receivableResult] = await connection.execute(
      `INSERT INTO receivables (saleId, customerId, totalAmount, receivedAmount, status, createdBy, createdAt) 
       VALUES (?, ?, ?, 0, 'PENDENTE', 'SYSTEM', ?)`,
      [saleId, customerId, totalAmount.toFixed(2), saleDate]
    );
    
    const receivableId = receivableResult.insertId;
    
    // Criar parcela única com vencimento em 30 dias
    const dueDate = new Date(saleDate);
    dueDate.setDate(dueDate.getDate() + 30);
    
    await connection.execute(
      `INSERT INTO receivableInstallments (receivableId, installmentNumber, amount, dueDate, status) 
       VALUES (?, 1, ?, ?, 'PENDENTE')`,
      [receivableId, totalAmount.toFixed(2), dueDate.toISOString().split('T')[0]]
    );
    
    vendasCriadas++;
    console.log(`✅ Venda criada: ${venda.cliente} - ${venda.data} - R$ ${totalAmount.toFixed(2)}`);
    
  } catch (error) {
    console.error(`❌ Erro ao processar venda ${key}:`, error.message);
    erros++;
  }
}

console.log(`\n📊 RESUMO DA MIGRAÇÃO:`);
console.log(`✅ Vendas criadas: ${vendasCriadas}`);
console.log(`❌ Erros: ${erros}`);

await connection.end();
