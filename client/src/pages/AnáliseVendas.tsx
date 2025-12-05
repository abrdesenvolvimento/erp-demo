import { useState, useMemo } from "react";
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

  // Novos filtros de período
  const [selectedMonths, setSelectedMonths] = useState<number[]>([11]); // Novembro como padrão
  const [selectedYears] = useState<number[]>([2025]); // 2025 fixo até migração de dados históricos
  const [dayRange, setDayRange] = useState<[number, number]>([1, 31]); // Todos os dias
  const [filtersExpanded, setFiltersExpanded] = useState(true); // Controle de expansão dos filtros

  // Estados de filtros de segmentação
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | undefined>();
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | undefined>();
  const [productSearch, setProductSearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [groupBy, setGroupBy] = useState<"product" | "day" | "week" | "month">("product");

  // Buscar produtos, subcategorias e categorias para filtros
  const { data: products } = trpc.products.list.useQuery(undefined, { enabled: isAdmin });
  const { data: subcategories } = trpc.subcategories.list.useQuery(undefined, { enabled: isAdmin });
  const { data: categories } = trpc.categories.list.useQuery(undefined, { enabled: isAdmin });

  // Calcular dateRange baseado nos filtros de mês/ano/dia
  const dateRange = useMemo(() => {
    if (selectedMonths.length === 0 || selectedYears.length === 0) {
      // Fallback: novembro 2025
      return { from: new Date(2025, 10, 1), to: new Date(2025, 10, 30) };
    }

    // Gerar todas as combinações de ano/mês selecionadas
    const dates: Date[] = [];
    for (const year of selectedYears) {
      for (const month of selectedMonths) {
        // Adicionar data inicial (primeiro dia do range)
        dates.push(new Date(year, month - 1, dayRange[0]));
        // Adicionar data final (último dia do range)
        dates.push(new Date(year, month - 1, dayRange[1]));
      }
    }

    // Encontrar menor e maior data
    const from = new Date(Math.min(...dates.map(d => d.getTime())));
    const to = new Date(Math.max(...dates.map(d => d.getTime())));

    return { from, to };
  }, [selectedMonths, selectedYears, dayRange]);

  // Filtrar produtos e subcategorias baseado na busca
  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 10) || [];

  const filteredSubcategories = subcategories?.filter(s => 
    s.name.toLowerCase().includes(subcategorySearch.toLowerCase())
  ).slice(0, 10) || [];

  const filteredCategories = categories?.filter(c => 
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  ).slice(0, 10) || [];

  // Queries com filtros (por produto)
  const { data: valueData, isLoading: isValueLoading } = trpc.salesAnalysis.byValue.useQuery(
    { 
      startDate: dateRange.from, 
      endDate: dateRange.to,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channel: selectedChannels.length > 0 ? selectedChannels[0] : undefined,
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
      channel: selectedChannels.length > 0 ? selectedChannels[0] : undefined,
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
      channel: selectedChannels.length > 0 ? selectedChannels[0] : undefined,
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
      channel: selectedChannels.length > 0 ? selectedChannels[0] : undefined,
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
      channel: selectedChannels.length > 0 ? selectedChannels[0] : undefined,
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
      channel: selectedChannels.length > 0 ? selectedChannels[0] : undefined,
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
      channel: selectedChannels.length > 0 ? selectedChannels[0] : undefined,
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

          {/* Novos Filtros de Período */}
          <div className="text-sm text-muted-foreground">
            Período selecionado: {selectedMonths.length} mês(es), {selectedYears.length} ano(s), dias {dayRange[0]}-{dayRange[1]}
          </div>
        </div>

        {/* Filtros Avançados */}
        <Card>
          <CardHeader>
            <div className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Filtros e Agrupamento</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
              >
                {filtersExpanded ? "Ocultar Filtros" : "Expandir Filtros"}
              </Button>
            </div>
          </CardHeader>
          {filtersExpanded && (
          <CardContent className="bg-gray-50">
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

            {/* Filtros de Período */}
            <div className="mb-4 p-4 border rounded-md bg-muted/30">
              <Label className="text-base font-semibold">Período</Label>
              
              {/* Filtro de Mês */}
              <div className="mt-3">
                <Label className="text-sm">Mês(es)</Label>
                <div className="grid grid-cols-6 gap-2 mt-2">
                  {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map((month, idx) => (
                    <Button
                      key={idx}
                      variant={selectedMonths.includes(idx + 1) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (selectedMonths.includes(idx + 1)) {
                          setSelectedMonths(selectedMonths.filter(m => m !== idx + 1));
                        } else {
                          setSelectedMonths([...selectedMonths, idx + 1]);
                        }
                      }}
                    >
                      {month}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Filtro de Ano - Fixo em 2025 */}
              <div className="mt-3">
                <Label className="text-sm">Ano</Label>
                <div className="flex gap-2 mt-2">
                  <Button variant="default" size="sm" disabled>
                    2025
                  </Button>
                  <span className="text-xs text-muted-foreground flex items-center">
                    (Outros anos disponíveis após migração de dados históricos)
                  </span>
                </div>
              </div>

              {/* Filtro de Dia do Mês */}
              <div className="mt-3">
                <Label className="text-sm">Dia do Mês: {dayRange[0]} a {dayRange[1]}</Label>
                <div className="flex gap-2 mt-2 items-end">
                  <div className="w-20">
                    <Label className="text-xs">De</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={dayRange[0]}
                      onChange={(e) => setDayRange([parseInt(e.target.value) || 1, dayRange[1]])}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Até</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={dayRange[1]}
                      onChange={(e) => setDayRange([dayRange[0], parseInt(e.target.value) || 31])}
                      className="mt-1"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDayRange([1, 31])}
                    className="h-9"
                  >
                    Todos
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Filtro de Categoria */}
              <div className="space-y-2">
                <Label>Categoria</Label>
                <div className="relative">
                  <Input
                    placeholder="Digite para buscar categoria..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    onFocus={() => setCategorySearch("")}
                  />
                  {categorySearch && filteredCategories.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredCategories.map((cat) => (
                        <div
                          key={cat.id}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            if (!selectedCategoryIds.includes(cat.id)) {
                              setSelectedCategoryIds([...selectedCategoryIds, cat.id]);
                            }
                            setCategorySearch("");
                          }}
                        >
                          {cat.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedCategoryIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedCategoryIds.map(id => {
                      const cat = categories?.find(c => c.id === id);
                      return cat ? (
                        <div key={id} className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
                          <span>{cat.name}</span>
                          <button
                            onClick={() => setSelectedCategoryIds(selectedCategoryIds.filter(cid => cid !== id))}
                            className="hover:bg-primary/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

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
                        <div key={id} className="flex items-center gap-1 bg-blue-500 text-white px-3 py-1.5 rounded-md text-sm font-medium shadow-sm">
                          <span>{product?.name}</span>
                          <button
                            onClick={() => setSelectedProductIds(selectedProductIds.filter(pid => pid !== id))}
                            className="hover:bg-blue-600 rounded-full p-0.5 transition-colors"
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
                <div className="flex flex-wrap gap-2 mt-2">
                  {[
                    { value: "BALCAO", label: "Balcão" },
                    { value: "DELIVERY", label: "Delivery" },
                    { value: "A_PRAZO", label: "A Prazo" },
                  ].map((channel) => (
                    <Button
                      key={channel.value}
                      variant={selectedChannels.includes(channel.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (selectedChannels.includes(channel.value)) {
                          setSelectedChannels(selectedChannels.filter(c => c !== channel.value));
                        } else {
                          setSelectedChannels([...selectedChannels, channel.value]);
                        }
                      }}
                    >
                      {channel.label}
                    </Button>
                  ))}
                </div>
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
            {(selectedProductIds.length > 0 || selectedSubcategoryId || selectedChannels.length > 0 || selectedPaymentMethod) && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProductIds([]);
                    setSelectedSubcategoryId(undefined);
                    setSelectedChannels([]);
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
          )}
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
                      // Gerar array de datas ou semanas do período
                      const dates: string[] = [];
                      const weeks: { start: string; end: string; dates: string[] }[] = [];
                      
                      const current = new Date(dateRange.from);
                      const end = new Date(dateRange.to);
                      
                      if (groupBy === 'week') {
                        // Agrupar por semanas
                        let weekStart = new Date(current);
                        let weekDates: string[] = [];
                        
                        while (current <= end) {
                          weekDates.push(current.toISOString().split('T')[0]);
                          
                          // Se é sábado ou último dia do período, fechar a semana
                          if (current.getDay() === 6 || current.getTime() === end.getTime()) {
                            weeks.push({
                              start: weekStart.toISOString().split('T')[0],
                              end: current.toISOString().split('T')[0],
                              dates: [...weekDates]
                            });
                            weekDates = [];
                            current.setDate(current.getDate() + 1);
                            weekStart = new Date(current);
                          } else {
                            current.setDate(current.getDate() + 1);
                          }
                        }
                      } else {
                        // Agrupar por dias (padrão)
                        while (current <= end) {
                          dates.push(current.toISOString().split('T')[0]);
                          current.setDate(current.getDate() + 1);
                        }
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

                      // Função para calcular cor do heatmap (azul)
                      const getHeatmapColor = (quantity: number) => {
                        if (quantity === 0) return "bg-gray-50";
                        const intensity = Math.min(quantity / maxQuantity, 1);
                        if (intensity < 0.2) return "bg-blue-100";
                        if (intensity < 0.4) return "bg-blue-200";
                        if (intensity < 0.6) return "bg-blue-300";
                        if (intensity < 0.8) return "bg-blue-400";
                        return "bg-blue-500 text-white";
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
                              {groupBy === 'week' ? (
                                weeks.map((week, idx) => {
                                  const startDate = new Date(week.start + 'T00:00:00');
                                  const endDate = new Date(week.end + 'T00:00:00');
                                  const startDay = startDate.getDate();
                                  const endDay = endDate.getDate();
                                  const startMonth = startDate.getMonth() + 1;
                                  const endMonth = endDate.getMonth() + 1;
                                  
                                  return (
                                    <th 
                                      key={`week-${idx}`} 
                                      className="border px-2 py-2 text-center min-w-[80px]"
                                    >
                                      <div className="text-xs text-muted-foreground">Semana {idx + 1}</div>
                                      <div className="font-semibold text-xs">
                                        {startMonth === endMonth 
                                          ? `${startDay}-${endDay}/${startMonth}` 
                                          : `${startDay}/${startMonth}-${endDay}/${endMonth}`
                                        }
                                      </div>
                                    </th>
                                  );
                                })
                              ) : (
                                dates.map(date => {
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
                                })
                              )}
                              <th className="border px-3 py-2 text-center font-semibold bg-blue-50">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from(productMap.entries()).map(([productId, product]) => (
                              <tr key={productId}>
                                <td className="sticky left-0 z-10 bg-white border px-3 py-2 font-medium">
                                  {product.name}
                                </td>
                                {groupBy === 'week' ? (
                                  weeks.map((week, idx) => {
                                    // Somar quantidades de todos os dias da semana
                                    let weekQuantity = 0;
                                    let weekRevenue = 0;
                                    week.dates.forEach(date => {
                                      const sale = product.sales.get(date);
                                      if (sale) {
                                        weekQuantity += sale.quantity;
                                        weekRevenue += sale.revenue;
                                      }
                                    });
                                    
                                    return (
                                      <td 
                                        key={`week-${idx}`} 
                                        className={`border px-2 py-2 text-center ${
                                          getHeatmapColor(weekQuantity)
                                        }`}
                                        title={weekQuantity > 0 ? `${weekQuantity} unidades\nR$ ${formatCurrency(weekRevenue)}` : undefined}
                                      >
                                        {weekQuantity > 0 ? weekQuantity : '-'}
                                      </td>
                                    );
                                  })
                                ) : (
                                  dates.map(date => {
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
                                  })
                                )}
                                {/* Coluna Total */}
                                <td className="border px-3 py-2 text-center font-semibold bg-blue-50">
                                  {Array.from(product.sales.values()).reduce((sum, sale) => sum + sale.quantity, 0)}
                                </td>
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
              const margin = totalRevenue > 0 ? ((1 - (totalCost / totalRevenue)) * 100).toFixed(1) : "0.0";

              return (
                <div className="grid gap-4 md:grid-cols-3">
                  {/* Card Faturamento - Verde */}
                  <Card className="border-l-4 border-l-emerald-500 bg-emerald-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-emerald-700">Faturamento Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-emerald-600">
                        R$ {formatCurrency(totalRevenue)}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card Custo - Vermelho */}
                  <Card className="border-l-4 border-l-red-500 bg-red-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-red-700">Custo Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        R$ {formatCurrency(totalCost)}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card Margem - Azul */}
                  <Card className="border-l-4 border-l-blue-500 bg-blue-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-blue-700">Margem Média</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {margin}%
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
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
