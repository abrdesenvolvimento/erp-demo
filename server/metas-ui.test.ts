import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const page = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Metas.tsx"), "utf8");
const chart = readFileSync(resolve(import.meta.dirname, "../client/src/components/metas/AnnualGoalChart.tsx"), "utf8");
const comparison = readFileSync(resolve(import.meta.dirname, "../client/src/components/metas/GoalComparison.tsx"), "utf8");

describe("Metas — regressões do contrato de interface", () => {
  it("usa seleção de ano/mês para cartões e meses anteriores, sem progresso fixo no atual", () => {
    expect(page).toContain('aria-label="Ano de acompanhamento"');
    expect(page).toContain('aria-label="Mês de acompanhamento"');
    expect(page).toContain("annual?.months.find(period => period.month === selectedMonth)");
    expect(page).toContain("offsetGoalMonth(selectedPeriod, -1)");
    expect(page).toContain("offsetGoalMonth(selectedPeriod, -2)");
    expect(page).not.toContain("trpc.goals.progress.useQuery({ year: currentYear");
  });
  it("invalida também o agregado anual após criação/edição e exclusão", () => {
    expect(page.match(/utils\.goals\.annualProgress\.invalidate\(\)/g)).toHaveLength(2);
  });
  it("preserva permissões de edição e responsividade sem alterar o layout global", () => {
    expect(page).toContain("const canEdit = goalsPermissions.canEdit");
    expect(page).toContain("{canEdit && (");
    expect(page).toContain("min-w-0 overflow-hidden");
    expect(page).toContain("flex flex-wrap items-start gap-5");
    expect(page).toContain("!g.achieved && isActivePeriod && g.progress !== null");
  });
  it("não limita o gráfico a 100%, não inventa zeros para lacunas e não une meses sem meta", () => {
    expect(chart).toContain("<ReferenceLine y={100}");
    expect(chart).toContain('month.status === "future" ? null : goal?.progress ?? null');
    expect(chart).toContain("connectNulls={false}");
    expect(chart).toContain("Math.max(110, Math.ceil(max / 20) * 20)");
    expect(chart).not.toContain("Math.min");
  });
  it("exibe valores financeiros, percentual com uma casa e tabela acessível", () => {
    expect(chart).toContain("Realizado:");
    expect(chart).toContain("Meta:");
    expect(chart).toContain("Atingimento:");
    expect(chart).toContain("minimumFractionDigits: 1, maximumFractionDigits: 1");
    expect(chart).toContain("<details");
    expect(chart).toContain("<caption");
    expect(chart).toContain("Não iniciado");
    expect(chart).toContain("empresa ativa (todas as filiais)");
  });
  it("compara por ID do canal, inclui todos os canais nos períodos e trata futuros/sem meta", () => {
    expect(comparison).toContain("periods.flatMap");
    expect(comparison).toContain("item.channelId === channel.channelId");
    expect(comparison).toContain('data?.status === "future" ? "Não iniciado"');
    expect(comparison).toContain('goal.progress === null ? "Sem meta válida"');
    expect(comparison).toContain("Sem meta");
  });
});
