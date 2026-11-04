import { History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GOAL_MONTHS, type AnnualGoalProgress, type GoalPeriod } from "@shared/metas";

type Month = AnnualGoalProgress["months"][number];
type Props = { periods: { period: GoalPeriod; data?: Month }[]; loading: boolean; error?: string };
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function GoalComparison({ periods, loading, error }: Props) {
  const channels = Array.from(new Map(periods.flatMap(({ data }) => data?.goals.map(goal => [goal.channelId ?? "general", { channelId: goal.channelId, name: goal.channelName }] as const) ?? [])).values());
  return <Card className="min-w-0">
    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-muted-foreground" />Comparativo — período selecionado e 2 meses anteriores</CardTitle><CardDescription>Mesma receita e meta da visão anual, no escopo da empresa ativa.</CardDescription></CardHeader>
    <CardContent>{loading ? <p role="status" className="py-4 text-center text-sm text-muted-foreground">Carregando comparativo...</p>
      : error ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar todos os meses do comparativo.</p>
      : !channels.length ? <p className="py-4 text-sm text-muted-foreground">Nenhuma meta configurada nos três meses deste comparativo.</p>
      : <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Comparativo mensal de realizado, meta e atingimento</caption>
        <thead><tr className="border-b"><th scope="col" className="py-2 pr-4 text-left font-medium text-muted-foreground">Canal</th>{periods.map(({ period }, index) => <th scope="col" key={`${period.year}-${period.month}`} className={`px-3 py-2 text-center font-medium ${index === 2 ? "text-primary" : "text-muted-foreground"}`}>{GOAL_MONTHS[period.month - 1].short}/{period.year}{index === 2 && <span className="sr-only"> (selecionado)</span>}</th>)}</tr></thead>
        <tbody>{channels.map(channel => <tr key={channel.channelId ?? "general"} className="border-b last:border-0"><th scope="row" className="py-3 pr-4 text-left font-medium">{channel.name}</th>{periods.map(({ period, data }) => {
          const goal = data?.goals.find(item => item.channelId === channel.channelId);
          return <td key={`${period.year}-${period.month}`} className="px-3 py-3 text-center">{goal ? <div className="space-y-1"><div className="whitespace-nowrap font-medium tabular-nums">{money(goal.currentRevenue)}</div><div className="whitespace-nowrap text-xs text-muted-foreground">Meta: {money(goal.targetAmount)}</div><div className={`text-xs font-semibold ${data?.status === "future" || goal.progress === null ? "text-muted-foreground" : goal.achieved ? "text-emerald-600" : "text-foreground"}`}>{data?.status === "future" ? "Não iniciado" : goal.progress === null ? "Sem meta válida" : `${goal.progress.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}</div>{data?.status === "active" && <div className="text-xs text-muted-foreground">Parcial</div>}</div> : <span className="text-xs text-muted-foreground">Sem meta</span>}</td>;
        })}</tr>)}</tbody>
      </table></div>}</CardContent>
  </Card>;
}
