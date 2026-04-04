/**
 * Job automático de snapshot de estoque mensal.
 * 
 * Captura dois tipos de snapshot por mês para TODAS as empresas ativas:
 *   - OPENING: estoque no início do mês (1º dia às 00:01 SP)
 *   - CLOSING: estoque no final do mês (último dia às 23:59 SP)
 * 
 * Quando o mês já tem snapshot do mesmo tipo, os valores são atualizados (idempotente).
 * As queries de Fechamento e Análise de Estoque usam os snapshots quando disponíveis.
 */

import cron from 'node-cron';
import { captureMonthlyStockSnapshot } from '../closingQueries';
import { getDb } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Busca todas as empresas ativas no banco de dados.
 */
async function getActiveCompanyIds(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [1]; // fallback para empresa 1

  try {
    const result = await db.execute(sql.raw(`
      SELECT id FROM companies WHERE active = 1 ORDER BY id
    `));
    const rows = (result[0] as unknown as any[]) || [];
    if (rows.length === 0) return [1];
    return rows.map(r => r.id);
  } catch (error) {
    console.error('[StockSnapshot] Erro ao buscar empresas ativas:', error);
    return [1];
  }
}

/**
 * Verifica se hoje é o primeiro dia do mês (timezone SP).
 */
function isFirstDayOfMonth(): boolean {
  const now = new Date();
  const spOffset = -3 * 60;
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const spDate = new Date(utcMs + (spOffset * 60000));
  return spDate.getDate() === 1;
}

/**
 * Verifica se hoje é o último dia do mês (timezone SP).
 */
function isLastDayOfMonth(): boolean {
  const now = new Date();
  const spOffset = -3 * 60;
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const spDate = new Date(utcMs + (spOffset * 60000));

  const today = spDate.getDate();
  const lastDay = new Date(spDate.getFullYear(), spDate.getMonth() + 1, 0).getDate();
  return today === lastDay;
}

/**
 * Retorna ano e mês atuais no timezone de SP.
 */
function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  const spOffset = -3 * 60;
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const spDate = new Date(utcMs + (spOffset * 60000));
  return { year: spDate.getFullYear(), month: spDate.getMonth() + 1 };
}

/**
 * Captura o snapshot de estoque para TODAS as empresas ativas.
 * @param snapshotType 'OPENING' para estoque inicial, 'CLOSING' para estoque final
 */
async function runStockSnapshotForAll(snapshotType: 'OPENING' | 'CLOSING'): Promise<void> {
  try {
    const { year, month } = getCurrentYearMonth();
    const companyIds = await getActiveCompanyIds();

    console.log(`[StockSnapshot] Iniciando captura ${snapshotType} para ${year}-${String(month).padStart(2, '0')} | Empresas: [${companyIds.join(', ')}]`);

    for (const companyId of companyIds) {
      try {
        const result = await captureMonthlyStockSnapshot(year, month, companyId, `SISTEMA_CRON_${snapshotType}`, snapshotType);
        console.log(`[StockSnapshot] ${snapshotType} Co${companyId}: ${result.saved} categorias salvas para ${result.competenceMonth}`);
      } catch (error) {
        console.error(`[StockSnapshot] Erro ao capturar ${snapshotType} para Co${companyId}:`, error);
      }
    }

    console.log(`[StockSnapshot] Captura ${snapshotType} concluída para todas as empresas.`);
  } catch (error) {
    console.error('[StockSnapshot] Erro geral ao capturar snapshot:', error);
  }
}

/**
 * Inicializa os jobs de snapshot de estoque.
 * 
 * Schedule (timezone SP):
 *   - OPENING: Todo dia 1 às 00:05 → captura estoque de abertura do mês
 *   - CLOSING: Todo dia às 23:55 → captura estoque de fechamento (só executa no último dia)
 *   - SAFETY NET: Todo dia 2 às 06:00 → verifica se o OPENING do mês foi capturado, se não, captura retroativamente
 */
