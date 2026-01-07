import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitCompare, ShoppingCart, Bike, CreditCard, TrendingUp, CalendarIcon, X, ChevronDown, ChevronUp, Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getCurrentBrazilDateInfo } from "@shared/dateUtils";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface ChannelData {
  channel: string;
  channelKey: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  avgTicket: number;
}

export default function AnaliseCanal() {
  const todayInfo = getCurrentBrazilDateInfo();
  
  // Estado para período flexível
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date(todayInfo.year, todayInfo.month - 1, todayInfo.day);
    return {
      from: startOfMonth(today),
      to: today,
    };
  });

  // Estados para filtros de produto
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Buscar lista de produtos para filtro
  const { data: products } = trpc.products.list.useQuery();

  // Produtos filtrados pelo search
  const filteredProducts = useMemo(() => {
    if (!products || !productSearch) return [];
    const search = productSearch.toLowerCase();
    return products
      .filter(p => p.name.toLowerCase().includes(search))
      .slice(0, 10);
  }, [products, productSearch]);

  // Buscar dados de vendas por canal usando salesAnalysis.byValue
  const { data: balcaoData, isLoading: isLoadingBalcao } = trpc.salesAnalysis.byValue.useQuery(
    {
      startDate: dateRange?.from ?? new Date(),
      endDate: dateRange?.to ?? new Date(),
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      channels: ['BALCAO'],
    },
    { enabled: !!dateRange?.from && !!dateRange?.to }
  );

  const { data: deliveryData, isLoading: isLoadingDelivery } = trpc.salesAnalysis.byValue.useQuery(
    {
      startDate: dateRange?.from ?? new Date(),
      endDate: dateRange?.to ?? new Date(),
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      channels: ['DELIVERY'],
    },
    { enabled: !!dateRange?.from && !!dateRange?.to }
  );

  const { data: aPrazoData, isLoading: isLoadingAPrazo } = trpc.salesAnalysis.byValue.useQuery(
    {
      startDate: dateRange?.from ?? new Date(),
      endDate: dateRange?.to ?? new Date(),
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      channels: ['A_PRAZO'],
    },
    { enabled: !!dateRange?.from && !!dateRange?.to }
  );

  const isLoading = isLoadingBalcao || isLoadingDelivery || isLoadingAPrazo;

  // Taxa de delivery (7%)
  const DELIVERY_FEE_PERCENT = 0.07;

  // Calcular métricas por canal
  const channelMetrics = useMemo(() => {
    const calculateChannelMetrics = (data: typeof balcaoData, channelName: string, channelKey: string): ChannelData => {
      if (!data || data.length === 0) {
        return {
          channel: channelName,
          channelKey,
          quantity: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          margin: 0,
          avgTicket: 0,
        };
      }

      const totals = data.reduce((acc, item) => ({
        quantity: acc.quantity + parseFloat(item.totalQuantity),
        revenue: acc.revenue + parseFloat(item.totalRevenue),
        cost: acc.cost + parseFloat(item.totalCost),
      }), { quantity: 0, revenue: 0, cost: 0 });

      // Para Delivery, descontar 7% de taxa do faturamento para calcular margem líquida
      let effectiveRevenue = totals.revenue;
      let deliveryFee = 0;
      if (channelKey === 'DELIVERY') {
        deliveryFee = totals.revenue * DELIVERY_FEE_PERCENT;
        effectiveRevenue = totals.revenue - deliveryFee;
      }

      const profit = effectiveRevenue - totals.cost;
      const margin = effectiveRevenue > 0 ? (profit / effectiveRevenue) * 100 : 0;
      // Contar vendas distintas (aproximação: número de produtos únicos vendidos)
      const salesCount = data.length;
      const avgTicket = salesCount > 0 ? totals.revenue / salesCount : 0;

      return {
        channel: channelName,
        channelKey,
        quantity: totals.quantity,
        revenue: totals.revenue,
        cost: totals.cost + deliveryFee, // Incluir taxa como "custo" para visualização
        profit,
        margin,
        avgTicket,
      };
    };

    return [
      calculateChannelMetrics(balcaoData, 'Balcão', 'BALCAO'),
      calculateChannelMetrics(deliveryData, 'Delivery', 'DELIVERY'),
      calculateChannelMetrics(aPrazoData, 'A Prazo', 'A_PRAZO'),
    ];
  }, [balcaoData, deliveryData, aPrazoData]);

  // Calcular totais
  const totals = useMemo(() => {
    return channelMetrics.reduce((acc, ch) => ({
      quantity: acc.quantity + ch.quantity,
      revenue: acc.revenue + ch.revenue,
      cost: acc.cost + ch.cost,
      profit: acc.profit + ch.profit,
    }), { quantity: 0, revenue: 0, cost: 0, profit: 0 });
  }, [channelMetrics]);

  const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  // Formatação de moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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

  // Adicionar produto ao filtro
  const addProduct = (productId: number) => {
    if (!selectedProductIds.includes(productId)) {
      setSelectedProductIds([...selectedProductIds, productId]);
    }
    setProductSearch("");
  };

  // Remover produto do filtro
  const removeProduct = (productId: number) => {
    setSelectedProductIds(selectedProductIds.filter(id => id !== productId));
  };

  // Limpar todos os filtros
  const clearFilters = () => {
    setSelectedProductIds([]);
    setProductSearch("");
  };

  // Atalhos de período
  const setThisMonth = () => {
    const today = new Date();
    setDateRange({
      from: startOfMonth(today),
      to: today,
    });
  };

  const setLastMonth = () => {
    const lastMonth = subMonths(new Date(), 1);
    setDateRange({
      from: startOfMonth(lastMonth),
      to: endOfMonth(lastMonth),
    });
  };

  const setLast3Months = () => {
    const today = new Date();
    setDateRange({
      from: startOfMonth(subMonths(today, 2)),
      to: today,
    });
  };

  const setThisYear = () => {
    const today = new Date();
    setDateRange({
      from: new Date(today.getFullYear(), 0, 1),
      to: today,
    });
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
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                        {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                    )
                  ) : (
                    <span>Selecione o período</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-3 border-b space-y-2">
                  <p className="text-sm font-medium">Atalhos</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={setThisMonth}>Este mês</Button>
                    <Button variant="outline" size="sm" onClick={setLastMonth}>Mês anterior</Button>
                    <Button variant="outline" size="sm" onClick={setLast3Months}>Últimos 3 meses</Button>
                    <Button variant="outline" size="sm" onClick={setThisYear}>Este ano</Button>
                  </div>
                </div>
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Filtros expansíveis */}
        <Card>
          <CardHeader 
            className="cursor-pointer py-3"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Filtros de Produto
                {selectedProductIds.length > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                    {selectedProductIds.length}
                  </span>
                )}
              </CardTitle>
              {filtersExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
          {filtersExpanded && (
            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Busca de produtos */}
                <div className="relative">
                  <Label>Buscar Produto</Label>
                  <Input
                    placeholder="Digite para buscar produtos..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {filteredProducts.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredProducts.map((product) => (
                        <div
                          key={product.id}
                          className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                          onClick={() => addProduct(product.id)}
                        >
                          {product.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Produtos selecionados */}
                {selectedProductIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedProductIds.map((id) => {
                      const product = products?.find(p => p.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-sm"
                        >
                          {product?.name || `Produto ${id}`}
                          <X
                            className="h-3 w-3 cursor-pointer hover:text-destructive"
                            onClick={() => removeProduct(id)}
                          />
                        </span>
                      );
                    })}
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Cards de resumo por canal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {channelMetrics.map((channel) => {
            const Icon = getChannelIcon(channel.channel);
            const revenuePercentage = totals.revenue > 0 
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
                      {revenuePercentage}% do total
                    </p>
                  </div>

                  {/* Métricas secundárias */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Qtd Vendida</p>
                      <p className="text-lg font-semibold">{channel.quantity.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lucro</p>
                      <p className={`text-lg font-semibold ${channel.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(channel.profit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Custo</p>
                      <p className="text-lg font-semibold text-red-600">{formatCurrency(channel.cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Margem</p>
                      <p className={`text-lg font-semibold ${channel.margin >= 30 ? 'text-green-600' : channel.margin >= 20 ? 'text-amber-600' : 'text-red-600'}`}>
                        {channel.margin.toFixed(1)}%
                      </p>
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
                  <p className="text-sm text-muted-foreground">Qtd Vendida</p>
                  <p className="text-2xl font-bold">{totals.quantity.toFixed(0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Lucro Total</p>
                  <p className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totals.profit)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Margem Geral</p>
                  <p className={`text-2xl font-bold ${totalMargin >= 30 ? 'text-green-600' : totalMargin >= 20 ? 'text-amber-600' : 'text-red-600'}`}>
                    {totalMargin.toFixed(1)}%
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
                    <th className="text-right py-3 px-4 font-medium">Qtd Vendida</th>
                    <th className="text-right py-3 px-4 font-medium">Faturamento</th>
                    <th className="text-right py-3 px-4 font-medium">Custo</th>
                    <th className="text-right py-3 px-4 font-medium">Lucro</th>
                    <th className="text-right py-3 px-4 font-medium">Margem</th>
                    <th className="text-right py-3 px-4 font-medium">% Total</th>
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
                        <td className="text-right py-3 px-4">{channel.quantity.toFixed(0)}</td>
                        <td className="text-right py-3 px-4 font-medium text-emerald-600">
                          {formatCurrency(channel.revenue)}
                        </td>
                        <td className="text-right py-3 px-4 text-red-600">
                          {formatCurrency(channel.cost)}
                        </td>
                        <td className={`text-right py-3 px-4 font-medium ${channel.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {formatCurrency(channel.profit)}
                        </td>
                        <td className={`text-right py-3 px-4 font-bold ${channel.margin >= 30 ? 'text-green-600' : channel.margin >= 20 ? 'text-amber-600' : 'text-red-600'}`}>
                          {channel.margin.toFixed(1)}%
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getChannelColor(channel.channel)}`}>
                            {percentage}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-medium">
                    <td className="py-3 px-4">Total</td>
                    <td className="text-right py-3 px-4">{totals.quantity.toFixed(0)}</td>
                    <td className="text-right py-3 px-4 text-emerald-600">{formatCurrency(totals.revenue)}</td>
                    <td className="text-right py-3 px-4 text-red-600">{formatCurrency(totals.cost)}</td>
                    <td className={`text-right py-3 px-4 ${totals.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatCurrency(totals.profit)}
                    </td>
                    <td className={`text-right py-3 px-4 font-bold ${totalMargin >= 30 ? 'text-green-600' : totalMargin >= 20 ? 'text-amber-600' : 'text-red-600'}`}>
                      {totalMargin.toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Indicador de carregamento */}
        {isLoading && (
          <div className="text-center py-4 text-muted-foreground">
            Carregando dados...
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
