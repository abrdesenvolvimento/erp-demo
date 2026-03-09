import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { BarChart3, Clock, Flame, TrendingUp, ChefHat, Wine } from "lucide-react";
import { getCurrentBrazilDateInfo } from "@shared/dateUtils";

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AnaliseKDS() {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? 0;

  const brazilToday = useMemo(() => {
    const info = getCurrentBrazilDateInfo();
    return {
      dateStr: `${info.year}-${String(info.month).padStart(2, '0')}-${String(info.day).padStart(2, '0')}`,
      date: info.date,
    };
  }, []);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(brazilToday.date);
    d.setDate(d.getDate() - 7);
    return formatDate(d);
  });
  const [endDate, setEndDate] = useState(() => brazilToday.dateStr);
  const [destination, setDestination] = useState<"ALL" | "KITCHEN" | "BAR">("ALL");

  const { data, isLoading } = trpc.salon.getKDSAnalytics.useQuery(
    { companyId, startDate, endDate, destination },
    { enabled: companyId > 0 }
  );

  const fmt = (n: number) => n.toLocaleString("pt-BR");

  // Compute chart data: filter to only hours with activity + surrounding context
  const chartData = useMemo(() => {
    if (!data?.hourlyStats) return null;
    const stats = data.hourlyStats;
    const hasData = stats.some(h => h.count > 0);
    if (!hasData) return null;

    // Find the range of hours with activity, with 1h padding
    let firstActive = stats.findIndex(h => h.count > 0);
    let lastActive = stats.length - 1;
    for (let i = stats.length - 1; i >= 0; i--) {
      if (stats[i].count > 0) { lastActive = i; break; }
    }
    const rangeStart = Math.max(0, firstActive - 1);
    const rangeEnd = Math.min(23, lastActive + 1);
    const filtered = stats.slice(rangeStart, rangeEnd + 1);
    const maxCount = Math.max(...filtered.map(h => h.count), 1);
    return { hours: filtered, maxCount };
  }, [data?.hourlyStats]);

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

            {/* Peak Hour Chart */}
            {chartData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                    Horário de Pico — Itens Produzidos por Hora
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Legend */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-orange-500" />
                        Cozinha
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-amber-400" />
                        Bar
                      </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="flex items-end gap-1 sm:gap-1.5 h-52">
                      {chartData.hours.map((h) => {
                        const totalPct = (h.count / chartData.maxCount) * 100;
                        const kitchenPct = h.count > 0 ? (h.kitchen / h.count) * totalPct : 0;
                        const barPct = h.count > 0 ? (h.bar / h.count) * totalPct : 0;
                        // If kitchen + bar > total (due to BOTH items), normalize
                        const sumParts = h.kitchen + h.bar;
                        const normalizedKitchen = sumParts > 0 ? (h.kitchen / sumParts) * totalPct : 0;
                        const normalizedBar = sumParts > 0 ? (h.bar / sumParts) * totalPct : 0;
                        const isPeak = data.peakHour === h.hour;

                        return (
                          <div
                            key={h.hour}
                            className="flex-1 flex flex-col items-center group relative"
                            style={{ minWidth: 0 }}
                          >
                            {/* Tooltip */}
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                              {h.hour}: {h.count} itens
                              {h.kitchen > 0 && ` (Coz: ${h.kitchen})`}
                              {h.bar > 0 && ` (Bar: ${h.bar})`}
                            </div>

                            {/* Count label */}
                            {h.count > 0 && (
                              <span className="text-[10px] text-muted-foreground mb-1 font-medium">
                                {h.count}
                              </span>
                            )}

                            {/* Stacked bar */}
                            <div
                              className="w-full flex flex-col justify-end rounded-t-sm overflow-hidden"
                              style={{ height: `${Math.max(totalPct, h.count > 0 ? 4 : 0)}%` }}
                            >
                              {normalizedKitchen > 0 && (
                                <div
                                  className={`w-full ${isPeak ? "bg-orange-600" : "bg-orange-500"} transition-all`}
                                  style={{ height: `${(normalizedKitchen / totalPct) * 100}%`, minHeight: "2px" }}
                                />
                              )}
                              {normalizedBar > 0 && (
                                <div
                                  className={`w-full ${isPeak ? "bg-amber-500" : "bg-amber-400"} transition-all`}
                                  style={{ height: `${(normalizedBar / totalPct) * 100}%`, minHeight: "2px" }}
                                />
                              )}
                              {h.count > 0 && sumParts === 0 && (
                                <div className="w-full bg-orange-500 h-full" />
                              )}
                            </div>

                            {/* Hour label */}
                            <span className={`text-[10px] mt-1.5 ${isPeak ? "text-orange-600 font-bold" : "text-muted-foreground"}`}>
                              {h.hour.replace(":00", "h")}
                            </span>

                            {/* Peak indicator */}
                            {isPeak && (
                              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                                <span className="text-[9px] text-orange-600 font-bold whitespace-nowrap">PICO</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* X-axis line */}
                    <div className="border-t border-border -mt-2" />
                  </div>
                </CardContent>
              </Card>
            )}

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
                        {data.productStats.map((p: any, i: number) => {
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
                        {data.dailyStats.map((d: any, i: number) => {
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
