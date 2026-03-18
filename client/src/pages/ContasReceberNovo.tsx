import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, DollarSign, Plus, FileDown, Loader2, MessageCircle, Search, Check, ChevronsUpDown, Users, ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { getTodayInBrazil, getNowInBrazil, formatDateBR, formatDateTimeBR } from "@shared/dateUtils";
import { getTodayBR } from "@/lib/dateUtils";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export default function ContasReceberNovo() {
  const permissions = usePermissions();
  const { activeCompanyId } = useCompany();

  // Query de contas bancárias
  const { data: bankAccounts } = trpc.accounting.bankAccounts.useQuery(
    { companyId: activeCompanyId || 1 },
    { enabled: !!activeCompanyId }
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDebitModal, setShowDebitModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState("");

  // Estados para autocomplete de cliente na tela principal
  const [clientOpen, setClientOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  // Estados para autocomplete de conta gerencial
  const [managementAccountOpen, setManagementAccountOpen] = useState(false);
  const [managementAccountSearch, setManagementAccountSearch] = useState("");
  const [managementAccountId, setManagementAccountId] = useState<number | undefined>();

  // Buscar contas gerenciais de receita
  const { data: managementAccounts = [] } = trpc.managementAccounts.list.useQuery({ nature: 'RECEITA' });

  // Buscar lista de clientes com saldo
  const { data: customers, isLoading: loadingCustomers, refetch: refetchCustomers } = 
    trpc.accountReceivable.customers.useQuery();

  // Buscar histórico do cliente selecionado
  const { data: history, isLoading: loadingHistory, refetch: refetchHistory } = 
    trpc.accountReceivable.history.useQuery(
      { customerId: selectedCustomerId! },
      { enabled: selectedCustomerId !== null }
    );

  // Mutation para registrar pagamento
  const registerPayment = trpc.accountReceivable.registerPayment.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado com sucesso!");
      setShowPaymentModal(false);
      refetchCustomers();
      refetchHistory();
      resetPaymentForm();
    },
    onError: (error) => {
      toast.error(`Erro ao registrar pagamento: ${error.message}`);
    }
  });

  // Mutation para registrar débito manual
  const registerDebit = trpc.accountReceivable.registerManualDebit.useMutation({
    onSuccess: () => {
      toast.success("Débito lançado com sucesso!");
      setShowDebitModal(false);
      refetchCustomers();
      refetchHistory();
      resetDebitForm();
    },
    onError: (error) => {
      toast.error(`Erro ao lançar débito: ${error.message}`);
    }
  });


  // Mutation para enviar via WhatsApp
  const sendViaWhatsApp = trpc.receivables.sendViaWhatsApp.useMutation({
    onSuccess: (data) => {
      toast.success(`Extrato enviado para ${data.customerName} via WhatsApp!`);
      setShowWhatsAppModal(false);
      setWhatsAppPhone("");
    },
    onError: (error) => {
      toast.error(`Erro ao enviar WhatsApp: ${error.message}`);
    }
  });

  // Mutation para exportar PDF
  const exportPDF = trpc.receivables.exportPDF.useMutation({
    onSuccess: (data) => {
      const binaryString = atob(data.pdf);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("PDF baixado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao gerar PDF: ${error.message}`);
    }
  });
// Form state - Pagamento
  const [paymentForm, setPaymentForm] = useState({
    paidDate: getTodayBR(),
    paidAmount: "",
    paymentMethod: "DINHEIRO",
    bankAccountId: undefined as number | undefined,
    notes: ""
  });

  const resetPaymentForm = () => {
    setPaymentForm({
      paidDate: getTodayBR(),
      paidAmount: "",
      paymentMethod: "DINHEIRO",
      bankAccountId: undefined,
      notes: ""
    });
  };

  // Form state - Débito Manual
  const [debitForm, setDebitForm] = useState({
    debitDate: getTodayBR(),
    debitAmount: "",
    description: "",
    notes: ""
  });

  const resetDebitForm = () => {
    setDebitForm({
      debitDate: getTodayBR(),
      debitAmount: "",
      description: "",
      notes: ""
    });
    setManagementAccountId(undefined);
    setManagementAccountSearch("");
  };

  const handlePaymentSubmit = () => {
    if (!selectedCustomerId) return;
    
    if (!paymentForm.paidAmount || parseFloat(paymentForm.paidAmount) <= 0) {
      toast.error("Valor do pagamento deve ser maior que zero");
      return;
    }

    // Se a data selecionada é hoje, usar horário atual; senão usar meio-dia
    const selectedDate = new Date(paymentForm.paidDate + "T00:00:00");
    const today = getTodayInBrazil();
    const isToday = selectedDate.toDateString() === today.toDateString();
    
    registerPayment.mutate({
      customerId: selectedCustomerId,
      paidDate: isToday ? getNowInBrazil() : new Date(paymentForm.paidDate + "T12:00:00"),
      paidAmount: paymentForm.paidAmount,
      paymentMethod: paymentForm.paymentMethod,
      bankAccountId: paymentForm.bankAccountId,
      notes: paymentForm.notes || undefined
    });
  };

  const handleDebitSubmit = () => {
    if (!selectedCustomerId) return;
    
    if (!debitForm.debitAmount || parseFloat(debitForm.debitAmount) <= 0) {
      toast.error("Valor do débito deve ser maior que zero");
      return;
    }

    if (!debitForm.description || debitForm.description.trim() === "") {
      toast.error("Descrição do débito é obrigatória");
      return;
    }

    // Se a data selecionada é hoje, usar horário atual; senão usar meio-dia
    const selectedDate = new Date(debitForm.debitDate + "T00:00:00");
    const today = getTodayInBrazil();
    const isToday = selectedDate.toDateString() === today.toDateString();
    
    registerDebit.mutate({
      customerId: selectedCustomerId,
      debitDate: isToday ? getNowInBrazil() : new Date(debitForm.debitDate + "T12:00:00"),
      debitAmount: debitForm.debitAmount,
      description: debitForm.description,
      managementAccountId: managementAccountId,
      notes: debitForm.notes || undefined
    });
  };

  // Filtrar clientes
  const filteredCustomers = customers || [];

  // Calcular total a receber
  const totalReceivable = customers?.reduce((sum, c) => sum + parseFloat(c.totalPending || "0"), 0) || 0;

  if (selectedCustomerId && history) {
    // Tela de histórico do cliente
    return (
      <DashboardLayout>
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => setSelectedCustomerId(null)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Conta Corrente - {history.customer.name}</CardTitle>
            <div className="flex justify-between items-center mt-4">
              <div className="flex gap-8">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Devedor</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(parseFloat(history.currentBalance))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Limite de Crédito</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(parseFloat(history.customer.creditLimit || "0"))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Crédito Disponível</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(Math.max(0, parseFloat(history.customer.creditLimit || "0") - parseFloat(history.currentBalance)))}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => selectedCustomerId && exportPDF.mutate({ customerId: selectedCustomerId })}
                  disabled={exportPDF.isPending}
                >
                  {exportPDF.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="mr-2 h-4 w-4" />
                  )}
                  {exportPDF.isPending ? 'Gerando...' : 'Exportar PDF'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowWhatsAppModal(true)}
                  className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp
                </Button>
                <Button 
                  onClick={() => setShowPaymentModal(true)}
                  disabled={!permissions.receivables.canRegisterPayment}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Registrar Pagamento
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowDebitModal(true)}
                  disabled={!permissions.receivables.canAddDebit}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Lançar Débito
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CompactHistoryTable history={history.history} />
          </CardContent>
        </Card>

        {/* Modal de Pagamento */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pagamento - {history.customer.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Data do Pagamento</Label>
                <Input
                  type="date"
                  value={paymentForm.paidDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paidDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentForm.paidAmount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paidAmount: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select
                    value={paymentForm.paymentMethod}
                    onValueChange={(value) => {
                      const caixaGeral = bankAccounts?.find(a => a.name.toLowerCase().includes('caixa'));
                      if (value === 'DINHEIRO' && caixaGeral) {
                        setPaymentForm({ ...paymentForm, paymentMethod: value, bankAccountId: caixaGeral.id });
                      } else {
                        setPaymentForm({ ...paymentForm, paymentMethod: value, bankAccountId: undefined });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="CARTAO_DEBITO">Cartão de Débito</SelectItem>
                      <SelectItem value="CARTAO_CREDITO">Cartão de Crédito</SelectItem>
                      <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {paymentForm.paymentMethod !== 'DINHEIRO' ? (
                  <div>
                    <Label>Banco/Conta *</Label>
                    <Select
                      value={paymentForm.bankAccountId?.toString() || ""}
                      onValueChange={(value) => setPaymentForm({ ...paymentForm, bankAccountId: value ? parseInt(value) : undefined })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta..." />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts?.filter(a => !a.name.toLowerCase().includes('caixa')).map((account) => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label>Banco/Conta</Label>
                    <Input value="Caixa Geral" disabled className="bg-muted" />
                  </div>
                )}
              </div>
              <div>
                <Label>Observações (opcional)</Label>
                <Input
                  placeholder="Ex: Pagamento parcial, referente à venda X..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handlePaymentSubmit} disabled={registerPayment.isPending}>
                  {registerPayment.isPending ? "Salvando..." : "Confirmar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Débito Manual */}
        <Dialog open={showDebitModal} onOpenChange={setShowDebitModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lançar Débito Manual - {history.customer.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Data do Débito</Label>
                <Input
                  type="date"
                  value={debitForm.debitDate}
                  onChange={(e) => setDebitForm({ ...debitForm, debitDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={debitForm.debitAmount}
                  onChange={(e) => setDebitForm({ ...debitForm, debitAmount: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição *</Label>
                <Input
                  placeholder="Ex: Empréstimo, Taxa de serviço, etc."
                  value={debitForm.description}
                  onChange={(e) => setDebitForm({ ...debitForm, description: e.target.value })}
                />
              </div>
              {/* Conta Gerencial com Autocomplete */}
              <div>
                <Label>Conta Gerencial (opcional)</Label>
                <Popover open={managementAccountOpen} onOpenChange={setManagementAccountOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={managementAccountOpen}
                      className="w-full justify-between"
                    >
                      {managementAccountId
                        ? managementAccounts.find(a => a.id === managementAccountId)?.name || "Selecione..."
                        : "Selecione uma conta gerencial..."}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar conta gerencial..."
                        value={managementAccountSearch}
                        onValueChange={setManagementAccountSearch}
                      />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                        <CommandGroup>
                          {managementAccounts
                            .filter(a => 
                              a.name.toLowerCase().includes(managementAccountSearch.toLowerCase()) ||
                              a.code.toLowerCase().includes(managementAccountSearch.toLowerCase())
                            )
                            .map((account) => (
                              <CommandItem
                                key={account.id}
                                value={account.id.toString()}
                                onSelect={() => {
                                  setManagementAccountId(account.id);
                                  setManagementAccountOpen(false);
                                  setManagementAccountSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    managementAccountId === account.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{account.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {account.code} • {account.accountingCode || 'Sem amarração'}
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
              <div>
                <Label>Observações (opcional)</Label>
                <Input
                  placeholder="Informações adicionais..."
                  value={debitForm.notes}
                  onChange={(e) => setDebitForm({ ...debitForm, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDebitModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleDebitSubmit} disabled={registerDebit.isPending}>
                  {registerDebit.isPending ? "Salvando..." : "Confirmar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Envio via WhatsApp */}
        <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                Enviar Extrato via WhatsApp
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Número do WhatsApp *</Label>
                <Input
                  placeholder="(11) 98765-4321"
                  value={whatsAppPhone}
                  onChange={(e) => setWhatsAppPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Digite o número com DDD. O extrato será enviado diretamente para este número.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowWhatsAppModal(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    if (!whatsAppPhone.trim()) {
                      toast.error("Digite o número de telefone");
                      return;
                    }
                    if (!selectedCustomerId) {
                      toast.error("Selecione um cliente");
                      return;
                    }
                    sendViaWhatsApp.mutate({
                      customerId: selectedCustomerId,
                      phoneNumber: whatsAppPhone
                    });
                  }}
                  disabled={sendViaWhatsApp.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {sendViaWhatsApp.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Enviar WhatsApp
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </DashboardLayout>
    );
  }

  // Tela de lista de clientes
  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Card de Total a Receber */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Pendente a Receber</p>
              <p className="text-3xl font-bold text-orange-600">{formatCurrency(totalReceivable)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {customers?.length || 0} cliente(s) com saldo devedor
              </p>
            </div>
            <DollarSign className="h-12 w-12 text-orange-600 opacity-20" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contas a Receber - Conta Corrente
          </CardTitle>
          <div className="mt-4">
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientOpen}
                  className="w-full justify-between"
                >
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  Buscar cliente por nome...
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Digite o nome do cliente..."
                    value={clientSearch}
                    onValueChange={setClientSearch}
                  />
                  <CommandList className="max-h-[400px]">
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup heading="Clientes com Saldo Devedor">
                      {(customers || [])
                        .filter(c =>
                          c.customerName?.toLowerCase().includes(clientSearch.toLowerCase())
                        )
                        .map((customer) => (
                          <CommandItem
                            key={customer.customerId}
                            value={customer.customerId.toString()}
                            onSelect={() => {
                              setSelectedCustomerId(customer.customerId);
                              setClientOpen(false);
                              setClientSearch("");
                            }}
                          >
                            <div className="flex-1 flex items-center justify-between">
                              <div>
                                <div className="font-medium">{customer.customerName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {customer.salesCount} transações
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-orange-600">
                                  {formatCurrency(parseFloat(customer.totalPending || "0"))}
                                </div>
                                <div className="text-xs text-muted-foreground">pendente</div>
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

        </CardHeader>
        <CardContent>
          {loadingCustomers ? (
            <p>Carregando...</p>
          ) : filteredCustomers.length === 0 ? (
            <p className="text-center text-muted-foreground">Nenhum cliente com saldo devedor</p>
          ) : (
            <div className="space-y-2">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.customerId}
                  onClick={() => setSelectedCustomerId(customer.customerId)}
                  className="flex justify-between items-center p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <div>
                    <p className="font-semibold">{customer.customerName}</p>
                  </div>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(parseFloat(customer.totalPending))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}

// ==================== Compact History Table ====================

function CompactHistoryTable({ history }: { history: any[] }) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const COMPACT_LIMIT = 15;

  const toggleRow = (index: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Reverse: most recent first. When truncated, show the last N items (newest).
  const reversed = useMemo(() => [...history].reverse(), [history]);
  const visibleHistory = showAll ? reversed : reversed.slice(0, COMPACT_LIMIT);
  const hasMore = history.length > COMPACT_LIMIT;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 w-8"></th>
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Descrição</th>
              <th className="text-right p-2">Débito</th>
              <th className="text-right p-2">Crédito</th>
              <th className="text-right p-2">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {visibleHistory.map((item, index) => {
              const hasProducts = item.type === 'SALE' && (item as any).items && (item as any).items.length > 0;
              const isExpanded = expandedRows.has(index);

              return (
                <>
                  {/* Linha principal compacta */}
                  <tr
                    key={`main-${index}`}
                    className={`border-b hover:bg-muted/50 ${hasProducts ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-muted/30' : ''}`}
                    onClick={() => hasProducts && toggleRow(index)}
                  >
                    <td className="p-2 text-center">
                      {hasProducts && (
                        isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground inline" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                      )}
                    </td>
                    <td className="p-2 text-sm whitespace-nowrap">
                      {item.date ? formatDateTimeBR(new Date(item.date)) : '-'}
                    </td>
                    <td className="p-2 text-sm">
                      <span className={`inline-flex items-center gap-1.5 ${
                        item.type === 'PAYMENT' ? 'text-green-700' :
                        item.type === 'DEBIT' ? 'text-red-700' : ''
                      }`}>
                        {item.type === 'SALE' && (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 mr-1">Venda</span>
                        )}
                        {item.type === 'PAYMENT' && (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 mr-1">Pgto</span>
                        )}
                        {item.type === 'DEBIT' && (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 mr-1">Débito</span>
                        )}
                        {item.description}
                        {(item.type === 'PAYMENT' || item.type === 'DEBIT') && (item as any).notes && (
                          <span className="text-xs text-muted-foreground">({(item as any).notes})</span>
                        )}
                        {hasProducts && (
                          <span className="text-xs text-muted-foreground ml-1">({(item as any).items.length} itens)</span>
                        )}
                      </span>
                    </td>
                    <td className="p-2 text-right text-sm text-red-600 font-medium">
                      {(item.type === 'SALE' || item.type === 'DEBIT') ? formatCurrency(parseFloat(item.amount)) : '-'}
                    </td>
                    <td className="p-2 text-right text-sm text-green-600 font-medium">
                      {item.type === 'PAYMENT' ? formatCurrency(parseFloat(item.amount)) : '-'}
                    </td>
                    <td className="p-2 text-right text-sm font-semibold">
                      {formatCurrency(parseFloat(item.balance))}
                    </td>
                  </tr>

                  {/* Linhas expandidas com detalhes dos produtos */}
                  {hasProducts && isExpanded && (item as any).items.map((product: any, pi: number) => (
                    <tr key={`detail-${index}-${pi}`} className="bg-muted/20 border-b border-dashed">
                      <td className="p-1"></td>
                      <td className="p-1"></td>
                      <td className="p-1 pl-6 text-xs text-muted-foreground">
                        {product.productName || '-'}
                        <span className="ml-2 text-muted-foreground/70">
                          {product.quantity}x {formatCurrency(parseFloat(product.unitPrice))}
                        </span>
                      </td>
                      <td className="p-1 text-right text-xs text-muted-foreground">
                        {formatCurrency(parseFloat(product.totalPrice))}
                      </td>
                      <td className="p-1"></td>
                      <td className="p-1"></td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Botão Ver Mais / Ver Menos */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-muted-foreground"
          >
            {showAll ? (
              <><EyeOff className="h-3 w-3 mr-1" /> Mostrar menos ({COMPACT_LIMIT} de {history.length})</>  
            ) : (
              <><Eye className="h-3 w-3 mr-1" /> Ver todos ({history.length} lançamentos)</>  
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
