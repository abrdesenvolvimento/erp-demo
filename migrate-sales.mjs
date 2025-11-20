import mysql from 'mysql2/promise';
import fs from 'fs';

// Configuração do banco
const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Ler CSV
const csvContent = fs.readFileSync('/home/ubuntu/upload/MigraçãoVendasaPrazo.csv', 'utf-8');
const lines = csvContent.split('\n').filter(line => line.trim());
const rows = lines.slice(1); // Pular header

console.log('📊 Iniciando migração de vendas a prazo...\n');

// Parsear CSV
const salesData = [];
for (const row of rows) {
  if (!row.trim()) continue;
  
  const [cliente, data, codigoProduto, produto, quantidade, uni, total] = row.split(';');
  
  // Converter data de DD/MM/YYYY para Date
  const [day, month, year] = data.split('/');
  const saleDate = new Date(`${year}-${month}-${day}T12:00:00`);
  
  salesData.push({
    cliente: cliente.trim(),
    data: saleDate,
    codigoProduto: codigoProduto.trim().toLowerCase(),
    produto: produto.trim(),
    quantidade: parseInt(quantidade),
    uni: parseFloat(uni.replace(',', '.')),
    total: parseFloat(total.replace(',', '.'))
  });
}

console.log(`✅ ${salesData.length} itens encontrados no CSV\n`);

// 1. Buscar ou criar cliente "Alexandre Lima"
console.log('🔍 Buscando cliente Alexandre Lima...');
const [customerRows] = await connection.execute(
  'SELECT * FROM partners WHERE name = ? LIMIT 1',
  ['Alexandre Lima']
);

let customerId;
if (customerRows.length === 0) {
  console.log('➕ Cliente não encontrado, criando...');
  const [result] = await connection.execute(
    `INSERT INTO partners (name, partnerType, creditLimit, currentBalance, active) 
     VALUES (?, ?, ?, ?, ?)`,
    ['Alexandre Lima', 'CUSTOMER', '1000.00', '0.00', true]
  );
  customerId = result.insertId;
  console.log(`✅ Cliente criado com ID: ${customerId}\n`);
} else {
  customerId = customerRows[0].id;
  console.log(`✅ Cliente encontrado: ID ${customerId}\n`);
}

// 2. Mapear produtos por código
console.log('🔍 Mapeando produtos...');
const [allProducts] = await connection.execute('SELECT * FROM products');
const productMap = {};

for (const item of salesData) {
  const code = item.codigoProduto;
  if (!productMap[code]) {
    const product = allProducts.find(p => 
      p.code?.toLowerCase() === code || 
      p.name.toLowerCase().includes(item.produto.toLowerCase().split(' ')[0])
    );
    
    if (product) {
      productMap[code] = product;
      console.log(`  ✅ ${code} → ${product.name} (ID: ${product.id})`);
    } else {
      console.log(`  ⚠️  ${code} → Produto não encontrado! Pulando...`);
    }
  }
}
console.log('');

// 3. Agrupar itens por data
const salesByDate = {};
for (const item of salesData) {
  const dateKey = item.data.toISOString().split('T')[0];
  if (!salesByDate[dateKey]) {
    salesByDate[dateKey] = [];
  }
  salesByDate[dateKey].push(item);
}

console.log(`📦 ${Object.keys(salesByDate).length} vendas serão criadas\n`);

// 4. Criar vendas
let totalMigrated = 0;
let totalAmount = 0;

for (const [dateKey, items] of Object.entries(salesByDate)) {
  const saleDate = new Date(dateKey + 'T12:00:00');
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  totalAmount += subtotal;
  
  console.log(`\n📅 Venda de ${dateKey} - ${items.length} itens - R$ ${subtotal.toFixed(2)}`);
  
  // Criar venda
  const [saleResult] = await connection.execute(
    `INSERT INTO sales (saleType, customerId, subtotal, discountAmount, surchargeAmount, finalAmount, 
                        paymentMethod, saleDate, createdBy, notes) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['A_PRAZO', customerId, subtotal.toFixed(2), '0.00', '0.00', subtotal.toFixed(2),
     'A Prazo', saleDate, 'migration', 'Migração de venda histórica - NÃO BAIXOU ESTOQUE']
  );
  
  const saleId = saleResult.insertId;
  console.log(`  ✅ Venda criada: ID ${saleId}`);
  
  // Criar itens da venda (SEM BAIXAR ESTOQUE)
  for (const item of items) {
    const product = productMap[item.codigoProduto];
    if (!product) {
      console.log(`  ⚠️  Pulando item: ${item.produto} (produto não encontrado)`);
      continue;
    }
    
    await connection.execute(
      `INSERT INTO saleItems (saleId, productId, quantity, unitPrice, totalPrice) 
       VALUES (?, ?, ?, ?, ?)`,
      [saleId, product.id, item.quantidade, item.uni.toFixed(2), item.total.toFixed(2)]
    );
    
    console.log(`  ✅ Item: ${item.quantidade}x ${product.name} - R$ ${item.total.toFixed(2)}`);
  }
  
  // Criar recebível
  const [receivableResult] = await connection.execute(
    `INSERT INTO receivables (saleId, customerId, totalAmount, receivedAmount, status, createdBy) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [saleId, customerId, subtotal.toFixed(2), '0.00', 'PENDENTE', 'migration']
  );
  
  const receivableId = receivableResult.insertId;
  console.log(`  ✅ Recebível criado: ID ${receivableId}`);
  
  // Criar parcela única com vencimento em 30 dias
  const dueDate = new Date(saleDate);
  dueDate.setDate(dueDate.getDate() + 30);
  
  await connection.execute(
    `INSERT INTO receivableInstallments (receivableId, installmentNumber, amount, dueDate, status) 
     VALUES (?, ?, ?, ?, ?)`,
    [receivableId, 1, subtotal.toFixed(2), dueDate, 'PENDENTE']
  );
  
  console.log(`  ✅ Parcela criada: Vencimento ${dueDate.toLocaleDateString('pt-BR')}`);
  
  totalMigrated++;
}

// 5. Atualizar saldo do cliente
await connection.execute(
  'UPDATE partners SET currentBalance = ? WHERE id = ?',
  [totalAmount.toFixed(2), customerId]
);

console.log(`\n✅ Saldo do cliente atualizado: R$ ${totalAmount.toFixed(2)}`);

console.log(`\n🎉 Migração concluída!`);
console.log(`   ${totalMigrated} vendas criadas`);
console.log(`   ${salesData.length} itens migrados`);
console.log(`   Total: R$ ${totalAmount.toFixed(2)}`);
console.log(`\n⚠️  ATENÇÃO: Estoque NÃO foi alterado (vendas históricas)`);

await connection.end();
