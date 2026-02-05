import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
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
import { Plus, Pencil, Trash2, Loader2, FileText, Check, ChevronLeft, X } from "lucide-react";
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

// Status badge
const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: "Ativo", className: "bg-green-100 text-green-700" },
    CANCELLED: { label: "Cancelado", className: "bg-red-100 text-red-700" },
  };
  const { label, className } = variants[status] || { label: status, className: "bg-gray-100 text-gray-700" };
  return <span className={cn("text-xs px-2 py-1 rounded-full", className)}>{label}</span>;
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
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRevenue, setSelectedRevenue] = useState<OtherRevenueForm>(getEmptyForm());
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Filtros ampliados
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterPartnerId, setFilterPartnerId] = useState<number | undefined>();
  const [filterPartnerOpen, setFilterPartnerOpen] = useState(false);
  const [filterPartnerSearch, setFilterPartnerSearch] = useState("");
  const [filterManagementAccountId, setFilterManagementAccountId] = useState<number | undefined>();
  const [filterManagementAccountOpen, setFilterManagementAccountOpen] = useState(false);
  const [filterManagementAccountSearch, setFilterManagementAccountSearch] = useState("");
  const [filterMinValue, setFilterMinValue] = useState("");
  const [filterMaxValue, setFilterMaxValue] = useState("");

  // Estados para autocomplete no formulário
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [managementAccountOpen, setManagementAccountOpen] = useState(false);
  const [managementAccountSearch, setManagementAccountSearch] = useState("");

  // Queries
  const { data: revenues, isLoading, refetch } = trpc.accounting.listOtherRevenues.useQuery({ 
    startDate: filterStartDate || undefined,
    endDate: filterEndDate || undefined,
    partnerId: filterPartnerId,
    managementAccountId: filterManagementAccountId,
  });
  const { data: partners } = trpc.partners.list.useQuery();
  const { data: managementAccounts = [] } = trpc.accounting.listManagementAccounts.useQuery();

  // Mutations
  const createMutation = trpc.accounting.createOtherRevenue.useMutation({
    onSuccess: () => {
      toast.success("Receita criada com sucesso!");
      refetch();
      setIsCreating(false);
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
      setIsCreating(false);
      setIsEditing(false);
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

  // Filtrar receitas localmente
  const filteredRevenues = useMemo(() => {
    if (!revenues) return [];
    return revenues.filter(rev => {
      // Filtro de valor mínimo
      if (filterMinValue && parseFloat(String(rev.amount)) < parseFloat(filterMinValue)) {
        return false;
      }
      // Filtro de valor máximo
      if (filterMaxValue && parseFloat(String(rev.amount)) > parseFloat(filterMaxValue)) {
        return false;
      }
      return true;
    });
  }, [revenues, filterMinValue, filterMaxValue]);

  // Totais
  const totals = useMemo(() => {
    if (!filteredRevenues) return { total: 0, active: 0, cancelled: 0 };
    return filteredRevenues.reduce((acc, rev) => {
      const amount = typeof rev.amount === 'number' ? rev.amount : parseFloat(String(rev.amount));
      if (rev.status === 'ACTIVE') {
        acc.total += amount;
        acc.active += amount;
      } else {
        acc.cancelled += amount;
      }
      return acc;
    }, { total: 0, active: 0, cancelled: 0 });
  }, [filteredRevenues]);

  // Handlers
  const handleNew = () => {
    setSelectedRevenue(getEmptyForm());
    setIsCreating(true);
    setIsEditing(false);
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
    setIsCreating(true);
    setIsEditing(true);
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
      toast.error("Parceiro é obrigatório");
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

  const resetForm = () => {
    setSelectedRevenue(getEmptyForm());
    setPartnerSearch("");
    setManagementAccountSearch("");
  };

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

  // Filtros de parceiros e contas gerenciais
  const filteredPartners = allPartners.filter(p => 
    p.name.toLowerCase().includes(partnerSearch.toLowerCase()) ||
    p.docNumber?.toLowerCase().includes(partnerSearch.toLowerCase())
  );

  const filteredManagementAccounts = revenueManagementAccounts.filter(a => 
    a.name.toLowerCase().includes(managementAccountSearch.toLowerCase()) ||
    a.code.toLowerCase().includes(managementAccountSearch.toLowerCase())
  );

  const selectedPartner = allPartners.find(p => p.id === parseInt(selectedRevenue.partnerId));
  const selectedManagementAccount = managementAccounts.find(a => a.id === parseInt(selectedRevenue.managementAccountId));

  // Tela de criação/edição
  if (isCreating) {
    return (
      <DashboardLayout>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="border-b bg-background sticky top-0 z-10">
            <div className="container py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (selectedRevenue.description || selectedRevenue.amount) {
                        if (confirm("Deseja descartar as alterações?")) {
                          setIsCreating(false);
                          setIsEditing(false);
                          resetForm();
                        }
                      } else {
                        setIsCreating(false);
                        setIsEditing(false);
                        resetForm();
                      }
                    }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <h1 className="text-2xl font-bold">{isEditing ? "Editar Receita" : "Nova Receita"}</h1>
                    <p className="text-sm text-muted-foreground">
                      {isEditing ? "Edite os dados da receita" : "Registre uma nova receita"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreating(false);
                      setIsEditing(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {isEditing ? "Salvar Alterações" : "Registrar Receita"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Formulário */}
          <div className="flex-1 overflow-auto">
            <div className="container py-6 space-y-6">
              {/* Dados do Documento */}
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Dados do Documento</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label>Data de Emissão</Label>
                    <Input
                      type="date"
                      value={selectedRevenue.issueDate}
                      onChange={(e) => setSelectedRevenue({ ...selectedRevenue, issueDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Data de Lançamento</Label>
                    <Input
                      type="date"
                      value={selectedRevenue.entryDate}
                      onChange={(e) => handleEntryDateChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Competência</Label>
                    <Input
                      type="month"
                      value={selectedRevenue.competenceMonth}
                      onChange={(e) => setSelectedRevenue({ ...selectedRevenue, competenceMonth: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Tipo de Documento</Label>
                    <Select 
                      value={selectedRevenue.documentType} 
                      onValueChange={(v) => setSelectedRevenue({ ...selectedRevenue, documentType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map(dt => (
                          <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Número do Documento</Label>
                    <Input
                      value={selectedRevenue.documentNumber}
                      onChange={(e) => setSelectedRevenue({ ...selectedRevenue, documentNumber: e.target.value })}
                      placeholder="Ex: 123456"
                    />
                  </div>
                </div>
              </div>

              {/* Parceiro */}
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Parceiro *</h3>
                <Popover open={partnerOpen} onOpenChange={setPartnerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedPartner ? selectedPartner.name : "Selecione o parceiro..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar parceiro..."
                        value={partnerSearch}
                        onValueChange={setPartnerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>Nenhum parceiro encontrado.</CommandEmpty>
                        <CommandGroup>
                          {filteredPartners.map((partner) => (
                            <CommandItem
                              key={partner.id}
                              value={partner.name}
                              onSelect={() => {
                                setSelectedRevenue({ ...selectedRevenue, partnerId: partner.id.toString() });
                                setPartnerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedRevenue.partnerId === partner.id.toString() ? "opacity-100" : "opacity-0")} />
                              <div>
                                <div>{partner.name}</div>
                                {partner.docNumber && (
                                  <div className="text-xs text-muted-foreground">{partner.docNumber}</div>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Conta Gerencial */}
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Conta Gerencial *</h3>
                <Popover open={managementAccountOpen} onOpenChange={setManagementAccountOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedManagementAccount 
                        ? `${selectedManagementAccount.code} - ${selectedManagementAccount.name}` 
                        : "Selecione a conta gerencial..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar conta gerencial..."
                        value={managementAccountSearch}
                        onValueChange={setManagementAccountSearch}
                      />
                      <CommandList>
                        <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                        <CommandGroup>
                          {filteredManagementAccounts.map((account) => (
                            <CommandItem
                              key={account.id}
                              value={account.name}
                              onSelect={() => {
                                setSelectedRevenue({ ...selectedRevenue, managementAccountId: account.id.toString() });
                                setManagementAccountOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedRevenue.managementAccountId === account.id.toString() ? "opacity-100" : "opacity-0")} />
                              <div>
                                <div>{account.code} - {account.name}</div>
                                {account.accountingCode && (
                                  <div className="text-xs text-muted-foreground">Conta contábil: {account.accountingCode}</div>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Informações da Receita */}
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Informações da Receita</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Descrição *</Label>
                    <Input
                      value={selectedRevenue.description}
                      onChange={(e) => setSelectedRevenue({ ...selectedRevenue, description: e.target.value })}
                      placeholder="Ex: Aluguel de espaço para evento"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Valor *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={selectedRevenue.amount}
                        onChange={(e) => setSelectedRevenue({ ...selectedRevenue, amount: e.target.value })}
                        placeholder="0,00"
                      />
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
                          {PAYMENT_METHODS.map(pm => (
                            <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Data de Crédito</Label>
                    <Input
                      type="date"
                      value={selectedRevenue.creditDate}
                      onChange={(e) => setSelectedRevenue({ ...selectedRevenue, creditDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Observações</h3>
                <Textarea
                  value={selectedRevenue.notes}
                  onChange={(e) => setSelectedRevenue({ ...selectedRevenue, notes: e.target.value })}
                  placeholder="Informações adicionais sobre a receita..."
                  rows={4}
                />
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Tela de listagem
  return (
    <DashboardLayout>
      <div className="container py-6">
        {/* Cards de Resumo - Acima do título */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Total Ativo</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.active)}</div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Total Cancelado</div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totals.cancelled)}</div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Receitas Encontradas</div>
            <div className="text-2xl font-bold">{filteredRevenues.length}</div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Outras Receitas</h1>
            <p className="text-muted-foreground">
              Receitas não vinculadas a vendas de produtos
            </p>
          </div>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Receita
          </Button>
        </div>

        {/* Filtros */}
        <div className="bg-card border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Data Final</Label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Parceiro</Label>
              <Popover open={filterPartnerOpen} onOpenChange={setFilterPartnerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {filterPartnerId
                      ? allPartners.find((p) => p.id === filterPartnerId)?.name
                      : "Todos"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar parceiro..."
                      value={filterPartnerSearch}
                      onValueChange={setFilterPartnerSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhum parceiro encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setFilterPartnerId(undefined);
                            setFilterPartnerOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !filterPartnerId ? "opacity-100" : "opacity-0")} />
                          Todos
                        </CommandItem>
                        {allPartners
                          .filter(p => p.name.toLowerCase().includes(filterPartnerSearch.toLowerCase()))
                          .map((partner) => (
                            <CommandItem
                              key={partner.id}
                              value={partner.name}
                              onSelect={() => {
                                setFilterPartnerId(partner.id);
                                setFilterPartnerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", filterPartnerId === partner.id ? "opacity-100" : "opacity-0")} />
                              {partner.name}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Conta Gerencial</Label>
              <Popover open={filterManagementAccountOpen} onOpenChange={setFilterManagementAccountOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {filterManagementAccountId
                      ? revenueManagementAccounts.find((a) => a.id === filterManagementAccountId)?.name
                      : "Todas"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar conta..."
                      value={filterManagementAccountSearch}
                      onValueChange={setFilterManagementAccountSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setFilterManagementAccountId(undefined);
                            setFilterManagementAccountOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !filterManagementAccountId ? "opacity-100" : "opacity-0")} />
                          Todas
                        </CommandItem>
                        {revenueManagementAccounts
                          .filter(a => a.name.toLowerCase().includes(filterManagementAccountSearch.toLowerCase()))
                          .map((account) => (
                            <CommandItem
                              key={account.id}
                              value={account.name}
                              onSelect={() => {
                                setFilterManagementAccountId(account.id);
                                setFilterManagementAccountOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", filterManagementAccountId === account.id ? "opacity-100" : "opacity-0")} />
                              {account.code} - {account.name}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Valor Mínimo</Label>
              <Input
                type="number"
                placeholder="R$ 0,00"
                value={filterMinValue}
                onChange={(e) => setFilterMinValue(e.target.value)}
              />
            </div>
            <div>
              <Label>Valor Máximo</Label>
              <Input
                type="number"
                placeholder="R$ 9999,99"
                value={filterMaxValue}
                onChange={(e) => setFilterMaxValue(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilterStartDate('');
                  setFilterEndDate('');
                  setFilterPartnerId(undefined);
                  setFilterManagementAccountId(undefined);
                  setFilterMinValue("");
                  setFilterMaxValue("");
                }}
                className="w-full"
              >
                Limpar Filtros
              </Button>
            </div>
          </div>
        </div>

        {/* Lista de receitas */}
        <div className="bg-card border rounded-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Receitas Cadastradas</h2>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRevenues.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma receita encontrada</p>
                <Button variant="link" onClick={handleNew}>
                  Cadastrar nova receita
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRevenues.map((revenue) => (
                  <div
                    key={revenue.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{revenue.description}</h3>
                          <StatusBadge status={revenue.status} />
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>Conta Gerencial: {getManagementAccountName(revenue.managementAccountId)}</div>
                          <div>Parceiro: {getPartnerName(revenue.partnerId)}</div>
                          <div>
                            Competência: {formatCompetence(revenue.competenceMonth)} | 
                            Data: {revenue.issueDate ? formatDate(revenue.issueDate) : formatDate(revenue.revenueDate)}
                          </div>
                          {revenue.paymentMethod && (
                            <div>Forma de Recebimento: {PAYMENT_METHODS.find(p => p.value === revenue.paymentMethod)?.label || revenue.paymentMethod}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-600">
                          {formatCurrency(revenue.amount)}
                        </div>
                        <div className="flex gap-1 mt-2 justify-end">
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
