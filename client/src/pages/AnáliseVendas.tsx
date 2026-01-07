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
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]); // Vazio - usuário escolhe o período
  const [selectedYears, setSelectedYears] = useState<number[]>([2025]); // Anos disponíveis: 2022-2026
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // Vazio - usuário escolhe os dias
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

  // Estados para comparação de períodos
  const [comparisonPeriod1, setComparisonPeriod1] = useState<{ from: Date; to: Date }>(() => {
    // Período 1: Dezembro 2025 (padrão)
    return {
      from: new Date(2025, 11, 1), // 1º de dezembro
      to: new Date(2025, 11, 31), // 31 de dezembro
    };
  });
  const [comparisonPeriod2, setComparisonPeriod2] = useState<{ from: Date; to: Date }>(() => {
    // Período 2: Novembro 2025 (padrão)
    return {
      from: new Date(2025, 10, 1), // 1º de novembro
      to: new Date(2025, 10, 30), // 30 de novembro
    };
  });
  const [enableComparison, setEnableComparison] = useState(false);
  const [comparisonType, setComparisonType] = useState<"value" | "quantity">("value");

  // Buscar produtos, subcategorias e categorias para filtros
  const { data: products } = trpc.products.list.useQuery(undefined, { enabled: isAdmin });
  const { data: subcategories } = trpc.subcategories.list.useQuery(undefined, { enabled: isAdmin });
  const { data: categories } = trpc.categories.list.useQuery(undefined, { enabled: isAdmin });

  // Calcular dateRange baseado nos filtros de mês/ano/dia
  const dateRange = useMemo(() => {
    if (selectedMonths.length === 0 || selectedYears.length === 0) {
      // Fallback: dezembro 2025
      return { from: new Date(2025, 11, 1), to: new Date(2025, 11, 31) };
    }

    // Gerar todas as combinações de ano/mês/dia selecionadas
    const dates: Date[] = [];
    for (const year of selectedYears) {
      for (const month of selectedMonths) {
        for (const day of selectedDays) {
          dates.push(new Date(year, month - 1, day));
        }
      }
    }

    if (dates.length === 0 || selectedMonths.length === 0) {
      return null; // Retorna null quando não há período selecionado
    }

    // Encontrar menor e maior data
    const from = new Date(Math.min(...dates.map(d => d.getTime())));
    const to = new Date(Math.max(...dates.map(d => d.getTime())));

    return { from, to };
  }, [selectedMonths, selectedYears, selectedDays]);

  // Filtrar produtos e subcategorias baseado na busca
  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
    !selectedProductIds.includes(p.id) // Ocultar produtos já selecionados
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
      startDate: dateRange?.from ?? new Date(), 
      endDate: dateRange?.to ?? new Date(),
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && groupBy === "product" && !!dateRange }
  );

  const { data: quantityData, isLoading: isQuantityLoading } = trpc.salesAnalysis.byQuantity.useQuery(
    { 
      startDate: dateRange?.from ?? new Date(), 
      endDate: dateRange?.to ?? new Date(),
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && groupBy === "product" && !!dateRange }
  );

  const { data: categoryData, isLoading: isCategoryLoading } = trpc.salesAnalysis.byCategoryValue.useQuery(
    { 
      startDate: dateRange?.from ?? new Date(), 
      endDate: dateRange?.to ?? new Date(),
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && groupBy === "product" && !!dateRange }
  );

  // Queries temporais
  const { data: dayDataRaw, isLoading: isDayLoading } = trpc.salesAnalysis.byDay.useQuery(
    { 
      startDate: dateRange?.from ?? new Date(), 
      endDate: dateRange?.to ?? new Date(),
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && groupBy === "day" && !!dateRange }
  );

  // Filtrar dayData considerando apenas os dias selecionados
  const dayData = useMemo(() => {
    if (!dayDataRaw || selectedDays.length === 0) return dayDataRaw;
    
    return dayDataRaw.filter((item: any) => {
      const saleDate = new Date(item.saleDate);
      const day = saleDate.getDate();
      return selectedDays.includes(day);
    });
  }, [dayDataRaw, selectedDays]);

  const { data: weekData, isLoading: isWeekLoading } = trpc.salesAnalysis.byWeek.useQuery(
    { 
      startDate: dateRange?.from ?? new Date(), 
      endDate: dateRange?.to ?? new Date(),
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && groupBy === "week" && !!dateRange }
  );

  const { data: monthData, isLoading: isMonthLoading } = trpc.salesAnalysis.byMonth.useQuery(
    { 
      startDate: dateRange?.from ?? new Date(), 
      endDate: dateRange?.to ?? new Date(),
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && groupBy === "month" && !!dateRange }
  );

  // Query para matriz produto×dia (Evolução Diária)
  const { data: matrixData, isLoading: isMatrixLoading } = trpc.salesAnalysis.byProductAndDate.useQuery(
    { 
      startDate: dateRange?.from ?? new Date(), 
      endDate: dateRange?.to ?? new Date(),
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && !!dateRange }
  );

  // Query para comparação de períodos
  const { data: comparisonData, isLoading: isComparisonLoading } = trpc.salesAnalysis.comparePeriods.useQuery(
    {
      period1: {
        startDate: comparisonPeriod1.from,
        endDate: comparisonPeriod1.to,
      },
      period2: {
        startDate: comparisonPeriod2.from,
        endDate: comparisonPeriod2.to,
      },
      comparisonType: comparisonType,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && enableComparison }
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
            Período selecionado: {selectedMonths.length} mês(es), {selectedYears.length} ano(s), {selectedDays.length} dia(s)
          </div>
        </div>

        {/* Filtros Avançados */}
        <Card className="!bg-gray-100">
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
          <CardContent>
            {/* Seletor de Agrupamento */}
            <div className="mb-4">
              <Label>Agrupar por</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  className={groupBy === "product" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                  variant={groupBy === "product" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGroupBy("product")}
                >
                  Produto
                </Button>
                <Button
                  className={groupBy === "day" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                  variant={groupBy === "day" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGroupBy("day")}
                >
                  Dia
                </Button>
                <Button
                  className={groupBy === "week" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                  variant={groupBy === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGroupBy("week")}
                >
                  Semana
                </Button>
                <Button
                  className={groupBy === "month" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
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
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedMonths.includes(idx + 1)) {
                          setSelectedMonths(selectedMonths.filter(m => m !== idx + 1));
                        } else {
                          setSelectedMonths([...selectedMonths, idx + 1]);
                        }
                      }}
                      className={selectedMonths.includes(idx + 1) ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                    >
                      {month}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Filtro de Ano */}
              <div className="mt-3">
                <Label className="text-sm">Ano(s)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[2022, 2023, 2024, 2025, 2026].map((year) => (
                    <Button
                      key={year}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedYears.includes(year)) {
                          // Não permitir desmarcar se for o único ano selecionado
                          if (selectedYears.length > 1) {
                            setSelectedYears(selectedYears.filter(y => y !== year));
                          }
                        } else {
                          setSelectedYears([...selectedYears, year].sort((a, b) => a - b));
                        }
                      }}
                      className={selectedYears.includes(year) ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                    >
                      {year}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Filtro de Dia do Mês com checkboxes */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Dias do Mês ({selectedDays.length} selecionados)</Label>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDays(Array.from({ length: 31 }, (_, i) => i + 1))}
                      className="h-7 text-xs"
                    >
                      Todos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDays([])}
                      className="h-7 text-xs"
                    >
                      Nenhum
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 mt-2">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <Button
                      key={day}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedDays.includes(day)) {
                          setSelectedDays(selectedDays.filter(d => d !== day));
                        } else {
                          setSelectedDays([...selectedDays, day].sort((a, b) => a - b));
                        }
                      }}
                      className={`h-8 text-xs p-0 ${selectedDays.includes(day) ? "bg-blue-600 text-white hover:bg-blue-700" : ""}`}
                    >
                      {day}
                    </Button>
                  ))}
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
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedChannels.includes(channel.value)) {
                          setSelectedChannels(selectedChannels.filter(c => c !== channel.value));
                        } else {
                          setSelectedChannels([...selectedChannels, channel.value]);
                        }
                      }}
                      className={selectedChannels.includes(channel.value) ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
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
            <TabsTrigger value="comparacao" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Comparar Períodos
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
                      
                      const current = new Date(dateRange?.from ?? new Date());
                      const end = new Date(dateRange?.to ?? new Date());
                      
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
                            {(() => {
                              // Calcular total geral de todas as vendas
                              const grandTotal = Array.from(productMap.values()).reduce(
                                (sum, product) => sum + Array.from(product.sales.values()).reduce((s, sale) => s + sale.quantity, 0),
                                0
                              );
                              
                              return Array.from(productMap.entries()).map(([productId, product]) => {
                                const productTotal = Array.from(product.sales.values()).reduce((sum, sale) => sum + sale.quantity, 0);
                                const productPercent = grandTotal > 0 ? ((productTotal / grandTotal) * 100).toFixed(1) : '0.0';
                                
                                return (
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
                                    {/* Coluna Total com % */}
                                    <td className="border px-3 py-2 text-center font-semibold bg-blue-50">
                                      {productTotal}
                                      <span className="text-xs text-muted-foreground ml-1">({productPercent}%)</span>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
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
                {!dateRange ? (
                  <div className="text-center py-8">
                    <p className="text-lg font-medium text-muted-foreground">Selecione um período para visualizar os dados</p>
                    <p className="text-sm text-muted-foreground mt-2">Use os filtros de Mês acima para escolher o período de análise</p>
                  </div>
                ) : (groupBy === "product" && isValueLoading) || 
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
                          <TableHead className="text-right">Lucro Bruto</TableHead>
                          <TableHead className="text-right">Margem %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {valueData.map((item) => {
                          const totalQty = valueData.reduce((sum, i) => sum + parseFloat(i.totalQuantity), 0);
                          const totalRevenue = valueData.reduce((sum, i) => sum + parseFloat(i.totalRevenue), 0);
                          const totalCost = valueData.reduce((sum, i) => sum + parseFloat(i.totalCost), 0);
                          const totalProfit = totalRevenue - totalCost;
                          
                          const qtyPercent = totalQty > 0 ? ((parseFloat(item.totalQuantity) / totalQty) * 100).toFixed(1) : '0.0';
                          const revenuePercent = totalRevenue > 0 ? ((parseFloat(item.totalRevenue) / totalRevenue) * 100).toFixed(1) : '0.0';
                          const costPercent = totalCost > 0 ? ((parseFloat(item.totalCost) / totalCost) * 100).toFixed(1) : '0.0';
                          const itemProfit = parseFloat(item.totalRevenue) - parseFloat(item.totalCost);
                          const profitPercent = totalProfit > 0 ? ((itemProfit / totalProfit) * 100).toFixed(1) : '0.0';
                          
                          return (
                            <TableRow key={item.productId}>
                              <TableCell className="font-medium">{item.productName}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.totalQuantity)}
                                <span className="text-xs text-muted-foreground ml-1">({qtyPercent}%)</span>
                              </TableCell>
                              <TableCell className="text-right text-emerald-600 font-semibold">
                                R$ {formatCurrency(item.totalRevenue)}
                                <span className="text-xs text-muted-foreground ml-1">({revenuePercent}%)</span>
                              </TableCell>
                              <TableCell className="text-right text-red-600">
                                R$ {formatCurrency(item.totalCost)}
                                <span className="text-xs text-muted-foreground ml-1">({costPercent}%)</span>
                              </TableCell>
                              <TableCell className="text-right text-blue-600 font-semibold">
                                R$ {formatCurrency(itemProfit)}
                                <span className="text-xs text-muted-foreground ml-1">({profitPercent}%)</span>
                              </TableCell>
                              <TableCell className="text-right font-bold">{item.marginPercent}%</TableCell>
                            </TableRow>
                          );
                        })}
                        {/* Linha de Totais */}
                        {(() => {
                          const totals = valueData.reduce((acc, item) => ({
                            qty: acc.qty + parseFloat(item.totalQuantity),
                            revenue: acc.revenue + parseFloat(item.totalRevenue),
                            cost: acc.cost + parseFloat(item.totalCost),
                          }), { qty: 0, revenue: 0, cost: 0 });
                          const profit = totals.revenue - totals.cost;
                          const margin = totals.revenue > 0 ? ((profit / totals.revenue) * 100).toFixed(1) : '0.0';
                          return (
                            <TableRow className="bg-muted/50 font-bold border-t-2">
                              <TableCell>TOTAL ({valueData.length} produtos)</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(totals.qty)}
                                <span className="text-xs text-muted-foreground ml-1">(100%)</span>
                              </TableCell>
                              <TableCell className="text-right text-emerald-600">
                                R$ {formatCurrency(totals.revenue)}
                                <span className="text-xs text-muted-foreground ml-1">(100%)</span>
                              </TableCell>
                              <TableCell className="text-right text-red-600">
                                R$ {formatCurrency(totals.cost)}
                                <span className="text-xs text-muted-foreground ml-1">(100%)</span>
                              </TableCell>
                              <TableCell className="text-right text-blue-600">
                                R$ {formatCurrency(profit)}
                                <span className="text-xs text-muted-foreground ml-1">(100%)</span>
                              </TableCell>
                              <TableCell className="text-right">{margin}%</TableCell>
                            </TableRow>
                          );
                        })()}
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
                          <TableHead className="text-right">Lucro Bruto</TableHead>
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
                              <TableCell className="text-right text-red-600">R$ {formatCurrency(item.totalCost)}</TableCell>
                              <TableCell className="text-right text-blue-600 font-semibold">
                                R$ {formatCurrency(parseFloat(item.totalRevenue) - parseFloat(item.totalCost))}
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
                          <TableHead className="text-right">Lucro Bruto</TableHead>
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
                            <TableCell className="text-right text-red-600">R$ {formatCurrency(item.totalCost)}</TableCell>
                            <TableCell className="text-right text-blue-600 font-semibold">
                              R$ {formatCurrency(parseFloat(item.totalRevenue) - parseFloat(item.totalCost))}
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
                          <TableHead className="text-right">Lucro Bruto</TableHead>
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
                            <TableCell className="text-right text-red-600">R$ {formatCurrency(item.totalCost)}</TableCell>
                            <TableCell className="text-right text-blue-600 font-semibold">
                              R$ {formatCurrency(parseFloat(item.totalRevenue) - parseFloat(item.totalCost))}
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
                          <TableHead className="text-right">Lucro Bruto</TableHead>
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
                            <TableCell className="text-right text-red-600">R$ {formatCurrency(item.totalCost)}</TableCell>
                            <TableCell className="text-right text-blue-600 font-semibold">
                              R$ {formatCurrency(parseFloat(item.totalRevenue) - parseFloat(item.totalCost))}
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

          {/* Comparação de Períodos */}
          <TabsContent value="comparacao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Comparar Períodos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Seletores de Período */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Período 1 */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Período 1</Label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(comparisonPeriod1.from, "dd/MM/yyyy", { locale: ptBR })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={comparisonPeriod1.from}
                            onSelect={(date) => date && setComparisonPeriod1(prev => ({ ...prev, from: date }))}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                      <span className="flex items-center px-2">até</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(comparisonPeriod1.to, "dd/MM/yyyy", { locale: ptBR })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={comparisonPeriod1.to}
                            onSelect={(date) => date && setComparisonPeriod1(prev => ({ ...prev, to: date }))}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Período 2 */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Período 2</Label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(comparisonPeriod2.from, "dd/MM/yyyy", { locale: ptBR })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={comparisonPeriod2.from}
                            onSelect={(date) => date && setComparisonPeriod2(prev => ({ ...prev, from: date }))}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                      <span className="flex items-center px-2">até</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(comparisonPeriod2.to, "dd/MM/yyyy", { locale: ptBR })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={comparisonPeriod2.to}
                            onSelect={(date) => date && setComparisonPeriod2(prev => ({ ...prev, to: date }))}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                {/* Toggle Tipo de Comparação */}
                <div className="flex justify-center gap-2 mb-4">
                  <Button
                    className={comparisonType === "value" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                    variant={comparisonType === "value" ? "default" : "outline"}
                    onClick={() => setComparisonType("value")}
                    size="sm"
                  >
                    Valores (R$)
                  </Button>
                  <Button
                    className={comparisonType === "quantity" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                    variant={comparisonType === "quantity" ? "default" : "outline"}
                    onClick={() => setComparisonType("quantity")}
                    size="sm"
                  >
                    Quantidade (unidades)
                  </Button>
                </div>

                {/* Botão Comparar */}
                <div className="flex justify-center">
                  <Button 
                    onClick={() => setEnableComparison(true)}
                    size="lg"
                    className="px-8"
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Comparar Períodos
                  </Button>
                </div>

                {/* Tabela Comparativa */}
                {enableComparison && (
                  <div className="mt-6">
                    {isComparisonLoading ? (
                      <div className="flex items-center justify-center h-64">
                        <p className="text-muted-foreground">Carregando comparação...</p>
                      </div>
                    ) : !comparisonData || (!comparisonData.period1.length && !comparisonData.period2.length) ? (
                      <div className="flex items-center justify-center h-64">
                        <p className="text-muted-foreground">Nenhum dado disponível para os períodos selecionados</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[200px]">Produto</TableHead>
                              <TableHead className="text-right">Período 1<br/><span className="text-xs text-muted-foreground">{format(comparisonPeriod1.from, "dd/MM", { locale: ptBR })} - {format(comparisonPeriod1.to, "dd/MM", { locale: ptBR })}</span></TableHead>
                              <TableHead className="text-right">Período 2<br/><span className="text-xs text-muted-foreground">{format(comparisonPeriod2.from, "dd/MM", { locale: ptBR })} - {format(comparisonPeriod2.to, "dd/MM", { locale: ptBR })}</span></TableHead>
                              <TableHead className="text-right">Variação</TableHead>
                              <TableHead className="text-right">Crescimento</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              // Determinar qual campo usar baseado no tipo de comparação
                              const valueField = comparisonType === "quantity" ? "totalQuantity" : "totalRevenue";
                              
                              // Criar mapa de produtos do período 1
                              const period1Map = new Map(
                                comparisonData.period1.map(item => [
                                  item.productId,
                                  { name: item.productName, value: parseFloat(item[valueField]) }
                                ])
                              );

                              // Criar mapa de produtos do período 2
                              const period2Map = new Map(
                                comparisonData.period2.map(item => [
                                  item.productId,
                                  { name: item.productName, value: parseFloat(item[valueField]) }
                                ])
                              );

                              // Unir todos os produtos
                              const allProductIds = new Set([
                                ...Array.from(period1Map.keys()),
                                ...Array.from(period2Map.keys())
                              ]);

                              // Criar array de comparação
                              const comparison = Array.from(allProductIds).map(productId => {
                                const p1 = period1Map.get(productId);
                                const p2 = period2Map.get(productId);
                                const value1 = p1?.value || 0;
                                const value2 = p2?.value || 0;
                                const variation = value1 - value2;
                                const growth = value2 > 0 ? ((value1 - value2) / value2) * 100 : (value1 > 0 ? 100 : 0);

                                return {
                                  productId,
                                  productName: p1?.name || p2?.name || "Produto Desconhecido",
                                  value1,
                                  value2,
                                  variation,
                                  growth
                                };
                              });

                              // Ordenar por variação (maior crescimento primeiro)
                              comparison.sort((a, b) => b.variation - a.variation);

                              return comparison.map(item => (
                                <TableRow key={item.productId}>
                                  <TableCell className="font-medium">{item.productName}</TableCell>
                                  <TableCell className="text-right">
                                    {comparisonType === "quantity" 
                                      ? `${item.value1.toFixed(0)} un` 
                                      : `R$ ${formatCurrency(item.value1)}`}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {comparisonType === "quantity" 
                                      ? `${item.value2.toFixed(0)} un` 
                                      : `R$ ${formatCurrency(item.value2)}`}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span className={item.variation >= 0 ? "text-green-600" : "text-red-600"}>
                                      {item.variation >= 0 ? "+" : ""}
                                      {comparisonType === "quantity" 
                                        ? `${Math.abs(item.variation).toFixed(0)} un` 
                                        : `R$ ${formatCurrency(Math.abs(item.variation))}`}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span className={item.growth >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                      {item.growth >= 0 ? "🔺" : "🔻"} {item.growth >= 0 ? "+" : ""}{item.growth.toFixed(1)}%
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
