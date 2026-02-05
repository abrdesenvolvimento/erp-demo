/**
 * Scheduler de Contabilização Automática em Lote
 * Executa contabilização semanal conforme configurações de governança
 */

import cron from 'node-cron';
import { 
  getGovernanceSettings, 
  logAccountingBatch,
  getAccountingPeriod,
  closeExpiredReopenedPeriods,
  postJournal
} from './db';
import { getDb } from './db';
import { journals } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { notifyOwner } from './_core/notification';

// Flag para evitar execuções simultâneas
let isAccountingRunning = false;
let accountingJob: cron.ScheduledTask | null = null;

// Armazenar configuração atual para comparação
let currentSchedule = { day: 0, hour: 3 };

/**
 * Executa a contabilização em lote para uma competência
 */
export async function runAccountingBatch(
  competenceMonth: string,
  triggeredBy: 'scheduled' | 'manual',
  userId?: string
): Promise<{
  success: boolean;
  salesProcessed: number;
  expensesProcessed: number;
  purchasesProcessed: number;
  otherRevenuesProcessed: number;
  journalsCreated: number;
  entriesCreated: number;
  errors: string[];
}> {
  const result = {
    success: true,
    salesProcessed: 0,
    expensesProcessed: 0,
    purchasesProcessed: 0,
    otherRevenuesProcessed: 0,
    journalsCreated: 0,
    entriesCreated: 0,
    errors: [] as string[],
  };

  const startTime = Date.now();
  console.log('═══════════════════════════════════════════════════');
  console.log(`[Accounting] Iniciando contabilização em lote: ${competenceMonth}`);
  console.log(`[Accounting] Tipo: ${triggeredBy}`);
  console.log(`[Accounting] Horário: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  console.log('═══════════════════════════════════════════════════');

  try {
    // Verificar se o período está aberto
    const period = await getAccountingPeriod(1, competenceMonth);
    if (period && period.status === 'CLOSED') {
      throw new Error(`Período ${competenceMonth} está fechado. Não é possível contabilizar.`);
    }

    // Buscar todos os journals DRAFT da competência e postá-los
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Buscar journals DRAFT da competência
    const draftJournals = await db
      .select({ id: journals.id })
      .from(journals)
      .where(and(
        eq(journals.competenceMonth, competenceMonth),
        eq(journals.status, 'DRAFT')
      ));

    console.log(`[Accounting] Encontrados ${draftJournals.length} journals DRAFT para postar`);

    // Postar cada journal
    for (const journal of draftJournals) {
      try {
        const postResult = await postJournal(journal.id);
        if (postResult.success) {
          result.journalsCreated++;
          console.log(`[Accounting] ✓ Journal ${journal.id} postado`);
        } else {
          result.errors.push(`Journal ${journal.id}: ${postResult.error}`);
          console.error(`[Accounting] ✗ Erro ao postar journal ${journal.id}: ${postResult.error}`);
        }
      } catch (err: any) {
        result.errors.push(`Journal ${journal.id}: ${err.message}`);
        console.error(`[Accounting] ✗ Erro ao postar journal ${journal.id}:`, err.message);
      }
    }

    console.log(`[Accounting] ${result.journalsCreated} journals postados com sucesso`);

    // Registrar log do batch
    await logAccountingBatch({
      companyId: 1,
      competenceMonth,
      batchType: triggeredBy === 'scheduled' ? 'SCHEDULED' : 'MANUAL',
      status: 'SUCCESS',
      salesProcessed: result.salesProcessed,
      expensesProcessed: result.expensesProcessed,
      purchasesProcessed: result.purchasesProcessed,
      otherRevenuesProcessed: result.otherRevenuesProcessed,
      journalsCreated: result.journalsCreated,
      entriesCreated: result.entriesCreated,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      triggeredBy: userId || 'system',
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Accounting] ✓ Contabilização concluída em ${duration}s`);

  } catch (error: any) {
    result.success = false;
    result.errors.push(error.message);
    console.error('[Accounting] ✗ Erro na contabilização:', error.message);

    // Registrar log de falha
    await logAccountingBatch({
      companyId: 1,
      competenceMonth,
      batchType: triggeredBy === 'scheduled' ? 'SCHEDULED' : 'MANUAL',
      status: 'FAILED',
      salesProcessed: result.salesProcessed,
      expensesProcessed: result.expensesProcessed,
      purchasesProcessed: result.purchasesProcessed,
      otherRevenuesProcessed: result.otherRevenuesProcessed,
      journalsCreated: result.journalsCreated,
      entriesCreated: result.entriesCreated,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      errorMessage: error.message,
      triggeredBy: userId || 'system',
    });

    // Notificar owner em caso de falha
    if (triggeredBy === 'scheduled') {
      const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      await notifyOwner({
        title: '⚠️ Contabilização Automática Falhou - ABRWF',
        content: `**Competência:** ${competenceMonth}\n\n**Data/Hora:** ${timestamp}\n\n**Erro:** ${error.message}\n\n**Ação necessária:** Verificar logs do sistema e executar contabilização manual se necessário.`,
      });
    }
  }

  return result;
}

