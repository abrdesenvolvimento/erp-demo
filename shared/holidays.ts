/**
 * Módulo de Feriados Nacionais Brasileiros
 * 
 * Calcula feriados fixos e móveis (baseados na Páscoa via algoritmo de Meeus/Gauss).
 * Inclui feriados nacionais oficiais + Carnaval (ponto facultativo amplamente observado).
 */

export interface Holiday {
  date: string; // formato YYYY-MM-DD
  name: string;
  type: "nacional" | "facultativo" | "manual";
}

/**
 * Calcula a data da Páscoa para um dado ano usando o algoritmo de Meeus/Gauss.
 * Retorna { month, day } (1-indexed).
 */
function calculateEaster(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Adiciona dias a uma data e retorna string YYYY-MM-DD.
 */
function addDays(year: number, month: number, day: number, daysToAdd: number): string {
  const date = new Date(year, month - 1, day + daysToAdd);
  return formatDate(date);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Retorna todos os feriados nacionais brasileiros para um dado ano.
 * Inclui feriados fixos e móveis.
 */
export function getBrazilianHolidays(year: number): Holiday[] {
  const easter = calculateEaster(year);
  const easterDate = new Date(year, easter.month - 1, easter.day);

  // Feriados móveis (baseados na Páscoa)
  const carnavalSeg = addDays(year, easter.month, easter.day, -48); // Segunda de Carnaval
  const carnavalTer = addDays(year, easter.month, easter.day, -47); // Terça de Carnaval
  const sextaSanta = addDays(year, easter.month, easter.day, -2);   // Sexta-feira Santa
  const pascoa = formatDate(easterDate);                              // Domingo de Páscoa
  const corpusChristi = addDays(year, easter.month, easter.day, 60); // Corpus Christi

  const holidays: Holiday[] = [
    // Feriados fixos nacionais
    { date: `${year}-01-01`, name: "Confraternização Universal", type: "nacional" },
    
    // Carnaval (ponto facultativo, mas amplamente observado)
    { date: carnavalSeg, name: "Carnaval (Segunda)", type: "facultativo" },
    { date: carnavalTer, name: "Carnaval (Terça)", type: "facultativo" },
    
    // Sexta-feira Santa / Paixão de Cristo
    { date: sextaSanta, name: "Sexta-feira Santa", type: "nacional" },
    
    // Páscoa
    { date: pascoa, name: "Páscoa", type: "nacional" },
    
    // Tiradentes
    { date: `${year}-04-21`, name: "Tiradentes", type: "nacional" },
    
    // Dia do Trabalho
    { date: `${year}-05-01`, name: "Dia do Trabalho", type: "nacional" },
    
    // Corpus Christi (ponto facultativo federal, mas feriado em muitos municípios)
    { date: corpusChristi, name: "Corpus Christi", type: "facultativo" },
    
    // Independência do Brasil
    { date: `${year}-09-07`, name: "Independência do Brasil", type: "nacional" },
    
    // Nossa Senhora Aparecida
    { date: `${year}-10-12`, name: "N. Sra. Aparecida", type: "nacional" },
    
    // Finados
    { date: `${year}-11-02`, name: "Finados", type: "nacional" },
    
    // Proclamação da República
    { date: `${year}-11-15`, name: "Proclamação da República", type: "nacional" },
    
    // Dia da Consciência Negra (feriado nacional desde 2024)
    { date: `${year}-11-20`, name: "Consciência Negra", type: "nacional" },
    
    // Natal
    { date: `${year}-12-25`, name: "Natal", type: "nacional" },
  ];

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Retorna feriados de um mês específico.
 */
export function getHolidaysForMonth(year: number, month: number): Holiday[] {
  const allHolidays = getBrazilianHolidays(year);
  const monthStr = String(month).padStart(2, "0");
  const prefix = `${year}-${monthStr}`;
  return allHolidays.filter(h => h.date.startsWith(prefix));
}

/**
 * Verifica se uma data é feriado e retorna o nome, ou null.
 */
export function isHoliday(year: number, month: number, day: number): Holiday | null {
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const holidays = getBrazilianHolidays(year);
  return holidays.find(h => h.date === dateStr) || null;
}
