import { describe, expect, it } from "vitest";
import { buildAnnualGoalProgress, getGoalBrazilDate, goalAttainment, goalDailyPace, goalPeriodStatus, offsetGoalMonth, type AnnualGoalRow } from "../shared/metas";

const current = { year: 2026, month: 11, day: 3 };
const goal = (id: number, month: number, channelId: number | null, targetAmount: number): AnnualGoalRow => ({ id, month, channelId, targetAmount, channelName: channelId === null ? "Geral" : "iFood", channelCode: channelId === null ? "ALL" : "IFOOD" });

describe("Metas — regras puras de atingimento e período", () => {
  it("diferencia receita zero de ausência/valor zero de meta e preserva >100%", () => {
    expect(goalAttainment(0, 100)).toBe(0);
    expect(goalAttainment(80, 0)).toBeNull();
    expect(goalAttainment(80, -1)).toBeNull();
    expect(goalAttainment(125, 100)).toBe(125);
    expect(goalAttainment(100, 300)).toBe(33.3);
  });
  it("usa Brasília mesmo quando UTC já está no dia/mês/ano seguinte", () => {
    expect(getGoalBrazilDate(new Date("2027-01-01T02:59:59Z"))).toEqual({ year: 2026, month: 12, day: 31 });
    expect(getGoalBrazilDate(new Date("2027-01-01T03:00:00Z"))).toEqual({ year: 2027, month: 1, day: 1 });
  });
  it("seleciona meses anteriores relativos ao escolhido, incluindo a virada do ano", () => {
    expect(offsetGoalMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(offsetGoalMonth({ year: 2026, month: 1 }, -2)).toEqual({ year: 2025, month: 11 });
    expect(offsetGoalMonth({ year: 2026, month: 2 }, -2)).toEqual({ year: 2025, month: 12 });
    expect(offsetGoalMonth({ year: 2025, month: 8 }, -1)).toEqual({ year: 2025, month: 7 });
  });
  it("marca histórico encerrado, atual parcial e futuro não iniciado", () => {
    expect(goalPeriodStatus({ year: 2025, month: 12 }, current)).toBe("closed");
    expect(goalPeriodStatus({ year: 2026, month: 11 }, current)).toBe("active");
    expect(goalPeriodStatus({ year: 2026, month: 12 }, current)).toBe("future");
  });
  it("calcula necessidade diária só no mês atual e não inventa 0/dia no último dia", () => {
    expect(goalDailyPace({ year: 2026, month: 10 }, current, 0, 100)).toBeNull();
    expect(goalDailyPace({ year: 2026, month: 12 }, current, 0, 100)).toBeNull();
    expect(goalDailyPace(current, current, 30, 300)).toMatchObject({ daysInMonth: 30, daysRemaining: 27, dailyCurrent: 10, dailyNeeded: 10, onTrack: true });
    expect(goalDailyPace(current, { ...current, day: 30 }, 0, 300)?.dailyNeeded).toBeNull();
  });
  it("produz Jan–Dez, lacunas sem meta e receitas reais separadas para Geral/canal", () => {
    const result = buildAnnualGoalProgress(2026, [goal(1, 1, null, 100), goal(2, 1, 1, 100), goal(3, 2, 1, 100), goal(4, 3, 1, 0)], [
      { month: 1, channelId: 1, totalRevenue: "125.00" },
      { month: 1, channelId: 2, totalRevenue: "75.00" },
    ], current);
    expect(result.months).toHaveLength(12);
    expect(result.months[0].totalRevenue).toBe(200);
    expect(result.months[0].goals[0]).toMatchObject({ currentRevenue: 200, progress: 200 });
    expect(result.months[0].goals[1]).toMatchObject({ currentRevenue: 125, progress: 125 });
    expect(result.months[1].goals[0].progress).toBe(0);
    expect(result.months[2].goals[0].progress).toBeNull();
    expect(result.months[3].goals).toEqual([]);
    expect(result.series.map(series => series.key)).toEqual(["general", "channel_1"]);
    expect(result).not.toHaveProperty("overallProgress");
    expect(result).not.toHaveProperty("totalTarget");
  });
  it("mantém canais de mesmo nome independentes por ID e futuro sem conclusão de atingimento", () => {
    const result = buildAnnualGoalProgress(2026, [goal(1, 12, 1, 100), goal(2, 12, 2, 100)], [{ month: 12, channelId: 1, totalRevenue: 150 }], current);
    expect(result.series).toHaveLength(2);
    expect(result.months[11]).toMatchObject({ status: "future" });
    expect(result.months[11].goals.every(goal => !goal.achieved)).toBe(true);
  });
});
