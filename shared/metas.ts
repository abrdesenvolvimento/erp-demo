export const GOAL_MONTHS = [
  { value: 1, label: "Janeiro", short: "Jan" },
  { value: 2, label: "Fevereiro", short: "Fev" },
  { value: 3, label: "Março", short: "Mar" },
  { value: 4, label: "Abril", short: "Abr" },
  { value: 5, label: "Maio", short: "Mai" },
  { value: 6, label: "Junho", short: "Jun" },
  { value: 7, label: "Julho", short: "Jul" },
  { value: 8, label: "Agosto", short: "Ago" },
  { value: 9, label: "Setembro", short: "Set" },
  { value: 10, label: "Outubro", short: "Out" },
  { value: 11, label: "Novembro", short: "Nov" },
  { value: 12, label: "Dezembro", short: "Dez" },
] as const;

export type GoalPeriod = { year: number; month: number };
export type GoalCurrentDate = GoalPeriod & { day: number };
export type GoalPeriodStatus = "closed" | "active" | "future";

export function getGoalBrazilDate(now = new Date()): GoalCurrentDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

export function offsetGoalMonth(period: GoalPeriod, offset: number): GoalPeriod {
  const date = new Date(Date.UTC(period.year, period.month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function goalPeriodStatus(period: GoalPeriod, current: GoalPeriod): GoalPeriodStatus {
  const difference = (period.year - current.year) * 12 + period.month - current.month;
  return difference < 0 ? "closed" : difference > 0 ? "future" : "active";
}

export function goalAttainment(revenue: number, target: number): number | null {
  return target > 0 ? Math.round((revenue / target) * 1000) / 10 : null;
}

export function goalDailyPace(period: GoalPeriod, current: GoalCurrentDate, revenue: number, target: number) {
  if (goalPeriodStatus(period, current) !== "active" || target <= 0) return null;
  const daysInMonth = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  const daysRemaining = daysInMonth - current.day;
  const remaining = Math.max(0, target - revenue);
  return {
    daysInMonth, daysRemaining,
    dailyCurrent: revenue / current.day,
    // Não exibir uma necessidade diária fictícia de zero no último dia.
    dailyNeeded: daysRemaining > 0 ? remaining / daysRemaining : null,
    onTrack: revenue / current.day >= target / daysInMonth,
  };
}

export type AnnualGoalRow = {
  id: number; month: number; channelId: number | null; channelName: string;
  channelCode: string; targetAmount: string | number;
};
export type AnnualGoalRevenueRow = { month: number; channelId: number | null; totalRevenue: string | number };

/** As mesmas regras do progresso mensal: receita ACTIVE/finalAmount/saleDate,
 * sem somar metas Geral + canais nem produzir uma média de percentuais. */
export function buildAnnualGoalProgress(
  year: number, goalRows: AnnualGoalRow[], revenueRows: AnnualGoalRevenueRow[], current: GoalCurrentDate,
) {
  const months = GOAL_MONTHS.map(({ value: month }) => {
    const revenues = revenueRows.filter(row => Number(row.month) === month);
    const totalRevenue = revenues.reduce((sum, row) => sum + Number(row.totalRevenue || 0), 0);
    const byChannel = new Map(revenues.map(row => [Number(row.channelId || 0), Number(row.totalRevenue || 0)]));
    const status = goalPeriodStatus({ year, month }, current);
    const goals = goalRows.filter(row => Number(row.month) === month).map(goal => {
      const targetAmount = Number(goal.targetAmount || 0);
      const currentRevenue = goal.channelId === null ? totalRevenue : byChannel.get(Number(goal.channelId)) || 0;
      const progress = goalAttainment(currentRevenue, targetAmount);
      return {
        id: goal.id, channelId: goal.channelId, channelName: goal.channelName, channelCode: goal.channelCode,
        targetAmount, currentRevenue, progress, remaining: Math.max(0, targetAmount - currentRevenue),
        achieved: status !== "future" && targetAmount > 0 && currentRevenue >= targetAmount,
      };
    });
    return { year, month, status, goals, totalRevenue };
  });
  const series = Array.from(new Map(goalRows.map(goal => [goal.channelId ?? "general", {
    key: goal.channelId === null ? "general" : `channel_${goal.channelId}`,
    channelId: goal.channelId, name: goal.channelName,
  }])).values()).sort((a, b) => a.channelId === null ? -1 : b.channelId === null ? 1 : a.name.localeCompare(b.name, "pt-BR"));
  return { year, current, months, series };
}

export type AnnualGoalProgress = ReturnType<typeof buildAnnualGoalProgress>;
