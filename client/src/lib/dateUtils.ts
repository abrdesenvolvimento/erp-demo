/**
 * Utilitários de data para o frontend com timezone de Brasília
 * 
 * IMPORTANTE: Usar estas funções em vez de new Date().toISOString().split('T')[0]
 * para evitar problemas de timezone (após 21h de Brasília, UTC já é o dia seguinte)
 */

const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

/**
 * Obtém a data de hoje em Brasília no formato YYYY-MM-DD
 * Seguro para uso após 21h de Brasília (quando UTC já é o dia seguinte)
 */
export function getTodayBR(): string {
  const now = new Date();
  const parts = now.toLocaleDateString('en-CA', { timeZone: BRAZIL_TIMEZONE });
  // en-CA retorna no formato YYYY-MM-DD
  return parts;
}

/**
 * Converte uma Date para string YYYY-MM-DD usando timezone de Brasília
 * Substitui date.toISOString().split('T')[0] que usa UTC
 */
export function toDateStringBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-CA', { timeZone: BRAZIL_TIMEZONE });
}

/**
 * Obtém a data/hora atual em Brasília como Date object
 * ATENÇÃO: O Date retornado tem os valores de Brasília nos campos locais,
 * mas o timezone interno pode ser diferente. Use apenas para cálculos de data.
 */
export function getNowBR(): Date {
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
 * Obtém o mês de competência atual em Brasília no formato YYYY-MM
 */
export function getCurrentCompetenceMonthBR(): string {
  const now = new Date();
  const year = now.toLocaleDateString('en-US', { timeZone: BRAZIL_TIMEZONE, year: 'numeric' });
  const month = now.toLocaleDateString('en-US', { timeZone: BRAZIL_TIMEZONE, month: '2-digit' });
  return `${year}-${month}`;
}

/**
 * Cria uma Date com offset de Brasília a partir de uma string YYYY-MM-DD
 * Para enviar ao backend com o timezone correto
 */
export function parseDateBR(dateStr: string): Date {
  if (!dateStr) return new Date();
  // Adicionar T12:00:00 para evitar problemas de timezone ao cruzar meia-noite
  return new Date(dateStr + 'T12:00:00-03:00');
}

/**
 * Adiciona dias a uma data e retorna no formato YYYY-MM-DD
 */
export function addDaysBR(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00-03:00');
  d.setDate(d.getDate() + days);
  return toDateStringBR(d);
}

/**
 * Adiciona meses a uma data e retorna no formato YYYY-MM-DD
 */
export function addMonthsBR(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T12:00:00-03:00');
  d.setMonth(d.getMonth() + months);
  return toDateStringBR(d);
}
