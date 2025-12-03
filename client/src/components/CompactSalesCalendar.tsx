import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function CompactSalesCalendar() {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: calendarData, isLoading } = trpc.sales.calendar.useQuery({
    year,
    month,
  });

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground text-sm">Carregando...</div>;
  }

  // Calcular dias do mês
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 = Domingo

  // Criar array de dias (incluindo espaços vazios no início)
  const days: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  // Criar mapa de dados por dia
  const dataByDay = new Map(calendarData?.map(d => [d.day, d]) || []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();
  const isCurrentMonth = year === todayYear && month === todayMonth;

  return (
    <div className="space-y-4">
      {/* Header com navegação */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Faturamento Diário</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {monthNames[month - 1]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Link href="/relatorios">
            <Button variant="outline" size="sm" className="ml-2">
              Ver Detalhes →
            </Button>
          </Link>
        </div>
      </div>

      {/* Cálendário */}
      <div className="grid grid-cols-7 gap-1 md:gap-0.5">
        {/* Cabeçalho dos dias da semana */}
        {dayNames.map(name => (
          <div key={name} className="text-center text-xs md:text-xs font-semibold text-muted-foreground py-2">
            {name}
          </div>
        ))}

        {/* Dias do mês */}
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dayData = dataByDay.get(day);
          const hasData = dayData && dayData.total > 0;
          const isToday = isCurrentMonth && day === todayDay;

          return (
            <div
              key={day}
              className={`
                aspect-square flex flex-col items-center justify-center p-1 md:p-0.5 rounded border
                ${isToday ? 'border-blue-500 border-2 bg-blue-50' : 'border-gray-200'}
                ${hasData ? 'bg-gray-50' : 'bg-white'}
              `}
            >
              <div className="font-semibold text-muted-foreground text-xs md:text-sm mb-0.5">
                {String(day).padStart(2, '0')}
              </div>
              {hasData && dayData ? (
                <div className="text-[10px] md:text-xs font-semibold text-green-600 text-center leading-tight">
                  {formatCurrency(dayData.total)}
                </div>
              ) : (
                <div className="text-[10px] md:text-xs text-muted-foreground">-</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
