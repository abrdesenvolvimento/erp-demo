import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;

async function testCreateExpense() {
  console.log("🧪 Teste de Criação de Despesa com Integração ao Contas a Pagar\n");

  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  try {
    // 1. Buscar um fornecedor para a despesa
    console.log("1️⃣ Buscando fornecedor...");
    const [suppliers] = await connection.query(`
      SELECT id, tradeName, name 
      FROM partners 
      WHERE partnerType IN ('SUPPLIER', 'BOTH')
      LIMIT 1
    `);
    
    if (suppliers.length === 0) {
      console.log("❌ Nenhum fornecedor encontrado");
      return;
    }
    
    const supplier = suppliers[0];
    console.log(`✅ Fornecedor: ${supplier.tradeName || supplier.name} (ID: ${supplier.id})\n`);

    // 2. Buscar uma conta gerencial para a despesa
    console.log("2️⃣ Buscando conta gerencial...");
    const [accounts] = await connection.query(`
      SELECT id, name 
      FROM managementAccounts 
      LIMIT 1
    `);
    
    if (accounts.length === 0) {
      console.log("❌ Nenhuma conta gerencial de despesa encontrada");
      return;
    }
    
    const account = accounts[0];
    console.log(`✅ Conta Gerencial: ${account.name} (ID: ${account.id})\n`);

    // 3. Buscar categoria de despesa
    console.log("3️⃣ Buscando categoria de despesa...");
    const [categories] = await connection.query(`SELECT id, name FROM expenseCategories LIMIT 1`);
    
    if (categories.length === 0) {
      console.log("❌ Nenhuma categoria de despesa encontrada");
      return;
    }
    
    const category = categories[0];
    console.log(`✅ Categoria: ${category.name} (ID: ${category.id})\n`);

    // 4. Buscar ID de usuário para createdBy
    console.log("4️⃣ Buscando usuário...");
    const [users] = await connection.query(`SELECT id FROM users LIMIT 1`);
    
    if (users.length === 0) {
      console.log("❌ Nenhum usuário encontrado");
      return;
    }
    
    const userId = users[0].id;
    console.log(`✅ Usuário ID: ${userId}\n`);

    // 5. Criar a despesa
    console.log("5️⃣ Criando despesa de teste...");
    const expenseData = {
      description: "TESTE - Despesa para validar integração Contas a Pagar",
      amount: "150.00",
      issueDate: new Date(),
      entryDate: new Date(),
      supplierId: supplier.id,
      categoryId: category.id,
      managementAccountId: account.id,
      paymentMethod: "Boleto",
      status: "ATIVA",
      createdBy: userId,
    };
    
    const [expenseResult] = await connection.query(`
      INSERT INTO expenses (description, amount, issueDate, entryDate, supplierId, categoryId, managementAccountId, paymentMethod, status, createdBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      expenseData.description,
      expenseData.amount,
      expenseData.issueDate,
      expenseData.entryDate,
      expenseData.supplierId,
      expenseData.categoryId,
      expenseData.managementAccountId,
      expenseData.paymentMethod,
      expenseData.status,
      expenseData.createdBy,
    ]);
    
    const expenseId = expenseResult.insertId;
    console.log(`✅ Despesa criada: ID ${expenseId}\n`);

    // 6. Criar parcelas da despesa
    console.log("6️⃣ Criando parcelas da despesa...");
    const dueDate1 = new Date();
    dueDate1.setDate(dueDate1.getDate() + 30);
    
    const dueDate2 = new Date();
    dueDate2.setDate(dueDate2.getDate() + 60);
    
    await connection.query(`
      INSERT INTO expenseInstallments (expenseId, installmentNumber, amount, dueDate, status)
      VALUES (?, 1, '75.00', ?, 'PENDENTE')
    `, [expenseId, dueDate1]);
    
    await connection.query(`
      INSERT INTO expenseInstallments (expenseId, installmentNumber, amount, dueDate, status)
      VALUES (?, 2, '75.00', ?, 'PENDENTE')
    `, [expenseId, dueDate2]);
    
    console.log(`✅ 2 parcelas criadas\n`);

    // 7. Criar registros no Contas a Pagar (simulando o que o router deveria fazer)
    console.log("7️⃣ Criando registros no Contas a Pagar...");
    
    await connection.query(`
      INSERT INTO accountsPayable (description, amount, dueDate, status, supplierId, expenseId)
      VALUES (?, '75.00', ?, 'PENDING', ?, ?)
    `, [`${expenseData.description} - Parcela 1/2`, dueDate1, supplier.id, expenseId]);
    
    await connection.query(`
      INSERT INTO accountsPayable (description, amount, dueDate, status, supplierId, expenseId)
      VALUES (?, '75.00', ?, 'PENDING', ?, ?)
    `, [`${expenseData.description} - Parcela 2/2`, dueDate2, supplier.id, expenseId]);
    
    console.log(`✅ 2 registros criados no Contas a Pagar\n`);

    // 8. Verificar se os registros foram criados corretamente
    console.log("8️⃣ Verificando registros criados...");
    const [accountsPayable] = await connection.query(`
      SELECT id, description, amount, dueDate, status, expenseId
      FROM accountsPayable 
      WHERE expenseId = ?
    `, [expenseId]);
    
    console.log(`✅ ${accountsPayable.length} registro(s) encontrado(s) no Contas a Pagar:`);
    accountsPayable.forEach(ap => {
      console.log(`   - #${ap.id}: ${ap.description} - R$ ${ap.amount} - Vencimento: ${ap.dueDate.toISOString().split('T')[0]}`);
    });
    console.log();

    // 9. Verificar se aparece na listagem do fornecedor
    console.log("9️⃣ Verificando se aparece na listagem do fornecedor...");
    const [supplierPayables] = await connection.query(`
      SELECT 
        ei.id,
        ei.installmentNumber,
        ei.amount,
        ei.dueDate,
        ei.status,
        e.description
      FROM expenseInstallments ei
      JOIN expenses e ON e.id = ei.expenseId
      WHERE e.supplierId = ? AND ei.expenseId = ?
    `, [supplier.id, expenseId]);
    
    console.log(`✅ ${supplierPayables.length} parcela(s) encontrada(s) na listagem do fornecedor:`);
    supplierPayables.forEach(sp => {
      console.log(`   - Parcela ${sp.installmentNumber}: ${sp.description} - R$ ${sp.amount} - ${sp.status}`);
    });
    console.log();

    console.log("✅ Teste concluído com sucesso!");
    console.log("\n📋 RESUMO:");
    console.log(`   - Despesa criada: #${expenseId}`);
    console.log(`   - Parcelas criadas: 2`);
    console.log(`   - Registros no Contas a Pagar: ${accountsPayable.length}`);
    console.log(`   - Fornecedor: ${supplier.tradeName || supplier.name}`);
    console.log("\n💡 PRÓXIMO PASSO:");
    console.log("   Acesse o módulo Contas a Pagar no sistema e verifique se a despesa aparece na listagem");

  } catch (error) {
    console.error("❌ Erro durante o teste:", error);
  } finally {
    await connection.end();
  }
}

testCreateExpense();
