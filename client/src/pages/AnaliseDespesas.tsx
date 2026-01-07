import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { DollarSign, FileText, TrendingDown, Calendar, Building2, Filter, X } from "lucide-react";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function AnaliseDespesas() {
  // Filtros
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([currentMonth]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [activeTab, setActiveTab] = useState("categoria");

  // Calcular datas baseado nos filtros
  const { startDate, endDate } = useMemo(() => {
    if (selectedMonths.length === 0) {
      return { startDate: undefined, endDate: undefined };
    }
    
    const minMonth = Math.min(...selectedMonths);
    const maxMonth = Math.max(...selectedMonths);
    
    const start = `${selectedYear}-${String(minMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(selectedYear, maxMonth, 0).getDate();
    const end = `${selectedYear}-${String(maxMonth).padStart(2, '0')}-${lastDay}`;
    
    return { startDate: start, endDate: end };
  }, [selectedYear, selectedMonths]);

  // Queries
  const { data: categories } = trpc.expenses.categories.list.useQuery();
  const { data: suppliers } = trpc.partners.list.useQuery({ partnerType: "SUPPLIER" });

  const queryParams = {
    startDate,
    endDate,
    categoryId: selectedCategoryId || undefined,
    supplierId: selectedSupplierId || undefined,
  };

  const { data: summaryData, isLoading: isSummaryLoading } = trpc.expenseAnalysis.summary.useQuery(queryParams);
  const { data: categoryData, isLoading: isCategoryLoading } = trpc.expenseAnalysis.byCategory.useQuery(queryParams);
  const { data: monthData, isLoading: isMonthLoading } = trpc.expenseAnalysis.byMonth.useQuery(queryParams);
  const { data: categoryMonthData, isLoading: isCategoryMonthLoading } = trpc.expenseAnalysis.byCategoryAndMonth.useQuery(queryParams);
  const { data: detailData, isLoading: isDetailLoading } = trpc.expenseAnalysis.detail.useQuery(queryParams);

  // Filtrar fornecedores pelo termo de busca
  const filteredSuppliers = useMemo(() => {
    if (!suppliers || !supplierSearch) return suppliers || [];
    return suppliers.filter(s => 
      s.tradeName?.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.name?.toLowerCase().includes(supplierSearch.toLowerCase())
    );
  }, [suppliers, supplierSearch]);

  // Toggle mês
  const toggleMonth = (month: number) => {
    setSelectedMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month].sort((a, b) => a - b)
    );
  };

  // Limpar filtros
  const clearFilters = () => {
    setSelectedYear(currentYear);
    setSelectedMonths([currentMonth]);
    setSelectedCategoryId(null);
    setSelectedSupplierId(null);
    setSupplierSearch("");
  };

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formatar data
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  // Processar dados para matriz categoria x mês
  const matrixData = useMemo(() => {
    if (!categoryMonthData || categoryMonthData.length === 0) return null;

    // Obter meses únicos
    const months = Array.from(new Set(categoryMonthData.map(d => `${d.year}-${d.month}`))).sort();
    
    // Obter categorias únicas
    const categoriesMap = new Map<number, { name: string; data: Map<string, number> }>();
    
    categoryMonthData.forEach(item => {
      const key = `${item.year}-${item.month}`;
      if (!categoriesMap.has(item.categoryId)) {
        categoriesMap.set(item.categoryId, { name: item.categoryName, data: new Map() });
      }
      categoriesMap.get(item.categoryId)!.data.set(key, item.totalAmount);
    });

    return { months, categories: categoriesMap };
  }, [categoryMonthData]);

  const isLoading = isSummaryLoading || isCategoryLoading || isMonthLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Análise de Despesas</h1>
          <p className="text-muted-foreground">Acompanhe a evolução das despesas operacionais</p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpar Filtros
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Ano */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Ano</Label>
              <div className="flex gap-2 flex-wrap">
                {[2024, 2025, 2026].map(year => (
                  <Button
                    key={year}
                    variant={selectedYear === year ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedYear(year)}
                  >
                    {year}
                  </Button>
                ))}
              </div>
            </div>

            {/* Meses */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Meses ({selectedMonths.length} selecionados)
              </Label>
              <div className="flex gap-2 flex-wrap">
                {MONTH_NAMES.map((name, idx) => (
                  <Button
                    key={idx}
                    variant={selectedMonths.includes(idx + 1) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleMonth(idx + 1)}
                    className="min-w-[70px]"
                  >
                    {name.substring(0, 3)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Categoria e Fornecedor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Categoria</Label>
                <Select
                  value={selectedCategoryId?.toString() || "all"}
                  onValueChange={(v) => setSelectedCategoryId(v === "all" ? null : parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories?.map((cat: { id: number; name: string }) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Fornecedor</Label>
                <Select
                  value={selectedSupplierId?.toString() || "all"}
                  onValueChange={(v) => setSelectedSupplierId(v === "all" ? null : parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os fornecedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <Input
                        placeholder="Buscar fornecedor..."
                        value={supplierSearch}
                        onChange={(e) => setSupplierSearch(e.target.value)}
                        className="mb-2"
                      />
                    </div>
                    <SelectItem value="all">Todos os fornecedores</SelectItem>
                    {filteredSuppliers?.slice(0, 50).map(sup => (
                      <SelectItem key={sup.id} value={sup.id.toString()}>
                        {sup.tradeName || sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total de Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isSummaryLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(summaryData?.totalAmount || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Total de Lançamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isSummaryLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <div className="text-2xl font-bold text-blue-600">
                  {summaryData?.totalLancamentos || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Média por Lançamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isSummaryLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(summaryData?.avgPerLancamento || 0)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Abas de Análise */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="categoria">Por Categoria</TabsTrigger>
            <TabsTrigger value="mensal">Evolução Mensal</TabsTrigger>
            <TabsTrigger value="detalhado">Detalhado</TabsTrigger>
          </TabsList>

          {/* Aba Por Categoria */}
          <TabsContent value="categoria" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Despesas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {isCategoryLoading ? (
                  <LoadingSpinner />
                ) : categoryData && categoryData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">Categoria</th>
                          <th className="text-right p-3 font-medium">Lançamentos</th>
                          <th className="text-right p-3 font-medium">Total</th>
                          <th className="text-right p-3 font-medium">% do Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryData.map((cat, idx) => {
                          const total = categoryData.reduce((sum, c) => sum + c.totalAmount, 0);
                          const percent = total > 0 ? (cat.totalAmount / total) * 100 : 0;
                          return (
                            <tr key={idx} className="border-b hover:bg-muted/30">
                              <td className="p-3 font-medium">{cat.categoryName}</td>
                              <td className="p-3 text-right">{cat.totalLancamentos}</td>
                              <td className="p-3 text-right text-red-600 font-medium">
                                {formatCurrency(cat.totalAmount)}
                              </td>
                              <td className="p-3 text-right text-muted-foreground">
                                {percent.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                        {/* Linha de Total */}
                        <tr className="bg-muted/50 font-bold">
                          <td className="p-3">TOTAL</td>
                          <td className="p-3 text-right">
                            {categoryData.reduce((sum, c) => sum + c.totalLancamentos, 0)}
                          </td>
                          <td className="p-3 text-right text-red-600">
                            {formatCurrency(categoryData.reduce((sum, c) => sum + c.totalAmount, 0))}
                          </td>
                          <td className="p-3 text-right">100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma despesa encontrada no período selecionado
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Evolução Mensal */}
          <TabsContent value="mensal" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evolução Mensal por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {isCategoryMonthLoading ? (
                  <LoadingSpinner />
                ) : matrixData && matrixData.months.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium sticky left-0 bg-muted/50">Categoria</th>
                          {matrixData.months.map(monthKey => {
                            const [year, month] = monthKey.split('-').map(Number);
                            return (
                              <th key={monthKey} className="text-right p-3 font-medium min-w-[120px]">
                                {MONTH_NAMES[month - 1].substring(0, 3)}/{year}
                              </th>
                            );
                          })}
                          <th className="text-right p-3 font-medium min-w-[120px] bg-muted/30">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(matrixData.categories.entries()).map(([catId, catData]) => {
                          const rowTotal = Array.from(catData.data.values()).reduce((sum, v) => sum + v, 0);
                          return (
                            <tr key={catId} className="border-b hover:bg-muted/30">
                              <td className="p-3 font-medium sticky left-0 bg-background">{catData.name}</td>
                              {matrixData.months.map(monthKey => (
                                <td key={monthKey} className="p-3 text-right text-red-600">
                                  {formatCurrency(catData.data.get(monthKey) || 0)}
                                </td>
                              ))}
                              <td className="p-3 text-right font-bold text-red-600 bg-muted/30">
                                {formatCurrency(rowTotal)}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Linha de Total */}
                        <tr className="bg-muted/50 font-bold">
                          <td className="p-3 sticky left-0 bg-muted/50">TOTAL</td>
                          {matrixData.months.map(monthKey => {
                            const monthTotal = Array.from(matrixData.categories.values())
                              .reduce((sum, cat) => sum + (cat.data.get(monthKey) || 0), 0);
                            return (
                              <td key={monthKey} className="p-3 text-right text-red-600">
                                {formatCurrency(monthTotal)}
                              </td>
                            );
                          })}
                          <td className="p-3 text-right text-red-600 bg-muted/30">
                            {formatCurrency(
                              Array.from(matrixData.categories.values())
                                .reduce((sum, cat) => sum + Array.from(cat.data.values()).reduce((s, v) => s + v, 0), 0)
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma despesa encontrada no período selecionado
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Detalhado */}
          <TabsContent value="detalhado" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Lançamentos Detalhados</CardTitle>
              </CardHeader>
              <CardContent>
                {isDetailLoading ? (
                  <LoadingSpinner />
                ) : detailData && detailData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">Data</th>
                          <th className="text-left p-3 font-medium">Categoria</th>
                          <th className="text-left p-3 font-medium">Descrição</th>
                          <th className="text-left p-3 font-medium">Fornecedor</th>
                          <th className="text-left p-3 font-medium">Observação</th>
                          <th className="text-right p-3 font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.map((item, idx) => (
                          <tr key={idx} className="border-b hover:bg-muted/30">
                            <td className="p-3 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                            <td className="p-3">
                              <span className="px-2 py-1 bg-muted rounded text-xs">
                                {item.categoryName}
                              </span>
                            </td>
                            <td className="p-3">{item.description}</td>
                            <td className="p-3 text-muted-foreground">
                              {item.supplierName || "-"}
                            </td>
                            <td className="p-3 text-muted-foreground max-w-[200px] truncate" title={item.notes || ""}>
                              {item.notes || "-"}
                            </td>
                            <td className="p-3 text-right text-red-600 font-medium whitespace-nowrap">
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {detailData.length >= 500 && (
                      <p className="text-center text-muted-foreground text-sm mt-4">
                        Mostrando os 500 lançamentos mais recentes. Use os filtros para refinar a busca.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma despesa encontrada no período selecionado
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
