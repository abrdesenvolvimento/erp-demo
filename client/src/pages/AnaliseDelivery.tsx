import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, AlertCircle, ArrowLeft, Search, Calendar, Filter, Info, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";

export default function AnaliseDelivery() {
  const [sortBy, setSortBy] = useState<'netProfit' | 'netMargin' | 'revenue' | 'quantity' | 'cost' | 'grossMargin' | 'ifoodFee'>('netProfit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30 inline" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [channelId, setChannelId] = useState<number | undefined>(undefined);
  const [marginStatus, setMarginStatus] = useState<'all' | 'excellent' | 'attention' | 'critical'>('all');
  
  // Buscar canais de delivery
  const { data: allChannels = [] } = trpc.salesChannels.list.useQuery({ activeOnly: true });
  const deliveryChannels = useMemo(() => allChannels.filter((c: any) => c.type === 'DELIVERY'), [allChannels]);
  
  // Queries com filtros
  const queryParams = useMemo(() => ({
    ...(startDate && endDate ? { startDate, endDate } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(channelId ? { channelId } : {}),
  }), [startDate, endDate, categoryId, channelId]);
  
  const { data: analysisData, isLoading: isProductsLoading } = trpc.dashboard.deliveryProductAnalysis.useQuery(queryParams);
  
  // Extrair produtos e info do canal
  const products = analysisData?.products || (Array.isArray(analysisData) ? analysisData : []);
  const channelInfo = analysisData?.channelInfo || null;
  
  // Calcular resumo a partir dos produtos filtrados
  const deliveryMargin = products && products.length > 0 ? {
    deliveryRevenue: products.reduce((sum: number, p: any) => sum + parseFloat(p.revenue), 0).toFixed(2),
    totalCost: products.reduce((sum: number, p: any) => sum + parseFloat(p.cost), 0).toFixed(2),
    grossProfit: products.reduce((sum: number, p: any) => sum + parseFloat(p.grossProfit), 0).toFixed(2),
    grossMarginPercent: (() => {
      const revenue = products.reduce((sum: number, p: any) => sum + parseFloat(p.revenue), 0);
      const cost = products.reduce((sum: number, p: any) => sum + parseFloat(p.cost), 0);
      return revenue > 0 ? ((revenue - cost) / revenue * 100).toFixed(1) : '0.0';
    })(),
    totalFee: products.reduce((sum: number, p: any) => sum + parseFloat(p.ifoodFee), 0).toFixed(2),
    netProfit: products.reduce((sum: number, p: any) => sum + parseFloat(p.netProfit), 0).toFixed(2),
    netMarginPercent: (() => {
      const revenue = products.reduce((sum: number, p: any) => sum + parseFloat(p.revenue), 0);
      const netProfit = products.reduce((sum: number, p: any) => sum + parseFloat(p.netProfit), 0);
      return revenue > 0 ? (netProfit / revenue * 100).toFixed(1) : '0.0';
    })(),
  } : null;
  
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
    if (margin >= 20) return "Excelente";
    if (margin >= 10) return "Atenção";
    return "Crítico";
  };

  const getMarginBadgeClass = (marginPercent: string): string => {
    const margin = parseFloat(marginPercent);
    if (margin >= 20) return "bg-green-600 text-white hover:bg-green-700";
    if (margin >= 10) return "bg-yellow-500 text-white hover:bg-yellow-600";
    return "bg-red-600 text-white hover:bg-red-700";
  };

  // Filtrar e ordenar produtos
  const filteredAndSortedProducts = products ? [...products]
    .filter((p: any) => {
      if (debouncedSearch && !p.productName.toLowerCase().includes(debouncedSearch.toLowerCase())) {
        return false;
      }
      if (marginStatus !== 'all') {
        const margin = parseFloat(p.netMarginPercent);
        if (marginStatus === 'excellent' && margin < 20) return false;
        if (marginStatus === 'attention' && (margin < 10 || margin >= 20)) return false;
        if (marginStatus === 'critical' && margin >= 10) return false;
      }
      return true;
    })
    .sort((a: any, b: any) => {
      let valA: number, valB: number;
      if (sortBy === 'netProfit') { valA = parseFloat(a.netProfit); valB = parseFloat(b.netProfit); }
      else if (sortBy === 'netMargin') { valA = parseFloat(a.netMarginPercent); valB = parseFloat(b.netMarginPercent); }
      else if (sortBy === 'quantity') { valA = parseFloat(a.quantity); valB = parseFloat(b.quantity); }
      else if (sortBy === 'cost') { valA = parseFloat(a.cost); valB = parseFloat(b.cost); }
      else if (sortBy === 'grossMargin') { valA = parseFloat(a.grossMarginPercent); valB = parseFloat(b.grossMarginPercent); }
      else if (sortBy === 'ifoodFee') { valA = parseFloat(a.ifoodFee); valB = parseFloat(b.ifoodFee); }
      else { valA = parseFloat(a.revenue); valB = parseFloat(b.revenue); }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    }) : [];

  // Determinar label da comissão
  const commissionLabel = channelInfo 
    ? `Taxa ${channelInfo.channelName} (${channelInfo.commissionPercent}%${parseFloat(channelInfo.fixedFeePerOrder) > 0 ? ` + R$ ${formatCurrency(channelInfo.fixedFeePerOrder)}/pedido` : ''})`
    : 'Taxa Canal (7%)';

  if (isProductsLoading) {
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
            <p className="text-muted-foreground">
              Margem líquida após dedução de taxas do canal
              {channelInfo && (
                <span className="ml-2 text-purple-600 font-medium">
                  — {channelInfo.channelName}: {channelInfo.commissionPercent}%
                  {parseFloat(channelInfo.fixedFeePerOrder) > 0 && ` + R$ ${formatCurrency(channelInfo.fixedFeePerOrder)}/pedido`}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Resumo Geral */}
        {deliveryMargin && parseFloat(deliveryMargin.deliveryRevenue) > 0 && (
          <Card className="border-t-4 border-t-purple-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Resumo Geral
                {channelInfo && (
                  <Badge variant="secondary" className="font-normal">
                    {channelInfo.channelName} — {channelInfo.totalOrders} pedidos
                  </Badge>
                )}
              </CardTitle>
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
                  <p className="text-sm text-muted-foreground">{commissionLabel}</p>
                  <p className="text-2xl font-bold text-red-600">R$ {formatCurrency(deliveryMargin.totalFee)}</p>
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
                  onClick={() => handleSort('netProfit')}
                >
                  Lucro Líquido {sortBy === 'netProfit' && (sortDir === 'desc' ? '↓' : '↑')}
                </Button>
                <Button 
                  variant={sortBy === 'netMargin' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => handleSort('netMargin')}
                >
                  Margem % {sortBy === 'netMargin' && (sortDir === 'desc' ? '↓' : '↑')}
                </Button>
                <Button 
                  variant={sortBy === 'revenue' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => handleSort('revenue')}
                >
                  Faturamento {sortBy === 'revenue' && (sortDir === 'desc' ? '↓' : '↑')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filtros de Período, Canal, Categoria e Status */}
            <div className="mb-4 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
              
              {/* Filtro de Canal */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  <Filter className="inline h-3 w-3 mr-1" />
                  Canal de Delivery
                </label>
                <Select
                  value={channelId?.toString() || 'all'}
                  onValueChange={(value) => setChannelId(value === 'all' ? undefined : parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos os canais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os canais</SelectItem>
                    {deliveryChannels.map((ch: any) => (
                      <SelectItem key={ch.id} value={ch.id.toString()}>
                        {ch.name}
                        {ch.commissionPercent && parseFloat(ch.commissionPercent) > 0 && (
                          <span className="text-muted-foreground ml-1">({ch.commissionPercent}%)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    {categories?.map((cat: any) => (
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
                  <Badge className="text-xs bg-green-600 text-white">Excelente</Badge>
                  <span className="text-xs text-muted-foreground">Margem &ge; 20%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="text-xs bg-yellow-500 text-white">Atenção</Badge>
                  <span className="text-xs text-muted-foreground">Margem 10-20%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="text-xs bg-red-600 text-white">Crítico</Badge>
                  <span className="text-xs text-muted-foreground">Margem &lt; 10%</span>
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
                <p>Nenhuma venda delivery encontrada para o período selecionado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-semibold text-sm">Produto</th>
                      <th className="text-right py-3 px-2 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('quantity')}>
                        <span className="flex items-center justify-end">Qtd<SortIcon field="quantity" /></span>
                      </th>
                      <th className="text-right py-3 px-2 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('revenue')}>
                        <span className="flex items-center justify-end">Faturamento<SortIcon field="revenue" /></span>
                      </th>
                      <th className="text-right py-3 px-2 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('cost')}>
                        <span className="flex items-center justify-end">Custo<SortIcon field="cost" /></span>
                      </th>
                      <th className="text-right py-3 px-2 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('grossMargin')}>
                        <span className="flex items-center justify-end">Mg Bruta<SortIcon field="grossMargin" /></span>
                      </th>
                      <th className="text-right py-3 px-2 font-semibold text-sm">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 justify-end">
                            Taxa Canal
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            {channelInfo 
                              ? `${channelInfo.commissionPercent}% comissão${parseFloat(channelInfo.fixedFeePerOrder) > 0 ? ` + R$ ${formatCurrency(channelInfo.fixedFeePerOrder)}/pedido` : ''}`
                              : 'Comissão + taxa fixa do canal (se houver)'}
                          </TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="text-right py-3 px-2 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('netMargin')}>
                        <span className="flex items-center justify-end">Mg Líquida<SortIcon field="netMargin" /></span>
                      </th>
                      <th className="text-right py-3 px-2 font-semibold text-sm cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('netProfit')}>
                        <span className="flex items-center justify-end">Lucro Líq.<SortIcon field="netProfit" /></span>
                      </th>
                      <th className="text-center py-3 px-2 font-semibold text-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedProducts.map((product: any, index: number) => (
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
                        <td className="text-center py-3 px-2">
                          <Badge className={`text-xs ${getMarginBadgeClass(product.netMarginPercent)}`}>
                            {getMarginBadge(product.netMarginPercent)}
                          </Badge>
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
