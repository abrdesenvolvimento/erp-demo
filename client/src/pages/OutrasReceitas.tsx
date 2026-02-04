import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Pencil, Trash2, Loader2, DollarSign, Calendar, Building2, FileText } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

// Formatação de valores monetários
const formatCurrency = (value: number | string) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numValue);
};

// Formatação de data
const formatDate = (date: Date | string) => {
  return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
};

// Obter mês de competência atual
const getCurrentCompetenceMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// Status badge
const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    PENDING: { label: "Pendente", variant: "secondary" },
    CONFIRMED: { label: "Confirmado", variant: "default" },
    CANCELLED: { label: "Cancelado", variant: "destructive" },
  };
  const { label, variant } = variants[status] || { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
};

interface OtherRevenueForm {
  id?: number;
  date: string;
  competenceMonth: string;
  description: string;
  amount: string;
  revenueAccountCode: string;
  bankAccountCode: string;
  partnerId: string;
  notes: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
}

const emptyForm: OtherRevenueForm = {
  date: new Date().toISOString().split('T')[0],
  competenceMonth: getCurrentCompetenceMonth(),
  description: "",
  amount: "",
  revenueAccountCode: "",
  bankAccountCode: "",
  partnerId: "",
  notes: "",
  status: "CONFIRMED",
};

