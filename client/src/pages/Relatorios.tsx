import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getCurrentBrazilDateInfo } from "@shared/dateUtils";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DAYS_OF_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function AnaliseFaturamento() {
  const todayInfo = getCurrentBrazilDateInfo();
  const [selectedYear, setSelectedYear] = useState(todayInfo.year);
  const [selectedMonth, setSelectedMonth] = useState(todayInfo.month);

  const { data: calendarData, isLoading } = trpc.sales.calendar.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

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
  const daysWithSales = calendarData?.length || 0;
  
  // Calcular dias corridos para média diária (usando timezone de Brasília)
  const currentInfo = getCurrentBrazilDateInfo();
  
  const isCurrentMonth = selectedYear === currentInfo.year && selectedMonth === currentInfo.month;
  const isPastMonth = selectedYear < currentInfo.year || (selectedYear === currentInfo.year && selectedMonth < currentInfo.month);
  
  let daysElapsed = 0;
  if (isPastMonth) {
    // Mês passado: usar total de dias do mês
    daysElapsed = daysInMonth;
  } else if (isCurrentMonth) {
    // Mês atual: usar dia de hoje em Brasília
    daysElapsed = currentInfo.day;
  } else {
    // Mês futuro: não calcular média
    daysElapsed = 0;
  }
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



  const isTodayDay = (day: number | null) => {
    if (!day) return false;
    return (
      day === currentInfo.day &&
      selectedMonth === currentInfo.month &&
      selectedYear === currentInfo.year
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground">Análise de vendas por período</p>
          </div>
        </div>

        {/* Calendário de Vendas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
<CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Análise de Faturamento
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
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando calendário...
              </div>
            ) : (
              <>
                {/* Legenda */}
                <div className="flex gap-4 mb-4 text-sm">
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

                    return (
                      <div
                        key={day}
                        className={`
                          min-h-[150px] md:h-[100px] border rounded-lg p-1.5 md:p-2 flex flex-col text-xs md:text-sm overflow-hidden
                          ${isTodayDay(day) ? 'border-blue-500 border-2' : 'border-gray-200'}
                          ${hasData ? 'bg-gray-50' : 'bg-white'}
                          hover:shadow-md transition-shadow
                        `}
                      >
                        <div className="text-sm md:text-lg font-semibold mb-1">{day}</div>
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
                  })}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
