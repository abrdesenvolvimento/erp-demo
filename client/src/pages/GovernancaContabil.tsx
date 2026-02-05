import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Lock,
  Unlock,
  Calendar,
  Settings,
  History,
  Play,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Shield,
  FileText,
} from "lucide-react";

export default function GovernancaContabil() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  
  // States
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [showAccountingDialog, setShowAccountingDialog] = useState(false);
  const [isAccountingRunning, setIsAccountingRunning] = useState(false);
  const [accountingMonth, setAccountingMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // Queries
  const { data: settings, isLoading: loadingSettings } = trpc.governance.getSettings.useQuery();
  const { data: periods, isLoading: loadingPeriods } = trpc.governance.listPeriods.useQuery();
  const { data: auditHistory } = trpc.governance.getAuditHistory.useQuery({ limit: 50 });
  const { data: batchHistory } = trpc.governance.getBatchHistory.useQuery({ limit: 10 });
  const { data: lastBatch } = trpc.governance.getLastBatch.useQuery();
  
  // Mutations
  const updateSettings = trpc.governance.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Configurações atualizadas com sucesso");
      utils.governance.getSettings.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
  
  const closePeriod = trpc.governance.closePeriod.useMutation({
    onSuccess: () => {
      toast.success("Período fechado com sucesso");
      utils.governance.listPeriods.invalidate();
      utils.governance.getAuditHistory.invalidate();
      setShowCloseDialog(false);
    },
    onError: (error) => {
      toast.error(`Erro ao fechar período: ${error.message}`);
    },
  });
  
  const reopenPeriod = trpc.governance.reopenPeriod.useMutation({
    onSuccess: (data) => {
      toast.success(`Período reaberto! Expira em: ${new Date(data.expiresAt!).toLocaleString('pt-BR')}`);
      utils.governance.listPeriods.invalidate();
      utils.governance.getAuditHistory.invalidate();
      setShowReopenDialog(false);
      setReopenReason("");
    },
    onError: (error) => {
      toast.error(`Erro ao reabrir período: ${error.message}`);
    },
  });
  
  // Handlers
  const handleClosePeriod = () => {
    if (!selectedPeriod) return;
    closePeriod.mutate({ competenceMonth: selectedPeriod });
  };
  
  const handleReopenPeriod = () => {
    if (!selectedPeriod || reopenReason.length < 20) return;
    reopenPeriod.mutate({ competenceMonth: selectedPeriod, reason: reopenReason });
  };
  
  const handleUpdateSetting = (key: string, value: any) => {
    updateSettings.mutate({ [key]: value });
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Unlock className="w-3 h-3 mr-1" />Aberto</Badge>;
      case "CLOSED":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><Lock className="w-3 h-3 mr-1" />Fechado</Badge>;
      case "REOPENED":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><RefreshCw className="w-3 h-3 mr-1" />Reaberto</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getActionBadge = (action: string) => {
    const actionMap: Record<string, { label: string; color: string }> = {
      SETTINGS_CHANGED: { label: "Config. Alterada", color: "bg-blue-50 text-blue-700" },
      PERIOD_CLOSED: { label: "Período Fechado", color: "bg-red-50 text-red-700" },
      PERIOD_REOPENED: { label: "Período Reaberto", color: "bg-yellow-50 text-yellow-700" },
      PERIOD_AUTO_CLOSED: { label: "Fechamento Auto", color: "bg-orange-50 text-orange-700" },
      ACCOUNTING_BATCH_RUN: { label: "Contabilização", color: "bg-purple-50 text-purple-700" },
      ACCOUNTING_MANUAL_RUN: { label: "Contab. Manual", color: "bg-indigo-50 text-indigo-700" },
      EDIT_BLOCKED: { label: "Edição Bloqueada", color: "bg-gray-50 text-gray-700" },
      DELETE_BLOCKED: { label: "Exclusão Bloqueada", color: "bg-gray-50 text-gray-700" },
    };
    const config = actionMap[action] || { label: action, color: "bg-gray-50 text-gray-700" };
    return <Badge variant="outline" className={config.color}>{config.label}</Badge>;
  };
  
  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(m) - 1]}/${year}`;
  };
  
  if (user?.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Shield className="w-5 h-5" />
                Acesso Restrito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Esta área é restrita a administradores do sistema.
              </p>
            </CardContent>
          </Card>
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
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Governança Contábil
            </h1>
            <p className="text-muted-foreground">
              Gerencie períodos contábeis, travas de edição e contabilização em lote
            </p>
          </div>
          <Button
            onClick={() => setShowAccountingDialog(true)}
            className="gap-2"
          >
            <Play className="w-4 h-4" />
            Contabilizar Agora
          </Button>
        </div>
        
        {/* Tabs */}
        <Tabs defaultValue="periods" className="space-y-4">
          <TabsList>
            <TabsTrigger value="periods" className="gap-2">
              <Calendar className="w-4 h-4" />
              Períodos
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
          </TabsList>
          
          {/* Períodos Contábeis */}
          <TabsContent value="periods" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Períodos Contábeis</CardTitle>
                <CardDescription>
                  Gerencie o status dos períodos contábeis. Períodos fechados bloqueiam edições.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPeriods ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : periods && periods.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Fechado em</TableHead>
                        <TableHead>Reaberturas</TableHead>
                        <TableHead>Expira em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periods.map((period) => (
                        <TableRow key={period.id}>
                          <TableCell className="font-medium">
                            {formatMonth(period.competenceMonth)}
                          </TableCell>
                          <TableCell>{getStatusBadge(period.status)}</TableCell>
                          <TableCell>
                            {period.closedAt 
                              ? new Date(period.closedAt).toLocaleDateString('pt-BR')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {period.reopenCount > 0 ? (
                              <Badge variant="outline" className="bg-yellow-50">
                                {period.reopenCount}/{settings?.maxReopenCount || 2}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {period.status === 'REOPENED' && period.reopenExpiresAt ? (
                              <span className="text-yellow-600 text-sm">
                                {new Date(period.reopenExpiresAt).toLocaleString('pt-BR')}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {period.status === 'OPEN' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPeriod(period.competenceMonth);
                                  setShowCloseDialog(true);
                                }}
                                className="gap-1"
                              >
                                <Lock className="w-3 h-3" />
                                Fechar
                              </Button>
                            ) : period.status === 'CLOSED' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPeriod(period.competenceMonth);
                                  setShowReopenDialog(true);
                                }}
                                className="gap-1"
                                disabled={period.reopenCount >= (settings?.maxReopenCount || 2)}
                              >
                                <Unlock className="w-3 h-3" />
                                Reabrir
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPeriod(period.competenceMonth);
                                  setShowCloseDialog(true);
                                }}
                                className="gap-1"
                              >
                                <Lock className="w-3 h-3" />
                                Fechar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum período contábil encontrado.</p>
                    <p className="text-sm">Os períodos são criados automaticamente ao registrar transações.</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Último Batch */}
            {lastBatch && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Última Contabilização</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Competência</p>
                      <p className="font-medium">{formatMonth(lastBatch.competenceMonth)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tipo</p>
                      <Badge variant="outline">
                        {lastBatch.batchType === 'SCHEDULED' ? 'Agendada' : 'Manual'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge 
                        variant="outline"
                        className={
                          lastBatch.status === 'SUCCESS' ? 'bg-green-50 text-green-700' :
                          lastBatch.status === 'FAILED' ? 'bg-red-50 text-red-700' :
                          lastBatch.status === 'RUNNING' ? 'bg-blue-50 text-blue-700' :
                          'bg-yellow-50 text-yellow-700'
                        }
                      >
                        {lastBatch.status === 'SUCCESS' ? 'Sucesso' :
                         lastBatch.status === 'FAILED' ? 'Falhou' :
                         lastBatch.status === 'RUNNING' ? 'Executando' : 'Parcial'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Data</p>
                      <p className="font-medium">
                        {new Date(lastBatch.startedAt!).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {lastBatch.status === 'SUCCESS' && (
                    <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Vendas</p>
                        <p className="font-bold">{lastBatch.salesProcessed}</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Despesas</p>
                        <p className="font-bold">{lastBatch.expensesProcessed}</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Compras</p>
                        <p className="font-bold">{lastBatch.purchasesProcessed}</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Outras Rec.</p>
                        <p className="font-bold">{lastBatch.otherRevenuesProcessed}</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Journals</p>
                        <p className="font-bold">{lastBatch.journalsCreated}</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Lançamentos</p>
                        <p className="font-bold">{lastBatch.entriesCreated}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Configurações */}
          <TabsContent value="settings" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Janelas de Edição */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Janelas de Edição
                  </CardTitle>
                  <CardDescription>
                    Defina o prazo máximo para edição após a criação do registro
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Vendas (horas)</Label>
                    <Input
                      type="number"
                      value={settings?.salesEditWindowHours || 72}
                      onChange={(e) => handleUpdateSetting('salesEditWindowHours', parseInt(e.target.value))}
                      min={1}
                      max={720}
                    />
                    <p className="text-xs text-muted-foreground">
                      Padrão: 72h (3 dias)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Despesas (dias)</Label>
                    <Input
                      type="number"
                      value={settings?.expensesEditWindowDays || 3}
                      onChange={(e) => handleUpdateSetting('expensesEditWindowDays', parseInt(e.target.value))}
                      min={1}
                      max={30}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Compras (dias)</Label>
                    <Input
                      type="number"
                      value={settings?.purchasesEditWindowDays || 3}
                      onChange={(e) => handleUpdateSetting('purchasesEditWindowDays', parseInt(e.target.value))}
                      min={1}
                      max={30}
                    />
                  </div>
                </CardContent>
              </Card>
              
              {/* Competência Retroativa */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Competência Retroativa
                  </CardTitle>
                  <CardDescription>
                    Regras para lançamentos em competências anteriores
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Permitir Retroação</Label>
                      <p className="text-xs text-muted-foreground">
                        Permite lançar em meses anteriores
                      </p>
                    </div>
                    <Switch
                      checked={settings?.allowRetroactivePosting ?? true}
                      onCheckedChange={(checked) => handleUpdateSetting('allowRetroactivePosting', checked)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Limite (dia do mês)</Label>
                    <Input
                      type="number"
                      value={settings?.retroactiveLimitDay || 5}
                      onChange={(e) => handleUpdateSetting('retroactiveLimitDay', parseInt(e.target.value))}
                      min={1}
                      max={15}
                    />
                    <p className="text-xs text-muted-foreground">
                      Até o dia {settings?.retroactiveLimitDay || 5} pode retroagir ao mês anterior
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              {/* Reabertura de Períodos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Reabertura de Períodos
                  </CardTitle>
                  <CardDescription>
                    Controles para reabertura de períodos fechados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Máximo de Reaberturas</Label>
                    <Input
                      type="number"
                      value={settings?.maxReopenCount || 2}
                      onChange={(e) => handleUpdateSetting('maxReopenCount', parseInt(e.target.value))}
                      min={1}
                      max={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Janela de Reabertura (horas)</Label>
                    <Input
                      type="number"
                      value={settings?.reopenWindowHours || 48}
                      onChange={(e) => handleUpdateSetting('reopenWindowHours', parseInt(e.target.value))}
                      min={1}
                      max={168}
                    />
                    <p className="text-xs text-muted-foreground">
                      Período fecha automaticamente após {settings?.reopenWindowHours || 48}h
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo Máximo (dias após fechamento)</Label>
                    <Input
                      type="number"
                      value={settings?.maxReopenDaysAfterClose || 30}
                      onChange={(e) => handleUpdateSetting('maxReopenDaysAfterClose', parseInt(e.target.value))}
                      min={1}
                      max={90}
                    />
                  </div>
                </CardContent>
              </Card>
              
              {/* Contabilização Automática */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Contabilização Automática
                  </CardTitle>
                  <CardDescription>
                    Agendamento da contabilização em lote
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Habilitada</Label>
                      <p className="text-xs text-muted-foreground">
                        Executa automaticamente no horário definido
                      </p>
                    </div>
                    <Switch
                      checked={settings?.autoAccountingEnabled ?? true}
                      onCheckedChange={(checked) => handleUpdateSetting('autoAccountingEnabled', checked)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dia da Semana</Label>
                    <Select
                      value={String(settings?.autoAccountingDay ?? 0)}
                      onValueChange={(value) => handleUpdateSetting('autoAccountingDay', parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Domingo</SelectItem>
                        <SelectItem value="1">Segunda-feira</SelectItem>
                        <SelectItem value="2">Terça-feira</SelectItem>
                        <SelectItem value="3">Quarta-feira</SelectItem>
                        <SelectItem value="4">Quinta-feira</SelectItem>
                        <SelectItem value="5">Sexta-feira</SelectItem>
                        <SelectItem value="6">Sábado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Select
                      value={String(settings?.autoAccountingHour ?? 3)}
                      onValueChange={(value) => handleUpdateSetting('autoAccountingHour', parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {String(i).padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Histórico */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Auditoria</CardTitle>
                <CardDescription>
                  Registro de todas as ações de governança contábil
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditHistory && auditHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Entidade</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Justificativa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditHistory.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {new Date(log.createdAt!).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell>{getActionBadge(log.action)}</TableCell>
                          <TableCell>
                            {log.entityType ? (
                              <span className="text-sm">
                                {log.entityType} #{log.entityId}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.userName || log.userId}
                          </TableCell>
                          <TableCell className="text-sm max-w-xs truncate">
                            {log.reason || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum registro de auditoria encontrado.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Dialog: Fechar Período */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-500" />
              Fechar Período Contábil
            </DialogTitle>
            <DialogDescription>
              Ao fechar o período <strong>{selectedPeriod && formatMonth(selectedPeriod)}</strong>, 
              não será mais possível editar ou excluir registros desta competência.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">Atenção</p>
                <p className="text-yellow-700">
                  Esta ação pode ser revertida através da opção "Reabrir", 
                  limitada a {settings?.maxReopenCount || 2} reaberturas por período.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleClosePeriod}
              disabled={closePeriod.isPending}
            >
              {closePeriod.isPending ? "Fechando..." : "Confirmar Fechamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog: Reabrir Período */}
      <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-yellow-500" />
              Reabrir Período Contábil
            </DialogTitle>
            <DialogDescription>
              Reabrir o período <strong>{selectedPeriod && formatMonth(selectedPeriod)}</strong> 
              para permitir alterações por tempo limitado.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">Janela de Reabertura</p>
                <p className="text-blue-700">
                  O período ficará aberto por {settings?.reopenWindowHours || 48} horas 
                  e será fechado automaticamente após esse prazo.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Justificativa (mínimo 20 caracteres) *</Label>
              <Textarea
                id="reason"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Descreva o motivo da reabertura..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {reopenReason.length}/20 caracteres
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReopenDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleReopenPeriod}
              disabled={reopenPeriod.isPending || reopenReason.length < 20}
            >
              {reopenPeriod.isPending ? "Reabrindo..." : "Confirmar Reabertura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog: Contabilizar Agora */}
      <Dialog open={showAccountingDialog} onOpenChange={setShowAccountingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" />
              Contabilizar Agora
            </DialogTitle>
            <DialogDescription>
              Execute a contabilização em lote manualmente para uma competência específica.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Competência</Label>
              <Input
                type="month"
                value={accountingMonth}
                onChange={(e) => setAccountingMonth(e.target.value)}
              />
            </div>
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">O que será processado</p>
                <ul className="text-blue-700 list-disc list-inside mt-1">
                  <li>Vendas não contabilizadas</li>
                  <li>Despesas não contabilizadas</li>
                  <li>Compras confirmadas não contabilizadas</li>
                  <li>Outras receitas não contabilizadas</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccountingDialog(false)} disabled={isAccountingRunning}>
              Cancelar
            </Button>
            <Button 
              onClick={async () => {
                setIsAccountingRunning(true);
                try {
                  const response = await fetch('/api/accounting-scheduler/trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ competenceMonth: accountingMonth }),
                  });
                  const result = await response.json();
                  if (result.success) {
                    toast.success(`Contabilização concluída! Journals: ${result.journalsCreated}, Lançamentos: ${result.entriesCreated}`);
                    utils.governance.getBatchHistory.invalidate();
                    utils.governance.getLastBatch.invalidate();
                  } else {
                    toast.error(`Erro: ${result.errors?.join(', ') || result.error || 'Falha desconhecida'}`);
                  }
                } catch (error: any) {
                  toast.error(`Erro ao executar contabilização: ${error.message}`);
                } finally {
                  setIsAccountingRunning(false);
                  setShowAccountingDialog(false);
                }
              }}
              disabled={isAccountingRunning}
            >
              {isAccountingRunning ? "Executando..." : "Executar Contabilização"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
