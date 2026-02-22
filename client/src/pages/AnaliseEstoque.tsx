import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, TrendingUp, TrendingDown, ArrowUpDown, Search, BarChart3, Clock, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

type SortField = 'stockValue' | 'turnover' | 'daysOfStock' | 'costVariation' | 'productName' | 'qtdSold';
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

export default function AnaliseEstoque() {
  const now = new Date();
  const nowBrazil = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const [month, setMonth] = useState(nowBrazil.getMonth() + 1);
  const [year, setYear] = useState(nowBrazil.getFullYear());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('stockValue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data: categoryData, isLoading: loadingCategories } = trpc.stockAnalysis.byCategory.useQuery(
    { year, month }
  );

  const { data: productData, isLoading: loadingProducts } = trpc.stockAnalysis.byProduct.useQuery(
    { year, month, categoryId: selectedCategory !== "all" ? parseInt(selectedCategory) : undefined }
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
      // Para daysOfStock 999 = sem vendas, colocar no final
      if (sortField === 'daysOfStock') {
        if (aVal >= 999 && bVal < 999) return 1;
        if (bVal >= 999 && aVal < 999) return -1;
      }
      return sortDir === 'asc' ? (aVal ?? 0) - (bVal ?? 0) : (bVal ?? 0) - (aVal ?? 0);
    });
  }, [productData, searchTerm, sortField, sortDir]);

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
    if (!filteredProducts.length) return { stockValue: 0, cmv: 0, qtdSold: 0 };
    return {
      stockValue: filteredProducts.reduce((s: number, p: any) => s + p.stockValue, 0),
      cmv: filteredProducts.reduce((s: number, p: any) => s + p.cmv, 0),
      qtdSold: filteredProducts.reduce((s: number, p: any) => s + p.qtdSold, 0),
    };
  }, [filteredProducts]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Análise de Estoque</h1>
            <p className="text-muted-foreground">Giro, cobertura e variação de custo por categoria e produto</p>
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
                    <TableHead className="text-right">Dias Estoque</TableHead>
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
                        // Scroll para a tabela de produtos
                        document.getElementById('product-detail')?.scrollIntoView({ behavior: 'smooth' });
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

        {/* DETALHE POR PRODUTO */}
        <Card id="product-detail">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Detalhe por Produto
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-[200px]"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todas categorias" />
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
                <div className="text-sm text-muted-foreground mb-3">
                  {filteredProducts.length} produtos encontrados
                  {selectedCategory !== "all" && categoryData ? ` em ${categoryData.find((c: any) => String(c.categoryId) === selectedCategory)?.categoryName || ''}` : ''}
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('productName')}
                        >
                          <span className="flex items-center">Produto<SortIcon field="productName" /></span>
                        </TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Custo Médio</TableHead>
                        <TableHead
                          className="text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('stockValue')}
                        >
                          <span className="flex items-center justify-end">Valor Estoque<SortIcon field="stockValue" /></span>
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('qtdSold')}
                        >
                          <span className="flex items-center justify-end">Vendido<SortIcon field="qtdSold" /></span>
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('turnover')}
                        >
                          <span className="flex items-center justify-end">Giro<SortIcon field="turnover" /></span>
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('daysOfStock')}
                        >
                          <span className="flex items-center justify-end">Dias Estoque<SortIcon field="daysOfStock" /></span>
                        </TableHead>
                        <TableHead className="text-right">Última Compra</TableHead>
                        <TableHead
                          className="text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('costVariation')}
                        >
                          <span className="flex items-center justify-end">Var. Custo<SortIcon field="costVariation" /></span>
                        </TableHead>
                        <TableHead className="text-right">Entradas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.length > 0 ? filteredProducts.map((prod: any) => (
                        <TableRow key={prod.productId}>
                          <TableCell className="font-medium max-w-[250px] truncate" title={prod.productName}>
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
                          <TableCell colSpan={10} className="text-center text-muted-foreground">
                            Nenhum produto encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    {filteredProducts.length > 0 && (
                      <TableFooter>
                        <TableRow className="font-bold bg-muted/50">
                          <TableCell>Total ({filteredProducts.length} produtos)</TableCell>
                          <TableCell className="text-right"></TableCell>
                          <TableCell className="text-right"></TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(productTotals.stockValue)}</TableCell>
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
                    <span>Dias Estoque: </span>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1">7-45d</Badge>
                    <span>Ideal</span>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1">45-90d</Badge>
                    <span>Atenção</span>
                    <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1">&gt;90d</Badge>
                    <span>Excesso</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Var. Custo: </span>
                    <span className="text-red-600">+%</span> = custo subiu
                    <span className="text-green-600">−%</span> = custo caiu (vs mês anterior)
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
