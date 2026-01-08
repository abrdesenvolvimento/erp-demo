import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  CreditCard,
  Printer,
  Calendar,
  CalendarDays
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useRef } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";

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

export default function FechamentoMensal() {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const reportRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = trpc.closing.monthly.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  const { data: yearlyData, isLoading: yearlyLoading } = trpc.closing.yearly.useQuery({
    year: selectedYear,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getSaleTypeName = (type: string) => {
    switch (type) {
      case "BALCAO": return "Balcão";
      case "DELIVERY": return "Delivery";
      case "A_PRAZO": return "A Prazo";
      default: return type;
    }
  };

  const getDocTypeName = (type: string) => {
    switch (type) {
      case "NOTA_FISCAL": return "Nota Fiscal";
      case "CUPOM": return "Cupom";
      case "SEM_DOCUMENTO": return "Sem Documento";
      default: return type;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    // Usar a API de impressão para gerar PDF
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
              Fechamento
            </h1>
            <p className="text-muted-foreground mt-1">
              Relatório consolidado de resultados
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'monthly' | 'yearly')}>
              <TabsList>
                <TabsTrigger value="monthly" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Mensal
                </TabsTrigger>
                <TabsTrigger value="yearly" className="flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" />
                  Anual
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {viewMode === 'monthly' && (
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
            )}
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
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Visão Mensal */}
        {viewMode === 'monthly' && (
          <>
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
              <p className="text-sm text-muted-foreground">
                Período: {new Date(data.period.startDate).toLocaleDateString('pt-BR')} a {new Date(data.period.endDate).toLocaleDateString('pt-BR')}
              </p>
            </div>

            {/* Cards de Resultado */}
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
                  <p className="text-xs text-muted-foreground">
                    {data.sales.total.count} vendas no período
                  </p>
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
                  <p className="text-xs text-muted-foreground">
                    Margem: {data.results.grossMargin}%
                  </p>
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
                  <p className="text-xs text-muted-foreground">
                    {data.expenses.total.count} despesas no período
                  </p>
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
                  <p className="text-xs text-muted-foreground">
                    Margem: {data.results.netMargin}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detalhamento */}
            <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2">
              {/* Vendas por Tipo */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    Vendas por Tipo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(data.sales.byType).map(([type, values]) => (
                        <TableRow key={type}>
                          <TableCell className="font-medium">{getSaleTypeName(type)}</TableCell>
                          <TableCell className="text-right">{values.count}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(values.revenue)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {data.sales.total.revenue > 0 
                              ? ((values.revenue / data.sales.total.revenue) * 100).toFixed(1) 
                              : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{data.sales.total.count}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(data.sales.total.revenue)}
                        </TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Compras por Tipo de Documento */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Compras por Documento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Documento</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(data.purchases.byType).map(([type, values]) => (
                        <TableRow key={type}>
                          <TableCell className="font-medium">{getDocTypeName(type)}</TableCell>
                          <TableCell className="text-right">{values.count}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(values.amount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {data.purchases.total.amount > 0 
                              ? ((values.amount / data.purchases.total.amount) * 100).toFixed(1) 
                              : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{data.purchases.total.count}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(data.purchases.total.amount)}
                        </TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Despesas por Categoria */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    Despesas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.expenses.byCategory.map((cat) => (
                        <TableRow key={cat.categoryId}>
                          <TableCell className="font-medium">{cat.categoryName}</TableCell>
                          <TableCell className="text-right">{cat.count}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(cat.amount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {data.expenses.total.amount > 0 
                              ? ((cat.amount / data.expenses.total.amount) * 100).toFixed(1) 
                              : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{data.expenses.total.count}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(data.expenses.total.amount)}
                        </TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

            </div>

            {/* DRE Simplificado */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Demonstrativo de Resultado (DRE Simplificado)
                </CardTitle>
                <CardDescription>
                  {data.period.monthName} de {data.period.year}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Receita Bruta de Vendas</TableCell>
                      <TableCell className="text-right font-mono text-lg">
                        {formatCurrency(data.results.revenue)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground pl-6">
                        (-) Custo das Mercadorias Vendidas (CMV)
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        ({formatCurrency(data.results.cost)})
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableCell className="font-bold">(=) Lucro Bruto</TableCell>
                      <TableCell className="text-right font-mono font-bold text-lg">
                        {formatCurrency(data.results.grossProfit)}
                        <span className="text-sm text-muted-foreground ml-2">
                          ({data.results.grossMargin}%)
                        </span>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground pl-6">
                        (-) Despesas Operacionais
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        ({formatCurrency(data.results.operationalExpenses)})
                      </TableCell>
                    </TableRow>
                    <TableRow className={`${data.results.netResult >= 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                      <TableCell className="font-bold text-lg">(=) Resultado Líquido</TableCell>
                      <TableCell className={`text-right font-mono font-bold text-xl ${
                        data.results.netResult >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(data.results.netResult)}
                        <span className="text-sm text-muted-foreground ml-2">
                          ({data.results.netMargin}%)
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
            ) : null}
          </>
        )}

        {/* Visão Anual */}
        {viewMode === 'yearly' && (
          <>
            {yearlyLoading ? (
              <div className="flex items-center justify-center min-h-[60vh]">
                <LoadingSpinner size="lg" text="Carregando dados anuais..." />
              </div>
            ) : yearlyData ? (
              <div className="space-y-6">
                {/* Cabeçalho do Relatório Anual */}
                <div className="hidden print:block text-center mb-6">
                  <h1 className="text-2xl font-bold">Fechamento Anual</h1>
                  <p className="text-lg">{selectedYear}</p>
                </div>

                {/* Tabela Comparativa Mensal */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      Resultado Mensal Comparativo - {selectedYear}
                    </CardTitle>
                    <CardDescription>
                      Visão consolidada mês a mês
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background">Indicador</TableHead>
                          {MONTHS.map(month => (
                            <TableHead key={month.value} className="text-center min-w-[100px]">
                              {month.label.substring(0, 3)}
                            </TableHead>
                          ))}
                          <TableHead className="text-center font-bold bg-muted min-w-[120px]">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Faturamento */}
                        <TableRow>
                          <TableCell className="font-medium sticky left-0 bg-background">Faturamento</TableCell>
                          {yearlyData.months.map((m: any) => (
                            <TableCell key={m.month} className="text-right font-mono text-sm">
                              {m.revenue > 0 ? formatCurrency(m.revenue) : '-'}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono font-bold bg-muted">
                            {formatCurrency(yearlyData.totals.revenue)}
                          </TableCell>
                        </TableRow>
                        {/* CMV */}
                        <TableRow>
                          <TableCell className="font-medium sticky left-0 bg-background text-muted-foreground">(-) CMV</TableCell>
                          {yearlyData.months.map((m: any) => (
                            <TableCell key={m.month} className="text-right font-mono text-sm text-red-600">
                              {m.cost > 0 ? `(${formatCurrency(m.cost)})` : '-'}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono font-bold bg-muted text-red-600">
                            ({formatCurrency(yearlyData.totals.cost)})
                          </TableCell>
                        </TableRow>
                        {/* Lucro Bruto */}
                        <TableRow className="bg-muted/30">
                          <TableCell className="font-bold sticky left-0 bg-muted/30">Lucro Bruto</TableCell>
                          {yearlyData.months.map((m: any) => (
                            <TableCell key={m.month} className="text-right font-mono text-sm font-medium">
                              {m.grossProfit !== 0 ? formatCurrency(m.grossProfit) : '-'}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono font-bold bg-muted">
                            {formatCurrency(yearlyData.totals.grossProfit)}
                          </TableCell>
                        </TableRow>
                        {/* Margem Bruta % */}
                        <TableRow>
                          <TableCell className="font-medium sticky left-0 bg-background text-muted-foreground">Margem Bruta %</TableCell>
                          {yearlyData.months.map((m: any) => (
                            <TableCell key={m.month} className="text-right font-mono text-sm text-muted-foreground">
                              {m.revenue > 0 ? `${m.grossMargin.toFixed(1)}%` : '-'}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono font-bold bg-muted">
                            {yearlyData.totals.grossMargin.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                        {/* Despesas */}
                        <TableRow>
                          <TableCell className="font-medium sticky left-0 bg-background text-muted-foreground">(-) Despesas</TableCell>
                          {yearlyData.months.map((m: any) => (
                            <TableCell key={m.month} className="text-right font-mono text-sm text-red-600">
                              {m.operationalExpenses > 0 ? `(${formatCurrency(m.operationalExpenses)})` : '-'}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono font-bold bg-muted text-red-600">
                            ({formatCurrency(yearlyData.totals.operationalExpenses)})
                          </TableCell>
                        </TableRow>
                        {/* Resultado Líquido */}
                        <TableRow className="bg-green-50 dark:bg-green-950/20">
                          <TableCell className="font-bold sticky left-0 bg-green-50 dark:bg-green-950/20">Resultado Líquido</TableCell>
                          {yearlyData.months.map((m: any) => (
                            <TableCell key={m.month} className={`text-right font-mono text-sm font-medium ${
                              m.netResult >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {m.revenue > 0 ? formatCurrency(m.netResult) : '-'}
                            </TableCell>
                          ))}
                          <TableCell className={`text-right font-mono font-bold bg-muted ${
                            yearlyData.totals.netResult >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(yearlyData.totals.netResult)}
                          </TableCell>
                        </TableRow>
                        {/* Margem Líquida % */}
                        <TableRow>
                          <TableCell className="font-medium sticky left-0 bg-background text-muted-foreground">Margem Líquida %</TableCell>
                          {yearlyData.months.map((m: any) => (
                            <TableCell key={m.month} className={`text-right font-mono text-sm ${
                              m.netMargin >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {m.revenue > 0 ? `${m.netMargin.toFixed(1)}%` : '-'}
                            </TableCell>
                          ))}
                          <TableCell className={`text-right font-mono font-bold bg-muted ${
                            yearlyData.totals.netMargin >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {yearlyData.totals.netMargin.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Cards de Totais Anuais */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card className="border-t-4 border-t-blue-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(yearlyData.totals.revenue)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-t-4 border-t-amber-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Lucro Bruto Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-600">
                        {formatCurrency(yearlyData.totals.grossProfit)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Margem: {yearlyData.totals.grossMargin.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-t-4 border-t-red-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Despesas Totais</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(yearlyData.totals.operationalExpenses)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={`border-t-4 ${yearlyData.totals.netResult >= 0 ? 'border-t-green-500' : 'border-t-red-500'}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Resultado Líquido Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${yearlyData.totals.netResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(yearlyData.totals.netResult)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Margem: {yearlyData.totals.netMargin.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Estilos de impressão */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 1cm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
