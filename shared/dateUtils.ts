/**
 * Utilitários centralizados para manipulação de datas com timezone de Brasília
 * 
 * IMPORTANTE: Todo o sistema deve usar estas funções para garantir consistência
 * de timezone (America/Sao_Paulo = UTC-3) em todas as operações com datas.
 * 
 * REGRA FUNDAMENTAL: O banco armazena timestamps em UTC. 
 * Todas as funções que retornam Date devem retornar Date objects com o UTC correto.
 * getNowInBrazil() NÃO retorna "hora de Brasília como se fosse local" — 
 * retorna new Date() (que já é UTC correto). O nome é mantido por compatibilidade.
 * 
 * Para obter a data/hora de Brasília como STRING (para exibição ou comparação),
 * usar formatDateForInput(), formatDateBR(), formatDateTimeBR(), etc.
 */

const BRAZIL_TIMEZONE = 'America/Sao_Paulo';
const BRAZIL_OFFSET_HOURS = -3; // UTC-3 (simplificado, sem horário de verão)

/**
 * Obtém a data/hora atual como Date (UTC correto).
 * O banco armazena em UTC, e CONVERT_TZ converte para Brasília nas queries.
 * Portanto, basta usar new Date() que já é UTC.
 */
export function getNowInBrazil(): Date {
  return new Date();
}

/**
 * Obtém apenas a data (sem hora) atual em Brasília.
 * Retorna Date com meia-noite UTC do dia atual em Brasília.
 * Ex: Se agora é 23:30 Brasília (02:30 UTC do dia seguinte),
 *     retorna 03:00 UTC do dia atual em Brasília.
 */
export function getTodayInBrazil(): Date {
  const dateStr = formatDateForInput(new Date());
  // dateStr = "YYYY-MM-DD" do dia atual em Brasília
  // Converter para meia-noite Brasília = 03:00 UTC
  return new Date(dateStr + 'T00:00:00-03:00');
}

/**
 * Converte uma string de data (YYYY-MM-DD) para Date com UTC correto,
 * assumindo que a data está em horário de Brasília (meio-dia).
 * Usa meio-dia (12:00) para evitar problemas de arredondamento.
 */
export function parseDateInBrazil(dateStr: string): Date {
  if (!dateStr) return new Date();
  // "2026-02-22" → 2026-02-22T12:00:00-03:00 → 2026-02-22T15:00:00Z
  return new Date(dateStr + 'T12:00:00-03:00');
}

/**
 * Converte uma string de data de formulário (YYYY-MM-DD ou YYYY-MM-DD HH:MM:SS)
 * para Date UTC correto, assumindo que a data está em horário de Brasília.
 * 
 * IMPORTANTE: Usar esta função para TODAS as datas que vêm de formulários
 * (compras, despesas, parcelas, etc.) para garantir que o banco armazene
 * o UTC correto.
 * 
 * Exemplos:
 * - "2026-02-22" → 2026-02-22T03:00:00Z (meia-noite Brasília = 03:00 UTC)
 * - "2026-02-22 14:30:00" → 2026-02-22T17:30:00Z (14:30 Brasília = 17:30 UTC)
 */
export function parseDateAsBrasilia(dateStr: string): Date {
  if (!dateStr) return new Date();
  const trimmed = dateStr.trim();
  
  // Se já tem offset de timezone, usar como está
  if (trimmed.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  
  // Normalizar para formato ISO
  let normalized = trimmed.replace(' ', 'T');
  
  // Se só tem data (YYYY-MM-DD), adicionar meia-noite
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    normalized += 'T00:00:00';
  }
  
  // Adicionar offset de Brasília (GMT-3)
  return new Date(normalized + '-03:00');
}

/**
 * Converte Date para string no formato YYYY-MM-DD usando timezone de Brasília.
 * Usa Intl para garantir que funciona independente do timezone do servidor.
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
  const today = new Date();
  
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
 * Adiciona dias a uma data
 */
export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Adiciona meses a uma data
 */
export function addMonths(date: Date | string, months: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Obtém o primeiro dia do mês (em UTC, meia-noite Brasília)
 */
export function getFirstDayOfMonth(year: number, month: number): Date {
  return new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00-03:00`);
}

/**
 * Obtém o último dia do mês (em UTC, 23:59:59 Brasília)
 */
export function getLastDayOfMonth(year: number, month: number): Date {
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59-03:00`);
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
    date: new Date(`${year}-${month}-${day}T00:00:00-03:00`)
  };
}

/**
 * Obtém o mês de competência (YYYY-MM) de uma data usando timezone de Brasília
 * IMPORTANTE: Usar esta função em vez de date.toISOString().slice(0,7) 
 * que usa UTC e pode retornar mês errado para datas próximas à meia-noite
 */
export function getCompetenceMonthBrazil(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const brasiliaStr = d.toLocaleString('en-US', { 
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [month, , year] = brasiliaStr.split('/');
  return `${year}-${month}`;
}