/**
 * Executa a contabilização agendada
 */
async function executeScheduledAccounting(): Promise<void> {
  if (isAccountingRunning) {
    console.log('[Accounting Scheduler] Contabilização já em execução, pulando...');
    return;
  }

  isAccountingRunning = true;

  try {
    // Primeiro, fechar períodos reabertos que expiraram
    await closeExpiredReopenedPeriods();

    // Determinar competência a processar (mês atual)
    const now = new Date();
    const competenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await runAccountingBatch(competenceMonth, 'scheduled');

  } catch (error: any) {
    console.error('[Accounting Scheduler] Erro:', error.message);
  } finally {
    isAccountingRunning = false;
  }
}

/**
 * Converte dia da semana (0-6) para expressão cron
 */
function getDayOfWeekCron(day: number): string {
  // node-cron: 0 = domingo, 1 = segunda, etc.
  return String(day);
}

/**
 * Atualiza o agendamento baseado nas configurações
 */
export async function updateAccountingSchedule(): Promise<void> {
  const settings = await getGovernanceSettings(1);
  
  if (!settings) {
    console.log('[Accounting Scheduler] Configurações não encontradas, usando padrão');
    return;
  }

  if (!settings.autoAccountingEnabled) {
    console.log('[Accounting Scheduler] Contabilização automática desabilitada');
    if (accountingJob) {
      accountingJob.stop();
      accountingJob = null;
    }
    return;
  }

  const newDay = settings.autoAccountingDay ?? 0;
  const newHour = settings.autoAccountingHour ?? 3;

  // Verificar se precisa atualizar
  if (accountingJob && currentSchedule.day === newDay && currentSchedule.hour === newHour) {
    return;
  }

  // Parar job anterior
  if (accountingJob) {
    accountingJob.stop();
  }

  // Criar novo agendamento
  // Formato: segundos minutos horas dia-do-mês mês dia-da-semana
  const cronExpression = `0 0 ${newHour} * * ${getDayOfWeekCron(newDay)}`;
  
  accountingJob = cron.schedule(cronExpression, executeScheduledAccounting, {
    timezone: 'America/Sao_Paulo',
  });

  currentSchedule = { day: newDay, hour: newHour };

  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  console.log(`[Accounting Scheduler] ✓ Reagendado para ${dayNames[newDay]} às ${String(newHour).padStart(2, '0')}:00`);
}

/**
 * Inicializa o scheduler de contabilização
 */
export async function initAccountingScheduler(): Promise<void> {
  console.log('[Accounting Scheduler] Inicializando scheduler de contabilização...');
  
  const settings = await getGovernanceSettings(1);
  
  if (!settings || !settings.autoAccountingEnabled) {
    console.log('[Accounting Scheduler] Contabilização automática desabilitada ou configurações não encontradas');
    return;
  }

  const day = settings.autoAccountingDay ?? 0;
  const hour = settings.autoAccountingHour ?? 3;
  
  // Formato: segundos minutos horas dia-do-mês mês dia-da-semana
  const cronExpression = `0 0 ${hour} * * ${getDayOfWeekCron(day)}`;
  
  accountingJob = cron.schedule(cronExpression, executeScheduledAccounting, {
    timezone: 'America/Sao_Paulo',
  });

  currentSchedule = { day, hour };

  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  console.log(`[Accounting Scheduler] ✓ Contabilização agendada para ${dayNames[day]} às ${String(hour).padStart(2, '0')}:00 (Brasília)`);
  console.log('[Accounting Scheduler] Próxima execução:', getNextAccountingExecutionTime(day, hour));
}

/**
 * Calcula o horário da próxima execução
 */
function getNextAccountingExecutionTime(targetDay: number, targetHour: number): string {
  const now = new Date();
  const spNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  const next = new Date(spNow);
  next.setHours(targetHour, 0, 0, 0);
  
  // Calcular dias até o próximo dia da semana alvo
  const currentDay = spNow.getDay();
  let daysUntilTarget = targetDay - currentDay;
  
  if (daysUntilTarget < 0) {
    daysUntilTarget += 7;
  } else if (daysUntilTarget === 0 && spNow.getHours() >= targetHour) {
    daysUntilTarget = 7;
  }
  
  next.setDate(next.getDate() + daysUntilTarget);
  
  return next.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Retorna status do scheduler de contabilização
 */
export async function getAccountingSchedulerStatus(): Promise<{
  isRunning: boolean;
  isEnabled: boolean;
  nextExecution: string | null;
  schedule: string;
  timezone: string;
}> {
  const settings = await getGovernanceSettings(1);
  const isEnabled = settings?.autoAccountingEnabled ?? false;
  
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const day = settings?.autoAccountingDay ?? 0;
  const hour = settings?.autoAccountingHour ?? 3;
  
  return {
    isRunning: isAccountingRunning,
    isEnabled,
    nextExecution: isEnabled ? getNextAccountingExecutionTime(day, hour) : null,
    schedule: `${dayNames[day]} às ${String(hour).padStart(2, '0')}:00`,
    timezone: 'America/Sao_Paulo',
  };
}
