import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // Buscar ID do Josivan
  const [josivan] = await connection.execute(
    'SELECT id FROM partners WHERE name LIKE ?',
    ['%Josivan%']
  );
  
  if (!josivan.length) {
    console.error('Cliente Josivan não encontrado');
    process.exit(1);
  }
  
  const customerId = josivan[0].id;
  console.log(`✓ Cliente Josivan encontrado: ID ${customerId}`);
  
  // Buscar IDs dos produtos
  const [products] = await connection.execute(
    'SELECT id, name FROM products WHERE name IN (?, ?, ?, ?)',
    [
      'Doritos Queijo Nacho 75gr',
      'Heineken 269ml',
      'Frescca 510ml',
      'Del Valle Kapo Laranja 200ml'
    ]
  );
  
  const productMap = {};
  products.forEach(p => {
    productMap[p.name] = p.id;
  });
  
  console.log('✓ Produtos encontrados:', Object.keys(productMap));
  
  // Dados de vendas do CSV
  const salesData = [
    { produto: 'Doritos Queijo Nacho 75gr', quantidade: 1, preco: 10.00 },
    { produto: 'Heineken 269ml', quantidade: 2, preco: 5.00 },
    { produto: 'Frescca 510ml', quantidade: 1, preco: 2.00 },
    { produto: 'Del Valle Kapo Laranja 200ml', quantidade: 2, preco: 3.50 },
    { produto: 'Heineken 269ml', quantidade: 1, preco: 5.00 },
    { produto: 'Doritos Queijo Nacho 75gr', quantidade: 1, preco: 10.00 }
  ];
  
  // Data: 30/11/2025 às 14:00 (Brasília)
  const saleDate = new Date('2025-11-30T14:00:00');
  
  let totalAmount = 0;
  
  // Criar vendas
  for (const sale of salesData) {
    const productId = productMap[sale.produto];
    if (!productId) {
      console.error(`Produto não encontrado: ${sale.produto}`);
      continue;
    }
    
    const amount = sale.quantidade * sale.preco;
    totalAmount += amount;
    
    // Inserir venda (campos: id, saleType, saleDate, customerId, channelId, platformOrderId, subtotal, discountAmount, surchargeAmount, finalAmount, paymentMethod, requiresAdminApproval, adminApprovedBy, notes, createdBy, createdAt)
    const [result] = await connection.execute(
      `INSERT INTO sales (saleType, saleDate, customerId, subtotal, discountAmount, surchargeAmount, finalAmount, paymentMethod, createdBy, createdAt)
       VALUES ('A_PRAZO', ?, ?, ?, 0, 0, ?, 'PENDENTE', 'system', ?)`,
      [saleDate, customerId, amount, amount, new Date()]
    );
    
    const saleId = result.insertId;
    
    // Inserir item da venda
    await connection.execute(
      `INSERT INTO saleItems (saleId, productId, quantity, unitPrice, totalPrice)
       VALUES (?, ?, ?, ?, ?)`,
      [saleId, productId, sale.quantidade, sale.preco, amount]
    );
    
    // Atualizar estoque do produto
    await connection.execute(
      `UPDATE products SET currentStock = currentStock - ? WHERE id = ?`,
      [sale.quantidade, productId]
    );
    
    console.log(`✓ Venda criada: ${sale.produto} (${sale.quantidade}x R$ ${sale.preco.toFixed(2)}) = R$ ${amount.toFixed(2)}`);
  }
  
  console.log(`\n✓ Total de vendas importadas: R$ ${totalAmount.toFixed(2)}`);
  console.log('✓ Importação concluída com sucesso!');
  
} catch (error) {
  console.error('Erro:', error.message);
  process.exit(1);
} finally {
  await connection.end();
}
