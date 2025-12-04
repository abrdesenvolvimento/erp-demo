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
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>();
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | undefined>();
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
      productId: selectedProductId,
      subcategoryId: selectedSubcategoryId,
    },
    { enabled: isAdmin && groupBy === "product" }
  );

  const { data: quantityData, isLoading: isQuantityLoading } = trpc.salesAnalysis.byQuantity.useQuery(
    { 
      startDate: dateRange.from, 
      endDate: dateRange.to,
      productId: selectedProductId,
      subcategoryId: selectedSubcategoryId,
    },
    { enabled: isAdmin && groupBy === "product" }
  );

  const { data: categoryData, isLoading: isCategoryLoading } = trpc.salesAnalysis.byCategoryValue.useQuery(
    { 
      startDate: dateRange.from, 
      endDate: dateRange.to,
      productId: selectedProductId,
      subcategoryId: selectedSubcategoryId,
    },
    { enabled: isAdmin && groupBy === "product" }
  );

  // Queries temporais
  const { data: dayData, isLoading: isDayLoading } = trpc.salesAnalysis.byDay.useQuery(
    { 
      startDate: dateRange.from, 
      endDate: dateRange.to,
      productId: selectedProductId,
      subcategoryId: selectedSubcategoryId,
    },
    { enabled: isAdmin && groupBy === "day" }
  );

  const { data: weekData, isLoading: isWeekLoading } = trpc.salesAnalysis.byWeek.useQuery(
    { 
      startDate: dateRange.from, 
      endDate: dateRange.to,
      productId: selectedProductId,
      subcategoryId: selectedSubcategoryId,
    },
    { enabled: isAdmin && groupBy === "week" }
  );

  const { data: monthData, isLoading: isMonthLoading } = trpc.salesAnalysis.byMonth.useQuery(
    { 
      startDate: dateRange.from, 
      endDate: dateRange.to,
      productId: selectedProductId,
      subcategoryId: selectedSubcategoryId,
    },
    { enabled: isAdmin && groupBy === "month" }
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

              {/* Filtro de Produto */}
              <div className="space-y-2">
                <Label>Produto</Label>
                <div className="relative">
                  <Input
                    placeholder="Digite para buscar produto..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onFocus={() => setProductSearch("")}
                  />
                  {selectedProductId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => {
                        setSelectedProductId(undefined);
                        setProductSearch("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {productSearch && filteredProducts.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredProducts.map((prod) => (
                        <div
                          key={prod.id}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            setSelectedProductId(prod.id);
                            setProductSearch(prod.name);
                          }}
                        >
                          {prod.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedProductId && (
                  <p className="text-sm text-muted-foreground">
                    Filtrando por: {products?.find(p => p.id === selectedProductId)?.name}
                  </p>
                )}
              </div>
            </div>

            {/* Botão Limpar Filtros */}
            {(selectedProductId || selectedSubcategoryId) && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProductId(undefined);
                    setSelectedSubcategoryId(undefined);
                    setProductSearch("");
                    setSubcategorySearch("");
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="valores" className="space-y-4">
          <TabsList>
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
