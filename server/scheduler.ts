/**
 * Scheduler de Backup Automático
 * Executa backup diário às 3h (horário de Brasília)
 */

import cron from 'node-cron';
import { createBackupLog, updateBackupLogSuccess, updateBackupLogPartial, updateBackupLogFailed } from './db';
import { notifyOwner } from './_core/notification';

// Flag para evitar execuções simultâneas
let isBackupRunning = false;

/**
 * Executa o backup chamando o endpoint interno
 */
async function executeScheduledBackup(): Promise<void> {
  if (isBackupRunning) {
    console.log('[Scheduler] Backup já em execução, pulando...');
    return;
  }

  isBackupRunning = true;
  const startTime = Date.now();
  
  console.log('═══════════════════════════════════════════════════');
  console.log('[Scheduler] Iniciando backup automático agendado');
  console.log(`[Scheduler] Horário: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  console.log('═══════════════════════════════════════════════════');

  try {
    // Chamar o endpoint de backup internamente
    const port = process.env.PORT || 3000;
    const response = await fetch(`http://localhost:${port}/api/backup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ triggeredBy: 'scheduled' }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('[Scheduler] ✓ Backup automático concluído com sucesso');
      console.log(`[Scheduler] Duração: ${result.duration}`);
      console.log(`[Scheduler] Tamanho total: ${result.totalSize}`);
    } else {
      throw new Error(result.error || 'Backup falhou sem mensagem de erro');
    }

  } catch (error: any) {
    console.error('[Scheduler] ✗ Erro no backup automático:', error.message);
    
    // Enviar notificação de falha
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await notifyOwner({
      title: '⚠️ Backup Automático Falhou - ABRWF',
      content: `**Data/Hora:** ${timestamp}\n\n**Erro:** ${error.message}\n\n**Ação necessária:** Verificar logs do sistema e executar backup manual se necessário.`,
    });
  } finally {
    isBackupRunning = false;
  }
}

/**
 * Inicializa o scheduler de backup
 * Cron: 0 3 * * * = Todos os dias às 3:00 AM
 * 
 * Formato: segundos minutos horas dia-do-mês mês dia-da-semana
 */
export function initBackupScheduler(): void {
  // Verificar se estamos em ambiente de produção ou desenvolvimento
  const isDev = process.env.NODE_ENV === 'development';
  
  console.log('[Scheduler] Inicializando scheduler de backup automático...');
  
  // Agendar backup diário às 3h (horário de Brasília)
  // Nota: node-cron usa o timezone do servidor, então configuramos explicitamente
  const backupJob = cron.schedule('0 0 3 * * *', executeScheduledBackup, {
    timezone: 'America/Sao_Paulo',
  });

  console.log('[Scheduler] ✓ Backup automático agendado para 3:00 AM (Brasília)');
  console.log('[Scheduler] Próxima execução:', getNextExecutionTime());
  
  // Em desenvolvimento, também podemos agendar um backup de teste
  if (isDev) {
    console.log('[Scheduler] Modo desenvolvimento: backup de teste disponível via /api/backup/test-scheduler');
  }
}

/**
 * Calcula o horário da próxima execução
 */
function getNextExecutionTime(): string {
  const now = new Date();
  const spNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  // Próxima execução às 3h
  const next = new Date(spNow);
  next.setHours(3, 0, 0, 0);
  
  // Se já passou das 3h hoje, será amanhã
  if (spNow.getHours() >= 3) {
    next.setDate(next.getDate() + 1);
  }
  
  return next.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Executa backup manualmente (para testes)
 */
export async function triggerManualBackup(): Promise<void> {
  console.log('[Scheduler] Backup manual solicitado');
  await executeScheduledBackup();
}

/**
 * Retorna status do scheduler
 */
export function getSchedulerStatus(): {
  isRunning: boolean;
  nextExecution: string;
  timezone: string;
  schedule: string;
} {
  return {
    isRunning: isBackupRunning,
    nextExecution: getNextExecutionTime(),
    timezone: 'America/Sao_Paulo',
    schedule: '0 0 3 * * * (Diário às 3:00 AM)',
  };
}
