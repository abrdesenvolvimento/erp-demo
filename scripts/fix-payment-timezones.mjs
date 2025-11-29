#!/usr/bin/env node

/**
 * Script de Migração: Corrigir Timezone de Pagamentos
 * 
 * Problema: Pagamentos foram salvos com timezone EST (GMT-5) ao invés de UTC
 * Solução: Adicionar 5 horas a todas as datas de pagamento para corrigir
 * 
 * ATENÇÃO: Este script modifica dados no banco de dados!
 * Execute apenas uma vez e faça backup antes.
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

// Configuração do banco de dados
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada');
  process.exit(1);
}

async function main() {
  console.log('🔧 Iniciando migração de timezone de pagamentos...\n');

  // Conectar ao banco
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  try {
    // 1. Corrigir receivablePayments (Histórico de Recebimentos)
    console.log('📋 Corrigindo receivablePayments...');
    const result1 = await connection.execute(`
      UPDATE receivablePayments
      SET paidDate = DATE_ADD(paidDate, INTERVAL 5 HOUR)
      WHERE paidDate IS NOT NULL
    `);
    console.log(`   ✅ ${result1[0].affectedRows} registros atualizados\n`);

    // 2. Corrigir receivableInstallments.paidDate (Parcelas de Recebíveis)
    console.log('📋 Corrigindo receivableInstallments.paidDate...');
    const result2 = await connection.execute(`
      UPDATE receivableInstallments
      SET paidDate = DATE_ADD(paidDate, INTERVAL 5 HOUR)
      WHERE paidDate IS NOT NULL
    `);
    console.log(`   ✅ ${result2[0].affectedRows} registros atualizados\n`);

    // 3. Corrigir purchaseInstallments.paidDate (Parcelas de Compras)
    console.log('📋 Corrigindo purchaseInstallments.paidDate...');
    const result3 = await connection.execute(`
      UPDATE purchaseInstallments
      SET paidDate = DATE_ADD(paidDate, INTERVAL 5 HOUR)
      WHERE paidDate IS NOT NULL
    `);
    console.log(`   ✅ ${result3[0].affectedRows} registros atualizados\n`);

    // 4. Corrigir expenseInstallments.paymentDate (Parcelas de Despesas)
    console.log('📋 Corrigindo expenseInstallments.paymentDate...');
    const result4 = await connection.execute(`
      UPDATE expenseInstallments
      SET paymentDate = DATE_ADD(paymentDate, INTERVAL 5 HOUR)
      WHERE paymentDate IS NOT NULL
    `);
    console.log(`   ✅ ${result4[0].affectedRows} registros atualizados\n`);

    // Resumo
    const totalUpdated = 
      result1[0].affectedRows + 
      result2[0].affectedRows + 
      result3[0].affectedRows + 
      result4[0].affectedRows;

    console.log('═══════════════════════════════════════');
    console.log(`✅ Migração concluída com sucesso!`);
    console.log(`📊 Total de registros atualizados: ${totalUpdated}`);
    console.log('═══════════════════════════════════════\n');

    // Verificar alguns registros atualizados
    console.log('🔍 Verificando alguns registros do Vitor Hugo:');
    const [rows] = await connection.execute(`
      SELECT 
        rp.id,
        DATE_FORMAT(rp.paidDate, '%d/%m/%Y %H:%i') as data_corrigida,
        rp.paidAmount,
        p.name
      FROM receivablePayments rp
      JOIN partners p ON rp.customerId = p.id
      WHERE p.name LIKE '%Vitor Hugo%'
      ORDER BY rp.paidDate DESC
      LIMIT 5
    `);

    console.table(rows);

  } catch (error) {
    console.error('❌ Erro durante migração:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
