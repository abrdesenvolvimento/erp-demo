/**
 * Job automático de snapshot de estoque mensal.
 * 
 * Roda no último dia de cada mês às 23:59 (horário de São Paulo / GMT-3).
 * Captura o estoque final por categoria e salva na tabela monthlyStockSnapshot.
 * 
 * Quando o mês já tem snapshot, os valores são atualizados (idempotente).
 * As queries de Fechamento e Análise de Estoque usam o snapshot quando disponível.
 */

import cron from 'node-cron';
import { captureMonthlyStockSnapshot } from '../closingQueries';

/**
 * Verifica se hoje é o último dia do mês (considerando timezone SP).
 */
function isLastDayOfMonth(): boolean {
  // Criar data no timezone de SP (UTC-3)
  const now = new Date();
  const spOffset = -3 * 60; // -3h em minutos
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const spDate = new Date(utcMs + (spOffset * 60000));

  const today = spDate.getDate();
  const lastDay = new Date(spDate.getFullYear(), spDate.getMonth() + 1, 0).getDate();
  return today === lastDay;
}

/**
 * Captura o snapshot de estoque para o mês atual.
 * Chamado automaticamente pelo cron job ou manualmente via endpoint.
 */
async function runStockSnapshot(): Promise<void> {
  try {
    // Data atual em SP
    const now = new Date();
    const spOffset = -3 * 60;
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const spDate = new Date(utcMs + (spOffset * 60000));

    const year = spDate.getFullYear();
    const month = spDate.getMonth() + 1;

    console.log(`[StockSnapshot] Iniciando captura para ${year}-${String(month).padStart(2, '0')}...`);

    // Capturar para todas as empresas (por enquanto companyId=1)
    // TODO: quando multiempresa estiver ativo, iterar por todas as empresas
    const result = await captureMonthlyStockSnapshot(year, month, 1, 'SISTEMA_CRON');
    console.log(`[StockSnapshot] Captura concluída: ${result.saved} categorias salvas para ${result.competenceMonth}`);

  } catch (error) {
    console.error('[StockSnapshot] Erro ao capturar snapshot:', error);
  }
}

/**
 * Inicializa o job de snapshot de estoque.
 * Roda todos os dias às 23:59 (UTC-3 = 02:59 UTC do dia seguinte),
 * mas só executa de fato no último dia do mês.
 */
export function initStockSnapshotJob(): void {
  // Cron: 59 2 * * * = 02:59 UTC = 23:59 SP
  // Roda todos os dias, mas verifica se é último dia do mês
  cron.schedule('59 2 * * *', async () => {
    if (isLastDayOfMonth()) {
      console.log('[StockSnapshot] Último dia do mês detectado. Executando captura...');
      await runStockSnapshot();
    } else {
      // Log silencioso - não é último dia
    }
  }, {
    timezone: 'America/Sao_Paulo'
  });

  console.log('[StockSnapshot] Job agendado: último dia de cada mês às 23:59 (SP)');
}

/**
 * Execução manual do snapshot (para uso via endpoint admin).
 * Permite capturar snapshot de qualquer mês.
 */
export async function manualStockSnapshot(
  year: number,
  month: number,
  companyId: number = 1,
  capturedBy?: string
) {
  return captureMonthlyStockSnapshot(year, month, companyId, capturedBy || 'MANUAL');
}