export function initStockSnapshotJob(): void {
  // OPENING: 1º dia do mês às 00:05 SP (03:05 UTC)
  cron.schedule('0 5 0 1 * *', async () => {
    console.log('[StockSnapshot] 1º dia do mês detectado. Executando captura OPENING...');
    await runStockSnapshotForAll('OPENING');
  }, {
    timezone: 'America/Sao_Paulo'
  });

  // CLOSING: último dia do mês às 23:55 SP
  cron.schedule('0 55 23 * * *', async () => {
    if (isLastDayOfMonth()) {
      console.log('[StockSnapshot] Último dia do mês detectado. Executando captura CLOSING...');
      await runStockSnapshotForAll('CLOSING');
    }
  }, {
    timezone: 'America/Sao_Paulo'
  });

  // SAFETY NET: dia 2 às 06:00 SP → verifica se OPENING foi capturado
  cron.schedule('0 0 6 2 * *', async () => {
    console.log('[StockSnapshot] Safety net: verificando se OPENING do mês foi capturado...');
    await verifySafetyNet();
  }, {
    timezone: 'America/Sao_Paulo'
  });

  console.log('[StockSnapshot] Jobs agendados:');
  console.log('  - OPENING: dia 1 às 00:05 (SP)');
  console.log('  - CLOSING: último dia às 23:55 (SP)');
  console.log('  - SAFETY NET: dia 2 às 06:00 (SP)');
}

/**
 * Safety net: verifica se o snapshot de OPENING do mês atual existe.
 * Se não existir (ex: servidor estava fora do ar no dia 1), captura retroativamente.
 */
async function verifySafetyNet(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { year, month } = getCurrentYearMonth();
  const competenceMonth = `${year}-${String(month).padStart(2, '0')}`;
  const companyIds = await getActiveCompanyIds();

  for (const companyId of companyIds) {
    try {
      const result = await db.execute(sql.raw(`
        SELECT COUNT(*) as cnt FROM monthlyStockSnapshot 
        WHERE companyId = ${companyId} AND competenceMonth = '${competenceMonth}' AND snapshotType = 'OPENING'
      `));
      const count = (result[0] as unknown as any[])?.[0]?.cnt || 0;

      if (count === 0) {
        console.log(`[StockSnapshot] SAFETY NET: OPENING não encontrado para Co${companyId} ${competenceMonth}. Capturando retroativamente...`);
        const res = await captureMonthlyStockSnapshot(year, month, companyId, 'SAFETY_NET_OPENING', 'OPENING');
        console.log(`[StockSnapshot] SAFETY NET: ${res.saved} categorias salvas para Co${companyId} ${competenceMonth}`);
      } else {
        console.log(`[StockSnapshot] SAFETY NET: OPENING já existe para Co${companyId} ${competenceMonth} (${count} categorias)`);
      }
    } catch (error) {
      console.error(`[StockSnapshot] SAFETY NET erro Co${companyId}:`, error);
    }
  }

  // Também verifica se o CLOSING do mês anterior existe
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevCompetenceMonth = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

  for (const companyId of companyIds) {
    try {
      const result = await db.execute(sql.raw(`
        SELECT COUNT(*) as cnt FROM monthlyStockSnapshot 
        WHERE companyId = ${companyId} AND competenceMonth = '${prevCompetenceMonth}' AND snapshotType = 'CLOSING'
      `));
      const count = (result[0] as unknown as any[])?.[0]?.cnt || 0;

      if (count === 0) {
        console.log(`[StockSnapshot] SAFETY NET: CLOSING não encontrado para Co${companyId} ${prevCompetenceMonth}. Nota: dados podem não refletir o estoque real do final do mês.`);
        // Não captura retroativamente o CLOSING porque o estoque atual já mudou
        // Apenas loga o alerta
      }
    } catch (error) {
      console.error(`[StockSnapshot] SAFETY NET erro Co${companyId} (prev):`, error);
    }
  }
}

/**
 * Execução manual do snapshot (para uso via endpoint admin).
 * Permite capturar snapshot de qualquer mês, tipo e empresa.
 */
export async function manualStockSnapshot(
  year: number,
  month: number,
  companyId: number = 1,
  capturedBy?: string,
  snapshotType: 'OPENING' | 'CLOSING' = 'CLOSING'
) {
  return captureMonthlyStockSnapshot(year, month, companyId, capturedBy || 'MANUAL', snapshotType);
}
