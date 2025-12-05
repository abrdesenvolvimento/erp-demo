import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, TrendingUp, Package, Download, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return format(date, "dd/MM/yyyy", { locale: ptBR });
};

const getDayName = (dayOfWeek: number) => {
  const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return days[dayOfWeek - 1] || "";
};

const formatMonthYear = (yearMonth: string) => {
  const [year, month] = yearMonth.split("-");
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${months[parseInt(month) - 1]} ${year}`;
};

// Feriados nacionais brasileiros (fixos e móveis de 2025)
const isHoliday = (dateStr: string) => {
  const holidays = [
    "2025-01-01", // Ano Novo
    "2025-02-24", // Carnaval
    "2025-02-25", // Carnaval
    "2025-04-18", // Paixão de Cristo
    "2025-04-21", // Tiradentes
    "2025-05-01", // Dia do Trabalho
    "2025-06-19", // Corpus Christi
    "2025-09-07", // Independência
    "2025-10-12", // Nossa Senhora Aparecida
    "2025-11-02", // Finados
    "2025-11-15", // Proclamação da República
    "2025-11-20", // Consciência Negra
    "2025-12-25", // Natal
  ];
  return holidays.includes(dateStr);
};

export default function AnáliseVendas() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    // Usar novembro de 2025 como período padrão (quando o sistema começou)
    const firstDay = new Date(2025, 10, 1); // 01/11/2025
    const lastDay = new Date(2025, 10, 30); // 30/11/2025
    return { from: firstDay, to: lastDay };
  });

  // Estados de filtros
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | undefined>();
  const [selectedChannel, setSelectedChannel] = useState<string | undefined>();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | undefined>();
  const [productSearch, setProductSearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [groupBy, setGroupBy] = useState<"product" | "day" | "week" | "month">("product");

  // Buscar produtos e subcategorias para filtros
  const { data: products } = trpc.products.list.useQuery(undefined, { enabled: isAdmin });
  const { data: subcategories } = trpc.subcategories.list.useQuery(undefined, { enabled: isAdmin });

  // Filtrar produtos e subcategorias baseado na busca
  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 10) || [];

  const filteredSubcategories = subcategories?.filter(s => 
    s.name.toLowerCase().includes(subcategorySearch.toLowerCase())
  ).slice(0, 10) || [];

  // Queries com filtros (por produto)
  const { data: valueData, isLoading: isValueLoading } = trpc.salesAnalysis.byValue.useQuery(
    { 
      startDate: dateRange.from, 
      endDate: dateRange.to,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channel: selectedChannel,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && groupBy === "product" }
  );

  const { data: quantityData, isLoading: isQuantityLoading } = trpc.salesAnalysis.byQuantity.useQuery(
    { 
      startDate: dateRange.from, 
      endDate: dateRange.to,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channel: selectedChannel,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && groupBy === "product" }
  );

  const { data: categoryData, isLoading: isCategoryLoading } = trpc.salesAnalysis.byCategoryValue.useQuery(
    { 
      startDate: dateRange.from, 
      endDate: dateRange.to,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channel: selectedChannel,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && groupBy === "product" }
  );

  // Queries temporais
  const { data: dayData, isLoading: isDayLoading } = trpc.salesAnalysis.byDay.useQuery(
    { 
      startDate: dateRange.from, 
      endDate: dateRange.to,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channel: selectedChannel,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && groupBy === "day" }
  );

  const { data: weekData, isLoading: isWeekLoading } = trpc.salesAnalysis.byWeek.useQuery(
    { 
      startDate: dateRange.from, 
      endDate: dateRange.to,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channel: selectedChannel,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && groupBy === "week" }
  );

  const { data: monthData, isLoading: isMonthLoading } = trpc.salesAnalysis.byMonth.useQuery(
    { 
      startDate: dateRange.from, 
      endDate: dateRange.to,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channel: selectedChannel,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && groupBy === "month" }
  );

  // Query para matriz produto×dia (Evolução Diária)
  const { data: matrixData, isLoading: isMatrixLoading } = trpc.salesAnalysis.byProductAndDate.useQuery(
    { 
      startDate: dateRange.from, 
      endDate: dateRange.to,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channel: selectedChannel,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin }
  );

  // Redirecionar se não for admin
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Acesso restrito a administradores</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Análise de Vendas</h1>
            <p className="text-muted-foreground">
              Análise detalhada de desempenho comercial por valores e quantidades
            </p>
          </div>

          {/* Filtro de Período */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from && dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                    {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                  </>
                ) : (
                  <span>Selecione o período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                locale={ptBR}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Filtros Avançados */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros e Agrupamento</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Seletor de Agrupamento */}
            <div className="mb-4">
              <Label>Agrupar por</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={groupBy === "product" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGroupBy("product")}
                >
                  Produto
                </Button>
                <Button
                  variant={groupBy === "day" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGroupBy("day")}
                >
                  Dia
                </Button>
                <Button
                  variant={groupBy === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGroupBy("week")}
                >
                  Semana
                </Button>
                <Button
                  variant={groupBy === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGroupBy("month")}
                >
                  Mês
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Filtro de Subcategoria */}
              <div className="space-y-2">
                <Label>Subcategoria</Label>
                <div className="relative">
                  <Input
                    placeholder="Digite para buscar subcategoria..."
                    value={subcategorySearch}
                    onChange={(e) => setSubcategorySearch(e.target.value)}
                    onFocus={() => setSubcategorySearch("")}
                  />
                  {selectedSubcategoryId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => {
                        setSelectedSubcategoryId(undefined);
                        setSubcategorySearch("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {subcategorySearch && filteredSubcategories.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredSubcategories.map((sub) => (
                        <div
                          key={sub.id}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            setSelectedSubcategoryId(sub.id);
                            setSubcategorySearch(sub.name);
                          }}
                        >
                          {sub.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedSubcategoryId && (
                  <p className="text-sm text-muted-foreground">
                    Filtrando por: {subcategories?.find(s => s.id === selectedSubcategoryId)?.name}
                  </p>
                )}
              </div>

              {/* Filtro de Produtos (Múltipla Seleção) */}
              <div className="space-y-2">
                <Label>Produtos</Label>
                <div className="relative">
                  <Input
                    placeholder="Digite para buscar produtos..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {productSearch && filteredProducts.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredProducts.map((prod) => (
                        <div
                          key={prod.id}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            if (!selectedProductIds.includes(prod.id)) {
                              setSelectedProductIds([...selectedProductIds, prod.id]);
                            }
                            setProductSearch("");
                          }}
                        >
                          {prod.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Chips de produtos selecionados */}
                {selectedProductIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedProductIds.map(id => {
                      const product = products?.find(p => p.id === id);
                      return (
                        <div key={id} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm">
                          <span>{product?.name}</span>
                          <button
                            onClick={() => setSelectedProductIds(selectedProductIds.filter(pid => pid !== id))}
                            className="hover:bg-blue-200 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Filtro de Canal de Venda */}
              <div className="space-y-2">
                <Label>Canal de Venda</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={selectedChannel || ""}
                  onChange={(e) => setSelectedChannel(e.target.value || undefined)}
                >
                  <option value="">Todos os canais</option>
                  <option value="BALCAO">Balcão</option>
                  <option value="DELIVERY">Delivery</option>
                  <option value="A_PRAZO">A Prazo</option>
                </select>
              </div>

              {/* Filtro de Forma de Pagamento */}
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={selectedPaymentMethod || ""}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value || undefined)}
                >
                  <option value="">Todas as formas</option>
                  <option value="PIX">Pix</option>
                  <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                  <option value="CARTAO_DEBITO">Cartão de Débito</option>
                  <option value="DINHEIRO">Dinheiro</option>
                </select>
              </div>
            </div>

            {/* Botão Limpar Filtros */}
            {(selectedProductIds.length > 0 || selectedSubcategoryId || selectedChannel || selectedPaymentMethod) && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProductIds([]);
                    setSelectedSubcategoryId(undefined);
                    setSelectedChannel(undefined);
                    setSelectedPaymentMethod(undefined);
                    setProductSearch("");
                    setSubcategorySearch("");
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar Todos os Filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="evolucao" className="space-y-4">
          <TabsList>
            <TabsTrigger value="evolucao" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Evolução Diária
            </TabsTrigger>
            <TabsTrigger value="valores" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Análise de Valores
            </TabsTrigger>
            <TabsTrigger value="quantidades" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Análise de Quantidades
            </TabsTrigger>
            <TabsTrigger value="categorias" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Por Categoria
            </TabsTrigger>
          </TabsList>

          {/* NOVA ABA: Evolução Diária */}
          <TabsContent value="evolucao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Evolução Diária de Vendas por Produto</CardTitle>
              </CardHeader>
              <CardContent>
                {isMatrixLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">Carregando dados...</p>
                  </div>
                ) : !matrixData || matrixData.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">Nenhum dado disponível para o período selecionado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {(() => {
                      // Gerar array de datas do período
                      const dates: string[] = [];
                      const current = new Date(dateRange.from);
                      const end = new Date(dateRange.to);
                      while (current <= end) {
                        dates.push(current.toISOString().split('T')[0]);
                        current.setDate(current.getDate() + 1);
                      }

                      // Agrupar dados por produto
                      const productMap = new Map<number, { name: string; sales: Map<string, { quantity: number; revenue: number }> }>();
                      
                      matrixData.forEach(row => {
                        if (!productMap.has(row.productId)) {
                          productMap.set(row.productId, {
                            name: row.productName,
                            sales: new Map()
                          });
                        }
                        const product = productMap.get(row.productId)!;
                        product.sales.set(row.saleDate, {
                          quantity: parseFloat(row.quantity),
                          revenue: parseFloat(row.revenue)
                        });
                      });

                      // Calcular máximo para heatmap
                      let maxQuantity = 0;
                      productMap.forEach(product => {
                        product.sales.forEach(sale => {
                          if (sale.quantity > maxQuantity) maxQuantity = sale.quantity;
                        });
                      });

                      // Função para calcular cor do heatmap
                      const getHeatmapColor = (quantity: number) => {
                        if (quantity === 0) return "bg-gray-50";
                        const intensity = Math.min(quantity / maxQuantity, 1);
                        if (intensity < 0.2) return "bg-green-100";
                        if (intensity < 0.4) return "bg-green-200";
                        if (intensity < 0.6) return "bg-green-300";
                        if (intensity < 0.8) return "bg-green-400";
                        return "bg-green-500 text-white";
                      };

                      // Mapa de feriados com nomes
                      const holidayNames: Record<string, string> = {
                        "2025-01-01": "Ano Novo",
                        "2025-02-24": "Carnaval",
                        "2025-02-25": "Carnaval",
                        "2025-04-18": "Paixão de Cristo",
                        "2025-04-21": "Tiradentes",
                        "2025-05-01": "Dia do Trabalho",
                        "2025-06-19": "Corpus Christi",
                        "2025-09-07": "Independência",
                        "2025-10-12": "N. Sra. Aparecida",
                        "2025-11-02": "Finados",
                        "2025-11-15": "Proclamação da República",
                        "2025-11-20": "Consciência Negra",
                        "2025-12-25": "Natal",
                      };

                      return (
                        <table className="min-w-full border-collapse text-sm">
                          <thead>
                            <tr>
                              <th className="sticky left-0 z-10 bg-white border px-3 py-2 text-left font-semibold">Produto</th>
                              {dates.map(date => {
                                const d = new Date(date + 'T00:00:00');
                                const dayOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()];
                                const dayNum = d.getDate();
                                const isHoliday = holidayNames[date];
                                return (
                                  <th 
                                    key={date} 
                                    className={`border px-2 py-2 text-center min-w-[60px] ${
                                      isHoliday ? 'bg-amber-100' : ''
                                    }`}
                                    title={isHoliday || undefined}
                                  >
                                    <div className="text-xs text-muted-foreground">{dayOfWeek}</div>
                                    <div className="font-semibold">{dayNum}</div>
                                    {isHoliday && <div className="text-xs text-amber-600">🎉</div>}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from(productMap.entries()).map(([productId, product]) => (
                              <tr key={productId}>
                                <td className="sticky left-0 z-10 bg-white border px-3 py-2 font-medium">
                                  {product.name}
                                </td>
                                {dates.map(date => {
                                  const sale = product.sales.get(date);
                                  const quantity = sale?.quantity || 0;
                                  const isHoliday = holidayNames[date];
                                  return (
                                    <td 
                                      key={date} 
                                      className={`border px-2 py-2 text-center ${
                                        getHeatmapColor(quantity)
                                      } ${
                                        isHoliday ? 'border-amber-400 border-2' : ''
                                      }`}
                                      title={sale ? `${quantity} unidades\nR$ ${formatCurrency(sale.revenue)}${isHoliday ? `\n🎉 ${isHoliday}` : ''}` : (isHoliday ? `🎉 ${isHoliday}` : undefined)}
                                    >
                                      {quantity > 0 ? quantity : '-'}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Análise de Valores */}
          <TabsContent value="valores" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  {groupBy === "product" && "Faturamento e Margem por Produto"}
                  {groupBy === "day" && "Faturamento e Margem por Dia"}
                  {groupBy === "week" && "Faturamento e Margem por Semana"}
                  {groupBy === "month" && "Faturamento e Margem por Mês"}
                </CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                {(groupBy === "product" && isValueLoading) || 
                 (groupBy === "day" && isDayLoading) ||
                 (groupBy === "week" && isWeekLoading) ||
                 (groupBy === "month" && isMonthLoading) ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : groupBy === "product" && valueData && valueData.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Qtd Vendida</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right">Custo Total</TableHead>
                          <TableHead className="text-right">Lucro</TableHead>
                          <TableHead className="text-right">Margem %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {valueData.map((item) => (
                          <TableRow key={item.productId}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.totalQuantity)}</TableCell>
                            <TableCell className="text-right text-emerald-600 font-semibold">
                              R$ {formatCurrency(item.totalRevenue)}
                            </TableCell>
                            <TableCell className="text-right">R$ {formatCurrency(item.totalCost)}</TableCell>
                            <TableCell className="text-right text-blue-600 font-semibold">
                              R$ {formatCurrency(item.totalProfit)}
                            </TableCell>
                            <TableCell className="text-right font-bold">{item.marginPercent}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : groupBy === "day" && dayData && dayData.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Dia da Semana</TableHead>
                          <TableHead className="text-right">Qtd Vendida</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right">Custo Total</TableHead>
                          <TableHead className="text-right">Lucro</TableHead>
                          <TableHead className="text-right">Margem %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dayData.map((item, idx) => {
                          const holiday = isHoliday(item.saleDate);
                          return (
                            <TableRow key={idx} className={holiday ? "bg-amber-50 border-l-4 border-l-amber-400" : ""}>
                              <TableCell className="font-medium">
                                {formatDate(item.saleDate)}
                                {holiday && <span className="ml-2 text-xs text-amber-600 font-semibold">Feriado</span>}
                              </TableCell>
                              <TableCell>{getDayName(item.dayOfWeek)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.totalQuantity)}</TableCell>
                              <TableCell className="text-right text-emerald-600 font-semibold">
                                R$ {formatCurrency(item.totalRevenue)}
                              </TableCell>
                              <TableCell className="text-right">R$ {formatCurrency(item.totalCost)}</TableCell>
                              <TableCell className="text-right text-blue-600 font-semibold">
                                R$ {formatCurrency(item.totalProfit)}
                              </TableCell>
                              <TableCell className="text-right font-bold">{item.marginPercent}%</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : groupBy === "week" && weekData && weekData.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Período</TableHead>
                          <TableHead className="text-right">Qtd Vendida</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right">Custo Total</TableHead>
                          <TableHead className="text-right">Lucro</TableHead>
                          <TableHead className="text-right">Margem %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weekData.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {formatDate(item.weekStart)} - {formatDate(item.weekEnd)}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(item.totalQuantity)}</TableCell>
                            <TableCell className="text-right text-emerald-600 font-semibold">
                              R$ {formatCurrency(item.totalRevenue)}
                            </TableCell>
                            <TableCell className="text-right">R$ {formatCurrency(item.totalCost)}</TableCell>
                            <TableCell className="text-right text-blue-600 font-semibold">
                              R$ {formatCurrency(item.totalProfit)}
                            </TableCell>
                            <TableCell className="text-right font-bold">{item.marginPercent}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : groupBy === "month" && monthData && monthData.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mês/Ano</TableHead>
                          <TableHead className="text-right">Qtd Vendida</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right">Custo Total</TableHead>
                          <TableHead className="text-right">Lucro</TableHead>
                          <TableHead className="text-right">Margem %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthData.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{formatMonthYear(item.yearMonth)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.totalQuantity)}</TableCell>
                            <TableCell className="text-right text-emerald-600 font-semibold">
                              R$ {formatCurrency(item.totalRevenue)}
                            </TableCell>
                            <TableCell className="text-right">R$ {formatCurrency(item.totalCost)}</TableCell>
                            <TableCell className="text-right text-blue-600 font-semibold">
                              R$ {formatCurrency(item.totalProfit)}
                            </TableCell>
                            <TableCell className="text-right font-bold">{item.marginPercent}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma venda no período selecionado</p>
                )}
              </CardContent>
            </Card>

            {/* Resumo de Valores */}
            {(() => {
              const currentData = 
                groupBy === "product" ? valueData :
                groupBy === "day" ? dayData :
                groupBy === "week" ? weekData :
                groupBy === "month" ? monthData : null;
              
              if (!currentData || currentData.length === 0) return null;

              const totalRevenue = currentData.reduce((sum, item) => sum + parseFloat(item.totalRevenue), 0);
              const totalCost = currentData.reduce((sum, item) => sum + parseFloat(item.totalCost), 0);
              const totalProfit = currentData.reduce((sum, item) => sum + parseFloat(item.totalProfit), 0);
              const margin = totalRevenue > 0 ? ((1 - (totalCost / totalRevenue)) * 100).toFixed(1) : "0.0";

              return (
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-emerald-600">
                        R$ {formatCurrency(totalRevenue)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        R$ {formatCurrency(totalCost)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        R$ {formatCurrency(totalProfit)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Margem Média</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {margin}%
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
          </TabsContent>

          {/* Análise de Quantidades */}
          <TabsContent value="quantidades" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Unidades Vendidas por Produto</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                {isQuantityLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : quantityData && quantityData.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Qtd Vendida</TableHead>
                          <TableHead className="text-right">Mix %</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quantityData.map((item) => (
                          <TableRow key={item.productId}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(item.totalQuantity)}</TableCell>
                            <TableCell className="text-right text-blue-600 font-bold">{item.quantityMixPercent}%</TableCell>
                            <TableCell className="text-right text-emerald-600">
                              R$ {formatCurrency(item.totalRevenue)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma venda no período selecionado</p>
                )}
              </CardContent>
            </Card>

            {/* Resumo de Quantidades */}
            {quantityData && quantityData.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total de Unidades</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(quantityData.reduce((sum, item) => sum + parseFloat(item.totalQuantity), 0))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Produtos Diferentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{quantityData.length}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">
                      R$ {formatCurrency(
                        quantityData.reduce((sum, item) => sum + parseFloat(item.totalRevenue), 0) /
                        quantityData.reduce((sum, item) => sum + parseFloat(item.totalQuantity), 0)
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Análise por Categoria */}
          <TabsContent value="categorias" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Desempenho por Categoria</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                {isCategoryLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : categoryData && categoryData.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Qtd Vendida</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right">Custo Total</TableHead>
                          <TableHead className="text-right">Lucro</TableHead>
                          <TableHead className="text-right">Margem %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryData.map((item) => (
                          <TableRow key={item.categoryId}>
                            <TableCell className="font-medium">{item.categoryName}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.totalQuantity)}</TableCell>
                            <TableCell className="text-right text-emerald-600 font-semibold">
                              R$ {formatCurrency(item.totalRevenue)}
                            </TableCell>
                            <TableCell className="text-right">R$ {formatCurrency(item.totalCost)}</TableCell>
                            <TableCell className="text-right text-blue-600 font-semibold">
                              R$ {formatCurrency(item.totalProfit)}
                            </TableCell>
                            <TableCell className="text-right font-bold">{item.marginPercent}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma venda no período selecionado</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
