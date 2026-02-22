import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, TrendingUp, TrendingDown, ArrowUpDown, Search, BarChart3, Clock, AlertTriangle, ArrowUp, ArrowDown, ShoppingCart, Truck, PauseCircle, LayoutGrid } from "lucide-react";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

type SortField = 'stockValue' | 'turnover' | 'daysOfStock' | 'costVariation' | 'productName' | 'qtdSold' | 'qtdSoldBalcao' | 'qtdSoldDelivery' | 'daysSinceLastSale' | 'abcClass';
type SortDir = 'asc' | 'desc';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function getDaysOfStockBadge(days: number) {
  if (days >= 999) return <Badge variant="outline" className="text-muted-foreground">Sem vendas</Badge>;
  if (days > 90) return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">{days}d</Badge>;
  if (days > 45) return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{days}d</Badge>;
  if (days < 7) return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{days}d</Badge>;
  return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{days}d</Badge>;
}

function getTurnoverColor(turnover: number): string {
  if (turnover >= 1.0) return 'text-green-600 font-bold';
  if (turnover >= 0.5) return 'text-emerald-600';
  if (turnover >= 0.3) return 'text-amber-600';
  return 'text-red-600';
}

function getAbcBadge(abc: string) {
  if (abc === 'A') return <Badge className="bg-green-100 text-green-800 border-green-200">A</Badge>;
  if (abc === 'B') return <Badge className="bg-amber-100 text-amber-800 border-amber-200">B</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200">C</Badge>;
}

function getDaysSinceLastSaleBadge(days: number | undefined) {
  if (days === undefined) return <Badge variant="outline" className="text-muted-foreground">Nunca vendido</Badge>;
  if (days > 120) return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">{days}d</Badge>;
  if (days > 90) return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">{days}d</Badge>;
  if (days > 60) return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{days}d</Badge>;
  if (days > 30) return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{days}d</Badge>;
  return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{days}d</Badge>;
}

