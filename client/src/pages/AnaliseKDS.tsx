import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { BarChart3, Clock, Flame, TrendingUp, ChefHat, Wine, Filter } from "lucide-react";

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AnaliseKDS() {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? 0;

  const today = useMemo(() => new Date(), []);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return formatDate(d);
  });
  const [endDate, setEndDate] = useState(() => formatDate(today));
  const [destination, setDestination] = useState<"ALL" | "KITCHEN" | "BAR">("ALL");

  const { data, isLoading } = trpc.salon.getKDSAnalytics.useQuery(
    { companyId, startDate, endDate, destination },
    { enabled: companyId > 0 }
  );

  const fmt = (n: number) => n.toLocaleString("pt-BR");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-orange-500" />
            Análise KDS
          </h1>
          <p className="text-muted-foreground text-sm">
            Análise de desempenho da produção (Cozinha e Bar)
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium">Data Início</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block mt-1 border rounded-md px-3 py-2 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">Data Fim</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block mt-1 border rounded-md px-3 py-2 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">Destino</label>
                <div className="flex gap-1 mt-1">
                  {(["ALL", "KITCHEN", "BAR"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDestination(d)}
                      className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                        destination === d
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-background hover:bg-muted border-border"
                      }`}
                    >
                      {d === "ALL" ? "Todos" : d === "KITCHEN" ? "Cozinha" : "Bar"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStartDate(formatDate(today));
                    setEndDate(formatDate(today));
                  }}
                  className="px-3 py-2 text-sm rounded-md border hover:bg-muted transition-colors"
                >
                  Hoje
                </button>
                <button
                  onClick={() => {
                    const d = new Date(today);
                    d.setDate(d.getDate() - 7);
                    setStartDate(formatDate(d));
                    setEndDate(formatDate(today));
                  }}
                  className="px-3 py-2 text-sm rounded-md border hover:bg-muted transition-colors"
                >
                  7 dias
                </button>
                <button
                  onClick={() => {
                    const d = new Date(today);
                    d.setDate(d.getDate() - 30);
                    setStartDate(formatDate(d));
                    setEndDate(formatDate(today));
                  }}
                  className="px-3 py-2 text-sm rounded-md border hover:bg-muted transition-colors"
                >
                  30 dias
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : !data ? (
          <p className="text-center text-muted-foreground py-10">Sem dados disponíveis</p>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
                    <Flame className="h-3.5 w-3.5 text-orange-500" />
                    PEDIDOS
                  </div>
                  <p className="text-2xl font-bold">{fmt(data.totalOrders)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
                    <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                    ITENS
                  </div>
                  <p className="text-2xl font-bold">{fmt(data.totalItems)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
                    <Clock className="h-3.5 w-3.5 text-green-500" />
                    TEMPO MÉDIO
                  </div>
                  <p className="text-2xl font-bold">{data.avgPrepTimeMin}<span className="text-sm font-normal">min</span></p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
                    HORÁRIO PICO
                  </div>
                  <p className="text-2xl font-bold">{data.peakHour ?? "—"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
                    <ChefHat className="h-3.5 w-3.5 text-red-500" />
                    COZINHA
                  </div>
                  <p className="text-2xl font-bold">{fmt(data.destinationBreakdown.kitchen)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
                    <Wine className="h-3.5 w-3.5 text-amber-600" />
                    BAR
                  </div>
                  <p className="text-2xl font-bold">{fmt(data.destinationBreakdown.bar)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Product Stats Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Tempo Médio por Produto</CardTitle>
              </CardHeader>
              <CardContent>
                {data.productStats.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">Nenhum item preparado no período</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4">Produto</th>
                          <th className="py-2 pr-4 text-right">Qtd Preparada</th>
                          <th className="py-2 text-right">Tempo Médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.productStats.map((p, i) => {
                          const maxCount = data.productStats[0]?.count ?? 1;
                          const pct = Math.round((p.count / maxCount) * 100);
                          return (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2.5 pr-4 font-medium">{p.name}</td>
                              <td className="py-2.5 pr-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-orange-500 rounded-full"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-muted-foreground min-w-[3rem] text-right">
                                    {fmt(p.count)}x
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 text-right">
                                <span className={`font-semibold ${p.avgPrepMin <= 5 ? "text-green-600" : p.avgPrepMin <= 15 ? "text-amber-600" : "text-red-600"}`}>
                                  {p.avgPrepMin}min
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily Stats Table */}
            {data.dailyStats.length > 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Evolução Diária</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4">Data</th>
                          <th className="py-2 pr-4 text-right">Pedidos</th>
                          <th className="py-2 pr-4 text-right">Itens</th>
                          <th className="py-2 text-right">Tempo Médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.dailyStats.map((d, i) => {
                          const [y, m, day] = d.date.split("-");
                          return (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2.5 pr-4 font-medium">{`${day}/${m}`}</td>
                              <td className="py-2.5 pr-4 text-right">{d.orders}</td>
                              <td className="py-2.5 pr-4 text-right">{d.items}</td>
                              <td className="py-2.5 text-right">
                                <span className={`font-semibold ${d.avgPrepMin <= 5 ? "text-green-600" : d.avgPrepMin <= 15 ? "text-amber-600" : "text-red-600"}`}>
                                  {d.avgPrepMin}min
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
