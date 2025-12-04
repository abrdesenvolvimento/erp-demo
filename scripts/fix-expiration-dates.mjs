import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, ne, desc } from "drizzle-orm";
import mysql from "mysql2/promise";

// Importar schemas
const products = {
  id: "id",
  name: "name",
  expirationDate: "expirationDate"
};

const purchaseOrderItems = {
  productId: "productId",
  expiryDate: "expiryDate",
  purchaseOrderId: "purchaseOrderId"
};

const purchaseOrders = {
  id: "id",
  status: "status"
};

async function fixExpirationDates() {
  console.log("🔧 Iniciando correção de datas de vencimento...\n");
  
  // Conectar ao banco
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);
  
  try {
    // Buscar todos os produtos
    const allProducts = await connection.query("SELECT id, name, expirationDate FROM products");
    const productsList = allProducts[0];
    
    console.log(`📦 Encontrados ${productsList.length} produtos para verificar\n`);
    
    let updatedCount = 0;
    let clearedCount = 0;
    
    for (const product of productsList) {
      // Buscar data de vencimento mais recente de compras CONFIRMED
      const query = `
        SELECT poi.expiryDate 
        FROM purchaseOrderItems poi
        INNER JOIN purchaseOrders po ON poi.purchaseOrderId = po.id
        WHERE poi.productId = ? 
          AND po.status = 'CONFIRMED'
          AND poi.expiryDate IS NOT NULL
        ORDER BY poi.expiryDate DESC
        LIMIT 1
      `;
      
      const result = await connection.query(query, [product.id]);
      const confirmedPurchases = result[0];
      
      if (confirmedPurchases.length > 0) {
        const newExpirationDate = confirmedPurchases[0].expiryDate;
        
        // Atualizar apenas se for diferente
        if (product.expirationDate?.getTime() !== newExpirationDate?.getTime()) {
          await connection.query(
            "UPDATE products SET expirationDate = ? WHERE id = ?",
            [newExpirationDate, product.id]
          );
          console.log(`✅ ${product.name}: atualizado para ${newExpirationDate?.toISOString().split('T')[0]}`);
          updatedCount++;
        }
      } else if (product.expirationDate !== null) {
        // Sem compras confirmadas, limpar vencimento
        await connection.query(
          "UPDATE products SET expirationDate = NULL WHERE id = ?",
          [product.id]
        );
        console.log(`🗑️  ${product.name}: data de vencimento removida (sem compras confirmadas)`);
        clearedCount++;
      }
    }
    
    console.log(`\n✨ Migração concluída!`);
    console.log(`   - ${updatedCount} produtos atualizados`);
    console.log(`   - ${clearedCount} produtos com data removida`);
    console.log(`   - ${productsList.length - updatedCount - clearedCount} produtos sem alteração\n`);
    
  } catch (error) {
    console.error("❌ Erro durante migração:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

fixExpirationDates()
  .then(() => {
    console.log("✅ Script finalizado com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script falhou:", error);
    process.exit(1);
  });
