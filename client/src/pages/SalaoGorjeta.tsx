import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, TrendingUp, DollarSign, Award } from "lucide-react";

export default function SalaoGorjeta() {
  const { activeCompanyId } = useCompany();
  const companyId = activeCompanyId ?? 0;

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [startDate, setStartDate] = useState(firstDay.toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);

  const { data: report, isLoading } = trpc.salon.getWaiterReport.useQuery(
    { companyId, startDate, endDate },
    { enabled: companyId > 0 }
  );

  const formatCurrency = (v: number | string) =>
    parseFloat(String(v || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" />
          Gorjeta e Garçom
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Relatório de gorjetas e desempenho por garçom</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <Label className="text-xs">Período início</Label>
          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="mt-1 w-40"
          />
        </div>
        <div>
          <Label className="text-xs">Período fim</Label>
          <Input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="mt-1 w-40"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : !report || report.waiters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">Nenhum dado no período</p>
          <p className="text-sm text-muted-foreground mt-1">Feche comandas com gorjeta para ver o relatório</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Gorjetas</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(report.totalTips)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Vendas Salão</p>
                <p className="text-2xl font-bold">{formatCurrency(report.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Comandas Fechadas</p>
                <p className="text-2xl font-bold">{report.totalOrders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">{formatCurrency(report.avgTicket)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Waiter breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Desempenho por Garçom
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {report.waiters.map((waiter: any, idx: number) => (
                  <div key={waiter.waiterId ?? idx} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{waiter.waiterName ?? "Sem identificação"}</p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Vendas: {formatCurrency(waiter.totalRevenue)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {waiter.orderCount} comanda(s)
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Ticket médio: {formatCurrency(waiter.avgTicket)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="border-green-500 text-green-700 font-semibold">
                        {formatCurrency(waiter.totalTips)}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-0.5">gorjeta</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
