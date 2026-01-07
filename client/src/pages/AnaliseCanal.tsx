import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitCompare, ShoppingCart, Bike, CreditCard, TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getCurrentBrazilDateInfo } from "@shared/dateUtils";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface ChannelData {
  channel: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  avgTicket: number;
}

export default function AnaliseCanal() {
  const todayInfo = getCurrentBrazilDateInfo();
  const [selectedYear, setSelectedYear] = useState(todayInfo.year);
  const [selectedMonth, setSelectedMonth] = useState(todayInfo.month);

  

  // Buscar estatísticas de vendas por canal
  const { data: statsData } = trpc.sales.stats.useQuery({
    dateFrom: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`,
    dateTo: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${new Date(selectedYear, selectedMonth, 0).getDate()}`,
  });

  // Calcular métricas por canal a partir das estatísticas
  const channelMetrics = useMemo(() => {
    if (!statsData) return [];

    const metrics: ChannelData[] = [
      {
        channel: 'Balcão',
        quantity: Number(statsData.balcao?.count) || 0,
        revenue: Number(statsData.balcao?.total) || 0,
        cost: 0, // Precisaria de query específica
        profit: 0,
        margin: 0,
        avgTicket: statsData.balcao?.count ? (Number(statsData.balcao?.total) || 0) / Number(statsData.balcao.count) : 0,
      },
      {
        channel: 'Delivery',
        quantity: Number(statsData.delivery?.count) || 0,
        revenue: Number(statsData.delivery?.total) || 0,
        cost: 0,
        profit: 0,
        margin: 0,
        avgTicket: statsData.delivery?.count ? (Number(statsData.delivery?.total) || 0) / Number(statsData.delivery.count) : 0,
      },
      {
        channel: 'A Prazo',
        quantity: Number(statsData.aPrazo?.count) || 0,
        revenue: Number(statsData.aPrazo?.total) || 0,
        cost: 0,
        profit: 0,
        margin: 0,
        avgTicket: statsData.aPrazo?.count ? (Number(statsData.aPrazo?.total) || 0) / Number(statsData.aPrazo.count) : 0,
      },
    ];

    return metrics;
  }, [statsData]);

  // Calcular totais
  const totals = useMemo(() => {
    const total = channelMetrics.reduce((acc, ch) => ({
      quantity: acc.quantity + ch.quantity,
      revenue: acc.revenue + ch.revenue,
    }), { quantity: 0, revenue: 0 });

    return total;
  }, [channelMetrics]);

  // Formatação de moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Navegação de mês
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

  // Ícone por canal
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'Balcão': return ShoppingCart;
      case 'Delivery': return Bike;
      case 'A Prazo': return CreditCard;
      default: return ShoppingCart;
    }
  };

  // Cor por canal
  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'Balcão': return 'border-blue-500 bg-blue-50';
      case 'Delivery': return 'border-purple-500 bg-purple-50';
      case 'A Prazo': return 'border-orange-500 bg-orange-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getChannelTextColor = (channel: string) => {
    switch (channel) {
      case 'Balcão': return 'text-blue-600';
      case 'Delivery': return 'text-purple-600';
      case 'A Prazo': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GitCompare className="h-6 w-6" />
              Análise por Canal
            </h1>
            <p className="text-muted-foreground">
              Compare o desempenho entre Balcão, Delivery e A Prazo
            </p>
          </div>

          {/* Seletor de período */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevMonth}>
              &lt;
            </Button>
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-md">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">{MONTHS[selectedMonth - 1]} {selectedYear}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleNextMonth}>
              &gt;
            </Button>
          </div>
        </div>

        {/* Cards de resumo por canal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {channelMetrics.map((channel) => {
            const Icon = getChannelIcon(channel.channel);
            const percentage = totals.revenue > 0 
              ? ((channel.revenue / totals.revenue) * 100).toFixed(1) 
              : '0.0';

            return (
              <Card key={channel.channel} className={`border-t-4 ${getChannelColor(channel.channel)}`}>
                <CardHeader className="pb-2">
                  <CardTitle className={`flex items-center gap-2 text-lg ${getChannelTextColor(channel.channel)}`}>
                    <Icon className="h-5 w-5" />
                    {channel.channel}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Faturamento */}
                  <div>
                    <p className="text-sm text-muted-foreground">Faturamento</p>
                    <p className={`text-2xl font-bold ${getChannelTextColor(channel.channel)}`}>
                      {formatCurrency(channel.revenue)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {percentage}% do total
                    </p>
                  </div>

                  {/* Métricas secundárias */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Vendas</p>
                      <p className="text-lg font-semibold">{channel.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ticket Médio</p>
                      <p className="text-lg font-semibold">{formatCurrency(channel.avgTicket)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Card de total */}
        <Card className="border-t-4 border-green-500 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Geral</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(totals.revenue)}
                </p>
              </div>
              <div className="flex gap-8">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total de Vendas</p>
                  <p className="text-2xl font-bold">{totals.quantity}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Ticket Médio Geral</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totals.quantity > 0 ? totals.revenue / totals.quantity : 0)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela comparativa */}
        <Card>
          <CardHeader>
            <CardTitle>Comparativo Detalhado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Canal</th>
                    <th className="text-right py-3 px-4 font-medium">Vendas</th>
                    <th className="text-right py-3 px-4 font-medium">Faturamento</th>
                    <th className="text-right py-3 px-4 font-medium">% Total</th>
                    <th className="text-right py-3 px-4 font-medium">Ticket Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {channelMetrics.map((channel) => {
                    const Icon = getChannelIcon(channel.channel);
                    const percentage = totals.revenue > 0 
                      ? ((channel.revenue / totals.revenue) * 100).toFixed(1) 
                      : '0.0';

                    return (
                      <tr key={channel.channel} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${getChannelTextColor(channel.channel)}`} />
                            <span className="font-medium">{channel.channel}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4">{channel.quantity}</td>
                        <td className="text-right py-3 px-4 font-medium">
                          {formatCurrency(channel.revenue)}
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getChannelColor(channel.channel)}`}>
                            {percentage}%
                          </span>
                        </td>
                        <td className="text-right py-3 px-4">
                          {formatCurrency(channel.avgTicket)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-medium">
                    <td className="py-3 px-4">Total</td>
                    <td className="text-right py-3 px-4">{totals.quantity}</td>
                    <td className="text-right py-3 px-4">{formatCurrency(totals.revenue)}</td>
                    <td className="text-right py-3 px-4">100%</td>
                    <td className="text-right py-3 px-4">
                      {formatCurrency(totals.quantity > 0 ? totals.revenue / totals.quantity : 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Informação sobre funcionalidade futura */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Funcionalidades em desenvolvimento</p>
                <p className="text-sm text-amber-700 mt-1">
                  Em breve: análise de margem por canal, comparação com período anterior, 
                  e gráficos de evolução temporal.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
