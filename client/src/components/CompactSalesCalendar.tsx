import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { getHolidaysForMonth, type Holiday } from "@shared/holidays";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function CompactSalesCalendar() {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // State para popover de destaque manual
  const [highlightDay, setHighlightDay] = useState<number | null>(null);
  const [highlightLabel, setHighlightLabel] = useState("");

  const { data: calendarData, isLoading } = trpc.sales.calendar.useQuery({
    year,
    month,
  });

  // Buscar destaques manuais do banco
  const { data: manualHighlights } = trpc.calendar.getHighlights.useQuery(
    { year, month },
    { retry: false }
  );

  const utils = trpc.useUtils();

  const addHighlightMutation = trpc.calendar.addHighlight.useMutation({
    onSuccess: () => {
      utils.calendar.getHighlights.invalidate({ year, month });
      setHighlightDay(null);
      setHighlightLabel("");
    },
  });

  const removeHighlightMutation = trpc.calendar.removeHighlight.useMutation({
    onSuccess: () => {
      utils.calendar.getHighlights.invalidate({ year, month });
    },
  });

  // Feriados do mês (calculados no cliente, sem custo de rede)
  const holidays = useMemo(() => {
    const list = getHolidaysForMonth(year, month);
    const map = new Map<number, Holiday>();
    for (const h of list) {
      const day = parseInt(h.date.split("-")[2], 10);
      map.set(day, h);
    }
    return map;
  }, [year, month]);

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

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground text-sm">Carregando...</div>;
  }

  // Calcular dias do mês
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

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

  const holidayCount = holidays.size;
  const manualCount = manualByDay.size;

  const handleAddHighlight = (day: number) => {
    if (!highlightLabel.trim()) return;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    addHighlightMutation.mutate({
      date: dateStr,
      label: highlightLabel.trim(),
      color: "amber",
    });
  };

  const handleRemoveHighlight = (id: number) => {
    removeHighlightMutation.mutate({ id });
  };

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

      {/* Legenda */}
      {(holidayCount > 0 || manualCount > 0) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {holidayCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span>Feriado ({holidayCount})</span>
            </div>
          )}
          {manualCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Destaque ({manualCount})</span>
            </div>
          )}
          {isAdmin && (
            <span className="text-muted-foreground/60 italic">Clique em um dia para adicionar destaque</span>
          )}
        </div>
      )}

      {/* Grid do calendário */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="grid grid-cols-7 gap-0 min-w-[600px] md:min-w-0">
          {dayNames.map(name => (
            <div key={name} className="text-center text-xs md:text-xs font-semibold text-muted-foreground py-1">
              {name}
            </div>
          ))}

          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="min-h-[85px] md:h-[68px]" />;
            }

            const dayData = dataByDay.get(day);
            const hasData = dayData && dayData.total > 0;
            const isToday = isCurrentMonth && day === todayDay;
            const holiday = holidays.get(day);
            const manual = manualByDay.get(day);

            let borderClass = "border-gray-200";
            let bgClass = hasData ? "bg-gray-50" : "bg-white";

            if (isToday) {
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
                  min-h-[85px] md:h-[68px] flex flex-col items-center justify-center p-2 md:p-1 rounded border overflow-hidden relative
                  ${borderClass} ${bgClass}
                  ${isAdmin ? 'cursor-pointer hover:ring-1 hover:ring-amber-300' : ''}
                `}
              >
                {/* Indicadores no canto */}
                {(holiday || manual) && (
                  <div className="absolute top-0.5 right-0.5 flex gap-0.5">
                    {holiday && <div className="w-2 h-2 rounded-full bg-red-400" />}
                    {manual && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                  </div>
                )}

                <div className={`font-semibold text-sm md:text-base mb-0.5 ${holiday ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {String(day).padStart(2, '0')}
                </div>

                {(holiday || manual) && (
                  <div className={`text-[8px] md:text-[9px] leading-tight text-center px-0.5 truncate max-w-full font-medium ${manual ? 'text-amber-600' : 'text-red-500'}`}>
                    {manual?.label || holiday?.name}
                  </div>
                )}

                {hasData && dayData ? (
                  <div className="text-[10px] md:text-sm font-semibold text-green-600 text-center leading-tight break-words max-w-full px-0.5">
                    {formatCurrency(dayData.total)}
                  </div>
                ) : (
                  <div className="text-[10px] md:text-sm text-muted-foreground">-</div>
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
                        Dia {String(day).padStart(2, '0')}/{String(month).padStart(2, '0')}/{year}
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

            // Non-admin: tooltip apenas
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
    </div>
  );
}
