import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, TrendingUp, Package, Download, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

type SortField = 'productName' | 'totalQuantity' | 'totalRevenue' | 'totalCost' | 'profit' | 'margin' | 'saleDate' | 'dayOfWeek' | 'yearMonth' | 'weekLabel' | 'categoryName';
type SortDir = 'asc' | 'desc';

const SortIcon = ({ field, activeField, activeDir }: { field: SortField; activeField: SortField; activeDir: SortDir }) => {
  if (activeField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
  return activeDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
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
  const [comparisonMode, setComparisonMode] = useState<"previous_year" | "previous_month">("previous_year");

  // Estado de ordenação para a matriz produto×mês
  const [matrixSortField, setMatrixSortField] = useState<string>('total');
  const [matrixSortDir, setMatrixSortDir] = useState<SortDir>('desc');

  const handleMatrixSort = (field: string) => {
    if (matrixSortField === field) {
      setMatrixSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setMatrixSortField(field);
      setMatrixSortDir('desc');
    }
  };

  const MatrixSortIcon = ({ field }: { field: string }) => {
    if (matrixSortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30 inline" />;
    return matrixSortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  // Buscar produtos, subcategorias e categorias para filtros
  const { data: products } = trpc.products.list.useQuery({ activeOnly: false }, { enabled: isAdmin });
  const { data: subcategories } = trpc.subcategories.list.useQuery(undefined, { enabled: isAdmin });
  const { data: categories } = trpc.categories.list.useQuery(undefined, { enabled: isAdmin });

  // Calcular dateRange baseado nos filtros de mês/ano/dia
  const dateRange = useMemo(() => {
    if (selectedMonths.length === 0 || selectedYears.length === 0) {
      // Fallback: dezembro 2025
      return { from: new Date(2025, 11, 1), to: new Date(2025, 11, 31) };
    }

    // Se nenhum dia específico selecionado ("Todos os dias"), usar primeiro e último dia dos meses
    if (selectedDays.length === 0) {
      // Encontrar menor ano/mês e maior ano/mês
      const sortedYears = [...selectedYears].sort((a, b) => a - b);
      const sortedMonths = [...selectedMonths].sort((a, b) => a - b);
      
      const minYear = sortedYears[0];
      const maxYear = sortedYears[sortedYears.length - 1];
      const minMonth = sortedMonths[0];
      const maxMonth = sortedMonths[sortedMonths.length - 1];
      
      // Primeiro dia do menor mês/ano
      const from = new Date(minYear, minMonth - 1, 1);
      // Último dia do maior mês/ano
      const lastDay = new Date(maxYear, maxMonth, 0).getDate();
      const to = new Date(maxYear, maxMonth - 1, lastDay);
      
      return { from, to };
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

    if (dates.length === 0) {
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

  const { data: categoryDataRaw, isLoading: isCategoryLoading } = trpc.salesAnalysis.byCategoryValue.useQuery(
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

  // Query para resumo usando sales.finalAmount (valor correto para totais)
  // Quando filtro de produto é aplicado, calcula apenas para produtos selecionados
  const { data: summaryData, isLoading: isSummaryLoading } = trpc.salesAnalysis.summary.useQuery(
    { 
      startDate: dateRange?.from ?? new Date(), 
      endDate: dateRange?.to ?? new Date(),
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
      paymentMethod: selectedPaymentMethod,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
    },
    { enabled: isAdmin && !!dateRange }
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

  // Query para matriz produto×dia (Evolução Diária) - movido para antes do monthData pois é usado no filtro
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

  const { data: monthDataRaw, isLoading: isMonthLoading } = trpc.salesAnalysis.byMonth.useQuery(
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

  // Filtrar monthData considerando meses/anos selecionados e recalcular se dias específicos foram selecionados
  const monthData = useMemo(() => {
    if (!monthDataRaw) return monthDataRaw;
    
    // Primeiro filtrar apenas os meses/anos selecionados
    let filtered = monthDataRaw.filter((item: any) => {
      const [year, month] = item.yearMonth.split('-').map(Number);
      return selectedYears.includes(year) && selectedMonths.includes(month);
    });
    
    // Se dias específicos foram selecionados, precisamos recalcular usando matrixData
    if (selectedDays.length > 0 && matrixData && matrixData.length > 0) {
      // Filtrar matrixData pelos filtros selecionados
      const filteredMatrix = matrixData.filter((row: any) => {
        const saleDate = new Date(row.saleDate + 'T00:00:00');
        const saleYear = saleDate.getFullYear();
        const saleMonth = saleDate.getMonth() + 1;
        const saleDay = saleDate.getDate();
        
        return selectedYears.includes(saleYear) && 
               selectedMonths.includes(saleMonth) && 
               selectedDays.includes(saleDay);
      });
      
      // Agrupar por mês
      const monthsMap = new Map<string, { totalQuantity: number; totalRevenue: number; totalCost: number }>();
      
      filteredMatrix.forEach((row: any) => {
        const saleDate = new Date(row.saleDate + 'T00:00:00');
        const yearMonth = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthsMap.has(yearMonth)) {
          monthsMap.set(yearMonth, { totalQuantity: 0, totalRevenue: 0, totalCost: 0 });
        }
        const data = monthsMap.get(yearMonth)!;
        data.totalQuantity += parseFloat(row.quantity);
        data.totalRevenue += parseFloat(row.revenue);
        data.totalCost += parseFloat(row.cost);
      });
      
      // Converter para array no formato esperado
      filtered = Array.from(monthsMap.entries()).map(([yearMonth, data]) => {
        const [year, month] = yearMonth.split('-').map(Number);
        const totalProfit = data.totalRevenue - data.totalCost;
        return {
          yearMonth,
          year,
          month,
          totalQuantity: data.totalQuantity.toString(),
          totalRevenue: data.totalRevenue.toString(),
          totalCost: data.totalCost.toString(),
          totalProfit: totalProfit.toString(),
          marginPercent: data.totalRevenue > 0 
            ? ((1 - data.totalCost / data.totalRevenue) * 100).toFixed(1)
            : '0.0'
        };
      }).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    }
    
    return filtered;
  }, [monthDataRaw, selectedYears, selectedMonths, selectedDays, matrixData]);

  // Filtrar categoryData considerando meses/anos/dias selecionados
  const categoryData = useMemo(() => {
    if (!matrixData || matrixData.length === 0) return categoryDataRaw;
    
    // Filtrar matrixData pelos meses/anos/dias selecionados
    const filteredMatrix = matrixData.filter((row: any) => {
      const saleDate = new Date(row.saleDate + 'T00:00:00');
      const saleYear = saleDate.getFullYear();
      const saleMonth = saleDate.getMonth() + 1;
      const saleDay = saleDate.getDate();
      
      const matchesYearMonth = selectedYears.includes(saleYear) && selectedMonths.includes(saleMonth);
      const matchesDay = selectedDays.length === 0 || selectedDays.includes(saleDay);
      
      return matchesYearMonth && matchesDay;
    });
    
    // Agrupar por categoria
    const categoryMap = new Map<number, { categoryId: number; categoryName: string; totalQuantity: number; totalRevenue: number; totalCost: number }>();
    
    filteredMatrix.forEach((row: any) => {
      const catId = row.categoryId || 0;
      const catName = row.categoryName || 'Sem Categoria';
      
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, { categoryId: catId, categoryName: catName, totalQuantity: 0, totalRevenue: 0, totalCost: 0 });
      }
      const data = categoryMap.get(catId)!;
      data.totalQuantity += parseFloat(row.quantity);
      data.totalRevenue += parseFloat(row.revenue);
      data.totalCost += parseFloat(row.cost);
    });
    
    // Converter para array no formato esperado
    return Array.from(categoryMap.values()).map(data => ({
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      totalQuantity: data.totalQuantity.toString(),
      totalRevenue: data.totalRevenue.toString(),
      totalCost: data.totalCost.toString(),
      marginPercent: data.totalRevenue > 0 
        ? ((1 - data.totalCost / data.totalRevenue) * 100).toFixed(1)
        : '0.0'
    })).sort((a, b) => parseFloat(b.totalRevenue) - parseFloat(a.totalRevenue));
  }, [categoryDataRaw, matrixData, selectedYears, selectedMonths, selectedDays]);

  // Dados de categoria agrupados por mês/ano para visualização lado a lado
  const categoryDataByMonth = useMemo(() => {
    if (!matrixData || matrixData.length === 0) return null;
    
    // Filtrar matrixData pelos meses/anos/dias selecionados
    const filteredMatrix = matrixData.filter((row: any) => {
      const saleDate = new Date(row.saleDate + 'T00:00:00');
      const saleYear = saleDate.getFullYear();
      const saleMonth = saleDate.getMonth() + 1;
      const saleDay = saleDate.getDate();
      
      const matchesYearMonth = selectedYears.includes(saleYear) && selectedMonths.includes(saleMonth);
      const matchesDay = selectedDays.length === 0 || selectedDays.includes(saleDay);
      
      return matchesYearMonth && matchesDay;
    });
    
    // Estrutura: Map<yearMonth, Map<categoryId, data>>
    const monthCategoryMap = new Map<string, Map<number, { categoryId: number; categoryName: string; totalQuantity: number; totalRevenue: number; totalCost: number }>>();
    
    // Coletar todos os períodos (ano-mês) únicos
    const allPeriods = new Set<string>();
    const allCategories = new Map<number, string>(); // categoryId -> categoryName
    
    filteredMatrix.forEach((row: any) => {
      const saleDate = new Date(row.saleDate + 'T00:00:00');
      const yearMonth = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
      const catId = row.categoryId || 0;
      const catName = row.categoryName || 'Sem Categoria';
      
      allPeriods.add(yearMonth);
      allCategories.set(catId, catName);
      
      if (!monthCategoryMap.has(yearMonth)) {
        monthCategoryMap.set(yearMonth, new Map());
      }
      
      const categoryMap = monthCategoryMap.get(yearMonth)!;
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, { categoryId: catId, categoryName: catName, totalQuantity: 0, totalRevenue: 0, totalCost: 0 });
      }
      
      const data = categoryMap.get(catId)!;
      data.totalQuantity += parseFloat(row.quantity);
      data.totalRevenue += parseFloat(row.revenue);
      data.totalCost += parseFloat(row.cost);
    });
    
    // Ordenar períodos cronologicamente
    const sortedPeriods = Array.from(allPeriods).sort();
    
    // Ordenar categorias por faturamento total (soma de todos os meses)
    const categoryTotals = new Map<number, number>();
    monthCategoryMap.forEach(categoryMap => {
      categoryMap.forEach((data, catId) => {
        categoryTotals.set(catId, (categoryTotals.get(catId) || 0) + data.totalRevenue);
      });
    });
    const sortedCategories = Array.from(allCategories.entries())
      .sort((a, b) => (categoryTotals.get(b[0]) || 0) - (categoryTotals.get(a[0]) || 0));
    
    return {
      periods: sortedPeriods,
      categories: sortedCategories, // [categoryId, categoryName][]
      data: monthCategoryMap // Map<yearMonth, Map<categoryId, data>>
    };
  }, [matrixData, selectedYears, selectedMonths, selectedDays]);

  // Calcular períodos de comparação baseado nos filtros selecionados
  const comparisonPeriods = useMemo(() => {
    if (!dateRange || selectedMonths.length === 0 || selectedYears.length === 0) {
      return null;
    }
    
    // Período atual: baseado nos filtros selecionados
    const currentPeriod = {
      from: dateRange.from,
      to: dateRange.to
    };
    
    // Período de comparação: calculado automaticamente
    let comparePeriod: { from: Date; to: Date };
    
    if (comparisonMode === "previous_year") {
      // Mesmo período do ano anterior
      comparePeriod = {
        from: new Date(currentPeriod.from.getFullYear() - 1, currentPeriod.from.getMonth(), currentPeriod.from.getDate()),
        to: new Date(currentPeriod.to.getFullYear() - 1, currentPeriod.to.getMonth(), currentPeriod.to.getDate())
      };
    } else {
      // Mês anterior (ou período anterior equivalente)
      const monthDiff = selectedMonths.length;
      comparePeriod = {
        from: new Date(currentPeriod.from.getFullYear(), currentPeriod.from.getMonth() - monthDiff, currentPeriod.from.getDate()),
        to: new Date(currentPeriod.to.getFullYear(), currentPeriod.to.getMonth() - monthDiff, currentPeriod.to.getDate())
      };
    }
    
    return {
      current: currentPeriod,
      compare: comparePeriod
    };
  }, [dateRange, selectedMonths, selectedYears, comparisonMode]);

  // Query para comparação de períodos (usando períodos calculados automaticamente)
  const { data: comparisonData, isLoading: isComparisonLoading } = trpc.salesAnalysis.comparePeriods.useQuery(
    {
      period1: {
        startDate: comparisonPeriods?.current.from ?? new Date(),
        endDate: comparisonPeriods?.current.to ?? new Date(),
      },
      period2: {
        startDate: comparisonPeriods?.compare.from ?? new Date(),
        endDate: comparisonPeriods?.compare.to ?? new Date(),
      },
      comparisonType: comparisonType,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      subcategoryId: selectedSubcategoryId,
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
      paymentMethod: selectedPaymentMethod,
    },
    { enabled: isAdmin && enableComparison && !!comparisonPeriods }
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
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                          onClick={() => {
                            if (!selectedProductIds.includes(prod.id)) {
                              setSelectedProductIds([...selectedProductIds, prod.id]);
                            }
                            setProductSearch("");
                          }}
                        >
                          <span className={prod.active ? '' : 'text-gray-400'}>{prod.name}</span>
                          {!prod.active && <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Inativo</span>}
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
                    { value: "SALAO", label: "Salão" },
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
              Análise de Produto
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

          {/* NOVA ABA: Análise de Produto */}
          <TabsContent value="evolucao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Análise de Vendas por Produto</CardTitle>
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
                      // Gerar array de datas, semanas ou meses do período
                      const dates: string[] = [];
                      const weeks: { start: string; end: string; dates: string[] }[] = [];
                      const months: { yearMonth: string; label: string; dates: string[] }[] = [];
                      
                      const current = new Date(dateRange?.from ?? new Date());
                      const end = new Date(dateRange?.to ?? new Date());
                      
                      if (groupBy === 'month') {
                        // Agrupar por meses - APENAS os meses/anos selecionados
                        const monthsMap = new Map<string, string[]>();
                        const tempCurrent = new Date(current);
                        
                        while (tempCurrent <= end) {
                          const currentYear = tempCurrent.getFullYear();
                          const currentMonth = tempCurrent.getMonth() + 1; // 1-12
                          
                          // Verificar se este mês/ano está nos filtros selecionados
                          if (selectedYears.includes(currentYear) && selectedMonths.includes(currentMonth)) {
                            const yearMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
                            if (!monthsMap.has(yearMonth)) {
                              monthsMap.set(yearMonth, []);
                            }
                            monthsMap.get(yearMonth)!.push(tempCurrent.toISOString().split('T')[0]);
                          }
                          tempCurrent.setDate(tempCurrent.getDate() + 1);
                        }
                        
                        // Converter para array ordenado
                        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                        Array.from(monthsMap.entries())
                          .sort((a, b) => a[0].localeCompare(b[0]))
                          .forEach(([yearMonth, monthDates]) => {
                            const [year, month] = yearMonth.split('-');
                            months.push({
                              yearMonth,
                              label: `${monthNames[parseInt(month) - 1]}/${year}`,
                              dates: monthDates
                            });
                          });
                      } else if (groupBy === 'week') {
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

                      // Filtrar dados para incluir apenas as datas que correspondem aos filtros selecionados
                      const filteredMatrixData = matrixData.filter(row => {
                        const saleDate = new Date(row.saleDate + 'T00:00:00');
                        const saleYear = saleDate.getFullYear();
                        const saleMonth = saleDate.getMonth() + 1; // 1-12
                        const saleDay = saleDate.getDate();
                        
                        // Verificar se o ano e mês estão nos filtros
                        if (!selectedYears.includes(saleYear) || !selectedMonths.includes(saleMonth)) {
                          return false;
                        }
                        
                        // Se dias específicos foram selecionados, verificar o dia
                        if (selectedDays.length > 0 && !selectedDays.includes(saleDay)) {
                          return false;
                        }
                        
                        return true;
                      });

                      // Agrupar dados por produto
                      const productMap = new Map<number, { name: string; sales: Map<string, { quantity: number; revenue: number }> }>();
                      
                      filteredMatrixData.forEach(row => {
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
                              {groupBy === 'month' ? (
                                months.map((month) => (
                                  <th 
                                    key={month.yearMonth} 
                                    className="border px-3 py-2 text-center min-w-[100px] bg-purple-50 cursor-pointer hover:bg-purple-100 select-none"
                                    onClick={() => handleMatrixSort(month.yearMonth)}
                                  >
                                    <div className="font-semibold flex items-center justify-center">{month.label}<MatrixSortIcon field={month.yearMonth} /></div>
                                  </th>
                                ))
                              ) : groupBy === 'week' ? (
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
                              <th className="border px-3 py-2 text-center font-semibold bg-blue-50 cursor-pointer hover:bg-blue-100 select-none" onClick={() => handleMatrixSort('total')}>
                                <span className="flex items-center justify-center">Total<MatrixSortIcon field="total" /></span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              // Calcular total geral de todas as vendas
                              const grandTotal = Array.from(productMap.values()).reduce(
                                (sum, product) => sum + Array.from(product.sales.values()).reduce((s, sale) => s + sale.quantity, 0),
                                0
                              );
                              
                              // Preparar array com totais para ordenação
                              const productEntries = Array.from(productMap.entries()).map(([productId, product]) => {
                                const productTotal = Array.from(product.sales.values()).reduce((sum, sale) => sum + sale.quantity, 0);
                                // Calcular valor por mês para ordenação
                                const monthTotals: Record<string, number> = {};
                                if (groupBy === 'month') {
                                  months.forEach(month => {
                                    let qty = 0;
                                    month.dates.forEach(date => {
                                      const sale = product.sales.get(date);
                                      if (sale) qty += sale.quantity;
                                    });
                                    monthTotals[month.yearMonth] = qty;
                                  });
                                }
                                return { productId, product, productTotal, monthTotals };
                              });

                              // Ordenar
                              productEntries.sort((a, b) => {
                                let valA: number, valB: number;
                                if (matrixSortField === 'total') {
                                  valA = a.productTotal;
                                  valB = b.productTotal;
                                } else {
                                  valA = a.monthTotals[matrixSortField] || 0;
                                  valB = b.monthTotals[matrixSortField] || 0;
                                }
                                return matrixSortDir === 'asc' ? valA - valB : valB - valA;
                              });

                              return productEntries.map(({ productId, product, productTotal }) => {
                                const productPercent = grandTotal > 0 ? ((productTotal / grandTotal) * 100).toFixed(1) : '0.0';
                                
                                return (
                                  <tr key={productId}>
                                    <td className="sticky left-0 z-10 bg-white border px-3 py-2 font-medium">
                                      {product.name}
                                    </td>
                                    {groupBy === 'month' ? (
                                      months.map((month) => {
                                        // Somar quantidades de todos os dias do mês
                                        let monthQuantity = 0;
                                        let monthRevenue = 0;
                                        month.dates.forEach(date => {
                                          const sale = product.sales.get(date);
                                          if (sale) {
                                            monthQuantity += sale.quantity;
                                            monthRevenue += sale.revenue;
                                          }
                                        });
                                        
                                        return (
                                          <td 
                                            key={month.yearMonth} 
                                            className={`border px-3 py-2 text-center ${
                                              getHeatmapColor(monthQuantity)
                                            }`}
                                            title={monthQuantity > 0 ? `${monthQuantity} unidades\nR$ ${formatCurrency(monthRevenue)}` : undefined}
                                          >
                                            {monthQuantity > 0 ? monthQuantity : '-'}
                                          </td>
                                        );
                                      })
                                    ) : groupBy === 'week' ? (
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
              let currentData = 
                groupBy === "product" ? valueData :
                groupBy === "day" ? dayData :
                groupBy === "week" ? weekData :
                groupBy === "month" ? monthData : null;
              
              if (!currentData || currentData.length === 0) return null;

              // Usar summaryData.totalRevenue para o faturamento correto (inclui vendas sem itens)
              // Manter custo calculado dos itens (não temos custo para vendas sem itens)
              const totalRevenue = summaryData?.totalRevenue ?? currentData.reduce((sum, item) => sum + parseFloat(item.totalRevenue), 0);
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
                <CardTitle>Desempenho por Categoria {categoryDataByMonth && categoryDataByMonth.periods.length > 1 ? '(por Mês)' : ''}</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                {isCategoryLoading || isMatrixLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : categoryDataByMonth && categoryDataByMonth.periods.length > 1 ? (
                  /* Visualização por mês quando há múltiplos períodos */
                  <div className="space-y-6">
                    {/* Tabela comparativa por mês */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="border px-3 py-2 text-left font-semibold sticky left-0 bg-muted/50 z-10">Categoria</th>
                            {categoryDataByMonth.periods.map(period => (
                              <th key={period} colSpan={4} className="border px-3 py-2 text-center font-semibold bg-blue-50">
                                {formatMonthYear(period)}
                              </th>
                            ))}
                            <th colSpan={4} className="border px-3 py-2 text-center font-semibold bg-emerald-50">Total Geral</th>
                          </tr>
                          <tr className="bg-muted/30 text-xs">
                            <th className="border px-2 py-1 sticky left-0 bg-muted/30 z-10"></th>
                            {categoryDataByMonth.periods.map(period => (
                              <>
                                <th key={`${period}-qty`} className="border px-2 py-1 text-right">Qtd</th>
                                <th key={`${period}-fat`} className="border px-2 py-1 text-right">Faturamento</th>
                                <th key={`${period}-lucro`} className="border px-2 py-1 text-right">Lucro</th>
                                <th key={`${period}-mg`} className="border px-2 py-1 text-right">Mg%</th>
                              </>
                            ))}
                            <th className="border px-2 py-1 text-right">Qtd</th>
                            <th className="border px-2 py-1 text-right">Faturamento</th>
                            <th className="border px-2 py-1 text-right">Lucro</th>
                            <th className="border px-2 py-1 text-right">Mg%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryDataByMonth.categories.map(([catId, catName]) => {
                            // Calcular totais da categoria
                            let totalQty = 0, totalRevenue = 0, totalCost = 0;
                            categoryDataByMonth.periods.forEach(period => {
                              const periodData = categoryDataByMonth.data.get(period);
                              const catData = periodData?.get(catId);
                              if (catData) {
                                totalQty += catData.totalQuantity;
                                totalRevenue += catData.totalRevenue;
                                totalCost += catData.totalCost;
                              }
                            });
                            const totalProfit = totalRevenue - totalCost;
                            const totalMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';
                            
                            return (
                              <tr key={catId} className="hover:bg-muted/20">
                                <td className="border px-3 py-2 font-medium sticky left-0 bg-white z-10">{catName}</td>
                                {categoryDataByMonth.periods.map(period => {
                                  const periodData = categoryDataByMonth.data.get(period);
                                  const catData = periodData?.get(catId);
                                  const qty = catData?.totalQuantity || 0;
                                  const revenue = catData?.totalRevenue || 0;
                                  const cost = catData?.totalCost || 0;
                                  const profit = revenue - cost;
                                  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0';
                                  
                                  return (
                                    <>
                                      <td key={`${period}-${catId}-qty`} className="border px-2 py-1 text-right text-xs">
                                        {qty > 0 ? formatCurrency(qty) : '-'}
                                      </td>
                                      <td key={`${period}-${catId}-fat`} className="border px-2 py-1 text-right text-xs text-emerald-600">
                                        {revenue > 0 ? `R$ ${formatCurrency(revenue)}` : '-'}
                                      </td>
                                      <td key={`${period}-${catId}-lucro`} className="border px-2 py-1 text-right text-xs text-blue-600">
                                        {revenue > 0 ? `R$ ${formatCurrency(profit)}` : '-'}
                                      </td>
                                      <td key={`${period}-${catId}-mg`} className="border px-2 py-1 text-right text-xs font-semibold">
                                        {revenue > 0 ? `${margin}%` : '-'}
                                      </td>
                                    </>
                                  );
                                })}
                                {/* Totais da categoria */}
                                <td className="border px-2 py-1 text-right text-xs font-semibold bg-emerald-50">
                                  {formatCurrency(totalQty)}
                                </td>
                                <td className="border px-2 py-1 text-right text-xs font-semibold text-emerald-600 bg-emerald-50">
                                  R$ {formatCurrency(totalRevenue)}
                                </td>
                                <td className="border px-2 py-1 text-right text-xs font-semibold text-blue-600 bg-emerald-50">
                                  R$ {formatCurrency(totalProfit)}
                                </td>
                                <td className="border px-2 py-1 text-right text-xs font-bold bg-emerald-50">
                                  {totalMargin}%
                                </td>
                              </tr>
                            );
                          })}
                          {/* Linha de totais por período */}
                          <tr className="bg-muted/50 font-semibold border-t-2">
                            <td className="border px-3 py-2 sticky left-0 bg-muted/50 z-10">TOTAL</td>
                            {categoryDataByMonth.periods.map(period => {
                              const periodData = categoryDataByMonth.data.get(period);
                              let periodQty = 0, periodRevenue = 0, periodCost = 0;
                              periodData?.forEach(catData => {
                                periodQty += catData.totalQuantity;
                                periodRevenue += catData.totalRevenue;
                                periodCost += catData.totalCost;
                              });
                              const periodProfit = periodRevenue - periodCost;
                              const periodMargin = periodRevenue > 0 ? ((periodProfit / periodRevenue) * 100).toFixed(1) : '0.0';
                              
                              return (
                                <>
                                  <td key={`${period}-total-qty`} className="border px-2 py-1 text-right text-xs">
                                    {formatCurrency(periodQty)}
                                  </td>
                                  <td key={`${period}-total-fat`} className="border px-2 py-1 text-right text-xs text-emerald-600">
                                    R$ {formatCurrency(periodRevenue)}
                                  </td>
                                  <td key={`${period}-total-lucro`} className="border px-2 py-1 text-right text-xs text-blue-600">
                                    R$ {formatCurrency(periodProfit)}
                                  </td>
                                  <td key={`${period}-total-mg`} className="border px-2 py-1 text-right text-xs font-bold">
                                    {periodMargin}%
                                  </td>
                                </>
                              );
                            })}
                            {/* Total geral */}
                            {(() => {
                              let grandQty = 0, grandRevenue = 0, grandCost = 0;
                              categoryDataByMonth.data.forEach(periodData => {
                                periodData.forEach(catData => {
                                  grandQty += catData.totalQuantity;
                                  grandRevenue += catData.totalRevenue;
                                  grandCost += catData.totalCost;
                                });
                              });
                              const grandProfit = grandRevenue - grandCost;
                              const grandMargin = grandRevenue > 0 ? ((grandProfit / grandRevenue) * 100).toFixed(1) : '0.0';
                              return (
                                <>
                                  <td className="border px-2 py-1 text-right text-xs font-bold bg-emerald-100">
                                    {formatCurrency(grandQty)}
                                  </td>
                                  <td className="border px-2 py-1 text-right text-xs font-bold text-emerald-700 bg-emerald-100">
                                    R$ {formatCurrency(grandRevenue)}
                                  </td>
                                  <td className="border px-2 py-1 text-right text-xs font-bold text-blue-700 bg-emerald-100">
                                    R$ {formatCurrency(grandProfit)}
                                  </td>
                                  <td className="border px-2 py-1 text-right text-xs font-bold bg-emerald-100">
                                    {grandMargin}%
                                  </td>
                                </>
                              );
                            })()}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : categoryData && categoryData.length > 0 ? (
                  /* Visualização simples quando há apenas um período */
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
                <p className="text-sm text-muted-foreground">
                  Compara o período selecionado nos filtros acima com um período anterior equivalente
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Informação dos períodos */}
                {!comparisonPeriods ? (
                  <div className="text-center py-8 bg-muted/30 rounded-lg">
                    <p className="text-lg font-medium text-muted-foreground">Selecione um período nos filtros acima</p>
                    <p className="text-sm text-muted-foreground mt-2">Escolha mês(es) e ano(s) para habilitar a comparação</p>
                  </div>
                ) : (
                  <>
                    {/* Períodos calculados automaticamente */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <Label className="text-base font-semibold text-blue-800">Período Atual (Selecionado)</Label>
                        <p className="text-lg font-bold text-blue-900 mt-2">
                          {format(comparisonPeriods.current.from, "dd/MM/yyyy", { locale: ptBR })} - {format(comparisonPeriods.current.to, "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <Label className="text-base font-semibold text-amber-800">Período de Comparação</Label>
                        <p className="text-lg font-bold text-amber-900 mt-2">
                          {format(comparisonPeriods.compare.from, "dd/MM/yyyy", { locale: ptBR })} - {format(comparisonPeriods.compare.to, "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    {/* Seletor de modo de comparação */}
                    <div className="flex flex-col items-center gap-3">
                      <Label className="text-sm font-medium">Comparar com:</Label>
                      <div className="flex gap-2">
                        <Button
                          className={comparisonMode === "previous_year" ? "bg-amber-600 text-white hover:bg-amber-700" : ""}
                          variant={comparisonMode === "previous_year" ? "default" : "outline"}
                          onClick={() => { setComparisonMode("previous_year"); setEnableComparison(false); }}
                          size="sm"
                        >
                          Ano Anterior
                        </Button>
                        <Button
                          className={comparisonMode === "previous_month" ? "bg-amber-600 text-white hover:bg-amber-700" : ""}
                          variant={comparisonMode === "previous_month" ? "default" : "outline"}
                          onClick={() => { setComparisonMode("previous_month"); setEnableComparison(false); }}
                          size="sm"
                        >
                          Período Anterior
                        </Button>
                      </div>
                    </div>

                    {/* Toggle Tipo de Comparação */}
                    <div className="flex flex-col items-center gap-3">
                      <Label className="text-sm font-medium">Métrica:</Label>
                      <div className="flex gap-2">
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
                    </div>

                    {/* Botão Comparar */}
                    <div className="flex justify-center">
                      <Button 
                        onClick={() => setEnableComparison(true)}
                        size="lg"
                        className="px-8"
                        disabled={!comparisonPeriods}
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
                                  <TableHead className="text-right bg-blue-50">
                                    Período Atual<br/>
                                    <span className="text-xs text-muted-foreground">
                                      {format(comparisonPeriods.current.from, "dd/MM/yy", { locale: ptBR })} - {format(comparisonPeriods.current.to, "dd/MM/yy", { locale: ptBR })}
                                    </span>
                                  </TableHead>
                                  <TableHead className="text-right bg-amber-50">
                                    {comparisonMode === "previous_year" ? "Ano Anterior" : "Período Anterior"}<br/>
                                    <span className="text-xs text-muted-foreground">
                                      {format(comparisonPeriods.compare.from, "dd/MM/yy", { locale: ptBR })} - {format(comparisonPeriods.compare.to, "dd/MM/yy", { locale: ptBR })}
                                    </span>
                                  </TableHead>
                                  <TableHead className="text-right">Variação</TableHead>
                                  <TableHead className="text-right">Crescimento</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(() => {
                                  // Determinar qual campo usar baseado no tipo de comparação
                                  const valueField = comparisonType === "quantity" ? "totalQuantity" : "totalRevenue";
                                  
                                  // Criar mapa de produtos do período atual (period1)
                                  const period1Map = new Map(
                                    comparisonData.period1.map(item => [
                                      item.productId,
                                      { name: item.productName, value: parseFloat(item[valueField]) }
                                    ])
                                  );

                                  // Criar mapa de produtos do período de comparação (period2)
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

                                  // Calcular totais - usar period1Total/period2Total para valores (finalAmount), soma para quantidade
                                  const itemTotals = comparison.reduce((acc, item) => ({
                                    value1: acc.value1 + item.value1,
                                    value2: acc.value2 + item.value2
                                  }), { value1: 0, value2: 0 });
                                  
                                  // Para valores, usar os totais do backend (finalAmount); para quantidade, usar soma dos itens
                                  const totals = comparisonType === "quantity" 
                                    ? itemTotals 
                                    : {
                                        value1: comparisonData.period1Total?.revenue ?? itemTotals.value1,
                                        value2: comparisonData.period2Total?.revenue ?? itemTotals.value2
                                      };
                                  const totalVariation = totals.value1 - totals.value2;
                                  const totalGrowth = totals.value2 > 0 ? ((totals.value1 - totals.value2) / totals.value2) * 100 : (totals.value1 > 0 ? 100 : 0);

                                  return (
                                    <>
                                      {comparison.map(item => (
                                        <TableRow key={item.productId}>
                                          <TableCell className="font-medium">{item.productName}</TableCell>
                                          <TableCell className="text-right bg-blue-50/50">
                                            {comparisonType === "quantity" 
                                              ? `${item.value1.toFixed(0)} un` 
                                              : `R$ ${formatCurrency(item.value1)}`}
                                          </TableCell>
                                          <TableCell className="text-right bg-amber-50/50">
                                            {comparisonType === "quantity" 
                                              ? `${item.value2.toFixed(0)} un` 
                                              : `R$ ${formatCurrency(item.value2)}`}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <span className={item.variation >= 0 ? "text-green-600" : "text-red-600"}>
                                              {item.variation >= 0 ? "+" : ""}
                                              {comparisonType === "quantity" 
                                                ? `${item.variation.toFixed(0)} un` 
                                                : `R$ ${formatCurrency(item.variation)}`}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <span className={item.growth >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                              {item.growth >= 0 ? "🔺" : "🔻"} {item.growth >= 0 ? "+" : ""}{item.growth.toFixed(1)}%
                                            </span>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                      {/* Linha de totais */}
                                      <TableRow className="bg-muted/50 font-bold border-t-2">
                                        <TableCell>TOTAL ({comparison.length} produtos)</TableCell>
                                        <TableCell className="text-right bg-blue-100">
                                          {comparisonType === "quantity" 
                                            ? `${totals.value1.toFixed(0)} un` 
                                            : `R$ ${formatCurrency(totals.value1)}`}
                                        </TableCell>
                                        <TableCell className="text-right bg-amber-100">
                                          {comparisonType === "quantity" 
                                            ? `${totals.value2.toFixed(0)} un` 
                                            : `R$ ${formatCurrency(totals.value2)}`}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <span className={totalVariation >= 0 ? "text-green-600" : "text-red-600"}>
                                            {totalVariation >= 0 ? "+" : ""}
                                            {comparisonType === "quantity" 
                                              ? `${totalVariation.toFixed(0)} un` 
                                              : `R$ ${formatCurrency(totalVariation)}`}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <span className={totalGrowth >= 0 ? "text-green-700 font-bold text-lg" : "text-red-700 font-bold text-lg"}>
                                            {totalGrowth >= 0 ? "🔺" : "🔻"} {totalGrowth >= 0 ? "+" : ""}{totalGrowth.toFixed(1)}%
                                          </span>
                                        </TableCell>
                                      </TableRow>
                                    </>
                                  );
                                })()}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
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
