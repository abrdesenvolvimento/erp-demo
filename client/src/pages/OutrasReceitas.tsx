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
import { Plus, Pencil, Trash2, Loader2, DollarSign, Calendar, Building2, FileText, Check, ChevronsUpDown } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

// Obter mês de competência a partir de uma data
const getCompetenceMonth = (date: string) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Obter mês de competência atual
const getCurrentCompetenceMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// Formatar competência para exibição
const formatCompetence = (competence: string) => {
  const [year, month] = competence.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return format(date, 'MMM/yy', { locale: ptBR });
};

// Verificar se pode usar competência do mês anterior (até dia 5)
const canUseLastMonthCompetence = () => {
  const today = new Date();
  return today.getDate() <= 5;
};

// Obter último dia do mês anterior
const getLastDayOfPreviousMonth = () => {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
  return lastDay.toISOString().split('T')[0];
};

// Status badge
const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    ACTIVE: { label: "Ativo", variant: "default" },
    CANCELLED: { label: "Cancelado", variant: "destructive" },
  };
  const { label, variant } = variants[status] || { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
};

// Tipos de documento
const DOCUMENT_TYPES = [
  { value: "CONTRATO", label: "Contrato" },
  { value: "NOTA_FISCAL", label: "Nota Fiscal" },
  { value: "CUPOM", label: "Cupom" },
  { value: "FATURA", label: "Fatura" },
  { value: "RECIBO", label: "Recibo" },
  { value: "BOLETO", label: "Boleto" },
  { value: "OUTROS", label: "Outros" },
];

// Formas de recebimento
const PAYMENT_METHODS = [
  { value: "CREDITO_CONTA", label: "Crédito em Conta" },
  { value: "PIX", label: "PIX" },
  { value: "BOLETO", label: "Boleto" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "TRANSFERENCIA", label: "Transferência Bancária" },
  { value: "CARTAO_CREDITO", label: "Cartão de Crédito" },
  { value: "CARTAO_DEBITO", label: "Cartão de Débito" },
];

interface OtherRevenueForm {
  id?: number;
  partnerId: string;
  issueDate: string;
  entryDate: string;
  competenceMonth: string;
  documentType: string;
  documentNumber: string;
  managementAccountId: string;
  description: string;
  creditDate: string;
  paymentMethod: string;
  notes: string;
  amount: string;
  status: "ACTIVE" | "CANCELLED";
}

const getEmptyForm = (): OtherRevenueForm => ({
  partnerId: "",
  issueDate: new Date().toISOString().split('T')[0],
  entryDate: new Date().toISOString().split('T')[0],
  competenceMonth: getCurrentCompetenceMonth(),
  documentType: "",
  documentNumber: "",
  managementAccountId: "",
  description: "",
  creditDate: "",
  paymentMethod: "",
  notes: "",
  amount: "",
  status: "ACTIVE",
});

