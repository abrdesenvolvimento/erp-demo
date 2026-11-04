import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GOAL_MONTHS, type AnnualGoalProgress } from "@shared/metas";

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percent = (value: number | null) => value === null ? "Sem meta" : `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const COLORS = ["#d97706", "#2563eb", "#dc2626", "#7c3aed", "#059669", "#db2777", "#0891b2"];
const statusLabel = (status: string) => status === "future" ? "Não iniciado" : status === "active" ? "Parcial — mês atual" : "Encerrado";

type Props = { data?: AnnualGoalProgress; year: number; loading: boolean; error?: string; onRetry: () => void };

export function AnnualGoalChart({ data, year, loading, error, onRetry }: Props) {
  const chartData = useMemo(() => data?.months.map(month => {
    const values: Record<string, number | string | null> = { month: month.month, label: GOAL_MONTHS[month.month - 1].short };
    for (const series of data.series) {
      const goal = month.goals.find(goal => goal.channelId === series.channelId);
      // Futuro não é fracasso de 0%: lacuna no gráfico e status explícito no detalhe.
      values[series.key] = month.status === "future" ? null : goal?.progress ?? null;
    }
    return values;
  }) ?? [], [data]);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-5 w-5 text-primary" />Atingimento das metas por mês — {year}</CardTitle>
        <CardDescription>Realizado ÷ meta × 100. Escopo: empresa ativa (todas as filiais), como nas metas mensais. O mês atual é parcial. Geral e canais são séries independentes, sem somar ou tirar média dos percentuais.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        {loading ? <p role="status" className="py-12 text-center text-muted-foreground">Carregando atingimento anual...</p>
          : error ? <div role="alert" className="py-8 text-center"><p className="text-destructive">Não foi possível carregar o atingimento anual.</p><button type="button" onClick={onRetry} className="mt-2 text-sm underline focus-visible:outline-2">Tentar novamente</button></div>
          : !data?.series.length ? <p className="py-12 text-center text-muted-foreground">Nenhuma meta configurada para {year} nesta empresa. Meses sem meta não têm percentual de atingimento.</p>
          : <>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Legenda do gráfico">
              {data.series.map((series, index) => <span key={series.key} className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />{series.name}</span>)}
            </div>
            <div className="h-[300px] w-full min-w-0" role="group" aria-label={`Gráfico de atingimento percentual mensal de ${year}; consulte realizado, meta e percentual nos pontos do gráfico.`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 18, right: 26, left: 0, bottom: 8 }} accessibilityLayer>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={44} />
                  <YAxis tickFormatter={value => `${value}%`} domain={[0, (max: number) => Math.max(110, Math.ceil(max / 20) * 20)]} width={54} tick={{ fontSize: 11 }} />
                  <ReferenceLine y={100} stroke="currentColor" strokeDasharray="5 5" label={{ value: "Meta 100%", position: "insideTopRight", fontSize: 11, fill: "currentColor" }} />
                  <Tooltip filterNull={false} content={({ active, label }) => {
                    if (!active) return null;
                    const month = data.months.find(item => GOAL_MONTHS[item.month - 1].short === label);
                    if (!month) return null;
                    return <div className="max-w-[300px] rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                      <p className="mb-2 font-semibold">{GOAL_MONTHS[month.month - 1].label}/{year} · {statusLabel(month.status)}</p>
                      {data.series.map((series, index) => {
                        const goal = month.goals.find(item => item.channelId === series.channelId);
                        return <div key={series.key} className="mt-2 border-t pt-2"><p className="font-medium" style={{ color: COLORS[index % COLORS.length] }}>{series.name}</p>
                          {goal ? <><p>Realizado: {currency(goal.currentRevenue)}</p><p>Meta: {currency(goal.targetAmount)}</p><p>Atingimento: {month.status === "future" ? "Não iniciado" : percent(goal.progress)}</p></> : <p>Sem meta</p>}
                        </div>;
                      })}
                    </div>;
                  }} />
                  {data.series.map((series, index) => <Line key={series.key} type="linear" dataKey={series.key} name={series.name} stroke={COLORS[index % COLORS.length]} strokeWidth={series.channelId === null ? 3 : 2} strokeDasharray={index >= COLORS.length ? "5 3" : undefined} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground">Linha de referência: 100%. Valores acima de 100% são preservados. Sem meta (ou meta não positiva): lacuna; meses futuros: não iniciado. Receita segue as mesmas regras das metas mensais (vendas ativas), sem ajustes de implantação histórica.</p>
          </>}
      </CardContent>
    </Card>
  );
}
