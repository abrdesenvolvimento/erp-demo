import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, TrendingUp, Package, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { trpc } from "@/lib/trpc";

const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  // Queries
  const { data: valueData, isLoading: isValueLoading } = trpc.salesAnalysis.byValue.useQuery(
    { startDate: dateRange.from, endDate: dateRange.to },
    { enabled: isAdmin }
  );

  const { data: quantityData, isLoading: isQuantityLoading } = trpc.salesAnalysis.byQuantity.useQuery(
    { startDate: dateRange.from, endDate: dateRange.to },
    { enabled: isAdmin }
  );

  const { data: categoryData, isLoading: isCategoryLoading } = trpc.salesAnalysis.byCategoryValue.useQuery(
    { startDate: dateRange.from, endDate: dateRange.to },
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
                <CardTitle>Faturamento e Margem por Produto</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                {isValueLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : valueData && valueData.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Categoria</TableHead>
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
                            <TableCell>{item.categoryName}</TableCell>
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
            {valueData && valueData.length > 0 && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">
                      R$ {formatCurrency(valueData.reduce((sum, item) => sum + parseFloat(item.totalRevenue), 0))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      R$ {formatCurrency(valueData.reduce((sum, item) => sum + parseFloat(item.totalCost), 0))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      R$ {formatCurrency(valueData.reduce((sum, item) => sum + parseFloat(item.totalProfit), 0))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Margem Média</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(() => {
                        const totalRevenue = valueData.reduce((sum, item) => sum + parseFloat(item.totalRevenue), 0);
                        const totalCost = valueData.reduce((sum, item) => sum + parseFloat(item.totalCost), 0);
                        const margin = totalRevenue > 0 ? ((1 - (totalCost / totalRevenue)) * 100).toFixed(1) : "0.0";
                        return `${margin}%`;
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
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
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Unidade</TableHead>
                          <TableHead className="text-right">Qtd Vendida</TableHead>
                          <TableHead className="text-right">Mix %</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quantityData.map((item) => (
                          <TableRow key={item.productId}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell>{item.categoryName}</TableCell>
                            <TableCell className="text-right">{item.unit}</TableCell>
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
