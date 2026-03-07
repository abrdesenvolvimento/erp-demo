import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Users, TrendingUp, DollarSign, Clock, ShoppingCart,
  UserPlus, Star, Award, BarChart3, Calendar
} from "lucide-react";

export default function SalaoGarcons() {
  const { activeCompanyId } = useCompany();
  const companyId = activeCompanyId ?? 0;

  // Date range for performance
  // Use Brazil local date (not UTC) to avoid timezone issues
  const getBrazilDateStr = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // returns YYYY-MM-DD
  };
  const [startDate, setStartDate] = useState(() => {
    const today = getBrazilDateStr();
    return today.substring(0, 7) + '-01'; // first day of current month
  });
  const [endDate, setEndDate] = useState(() => getBrazilDateStr());

  const { data: waiters = [], isLoading: loadingWaiters } = trpc.salon.listWaiters.useQuery(
    { companyId },
    { enabled: companyId > 0 }
  );

  const { data: performance = [], isLoading: loadingPerf } = trpc.salon.getWaiterPerformance.useQuery(
    { companyId, startDate, endDate },
    { enabled: companyId > 0 }
  );

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatMinutes = (min: number) => {
    if (min < 60) return `${Math.round(min)}min`;
    return `${Math.floor(min / 60)}h${Math.round(min % 60)}m`;
  };

  // Totals
  const totals = useMemo(() => {
    return performance.reduce(
      (acc, w) => ({
        totalSales: acc.totalSales + w.totalSales,
        totalTips: acc.totalTips + w.totalTips,
        totalOrders: acc.totalOrders + w.orderCount,
        totalGuests: acc.totalGuests + w.totalGuests,
      }),
      { totalSales: 0, totalTips: 0, totalOrders: 0, totalGuests: 0 }
    );
  }, [performance]);

  // Sort by totalSales desc
  const sortedPerformance = useMemo(() => {
    return [...performance].sort((a, b) => b.totalSales - a.totalSales);
  }, [performance]);

  return (
    <DashboardLayout>
      <div className="container max-w-6xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Garçons
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestão e desempenho da equipe de atendimento
            </p>
          </div>
        </div>

        {/* Garçons cadastrados */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Garçons Cadastrados ({waiters.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingWaiters ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : waiters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum garçom cadastrado</p>
                <p className="text-sm mt-1">
                  Para cadastrar um garçom, vá em <strong>Administração → Gerenciar Acessos</strong> e
                  adicione o usuário com a role <strong>"Garçom"</strong>.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {waiters.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {(w.userName ?? "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{w.userName ?? "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground truncate">{w.userEmail ?? ""}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">Garçom</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Desempenho */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Desempenho
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 w-36 text-sm"
                />
                <span className="text-sm text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 w-36 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-3">
                <p className="text-xs text-blue-600 font-medium">Total Vendas</p>
                <p className="text-lg font-bold text-blue-700">{formatCurrency(totals.totalSales)}</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="p-3">
                <p className="text-xs text-green-600 font-medium">Total Gorjetas</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(totals.totalTips)}</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="p-3">
                <p className="text-xs text-orange-600 font-medium">Comandas Fechadas</p>
                <p className="text-lg font-bold text-orange-700">{totals.totalOrders}</p>
              </CardContent>
            </Card>
            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="p-3">
                <p className="text-xs text-purple-600 font-medium">Total Clientes</p>
                <p className="text-lg font-bold text-purple-700">{totals.totalGuests}</p>
              </CardContent>
            </Card>
          </div>

          {/* Performance table */}
          {loadingPerf ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : sortedPerformance.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma comanda fechada no período selecionado</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">#</th>
                        <th className="text-left p-3 font-medium">Garçom</th>
                        <th className="text-right p-3 font-medium">Vendas</th>
                        <th className="text-right p-3 font-medium">Gorjetas</th>
                        <th className="text-right p-3 font-medium">Comandas</th>
                        <th className="text-right p-3 font-medium">Ticket Médio</th>
                        <th className="text-right p-3 font-medium">Clientes</th>
                        <th className="text-right p-3 font-medium">Tempo Médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPerformance.map((w, idx) => (
                        <tr key={w.waiterId ?? idx} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            {idx === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                            {idx === 1 && <Award className="h-4 w-4 text-gray-400" />}
                            {idx === 2 && <Award className="h-4 w-4 text-amber-700" />}
                            {idx > 2 && <span className="text-muted-foreground">{idx + 1}</span>}
                          </td>
                          <td className="p-3 font-medium">{w.waiterName ?? "Desconhecido"}</td>
                          <td className="p-3 text-right font-semibold text-blue-600">
                            {formatCurrency(w.totalSales)}
                          </td>
                          <td className="p-3 text-right text-green-600">
                            {formatCurrency(w.totalTips)}
                          </td>
                          <td className="p-3 text-right">{w.orderCount}</td>
                          <td className="p-3 text-right">{formatCurrency(w.avgTicket)}</td>
                          <td className="p-3 text-right">{w.totalGuests}</td>
                          <td className="p-3 text-right text-muted-foreground">
                            {formatMinutes(w.avgServiceTime)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
