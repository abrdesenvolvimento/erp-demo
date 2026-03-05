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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  FileText, Search, Filter, X, ChevronLeft, ChevronRight, Calendar,
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Eye,
  Package, Users, ClipboardList, ArrowRight
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

function getActionBadge(action: string) {
  switch (action) {
    case 'CRIACAO':
      return <Badge className="bg-green-100 text-green-700 border-green-200"><Plus className="h-3 w-3 mr-1" />Criação</Badge>;
    case 'EDICAO':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><Pencil className="h-3 w-3 mr-1" />Edição</Badge>;
    case 'EXCLUSAO':
      return <Badge className="bg-red-100 text-red-700 border-red-200"><Trash2 className="h-3 w-3 mr-1" />Exclusão</Badge>;
    case 'ATIVACAO':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><ToggleRight className="h-3 w-3 mr-1" />Ativação</Badge>;
    case 'DESATIVACAO':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><ToggleLeft className="h-3 w-3 mr-1" />Desativação</Badge>;
    default:
      return <Badge variant="outline">{action}</Badge>;
  }
}

function getEntityIcon(entityType: string) {
  switch (entityType) {
    case 'PRODUTO': return <Package className="h-4 w-4 text-blue-500" />;
    case 'PARCEIRO': return <Users className="h-4 w-4 text-purple-500" />;
    default: return <ClipboardList className="h-4 w-4 text-gray-500" />;
  }
}

function getEntityLabel(entityType: string) {
  switch (entityType) {
    case 'PRODUTO': return 'Produto';
    case 'PARCEIRO': return 'Parceiro';
    case 'DESPESA': return 'Despesa';
    case 'CATEGORIA': return 'Categoria';
    case 'VENDA': return 'Venda';
    case 'COMPRA': return 'Compra';
    default: return entityType;
  }
}

type ChangeDetail = {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
};

