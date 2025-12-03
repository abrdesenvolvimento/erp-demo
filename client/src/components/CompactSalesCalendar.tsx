import { trpc } from "@/lib/trpc";

export function CompactSalesCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const { data: calendarData, isLoading } = trpc.sales.calendar.useQuery({
    year,
    month,
  });

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground text-sm">Carregando...</div>;
  }

  // Pegar últimos 7 dias
  const last7Days: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    last7Days.push(date.getDate());
  }

  // Criar mapa de dados por dia
  const dataByDay = new Map(calendarData?.map(d => [d.day, d]) || []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getDayName = (dayOffset: number) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - dayOffset));
    return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  };

  return (
    <div className="grid grid-cols-7 gap-2">
      {last7Days.map((day, index) => {
        const dayData = dataByDay.get(day);
        const hasData = dayData && dayData.total > 0;
        const isToday = index === 6;

        return (
          <div
            key={day}
            className={`
              flex flex-col items-center p-2 rounded-lg border
              ${isToday ? 'border-blue-500 border-2 bg-blue-50' : 'border-gray-200'}
              ${hasData ? 'bg-gray-50' : 'bg-white'}
            `}
          >
            <div className="text-xs font-semibold text-muted-foreground mb-1">
              {getDayName(index)}
            </div>
            <div className="text-sm font-bold mb-1">{day}</div>
            {hasData && dayData ? (
              <div className="text-xs font-semibold text-green-600">
                {formatCurrency(dayData.total)}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">-</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