export default function OutrasReceitas() {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRevenue, setSelectedRevenue] = useState<OtherRevenueForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState(getCurrentCompetenceMonth());

  // Queries
  const { data: revenues, isLoading, refetch } = trpc.accounting.listOtherRevenues.useQuery({ 
    competenceMonth: filterMonth 
  });
  const { data: chartOfAccounts } = trpc.accounting.listChartOfAccounts.useQuery();
  const { data: partners } = trpc.partners.list.useQuery();

  // Mutations
  const createMutation = trpc.accounting.createOtherRevenue.useMutation({
    onSuccess: () => {
      toast.success("Receita criada com sucesso!");
      refetch();
      setIsDialogOpen(false);
      setSelectedRevenue(emptyForm);
    },
    onError: (error) => {
      toast.error(`Erro ao criar receita: ${error.message}`);
    },
  });

  const updateMutation = trpc.accounting.updateOtherRevenue.useMutation({
    onSuccess: () => {
      toast.success("Receita atualizada com sucesso!");
      refetch();
      setIsDialogOpen(false);
      setSelectedRevenue(emptyForm);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar receita: ${error.message}`);
    },
  });

  const deleteMutation = trpc.accounting.deleteOtherRevenue.useMutation({
    onSuccess: () => {
      toast.success("Receita excluída com sucesso!");
      refetch();
      setIsDeleteDialogOpen(false);
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error(`Erro ao excluir receita: ${error.message}`);
    },
  });

  // Contas de receita (grupo 4) e banco (grupo 1.1)
  const revenueAccounts = useMemo(() => {
    if (!chartOfAccounts) return [];
    return chartOfAccounts.filter(acc => acc.code.startsWith('4') && acc.isAnalytical);
  }, [chartOfAccounts]);

  const bankAccounts = useMemo(() => {
    if (!chartOfAccounts) return [];
    return chartOfAccounts.filter(acc => acc.code.startsWith('1.1') && acc.isAnalytical);
  }, [chartOfAccounts]);

  // Clientes
  const clients = useMemo(() => {
    if (!partners) return [];
    return partners.filter(p => p.partnerType === 'CUSTOMER' || p.partnerType === 'BOTH');
  }, [partners]);

  // Totais
  const totals = useMemo(() => {
    if (!revenues) return { total: 0, confirmed: 0, pending: 0 };
    return revenues.reduce((acc, rev) => {
      const amount = typeof rev.amount === 'number' ? rev.amount : parseFloat(String(rev.amount));
      acc.total += amount;
      if (rev.status === 'CONFIRMED') acc.confirmed += amount;
      if (rev.status === 'PENDING') acc.pending += amount;
      return acc;
    }, { total: 0, confirmed: 0, pending: 0 });
  }, [revenues]);

  // Handlers
  const handleNew = () => {
    setSelectedRevenue(emptyForm);
    setIsDialogOpen(true);
  };

  const handleEdit = (revenue: any) => {
    setSelectedRevenue({
      id: revenue.id,
      date: new Date(revenue.date).toISOString().split('T')[0],
      competenceMonth: revenue.competenceMonth,
      description: revenue.description,
      amount: revenue.amount.toString(),
      revenueAccountCode: revenue.revenueAccountCode || "",
      bankAccountCode: revenue.bankAccountCode || "",
      partnerId: revenue.partnerId?.toString() || "",
      notes: revenue.notes || "",
      status: revenue.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    const data = {
      date: selectedRevenue.date,
      competenceMonth: selectedRevenue.competenceMonth,
      description: selectedRevenue.description,
      amount: parseFloat(selectedRevenue.amount) * 100, // Converter para centavos
      revenueAccountCode: selectedRevenue.revenueAccountCode || undefined,
      bankAccountCode: selectedRevenue.bankAccountCode || undefined,
      partnerId: selectedRevenue.partnerId ? parseInt(selectedRevenue.partnerId) : undefined,
      notes: selectedRevenue.notes || undefined,
      status: selectedRevenue.status,
    };

    if (selectedRevenue.id) {
      updateMutation.mutate({ id: selectedRevenue.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate({ id: deleteId });
    }
  };

  // Gerar opções de meses
  const monthOptions = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = -6; i <= 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = format(date, 'MMMM/yyyy', { locale: ptBR });
      months.push({ value, label });
    }
    return months;
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Outras Receitas</h1>
            <p className="text-muted-foreground">Receitas não vinculadas a vendas de produtos</p>
          </div>
          <Button onClick={handleNew} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Receita
          </Button>
        </div>

        {/* Filtros e Totais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label>Competência</Label>
              </div>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Total do Período</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totals.total)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Confirmado</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(totals.confirmed)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Pendente</div>
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(totals.pending)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle>Receitas do Período</CardTitle>
            <CardDescription>
              {revenues?.length || 0} receita(s) encontrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : revenues && revenues.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Conta Receita</TableHead>
                      <TableHead>Conta Banco</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenues.map((revenue) => (
                      <TableRow key={revenue.id}>
                        <TableCell>{formatDate(revenue.date)}</TableCell>
                        <TableCell className="max-w-xs truncate">{revenue.description}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {(revenue as any).revenueAccountCode || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {(revenue as any).bankAccountCode || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(revenue.amount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={revenue.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(revenue)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(revenue.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma receita encontrada para este período</p>
                <Button variant="outline" className="mt-4" onClick={handleNew}>
                  Adicionar primeira receita
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Criação/Edição */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedRevenue.id ? "Editar Receita" : "Nova Receita"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da receita. Campos com * são obrigatórios.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={selectedRevenue.date}
                    onChange={(e) => setSelectedRevenue({ ...selectedRevenue, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Competência *</Label>
                  <Select
                    value={selectedRevenue.competenceMonth}
                    onValueChange={(v) => setSelectedRevenue({ ...selectedRevenue, competenceMonth: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Descrição *</Label>
                <Input
                  value={selectedRevenue.description}
                  onChange={(e) => setSelectedRevenue({ ...selectedRevenue, description: e.target.value })}
                  placeholder="Ex: Aluguel de espaço, Bonificação fornecedor..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={selectedRevenue.amount}
                    onChange={(e) => setSelectedRevenue({ ...selectedRevenue, amount: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={selectedRevenue.status}
                    onValueChange={(v: "PENDING" | "CONFIRMED" | "CANCELLED") => 
                      setSelectedRevenue({ ...selectedRevenue, status: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                      <SelectItem value="PENDING">Pendente</SelectItem>
                      <SelectItem value="CANCELLED">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Conta de Receita</Label>
                  <Select
                    value={selectedRevenue.revenueAccountCode}
                    onValueChange={(v) => setSelectedRevenue({ ...selectedRevenue, revenueAccountCode: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {revenueAccounts.map(acc => (
                        <SelectItem key={acc.code} value={acc.code}>
                          {acc.code} - {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Conta de Banco</Label>
                  <Select
                    value={selectedRevenue.bankAccountCode}
                    onValueChange={(v) => setSelectedRevenue({ ...selectedRevenue, bankAccountCode: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map(acc => (
                        <SelectItem key={acc.code} value={acc.code}>
                          {acc.code} - {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Cliente/Parceiro</Label>
                <Select
                  value={selectedRevenue.partnerId}
                  onValueChange={(v) => setSelectedRevenue({ ...selectedRevenue, partnerId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={selectedRevenue.notes}
                  onChange={(e) => setSelectedRevenue({ ...selectedRevenue, notes: e.target.value })}
                  placeholder="Informações adicionais..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!selectedRevenue.description || !selectedRevenue.amount || createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {selectedRevenue.id ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir esta receita? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
