import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Receipt, 
  Printer,
  Package,
  Users,
  CreditCard,
  Target,
  ArrowUp,
  ArrowDown,
  Minus,
  PlusCircle,
  Lock,
  Unlock
} from "lucide-react";
import { useState, useRef } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function FechamentoMensalNovo() {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const reportRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const { data, isLoading, error } = trpc.closing.monthly.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getPaymentTypeName = (type: string) => {
    const types: Record<string, string> = {
      'DINHEIRO': 'Dinheiro',
      'DEBITO': 'Débito',
      'CREDITO': 'Crédito',
      'PIX': 'PIX',
      'BOLETO': 'Boleto',
      'A_PRAZO': 'A Prazo',
    };
    return types[type] || type;
  };

  /**
   * Renderiza comparação com mês anterior
   * Para despesas: lógica invertida (aumento = vermelho, redução = verde)
   */
  const renderComparison = (current: number, previous: number | null, invertColors = false) => {
    if (previous === null || previous === undefined) return null;
    
    const diff = current - previous;
    const diffPercent = previous !== 0 ? (diff / previous) * 100 : 0;
    const isPositive = diff > 0;
    const isNeutral = Math.abs(diffPercent) < 0.1;

    if (isNeutral) {
      return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Minus className="h-3 w-3" />
          <span>vs mês anterior</span>
        </div>
      );
    }

    // Para despesas, invertemos: aumento é ruim (vermelho), redução é bom (verde)
    const isGood = invertColors ? !isPositive : isPositive;

    return (
      <div className={`flex items-center gap-1 text-xs ${isGood ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        <span>{formatPercent(Math.abs(diffPercent))} vs mês anterior</span>
      </div>
    );
  };

  // Query para verificar se o mês já tem snapshot de estoque
  const { data: snapshotInfo, refetch: refetchSnapshot } = trpc.closing.getStockSnapshot.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  // Mutation para capturar snapshot e fechar o mês
  const captureSnapshot = trpc.closing.captureStockSnapshot.useMutation({
    onSuccess: (result) => {
      toast.success(`Mês fechado com sucesso! ${result.saved} categorias salvas em snapshot.`);
      refetchSnapshot();
    },
    onError: (err) => {
      toast.error(`Erro ao fechar mês: ${err.message}`);
    },
  });

  const handleClosingMonth = () => {
    if (confirm(`Confirma o fechamento de ${MONTHS.find(m => m.value === selectedMonth)?.label}/${selectedYear}? O estoque final será congelado.`)) {
      captureSnapshot.mutate({ year: selectedYear, month: selectedMonth });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Fechamento Mensal
            </h1>
            <p className="text-muted-foreground mt-1">
              Relatório consolidado de resultados
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(month => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Botão de Fechar Mês (apenas admin) */}
            {user?.role === 'admin' && (
              <Button
                variant={snapshotInfo?.hasSnapshot ? "outline" : "default"}
                onClick={handleClosingMonth}
                disabled={captureSnapshot.isPending}
                className={snapshotInfo?.hasSnapshot ? "border-green-500 text-green-700" : ""}
              >
                {snapshotInfo?.hasSnapshot ? (
                  <><Lock className="h-4 w-4 mr-2" />Mês Fechado</>
                ) : (
                  <><Unlock className="h-4 w-4 mr-2" />{captureSnapshot.isPending ? 'Fechando...' : 'Fechar Mês'}</>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" text="Carregando dados do fechamento..." />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive">Erro ao carregar dados: {error.message}</p>
            </CardContent>
          </Card>
        ) : data ? (
          <div ref={reportRef} className="space-y-6 print:space-y-4">
            {/* Cabeçalho do Relatório (visível na impressão) */}
            <div className="hidden print:block text-center mb-6">
              <h1 className="text-2xl font-bold">Fechamento Mensal</h1>
              <p className="text-lg capitalize">{data.period.monthName} de {data.period.year}</p>
            </div>

            {/* 1. CARDS DE RESUMO COM COMPARATIVO */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
              <Card className="border-t-4 border-t-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-500" />
                    Faturamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(data.results.revenue)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.sales.total.count} vendas no período
                  </p>
                  {renderComparison(data.results.revenue, data.previousMonth?.revenue ?? null)}
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-amber-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-amber-500" />
                    Lucro Bruto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {formatCurrency(data.results.grossProfit)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Margem: {data.results.grossMargin}%
                  </p>
                  {renderComparison(data.results.grossProfit, data.previousMonth?.grossProfit ?? null)}
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-red-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-red-500" />
                    Despesas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(data.results.operationalExpenses)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.expenses.total.count} despesas no período
                  </p>
                  {renderComparison(data.results.operationalExpenses, data.previousMonth?.operationalExpenses ?? null, true)}
                </CardContent>
              </Card>

              <Card className={`border-t-4 ${data.results.netResult >= 0 ? 'border-t-green-500' : 'border-t-red-500'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {data.results.netResult >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    Resultado Líquido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${data.results.netResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(data.results.netResult)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Margem: {data.results.netMargin}%
                  </p>
                  {renderComparison(data.results.netResult, data.previousMonth?.netResult ?? null)}
                </CardContent>
              </Card>
            </div>

            {/* 2. VENDAS POR CANAL + METAS */}
            <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    Vendas por Canal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Canal</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead className="text-right">Ticket Médio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.salesByChannel && data.salesByChannel.length > 0 ? (
                        data.salesByChannel.map((channel: any) => (
                          <TableRow key={channel.channelCode}>
                            <TableCell className="font-medium">{channel.channelName}</TableCell>
                            <TableCell className="text-right">{channel.count}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(channel.revenue)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatPercent(channel.percentage)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(channel.ticketMedio)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        // Fallback: usar dados antigos por saleType
                        Object.entries(data.sales.byType).map(([type, values]) => {
                          const channelNames: Record<string, string> = {
                            'DELIVERY': 'Delivery',
                            'BALCAO': 'Balcão',
                            'A_PRAZO': 'A Prazo',
                          };
                          const percentage = data.sales.total.revenue > 0 
                            ? (values.revenue / data.sales.total.revenue) * 100 
                            : 0;
                          const ticketMedio = values.count > 0 ? values.revenue / values.count : 0;
                          
                          return (
                            <TableRow key={type}>
                              <TableCell className="font-medium">{channelNames[type] || type}</TableCell>
                              <TableCell className="text-right">{values.count}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(values.revenue)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatPercent(percentage)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(ticketMedio)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{data.sales.total.count}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(data.sales.total.revenue)}
                        </TableCell>
                        <TableCell className="text-right">100%</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(data.sales.total.count > 0 ? data.sales.total.revenue / data.sales.total.count : 0)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Metas vs Realizado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.goals && data.goals.goals && data.goals.goals.length > 0 ? (
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Canal</TableHead>
                            <TableHead className="text-right">Meta</TableHead>
                            <TableHead className="text-right">Realizado</TableHead>
                            <TableHead className="text-right">% Atingido</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.goals.goals.map((goal: any) => (
                            <TableRow key={goal.id}>
                              <TableCell className="font-medium">{goal.channelName}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(goal.targetAmount)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(goal.currentRevenue)}
                              </TableCell>
                              <TableCell className={`text-right font-bold ${
                                goal.progress >= 100 ? 'text-green-600' : 
                                goal.progress >= 80 ? 'text-amber-600' : 
                                'text-red-600'
                              }`}>
                                {formatPercent(goal.progress)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow className="font-bold">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(data.goals.totalTarget)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(data.goals.totalRevenue)}
                            </TableCell>
                            <TableCell className={`text-right font-bold ${
                              data.goals.overallProgress >= 100 ? 'text-green-600' : 
                              data.goals.overallProgress >= 80 ? 'text-amber-600' : 
                              'text-red-600'
                            }`}>
                              {formatPercent(data.goals.overallProgress)}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma meta cadastrada para este período
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 3. VENDAS E COMPRAS POR CATEGORIA */}
            <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    Vendas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead className="text-right">Margem</TableHead>
                        <TableHead className="text-right">Var. Margem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.salesByCategory && data.salesByCategory.length > 0 ? (
                        <>
                          {data.salesByCategory.map((cat: any) => {
                            // Buscar margem do mês anterior para esta categoria
                            const prevCat = data.previousMonth?.salesByCategory?.find(
                              (pc: any) => pc.categoryId === cat.categoryId
                            );
                            const marginDiff = prevCat ? cat.margin - prevCat.margin : null;
                            
                            return (
                              <TableRow key={cat.categoryId}>
                                <TableCell className="font-medium">{cat.categoryName}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(cat.revenue)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {formatPercent(cat.percentage)}
                                </TableCell>
                                <TableCell className={`text-right font-bold ${
                                  cat.margin >= 30 ? 'text-green-600' : 
                                  cat.margin >= 15 ? 'text-amber-600' : 
                                  'text-red-600'
                                }`}>
                                  {formatPercent(cat.margin)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {marginDiff !== null ? (
                                    <span className={`text-xs font-medium flex items-center justify-end gap-0.5 ${
                                      marginDiff > 0.5 ? 'text-green-600' : 
                                      marginDiff < -0.5 ? 'text-red-600' : 
                                      'text-muted-foreground'
                                    }`}>
                                      {marginDiff > 0.5 ? <ArrowUp className="h-3 w-3" /> : 
                                       marginDiff < -0.5 ? <ArrowDown className="h-3 w-3" /> : 
                                       <Minus className="h-3 w-3" />}
                                      {marginDiff > 0 ? '+' : ''}{marginDiff.toFixed(1)}pp
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {/* Linha de Total */}
                          <TableRow className="border-t-2 bg-muted/50 font-bold">
                            <TableCell className="font-bold">Total</TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {formatCurrency(data.salesByCategory.reduce((sum: number, cat: any) => sum + (cat.revenue || 0), 0))}
                            </TableCell>
                            <TableCell className="text-right font-bold">100%</TableCell>
                            <TableCell className={`text-right font-bold ${
                              (() => {
                                const totalRev = data.salesByCategory.reduce((s: number, c: any) => s + (c.revenue || 0), 0);
                                const weightedMargin = totalRev > 0 ? data.salesByCategory.reduce((s: number, c: any) => s + (c.margin || 0) * (c.revenue || 0), 0) / totalRev : 0;
                                return weightedMargin >= 30 ? 'text-green-600' : weightedMargin >= 15 ? 'text-amber-600' : 'text-red-600';
                              })()
                            }`}>
                              {(() => {
                                const totalRev = data.salesByCategory.reduce((s: number, c: any) => s + (c.revenue || 0), 0);
                                const weightedMargin = totalRev > 0 ? data.salesByCategory.reduce((s: number, c: any) => s + (c.margin || 0) * (c.revenue || 0), 0) / totalRev : 0;
                                return formatPercent(weightedMargin);
                              })()}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </>
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            Sem dados de vendas por categoria
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Compras por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.purchasesByCategory && data.purchasesByCategory.length > 0 ? (
                        <>
                          {data.purchasesByCategory.map((cat: any) => (
                            <TableRow key={cat.categoryId}>
                              <TableCell className="font-medium">{cat.categoryName}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(cat.amount)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatPercent(cat.percentage)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Linha de Total */}
                          <TableRow className="border-t-2 bg-muted/50 font-bold">
                            <TableCell className="font-bold">Total</TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {formatCurrency(data.purchasesByCategory.reduce((sum: number, cat: any) => sum + (cat.amount || 0), 0))}
                            </TableCell>
                            <TableCell className="text-right font-bold">100%</TableCell>
                          </TableRow>
                        </>
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            Sem dados de compras por categoria
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* 4. TIPO DE PAGAMENTO */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Faturamento por Tipo de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Qtd Transações</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.salesByPaymentType && data.salesByPaymentType.length > 0 ? (
                      data.salesByPaymentType.map((payment: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{getPaymentTypeName(payment.paymentType)}</TableCell>
                          <TableCell className="text-right">{payment.count}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(payment.revenue)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatPercent(payment.percentage)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Sem dados de pagamento
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {data.salesByPaymentType && data.salesByPaymentType.length > 0 && (
                    <TableFooter>
                      <TableRow className="font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">
                          {data.salesByPaymentType.reduce((sum: number, p: any) => sum + p.count, 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(data.salesByPaymentType.reduce((sum: number, p: any) => sum + p.revenue, 0))}
                        </TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </CardContent>
            </Card>

            {/* 5. ESTOQUE POR CATEGORIA + GIRO */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Estoque por Categoria + Giro
                  </CardTitle>
                  {snapshotInfo?.hasSnapshot ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                      <Lock className="h-3 w-3" /> Estoque Congelado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                      <Unlock className="h-3 w-3" /> Estoque em Tempo Real
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Estoque Inicial</TableHead>
                      <TableHead className="text-right">Estoque Final</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Variação</TableHead>
                      <TableHead className="text-right">Giro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.stockByCategory && data.stockByCategory.length > 0 ? (
                      (() => {
                        const totalFinalStock = data.stockByCategory.reduce((sum: number, s: any) => sum + s.finalStock, 0);
                        return data.stockByCategory.map((stock: any) => (
                          <TableRow key={stock.categoryId}>
                            <TableCell className="font-medium">{stock.categoryName}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(stock.initialStock)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(stock.finalStock)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {totalFinalStock > 0 ? ((stock.finalStock / totalFinalStock) * 100).toFixed(1) : '0.0'}%
                            </TableCell>
                            <TableCell className={`text-right font-mono ${
                              stock.variation > 0 ? 'text-green-600' : 
                              stock.variation < 0 ? 'text-red-600' : 
                              'text-muted-foreground'
                            }`}>
                              {formatCurrency(stock.variation)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {stock.turnover.toFixed(2)}x
                            </TableCell>
                          </TableRow>
                        ));
                      })()
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Sem dados de estoque
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {data.stockByCategory && data.stockByCategory.length > 0 && (
                    <TableFooter>
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(data.stockByCategory.reduce((sum: number, s: any) => sum + s.initialStock, 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(data.stockByCategory.reduce((sum: number, s: any) => sum + s.finalStock, 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono">100%</TableCell>
                        <TableCell className={`text-right font-mono ${
                          (() => {
                            const totalVar = data.stockByCategory.reduce((sum: number, s: any) => sum + s.variation, 0);
                            return totalVar > 0 ? 'text-green-600' : totalVar < 0 ? 'text-red-600' : 'text-muted-foreground';
                          })()
                        }`}>
                          {formatCurrency(data.stockByCategory.reduce((sum: number, s: any) => sum + s.variation, 0))}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {(() => {
                            const totalInitial = data.stockByCategory.reduce((sum: number, s: any) => sum + s.initialStock, 0);
                            const totalFinal = data.stockByCategory.reduce((sum: number, s: any) => sum + s.finalStock, 0);
                            const avgStock = (totalInitial + totalFinal) / 2;
                            const totalCmv = data.stockByCategory.reduce((sum: number, s: any) => {
                              const avg = (s.initialStock + s.finalStock) / 2;
                              return sum + (avg > 0 ? s.turnover * avg : 0);
                            }, 0);
                            const giro = avgStock > 0 ? totalCmv / avgStock : 0;
                            return giro.toFixed(2) + 'x';
                          })()}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </CardContent>
            </Card>

            {/* 6. DESPESAS POR CONTA GERENCIAL */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Despesas por Conta Gerencial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead>Classificação</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.dre?.despesas?.byAccount && data.dre.despesas.byAccount.length > 0 ? (
                      // Ordenar do maior para o menor valor
                      [...data.dre.despesas.byAccount]
                        .sort((a: any, b: any) => b.total - a.total)
                        .map((expense: any, idx: number) => {
                          const percentage = data.dre.despesas.total > 0 
                            ? (expense.total / data.dre.despesas.total) * 100 
                            : 0;
                          
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{expense.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {expense.classification}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(expense.total)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatPercent(percentage)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Sem dados de despesas
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {data.dre?.despesas?.byAccount && data.dre.despesas.byAccount.length > 0 && (
                    <TableFooter>
                      <TableRow className="font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(data.dre.despesas.total)}
                        </TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </CardContent>
            </Card>

            {/* 7. OUTRAS RECEITAS */}
            {(data as any).otherRevenues && ((data as any).otherRevenues.total > 0 || (data as any).otherRevenues.items?.length > 0) && (
              <Card className="border-t-4 border-t-emerald-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PlusCircle className="h-5 w-5 text-emerald-600" />
                      Outras Receitas
                    </CardTitle>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-600">
                        {formatCurrency((data as any).otherRevenues.total)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(data as any).otherRevenues.items?.length || 0} lançamento(s)
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Parceiro</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data as any).otherRevenues.items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.description}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.partnerName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.accountName || '—'}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-600 font-semibold">
                            {formatCurrency(item.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    {(data as any).otherRevenues.items?.length > 1 && (
                      <TableFooter>
                        <TableRow className="font-bold">
                          <TableCell colSpan={3}>Total</TableCell>
                          <TableCell className="text-right font-mono text-emerald-600">
                            {formatCurrency((data as any).otherRevenues.total)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* 8. COMPRAS POR FORNECEDOR */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Compras por Fornecedor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Qtd Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.purchasesBySupplier && data.purchasesBySupplier.length > 0 ? (
                      data.purchasesBySupplier.map((supplier: any) => (
                        <TableRow key={supplier.supplierId}>
                          <TableCell className="font-medium">{supplier.supplierName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(supplier.amount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatPercent(supplier.percentage)}
                          </TableCell>
                          <TableCell className="text-right">{supplier.invoiceCount}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Sem dados de compras por fornecedor
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {data.purchasesBySupplier && data.purchasesBySupplier.length > 0 && (
                    <TableFooter>
                      <TableRow className="font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(data.purchasesBySupplier.reduce((sum: number, s: any) => sum + s.amount, 0))}
                        </TableCell>
                        <TableCell className="text-right">100%</TableCell>
                        <TableCell className="text-right">
                          {data.purchasesBySupplier.reduce((sum: number, s: any) => sum + s.invoiceCount, 0)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      {/* Estilos de impressão */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            font-size: 9px !important;
          }
          /* Esconder sidebar, header, controles e scrollbars */
          [data-sidebar],
          nav,
          header,
          .print\:hidden,
          ::-webkit-scrollbar {
            display: none !important;
          }
          .print\:block {
            display: block !important;
          }
          /* Mostrar conteúdo em largura total */
          main,
          [data-sidebar-inset],
          .flex-1 {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          /* Cards compactos sem sombra */
          .border,
          [class*="Card"] {
            box-shadow: none !important;
            border: 1px solid #d1d5db !important;
            break-inside: avoid;
          }
          /* Padding compacto nos cards */
          [class*="CardHeader"] {
            padding: 8px 12px 4px !important;
          }
          [class*="CardContent"] {
            padding: 4px 12px 8px !important;
          }
          /* Tabelas compactas e sem overflow */
          table {
            font-size: 8px !important;
            width: 100% !important;
            table-layout: fixed;
          }
          th, td {
            padding: 2px 4px !important;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          /* Overflow hidden para containers de tabela */
          .overflow-x-auto,
          .overflow-auto {
            overflow: visible !important;
          }
          /* Grid de cards de resumo */
          .print\:grid-cols-4 {
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 8px !important;
          }
          .print\:grid-cols-2 {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .print\:space-y-4 > * + * {
            margin-top: 8px !important;
          }
          /* Texto dos cards de resumo menor */
          .text-2xl {
            font-size: 16px !important;
          }
          .text-lg {
            font-size: 12px !important;
          }
          .text-sm {
            font-size: 8px !important;
          }
          .text-xs {
            font-size: 7px !important;
          }
          /* Espaçamento entre seções */
          .space-y-6 > * + * {
            margin-top: 8px !important;
          }
          .gap-6 {
            gap: 8px !important;
          }
          .gap-4 {
            gap: 6px !important;
          }
          /* Evitar quebra de página dentro de cards */
          .space-y-6 > div {
            break-inside: avoid;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