export default function AnaliseEstoque() {
  const now = new Date();
  const nowBrazil = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const [month, setMonth] = useState(nowBrazil.getMonth() + 1);
  const [year, setYear] = useState(nowBrazil.getFullYear());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('stockValue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [activeTab, setActiveTab] = useState("giro");
  const [stoppedDaysFilter, setStoppedDaysFilter] = useState<string>("30");

  const { data: categoryData, isLoading: loadingCategories } = trpc.stockAnalysis.byCategory.useQuery(
    { year, month }
  );

  const { data: productData, isLoading: loadingProducts } = trpc.stockAnalysis.byProduct.useQuery(
    {
      year, month,
      categoryId: selectedCategory !== "all" ? parseInt(selectedCategory) : undefined,
      subcategory: selectedSubcategory !== "all" ? selectedSubcategory : undefined,
    }
  );

  const { data: subcategories } = trpc.stockAnalysis.subcategories.useQuery(
    { categoryId: selectedCategory !== "all" ? parseInt(selectedCategory) : undefined }
  );

  const years = useMemo(() => {
    const arr = [];
    for (let y = 2025; y <= nowBrazil.getFullYear(); y++) arr.push(y);
    return arr;
  }, []);

  // Filtrar e ordenar produtos
  const filteredProducts = useMemo(() => {
    if (!productData) return [];
    let filtered = productData;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((p: any) => p.productName.toLowerCase().includes(term));
    }

    return [...filtered].sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'productName') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (sortField === 'abcClass') {
        const order: Record<string, number> = { A: 1, B: 2, C: 3 };
        return sortDir === 'asc' ? (order[aVal] || 4) - (order[bVal] || 4) : (order[bVal] || 4) - (order[aVal] || 4);
      }
      if (sortField === 'daysOfStock') {
        if (aVal >= 999 && bVal < 999) return 1;
        if (bVal >= 999 && aVal < 999) return -1;
      }
      if (sortField === 'daysSinceLastSale') {
        if (aVal === undefined && bVal !== undefined) return 1;
        if (bVal === undefined && aVal !== undefined) return -1;
      }
      return sortDir === 'asc' ? (aVal ?? 0) - (bVal ?? 0) : (bVal ?? 0) - (aVal ?? 0);
    });
  }, [productData, searchTerm, sortField, sortDir]);

  // Produtos parados (filtro por dias sem venda)
  const stoppedProducts = useMemo(() => {
    if (!productData) return [];
    const minDays = parseInt(stoppedDaysFilter);
    return [...productData]
      .filter((p: any) => {
        if (p.daysSinceLastSale === undefined) return true; // nunca vendido
        return p.daysSinceLastSale >= minDays;
      })
      .sort((a: any, b: any) => {
        const aD = a.daysSinceLastSale ?? 9999;
        const bD = b.daysSinceLastSale ?? 9999;
        return bD - aD;
      });
  }, [productData, stoppedDaysFilter]);

  // Classificação ABC
  const abcProducts = useMemo(() => {
    if (!productData) return [];
    return [...productData].sort((a: any, b: any) => {
      const order: Record<string, number> = { A: 1, B: 2, C: 3 };
      const diff = (order[a.abcClass] || 4) - (order[b.abcClass] || 4);
      if (diff !== 0) return diff;
      return b.cmv - a.cmv;
    });
  }, [productData]);

  // Resumos ABC
  const abcSummary = useMemo(() => {
    if (!abcProducts.length) return { A: { count: 0, value: 0, cmv: 0 }, B: { count: 0, value: 0, cmv: 0 }, C: { count: 0, value: 0, cmv: 0 } };
    const summary: Record<string, { count: number; value: number; cmv: number }> = {
      A: { count: 0, value: 0, cmv: 0 },
      B: { count: 0, value: 0, cmv: 0 },
      C: { count: 0, value: 0, cmv: 0 },
    };
    for (const p of abcProducts) {
      const cls = (p as any).abcClass || 'C';
      summary[cls].count++;
      summary[cls].value += (p as any).stockValue;
      summary[cls].cmv += (p as any).cmv;
    }
    return summary;
  }, [abcProducts]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Totais do resumo
  const categoryTotals = useMemo(() => {
    if (!categoryData) return { stockValue: 0, cmv: 0, productCount: 0 };
    return {
      stockValue: categoryData.reduce((s: number, c: any) => s + c.stockValue, 0),
      cmv: categoryData.reduce((s: number, c: any) => s + c.cmv, 0),
      productCount: categoryData.reduce((s: number, c: any) => s + c.productCount, 0),
    };
  }, [categoryData]);

  // Totais dos produtos filtrados
  const productTotals = useMemo(() => {
    if (!filteredProducts.length) return { stockValue: 0, cmv: 0, qtdSold: 0, qtdSoldBalcao: 0, qtdSoldDelivery: 0 };
    return {
      stockValue: filteredProducts.reduce((s: number, p: any) => s + p.stockValue, 0),
      cmv: filteredProducts.reduce((s: number, p: any) => s + p.cmv, 0),
      qtdSold: filteredProducts.reduce((s: number, p: any) => s + p.qtdSold, 0),
      qtdSoldBalcao: filteredProducts.reduce((s: number, p: any) => s + p.qtdSoldBalcao, 0),
      qtdSoldDelivery: filteredProducts.reduce((s: number, p: any) => s + p.qtdSoldDelivery, 0),
    };
  }, [filteredProducts]);

  // Totais de produtos parados
  const stoppedTotals = useMemo(() => {
    if (!stoppedProducts.length) return { stockValue: 0, count: 0 };
    return {
      stockValue: stoppedProducts.reduce((s: number, p: any) => s + p.stockValue, 0),
      count: stoppedProducts.length,
    };
  }, [stoppedProducts]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Análise de Estoque</h1>
            <p className="text-muted-foreground">Giro, cobertura, classificação ABC e produtos parados</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Package className="h-4 w-4" />
                Valor em Estoque
              </div>
              <div className="text-2xl font-bold text-primary">
                {loadingCategories ? "..." : formatCurrency(categoryTotals.stockValue)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {loadingCategories ? "" : `${categoryTotals.productCount} produtos com estoque`}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <BarChart3 className="h-4 w-4" />
                CMV do Período
              </div>
              <div className="text-2xl font-bold">
                {loadingCategories ? "..." : formatCurrency(categoryTotals.cmv)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Custo das mercadorias vendidas
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4" />
                Giro Médio
              </div>
              <div className={`text-2xl font-bold ${categoryTotals.stockValue > 0 ? getTurnoverColor(categoryTotals.cmv / categoryTotals.stockValue) : ''}`}>
                {loadingCategories ? "..." : categoryTotals.stockValue > 0 ? `${(categoryTotals.cmv / categoryTotals.stockValue).toFixed(2)}x` : "0.00x"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                CMV / Valor em Estoque
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Clock className="h-4 w-4" />
                Cobertura Média
              </div>
              <div className="text-2xl font-bold">
                {loadingCategories ? "..." : (() => {
                  const dailyCmv = categoryTotals.cmv / (new Date(year, month, 0).getDate());
                  const days = dailyCmv > 0 ? Math.round(categoryTotals.stockValue / dailyCmv) : 999;
                  return days >= 999 ? "—" : `${days} dias`;
                })()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Dias de estoque disponível
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RESUMO POR CATEGORIA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Resumo por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCategories ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor Estoque</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Produtos</TableHead>
                    <TableHead className="text-right">CMV</TableHead>
                    <TableHead className="text-right">Giro</TableHead>
                    <TableHead className="text-right">Dias de Estoque</TableHead>
                    <TableHead className="text-right">Var. Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryData && categoryData.length > 0 ? categoryData.map((cat: any) => (
                    <TableRow
                      key={cat.categoryId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedCategory(String(cat.categoryId));
                        setSelectedSubcategory("all");
                        setActiveTab("giro");
                        document.getElementById('product-tabs')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      <TableCell className="font-medium">{cat.categoryName}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(cat.stockValue)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{cat.stockPercentage}%</TableCell>
                      <TableCell className="text-right">{cat.productCount}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(cat.cmv)}</TableCell>
                      <TableCell className={`text-right font-mono ${getTurnoverColor(cat.turnover)}`}>
                        {cat.turnover.toFixed(2)}x
                      </TableCell>
                      <TableCell className="text-right">
                        {getDaysOfStockBadge(cat.daysOfStock)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${
                        cat.costVariation > 0 ? 'text-red-600' :
                        cat.costVariation < 0 ? 'text-green-600' :
                        'text-muted-foreground'
                      }`}>
                        {cat.costVariation !== 0 ? (
                          <span className="flex items-center justify-end gap-1">
                            {cat.costVariation > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {cat.costVariation > 0 ? '+' : ''}{cat.costVariation.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">Sem dados</TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {categoryData && categoryData.length > 0 && (
                  <TableFooter>
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(categoryTotals.stockValue)}</TableCell>
                      <TableCell className="text-right font-mono">100%</TableCell>
                      <TableCell className="text-right">{categoryTotals.productCount}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(categoryTotals.cmv)}</TableCell>
                      <TableCell className={`text-right font-mono ${getTurnoverColor(categoryTotals.stockValue > 0 ? categoryTotals.cmv / categoryTotals.stockValue : 0)}`}>
                        {categoryTotals.stockValue > 0 ? (categoryTotals.cmv / categoryTotals.stockValue).toFixed(2) : '0.00'}x
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const dailyCmv = categoryTotals.cmv / (new Date(year, month, 0).getDate());
                          const days = dailyCmv > 0 ? Math.round(categoryTotals.stockValue / dailyCmv) : 999;
                          return getDaysOfStockBadge(days);
                        })()}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ABAS: Giro e Cobertura | Produtos Parados | Classificação ABC */}
        <div id="product-tabs">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="giro" className="flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" />
                Giro e Cobertura
              </TabsTrigger>
              <TabsTrigger value="parados" className="flex items-center gap-1.5">
                <PauseCircle className="h-4 w-4" />
                Produtos Parados
              </TabsTrigger>
              <TabsTrigger value="abc" className="flex items-center gap-1.5">
                <LayoutGrid className="h-4 w-4" />
                Classificação ABC
              </TabsTrigger>
            </TabsList>

            {/* ===== ABA 1: GIRO E COBERTURA ===== */}
            <TabsContent value="giro">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Detalhe por Produto
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar produto..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8 w-[200px]"
                        />
                      </div>
                      <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setSelectedSubcategory("all"); }}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas categorias</SelectItem>
                          {categoryData?.map((cat: any) => (
                            <SelectItem key={cat.categoryId} value={String(cat.categoryId)}>
                              {cat.categoryName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Subcategoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas subcategorias</SelectItem>
                          {subcategories?.map((sub: string) => (
                            <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingProducts ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : (
                    <>
                      <div className="text-sm text-muted-foreground mb-3">
                        {filteredProducts.length} produtos encontrados
                        {selectedCategory !== "all" && categoryData ? ` em ${categoryData.find((c: any) => String(c.categoryId) === selectedCategory)?.categoryName || ''}` : ''}
                        {selectedSubcategory !== "all" ? ` > ${selectedSubcategory}` : ''}
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('productName')}>
                                <span className="flex items-center">Produto<SortIcon field="productName" /></span>
                              </TableHead>
                              <TableHead className="text-right">Qtd</TableHead>
                              <TableHead className="text-right">Custo Médio</TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('stockValue')}>
                                <span className="flex items-center justify-end">Valor Estoque<SortIcon field="stockValue" /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('qtdSoldBalcao')}>
                                <span className="flex items-center justify-end gap-1"><ShoppingCart className="h-3 w-3" />Balcão<SortIcon field="qtdSoldBalcao" /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('qtdSoldDelivery')}>
                                <span className="flex items-center justify-end gap-1"><Truck className="h-3 w-3" />Delivery<SortIcon field="qtdSoldDelivery" /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('qtdSold')}>
                                <span className="flex items-center justify-end">Total Vend.<SortIcon field="qtdSold" /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('turnover')}>
                                <span className="flex items-center justify-end">Giro<SortIcon field="turnover" /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('daysOfStock')}>
                                <span className="flex items-center justify-end">Dias de Estoque<SortIcon field="daysOfStock" /></span>
                              </TableHead>
                              <TableHead className="text-right">Última Compra</TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('costVariation')}>
                                <span className="flex items-center justify-end">Var. Custo<SortIcon field="costVariation" /></span>
                              </TableHead>
                              <TableHead className="text-right">Entradas</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredProducts.length > 0 ? filteredProducts.map((prod: any) => (
                              <TableRow key={prod.productId}>
                                <TableCell className="font-medium max-w-[220px] truncate" title={prod.productName}>
                                  {prod.productName}
                                </TableCell>
                                <TableCell className="text-right font-mono">{formatNumber(prod.currentStock)}</TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                  {formatCurrency(prod.avgCost)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium">
                                  {formatCurrency(prod.stockValue)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {prod.qtdSoldBalcao > 0 ? formatNumber(prod.qtdSoldBalcao) : <span className="text-muted-foreground">0</span>}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {prod.qtdSoldDelivery > 0 ? formatNumber(prod.qtdSoldDelivery) : <span className="text-muted-foreground">0</span>}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {prod.qtdSold > 0 ? formatNumber(prod.qtdSold) : <span className="text-muted-foreground">0</span>}
                                </TableCell>
                                <TableCell className={`text-right font-mono ${getTurnoverColor(prod.turnover)}`}>
                                  {prod.turnover.toFixed(2)}x
                                </TableCell>
                                <TableCell className="text-right">
                                  {getDaysOfStockBadge(prod.daysOfStock)}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {prod.lastPurchaseDate ? (
                                    <div>
                                      <div className="text-muted-foreground">
                                        {new Date(prod.lastPurchaseDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                      </div>
                                      {prod.lastPurchaseCost && (
                                        <div className="text-xs text-muted-foreground">
                                          {formatCurrency(prod.lastPurchaseCost)}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className={`text-right font-mono ${
                                  prod.costVariation !== null && prod.costVariation > 0 ? 'text-red-600' :
                                  prod.costVariation !== null && prod.costVariation < 0 ? 'text-green-600' :
                                  'text-muted-foreground'
                                }`}>
                                  {prod.costVariation !== null ? (
                                    <span className="flex items-center justify-end gap-1">
                                      {prod.costVariation > 0 ? <TrendingUp className="h-3 w-3" /> : prod.costVariation < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                                      {prod.costVariation > 0 ? '+' : ''}{prod.costVariation.toFixed(1)}%
                                    </span>
                                  ) : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {prod.entriesInPeriod > 0 ? (
                                    <div>
                                      <span className="font-mono">{prod.entriesInPeriod}</span>
                                      <span className="text-xs text-muted-foreground ml-1">
                                        ({formatNumber(prod.totalPurchased)} un)
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            )) : (
                              <TableRow>
                                <TableCell colSpan={12} className="text-center text-muted-foreground">
                                  Nenhum produto encontrado
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                          {filteredProducts.length > 0 && (
                            <TableFooter>
                              <TableRow className="font-bold bg-muted/50">
                                <TableCell>Total ({filteredProducts.length})</TableCell>
                                <TableCell className="text-right"></TableCell>
                                <TableCell className="text-right"></TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(productTotals.stockValue)}</TableCell>
                                <TableCell className="text-right font-mono">{formatNumber(productTotals.qtdSoldBalcao)}</TableCell>
                                <TableCell className="text-right font-mono">{formatNumber(productTotals.qtdSoldDelivery)}</TableCell>
                                <TableCell className="text-right font-mono">{formatNumber(productTotals.qtdSold)}</TableCell>
                                <TableCell className={`text-right font-mono ${getTurnoverColor(productTotals.stockValue > 0 ? productTotals.cmv / productTotals.stockValue : 0)}`}>
                                  {productTotals.stockValue > 0 ? (productTotals.cmv / productTotals.stockValue).toFixed(2) : '0.00'}x
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            </TableFooter>
                          )}
                        </Table>
                      </div>

                      {/* Legenda */}
                      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-3">
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                          <span>Dias de Estoque: </span>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1">7-45d</Badge>
                          <span>Ideal</span>
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1">45-90d</Badge>
                          <span>Atenção</span>
                          <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1">&gt;90d</Badge>
                          <span>Excesso</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ShoppingCart className="h-3 w-3" /> Balcão/A Prazo
                          <Truck className="h-3 w-3 ml-2" /> Delivery (iFood+99+Próprio)
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===== ABA 2: PRODUTOS PARADOS ===== */}
            <TabsContent value="parados">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PauseCircle className="h-5 w-5 text-destructive" />
                      Produtos Parados
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Sem vendas há mais de:</span>
                      <Select value={stoppedDaysFilter} onValueChange={setStoppedDaysFilter}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 dias</SelectItem>
                          <SelectItem value="60">60 dias</SelectItem>
                          <SelectItem value="90">90 dias</SelectItem>
                          <SelectItem value="120">120 dias</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setSelectedSubcategory("all"); }}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas categorias</SelectItem>
                          {categoryData?.map((cat: any) => (
                            <SelectItem key={cat.categoryId} value={String(cat.categoryId)}>
                              {cat.categoryName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingProducts ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : (
                    <>
                      {/* Resumo de capital parado */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="border-red-200 bg-red-50/50">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-sm text-red-700 mb-1">Capital Parado</div>
                            <div className="text-xl font-bold text-red-800">{formatCurrency(stoppedTotals.stockValue)}</div>
                          </CardContent>
                        </Card>
                        <Card className="border-amber-200 bg-amber-50/50">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-sm text-amber-700 mb-1">Produtos Parados</div>
                            <div className="text-xl font-bold text-amber-800">{stoppedTotals.count} itens</div>
                          </CardContent>
                        </Card>
                        <Card className="border-muted">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-sm text-muted-foreground mb-1">% do Estoque Total</div>
                            <div className="text-xl font-bold">
                              {categoryTotals.stockValue > 0 ? ((stoppedTotals.stockValue / categoryTotals.stockValue) * 100).toFixed(1) : '0.0'}%
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produto</TableHead>
                              <TableHead className="text-right">Qtd</TableHead>
                              <TableHead className="text-right">Custo Médio</TableHead>
                              <TableHead className="text-right">Valor Parado</TableHead>
                              <TableHead className="text-right">Última Venda</TableHead>
                              <TableHead className="text-right">Dias Sem Venda</TableHead>
                              <TableHead className="text-right">Última Compra</TableHead>
                              <TableHead className="text-right">Entradas</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stoppedProducts.length > 0 ? stoppedProducts.map((prod: any) => (
                              <TableRow key={prod.productId}>
                                <TableCell className="font-medium max-w-[250px] truncate" title={prod.productName}>
                                  {prod.productName}
                                </TableCell>
                                <TableCell className="text-right font-mono">{formatNumber(prod.currentStock)}</TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                  {formatCurrency(prod.avgCost)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium text-red-600">
                                  {formatCurrency(prod.stockValue)}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {prod.lastSaleDate ? (
                                    new Date(prod.lastSaleDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                  ) : (
                                    <span className="text-muted-foreground">Nunca</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {getDaysSinceLastSaleBadge(prod.daysSinceLastSale)}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {prod.lastPurchaseDate ? (
                                    new Date(prod.lastPurchaseDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                  ) : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {prod.entriesInPeriod > 0 ? (
                                    <span className="font-mono">{prod.entriesInPeriod} ({formatNumber(prod.totalPurchased)} un)</span>
                                  ) : '—'}
                                </TableCell>
                              </TableRow>
                            )) : (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                  Nenhum produto parado encontrado com o filtro atual
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                          {stoppedProducts.length > 0 && (
                            <TableFooter>
                              <TableRow className="font-bold bg-muted/50">
                                <TableCell>Total ({stoppedProducts.length} produtos)</TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-right font-mono text-red-600">{formatCurrency(stoppedTotals.stockValue)}</TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            </TableFooter>
                          )}
                        </Table>
                      </div>

                      <div className="mt-4 text-xs text-muted-foreground border-t pt-3">
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                          <span>Produtos com estoque mas sem vendas no período selecionado. Considere promoções ou remoção do catálogo.</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===== ABA 3: CLASSIFICAÇÃO ABC ===== */}
            <TabsContent value="abc">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <LayoutGrid className="h-5 w-5 text-primary" />
                      Classificação ABC
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setSelectedSubcategory("all"); }}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas categorias</SelectItem>
                          {categoryData?.map((cat: any) => (
                            <SelectItem key={cat.categoryId} value={String(cat.categoryId)}>
                              {cat.categoryName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingProducts ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : (
                    <>
                      {/* Cards resumo ABC */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="border-green-200 bg-green-50/50">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-lg px-3">A</Badge>
                              <span className="text-sm text-green-700">80% do faturamento</span>
                            </div>
                            <div className="text-lg font-bold text-green-800">{abcSummary.A.count} produtos</div>
                            <div className="text-sm text-green-700">CMV: {formatCurrency(abcSummary.A.cmv)}</div>
                            <div className="text-sm text-green-600">Estoque: {formatCurrency(abcSummary.A.value)}</div>
                          </CardContent>
                        </Card>
                        <Card className="border-amber-200 bg-amber-50/50">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-lg px-3">B</Badge>
                              <span className="text-sm text-amber-700">15% do faturamento</span>
                            </div>
                            <div className="text-lg font-bold text-amber-800">{abcSummary.B.count} produtos</div>
                            <div className="text-sm text-amber-700">CMV: {formatCurrency(abcSummary.B.cmv)}</div>
                            <div className="text-sm text-amber-600">Estoque: {formatCurrency(abcSummary.B.value)}</div>
                          </CardContent>
                        </Card>
                        <Card className="border-red-200 bg-red-50/50">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-red-100 text-red-800 border-red-200 text-lg px-3">C</Badge>
                              <span className="text-sm text-red-700">5% do faturamento</span>
                            </div>
                            <div className="text-lg font-bold text-red-800">{abcSummary.C.count} produtos</div>
                            <div className="text-sm text-red-700">CMV: {formatCurrency(abcSummary.C.cmv)}</div>
                            <div className="text-sm text-red-600">Estoque: {formatCurrency(abcSummary.C.value)}</div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">ABC</TableHead>
                              <TableHead>Produto</TableHead>
                              <TableHead className="text-right">Qtd</TableHead>
                              <TableHead className="text-right">Valor Estoque</TableHead>
                              <TableHead className="text-right">CMV</TableHead>
                              <TableHead className="text-right">% CMV Acum.</TableHead>
                              <TableHead className="text-right">Vendido</TableHead>
                              <TableHead className="text-right">Giro</TableHead>
                              <TableHead className="text-right">Dias de Estoque</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const totalCmv = abcProducts.reduce((s: number, p: any) => s + p.cmv, 0);
                              let accCmv = 0;
                              return abcProducts.length > 0 ? abcProducts.map((prod: any) => {
                                accCmv += prod.cmv;
                                const accPct = totalCmv > 0 ? (accCmv / totalCmv) * 100 : 0;
                                return (
                                  <TableRow key={prod.productId} className={
                                    prod.abcClass === 'A' ? 'bg-green-50/30' :
                                    prod.abcClass === 'B' ? 'bg-amber-50/30' : 'bg-red-50/20'
                                  }>
                                    <TableCell>{getAbcBadge(prod.abcClass)}</TableCell>
                                    <TableCell className="font-medium max-w-[250px] truncate" title={prod.productName}>
                                      {prod.productName}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{formatNumber(prod.currentStock)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(prod.stockValue)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(prod.cmv)}</TableCell>
                                    <TableCell className="text-right font-mono text-muted-foreground">{accPct.toFixed(1)}%</TableCell>
                                    <TableCell className="text-right font-mono">{formatNumber(prod.qtdSold)}</TableCell>
                                    <TableCell className={`text-right font-mono ${getTurnoverColor(prod.turnover)}`}>
                                      {prod.turnover.toFixed(2)}x
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {getDaysOfStockBadge(prod.daysOfStock)}
                                    </TableCell>
                                  </TableRow>
                                );
                              }) : (
                                <TableRow>
                                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                                    Nenhum produto encontrado
                                  </TableCell>
                                </TableRow>
                              );
                            })()}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="mt-4 text-xs text-muted-foreground border-t pt-3 space-y-1">
                        <p><strong>Classe A</strong>: Produtos que representam 80% do CMV. Alta prioridade de reposição e controle.</p>
                        <p><strong>Classe B</strong>: Próximos 15% do CMV. Prioridade intermediária.</p>
                        <p><strong>Classe C</strong>: Últimos 5% do CMV. Menor giro, avaliar necessidade de manter em estoque.</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
