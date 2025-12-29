import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, AlertCircle, ArrowLeft, Search, Calendar, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { useState } from "react";

export default function AnaliseDelivery() {
  const [sortBy, setSortBy] = useState<'netProfit' | 'netMargin' | 'revenue'>('netProfit');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [marginStatus, setMarginStatus] = useState<'all' | 'excellent' | 'attention' | 'critical'>('all');
  
  // Queries com filtros
  const { data: deliveryMargin, isLoading: isMarginLoading } = trpc.dashboard.deliveryNetMargin.useQuery();
  const { data: products, isLoading: isProductsLoading } = trpc.dashboard.deliveryProductAnalysis.useQuery(
    startDate && endDate ? { startDate, endDate, categoryId } : { categoryId }
  );
  const { data: categories } = trpc.categories.list.useQuery();

  const formatCurrency = (value: string | number | null | undefined): string => {
    if (!value) return "0,00";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const getMarginColor = (marginPercent: string): string => {
    const margin = parseFloat(marginPercent);
    if (margin >= 20) return "text-green-600 bg-green-50";
    if (margin >= 10) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getMarginBadge = (marginPercent: string): string => {
    const margin = parseFloat(marginPercent);
    if (margin >= 20) return "🟢 Excelente";
    if (margin >= 10) return "🟡 Atenção";
    return "🔴 Crítico";
  };

  // Filtrar e ordenar produtos
  const filteredAndSortedProducts = products ? [...products]
    .filter(p => {
      // Filtro de busca por nome
      if (searchTerm && !p.productName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Filtro de status de margem
      if (marginStatus !== 'all') {
        const margin = parseFloat(p.netMarginPercent);
        if (marginStatus === 'excellent' && margin < 20) return false;
        if (marginStatus === 'attention' && (margin < 10 || margin >= 20)) return false;
        if (marginStatus === 'critical' && margin >= 10) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'netProfit') return parseFloat(b.netProfit) - parseFloat(a.netProfit);
      if (sortBy === 'netMargin') return parseFloat(b.netMarginPercent) - parseFloat(a.netMarginPercent);
      return parseFloat(b.revenue) - parseFloat(a.revenue);
    }) : [];

  if (isMarginLoading || isProductsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Carregando análise delivery..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Dashboard
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Análise Delivery por Produto</h1>
            <p className="text-muted-foreground">Margem líquida após dedução de 7% (taxa iFood)</p>
          </div>
        </div>

        {/* Resumo Geral */}
        {deliveryMargin && parseFloat(deliveryMargin.deliveryRevenue) > 0 && (
          <Card className="border-t-4 border-t-purple-500">
            <CardHeader>
              <CardTitle className="text-lg">Resumo Geral do Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento</p>
                  <p className="text-2xl font-bold text-purple-600">R$ {formatCurrency(deliveryMargin.deliveryRevenue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Custo</p>
                  <p className="text-2xl font-bold">R$ {formatCurrency(deliveryMargin.totalCost)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa iFood (7%)</p>
                  <p className="text-2xl font-bold text-red-600">R$ {formatCurrency(deliveryMargin.ifoodFee)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lucro Líquido</p>
                  <p className="text-2xl font-bold text-green-600">R$ {formatCurrency(deliveryMargin.netProfit)}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Margem Líquida Geral:</span>
                  <span className="text-3xl font-bold text-purple-600">{deliveryMargin.netMarginPercent}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Produtos ({filteredAndSortedProducts.length})</CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant={sortBy === 'netProfit' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setSortBy('netProfit')}
                >
                  Lucro Líquido
                </Button>
                <Button 
                  variant={sortBy === 'netMargin' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setSortBy('netMargin')}
                >
                  Margem %
                </Button>
                <Button 
                  variant={sortBy === 'revenue' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setSortBy('revenue')}
                >
                  Faturamento
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filtros de Período, Categoria e Status */}
            <div className="mb-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Filtro de Data Início */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  <Calendar className="inline h-3 w-3 mr-1" />
                  Data Início
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              
              {/* Filtro de Data Fim */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  <Calendar className="inline h-3 w-3 mr-1" />
                  Data Fim
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
              
              {/* Filtro de Categoria */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  <Filter className="inline h-3 w-3 mr-1" />
                  Categoria
                </label>
                <Select
                  value={categoryId?.toString() || 'all'}
                  onValueChange={(value) => setCategoryId(value === 'all' ? undefined : parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filtro de Status de Margem */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  Status da Margem
                </label>
                <Select
                  value={marginStatus}
                  onValueChange={(value: any) => setMarginStatus(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="excellent">Excelente (&gt;= 20%)</SelectItem>
                    <SelectItem value="attention">Atenção (10-20%)</SelectItem>
                    <SelectItem value="critical">Crítico (&lt; 10%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Legenda de Status */}
            <div className="mb-4 p-4 bg-muted/30 rounded-lg">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Legenda de Status da Margem:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🟢</span>
                  <div>
                    <p className="font-semibold text-green-600 text-xs">Excelente</p>
                    <p className="text-xs text-muted-foreground">Margem ≥ 20%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🟡</span>
                  <div>
                    <p className="font-semibold text-yellow-600 text-xs">Atenção</p>
                    <p className="text-xs text-muted-foreground">Margem 10-20%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔴</span>
                  <div>
                    <p className="font-semibold text-red-600 text-xs">Crítico</p>
                    <p className="text-xs text-muted-foreground">Margem &lt; 10%</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Campo de Busca */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchTerm && (
                <p className="text-xs text-muted-foreground mt-2">
                  {filteredAndSortedProducts.length} produto(s) encontrado(s)
                </p>
              )}
            </div>

            {filteredAndSortedProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma venda delivery no mês atual</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-semibold text-sm">Produto</th>
                      <th className="text-right py-3 px-2 font-semibold text-sm">Qtd</th>
                      <th className="text-right py-3 px-2 font-semibold text-sm">Faturamento</th>
                      <th className="text-right py-3 px-2 font-semibold text-sm">Custo</th>
                      <th className="text-right py-3 px-2 font-semibold text-sm">Mg Bruta</th>
                      <th className="text-right py-3 px-2 font-semibold text-sm">Taxa 7%</th>
                      <th className="text-right py-3 px-2 font-semibold text-sm">Mg Líquida</th>
                      <th className="text-right py-3 px-2 font-semibold text-sm">Lucro Líq.</th>
                      <th className="text-center py-3 px-2 font-semibold text-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedProducts.map((product, index) => (
                      <tr 
                        key={product.productId} 
                        className={`border-b hover:bg-muted/50 transition-colors ${
                          index < 3 ? 'bg-purple-50/30' : ''
                        }`}
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            {index < 3 && (
                              <span className="text-xs font-bold text-purple-600">#{index + 1}</span>
                            )}
                            <span className="font-medium text-sm">{product.productName}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-2 text-sm">{product.quantity}</td>
                        <td className="text-right py-3 px-2 text-sm font-medium">
                          R$ {formatCurrency(product.revenue)}
                        </td>
                        <td className="text-right py-3 px-2 text-sm text-muted-foreground">
                          R$ {formatCurrency(product.cost)}
                        </td>
                        <td className="text-right py-3 px-2 text-sm">
                          <div>
                            <div className="font-medium">{product.grossMarginPercent}%</div>
                            <div className="text-xs text-muted-foreground">
                              R$ {formatCurrency(product.grossProfit)}
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-3 px-2 text-sm text-red-600">
                          - R$ {formatCurrency(product.ifoodFee)}
                        </td>
                        <td className="text-right py-3 px-2">
                          <div className={`inline-block px-2 py-1 rounded-md ${getMarginColor(product.netMarginPercent)}`}>
                            <span className="font-bold text-sm">{product.netMarginPercent}%</span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-2">
                          <span className={`font-bold text-sm ${
                            parseFloat(product.netProfit) > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            R$ {formatCurrency(product.netProfit)}
                          </span>
                        </td>
                        <td className="text-center py-3 px-2 text-xs">
                          {getMarginBadge(product.netMarginPercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>


      </div>
    </DashboardLayout>
  );
}
