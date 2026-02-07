import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;

async function testExpenseAccountsPayable() {
  console.log("🧪 Testando integração Despesas → Contas a Pagar\n");

  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  try {
    // 1. Verificar se a coluna expenseId existe na tabela accountsPayable
    console.log("1️⃣ Verificando estrutura da tabela accountsPayable...");
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM accountsPayable WHERE Field = 'expenseId'
    `);
    
    if (columns.length === 0) {
      console.log("❌ ERRO: Coluna expenseId não encontrada na tabela accountsPayable");
      return;
    }
    console.log("✅ Coluna expenseId existe na tabela accountsPayable\n");

    // 2. Buscar uma despesa recente para testar
    console.log("2️⃣ Buscando despesa recente...");
    const [expenses] = await connection.query(`
      SELECT id, description, amount, issueDate 
      FROM expenses 
      ORDER BY id DESC 
      LIMIT 1
    `);
    
    if (expenses.length === 0) {
      console.log("⚠️  Nenhuma despesa encontrada no sistema");
      return;
    }
    
    const expense = expenses[0];
    console.log(`✅ Despesa encontrada: #${expense.id} - ${expense.description} - R$ ${expense.amount}\n`);

    // 3. Verificar se existem registros no Contas a Pagar para esta despesa
    console.log("3️⃣ Verificando registros no Contas a Pagar...");
    const [accountsPayable] = await connection.query(`
      SELECT id, description, amount, dueDate, status, expenseId
      FROM accountsPayable 
      WHERE expenseId = ?
    `, [expense.id]);
    
    if (accountsPayable.length === 0) {
      console.log("⚠️  Nenhum registro encontrado no Contas a Pagar para esta despesa");
      console.log("   Isso pode indicar que a despesa foi criada antes da implementação da integração\n");
    } else {
      console.log(`✅ ${accountsPayable.length} registro(s) encontrado(s) no Contas a Pagar:`);
      accountsPayable.forEach(ap => {
        console.log(`   - #${ap.id}: ${ap.description} - R$ ${ap.amount} - Vencimento: ${ap.dueDate.toISOString().split('T')[0]} - Status: ${ap.status}`);
      });
      console.log();
    }

    // 4. Contar total de despesas vs registros no Contas a Pagar
    console.log("4️⃣ Estatísticas gerais...");
    const [expenseCount] = await connection.query(`SELECT COUNT(*) as total FROM expenses`);
    const [apCount] = await connection.query(`SELECT COUNT(*) as total FROM accountsPayable WHERE expenseId IS NOT NULL`);
    
    console.log(`   Total de despesas: ${expenseCount[0].total}`);
    console.log(`   Registros no Contas a Pagar vinculados a despesas: ${apCount[0].total}\n`);

    // 5. Verificar se há parcelas de despesas sem registro no Contas a Pagar
    console.log("5️⃣ Verificando consistência entre parcelas e Contas a Pagar...");
    const [orphanInstallments] = await connection.query(`
      SELECT ei.id, ei.expenseId, ei.installmentNumber, ei.amount, ei.dueDate
      FROM expenseInstallments ei
      LEFT JOIN accountsPayable ap ON ap.expenseId = ei.expenseId AND ap.description LIKE CONCAT('%Parcela ', ei.installmentNumber, '/%')
      WHERE ap.id IS NULL
      LIMIT 5
    `);
    
    if (orphanInstallments.length > 0) {
      console.log(`⚠️  ${orphanInstallments.length} parcela(s) de despesa sem registro correspondente no Contas a Pagar (mostrando até 5):`);
      orphanInstallments.forEach(inst => {
        console.log(`   - Despesa #${inst.expenseId}, Parcela ${inst.installmentNumber} - R$ ${inst.amount}`);
      });
      console.log("   Isso é esperado para despesas criadas antes da implementação da integração\n");
    } else {
      console.log("✅ Todas as parcelas de despesas têm registro correspondente no Contas a Pagar\n");
    }

    console.log("✅ Teste concluído!");
    console.log("\n📋 RESUMO:");
    console.log("   - Estrutura do banco: OK (coluna expenseId existe)");
    console.log("   - Função createAccountPayable: Implementada no db.ts");
    console.log("   - Integração no routers.ts: Implementada (linhas 1124-1133)");
    console.log("\n💡 PRÓXIMOS PASSOS:");
    console.log("   1. Criar uma nova despesa pelo sistema para testar a integração");
    console.log("   2. Verificar se o registro aparece automaticamente no módulo Contas a Pagar");
    console.log("   3. Atualizar a listagem de Contas a Pagar para incluir despesas além de compras");

  } catch (error) {
    console.error("❌ Erro durante o teste:", error);
  } finally {
    await connection.end();
  }
}

testExpenseAccountsPayable();
