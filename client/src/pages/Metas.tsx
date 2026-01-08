import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Target, Plus, Edit, TrendingUp, CheckCircle2, AlertCircle, History } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function Metas() {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  
  // Form state
  const [formMonth, setFormMonth] = useState(currentMonth);
  const [formChannelId, setFormChannelId] = useState<string>("geral");
  const [formTargetAmount, setFormTargetAmount] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const utils = trpc.useUtils();
  
  const { data: goals, isLoading: goalsLoading } = trpc.goals.list.useQuery({ year: selectedYear });
  const { data: channels } = trpc.salesChannels.list.useQuery();
  const { data: progress } = trpc.goals.progress.useQuery({ 
    year: currentYear, 
    month: currentMonth 
  });
  const { data: history, isLoading: historyLoading } = trpc.goals.history.useQuery({ year: selectedYear });

  const upsertMutation = trpc.goals.upsert.useMutation({
    onSuccess: () => {
      toast.success(editingGoal ? "Meta atualizada!" : "Meta criada!");
      utils.goals.list.invalidate();
      utils.goals.progress.invalidate();
      utils.goals.history.invalidate();
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao salvar meta: " + error.message);
    },
  });

  const handleOpenDialog = (goal?: any) => {
    if (goal) {
      setEditingGoal(goal);
      setFormMonth(goal.month);
      setFormChannelId(goal.channelId ? goal.channelId.toString() : "geral");
      setFormTargetAmount(goal.targetAmount.toString());
      setFormNotes(goal.notes || "");
    } else {
      setEditingGoal(null);
      setFormMonth(currentMonth);
      setFormChannelId("geral");
      setFormTargetAmount("");
      setFormNotes("");
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingGoal(null);
    setFormMonth(currentMonth);
    setFormChannelId("geral");
    setFormTargetAmount("");
    setFormNotes("");
  };

  const handleSubmit = () => {
    const targetAmount = parseFloat(formTargetAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(targetAmount) || targetAmount <= 0) {
      toast.error("Informe um valor válido para a meta");
      return;
    }

    upsertMutation.mutate({
      year: selectedYear,
      month: formMonth,
      channelId: formChannelId === "geral" ? null : parseInt(formChannelId),
      targetAmount,
      notes: formNotes || undefined,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getMonthName = (month: number) => {
    return MONTHS.find(m => m.value === month)?.label || "";
  };

  // Agrupar metas por mês
  const goalsByMonth = useMemo(() => {
    if (!goals) return {};
    return goals.reduce((acc: Record<number, any[]>, goal) => {
      if (!acc[goal.month]) acc[goal.month] = [];
      acc[goal.month].push(goal);
      return acc;
    }, {});
  }, [goals]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Metas de Faturamento
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure e acompanhe as metas mensais de faturamento
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Meta
            </Button>
          </div>
        </div>

        {/* Progresso do Mês Atual */}
        {progress && progress.goals.length > 0 && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Progresso de {getMonthName(currentMonth)} {currentYear}
              </CardTitle>
              <CardDescription>
                Acompanhamento em tempo real das metas do mês
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {progress.goals.map((goal) => (
                  <div 
                    key={goal.id} 
                    className={`p-4 rounded-lg border ${
                      goal.achieved 
                        ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" 
                        : "bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{goal.channelName}</span>
                      {goal.achieved ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : goal.progress >= 80 ? (
                        <TrendingUp className="h-5 w-5 text-amber-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Progress 
                        value={Math.min(goal.progress, 100)} 
                        className={`h-2 ${goal.achieved ? "[&>div]:bg-green-600" : ""}`}
                      />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {formatCurrency(goal.currentRevenue)}
                        </span>
                        <span className={`font-medium ${goal.achieved ? "text-green-600" : ""}`}>
                          {goal.progress.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Meta: {formatCurrency(goal.targetAmount)}
                        {!goal.achieved && (
                          <span className="ml-2">
                            (Faltam {formatCurrency(goal.remaining)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Metas */}
        <Card>
          <CardHeader>
            <CardTitle>Metas de {selectedYear}</CardTitle>
            <CardDescription>
              {goals?.length || 0} meta(s) configurada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {goalsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando metas...
              </div>
            ) : goals && goals.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead className="text-right">Meta</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MONTHS.map(month => {
                      const monthGoals = goalsByMonth[month.value] || [];
                      if (monthGoals.length === 0) return null;
                      
                      return monthGoals.map((goal, idx) => (
                        <TableRow key={goal.id}>
                          {idx === 0 && (
                            <TableCell 
                              rowSpan={monthGoals.length}
                              className="font-medium border-r"
                            >
                              {month.label}
                            </TableCell>
                          )}
                          <TableCell>{goal.channelName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(goal.targetAmount)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {goal.notes || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(goal)}
                                title="Editar meta"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ));
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">
                  Nenhuma meta configurada para {selectedYear}
                </p>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Meta
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico de Alterações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Alterações
            </CardTitle>
            <CardDescription>
              Últimas alterações nas metas de {selectedYear}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="text-center py-4 text-muted-foreground">Carregando histórico...</div>
            ) : history && history.length > 0 ? (
              <div className="space-y-3">
                {history.slice(0, 10).map((item: any) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Edit className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{item.changedByName || 'Usuário'}</span> alterou a meta de{' '}
                        <span className="font-medium">{getMonthName(item.month)}</span> ({item.channelName})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        De {formatCurrency(item.previousAmount)} para {formatCurrency(item.newAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma alteração registrada em {selectedYear}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Criação/Edição */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingGoal ? "Editar Meta" : "Nova Meta"}
              </DialogTitle>
              <DialogDescription>
                Configure a meta de faturamento mensal
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select 
                    value={formMonth.toString()} 
                    onValueChange={(v) => setFormMonth(parseInt(v))}
                    disabled={!!editingGoal}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(month => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Canal</Label>
                  <Select 
                    value={formChannelId} 
                    onValueChange={setFormChannelId}
                    disabled={!!editingGoal}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geral">Geral (Todos)</SelectItem>
                      {channels?.map(channel => (
                        <SelectItem key={channel.id} value={channel.id.toString()}>
                          {channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Valor da Meta (R$)</Label>
                <Input
                  type="text"
                  placeholder="Ex: 50.000,00"
                  value={formTargetAmount}
                  onChange={(e) => {
                    // Formatar como moeda
                    let value = e.target.value.replace(/\D/g, "");
                    if (value) {
                      value = (parseInt(value) / 100).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });
                    }
                    setFormTargetAmount(value);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Input
                  type="text"
                  placeholder="Ex: Meta baseada no histórico de 2024"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
