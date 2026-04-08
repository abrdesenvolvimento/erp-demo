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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Printer,
  Package,
  ArrowUp,
  ArrowDown,
  Minus,
  PlusCircle,
  BarChart3,
  PieChart,
  Activity,
} from "lucide-react";
import { useState, useMemo } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useCompany } from "@/contexts/CompanyContext";

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const MONTH_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const currentYear = new Date().getFullYear();

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCurrencyFull = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
};

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR").format(value);
};

// Componente para comparação ano anterior
function YearComparison({ current, previous, invertColors = false }: {
  current: number;
  previous: number | null | undefined;
  invertColors?: boolean;
}) {
  if (previous === null || previous === undefined || previous === 0) return null;
  const diff = current - previous;
  const diffPercent = (diff / Math.abs(previous)) * 100;
  const isPositive = diff > 0;
  const isNeutral = Math.abs(diffPercent) < 0.1;

  if (isNeutral) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>vs ano anterior</span>
      </div>
    );
  }

  const isGood = invertColors ? !isPositive : isPositive;

  return (
    <div className={`flex items-center gap-1 text-xs ${isGood ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      <span>{formatPercent(Math.abs(diffPercent))} vs ano anterior</span>
    </div>
  );
}

// Linha do DRE
interface DreRow {
  label: string;
  values: (number | null)[];
  total: number | null;
  av?: number | null; // Análise Vertical %
  isHeader?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  isSeparator?: boolean;
  indent?: number;
  bold?: boolean;
  className?: string;
}

export default function FechamentoAnual() {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState("dre");
  const { activeCompany } = useCompany();

  const { data, isLoading, error } = trpc.closing.yearly.useQuery({
    year: selectedYear,
  });

  // Construir linhas do DRE a partir dos dados
  const dreRows = useMemo<DreRow[]>(() => {
    if (!data?.months) return [];

    const months = data.months;
    const t = data.totals;
    const rl = t.receitaLiquida || 1; // evitar divisão por zero

    const row = (
      label: string,
      field: string,
      opts: Partial<DreRow> = {}
    ): DreRow => {
      const values = months.map((m: any) => m[field] ?? null);
      const total = (t as any)[field] ?? values.reduce((s: number, v: number | null) => s + (v || 0), 0);
      return {
        label,
        values,
        total,
        av: rl > 0 ? Math.round((total / rl) * 1000) / 10 : null,
        ...opts,
      };
    };

    const separator = (): DreRow => ({
      label: "",
      values: Array(12).fill(null),
      total: null,
      isSeparator: true,
    });

    // Canais de venda dinâmicos: só mostrar se houver valor > 0 no total anual
    const channelRows: DreRow[] = [];
    const channelDefs = [
      { label: "Balcão", field: "receitaBalcao", totalField: "receitaBalcao" },
      { label: "Delivery", field: "receitaDelivery", totalField: "receitaDelivery" },
      { label: "A Prazo", field: "receitaAPrazo", totalField: "receitaAPrazo" },
      { label: "Salão", field: "receitaSalao", totalField: "receitaSalao" },
    ];
    for (const ch of channelDefs) {
      const totalVal = (t as any)[ch.totalField] || 0;
      if (totalVal > 0) {
        channelRows.push(row(ch.label, ch.field, { indent: 1 }));
      }
    }

    // Despesas itemizadas por conta gerencial (mês a mês)
    // Separar despesas operacionais das pré-operacionais
    const despesaGroupRows: DreRow[] = [];
    const preOperacionalRows: DreRow[] = [];
    const classificationOrder = ['OPERACIONAL', 'ADMINISTRATIVA', 'FINANCEIRA', 'NAO_OPERACIONAL', 'COMERCIAL', 'PATRIMONIAL'];
    const classLabels: Record<string, string> = {
      OPERACIONAL: 'Operacionais',
      COMERCIAL: 'Comerciais',
      ADMINISTRATIVA: 'Administrativas',
      FINANCEIRA: 'Financeiras',
      NAO_OPERACIONAL: 'Outras Despesas',
      PATRIMONIAL: 'Patrimoniais',
    };

    // Calcular total de despesas pré-operacionais por mês
    const preOpMonthTotals = months.map((m: any) => {
      if (!m.despByAccount) return 0;
      return m.despByAccount
        .filter((a: any) => a.isInvestimentoOperacional)
        .reduce((sum: number, a: any) => sum + a.total, 0);
    });
    const preOpTotal = preOpMonthTotals.reduce((s: number, v: number) => s + v, 0);

    // Calcular total de despesas SEM pré-operacional por mês
    const despSemPreOpMonthTotals = months.map((m: any, i: number) => (m.despTotal || 0) - preOpMonthTotals[i]);
    const despSemPreOpTotal = despSemPreOpMonthTotals.reduce((s: number, v: number) => s + v, 0);

    const rb = t.receitaBruta || 1; // base para % sobre faturamento

    if (data.despByAccountAnnual && data.despByAccountAnnual.length > 0) {
      // Filtrar contas NÃO pré-operacionais
      const regularAccounts = data.despByAccountAnnual.filter((a: any) => !a.isInvestimentoOperacional);
      const preOpAccounts = data.despByAccountAnnual.filter((a: any) => a.isInvestimentoOperacional);

      for (const cls of classificationOrder) {
        const accounts = regularAccounts.filter((a: any) => a.classification === cls);
        if (accounts.length === 0) continue;
        // Sub-header da classificação
        despesaGroupRows.push({
          label: classLabels[cls] || cls,
          values: Array(12).fill(null),
          total: null,
          isHeader: false,
          indent: 1,
          bold: true,
          className: "text-muted-foreground text-xs uppercase",
        });
        // Cada conta gerencial
        for (const acc of accounts) {
          const accountName = acc.name;
          const monthValues = months.map((m: any) => {
            if (!m.despByAccount) return 0;
            const found = m.despByAccount.find((a: any) => a.name === accountName && !a.isInvestimentoOperacional);
            return found ? found.total : 0;
          });
          const totalVal = monthValues.reduce((s: number, v: number) => s + v, 0);
          despesaGroupRows.push({
            label: accountName,
            values: monthValues,
            total: totalVal,
            av: rb > 0 ? Math.round((totalVal / rb) * 1000) / 10 : null,
            indent: 2,
          });
        }
        // Subtotal do grupo
        const groupMonthTotals = months.map((_: any, mi: number) => {
          return accounts.reduce((sum: number, acc: any) => {
            const mv = months[mi];
            if (!mv.despByAccount) return sum;
            const found = mv.despByAccount.find((a: any) => a.name === acc.name && !a.isInvestimentoOperacional);
            return sum + (found ? found.total : 0);
          }, 0);
        });
        const groupTotal = groupMonthTotals.reduce((s: number, v: number) => s + v, 0);
        despesaGroupRows.push({
          label: `Total ${classLabels[cls] || cls}`,
          values: groupMonthTotals,
          total: groupTotal,
          isSubtotal: true,
          bold: true,
          indent: 1,
        });
        despesaGroupRows.push(separator());
      }

      // Pré-operacionais separadas
      if (preOpAccounts.length > 0) {
        for (const acc of preOpAccounts) {
          const accountName = acc.name;
          const monthValues = months.map((m: any) => {
            if (!m.despByAccount) return 0;
            const found = m.despByAccount.find((a: any) => a.name === accountName && a.isInvestimentoOperacional);
            return found ? found.total : 0;
          });
          const totalVal = monthValues.reduce((s: number, v: number) => s + v, 0);
          preOperacionalRows.push({
            label: accountName,
            values: monthValues,
            total: totalVal,
            av: rb > 0 ? Math.round((totalVal / rb) * 1000) / 10 : null,
            indent: 1,
            className: "text-orange-600",
          });
        }
      }
    } else {
      despesaGroupRows.push(row("Operacionais", "despOperacionais", { indent: 1 }));
      despesaGroupRows.push(row("Administrativas", "despAdministrativas", { indent: 1 }));
      despesaGroupRows.push(row("Financeiras", "despFinanceiras", { indent: 1 }));
      despesaGroupRows.push(row("Outras Despesas", "despOutras", { indent: 1 }));
    }

    // Outras Receitas itemizadas
    const outrasReceitasRows: DreRow[] = [];
    if (data.outrasReceitasByType) {
      for (const item of data.outrasReceitasByType) {
        const monthValues = months.map((m: any) => {
          if (!m.outrasReceitasByAccount) return 0;
          const found = m.outrasReceitasByAccount.find((a: any) => a.name === item.name);
          return found ? found.total : 0;
        });
        const totalVal = monthValues.reduce((s: number, v: number) => s + v, 0);
        if (totalVal > 0) {
          outrasReceitasRows.push({
            label: item.name,
            values: monthValues,
            total: totalVal,
            indent: 1,
            className: "text-emerald-600",
          });
        }
      }
    }
    if (outrasReceitasRows.length === 0) {
      outrasReceitasRows.push(row("Outras Receitas", "outrasReceitas", { indent: 1, className: "text-emerald-600" }));
    }

    // Cálculos para Resumo Final
    const receitaLiquidaCalc = months.map((m: any) => (m.receitaBruta || 0) - (m.cmv || 0));
    const receitaLiquidaTotal = receitaLiquidaCalc.reduce((s: number, v: number) => s + v, 0);

    // Resultado SEM pré-operacional (operacional puro)
    const resultadoSemPreOp = months.map((m: any, i: number) => receitaLiquidaCalc[i] - despSemPreOpMonthTotals[i]);
    const resultadoSemPreOpTotal = resultadoSemPreOp.reduce((s: number, v: number) => s + v, 0);

    // Resultado COM pré-operacional + outras receitas
    const resultadoComPreOp = months.map((m: any, i: number) => 
      receitaLiquidaCalc[i] - despSemPreOpMonthTotals[i] - preOpMonthTotals[i] + (m.outrasReceitas || 0)
    );
    const resultadoComPreOpTotal = resultadoComPreOp.reduce((s: number, v: number) => s + v, 0);

    const rows: DreRow[] = [
      // SEÇÃO 1: RECEITA DE VENDAS
      { label: "Receita de Vendas", values: Array(12).fill(null), total: null, isHeader: true },
      ...channelRows,
      row("Total Receita", "receitaBruta", { isSubtotal: true, bold: true }),

      separator(),

      // SEÇÃO 2: DESPESAS (sem pré-operacional)
      { label: "Despesas", values: Array(12).fill(null), total: null, isHeader: true },
      ...despesaGroupRows,
      {
        label: "TOTAL DESPESAS",
        values: despSemPreOpMonthTotals,
        total: despSemPreOpTotal,
        av: rb > 0 ? Math.round((despSemPreOpTotal / rb) * 1000) / 10 : null,
        isSubtotal: true,
        bold: true,
      },

      separator(),
      separator(),

      // SEÇÃO 3: RESUMO FINAL
      row("Total Receita", "receitaBruta", { bold: true }),
      row("CMV", "cmv"),
      {
        label: "% Margem",
        values: months.map((m: any) => m.margemBruta ?? null),
        total: t.margemBruta ?? null,
        className: "text-muted-foreground italic",
      },
      {
        label: "Receita Líquida",
        values: receitaLiquidaCalc,
        total: receitaLiquidaTotal,
        bold: true,
        isSubtotal: true,
      },
      {
        label: "Despesa",
        values: despSemPreOpMonthTotals,
        total: despSemPreOpTotal,
      },
    ];

    // RESULTADO SEM INVESTIMENTOS OPERACIONAIS
    rows.push({
      label: "Resultado",
      values: resultadoSemPreOp,
      total: resultadoSemPreOpTotal,
      bold: true,
      isTotal: true,
      className: resultadoSemPreOpTotal >= 0 ? 'text-green-600' : 'text-red-600',
    });
    rows.push({
      label: "% Resultado",
      values: months.map((m: any, i: number) => {
        const rec = m.receitaBruta || 0;
        return rec > 0 ? (resultadoSemPreOp[i] / rec) * 100 : null;
      }),
      total: t.receitaBruta > 0 ? (resultadoSemPreOpTotal / t.receitaBruta) * 100 : null,
      className: resultadoSemPreOpTotal >= 0 ? 'text-green-600 italic' : 'text-red-600 italic',
    });

    // Se houver investimentos operacionais ou outras receitas, mostrar segundo resultado
    if (preOpTotal > 0 || (t.outrasReceitas || 0) > 0) {
      rows.push(separator());
      rows.push(separator());

      // SEÇÃO: INVESTIMENTOS OPERACIONAIS + OUTRAS RECEITAS
      if (preOperacionalRows.length > 0) {
        rows.push({ label: "Investimentos Operacionais", values: Array(12).fill(null), total: null, isHeader: true });
        rows.push(...preOperacionalRows);
        rows.push({
          label: "Total Investimentos Operacionais",
          values: preOpMonthTotals,
          total: preOpTotal,
          av: rb > 0 ? Math.round((preOpTotal / rb) * 1000) / 10 : null,
          isSubtotal: true,
          bold: true,
          className: "text-orange-600",
        });
        rows.push(separator());
      }

      // OUTRAS RECEITAS
      rows.push({ label: "Outras Receitas", values: Array(12).fill(null), total: null, isHeader: true });
      rows.push(...outrasReceitasRows);
      rows.push({
        label: "Total Outras Receitas",
        values: months.map((m: any) => m.outrasReceitas || 0),
        total: t.outrasReceitas || 0,
        isSubtotal: true,
        bold: true,
        className: "text-emerald-600",
      });

      rows.push(separator());

      // RESULTADO COM PRÉ-OPERACIONAL + OUTRAS RECEITAS
      rows.push({
        label: "Resultado c/ Investimentos",
        values: resultadoComPreOp,
        total: resultadoComPreOpTotal,
        bold: true,
        isTotal: true,
        className: resultadoComPreOpTotal >= 0 ? 'text-green-600' : 'text-red-600',
      });
      rows.push({
        label: "% Resultado c/ Investimentos",
        values: months.map((m: any, i: number) => {
          const rec = m.receitaBruta || 0;
          return rec > 0 ? (resultadoComPreOp[i] / rec) * 100 : null;
        }),
        total: t.receitaBruta > 0 ? (resultadoComPreOpTotal / t.receitaBruta) * 100 : null,
        className: resultadoComPreOpTotal >= 0 ? 'text-green-600 italic' : 'text-red-600 italic',
      });
    }

    return rows;
  }, [data]);

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
              <CalendarDays className="h-6 w-6 text-primary" />
              Fechamento Anual
            </h1>
            <p className="text-muted-foreground mt-1">
              Visão Mês a Mês
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => (
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

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" text="Carregando dados do fechamento anual..." />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive">Erro ao carregar dados: {error.message}</p>
            </CardContent>
          </Card>
        ) : data ? (
          <div className="space-y-6 print:space-y-4">
            {/* Cabeçalho do Relatório (visível na impressão) */}
            <div className="hidden print:block mb-6">
              <div className="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-4">
                <div className="flex items-center gap-4">
                  {activeCompany?.companyLogoUrl && (
                    <img
                      src={activeCompany.companyLogoUrl}
                      alt={activeCompany.companyName || 'Logo'}
                      className="h-16 w-auto object-contain"
                    />
                  )}
                  <div className="text-left">
                    <h1 className="text-2xl font-bold">{activeCompany?.companyName || 'Empresa'}</h1>
                    {activeCompany?.companyDocNumber && (
                      <p className="text-xs text-gray-600">CNPJ: {activeCompany.companyDocNumber}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold">Fechamento Anual — DRE</h2>
                  <p className="text-lg font-semibold">{selectedYear}</p>
                  <p className="text-xs text-gray-500 mt-1">Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            </div>

            {/* 1. CARDS DE RESUMO ANUAL */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 print:grid-cols-5">
              <Card className="border-t-4 border-t-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-500" />
                    Receita Bruta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrencyFull(data.totals.receitaBruta)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatNumber(data.totals.salesCount)} vendas no ano
                  </p>
                  <YearComparison
                    current={data.totals.receitaBruta}
                    previous={data.previousYear?.receitaBruta}
                  />
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
                    {formatCurrencyFull(data.totals.lucroBruto)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Margem: {formatPercent(data.totals.margemBruta)}
                  </p>
                  <YearComparison
                    current={data.totals.lucroBruto}
                    previous={data.previousYear?.lucroBruto}
                  />
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-red-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-red-500" />
                    Despesas Operacionais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Calcular despesas sem pré-operacional
                    const preOpTotalCard = data.despByAccountAnnual
                      ?.filter((a: any) => a.isInvestimentoOperacional)
                      .reduce((s: number, a: any) => s + a.total, 0) || 0;
                    const despSemPreOp = data.totals.despTotal - preOpTotalCard;
                    return (
                      <>
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrencyFull(despSemPreOp)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {data.totals.receitaBruta > 0
                            ? formatPercent((despSemPreOp / data.totals.receitaBruta) * 100)
                            : "—"} do faturamento
                        </p>
                        <YearComparison
                          current={despSemPreOp}
                          previous={data.previousYear?.despTotal}
                          invertColors
                        />
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-emerald-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <PlusCircle className="h-4 w-4 text-emerald-500" />
                    Outras Receitas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">
                    {formatCurrencyFull(data.totals.outrasReceitas)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Receitas não operacionais
                  </p>
                  <YearComparison
                    current={data.totals.outrasReceitas}
                    previous={data.previousYear?.outrasReceitas}
                  />
                </CardContent>
              </Card>

              {(() => {
                // Calcular resultado operacional (sem pré-op)
                const preOpTotalCard = data.despByAccountAnnual
                  ?.filter((a: any) => a.isInvestimentoOperacional)
                  .reduce((s: number, a: any) => s + a.total, 0) || 0;
                const despSemPreOp = data.totals.despTotal - preOpTotalCard;
                const recLiquida = data.totals.receitaBruta - data.totals.cmv;
                const resultadoOp = recLiquida - despSemPreOp;
                const margemOp = data.totals.receitaBruta > 0 ? (resultadoOp / data.totals.receitaBruta) * 100 : 0;
                return (
                  <Card className={`border-t-4 ${resultadoOp >= 0 ? 'border-t-green-500' : 'border-t-red-500'}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {resultadoOp >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        Resultado Operacional
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${resultadoOp >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrencyFull(resultadoOp)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Margem: {formatPercent(margemOp)}
                      </p>
                      <YearComparison
                        current={resultadoOp}
                        previous={data.previousYear?.resultadoLiquido}
                      />
                    </CardContent>
                  </Card>
                );
              })()}
            </div>

            {/* 2. ABAS */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="print:hidden">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="dre" className="flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Visão Mês a Mês</span>
                  <span className="sm:hidden">Mensal</span>
                </TabsTrigger>
                <TabsTrigger value="charts" className="flex items-center gap-1.5">
                  <PieChart className="h-4 w-4" />
                  <span className="hidden sm:inline">Gráficos</span>
                  <span className="sm:hidden">Gráf.</span>
                </TabsTrigger>
                <TabsTrigger value="stock" className="flex items-center gap-1.5">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Estoque Mensal</span>
                  <span className="sm:hidden">Estoque</span>
                </TabsTrigger>
                <TabsTrigger value="indicators" className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">Indicadores</span>
                  <span className="sm:hidden">KPIs</span>
                </TabsTrigger>
              </TabsList>

              {/* ABA 1: VISÃO MÊS A MÊS */}
              <TabsContent value="dre" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Fechamento Anual — {selectedYear}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[200px] font-bold">
                              Conta
                            </TableHead>
                            {MONTH_NAMES.map((m) => (
                              <TableHead key={m} className="text-right min-w-[90px] font-bold">
                                {m}
                              </TableHead>
                            ))}
                            <TableHead className="text-right min-w-[110px] font-bold bg-muted">
                              Total
                            </TableHead>
                            <TableHead className="text-right min-w-[70px] font-bold bg-muted">
                              %
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dreRows.map((row, idx) => {
                            if (row.isSeparator) {
                              return (
                                <TableRow key={idx} className="h-2 border-0">
                                  <TableCell colSpan={15} className="p-0" />
                                </TableRow>
                              );
                            }

                            if (row.isHeader) {
                              return (
                                <TableRow key={idx} className="bg-muted/30 border-t-2">
                                  <TableCell
                                    colSpan={15}
                                    className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-2"
                                  >
                                    {row.label}
                                  </TableCell>
                                </TableRow>
                              );
                            }

                            const isPercRow = row.label.includes("%");

                            return (
                              <TableRow
                                key={idx}
                                className={`
                                  ${row.isTotal ? 'bg-primary/5 border-t-2 border-b-2 border-primary/20' : ''}
                                  ${row.isSubtotal ? 'bg-muted/20 border-t' : ''}
                                  hover:bg-muted/10
                                `}
                              >
                                <TableCell
                                  className={`sticky left-0 bg-background z-10 ${row.bold ? 'font-bold' : ''} ${row.className || ''}`}
                                  style={{ paddingLeft: row.indent ? `${row.indent * 1.5 + 0.5}rem` : undefined }}
                                >
                                  {row.label}
                                </TableCell>
                                {row.values.map((val, i) => (
                                  <TableCell
                                    key={i}
                                    className={`text-right tabular-nums ${row.bold ? 'font-bold' : ''} ${row.className || ''}`}
                                  >
                                    {isPercRow
                                      ? formatPercent(val)
                                      : val !== null && val !== undefined
                                        ? formatCurrency(val)
                                        : "—"
                                    }
                                  </TableCell>
                                ))}
                                <TableCell
                                  className={`text-right tabular-nums bg-muted/30 ${row.bold ? 'font-bold' : ''} ${row.className || ''} ${row.isTotal ? 'text-lg' : ''}`}
                                >
                                  {isPercRow
                                    ? formatPercent(row.total)
                                    : row.total !== null && row.total !== undefined
                                      ? formatCurrency(row.total)
                                      : "—"
                                  }
                                </TableCell>
                                <TableCell
                                  className={`text-right tabular-nums bg-muted/30 text-muted-foreground ${row.bold ? 'font-semibold' : ''}`}
                                >
                                  {row.av !== null && row.av !== undefined ? formatPercent(row.av) : ""}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>


              </TabsContent>

              {/* ABA 2: GRÁFICOS */}
              <TabsContent value="charts" className="mt-4">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Gráfico Receita vs Despesa vs Resultado */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-lg">Receita vs Despesa vs Resultado — Mensal</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {data.months.map((m: any, idx: number) => {
                          const maxVal = Math.max(
                            ...data.months.map((mm: any) => Math.max(mm.receitaBruta, mm.despTotal + mm.cmv, Math.abs(mm.resultadoLiquido)))
                          );
                          const receitaW = maxVal > 0 ? (m.receitaBruta / maxVal) * 100 : 0;
                          const despesaW = maxVal > 0 ? ((m.despTotal + m.cmv) / maxVal) * 100 : 0;
                          const resultW = maxVal > 0 ? (Math.abs(m.resultadoLiquido) / maxVal) * 100 : 0;

                          return (
                            <div key={idx} className="grid grid-cols-[60px_1fr] gap-2 items-center">
                              <span className="text-sm font-medium text-right">{MONTH_NAMES[idx]}</span>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="h-4 bg-blue-500 rounded-sm transition-all"
                                    style={{ width: `${receitaW}%`, minWidth: receitaW > 0 ? '4px' : '0' }}
                                  />
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatCurrency(m.receitaBruta)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="h-4 bg-red-400 rounded-sm transition-all"
                                    style={{ width: `${despesaW}%`, minWidth: despesaW > 0 ? '4px' : '0' }}
                                  />
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatCurrency(m.despTotal + m.cmv)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`h-4 rounded-sm transition-all ${m.resultadoLiquido >= 0 ? 'bg-green-500' : 'bg-orange-500'}`}
                                    style={{ width: `${resultW}%`, minWidth: resultW > 0 ? '4px' : '0' }}
                                  />
                                  <span className={`text-xs whitespace-nowrap ${m.resultadoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(m.resultadoLiquido)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex items-center gap-4 mt-4 pt-3 border-t">
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-blue-500 rounded-sm" />
                            <span className="text-xs">Receita</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-red-400 rounded-sm" />
                            <span className="text-xs">Custos + Despesas</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-green-500 rounded-sm" />
                            <span className="text-xs">Resultado</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Evolução da Margem Líquida */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Evolução da Margem Líquida</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {data.months.map((m: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="text-sm font-medium w-10 text-right">{MONTH_NAMES[idx]}</span>
                            <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all flex items-center justify-end pr-2 ${
                                  m.margemLiquida >= 0 ? 'bg-green-500' : 'bg-red-400'
                                }`}
                                style={{
                                  width: `${Math.min(Math.abs(m.margemLiquida || 0), 100)}%`,
                                  minWidth: m.margemLiquida ? '30px' : '0',
                                }}
                              >
                                <span className="text-xs font-bold text-white">
                                  {formatPercent(m.margemLiquida)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Composição das Despesas */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Composição das Despesas — Anual</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { label: "CMV", value: data.totals.cmv, color: "bg-red-500" },
                          { label: "Operacionais", value: data.totals.despOperacionais, color: "bg-orange-500" },
                          { label: "Administrativas", value: data.totals.despAdministrativas, color: "bg-blue-500" },
                          { label: "Financeiras", value: data.totals.despFinanceiras, color: "bg-purple-500" },
                          { label: "Outras", value: data.totals.despOutras, color: "bg-gray-500" },
                        ].filter(item => item.value > 0).map((item, idx) => {
                          const totalCosts = data.totals.cmv + data.totals.despTotal;
                          const pct = totalCosts > 0 ? (item.value / totalCosts) * 100 : 0;
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{item.label}</span>
                                <span className="font-medium">{formatCurrencyFull(item.value)} ({formatPercent(pct)})</span>
                              </div>
                              <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${item.color} rounded-full transition-all`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ABA 3: ESTOQUE MENSAL */}
              <TabsContent value="stock" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      Evolução do Estoque — {selectedYear}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="font-bold min-w-[140px]">Mês</TableHead>
                            <TableHead className="text-right font-bold">Estoque Inicial</TableHead>
                            <TableHead className="text-right font-bold">Compras</TableHead>
                            <TableHead className="text-right font-bold">CMV</TableHead>
                            <TableHead className="text-right font-bold">Estoque Final</TableHead>
                            <TableHead className="text-right font-bold">Variação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.stockEvolution.map((s: any, idx: number) => (
                            <TableRow key={idx} className={!s.hasData ? 'opacity-40' : ''}>
                              <TableCell className="font-medium">{MONTH_FULL[idx]}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {s.openingStock !== null ? formatCurrencyFull(s.openingStock) : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-blue-600">
                                {formatCurrencyFull(s.purchases)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-red-600">
                                {formatCurrencyFull(s.cmv)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {s.closingStock !== null ? formatCurrencyFull(s.closingStock) : "—"}
                              </TableCell>
                              <TableCell className={`text-right tabular-nums font-medium ${
                                s.variation === null ? '' : s.variation >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {s.variation !== null ? (
                                  <span className="flex items-center justify-end gap-1">
                                    {s.variation >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                    {formatCurrencyFull(Math.abs(s.variation))}
                                  </span>
                                ) : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      Os snapshots de estoque são capturados automaticamente no 1o dia (abertura) e último dia (fechamento) de cada mês.
                      Meses sem dados indicam que o sistema de snapshots ainda não estava ativo naquele período.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ABA 4: INDICADORES */}
              <TabsContent value="indicators" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {/* Ticket Médio */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {data.totals.salesCount > 0
                          ? formatCurrencyFull(data.totals.receitaBruta / data.totals.salesCount)
                          : "—"}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatNumber(data.totals.salesCount)} vendas no ano
                      </p>
                    </CardContent>
                  </Card>

                  {/* CMV % */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">CMV sobre Receita</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-600">
                        {data.totals.receitaLiquida > 0
                          ? formatPercent((data.totals.cmv / data.totals.receitaLiquida) * 100)
                          : "—"}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        CMV Total: {formatCurrencyFull(data.totals.cmv)}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Margem Bruta */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Margem Bruta</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-amber-600">
                        {formatPercent(data.totals.margemBruta)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Lucro Bruto: {formatCurrencyFull(data.totals.lucroBruto)}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Margem Líquida */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Margem Líquida</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-3xl font-bold ${data.totals.margemLiquida >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(data.totals.margemLiquida)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Resultado: {formatCurrencyFull(data.totals.resultadoLiquido)}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Despesas / Receita */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Despesas / Receita</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-orange-600">
                        {data.totals.receitaLiquida > 0
                          ? formatPercent((data.totals.despTotal / data.totals.receitaLiquida) * 100)
                          : "—"}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Despesas: {formatCurrencyFull(data.totals.despTotal)}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Compras / Receita */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Compras / Receita</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-600">
                        {data.totals.receitaLiquida > 0
                          ? formatPercent((data.totals.purchasesTotal / data.totals.receitaLiquida) * 100)
                          : "—"}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Compras: {formatCurrencyFull(data.totals.purchasesTotal)}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Média Mensal de Faturamento */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Médio Mensal</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-600">
                        {formatCurrencyFull(data.totals.receitaBruta / 12)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Total: {formatCurrencyFull(data.totals.receitaBruta)}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Média Mensal de Resultado */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Resultado Médio Mensal</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-3xl font-bold ${data.totals.resultadoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrencyFull(data.totals.resultadoLiquido / 12)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Total: {formatCurrencyFull(data.totals.resultadoLiquido)}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Fluxo de Caixa */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Fluxo de Caixa Anual</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-3xl font-bold ${data.totals.cashBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrencyFull(data.totals.cashBalance)}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>Recebido: {formatCurrency(data.totals.cashReceived)}</span>
                        <span>Pago: {formatCurrency(data.totals.cashPaid)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabela de Evolução Mensal dos KPIs */}
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Evolução Mensal dos Indicadores</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[160px] font-bold">Indicador</TableHead>
                            {MONTH_NAMES.map((m) => (
                              <TableHead key={m} className="text-right min-w-[80px] font-bold">{m}</TableHead>
                            ))}
                            <TableHead className="text-right min-w-[100px] font-bold bg-muted">Média</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="sticky left-0 bg-background z-10 font-medium">Ticket Médio</TableCell>
                            {data.months.map((m: any, i: number) => (
                              <TableCell key={i} className="text-right tabular-nums">
                                {m.salesCount > 0 ? formatCurrency(m.receitaBruta / m.salesCount) : "—"}
                              </TableCell>
                            ))}
                            <TableCell className="text-right tabular-nums bg-muted/30 font-bold">
                              {data.totals.salesCount > 0 ? formatCurrency(data.totals.receitaBruta / data.totals.salesCount) : "—"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="sticky left-0 bg-background z-10 font-medium">Margem Bruta %</TableCell>
                            {data.months.map((m: any, i: number) => (
                              <TableCell key={i} className="text-right tabular-nums">
                                {formatPercent(m.margemBruta)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right tabular-nums bg-muted/30 font-bold">
                              {formatPercent(data.totals.margemBruta)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="sticky left-0 bg-background z-10 font-medium">Margem Líquida %</TableCell>
                            {data.months.map((m: any, i: number) => (
                              <TableCell key={i} className={`text-right tabular-nums ${m.margemLiquida >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatPercent(m.margemLiquida)}
                              </TableCell>
                            ))}
                            <TableCell className={`text-right tabular-nums bg-muted/30 font-bold ${data.totals.margemLiquida >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatPercent(data.totals.margemLiquida)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="sticky left-0 bg-background z-10 font-medium">Vendas (qtd)</TableCell>
                            {data.months.map((m: any, i: number) => (
                              <TableCell key={i} className="text-right tabular-nums">
                                {formatNumber(m.salesCount)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right tabular-nums bg-muted/30 font-bold">
                              {formatNumber(Math.round(data.totals.salesCount / 12))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Versão para impressão (sempre visível no print) */}
            <div className="hidden print:block">
              <h3 className="text-lg font-bold mb-2">Fechamento Anual — {selectedYear}</h3>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2">
                    <th className="text-left py-1 pr-2">Conta</th>
                    {MONTH_NAMES.map(m => (
                      <th key={m} className="text-right py-1 px-1">{m}</th>
                    ))}
                    <th className="text-right py-1 pl-2 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dreRows.filter(r => !r.isSeparator).map((row, idx) => (
                    <tr key={idx} className={`${row.isHeader ? 'border-t font-bold text-[10px] uppercase' : ''} ${row.isTotal ? 'border-t-2 border-b-2 font-bold' : ''} ${row.isSubtotal ? 'border-t font-semibold' : ''}`}>
                      <td className="py-0.5 pr-2" style={{ paddingLeft: row.indent ? `${row.indent}rem` : undefined }}>
                        {row.label}
                      </td>
                      {!row.isHeader && row.values.map((v, i) => (
                        <td key={i} className="text-right py-0.5 px-1 tabular-nums">
                          {row.label.includes('%') ? formatPercent(v) : v !== null ? formatCurrency(v) : ''}
                        </td>
                      ))}
                      {row.isHeader && <td colSpan={13} />}
                      {!row.isHeader && (
                        <td className="text-right py-0.5 pl-2 tabular-nums font-bold">
                          {row.label.includes('%') ? formatPercent(row.total) : row.total !== null ? formatCurrency(row.total) : ''}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
