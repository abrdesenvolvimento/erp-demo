import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, TrendingUp, TrendingDown, Minus, Search, ArrowUpDown, ArrowUp, ArrowDown, DollarSign, BarChart3, AlertCircle, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";

function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getChangeIcon(percent: number | string | null | undefined) {
  if (percent === null || percent === undefined) return <Minus className="h-4 w-4 text-gray-400" />;
  const num = typeof percent === 'string' ? parseFloat(percent) : percent;
  if (isNaN(num) || num === 0) return <Minus className="h-4 w-4 text-gray-400" />;
  if (num > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
  return <TrendingDown className="h-4 w-4 text-green-500" />;
}

function getChangeBadge(percent: number | string | null | undefined) {
  if (percent === null || percent === undefined) return <Badge variant="outline" className="text-gray-500">Novo</Badge>;
  const num = typeof percent === 'string' ? parseFloat(percent) : percent;
  if (isNaN(num)) return <Badge variant="outline" className="text-gray-500">—</Badge>;
  if (num === 0) return <Badge variant="outline" className="text-gray-500">0%</Badge>;
  if (num > 10) return <Badge className="bg-red-100 text-red-700 border-red-200">{formatPercent(num)}</Badge>;
  if (num > 0) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{formatPercent(num)}</Badge>;
  if (num < -10) return <Badge className="bg-green-100 text-green-700 border-green-200">{formatPercent(num)}</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 border-blue-200">{formatPercent(num)}</Badge>;
}

type SortField = 'createdAt' | 'productName' | 'changePercent' | 'newValue' | 'previousValue';
type SortDir = 'asc' | 'desc';

export default function HistoricoPrecos() {
  const { activeCompanyId } = useCompany();
  
  // Filtros
  const [changeType, setChangeType] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [activeTab, setActiveTab] = useState('historico');
  
  // Ordenação
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  
  // Queries
  const { data: historyData, isLoading: historyLoading } = trpc.priceHistory.getRecent.useQuery({
    changeType: changeType !== 'all' ? changeType as 'PRECO_VENDA' | 'CUSTO_MEDIO' : undefined,
    channelId: channelFilter !== 'all' ? parseInt(channelFilter) : undefined,
    page,
    pageSize,
  });
  
  const { data: statsData } = trpc.priceHistory.getStats.useQuery();
  const { data: channels } = trpc.salesChannels.list.useQuery();
  const { data: allProducts } = trpc.products.list.useQuery({ activeOnly: false });
  
  // Mapear produtos e canais para nomes
  const productMap = useMemo(() => {
    const map = new Map<number, string>();
    if (allProducts) {
      for (const p of allProducts) {
        map.set(p.id, p.name);
      }
    }
    return map;
  }, [allProducts]);
  
  const channelMap = useMemo(() => {
    const map = new Map<number, string>();
    if (channels) {
      for (const c of channels) {
        map.set(c.id, c.name);
      }
    }
    return map;
  }, [channels]);
  
  // Filtrar por busca de produto
  const filteredItems = useMemo(() => {
    if (!historyData?.items) return [];
    let items = historyData.items.map(item => ({
      ...item,
      productName: productMap.get(item.productId) || `Produto #${item.productId}`,
      channelName: item.channelId ? (channelMap.get(item.channelId) || `Canal #${item.channelId}`) : '—',
    }));
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      items = items.filter(item => item.productName.toLowerCase().includes(term));
    }
    
    // Ordenação
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'createdAt':
          cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
        case 'productName':
          cmp = a.productName.localeCompare(b.productName);
          break;
        case 'changePercent':
          cmp = parseFloat(a.changePercent?.toString() || '0') - parseFloat(b.changePercent?.toString() || '0');
          break;
        case 'newValue':
          cmp = parseFloat(a.newValue?.toString() || '0') - parseFloat(b.newValue?.toString() || '0');
          break;
        case 'previousValue':
          cmp = parseFloat(a.previousValue?.toString() || '0') - parseFloat(b.previousValue?.toString() || '0');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    
    return items;
  }, [historyData, productMap, channelMap, searchTerm, sortField, sortDir]);
  
  const totalPages = Math.ceil((historyData?.total || 0) / pageSize);
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };
  
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground" />;
    return sortDir === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <History className="h-6 w-6 text-amber-600" />
              Histórico de Preços
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Rastreamento de todas as alterações de preços de venda e custo médio
            </p>
          </div>
        </div>
        
        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de Alterações</p>
                  <p className="text-2xl font-bold">{statsData?.totalChanges || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <TrendingUp className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Média de Aumento</p>
                  <p className="text-2xl font-bold text-red-600">
                    {statsData?.avgIncrease ? `+${Number(statsData.avgIncrease).toFixed(1)}%` : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <TrendingDown className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Média de Redução</p>
                  <p className="text-2xl font-bold text-green-600">
                    {statsData?.avgDecrease ? `${Number(statsData.avgDecrease).toFixed(1)}%` : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Produtos Mais Alterados</p>
                  <p className="text-2xl font-bold">{statsData?.mostChanged?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="historico">Histórico Completo</TabsTrigger>
            <TabsTrigger value="mais-alterados">Mais Alterados</TabsTrigger>
          </TabsList>
          
          <TabsContent value="historico" className="space-y-4">
            {/* Filtros */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Filtros:</span>
                  </div>
                  
                  <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      >
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                  
                  <Select value={changeType} onValueChange={(v) => { setChangeType(v); setPage(1); }}>
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="Tipo de alteração" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="PRECO_VENDA">Preço de Venda</SelectItem>
                      <SelectItem value="CUSTO_MEDIO">Custo Médio</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="Canal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os canais</SelectItem>
                      {channels?.map(ch => (
                        <SelectItem key={ch.id} value={ch.id.toString()}>{ch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {(changeType !== 'all' || channelFilter !== 'all' || searchTerm) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setChangeType('all');
                        setChannelFilter('all');
                        setSearchTerm('');
                        setPage(1);
                      }}
                      className="h-9 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Tabela de Histórico */}
            <Card>
              <CardContent className="p-0">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-lg font-medium">Nenhum registro encontrado</p>
                    <p className="text-sm mt-1">
                      {historyData?.total === 0 
                        ? 'As alterações de preço serão registradas automaticamente a partir de agora.'
                        : 'Tente ajustar os filtros para encontrar registros.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead 
                              className="cursor-pointer select-none hover:bg-muted/80 transition-colors"
                              onClick={() => handleSort('createdAt')}
                            >
                              <div className="flex items-center">
                                Data/Hora
                                <SortIcon field="createdAt" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer select-none hover:bg-muted/80 transition-colors"
                              onClick={() => handleSort('productName')}
                            >
                              <div className="flex items-center">
                                Produto
                                <SortIcon field="productName" />
                              </div>
                            </TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Canal</TableHead>
                            <TableHead 
                              className="text-right cursor-pointer select-none hover:bg-muted/80 transition-colors"
                              onClick={() => handleSort('previousValue')}
                            >
                              <div className="flex items-center justify-end">
                                Valor Anterior
                                <SortIcon field="previousValue" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-right cursor-pointer select-none hover:bg-muted/80 transition-colors"
                              onClick={() => handleSort('newValue')}
                            >
                              <div className="flex items-center justify-end">
                                Novo Valor
                                <SortIcon field="newValue" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-center cursor-pointer select-none hover:bg-muted/80 transition-colors"
                              onClick={() => handleSort('changePercent')}
                            >
                              <div className="flex items-center justify-center">
                                Variação
                                <SortIcon field="changePercent" />
                              </div>
                            </TableHead>
                            <TableHead>Alterado por</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredItems.map((item) => (
                            <TableRow key={item.id} className="hover:bg-muted/30">
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDate(item.createdAt)}
                              </TableCell>
                              <TableCell className="font-medium max-w-[250px] truncate" title={item.productName}>
                                {item.productName}
                              </TableCell>
                              <TableCell>
                                {item.changeType === 'PRECO_VENDA' ? (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                    <DollarSign className="h-3 w-3 mr-1" />
                                    Venda
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                    <BarChart3 className="h-3 w-3 mr-1" />
                                    Custo
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {item.channelName}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {item.previousValue ? formatCurrency(item.previousValue) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm font-medium">
                                {formatCurrency(item.newValue)}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {getChangeIcon(item.changePercent)}
                                  {getChangeBadge(item.changePercent)}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.userName || 'Sistema'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {/* Paginação */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t">
                        <p className="text-sm text-muted-foreground">
                          Mostrando {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, historyData?.total || 0)} de {historyData?.total || 0} registros
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm font-medium">
                            {page} / {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="mais-alterados" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Produtos com Mais Alterações de Preço</CardTitle>
              </CardHeader>
              <CardContent>
                {!statsData?.mostChanged?.length ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
                    <p>Nenhum dado disponível ainda</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Alterações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statsData.mostChanged.map((item, idx) => (
                        <TableRow key={item.productId}>
                          <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">
                            {productMap.get(item.productId) || `Produto #${item.productId}`}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{item.changeCount}x</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