export default function OutrasReceitas() {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRevenue, setSelectedRevenue] = useState<OtherRevenueForm>(getEmptyForm());
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState(getCurrentCompetenceMonth());

  // Estados para autocomplete
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [managementAccountOpen, setManagementAccountOpen] = useState(false);
  const [managementAccountSearch, setManagementAccountSearch] = useState("");

  // Queries
  const { data: revenues, isLoading, refetch } = trpc.accounting.listOtherRevenues.useQuery({ 
    competenceMonth: filterMonth 
  });
  const { data: partners } = trpc.partners.list.useQuery();
  const { data: managementAccounts = [] } = trpc.accounting.listManagementAccounts.useQuery();

  // Mutations
  const createMutation = trpc.accounting.createOtherRevenue.useMutation({
    onSuccess: () => {
      toast.success("Receita criada com sucesso!");
      refetch();
      setIsDialogOpen(false);
      setSelectedRevenue(getEmptyForm());
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
      setSelectedRevenue(getEmptyForm());
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

  // Parceiros (fornecedores/clientes)
  const allPartners = useMemo(() => {
    if (!partners) return [];
    return partners.filter(p => p.active !== false);
  }, [partners]);

  // Contas gerenciais de receita (nature = RECEITA)
  const revenueManagementAccounts = useMemo(() => {
    return managementAccounts.filter(acc => acc.nature === 'RECEITA' && acc.isActive !== false);
  }, [managementAccounts]);

  // Totais
  const totals = useMemo(() => {
    if (!revenues) return { total: 0, active: 0, cancelled: 0 };
    return revenues.reduce((acc, rev) => {
      const amount = typeof rev.amount === 'number' ? rev.amount : parseFloat(String(rev.amount));
      if (rev.status === 'ACTIVE') {
        acc.total += amount;
        acc.active += amount;
      } else {
        acc.cancelled += amount;
      }
      return acc;
    }, { total: 0, active: 0, cancelled: 0 });
  }, [revenues]);

  // Handlers
  const handleNew = () => {
    setSelectedRevenue(getEmptyForm());
    setIsDialogOpen(true);
  };

  const handleEdit = (revenue: any) => {
    setSelectedRevenue({
      id: revenue.id,
      partnerId: revenue.partnerId?.toString() || "",
      issueDate: revenue.issueDate ? new Date(revenue.issueDate).toISOString().split('T')[0] : new Date(revenue.revenueDate).toISOString().split('T')[0],
      entryDate: revenue.entryDate ? new Date(revenue.entryDate).toISOString().split('T')[0] : new Date(revenue.revenueDate).toISOString().split('T')[0],
      competenceMonth: revenue.competenceMonth,
      documentType: revenue.documentType || "",
      documentNumber: revenue.documentNumber || "",
      managementAccountId: revenue.managementAccountId?.toString() || "",
      description: revenue.description,
      creditDate: revenue.creditDate ? new Date(revenue.creditDate).toISOString().split('T')[0] : "",
      paymentMethod: revenue.paymentMethod || "",
      notes: revenue.notes || "",
      amount: revenue.amount.toString(),
      status: revenue.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  // Atualizar competência quando entryDate muda
  const handleEntryDateChange = (newEntryDate: string) => {
    const competence = getCompetenceMonth(newEntryDate);
    setSelectedRevenue({ 
      ...selectedRevenue, 
      entryDate: newEntryDate,
      competenceMonth: competence
    });
  };

  const handleSubmit = () => {
    // Validações
    if (!selectedRevenue.partnerId) {
      toast.error("Fornecedor é obrigatório");
      return;
    }
    if (!selectedRevenue.description) {
      toast.error("Descrição é obrigatória");
      return;
    }
    if (!selectedRevenue.amount || parseFloat(selectedRevenue.amount) <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }
    if (!selectedRevenue.managementAccountId) {
      toast.error("Conta Gerencial é obrigatória");
      return;
    }
    if (!selectedRevenue.paymentMethod) {
      toast.error("Forma de Recebimento é obrigatória");
      return;
    }

    const data = {
      partnerId: parseInt(selectedRevenue.partnerId),
      issueDate: selectedRevenue.issueDate,
      entryDate: selectedRevenue.entryDate,
      competenceMonth: selectedRevenue.competenceMonth,
      documentType: selectedRevenue.documentType || undefined,
      documentNumber: selectedRevenue.documentNumber || undefined,
      managementAccountId: parseInt(selectedRevenue.managementAccountId),
      description: selectedRevenue.description,
      creditDate: selectedRevenue.creditDate || undefined,
      paymentMethod: selectedRevenue.paymentMethod,
      notes: selectedRevenue.notes || undefined,
      amount: parseFloat(selectedRevenue.amount),
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

  // Obter nome do parceiro
  const getPartnerName = (partnerId: number | null) => {
    if (!partnerId || !partners) return "-";
    const partner = partners.find(p => p.id === partnerId);
    return partner?.name || "-";
  };

  // Obter nome da conta gerencial
  const getManagementAccountName = (accountId: number | null) => {
    if (!accountId) return "-";
    const account = managementAccounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : "-";
  };

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
              <div className="text-sm text-muted-foreground">Receitas Ativas</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(totals.active)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Canceladas</div>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totals.cancelled)}
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
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Data Emissão</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Conta Gerencial</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenues.map((revenue) => (
                      <TableRow key={revenue.id}>
                        <TableCell className="font-medium">
                          {getPartnerName(revenue.partnerId)}
                        </TableCell>
                        <TableCell>
                          {revenue.issueDate ? formatDate(revenue.issueDate) : formatDate(revenue.revenueDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{formatCompetence(revenue.competenceMonth)}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{revenue.description}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getManagementAccountName(revenue.managementAccountId)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(revenue.amount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={revenue.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
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
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma receita encontrada para este período.</p>
                <Button variant="link" onClick={handleNew}>
                  Cadastrar nova receita
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Criar/Editar */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedRevenue.id ? "Editar Receita" : "Nova Receita"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da receita. Campos com * são obrigatórios.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Fornecedor */}
              <div>
                <Label>Fornecedor *</Label>
                <Popover open={partnerOpen} onOpenChange={setPartnerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={partnerOpen}
                      className="w-full justify-between"
                    >
                      {selectedRevenue.partnerId
                        ? (() => {
                            const partner = allPartners.find((p) => p.id.toString() === selectedRevenue.partnerId);
                            return partner ? partner.name : "Selecione...";
                          })()
                        : "Selecione o fornecedor..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[450px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar fornecedor..."
                        value={partnerSearch}
                        onValueChange={setPartnerSearch}
                      />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                        <CommandGroup>
                          {allPartners
                            .filter((partner) =>
                              partner.name.toLowerCase().includes(partnerSearch.toLowerCase())
                            )
                            .map((partner) => (
                              <CommandItem
                                key={partner.id}
                                value={partner.id.toString()}
                                onSelect={() => {
                                  setSelectedRevenue({ ...selectedRevenue, partnerId: partner.id.toString() });
                                  setPartnerOpen(false);
                                  setPartnerSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedRevenue.partnerId === partner.id.toString() ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{partner.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {partner.partnerType === 'SUPPLIER' ? 'Fornecedor' : 
                                     partner.partnerType === 'CUSTOMER' ? 'Cliente' : 'Fornecedor/Cliente'}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Data Emissão *</Label>
                  <Input
                    type="date"
                    value={selectedRevenue.issueDate}
                    onChange={(e) => setSelectedRevenue({ ...selectedRevenue, issueDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Data Entrada *</Label>
                  <Input
                    type="date"
                    value={selectedRevenue.entryDate}
                    onChange={(e) => handleEntryDateChange(e.target.value)}
                  />
                  {canUseLastMonthCompetence() && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Até dia 5, pode usar data do mês anterior
                    </p>
                  )}
                </div>
                <div>
                  <Label>Competência</Label>
                  <div className="h-10 px-3 py-2 border rounded-md bg-muted flex items-center">
                    <span className="font-medium">{formatCompetence(selectedRevenue.competenceMonth)}</span>
                  </div>
                </div>
              </div>

              {/* Tipo e Número do Documento */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo Documento</Label>
                  <Select
                    value={selectedRevenue.documentType}
                    onValueChange={(v) => setSelectedRevenue({ ...selectedRevenue, documentType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nº Documento</Label>
                  <Input
                    value={selectedRevenue.documentNumber}
                    onChange={(e) => setSelectedRevenue({ ...selectedRevenue, documentNumber: e.target.value })}
                    placeholder="Ex: 123456"
                  />
                </div>
              </div>

              {/* Conta Gerencial */}
              <div>
                <Label>Conta Gerencial *</Label>
                <Popover open={managementAccountOpen} onOpenChange={setManagementAccountOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={managementAccountOpen}
                      className="w-full justify-between"
                    >
                      {selectedRevenue.managementAccountId
                        ? (() => {
                            const acc = revenueManagementAccounts.find((a) => a.id.toString() === selectedRevenue.managementAccountId);
                            return acc ? `${acc.name} (${acc.code})` : "Selecione...";
                          })()
                        : "Selecione uma conta gerencial..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[450px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar conta gerencial..."
                        value={managementAccountSearch}
                        onValueChange={setManagementAccountSearch}
                      />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>Nenhuma conta gerencial encontrada.</CommandEmpty>
                        <CommandGroup>
                          {revenueManagementAccounts
                            .filter((acc) =>
                              acc.name.toLowerCase().includes(managementAccountSearch.toLowerCase()) ||
                              acc.code.toLowerCase().includes(managementAccountSearch.toLowerCase())
                            )
                            .map((acc) => (
                              <CommandItem
                                key={acc.id}
                                value={acc.id.toString()}
                                onSelect={() => {
                                  setSelectedRevenue({ ...selectedRevenue, managementAccountId: acc.id.toString() });
                                  setManagementAccountOpen(false);
                                  setManagementAccountSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedRevenue.managementAccountId === acc.id.toString() ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{acc.name}</div>
                                  <div className="text-xs text-muted-foreground flex gap-2">
                                    <span className="font-mono bg-muted px-1 rounded">{acc.code}</span>
                                    {acc.accountingCode && (
                                      <span className="text-green-600">• {acc.accountingCode}</span>
                                    )}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Descrição */}
              <div>
                <Label>Descrição *</Label>
                <Input
                  value={selectedRevenue.description}
                  onChange={(e) => setSelectedRevenue({ ...selectedRevenue, description: e.target.value })}
                  placeholder="Ex: Empréstimo Pronampe 2024 - Parcelamento 12x"
                />
              </div>

              {/* Data Crédito e Forma de Recebimento */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data de Crédito</Label>
                  <Input
                    type="date"
                    value={selectedRevenue.creditDate}
                    onChange={(e) => setSelectedRevenue({ ...selectedRevenue, creditDate: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Quando a receita entrou em caixa
                  </p>
                </div>
                <div>
                  <Label>Forma de Recebimento *</Label>
                  <Select
                    value={selectedRevenue.paymentMethod}
                    onValueChange={(v) => setSelectedRevenue({ ...selectedRevenue, paymentMethod: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(method => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Observação */}
              <div>
                <Label>Observação</Label>
                <Textarea
                  value={selectedRevenue.notes}
                  onChange={(e) => setSelectedRevenue({ ...selectedRevenue, notes: e.target.value })}
                  placeholder="Informações adicionais..."
                  rows={2}
                />
              </div>

              {/* Valor */}
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
                    className="text-lg font-semibold"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={selectedRevenue.status}
                    onValueChange={(v: "ACTIVE" | "CANCELLED") => 
                      setSelectedRevenue({ ...selectedRevenue, status: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Ativo</SelectItem>
                      <SelectItem value="CANCELLED">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {selectedRevenue.id ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Exclusão */}
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
