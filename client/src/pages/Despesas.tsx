import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Plus, Search, Check, ChevronLeft, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getTodayBR, toDateStringBR, getCurrentCompetenceMonthBR, addDaysBR } from "@/lib/dateUtils";
import { formatDateBR } from "@shared/dateUtils";

interface DueDate {
  date: string;
  amount: string;
}

const PAYMENT_METHODS = [
  "Boleto",
  "Crédito G",
  "Crédito R",
  "Crédito ABR",
  "À Vista",
  "Débito Automático",
  "Perdas"
];

export default function Despesas() {
  const { user } = useAuth();
  const { expenses: expensePermissions } = usePermissions();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  
  // Filter state - Iniciar sem filtro de data para mostrar todas as despesas
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState<number | undefined>();
  const [filterSupplierOpen, setFilterSupplierOpen] = useState(false);
  const [filterSupplierSearch, setFilterSupplierSearch] = useState("");
  const [filterDocNumber, setFilterDocNumber] = useState("");
  const [filterMinValue, setFilterMinValue] = useState("");
  const [filterMaxValue, setFilterMaxValue] = useState("");
  const [filterManagementAccountId, setFilterManagementAccountId] = useState<number | undefined>();
  const [filterManagementAccountOpen, setFilterManagementAccountOpen] = useState(false);
  const [filterManagementAccountSearch, setFilterManagementAccountSearch] = useState("");
  
  // Form state - Datas
  const [issueDate, setIssueDate] = useState(getTodayBR());
  const [entryDate, setEntryDate] = useState(getTodayBR());
  const [competenceMonth, setCompetenceMonth] = useState(getCurrentCompetenceMonthBR());
  
  // Form state
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [docType, setDocType] = useState<"NOTA_FISCAL" | "CUPOM" | "FATURA" | "CONTRATO" | "RECIBO" | "BOLETO" | "OUTROS">("FATURA");
  const [docNumber, setDocNumber] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dueDates, setDueDates] = useState<DueDate[]>([
    { date: getTodayBR(), amount: "" }
  ]);
  const [notes, setNotes] = useState("");
  
  // Estados para Perdas
  const [productId, setProductId] = useState<number | undefined>();
  const [productSearch, setProductSearch] = useState("");
  const [lossQuantity, setLossQuantity] = useState("");
  
  // Estado para conta gerencial (novo sistema de contabilização)
  const [managementAccountId, setManagementAccountId] = useState<number | undefined>();
  const [managementAccountOpen, setManagementAccountOpen] = useState(false);
  const [managementAccountSearch, setManagementAccountSearch] = useState("");

  // Queries
  const { data: expenses = [], refetch } = trpc.expenses.list.useQuery({
    startDate: filterStartDate ? new Date(filterStartDate + 'T12:00:00-03:00') : undefined,
    endDate: filterEndDate ? new Date(filterEndDate + 'T23:59:59-03:00') : undefined,
    supplierId: filterSupplierId,
    docNumber: filterDocNumber || undefined,
    minValue: filterMinValue ? parseFloat(filterMinValue) : undefined,
    maxValue: filterMaxValue ? parseFloat(filterMaxValue) : undefined,
  });
  const { data: suppliers = [] } = trpc.partners.list.useQuery({ partnerType: "SUPPLIER" });
  const { data: categories = [] } = trpc.expenses.categories.list.useQuery({ activeOnly: true });
  const { data: managementAccounts = [] } = trpc.managementAccounts.forSelect.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: expenseDetails = [] } = trpc.expenses.getDetails.useQuery(
    { id: editingExpenseId! },
    { enabled: editingExpenseId !== null }
  );
  
  // Mutations
  const createMutation = trpc.expenses.create.useMutation({
    onSuccess: () => {
      toast.success("Despesa registrada com sucesso!");
      refetch();
      resetForm();
      setIsCreating(false);
    },
    onError: (error) => {
      toast.error(`Erro ao registrar despesa: ${error.message}`);
    },
  });
  
  const updateMutation = trpc.expenses.update.useMutation({
    onSuccess: () => {
      toast.success("Despesa atualizada com sucesso!");
      refetch();
      resetForm();
      setIsCreating(false);
      setIsEditing(false);
      setEditingExpenseId(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar despesa: ${error.message}`);
    },
  });
  
  const cancelMutation = trpc.expenses.cancel.useMutation({
    onSuccess: () => {
      toast.success("Despesa cancelada!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao cancelar despesa: ${error.message}`);
    },
  });
  
  const resetForm = () => {
    setIssueDate(getTodayBR());
    setEntryDate(getTodayBR());
    setCompetenceMonth(getCurrentCompetenceMonthBR());
    setSupplierId(undefined);
    setSupplierSearch("");
    setDocType("FATURA");
    setDocNumber("");
    setCategoryId(undefined);
    setCategorySearch("");
    setManagementAccountId(undefined);
    setManagementAccountSearch("");
    setDescription("");
    setAmount("");
    setPaymentMethod("");
    setDueDates([{ date: getTodayBR(), amount: "" }]);
    setNotes("");
    setProductId(undefined);
    setProductSearch("");
    setLossQuantity("");
  };
  
  const addDueDate = () => {
    const lastDate = dueDates[dueDates.length - 1]?.date || getTodayBR();
    const isCredit = paymentMethod === "Crédito G" || paymentMethod === "Crédito R" || paymentMethod === "Crédito ABR";
    
    let nextDateStr: string;
    if (isCredit) {
      // Crédito: +30 dias a partir da última parcela
      nextDateStr = addDaysBR(lastDate, 30);
    } else {
      // Boleto/outros: data do lançamento (manual)
      nextDateStr = getTodayBR();
    }
    
    setDueDates([...dueDates, { date: nextDateStr, amount: "" }]);
  };
  
  const removeDueDate = (index: number) => {
    if (dueDates.length > 1) {
      setDueDates(dueDates.filter((_, i) => i !== index));
    }
  };
  
  // Carregar dados ao editar
  useEffect(() => {
    if (isEditing && editingExpenseId && expenseDetails.length > 0) {
      const expense = expenses.find(e => e.expense.id === editingExpenseId);
      if (expense) {
        setSupplierId(expense.expense.supplierId || undefined);
        setDocType(expense.expense.docType as "NOTA_FISCAL" | "CUPOM");
        setDocNumber(expense.expense.docNumber || "");
        setCategoryId(expense.expense.categoryId);
        setManagementAccountId(expense.expense.managementAccountId || undefined);
        setDescription(expense.expense.description);
        setPaymentMethod(expense.expense.paymentMethod);
        setNotes(expense.expense.notes || "");
        
        // Carregar datas
        if (expense.expense.issueDate) {
          setIssueDate(toDateStringBR(new Date(expense.expense.issueDate)));
        }
        if (expense.expense.entryDate) {
          setEntryDate(toDateStringBR(new Date(expense.expense.entryDate)));
          // Calcular mês de competência baseado na data de entrada (usando timezone BR)
          const dateStr = toDateStringBR(new Date(expense.expense.entryDate));
          const [year, month] = dateStr.split('-');
          setCompetenceMonth(`${year}-${month}`);
        }
        
        // Carregar parcelas
        setDueDates(expenseDetails.map((inst: any) => ({
          date: toDateStringBR(new Date(inst.dueDate)),
          amount: inst.amount
        })));
      }
    }
  }, [isEditing, editingExpenseId, expenseDetails, expenses]);
  
  // Recalcular mês de competência automaticamente quando a data de entrada mudar
  useEffect(() => {
    if (entryDate) {
      const [year, month] = entryDate.split('-');
      if (year && month) {
        setCompetenceMonth(`${year}-${month}`);
      }
    }
  }, [entryDate]);
  
  const updateDueDate = (index: number, field: 'date' | 'amount', value: string) => {
    const newDueDates = [...dueDates];
    newDueDates[index] = { ...newDueDates[index], [field]: value };
    setDueDates(newDueDates);
  };
  
  const handleSubmit = () => {
    // Validar fornecedor (obrigatório)
    if (!supplierId) {
      toast.error("Selecione o fornecedor");
      return;
    }
    // Validar conta gerencial (novo sistema) ou categoria (sistema antigo)
    if (!managementAccountId && !categoryId) {
      toast.error("Selecione a conta gerencial");
      return;
    }
    if (!description) {
      toast.error("Informe a descrição");
      return;
    }
    
    // Verificar se é conta de Perdas Estoque (forma de pagamento, valor e baixa de estoque são automáticos)
    // Perdas Operacionais funciona como despesa normal (para perdas que não são de estoque)
    const isPerdasEstoque = selectedManagementAccount?.name === 'Perdas Estoque';
    const isPerdas = isPerdasEstoque || selectedCategory?.name === 'Perdas';
    
    // Para Perdas, validar produto e quantidade
    if (isPerdas) {
      if (!productId) {
        toast.error("Selecione o produto para lançamento de Perdas");
        return;
      }
      if (!lossQuantity || parseFloat(lossQuantity) <= 0) {
        toast.error("Informe a quantidade perdida");
        return;
      }
    } else {
      // Para despesas normais, validar forma de pagamento e parcelas
      if (!paymentMethod) {
        toast.error("Selecione a forma de pagamento");
        return;
      }
      if (dueDates.length === 0 || dueDates.some(d => !d.date)) {
        toast.error("Informe pelo menos uma data de vencimento");
        return;
      }
      if (dueDates.some(d => !d.amount || parseFloat(d.amount) <= 0)) {
        toast.error("Informe o valor de todas as parcelas");
        return;
      }
    }
    
    // Para Perdas, calcular valor automaticamente e usar data de hoje
    let finalDueDates = dueDates;
    let finalPaymentMethod = paymentMethod;
    let totalAmount: string;
    
    if (isPerdas && productId && lossQuantity) {
      const selectedProduct = products.find(p => p.id === productId) as any;
      const avgCost = parseFloat(selectedProduct?.avgCost || '0');
      const calculatedValue = avgCost * parseFloat(lossQuantity);
      totalAmount = calculatedValue.toFixed(2);
      finalDueDates = [{
        date: getTodayBR(),
        amount: totalAmount
      }];
      finalPaymentMethod = 'Perdas';
    } else {
      // Calcular valor total somando as parcelas
      totalAmount = dueDates.reduce((sum, d) => sum + parseFloat(d.amount), 0).toFixed(2);
    }
    
    const payload = {
      supplierId,
      issueDate: new Date(issueDate + 'T12:00:00-03:00'),
      entryDate: new Date(entryDate + 'T12:00:00-03:00'),
      competenceMonth,
      docType,
      docNumber,
      categoryId,
      managementAccountId,
      accountingCode: selectedManagementAccount?.accountingCode,
      description,
      amount: totalAmount,
      paymentMethod: finalPaymentMethod,
      dueDates: finalDueDates.map(d => {
        // Criar data explícitamente em horário de Brasília (meio-dia) para evitar problemas de timezone
        const [year, month, day] = d.date.split('-');
        return {
          date: new Date(`${year}-${month}-${day}T12:00:00-03:00`),
          amount: d.amount
        };
      }),
      notes,
      // Campos específicos para Perdas
      // Apenas Perdas Estoque registra produto e quantidade para baixa de estoque
      productId: isPerdasEstoque ? productId : undefined,
      lossQuantity: isPerdasEstoque && lossQuantity ? parseFloat(lossQuantity) : undefined,
    };
    
    if (isEditing && editingExpenseId) {
      updateMutation.mutate({ id: editingExpenseId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };
  
  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.docNumber?.toLowerCase().includes(supplierSearch.toLowerCase())
  );
  
  const selectedCategory = categories.find(c => c.id === categoryId);
  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Conta gerencial selecionada e filtro
  const selectedManagementAccount = managementAccounts.find(a => a.id === managementAccountId);
  const filteredManagementAccounts = managementAccounts.filter(a => 
    a.name.toLowerCase().includes(managementAccountSearch.toLowerCase()) ||
    a.code.toLowerCase().includes(managementAccountSearch.toLowerCase()) ||
    a.accountingCode?.toLowerCase().includes(managementAccountSearch.toLowerCase())
  );

  // Agrupar contas gerenciais por classificação para exibição
  const groupedManagementAccounts = filteredManagementAccounts.reduce((acc, account) => {
    const group = account.classification || 'OUTROS';
    if (!acc[group]) acc[group] = [];
    acc[group].push(account);
    return acc;
  }, {} as Record<string, typeof managementAccounts>);

  const classificationLabels: Record<string, string> = {
    'OPERACIONAL': 'Custos/Despesas Operacionais',
    'ADMINISTRATIVA': 'Despesas Administrativas',
    'COMERCIAL': 'Despesas Comerciais',
    'FINANCEIRA': 'Despesas Financeiras',
    'NAO_OPERACIONAL': 'Despesas Não Operacionais',
    'PATRIMONIAL': 'Contas Patrimoniais',
    'OUTROS': 'Outros'
  };
  
  // Tela de criação de despesa
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
                      if (categoryId || description || amount) {
                        if (confirm("Deseja descartar as alterações?")) {
                          setIsCreating(false);
                          resetForm();
                        }
                      } else {
                        setIsCreating(false);
                        resetForm();
                      }
                    }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <h1 className="text-2xl font-bold">{isEditing ? "Editar Despesa Operacional" : "Nova Despesa Operacional"}</h1>
                    <p className="text-sm text-muted-foreground">
                      {isEditing ? "Edite os dados da despesa" : "Registre uma nova despesa da empresa"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (categoryId || description || amount) {
                        if (confirm("Deseja descartar as alterações?")) {
                          setIsCreating(false);
                          setIsEditing(false);
                          setEditingExpenseId(null);
                          resetForm();
                        }
                      } else {
                        setIsCreating(false);
                        setIsEditing(false);
                        setEditingExpenseId(null);
                        resetForm();
                      }
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) ? "Salvando..." : (isEditing ? "Atualizar Despesa" : "Salvar Despesa")}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            <div className="container py-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Fornecedor */}
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Fornecedor (Opcional)</h3>
                  <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={supplierOpen}
                        className="w-full justify-between"
                      >
                        {selectedSupplier ? selectedSupplier.name : "Selecione um fornecedor..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Buscar fornecedor..." 
                          value={supplierSearch}
                          onValueChange={setSupplierSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                          <CommandGroup>
                            {filteredSuppliers.map((supplier) => (
                              <CommandItem
                                key={supplier.id}
                                value={supplier.id.toString()}
                                onSelect={() => {
                                  setSupplierId(supplier.id);
                                  setSupplierOpen(false);
                                  setSupplierSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    supplierId === supplier.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{supplier.name}</div>
                                  {supplier.docNumber && (
                                    <div className="text-xs text-muted-foreground">
                                      {supplier.docNumber}
                                    </div>
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

                {/* Datas */}
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Datas</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Data Emissão *</Label>
                      <Input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Data Entrada *</Label>
                      <Input
                        type="date"
                        value={entryDate}
                        onChange={(e) => {
                          setEntryDate(e.target.value);
                          // Atualizar competência automaticamente
                          const d = new Date(e.target.value);
                          setCompetenceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                        }}
                      />
                      {new Date().getDate() <= 5 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Até dia 5, pode usar data do mês anterior
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Competência</Label>
                      <div className="h-10 px-3 py-2 border rounded-md bg-muted flex items-center">
                        <span className="font-medium">
                          {(() => {
                            const [year, month] = competenceMonth.split('-');
                            const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                            return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Documento */}
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Documento</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo de Documento</Label>
                      <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value="FATURA">Fatura</SelectItem>
                          <SelectItem value="NOTA_FISCAL">Nota Fiscal</SelectItem>
                          <SelectItem value="CUPOM">Cupom</SelectItem>
                          <SelectItem value="CONTRATO">Contrato</SelectItem>
                          <SelectItem value="RECIBO">Recibo</SelectItem>
                          <SelectItem value="BOLETO">Boleto</SelectItem>
                          <SelectItem value="OUTROS">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Nº Documento</Label>
                      <Input
                        value={docNumber}
                        onChange={(e) => setDocNumber(e.target.value)}
                        placeholder="Ex: 123456"
                      />
                    </div>
                  </div>
                </div>

                {/* Conta Gerencial (Novo Sistema de Contabilização) */}
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Conta Gerencial *</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Selecione a conta gerencial para classificação contábil automática
                  </p>
                  <Popover open={managementAccountOpen} onOpenChange={setManagementAccountOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={managementAccountOpen}
                        className="w-full justify-between"
                      >
                        {selectedManagementAccount 
                          ? `${selectedManagementAccount.name} (${selectedManagementAccount.accountingCode})` 
                          : "Selecione uma conta gerencial..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Buscar conta gerencial..." 
                          value={managementAccountSearch}
                          onValueChange={setManagementAccountSearch}
                        />
                        <CommandList className="max-h-[400px]">
                          <CommandEmpty>Nenhuma conta gerencial encontrada.</CommandEmpty>
                          {Object.entries(groupedManagementAccounts).map(([classification, accounts]) => (
                            <CommandGroup key={classification} heading={classificationLabels[classification] || classification}>
                              {accounts.map((account) => (
                                <CommandItem
                                  key={account.id}
                                  value={account.id.toString()}
                                  onSelect={() => {
                                    setManagementAccountId(account.id);
                                    // Também definir categoryId para compatibilidade com sistema antigo
                                    // Buscar categoria correspondente pelo nome
                                    const matchingCategory = categories.find(c => 
                                      c.name.toLowerCase() === account.name.toLowerCase()
                                    );
                                    if (matchingCategory) {
                                      setCategoryId(matchingCategory.id);
                                    }
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
                                    <div className="text-xs text-muted-foreground flex gap-2">
                                      <span className="font-mono bg-muted px-1 rounded">{account.accountingCode}</span>
                                      <span className="text-blue-600 dark:text-blue-400">{account.nature}</span>
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedManagementAccount && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Código Contábil:</span>
                        <span className="font-mono bg-background px-2 py-0.5 rounded border">
                          {selectedManagementAccount.accountingCode}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                        <span>Natureza: {selectedManagementAccount.nature}</span>
                        <span>Classificação: {classificationLabels[selectedManagementAccount.classification] || selectedManagementAccount.classification}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Produto e Quantidade (apenas para Perdas Estoque - baixa automática de estoque) */}
                {(selectedManagementAccount?.name === 'Perdas Estoque' || selectedCategory?.name === 'Perdas') && (
                  <div className="bg-card border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Produto e Quantidade Perdida *</h3>
                    <div className="space-y-4">
                      <div>
                        <Label>Produto *</Label>
                        <div className="relative">
                          <Input
                            value={productSearch}
                            onChange={(e) => {
                              setProductSearch(e.target.value);
                              setProductId(undefined);
                            }}
                            placeholder="Digite para buscar o produto..."
                            className="pr-10"
                          />
                          {productSearch && (
                            <button
                              type="button"
                              onClick={() => {
                                setProductSearch("");
                                setProductId(undefined);
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {productSearch && !productId && (() => {
                          const filtered = products
                            .filter(p => 
                              p.active && 
                              !p.isComposite &&
                              p.name.toLowerCase().includes(productSearch.toLowerCase())
                            )
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .slice(0, 10);
                          
                          if (filtered.length === 0) {
                            return (
                              <div className="mt-2 p-2 border rounded bg-muted text-sm text-muted-foreground">
                                Nenhum produto encontrado
                              </div>
                            );
                          }
                          
                          return (
                            <div className="mt-2 border rounded max-h-60 overflow-y-auto">
                              {filtered.map((product) => (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => {
                                    setProductId(product.id);
                                    setProductSearch(product.name);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0"
                                >
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Estoque: {product.currentStock || 0} | Custo: R$ {parseFloat((product as any).avgCost || '0').toFixed(2)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                        {productId && (() => {
                          const selected = products.find(p => p.id === productId);
                          if (!selected) return null;
                          return (
                            <div className="mt-2 p-2 border rounded bg-green-50 dark:bg-green-950 text-sm">
                              <div className="font-medium text-green-900 dark:text-green-100">
                                ✓ {selected.name}
                              </div>
                              <div className="text-xs text-green-700 dark:text-green-300">
                                Estoque: {selected.currentStock || 0} | Custo: R$ {parseFloat((selected as any).avgCost || '0').toFixed(2)}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div>
                        <Label>Quantidade Perdida *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={lossQuantity}
                          onChange={(e) => setLossQuantity(e.target.value)}
                          placeholder="Ex: 5"
                        />
                        {productId && lossQuantity && (() => {
                          const selectedProduct = products.find(p => p.id === productId) as any;
                          const avgCost = selectedProduct?.avgCost || '0';
                          const calculatedValue = parseFloat(avgCost) * parseFloat(lossQuantity);
                          return (
                            <p className="text-sm text-muted-foreground mt-2">
                              Valor calculado automaticamente: R$ {calculatedValue.toFixed(2)}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Informações da Despesa */}
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Informações da Despesa</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Descrição *</Label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ex: Aluguel do mês de novembro/2025"
                      />
                    </div>
                    <div>
                      <Label>Forma de Pagamento *</Label>
                      {(selectedManagementAccount?.name === 'Perdas Estoque' || selectedCategory?.name === 'Perdas') ? (
                        <div className="flex items-center gap-2">
                          <Input value="Perdas" disabled className="bg-muted" />
                          <span className="text-sm text-muted-foreground">(automático)</span>
                        </div>
                      ) : (
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            {PAYMENT_METHODS.filter(m => m !== 'Perdas').map((method) => (
                              <SelectItem key={method} value={method}>
                                {method}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>

                {/* Datas de Vencimento ou Valor da Perda */}
                {(selectedManagementAccount?.name === 'Perdas Estoque' || selectedCategory?.name === 'Perdas') ? (
                  <div className="bg-card border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Valor da Perda</h3>
                    <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                        Valor calculado automaticamente com base no custo médio do produto
                      </p>
                      {productId && lossQuantity && (() => {
                        const selectedProduct = products.find(p => p.id === productId) as any;
                        const avgCost = parseFloat(selectedProduct?.avgCost || '0');
                        const calculatedValue = avgCost * parseFloat(lossQuantity);
                        return (
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                              R$ {calculatedValue.toFixed(2)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              Data: {formatDateBR(new Date())}
                              <br />
                              <span className="text-xs">(lançamento automático)</span>
                            </span>
                          </div>
                        );
                      })()}
                      {(!productId || !lossQuantity) && (
                        <p className="text-muted-foreground">Selecione o produto e informe a quantidade para calcular o valor</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-card border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Datas de Vencimento *</h3>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!amount || parseFloat(amount) <= 0) {
                              toast.error("Preencha o valor total da despesa primeiro");
                              return;
                            }
                            if (dueDates.length === 0) {
                              toast.error("Adicione pelo menos uma parcela");
                              return;
                            }
                            const total = parseFloat(amount);
                            const count = dueDates.length;
                            const perInstallment = total / count;
                            const remainder = total - (Math.floor(perInstallment * 100) / 100) * count;
                            
                            const newDueDates = dueDates.map((dd, i) => ({
                              ...dd,
                              amount: i === count - 1 
                                ? (perInstallment + remainder).toFixed(2)
                                : perInstallment.toFixed(2)
                            }));
                            setDueDates(newDueDates);
                            toast.success(`Valor dividido em ${count} parcelas iguais`);
                          }}
                        >
                          Dividir Igualmente
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addDueDate}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Data
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {dueDates.map((dueDate, index) => (
                        <div key={index} className="flex gap-2">
                          <div className="flex-1">
                            <Label>Data Vencimento - Parcela {index + 1}</Label>
                            <Input
                              type="date"
                              value={dueDate.date}
                              onChange={(e) => updateDueDate(index, 'date', e.target.value)}
                            />
                          </div>
                          <div className="flex-1">
                            <Label>Valor - Parcela {index + 1}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={dueDate.amount}
                              onChange={(e) => updateDueDate(index, 'amount', e.target.value)}
                            />
                          </div>
                          {dueDates.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="mt-6"
                              onClick={() => removeDueDate(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Observações */}
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Observações</h3>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Informações adicionais sobre a despesa..."
                    rows={4}
                  />
                </div>
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
            <div className="text-2xl font-bold text-green-600">
              R$ {expenses
                .filter(e => e.expense.status === 'ATIVA')
                .reduce((sum, e) => sum + parseFloat(e.expense.amount), 0)
                .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Total Cancelado</div>
            <div className="text-2xl font-bold text-red-600">
              R$ {expenses
                .filter(e => e.expense.status === 'CANCELADA')
                .reduce((sum, e) => sum + parseFloat(e.expense.amount), 0)
                .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Despesas Encontradas</div>
            <div className="text-2xl font-bold">
              {expenses.length}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Despesas Operacionais</h1>
            <p className="text-muted-foreground">
              Gerencie as despesas da empresa
            </p>
          </div>
{expensePermissions.canCreate && (
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Despesa
          </Button>
          )}
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
              <Label>Fornecedor</Label>
              <Popover open={filterSupplierOpen} onOpenChange={setFilterSupplierOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {filterSupplierId
                      ? suppliers.find((s) => s.id === filterSupplierId)?.name
                      : "Todos"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar fornecedor..."
                      value={filterSupplierSearch}
                      onValueChange={setFilterSupplierSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setFilterSupplierId(undefined);
                            setFilterSupplierOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !filterSupplierId ? "opacity-100" : "opacity-0")} />
                          Todos
                        </CommandItem>
                        {suppliers
                          .filter(s => s.name.toLowerCase().includes(filterSupplierSearch.toLowerCase()))
                          .map((supplier) => (
                            <CommandItem
                              key={supplier.id}
                              value={supplier.name}
                              onSelect={() => {
                                setFilterSupplierId(supplier.id);
                                setFilterSupplierOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", filterSupplierId === supplier.id ? "opacity-100" : "opacity-0")} />
                              {supplier.name}
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
                      ? managementAccounts.find((a) => a.id === filterManagementAccountId)?.name
                      : "Todas"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar conta gerencial..."
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
                        {managementAccounts
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
                              {account.name}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Número de Documento</Label>
              <Input
                placeholder="Ex: 123456"
                value={filterDocNumber}
                onChange={(e) => setFilterDocNumber(e.target.value)}
              />
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
                  setFilterSupplierId(undefined);
                  setFilterManagementAccountId(undefined);
                  setFilterDocNumber("");
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

        {/* Lista de despesas */}
        <div className="bg-card border rounded-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Despesas Cadastradas</h2>
            {expenses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma despesa cadastrada
              </div>
            ) : (
              <div className="space-y-4">
                {expenses
                  .filter(item => {
                    // Filtro de número de nota
                    if (filterDocNumber && !item.expense.docNumber?.includes(filterDocNumber)) {
                      return false;
                    }
                    // Filtro de conta gerencial
                    if (filterManagementAccountId && item.expense.managementAccountId !== filterManagementAccountId) {
                      return false;
                    }
                    // Filtro de valor mínimo
                    if (filterMinValue && parseFloat(item.expense.amount) < parseFloat(filterMinValue)) {
                      return false;
                    }
                    // Filtro de valor máximo
                    if (filterMaxValue && parseFloat(item.expense.amount) > parseFloat(filterMaxValue)) {
                      return false;
                    }
                    return true;
                  })
                  .map((item) => (
                  <div
                    key={item.expense.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{item.expense.description}</h3>
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full",
                            item.expense.status === "ATIVA" && "bg-green-100 text-green-700",
                            item.expense.status === "PAGA" && "bg-blue-100 text-blue-700",
                            item.expense.status === "CANCELADA" && "bg-red-100 text-red-700"
                          )}>
                            {item.expense.status}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>Conta Gerencial: {item.managementAccount ? `${item.managementAccount.name} (${item.accountingMapping?.accountingCode || item.expense.accountingCode || 'N/A'})` : (item.category?.name || "N/A")}</div>
                          {item.supplier && <div>Fornecedor: {item.supplier.name}</div>}
                          <div>Documento: {item.expense.docType} {item.expense.docNumber && `- ${item.expense.docNumber}`}</div>
                          <div>Forma de Pagamento: {item.expense.paymentMethod}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">
                          R$ {parseFloat(item.expense.amount).toFixed(2)}
                        </div>
                        {item.expense.status === "ATIVA" && expensePermissions.canEdit && (
                          <div className="flex gap-2 mt-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingExpenseId(item.expense.id);
                                setIsEditing(true);
                                setIsCreating(true);
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive"
                              onClick={() => {
                                if (confirm("Deseja cancelar esta despesa?")) {
                                  cancelMutation.mutate({ id: item.expense.id });
                                }
                              }}
                              disabled={cancelMutation.isPending}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

