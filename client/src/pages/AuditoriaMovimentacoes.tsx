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
import { 
  PackageOpen, Search, Filter, X, ChevronLeft, ChevronRight, Calendar,
  ArrowDownToLine, ArrowUpFromLine, RotateCcw, AlertTriangle, Wrench,
  BarChart3, Package, TrendingUp
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";

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

function formatQuantity(qty: number | string | null): string {
  if (qty === null || qty === undefined) return '0';
  const num = typeof qty === 'string' ? parseFloat(qty) : qty;
  if (isNaN(num)) return '0';
  // Se for inteiro, mostrar sem casas decimais
  if (Number.isInteger(num)) return num.toLocaleString('pt-BR');
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 });
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'ENTRADA':
      return <Badge className="bg-green-100 text-green-700 border-green-200"><ArrowDownToLine className="h-3 w-3 mr-1" />Entrada</Badge>;
    case 'SAIDA':
      return <Badge className="bg-red-100 text-red-700 border-red-200"><ArrowUpFromLine className="h-3 w-3 mr-1" />Saída</Badge>;
    case 'ESTORNO':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><RotateCcw className="h-3 w-3 mr-1" />Estorno</Badge>;
    case 'PERDA':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><AlertTriangle className="h-3 w-3 mr-1" />Perda</Badge>;
    case 'ACERTO':
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200"><Wrench className="h-3 w-3 mr-1" />Acerto</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'ENTRADA': return <ArrowDownToLine className="h-5 w-5 text-green-500" />;
    case 'SAIDA': return <ArrowUpFromLine className="h-5 w-5 text-red-500" />;
    case 'ESTORNO': return <RotateCcw className="h-5 w-5 text-blue-500" />;
    case 'PERDA': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case 'ACERTO': return <Wrench className="h-5 w-5 text-purple-500" />;
    default: return <Package className="h-5 w-5 text-gray-500" />;
  }
}

export default function AuditoriaMovimentacoes() {
  const { activeCompanyId } = useCompany();
  
  // Filtros - período padrão: últimos 30 dias
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [activeTab, setActiveTab] = useState('movimentacoes');
  
  // Queries
  const { data: movementsData, isLoading } = trpc.stockMovements.list.useQuery({
    type: typeFilter !== 'all' ? typeFilter as any : undefined,
    search: searchTerm || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize,
  });
  
  const { data: statsData } = trpc.stockMovements.stats.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });
  
  const totalPages = Math.ceil((movementsData?.total || 0) / pageSize);
  
  const hasActiveFilters = typeFilter !== 'all' || searchTerm || startDate || endDate;
  
  const clearFilters = () => {
    setTypeFilter('all');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Calcular estatísticas por tipo
  const statsByType = useMemo(() => {
    if (!statsData?.byType) return {};
    const map: Record<string, { count: number; totalQty: string }> = {};
    for (const item of statsData.byType) {
      map[item.type] = { count: Number(item.count), totalQty: item.totalQty || '0' };
    }
    return map;
  }, [statsData]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PackageOpen className="h-7 w-7 text-green-600" />
            Movimentações de Estoque
          </h1>
          <p className="text-muted-foreground mt-1">
            Auditoria de todas as entradas, saídas, estornos, perdas e acertos de estoque
          </p>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-gray-500" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-xl font-bold">{statsData?.totalMovements?.toLocaleString('pt-BR') || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownToLine className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Entradas</span>
              </div>
              <p className="text-xl font-bold text-green-600">{statsByType['ENTRADA']?.count?.toLocaleString('pt-BR') || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpFromLine className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Saídas</span>
              </div>
              <p className="text-xl font-bold text-red-600">{statsByType['SAIDA']?.count?.toLocaleString('pt-BR') || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <RotateCcw className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Estornos</span>
              </div>
              <p className="text-xl font-bold text-blue-600">{statsByType['ESTORNO']?.count?.toLocaleString('pt-BR') || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">Perdas</span>
              </div>
              <p className="text-xl font-bold text-amber-600">{statsByType['PERDA']?.count?.toLocaleString('pt-BR') || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
            <TabsTrigger value="ranking">Produtos Mais Movimentados</TabsTrigger>
          </TabsList>

          <TabsContent value="movimentacoes" className="space-y-4">
            {/* Filtros */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    Filtros:
                  </div>
                  
                  <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produto..."
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                      className="pl-9 h-9"
                    />
                  </div>

                  <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="ENTRADA">Entrada</SelectItem>
                      <SelectItem value="SAIDA">Saída</SelectItem>
                      <SelectItem value="ESTORNO">Estorno</SelectItem>
                      <SelectItem value="PERDA">Perda</SelectItem>
                      <SelectItem value="ACERTO">Acerto</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                      className="h-9 w-[140px]"
                      placeholder="Data início"
                    />
                    <span className="text-muted-foreground text-sm">até</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                      className="h-9 w-[140px]"
                      placeholder="Data fim"
                    />
                  </div>

                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                      <X className="h-4 w-4 mr-1" />
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tabela */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Data/Hora</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="w-[120px]">Tipo</TableHead>
                      <TableHead className="w-[120px] text-right">Quantidade</TableHead>
                      <TableHead className="w-[180px]">Documento</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead className="w-[140px]">Responsável</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Carregando movimentações...
                        </TableCell>
                      </TableRow>
                    ) : !movementsData?.movements?.length ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhuma movimentação encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      movementsData.movements.map((mov: any) => {
                        const qty = parseFloat(mov.quantity || '0');
                        return (
                          <TableRow key={mov.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(mov.date)}
                            </TableCell>
                            <TableCell className="font-medium">{mov.productName || `Produto #${mov.productId}`}</TableCell>
                            <TableCell>{getTypeBadge(mov.type)}</TableCell>
                            <TableCell className={`text-right font-mono font-medium ${qty > 0 ? 'text-green-600' : qty < 0 ? 'text-red-600' : ''}`}>
                              {qty > 0 ? '+' : ''}{formatQuantity(qty)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {mov.documentNumber || '—'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={mov.notes || ''}>
                              {mov.notes || '—'}
                            </TableCell>
                            <TableCell className="text-sm">{mov.userName || mov.userId || '—'}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {movementsData?.total?.toLocaleString('pt-BR')} movimentações encontradas
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ranking" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Top 10 Produtos Mais Movimentados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!statsData?.topProducts?.length ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum dado disponível</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="w-[150px] text-right">Total de Movimentações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statsData.topProducts.map((prod: any, idx: number) => (
                        <TableRow key={prod.productId}>
                          <TableCell>
                            <Badge variant={idx < 3 ? "default" : "outline"} className={idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-amber-700" : ""}>
                              {idx + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{prod.productName}</TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {Number(prod.count).toLocaleString('pt-BR')}
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