export default function LogAlteracoes() {
  const { activeCompanyId } = useCompany();
  
  // Filtros
  const [entityType, setEntityType] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [activeTab, setActiveTab] = useState('logs');
  
  // Dialog de detalhes
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  
  // Queries
  const { data: logsData, isLoading } = trpc.auditLog.list.useQuery({
    entityType: entityType !== 'all' ? entityType : undefined,
    action: actionFilter !== 'all' ? actionFilter : undefined,
    search: searchTerm || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize,
  });
  
  const { data: statsData } = trpc.auditLog.stats.useQuery();
  
  const totalPages = Math.ceil((logsData?.total || 0) / pageSize);
  
  const hasActiveFilters = entityType !== 'all' || actionFilter !== 'all' || searchTerm || startDate || endDate;
  
  const clearFilters = () => {
    setEntityType('all');
    setActionFilter('all');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const openDetail = (log: any) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6 text-amber-600" />
              Log de Alterações
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Rastreamento de todas as alterações feitas em cadastros do sistema
            </p>
          </div>
        </div>
        
        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de Registros</p>
                  <p className="text-2xl font-bold">{statsData?.totalLogs || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {statsData?.byAction?.slice(0, 3).map((item) => (
            <Card key={item.action}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    item.action === 'EDICAO' ? 'bg-blue-100' :
                    item.action === 'CRIACAO' ? 'bg-green-100' :
                    item.action === 'DESATIVACAO' ? 'bg-amber-100' :
                    item.action === 'ATIVACAO' ? 'bg-emerald-100' :
                    'bg-red-100'
                  }`}>
                    {item.action === 'EDICAO' ? <Pencil className="h-5 w-5 text-blue-600" /> :
                     item.action === 'CRIACAO' ? <Plus className="h-5 w-5 text-green-600" /> :
                     item.action === 'DESATIVACAO' ? <ToggleLeft className="h-5 w-5 text-amber-600" /> :
                     item.action === 'ATIVACAO' ? <ToggleRight className="h-5 w-5 text-emerald-600" /> :
                     <Trash2 className="h-5 w-5 text-red-600" />}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground capitalize">
                      {item.action === 'EDICAO' ? 'Edições' :
                       item.action === 'CRIACAO' ? 'Criações' :
                       item.action === 'EXCLUSAO' ? 'Exclusões' :
                       item.action === 'ATIVACAO' ? 'Ativações' :
                       'Desativações'}
                    </p>
                    <p className="text-2xl font-bold">{item.count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="logs">Todos os Registros</TabsTrigger>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
          </TabsList>
          
          <TabsContent value="logs" className="space-y-4">
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
                      placeholder="Buscar por nome..."
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                      className="pl-9 h-9"
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                  
                  <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="PRODUTO">Produto</SelectItem>
                      <SelectItem value="PARCEIRO">Parceiro</SelectItem>
                      <SelectItem value="DESPESA">Despesa</SelectItem>
                      <SelectItem value="CATEGORIA">Categoria</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="Ação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as ações</SelectItem>
                      <SelectItem value="CRIACAO">Criação</SelectItem>
                      <SelectItem value="EDICAO">Edição</SelectItem>
                      <SelectItem value="EXCLUSAO">Exclusão</SelectItem>
                      <SelectItem value="ATIVACAO">Ativação</SelectItem>
                      <SelectItem value="DESATIVACAO">Desativação</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                      className="h-9 w-[140px] text-xs"
                    />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                      className="h-9 w-[140px] text-xs"
                    />
                  </div>
                  
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs">
                      <X className="h-3 w-3 mr-1" />
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Tabela */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                  </div>
                ) : !logsData?.items?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-lg font-medium">Nenhum registro encontrado</p>
                    <p className="text-sm mt-1">
                      {logsData?.total === 0 
                        ? 'As alterações de cadastro serão registradas automaticamente a partir de agora.'
                        : 'Tente ajustar os filtros para encontrar registros.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Registro</TableHead>
                            <TableHead>Ação</TableHead>
                            <TableHead>Alterações</TableHead>
                            <TableHead>Usuário</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logsData.items.map((item: any) => {
                            const changes = item.changes || [];
                            return (
                              <TableRow key={item.id} className="hover:bg-muted/30">
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDate(item.createdAt)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    {getEntityIcon(item.entityType)}
                                    <span className="text-sm">{getEntityLabel(item.entityType)}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium max-w-[200px] truncate" title={item.entityName}>
                                  {item.entityName || `#${item.entityId}`}
                                </TableCell>
                                <TableCell>
                                  {getActionBadge(item.action)}
                                </TableCell>
                                <TableCell>
                                  {changes.length === 0 ? (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  ) : changes.length === 1 ? (
                                    <span className="text-xs">
                                      <span className="font-medium">{changes[0].label}</span>
                                      {changes[0].oldValue && (
                                        <>
                                          : <span className="text-muted-foreground line-through">{changes[0].oldValue.length > 20 ? changes[0].oldValue.slice(0, 20) + '...' : changes[0].oldValue}</span>
                                          {' '}<ArrowRight className="h-3 w-3 inline text-muted-foreground" />{' '}
                                        </>
                                      )}
                                      <span className="text-foreground">{changes[0].newValue && changes[0].newValue.length > 20 ? changes[0].newValue.slice(0, 20) + '...' : changes[0].newValue}</span>
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      {changes.length} campos alterados
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {item.userName || 'Sistema'}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => openDetail(item)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {/* Paginação */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t">
                        <p className="text-sm text-muted-foreground">
                          Mostrando {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, logsData?.total || 0)} de {logsData?.total || 0} registros
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
          
          <TabsContent value="resumo" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Por tipo de entidade */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Por Tipo de Registro</CardTitle>
                </CardHeader>
                <CardContent>
                  {!statsData?.byEntityType?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Registros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statsData.byEntityType.map((item) => (
                          <TableRow key={item.entityType}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getEntityIcon(item.entityType)}
                                <span>{getEntityLabel(item.entityType)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{item.count}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              
              {/* Usuários mais ativos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Usuários Mais Ativos (30 dias)</CardTitle>
                </CardHeader>
                <CardContent>
                  {!statsData?.recentUsers?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Usuário</TableHead>
                          <TableHead className="text-right">Alterações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statsData.recentUsers.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.userName || 'Sistema'}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{item.count}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Dialog de Detalhes */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              Detalhes da Alteração
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Data/Hora</p>
                  <p className="font-medium">{formatDate(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Usuário</p>
                  <p className="font-medium">{selectedLog.userName || 'Sistema'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Tipo</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {getEntityIcon(selectedLog.entityType)}
                    <span className="font-medium">{getEntityLabel(selectedLog.entityType)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Ação</p>
                  <div className="mt-0.5">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Registro</p>
                  <p className="font-medium">{selectedLog.entityName || `#${selectedLog.entityId}`}</p>
                </div>
              </div>
              
              {/* Campos alterados */}
              {selectedLog.changes?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Campos Alterados:</p>
                  <div className="space-y-2">
                    {selectedLog.changes.map((change: ChangeDetail, idx: number) => (
                      <div key={idx} className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{change.label}</p>
                        <div className="flex items-center gap-2 text-sm">
                          {change.oldValue ? (
                            <>
                              <span className="text-red-600 line-through bg-red-50 px-1.5 py-0.5 rounded text-xs">
                                {change.oldValue}
                              </span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            </>
                          ) : null}
                          <span className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded text-xs">
                            {change.newValue || '(vazio)'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
