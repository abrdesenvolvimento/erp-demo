import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Plus, Search, Check, ChevronLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  "Débito Automático"
];

export default function Despesas() {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [docType, setDocType] = useState<"NOTA_FISCAL" | "CUPOM">("CUPOM");
  const [docNumber, setDocNumber] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dueDates, setDueDates] = useState<DueDate[]>([
    { date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0], amount: "" }
  ]);
  const [notes, setNotes] = useState("");
  
  // Queries
  const { data: expenses = [], refetch } = trpc.expenses.list.useQuery();
  const { data: suppliers = [] } = trpc.partners.list.useQuery({ partnerType: "SUPPLIER" });
  const { data: categories = [] } = trpc.expenses.categories.list.useQuery({ activeOnly: true });
  
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
    setSupplierId(undefined);
    setDocType("CUPOM");
    setDocNumber("");
    setCategoryId(undefined);
    setDescription("");
    setAmount("");
    setPaymentMethod("");
    setDueDates([{ date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0], amount: "" }]);
    setNotes("");
    setSupplierSearch("");
    setCategorySearch("");
  };
  
  const addDueDate = () => {
    const lastDate = dueDates[dueDates.length - 1]?.date || new Date().toISOString().split('T')[0];
    const nextDate = new Date(lastDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    setDueDates([...dueDates, { date: nextDate.toISOString().split('T')[0], amount: "" }]);
  };
  
  const removeDueDate = (index: number) => {
    if (dueDates.length > 1) {
      setDueDates(dueDates.filter((_, i) => i !== index));
    }
  };
  
  const updateDueDate = (index: number, field: 'date' | 'amount', value: string) => {
    const newDueDates = [...dueDates];
    newDueDates[index] = { ...newDueDates[index], [field]: value };
    setDueDates(newDueDates);
  };
  
  const handleSubmit = () => {
    if (!categoryId) {
      toast.error("Selecione a categoria");
      return;
    }
    if (!description) {
      toast.error("Informe a descrição");
      return;
    }
    // Valor total não é mais obrigatório - será calculado pela soma das parcelas
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
    
    // Calcular valor total somando as parcelas
    const totalAmount = dueDates.reduce((sum, d) => sum + parseFloat(d.amount), 0).toFixed(2);
    
    createMutation.mutate({
      supplierId,
      docType,
      docNumber,
      categoryId,
      description,
      amount: totalAmount,
      paymentMethod,
      dueDates: dueDates.map(d => ({
        date: new Date(d.date),
        amount: d.amount
      })),
      notes,
    });
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
                    <h1 className="text-2xl font-bold">Nova Despesa Operacional</h1>
                    <p className="text-sm text-muted-foreground">
                      Registre uma nova despesa da empresa
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
                          resetForm();
                        }
                      } else {
                        setIsCreating(false);
                        resetForm();
                      }
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Salvando..." : "Salvar Despesa"}
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
                      <Command>
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

                {/* Documento */}
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Documento</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo de Documento *</Label>
                      <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value="NOTA_FISCAL">Nota Fiscal</SelectItem>
                          <SelectItem value="CUPOM">Cupom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Número do Documento</Label>
                      <Input
                        value={docNumber}
                        onChange={(e) => setDocNumber(e.target.value)}
                        placeholder="Ex: 123456"
                      />
                    </div>
                  </div>
                </div>

                {/* Categoria */}
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Categoria *</h3>
                  <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={categoryOpen}
                        className="w-full justify-between"
                      >
                        {selectedCategory ? selectedCategory.name : "Selecione uma categoria..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Buscar categoria..." 
                          value={categorySearch}
                          onValueChange={setCategorySearch}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                          <CommandGroup>
                            {filteredCategories.map((category) => (
                              <CommandItem
                                key={category.id}
                                value={category.id.toString()}
                                onSelect={() => {
                                  setCategoryId(category.id);
                                  setCategoryOpen(false);
                                  setCategorySearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    categoryId === category.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{category.name}</div>
                                  {category.description && (
                                    <div className="text-xs text-muted-foreground">
                                      {category.description}
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
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {PAYMENT_METHODS.map((method) => (
                            <SelectItem key={method} value={method}>
                              {method}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Datas de Vencimento */}
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Despesas Operacionais</h1>
            <p className="text-muted-foreground">
              Gerencie as despesas da empresa
            </p>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Despesa
          </Button>
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
                {expenses.map((item) => (
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
                          <div>Categoria: {item.category?.name || "N/A"}</div>
                          {item.supplier && <div>Fornecedor: {item.supplier.name}</div>}
                          <div>Documento: {item.expense.docType} {item.expense.docNumber && `- ${item.expense.docNumber}`}</div>
                          <div>Forma de Pagamento: {item.expense.paymentMethod}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">
                          R$ {parseFloat(item.expense.amount).toFixed(2)}
                        </div>
                        {item.expense.status === "ATIVA" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              if (confirm("Deseja cancelar esta despesa?")) {
                                cancelMutation.mutate({ id: item.expense.id });
                              }
                            }}
                          >
                            Cancelar
                          </Button>
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

