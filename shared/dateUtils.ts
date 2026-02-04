/**
 * Utilitários centralizados para manipulação de datas com timezone de Brasília
 * 
 * IMPORTANTE: Todo o sistema deve usar estas funções para garantir consistência
 * de timezone (America/Sao_Paulo) em todas as operações com datas.
 */

const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

/**
 * Obtém a data/hora atual em Brasília
 */
export function getNowInBrazil(): Date {
  const now = new Date();
  const brasiliaStr = now.toLocaleString('en-US', { 
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Parse: "12/03/2025, 22:30:45" -> Date object
  const [datePart, timePart] = brasiliaStr.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hour, minute, second] = timePart.split(':');
  
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );
}

/**
 * Obtém apenas a data (sem hora) atual em Brasília
 * Retorna Date com hora zerada (00:00:00)
 */
export function getTodayInBrazil(): Date {
  const now = new Date();
  const brasiliaStr = now.toLocaleString('en-US', { 
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [month, day, year] = brasiliaStr.split('/');
  
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    0, 0, 0, 0
  );
}

/**
 * Converte uma string de data (YYYY-MM-DD) para Date em Brasília (meio-dia)
 * Usa meio-dia (12:00) para evitar problemas de timezone ao salvar no banco
 */
export function parseDateInBrazil(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Converte Date para string no formato YYYY-MM-DD usando timezone de Brasília
 */
export function formatDateForInput(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const brasiliaStr = d.toLocaleString('en-US', { 
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [month, day, year] = brasiliaStr.split('/');
  return `${year}-${month}-${day}`;
}

/**
 * Formata data para exibição em pt-BR (DD/MM/YYYY)
 */
export function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleDateString('pt-BR', {
    timeZone: BRAZIL_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formata data e hora para exibição em pt-BR (DD/MM/YYYY HH:MM)
 */
export function formatDateTimeBR(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleString('pt-BR', {
    timeZone: BRAZIL_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Verifica se uma data é hoje (em Brasília)
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = getTodayInBrazil();
  
  const dateStr = formatDateForInput(d);
  const todayStr = formatDateForInput(today);
  
  return dateStr === todayStr;
}

/**
 * Verifica se uma data está no passado (em Brasília)
 */
export function isPast(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = getTodayInBrazil();
  
  return d < today;
}

/**
 * Adiciona dias a uma data (em Brasília)
 */
export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Adiciona meses a uma data (em Brasília)
 */
export function addMonths(date: Date | string, months: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Obtém o primeiro dia do mês (em Brasília)
 */
export function getFirstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

/**
 * Obtém o último dia do mês (em Brasília)
 */
export function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

/**
 * Obtém início do dia (00:00:00) para uma data em Brasília
 * Retorna string YYYY-MM-DD HH:MM:SS para uso em queries SQL
 */
export function startOfDayBrazil(date?: Date | string): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  const dateStr = formatDateForInput(d);
  return `${dateStr} 00:00:00`;
}

/**
 * Obtém fim do dia (23:59:59) para uma data em Brasília
 * Retorna string YYYY-MM-DD HH:MM:SS para uso em queries SQL
 */
export function endOfDayBrazil(date?: Date | string): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  const dateStr = formatDateForInput(d);
  return `${dateStr} 23:59:59`;
}

/**
 * Obtém início do mês (dia 1, 00:00:00) em Brasília
 * Retorna string YYYY-MM-DD para uso em queries SQL
 */
export function startOfMonthBrazil(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Obtém fim do mês (último dia, 23:59:59) em Brasília
 * Retorna string YYYY-MM-DD para uso em queries SQL
 */
export function endOfMonthBrazil(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Obtém intervalo do dia atual em Brasília
 * Retorna { start: 'YYYY-MM-DD 00:00:00', end: 'YYYY-MM-DD 23:59:59' }
 */
export function getTodayRangeBrazil(): { start: string; end: string } {
  const today = formatDateForInput(new Date());
  return {
    start: `${today} 00:00:00`,
    end: `${today} 23:59:59`
  };
}

/**
 * Obtém intervalo do mês atual em Brasília
 * Retorna { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', year, month }
 */
export function getCurrentMonthRangeBrazil(): { start: string; end: string; year: number; month: number } {
  const info = getCurrentBrazilDateInfo();
  return {
    start: startOfMonthBrazil(info.year, info.month),
    end: endOfMonthBrazil(info.year, info.month),
    year: info.year,
    month: info.month
  };
}

/**
 * Obtém intervalo de um mês específico em Brasília
 * Retorna { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 */
export function getMonthRangeBrazil(year: number, month: number): { start: string; end: string } {
  return {
    start: startOfMonthBrazil(year, month),
    end: endOfMonthBrazil(year, month)
  };
}

/**
 * Converte Date para string YYYY-MM-DD (sem timezone conversion)
 * Use para datas já em Brasília ou quando precisa apenas do formato
 */
export function toDateString(date: Date | string): string {
  if (typeof date === 'string') {
    // Se já é string no formato YYYY-MM-DD, retorna direto
    if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
      return date.split('T')[0].split(' ')[0];
    }
    return formatDateForInput(new Date(date));
  }
  return formatDateForInput(date);
}

/**
 * Obtém informações do dia atual em Brasília
 */
export function getCurrentBrazilDateInfo() {
  const now = new Date();
  const brasiliaStr = now.toLocaleString('en-US', { 
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [month, day, year] = brasiliaStr.split('/');
  
  return {
    year: parseInt(year),
    month: parseInt(month),
    day: parseInt(day),
    date: new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0)
  };
}
