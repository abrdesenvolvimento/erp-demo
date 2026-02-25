import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, BarChart3, TrendingUp, TrendingDown, Minus, X, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { getCurrentBrazilDateInfo } from "@shared/dateUtils";
import { getHolidaysForMonth, type Holiday } from "@shared/holidays";
import { useAuth } from "@/_core/hooks/useAuth";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DAYS_OF_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function AnaliseFaturamento() {
  const todayInfo = getCurrentBrazilDateInfo();
  const [selectedYear, setSelectedYear] = useState(todayInfo.year);
  const [selectedMonth, setSelectedMonth] = useState(todayInfo.month);
  const [viewMode, setViewMode] = useState<"monthly" | "daily">("monthly");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // State para popover de destaque manual
  const [highlightDay, setHighlightDay] = useState<number | null>(null);
  const [highlightLabel, setHighlightLabel] = useState("");

  // Query para calendário (visão diária)
  const { data: calendarData, isLoading: isLoadingCalendar } = trpc.sales.calendar.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  // Query para dados mensais do ano selecionado
  const { data: monthlyData, isLoading: isLoadingMonthly } = trpc.sales.monthlyStats.useQuery({
    year: selectedYear,
  });

  // Buscar destaques manuais do banco
  const { data: manualHighlights } = trpc.calendar.getHighlights.useQuery(
    { year: selectedYear, month: selectedMonth },
    { retry: false }
  );

  const utils = trpc.useUtils();

  const addHighlightMutation = trpc.calendar.addHighlight.useMutation({
    onSuccess: () => {
      utils.calendar.getHighlights.invalidate({ year: selectedYear, month: selectedMonth });
      setHighlightDay(null);
      setHighlightLabel("");
    },
  });

  const removeHighlightMutation = trpc.calendar.removeHighlight.useMutation({
    onSuccess: () => {
      utils.calendar.getHighlights.invalidate({ year: selectedYear, month: selectedMonth });
    },
  });

  // Feriados do mês
  const holidays = useMemo(() => {
    const list = getHolidaysForMonth(selectedYear, selectedMonth);
    const map = new Map<number, Holiday>();
    for (const h of list) {
      const day = parseInt(h.date.split("-")[2], 10);
      map.set(day, h);
    }
    return map;
  }, [selectedYear, selectedMonth]);

  // Destaques manuais por dia
  const manualByDay = useMemo(() => {
    const map = new Map<number, { id: number; label: string; color: string }>();
    if (manualHighlights) {
      for (const h of manualHighlights) {
        const day = parseInt(h.date.split("-")[2], 10);
        map.set(day, { id: h.id, label: h.label, color: h.color });
      }
    }
    return map;
  }, [manualHighlights]);

  const handleAddHighlight = (day: number) => {
    if (!highlightLabel.trim()) return;
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    addHighlightMutation.mutate({
      date: dateStr,
      label: highlightLabel.trim(),
      color: "amber",
    });
  };

  const handleRemoveHighlight = (id: number) => {
    removeHighlightMutation.mutate({ id });
  };

  // Calcular primeiro dia do mês e total de dias
  const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1).getDay();
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  // Criar array de dias para renderizar o grid
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Criar mapa de dados por dia
  const dataByDay = new Map(calendarData?.map(d => [d.day, d]) || []);

  // Calcular total do mês e dias corridos
  const monthTotal = calendarData?.reduce((sum, day) => sum + day.total, 0) || 0;
  
  // Calcular dias corridos para média diária (usando timezone de Brasília)
  const currentInfo = getCurrentBrazilDateInfo();
  
  const isCurrentMonth = selectedYear === currentInfo.year && selectedMonth === currentInfo.month;
  const isPastMonth = selectedYear < currentInfo.year || (selectedYear === currentInfo.year && selectedMonth < currentInfo.month);
  
  let daysElapsed = 0;
  if (isPastMonth) {
    daysElapsed = daysInMonth;
  } else if (isCurrentMonth) {
    daysElapsed = currentInfo.day;
  } else {
    daysElapsed = 0;
  }

  // Calcular totais anuais
  const yearTotals = useMemo(() => {
    if (!monthlyData) return { total: 0, balcao: 0, delivery: 0, aPrazo: 0 };
    return monthlyData.reduce((acc: { total: number; balcao: number; delivery: number; aPrazo: number }, m: { total: number; balcao: number; delivery: number; aPrazo: number }) => ({
      total: acc.total + m.total,
      balcao: acc.balcao + m.balcao,
      delivery: acc.delivery + m.delivery,
      aPrazo: acc.aPrazo + m.aPrazo,
    }), { total: 0, balcao: 0, delivery: 0, aPrazo: 0 });
  }, [monthlyData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handlePrevYear = () => {
    setSelectedYear(selectedYear - 1);
  };

  const handleNextYear = () => {
    setSelectedYear(selectedYear + 1);
  };

  const isTodayDay = (day: number | null) => {
    if (!day) return false;
    return (
      day === currentInfo.day &&
      selectedMonth === currentInfo.month &&
      selectedYear === currentInfo.year
    );
  };

  // Calcular variação percentual entre meses
  const getVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Ícone de tendência
  const TrendIcon = ({ variation }: { variation: number }) => {
    if (variation > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (variation < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Análise de Faturamento</h1>
            <p className="text-muted-foreground">Visualize o faturamento por mês ou por dia</p>
          </div>
        </div>

        {/* Tabs para alternar entre visões */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "monthly" | "daily")}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="monthly" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Visão Mensal
            </TabsTrigger>
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Visão Diária
            </TabsTrigger>
          </TabsList>

          {/* Visão Mensal */}
          <TabsContent value="monthly" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Faturamento por Mês
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrevYear}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-semibold min-w-[80px] text-center">
                      {selectedYear}
                    </span>
                    <Button variant="outline" size="sm" onClick={handleNextYear}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingMonthly ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando dados mensais...
                  </div>
                ) : (
                  <>
                    {/* Cards de resumo anual */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="pt-4">
                          <p className="text-sm text-muted-foreground">Total Anual</p>
                          <p className="text-2xl font-bold text-green-600">{formatCurrency(yearTotals.total)}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="pt-4">
                          <p className="text-sm text-muted-foreground">Balcão</p>
                          <p className="text-xl font-bold text-blue-600">{formatCurrency(yearTotals.balcao)}</p>
                          <p className="text-xs text-muted-foreground">
                            {yearTotals.total > 0 ? ((yearTotals.balcao / yearTotals.total) * 100).toFixed(1) : 0}%
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-purple-50 border-purple-200">
                        <CardContent className="pt-4">
                          <p className="text-sm text-muted-foreground">Delivery</p>
                          <p className="text-xl font-bold text-purple-600">{formatCurrency(yearTotals.delivery)}</p>
                          <p className="text-xs text-muted-foreground">
                            {yearTotals.total > 0 ? ((yearTotals.delivery / yearTotals.total) * 100).toFixed(1) : 0}%
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-orange-50 border-orange-200">
                        <CardContent className="pt-4">
                          <p className="text-sm text-muted-foreground">A Prazo</p>
                          <p className="text-xl font-bold text-orange-600">{formatCurrency(yearTotals.aPrazo)}</p>
                          <p className="text-xs text-muted-foreground">
                            {yearTotals.total > 0 ? ((yearTotals.aPrazo / yearTotals.total) * 100).toFixed(1) : 0}%
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Tabela de meses */}
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mês</TableHead>
                            <TableHead className="text-right">Balcão</TableHead>
                            <TableHead className="text-right">Delivery</TableHead>
                            <TableHead className="text-right">A Prazo</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Variação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {MONTHS.map((monthName, index) => {
                            const monthNum = index + 1;
                            const data = monthlyData?.find((m: { month: number; total: number; balcao: number; delivery: number; aPrazo: number }) => m.month === monthNum);
                            const prevData = monthlyData?.find((m: { month: number; total: number; balcao: number; delivery: number; aPrazo: number }) => m.month === monthNum - 1);
                            const variation = data && prevData ? getVariation(data.total, prevData.total) : 0;
                            const isCurrentMonthRow = selectedYear === currentInfo.year && monthNum === currentInfo.month;
                            const isFutureMonth = selectedYear > currentInfo.year || 
                              (selectedYear === currentInfo.year && monthNum > currentInfo.month);

                            return (
                              <TableRow 
                                key={monthNum}
                                className={`
                                  ${isCurrentMonthRow ? 'bg-blue-50' : ''}
                                  ${isFutureMonth ? 'opacity-50' : ''}
                                  cursor-pointer hover:bg-muted/50
                                `}
                                onClick={() => {
                                  setSelectedMonth(monthNum);
                                  setViewMode("daily");
                                }}
                              >
                                <TableCell className="font-medium">
                                  {monthName}
                                  {isCurrentMonthRow && (
                                    <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                                      Atual
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-blue-600">
                                  {data ? formatCurrency(data.balcao) : '-'}
                                </TableCell>
                                <TableCell className="text-right text-purple-600">
                                  {data ? formatCurrency(data.delivery) : '-'}
                                </TableCell>
                                <TableCell className="text-right text-orange-600">
                                  {data ? formatCurrency(data.aPrazo) : '-'}
                                </TableCell>
                                <TableCell className="text-right font-bold text-green-600">
                                  {data ? formatCurrency(data.total) : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {data && index > 0 && prevData ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <TrendIcon variation={variation} />
                                      <span className={`text-sm ${variation > 0 ? 'text-green-600' : variation < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                        {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                                      </span>
                                    </div>
                                  ) : (
                                    '-'
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                        <tfoot>
                          <tr className="bg-muted/50 font-bold border-t-2">
                            <td className="py-3 px-4">TOTAL ANUAL</td>
                            <td className="py-3 px-4 text-right text-blue-600">{formatCurrency(yearTotals.balcao)}</td>
                            <td className="py-3 px-4 text-right text-purple-600">{formatCurrency(yearTotals.delivery)}</td>
                            <td className="py-3 px-4 text-right text-orange-600">{formatCurrency(yearTotals.aPrazo)}</td>
                            <td className="py-3 px-4 text-right text-green-600">{formatCurrency(yearTotals.total)}</td>
                            <td className="py-3 px-4 text-right">-</td>
                          </tr>
                        </tfoot>
                      </Table>
                    </div>

                    <p className="text-sm text-muted-foreground mt-4">
                      💡 Clique em um mês para ver os detalhes diários
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Visão Diária (Calendário) */}
          <TabsContent value="daily" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Calendário de Vendas
                  </CardTitle>
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-lg font-semibold min-w-[200px] text-center">
                        {MONTHS[selectedMonth - 1]} {selectedYear}
                      </span>
                      <Button variant="outline" size="sm" onClick={handleNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <div>
                        Total: <span className="font-semibold text-green-600">{formatCurrency(monthTotal)}</span>
                      </div>
                      <div>
                        Média Diária: <span className="font-semibold text-blue-600">{daysElapsed > 0 ? formatCurrency(monthTotal / daysElapsed) : formatCurrency(0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingCalendar ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando calendário...
                  </div>
                ) : (
                  <>
                    {/* Legenda */}
                    <div className="flex flex-wrap gap-4 mb-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded"></div>
                        <span>Balcão</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-purple-500 rounded"></div>
                        <span>Delivery</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-500 rounded"></div>
                        <span>A Prazo</span>
                      </div>
                      {holidays.size > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-red-400 rounded"></div>
                          <span>Feriado ({holidays.size})</span>
                        </div>
                      )}
                      {manualByDay.size > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-amber-400 rounded"></div>
                          <span>Destaque ({manualByDay.size})</span>
                        </div>
                      )}
                      {isAdmin && (
                        <span className="text-muted-foreground/60 italic text-xs self-center">Clique em um dia para adicionar destaque</span>
                      )}
                    </div>

                    {/* Grid do calendário */}
                    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                      <div className="grid grid-cols-7 gap-0.5 md:gap-1 min-w-[650px] md:min-w-0">
                        {/* Cabeçalho dos dias da semana */}
                        {DAYS_OF_WEEK.map(day => (
                          <div key={day} className="text-center font-semibold text-xs md:text-sm py-1 md:py-2">
                            {day}
                          </div>
                        ))}

                        {/* Dias do mês */}
                        {calendarDays.map((day, index) => {
                          if (day === null) {
                            return <div key={`empty-${index}`} className="aspect-square"></div>;
                          }

                          const dayData = dataByDay.get(day);
                          const hasData = dayData && dayData.total > 0;
                          const holiday = holidays.get(day);
                          const manual = manualByDay.get(day);

                          let borderClass = "border-gray-200";
                          let bgClass = hasData ? "bg-gray-50" : "bg-white";

                          if (isTodayDay(day)) {
                            borderClass = "border-blue-500 border-2";
                            bgClass = "bg-blue-50";
                          } else if (manual) {
                            bgClass = "bg-amber-50/70";
                            borderClass = "border-amber-300";
                          } else if (holiday) {
                            bgClass = "bg-red-50/60";
                            borderClass = "border-red-200";
                          }

                          const dayCell = (
                            <div
                              className={`
                                min-h-[150px] md:h-[100px] border rounded-lg p-1.5 md:p-2 flex flex-col text-xs md:text-sm overflow-hidden relative
                                ${borderClass} ${bgClass}
                                ${isAdmin ? 'cursor-pointer hover:ring-1 hover:ring-amber-300' : ''}
                                hover:shadow-md transition-shadow
                              `}
                            >
                              {/* Indicadores no canto */}
                              {(holiday || manual) && (
                                <div className="absolute top-1 right-1 flex gap-0.5">
                                  {holiday && <div className="w-2.5 h-2.5 rounded-full bg-red-400" />}
                                  {manual && <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />}
                                </div>
                              )}

                              <div className={`text-sm md:text-lg font-semibold mb-0.5 ${holiday ? 'text-red-500' : ''}`}>
                                {day}
                              </div>

                              {/* Nome do feriado/destaque */}
                              {(holiday || manual) && (
                                <div className={`text-[7px] md:text-[9px] leading-tight truncate max-w-full font-medium mb-0.5 ${manual ? 'text-amber-600' : 'text-red-500'}`}>
                                  {manual?.label || holiday?.name}
                                </div>
                              )}

                              {hasData && dayData && (
                                <div className="flex-1 flex flex-col justify-between">
                                  <div className="space-y-0.5">
                                    {dayData.balcao > 0 && (
                                      <div className="flex items-center gap-0.5">
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></div>
                                        <span className="text-[8px] md:text-xs leading-tight">{formatCurrency(dayData.balcao)}</span>
                                      </div>
                                    )}
                                    {dayData.delivery > 0 && (
                                      <div className="flex items-center gap-0.5">
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0"></div>
                                        <span className="text-[8px] md:text-xs leading-tight">{formatCurrency(dayData.delivery)}</span>
                                      </div>
                                    )}
                                    {dayData.aPrazo > 0 && (
                                      <div className="flex items-center gap-0.5">
                                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0"></div>
                                        <span className="text-[8px] md:text-xs leading-tight">{formatCurrency(dayData.aPrazo)}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="font-bold text-[8px] md:text-sm mt-1 md:mt-2 pt-1 md:pt-1.5 border-t leading-tight">
                                    {formatCurrency(dayData.total)}
                                  </div>
                                </div>
                              )}
                            </div>
                          );

                          // Admin: popover para gerenciar destaques
                          if (isAdmin) {
                            return (
                              <Popover key={day} open={highlightDay === day} onOpenChange={(open) => {
                                if (open) {
                                  setHighlightDay(day);
                                  setHighlightLabel("");
                                } else {
                                  setHighlightDay(null);
                                }
                              }}>
                                <PopoverTrigger asChild>
                                  {dayCell}
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3" side="top">
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground">
                                      Dia {String(day).padStart(2, '0')}/{String(selectedMonth).padStart(2, '0')}/{selectedYear}
                                    </p>

                                    {/* Mostrar feriado se houver */}
                                    {holiday && (
                                      <div className="flex items-center gap-1.5 text-xs">
                                        <div className="w-2 h-2 rounded-full bg-red-400" />
                                        <span className="text-red-600">{holiday.name}</span>
                                      </div>
                                    )}

                                    {/* Destaque manual existente */}
                                    {manual && (
                                      <div className="flex items-center justify-between bg-amber-50 rounded p-1.5">
                                        <div className="flex items-center gap-1.5 text-xs">
                                          <div className="w-2 h-2 rounded-full bg-amber-400" />
                                          <span className="text-amber-700 font-medium">{manual.label}</span>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 text-red-500 hover:text-red-700"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveHighlight(manual.id);
                                          }}
                                          disabled={removeHighlightMutation.isPending}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}

                                    {/* Adicionar novo destaque */}
                                    {!manual && (
                                      <div className="flex gap-1.5">
                                        <Input
                                          placeholder="Ex: Loja Fechada"
                                          value={highlightLabel}
                                          onChange={(e) => setHighlightLabel(e.target.value)}
                                          className="h-7 text-xs"
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") handleAddHighlight(day);
                                          }}
                                        />
                                        <Button
                                          size="icon"
                                          className="h-7 w-7 shrink-0"
                                          onClick={() => handleAddHighlight(day)}
                                          disabled={!highlightLabel.trim() || addHighlightMutation.isPending}
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          }

                          // Non-admin: tooltip
                          const tooltipText = [holiday?.name, manual?.label].filter(Boolean).join(" | ");
                          if (tooltipText) {
                            return (
                              <Tooltip key={day}>
                                <TooltipTrigger asChild>
                                  {dayCell}
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {tooltipText}
                                </TooltipContent>
                              </Tooltip>
                            );
                          }

                          return <div key={day}>{dayCell}</div>;
                        })}
                      </div>
                    </div>

                    {/* Botão para voltar à visão mensal */}
                    <div className="mt-4 text-center">
                      <Button variant="outline" onClick={() => setViewMode("monthly")}>
                        ← Voltar para Visão Mensal
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
