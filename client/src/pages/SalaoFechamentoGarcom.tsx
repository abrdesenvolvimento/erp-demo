import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users, DollarSign, Clock, Receipt, Award,
  Calendar, ChevronDown, ChevronUp, CreditCard,
  Banknote, Smartphone, Ticket, TrendingUp,
  ShoppingBag, User, FileText, ArrowLeft, Download, Printer
} from "lucide-react";
import { useLocation } from "wouter";

const PAYMENT_LABELS: Record<string, { label: string; icon: typeof CreditCard; color: string }> = {
  CASH: { label: "Dinheiro", icon: Banknote, color: "text-green-600" },
  CREDIT: { label: "Crédito", icon: CreditCard, color: "text-blue-600" },
  DEBIT: { label: "Débito", icon: CreditCard, color: "text-purple-600" },
  PIX: { label: "PIX", icon: Smartphone, color: "text-teal-600" },
  VOUCHER: { label: "Voucher", icon: Ticket, color: "text-orange-600" },
};

export default function SalaoFechamentoGarcom() {
  const { activeCompanyId } = useCompany();
  const companyId = activeCompanyId ?? 0;
  const [, navigate] = useLocation();

  const getBrazilDateStr = () =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const [startDate, setStartDate] = useState(() => getBrazilDateStr());
  const [endDate, setEndDate] = useState(() => getBrazilDateStr());
  const [selectedWaiter, setSelectedWaiter] = useState<string>("all");
  const [expandedWaiter, setExpandedWaiter] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [productSortBy, setProductSortBy] = useState<"revenue" | "quantity">("revenue");

  const { data: waiters = [] } = trpc.salon.listWaiters.useQuery(
    { companyId },
    { enabled: companyId > 0 }
  );

  const { data: report, isLoading } = trpc.salon.getWaiterClosingReport.useQuery(
    {
      companyId,
      startDate,
      endDate,
      waiterId: selectedWaiter !== "all" ? selectedWaiter : undefined,
    },
    { enabled: companyId > 0 }
  );

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatMinutes = (min: number) => {
    if (min < 1) return "< 1min";
    if (min < 60) return `${Math.round(min)}min`;
    return `${Math.floor(min / 60)}h${Math.round(min % 60)}m`;
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  };

  const formatTime = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateShort = (date: Date | string | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
    });
  };

  const formatDateTimeShort = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    const dateStr = d.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
    });
    const timeStr = d.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateStr} ${timeStr}`;
  };

  const sortProducts = (products: Array<{ productName: string; quantity: number; totalRevenue: number }>) => {
    return [...products].sort((a, b) => {
      if (productSortBy === "quantity") return b.quantity - a.quantity;
      return b.totalRevenue - a.totalRevenue;
    });
  };

  const toggleWaiter = (id: string) => {
    setExpandedWaiter(expandedWaiter === id ? null : id);
    setExpandedOrder(null);
  };

  const toggleOrder = (id: number) => {
    setExpandedOrder(expandedOrder === id ? null : id);
  };

  const exportWaiterPDF = (w: NonNullable<typeof report>["waiters"][number]) => {
    const periodLabel = startDate === endDate
      ? new Date(startDate + "T12:00:00").toLocaleDateString("pt-BR")
      : `${new Date(startDate + "T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(endDate + "T12:00:00").toLocaleDateString("pt-BR")}`;

    const paymentRows = Object.entries(w.paymentBreakdown)
      .map(([method, amount]) => {
        const label = PAYMENT_LABELS[method]?.label ?? method;
        return `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${label}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${formatCurrency(amount as number)}</td></tr>`;
      })
      .join("");

    const productRows = w.productsSold
      .map(
        (p) =>
          `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${p.productName}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center;">${p.quantity}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${formatCurrency(p.totalRevenue)}</td></tr>`
      )
      .join("");

    const orderRows = w.orders
      .map(
        (o) =>
          `<tr>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;font-family:monospace;">#${o.id}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;">Mesa ${o.tableNumber}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center;">${o.guestCount}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center;">${formatDateTimeShort(o.openedAt)} - ${formatDateTimeShort(o.closedAt)}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(o.subtotal)}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;color:#16a34a;">${formatCurrency(o.tipAmount)}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">${formatCurrency(o.totalAmount)}</td>
          </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Fechamento - ${w.waiterName}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 0; }
  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { font-size: 20px; margin: 0 0 4px; }
  .header p { margin: 2px 0; color: #666; font-size: 11px; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
  .summary-card { flex: 1; min-width: 100px; border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; text-align: center; }
  .summary-card .label { font-size: 9px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 16px; font-weight: 700; margin-top: 2px; }
  .section-title { font-size: 13px; font-weight: 700; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #eee; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f5f5f5; padding: 6px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
</style></head><body>
<div class="header">
  <h1>Relatório de Fechamento</h1>
  <p><strong>${w.waiterName ?? "Desconhecido"}</strong></p>
  <p>Período: ${periodLabel}</p>
</div>

<div class="summary">
  <div class="summary-card"><div class="label">Faturamento</div><div class="value" style="color:#2563eb;">${formatCurrency(w.totalSales)}</div></div>
  <div class="summary-card"><div class="label">Subtotal</div><div class="value">${formatCurrency(w.totalSubtotal)}</div></div>
  <div class="summary-card"><div class="label">Taxa Serviço</div><div class="value" style="color:#16a34a;">${formatCurrency(w.totalTips)}</div></div>
  <div class="summary-card"><div class="label">Comandas</div><div class="value">${w.orderCount}</div></div>
  <div class="summary-card"><div class="label">Clientes</div><div class="value">${w.totalGuests}</div></div>
  <div class="summary-card"><div class="label">Ticket Médio</div><div class="value">${formatCurrency(w.avgTicket)}</div></div>
  <div class="summary-card"><div class="label">Tempo Médio</div><div class="value">${formatMinutes(w.avgServiceTime)}</div></div>
</div>

<div class="section-title">Produtos Vendidos</div>
<table>
  <thead><tr><th>Produto</th><th class="text-center">Qtd</th><th class="text-right">Receita</th></tr></thead>
  <tbody>${productRows}</tbody>
</table>

<div class="section-title">Formas de Pagamento</div>
<table>
  <thead><tr><th>Forma</th><th class="text-right">Valor</th></tr></thead>
  <tbody>${paymentRows}</tbody>
</table>

<div class="section-title">Comandas Detalhadas</div>
<table>
  <thead><tr><th>Comanda</th><th>Mesa</th><th class="text-center">Pessoas</th><th class="text-center">Horário</th><th class="text-right">Subtotal</th><th class="text-right">Taxa Serv.</th><th class="text-right">Total</th></tr></thead>
  <tbody>${orderRows}</tbody>
</table>

<div class="footer">Relatório gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} — ABRWF</div>
</body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
    }
  };

  return (
    <DashboardLayout>
      <div className="container max-w-6xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/salao/mesas")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Fechamento de Garçom
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Relatório detalhado de vendas, produtos e taxa de serviço por garçom
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Data Início
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Data Fim
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Garçom
                </label>
                <Select value={selectedWaiter} onValueChange={setSelectedWaiter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos os garçons" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os garçons</SelectItem>
                    {waiters.map((w) => (
                      <SelectItem key={w.userId} value={w.userId}>
                        {w.userName ?? "Sem nome"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    const today = getBrazilDateStr();
                    setStartDate(today);
                    setEndDate(today);
                  }}
                >
                  Hoje
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    const yesterday = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
                    setStartDate(yesterday);
                    setEndDate(yesterday);
                  }}
                >
                  Ontem
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {/* Results */}
        {report && !isLoading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50">
                <CardContent className="p-3 text-center">
                  <DollarSign className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Faturamento</p>
                  <p className="text-lg font-bold text-blue-700">{formatCurrency(report.totals.totalSales)}</p>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50">
                <CardContent className="p-3 text-center">
                  <Receipt className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                  <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Subtotal</p>
                  <p className="text-lg font-bold text-emerald-700">{formatCurrency(report.totals.totalSubtotal)}</p>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100/50">
                <CardContent className="p-3 text-center">
                  <TrendingUp className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <p className="text-[10px] text-green-600 font-medium uppercase tracking-wide">Taxa Serviço</p>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(report.totals.totalTips)}</p>
                </CardContent>
              </Card>
              <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50">
                <CardContent className="p-3 text-center">
                  <ShoppingBag className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                  <p className="text-[10px] text-orange-600 font-medium uppercase tracking-wide">Comandas</p>
                  <p className="text-lg font-bold text-orange-700">{report.totals.totalOrders}</p>
                </CardContent>
              </Card>
              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50">
                <CardContent className="p-3 text-center">
                  <Users className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-[10px] text-purple-600 font-medium uppercase tracking-wide">Clientes</p>
                  <p className="text-lg font-bold text-purple-700">{report.totals.totalGuests}</p>
                </CardContent>
              </Card>
              <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100/50">
                <CardContent className="p-3 text-center">
                  <DollarSign className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
                  <p className="text-[10px] text-indigo-600 font-medium uppercase tracking-wide">Ticket Médio</p>
                  <p className="text-lg font-bold text-indigo-700">{formatCurrency(report.totals.avgTicket)}</p>
                </CardContent>
              </Card>
              <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/50">
                <CardContent className="p-3 text-center">
                  <Clock className="h-5 w-5 text-rose-600 mx-auto mb-1" />
                  <p className="text-[10px] text-rose-600 font-medium uppercase tracking-wide">Tempo Médio</p>
                  <p className="text-lg font-bold text-rose-700">{formatMinutes(report.totals.avgServiceTime)}</p>
                </CardContent>
              </Card>
            </div>

            {/* No data */}
            {report.waiters.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Nenhuma comanda fechada no período</p>
                  <p className="text-sm mt-1">Ajuste as datas ou o filtro de garçom</p>
                </CardContent>
              </Card>
            )}

            {/* Waiter cards */}
            {report.waiters.map((w, idx) => {
              const isExpanded = expandedWaiter === (w.waiterId ?? "unknown");
              return (
                <Card key={w.waiterId ?? idx} className="overflow-hidden">
                  {/* Waiter header - clickable */}
                  <div
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleWaiter(w.waiterId ?? "unknown")}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            {idx === 0 && <Award className="h-6 w-6 text-yellow-500" />}
                            {idx === 1 && <Award className="h-6 w-6 text-gray-400" />}
                            {idx === 2 && <Award className="h-6 w-6 text-amber-700" />}
                            {idx > 2 && (
                              <span className="text-lg font-bold text-primary">
                                {(w.waiterName ?? "?").charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{w.waiterName ?? "Desconhecido"}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {w.orderCount} comanda{w.orderCount !== 1 ? "s" : ""} · {w.totalGuests} cliente{w.totalGuests !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-lg font-bold text-blue-600">{formatCurrency(w.totalSales)}</p>
                            <p className="text-sm text-green-600">{formatCurrency(w.totalTips)} taxa serviço</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              exportWaiterPDF(w);
                            }}
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Exportar</span>
                          </Button>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {/* Quick stats row (always visible) */}
                    <CardContent className="pb-3 pt-0">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div className="bg-blue-50 rounded-lg p-2 text-center sm:hidden">
                          <p className="text-[10px] text-blue-600 font-medium">Vendas</p>
                          <p className="text-sm font-bold text-blue-700">{formatCurrency(w.totalSales)}</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-2 text-center sm:hidden">
                          <p className="text-[10px] text-green-600 font-medium">Taxa Serviço</p>
                          <p className="text-sm font-bold text-green-700">{formatCurrency(w.totalTips)}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-slate-600 font-medium">Ticket Médio</p>
                          <p className="text-sm font-bold text-slate-700">{formatCurrency(w.avgTicket)}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-slate-600 font-medium">Tempo Médio</p>
                          <p className="text-sm font-bold text-slate-700">{formatMinutes(w.avgServiceTime)}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 text-center hidden sm:block">
                          <p className="text-[10px] text-slate-600 font-medium">Subtotal</p>
                          <p className="text-sm font-bold text-slate-700">{formatCurrency(w.totalSubtotal)}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 text-center hidden sm:block">
                          <p className="text-[10px] text-slate-600 font-medium">Comandas</p>
                          <p className="text-sm font-bold text-slate-700">{w.orderCount}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 text-center hidden sm:block">
                          <p className="text-[10px] text-slate-600 font-medium">Clientes</p>
                          <p className="text-sm font-bold text-slate-700">{w.totalGuests}</p>
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t">
                      {/* Products sold */}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4 text-primary" />
                            Produtos Vendidos
                          </h3>
                          <div className="flex gap-1">
                            <Button
                              variant={productSortBy === "revenue" ? "default" : "outline"}
                              size="sm"
                              className="h-7 text-xs px-2"
                              onClick={(e) => { e.stopPropagation(); setProductSortBy("revenue"); }}
                            >
                              Por Valor
                            </Button>
                            <Button
                              variant={productSortBy === "quantity" ? "default" : "outline"}
                              size="sm"
                              className="h-7 text-xs px-2"
                              onClick={(e) => { e.stopPropagation(); setProductSortBy("quantity"); }}
                            >
                              Por Qtd
                            </Button>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/30">
                                <th className="text-left p-2 font-medium">Produto</th>
                                <th className="text-right p-2 font-medium">Qtd</th>
                                <th className="text-right p-2 font-medium">Receita</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortProducts(w.productsSold).map((p, pIdx) => (
                                <tr key={pIdx} className="border-b last:border-0 hover:bg-muted/20">
                                  <td className="p-2">{p.productName}</td>
                                  <td className="p-2 text-right font-medium">{p.quantity}</td>
                                  <td className="p-2 text-right font-medium text-blue-600">
                                    {formatCurrency(p.totalRevenue)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <Separator />

                      {/* Payment breakdown */}
                      <div className="p-4">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-primary" />
                          Formas de Pagamento
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {Object.entries(w.paymentBreakdown).map(([method, amount]) => {
                            const info = PAYMENT_LABELS[method] ?? {
                              label: method,
                              icon: CreditCard,
                              color: "text-gray-600",
                            };
                            const Icon = info.icon;
                            return (
                              <div
                                key={method}
                                className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2"
                              >
                                <Icon className={`h-4 w-4 ${info.color}`} />
                                <span className="text-sm font-medium">{info.label}</span>
                                <span className={`text-sm font-bold ${info.color}`}>
                                  {formatCurrency(amount as number)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <Separator />

                      {/* Orders detail */}
                      <div className="p-4">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-primary" />
                          Comandas ({w.orders.length})
                        </h3>
                        <div className="space-y-2">
                          {w.orders.map((order) => {
                            const isOrderExpanded = expandedOrder === order.id;
                            return (
                              <div key={order.id} className="border rounded-lg overflow-hidden">
                                <div
                                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/20 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleOrder(order.id);
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="font-mono text-xs">
                                      #{order.id}
                                    </Badge>
                                    <div>
                                      <p className="text-sm font-medium">
                                        Mesa {order.tableNumber}
                                        <span className="text-muted-foreground ml-2">
                                          · {order.guestCount} pessoa{order.guestCount !== 1 ? "s" : ""}
                                        </span>
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatDateTimeShort(order.openedAt)} → {formatDateTimeShort(order.closedAt)}
                                        <span className="ml-2">({formatMinutes(order.serviceTimeMin)})</span>
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <p className="text-sm font-bold">{formatCurrency(order.totalAmount)}</p>
                                      {order.tipAmount > 0 && (
                                        <p className="text-xs text-green-600">
                                          +{formatCurrency(order.tipAmount)} taxa serviço
                                        </p>
                                      )}
                                    </div>
                                    {isOrderExpanded ? (
                                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>
                                </div>

                                {isOrderExpanded && (
                                  <div className="border-t bg-muted/10 p-3">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b">
                                          <th className="text-left p-1.5 font-medium">Item</th>
                                          <th className="text-right p-1.5 font-medium">Qtd</th>
                                          <th className="text-right p-1.5 font-medium">Unit.</th>
                                          <th className="text-right p-1.5 font-medium">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {order.items.map((item, iIdx) => (
                                          <tr key={iIdx} className="border-b last:border-0">
                                            <td className="p-1.5">{item.productName}</td>
                                            <td className="p-1.5 text-right">{item.quantity}</td>
                                            <td className="p-1.5 text-right">{formatCurrency(item.unitPrice)}</td>
                                            <td className="p-1.5 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr className="border-t font-medium">
                                          <td colSpan={3} className="p-1.5 text-right">Subtotal:</td>
                                          <td className="p-1.5 text-right">{formatCurrency(order.subtotal)}</td>
                                        </tr>
                                        {order.tipAmount > 0 && (
                                          <tr className="text-green-600">
                                            <td colSpan={3} className="p-1.5 text-right">Taxa de serviço:</td>
                                            <td className="p-1.5 text-right">{formatCurrency(order.tipAmount)}</td>
                                          </tr>
                                        )}
                                        <tr className="font-bold text-base">
                                          <td colSpan={3} className="p-1.5 text-right">Total:</td>
                                          <td className="p-1.5 text-right">{formatCurrency(order.totalAmount)}</td>
                                        </tr>
                                      </tfoot>
                                    </table>

                                    {order.payments.length > 0 && (
                                      <div className="mt-2 pt-2 border-t flex flex-wrap gap-2">
                                        {order.payments.map((p, pIdx) => {
                                          const info = PAYMENT_LABELS[p.method] ?? {
                                            label: p.method,
                                            icon: CreditCard,
                                            color: "text-gray-600",
                                          };
                                          return (
                                            <Badge key={pIdx} variant="secondary" className="text-xs">
                                              {info.label}: {formatCurrency(p.amount)}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
