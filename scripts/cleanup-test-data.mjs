/**
 * Script para limpar dados de teste do ABRWF
 * Verifica movimentações antes de excluir
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const PRODUCTS_TO_DELETE = [5280001, 5280002, 5310001, 5310002, 5310003, 4950001, 4950002, 4950003, 4950004, 2070009];

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);

  console.log('=== VERIFICAÇÃO DE PRODUTOS TESTE ===\n');

  // Verificar produtos
  const [products] = await connection.execute(`
    SELECT id, name, currentStock FROM products 
    WHERE id IN (${PRODUCTS_TO_DELETE.join(',')})
  `);

  console.log('Produtos encontrados:');
  for (const p of products) {
    console.log(`  - ID ${p.id}: ${p.name} (Estoque: ${p.currentStock})`);
  }

  // Verificar movimentações
  console.log('\n=== VERIFICAÇÃO DE MOVIMENTAÇÕES ===\n');

  for (const productId of PRODUCTS_TO_DELETE) {
    const [[salesCount]] = await connection.execute(
      'SELECT COUNT(*) as count FROM saleItems WHERE productId = ?',
      [productId]
    );
    const [[purchasesCount]] = await connection.execute(
      'SELECT COUNT(*) as count FROM purchaseOrderItems WHERE productId = ?',
      [productId]
    );
    const [[movementsCount]] = await connection.execute(
      'SELECT COUNT(*) as count FROM productMovements WHERE productId = ?',
      [productId]
    );

    const total = salesCount.count + purchasesCount.count + movementsCount.count;
    
    if (total > 0) {
      console.log(`⚠️  Produto ${productId}: ${salesCount.count} vendas, ${purchasesCount.count} compras, ${movementsCount.count} movimentos`);
    } else {
      console.log(`✅ Produto ${productId}: Sem movimentações - pode ser excluído`);
    }
  }

  // Excluir produtos sem movimentações
  console.log('\n=== EXCLUSÃO DE PRODUTOS ===\n');

  for (const productId of PRODUCTS_TO_DELETE) {
    const [[salesCount]] = await connection.execute(
      'SELECT COUNT(*) as count FROM saleItems WHERE productId = ?',
      [productId]
    );
    const [[purchasesCount]] = await connection.execute(
      'SELECT COUNT(*) as count FROM purchaseOrderItems WHERE productId = ?',
      [productId]
    );

    if (salesCount.count === 0 && purchasesCount.count === 0) {
      // Excluir preços primeiro
      await connection.execute('DELETE FROM productPrices WHERE productId = ?', [productId]);
      // Excluir movimentos
      await connection.execute('DELETE FROM productMovements WHERE productId = ?', [productId]);
      // Excluir composições
      await connection.execute('DELETE FROM productCompositions WHERE parentProductId = ? OR childProductId = ?', [productId, productId]);
      // Excluir produto
      await connection.execute('DELETE FROM products WHERE id = ?', [productId]);
      console.log(`✅ Produto ${productId} excluído com sucesso`);
    } else {
      console.log(`⚠️  Produto ${productId} NÃO excluído - possui movimentações`);
    }
  }

  // Verificar parceiros/fornecedores teste
  console.log('\n=== VERIFICAÇÃO DE PARCEIROS TESTE ===\n');

  const [partners] = await connection.execute(`
    SELECT p.id, p.name, p.type,
      (SELECT COUNT(*) FROM sales WHERE customerId = p.id) as vendas,
      (SELECT COUNT(*) FROM purchaseOrders WHERE supplierId = p.id) as compras
    FROM partners p
    WHERE p.name LIKE '%teste%' OR p.name LIKE '%Teste%' OR p.name LIKE '%TESTE%'
  `);

  if (partners.length === 0) {
    console.log('Nenhum parceiro com "teste" no nome encontrado.');
  } else {
    for (const partner of partners) {
      const total = partner.vendas + partner.compras;
      if (total === 0) {
        console.log(`✅ Parceiro ${partner.id} (${partner.name}): Sem movimentações - pode ser excluído`);
      } else {
        console.log(`⚠️  Parceiro ${partner.id} (${partner.name}): ${partner.vendas} vendas, ${partner.compras} compras`);
      }
    }
  }

  await connection.end();
  console.log('\n=== LIMPEZA CONCLUÍDA ===');
}

main().catch(console.error);
