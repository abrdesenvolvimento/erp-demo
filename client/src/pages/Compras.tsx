import { useState, useEffect } from "react";
import { formatDateForInput, getTodayInBrazil, parseDateInBrazil, addDays } from "@shared/dateUtils";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Plus, Search, Check, X, Trash2, Package, UserPlus, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PurchaseItem {
  productId: number;
  productName: string;
  quantity: number;
  unitCost: number;
  expiryDate?: string;
}

interface PaymentInstallment {
  dueDate: string;
  amount: number;
}

const PAYMENT_METHODS = [
  "Boleto",
  "Crédito G",
  "Crédito R",
  "Crédito ABR",
  "À Vista",
  "Débito Automático"
];

export default function Compras() {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<number | null>(null);
  
  // Filter state
  const today = formatDateForInput(getTodayInBrazil());
  const [filterStartDate, setFilterStartDate] = useState(today);
  const [filterEndDate, setFilterEndDate] = useState(today);
  const [filterSupplierId, setFilterSupplierId] = useState<number | undefined>();
  const [filterSupplierOpen, setFilterSupplierOpen] = useState(false);
  const [filterSupplierSearch, setFilterSupplierSearch] = useState("");
  const [filterDocNumber, setFilterDocNumber] = useState("");
  const [filterMinValue, setFilterMinValue] = useState("");
  const [filterMaxValue, setFilterMaxValue] = useState("");
  
  // Form state
  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [docType, setDocType] = useState<"NOTA_FISCAL" | "CUPOM" | "SEM_DOCUMENTO">("NOTA_FISCAL");
  const [docNumber, setDocNumber] = useState("");
  const [accessKey, setAccessKey] = useState(""); // Código de acesso da NF
  const [issueDate, setIssueDate] = useState(formatDateForInput(getTodayInBrazil()));
  const [postingDate, setPostingDate] = useState(formatDateForInput(getTodayInBrazil()));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [installments, setInstallments] = useState<PaymentInstallment[]>([
    { dueDate: formatDateForInput(addDays(getTodayInBrazil(), 30)), amount: 0 }
  ]);
  const [freightCost, setFreightCost] = useState("0");
  const [chargesCost, setChargesCost] = useState("0");
  const [notes, setNotes] = useState("");
  
  // Novo fornecedor
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierDoc, setNewSupplierDoc] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  
  // Auto-fill single installment amount
  useEffect(() => {
    if (installments.length === 1 && items.length > 0) {
      const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0) + parseFloat(freightCost) + parseFloat(chargesCost);
      if (totalAmount > 0) {
        setInstallments([{ ...installments[0], amount: totalAmount }]);
      }
    }
  }, [items, freightCost, chargesCost, installments.length]);
  
  // Queries
  const { data: purchases = [], refetch } = trpc.purchases.list.useQuery({
    startDate: filterStartDate ? parseDateInBrazil(filterStartDate) : undefined,
    endDate: filterEndDate ? parseDateInBrazil(filterEndDate) : undefined,
    supplierId: filterSupplierId,
    docNumber: filterDocNumber || undefined,
    minValue: filterMinValue ? parseFloat(filterMinValue) : undefined,
    maxValue: filterMaxValue ? parseFloat(filterMaxValue) : undefined,
  });
  const { data: suppliers = [] } = trpc.partners.list.useQuery({ partnerType: "SUPPLIER" });
  const { data: searchResults = [] } = trpc.purchases.searchProducts.useQuery(
    { search: searchTerm },
    { enabled: searchTerm.length >= 2 }
  );
  const { data: purchaseDetails = [] } = trpc.purchases.getItems.useQuery(
    { purchaseOrderId: selectedPurchaseId || 0 },
    { enabled: selectedPurchaseId !== null }
  );
  
  // Carregar itens no formulário ao editar
  useEffect(() => {
    if (isEditing && purchaseDetails.length > 0 && items.length === 0) {
      setItems(purchaseDetails.map((item: any) => ({
        productId: item.productId || 0,
        productName: item.productName || "",
        quantity: parseFloat(item.quantity?.toString() || "0"),
        unitCost: parseFloat(item.unitCost?.toString() || "0"),
        expiryDate: item.expiryDate ? formatDateForInput(new Date(item.expiryDate)) : undefined,
      })));
    }
  }, [isEditing, purchaseDetails]);
  
  // Mutations
  const createMutation = trpc.purchases.create.useMutation({
    onSuccess: () => {
      toast.success("Compra registrada com sucesso!");
      refetch();
      resetForm();
      setIsCreating(false);
    },
    onError: (error) => {
      toast.error(`Erro ao registrar compra: ${error.message}`);
    },
  });
  
  const confirmMutation = trpc.purchases.confirm.useMutation({
    onSuccess: () => {
      toast.success("Compra confirmada! Estoque atualizado.");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao confirmar compra: ${error.message}`);
    },
  });
  
  const cancelMutation = trpc.purchases.cancel.useMutation({
    onSuccess: () => {
      toast.success("Compra cancelada. Estoque revertido.");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao cancelar compra: ${error.message}`);
    },
  });
  
  const updateMutation = trpc.purchases.update.useMutation({
    onSuccess: () => {
      toast.success("Compra atualizada com sucesso!");
      refetch();
      resetForm();
      setIsEditing(false);
      setEditingPurchaseId(null);
      setSelectedPurchaseId(null);
      setIsCreating(false);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar compra: ${error.message}`);
    },
  });

  const createSupplierMutation = trpc.partners.create.useMutation({
    onSuccess: () => {
      toast.success("Fornecedor criado com sucesso!");
      setSupplierDialogOpen(false);
      setNewSupplierName("");
      setNewSupplierDoc("");
      setNewSupplierPhone("");
    },
    onError: (error) => {
      toast.error(`Erro ao criar fornecedor: ${error.message}`);
    },
  });

  const selectedSupplier = suppliers.find(s => s.id === supplierId);

  const handleAddItem = (product: any) => {
    const existingItem = items.find(i => i.productId === product.id);
    if (existingItem) {
      setItems(items.map(i => 
        i.productId === product.id 
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      setItems([...items, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitCost: 0,
      }]);
    }
    setSearchTerm("");
  };

  const handleRemoveItem = (productId: number) => {
    setItems(items.filter(i => i.productId !== productId));
  };

  const handleUpdateItem = (productId: number, field: string, value: any) => {
    setItems(items.map(i =>
      i.productId === productId
        ? { ...i, [field]: value }
        : i
    ));
  };

  const resetForm = () => {
    setSupplierId(undefined);
    setDocType("NOTA_FISCAL");
    setDocNumber("");
    setAccessKey("");
    setIssueDate(formatDateForInput(getTodayInBrazil()));
    setPostingDate(formatDateForInput(getTodayInBrazil()));
    setPaymentMethod("");
    setInstallments([{ dueDate: formatDateForInput(addDays(getTodayInBrazil(), 30)), amount: 0 }]);
    setFreightCost("0");
    setChargesCost("0");
    setNotes("");
    setItems([]);
  };

  const loadPurchaseForEdit = (purchaseId: number) => {
    const purchase = purchases.find(p => p.purchaseOrder.id === purchaseId);
    if (!purchase) return;
    
    // Preencher formulário
    setSupplierId(purchase.purchaseOrder.supplierId);
    setDocType(purchase.purchaseOrder.docType as "NOTA_FISCAL" | "CUPOM" | "SEM_DOCUMENTO");
    setDocNumber(purchase.purchaseOrder.docNumber || "");
    setNotes(purchase.purchaseOrder.notes || "");
    
    // Marcar para edição e selecionar compra (itens serão carregados via useQuery)
    setEditingPurchaseId(purchaseId);
    setSelectedPurchaseId(purchaseId);
    setIsEditing(true);
  };

  const handleSubmit = () => {
    if (!supplierId) {
      toast.error("Selecione um fornecedor");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }

    if (isEditing && editingPurchaseId) {
      // Editar compra existente
      updateMutation.mutate({
        id: editingPurchaseId,
        docType,
        docNumber: docNumber || undefined,
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity.toString(),
          unitCost: item.unitCost.toString(),
          expiryDate: item.expiryDate || null,
        })),
      });
    } else {
      // Criar nova compra
      if (!paymentMethod) {
        toast.error("Selecione a forma de pagamento");
        return;
      }

      const totalAmount = items.reduce((sum, item) => 
        sum + (item.quantity * item.unitCost), 0
      ) + parseFloat(freightCost) + parseFloat(chargesCost);

      createMutation.mutate({
        supplierId,
        docType,
        docNumber: docNumber || undefined,
        accessKey: accessKey || undefined,
        issueDate: parseDateInBrazil(issueDate).toISOString(),
        postingDate: parseDateInBrazil(postingDate).toISOString(),
        freightCost: freightCost || "0",
        chargesCost: chargesCost || "0",
        paymentMethod,
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          expiryDate: item.expiryDate ? parseDateInBrazil(item.expiryDate).toISOString() : undefined,
        })),
        installments: installments.map(inst => ({
          dueDate: parseDateInBrazil(inst.dueDate).toISOString(),
          amount: inst.amount,
        })),
        notes: notes || undefined,
      });
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {isCreating ? (
          <>
            {/* Header */}
            <div className="border-b bg-card px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (items.length > 0 || supplierId) {
                        if (confirm("Deseja descartar as alterações?")) {
                          setIsCreating(false);
                          setIsEditing(false);
                          setEditingPurchaseId(null);
                          setSelectedPurchaseId(null);
                          resetForm();
                        }
                      } else {
                        setIsCreating(false);
                        setIsEditing(false);
                        setEditingPurchaseId(null);
                        setSelectedPurchaseId(null);
                        resetForm();
                      }
                    }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <h1 className="text-2xl font-bold">{isEditing ? "Editar Compra" : "Nova Compra"}</h1>
                    <p className="text-sm text-muted-foreground">
                      {isEditing ? "Edite os itens e dados da compra" : "Registre uma nova ordem de compra"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (items.length > 0 || supplierId) {
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
                    {createMutation.isPending ? "Salvando..." : "Salvar Compra"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
              <div className="container py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Coluna principal */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Fornecedor */}
                    <div className="bg-card border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">Fornecedor</h3>
                      <div className="flex gap-2">
                        <div className="flex-1">
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
                                  onValueChange={setSupplierSearch}
                                />
                                <CommandList>
                                  <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                                  <CommandGroup>
                                    {suppliers
                                      .filter(s => 
                                        !supplierSearch || 
                                        s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                                        (s.docNumber && s.docNumber.includes(supplierSearch))
                                      )
                                      .map((supplier) => (
                                      <CommandItem
                                        key={supplier.id}
                                        value={supplier.id.toString()}
                                        onSelect={() => {
                                          setSupplierId(supplier.id);
                                          setSupplierOpen(false);
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
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setSupplierDialogOpen(true)}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Documento */}
                    <div className="bg-card border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">Documento</h3>
                      <div className="space-y-4">
                        <div>
                          <Label>Tipo</Label>
                          <Select value={docType} onValueChange={(value: any) => setDocType(value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NOTA_FISCAL">Nota Fiscal</SelectItem>
                              <SelectItem value="CUPOM">Cupom</SelectItem>
                              <SelectItem value="SEM_DOCUMENTO">Sem Documento</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {docType !== "SEM_DOCUMENTO" && (
                          <div>
                            <Label>Número do Documento</Label>
                            <Input
                              value={docNumber}
                              onChange={(e) => setDocNumber(e.target.value)}
                              placeholder="Ex: 123456"
                            />
                          </div>
                        )}

                        {docType === "NOTA_FISCAL" && (
                          <div>
                            <Label>Chave de Acesso (44 dígitos)</Label>
                            <Input
                              value={accessKey}
                              onChange={(e) => setAccessKey(e.target.value.replace(/\D/g, '').slice(0, 44))}
                              placeholder="00000000000000000000000000000000000000000000"
                              maxLength={44}
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Data de Emissão</Label>
                            <Input
                              type="date"
                              value={issueDate}
                              onChange={(e) => setIssueDate(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Data de Lançamento</Label>
                            <Input
                              type="date"
                              value={postingDate}
                              onChange={(e) => setPostingDate(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Produtos */}
                    <div className="bg-card border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">Produtos</h3>
                      <div className="space-y-4">
                        {items.length > 0 && (
                          <div className="border rounded-lg overflow-x-auto max-h-96">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50 border-b">
                                <tr>
                                  <th className="text-left p-3">Produto</th>
                                  <th className="text-right p-3">Qtd</th>
                                  <th className="text-right p-3">Custo Unit.</th>
                                  <th className="text-right p-3">Validade</th>
                                  <th className="text-right p-3">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item) => (
                                  <tr key={item.productId} className="border-b">
                                    <td className="p-3">{item.productName}</td>
                                    <td className="p-3">
                                      <Input
                                        type="number"
                                        step="0.001"
                                        value={item.quantity}
                                        onChange={(e) => handleUpdateItem(item.productId, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-20 text-right"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={item.unitCost}
                                        onChange={(e) => handleUpdateItem(item.productId, 'unitCost', parseFloat(e.target.value) || 0)}
                                        className="w-24 text-right"
                                        placeholder="0.00"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <Input
                                        type="date"
                                        value={item.expiryDate || ''}
                                        onChange={(e) => handleUpdateItem(item.productId, 'expiryDate', e.target.value)}
                                        className="w-32"
                                      />
                                    </td>
                                    <td className="p-3 text-right">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveItem(item.productId)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        
                        <div className="relative">
                          <Input
                            placeholder="Buscar produto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                          {searchTerm && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                              {searchResults.map((product) => (
                                <button
                                  key={product.id}
                                  onClick={() => handleAddItem(product)}
                                  className="w-full text-left px-4 py-2 hover:bg-muted first:rounded-t-lg last:rounded-b-lg"
                                >
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Estoque: {product.currentStock} {product.uom}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coluna lateral */}
                  <div className="space-y-6">
                    {/* Resumo */}
                    <div className="bg-card border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">Resumo</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>R$ {(items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Frete:</span>
                          <span>R$ {parseFloat(freightCost).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Taxas:</span>
                          <span>R$ {parseFloat(chargesCost).toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-3 flex justify-between font-semibold text-base">
                          <span>Total:</span>
                          <span>R$ {(items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0) + parseFloat(freightCost) + parseFloat(chargesCost)).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Custos Adicionais */}
                    <div className="bg-card border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">Custos Adicionais</h3>
                      <div className="space-y-4">
                        <div>
                          <Label>Frete</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={freightCost}
                            onChange={(e) => setFreightCost(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label>Taxas/Juros</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={chargesCost}
                            onChange={(e) => setChargesCost(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Pagamento */}
                    <div className="bg-card border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">Pagamento</h3>
                      <div className="space-y-4">
                        <div>
                          <Label>Forma de Pagamento</Label>
                          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_METHODS.map(method => (
                                <SelectItem key={method} value={method}>{method}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {installments.map((inst, idx) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Parcela {idx + 1}</Label>
                              {installments.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newInst = installments.filter((_, i) => i !== idx);
                                    setInstallments(newInst);
                                  }}
                                >
                                  Remover
                                </Button>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Input
                                type="date"
                                value={inst.dueDate}
                                onChange={(e) => {
                                  const newInst = [...installments];
                                  newInst[idx].dueDate = e.target.value;
                                  setInstallments(newInst);
                                }}
                              />
                              <Input
                                type="number"
                                step="0.01"
                                value={inst.amount}
                                onChange={(e) => {
                                  const newInst = [...installments];
                                  newInst[idx].amount = parseFloat(e.target.value) || 0;
                                  setInstallments(newInst);
                                }}
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        ))}

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const newInstallment = {
                                dueDate: formatDateForInput(addDays(getTodayInBrazil(), 30)),
                                amount: 0
                              };
                              setInstallments([...installments, newInstallment]);
                            }}
                          >
                            + Adicionar Parcela
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0) + parseFloat(freightCost) + parseFloat(chargesCost);
                              const amountPerInstallment = totalAmount / installments.length;
                              const newInst = installments.map((inst, idx) => ({
                                ...inst,
                                amount: idx === installments.length - 1 
                                  ? totalAmount - (amountPerInstallment * (installments.length - 1))
                                  : amountPerInstallment
                              }));
                              setInstallments(newInst);
                            }}
                          >
                            Dividir
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Observações */}
                    <div className="bg-card border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">Observações</h3>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Adicione observações sobre esta compra..."
                        className="min-h-24"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="border-b bg-card px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Compras</h1>
                  <p className="text-sm text-muted-foreground">
                    Gerencie as ordens de compra
                  </p>
                </div>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Compra
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
              <div className="container py-6">
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
                      <Label>Número de Nota</Label>
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
                          setFilterStartDate(today);
                          setFilterEndDate(today);
                          setFilterSupplierId(undefined);
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

                <div className="bg-card border rounded-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b bg-muted/50">
                        <tr>
                          <th className="text-left p-4 font-medium">ID</th>
                          <th className="text-left p-4 font-medium">Fornecedor</th>
                          <th className="text-left p-4 font-medium">Documento</th>
                          <th className="text-left p-4 font-medium">Data</th>
                          <th className="text-left p-4 font-medium">Total</th>
                          <th className="text-left p-4 font-medium">Status</th>
                          <th className="text-left p-4 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-muted-foreground">
                              Nenhuma compra registrada
                            </td>
                          </tr>
                        ) : (
                          purchases
                            .filter(purchase => {
                              // Filtro de número de nota
                              if (filterDocNumber && !purchase.purchaseOrder.docNumber?.includes(filterDocNumber)) {
                                return false;
                              }
                              // Filtro de valor mínimo
                              if (filterMinValue && parseFloat(purchase.purchaseOrder.totalAmount) < parseFloat(filterMinValue)) {
                                return false;
                              }
                              // Filtro de valor máximo
                              if (filterMaxValue && parseFloat(purchase.purchaseOrder.totalAmount) > parseFloat(filterMaxValue)) {
                                return false;
                              }
                              return true;
                            })
                            .map((purchase) => (
                            <tr key={purchase.purchaseOrder.id} className="border-b hover:bg-muted/50">
                              <td className="p-4">#{purchase.purchaseOrder.id}</td>
                              <td className="p-4">{purchase.supplier?.name || "N/A"}</td>
                              <td className="p-4">
                                <div className="text-sm">
                                  <div>{purchase.purchaseOrder.docType.replace("_", " ")}</div>
                                  {purchase.purchaseOrder.docNumber && (
                                    <div className="text-xs text-muted-foreground">
                                      {purchase.purchaseOrder.docNumber}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                {new Date(purchase.purchaseOrder.postingDate).toLocaleDateString('pt-BR', {
                                  timeZone: 'America/Sao_Paulo'
                                })}
                              </td>
                              <td className="p-4 font-medium">
                                R$ {parseFloat(purchase.purchaseOrder.totalAmount.toString()).toFixed(2)}
                              </td>
                              <td className="p-4">
                                <span className={cn(
                                  "px-2 py-1 rounded-full text-xs font-medium",
                                  purchase.purchaseOrder.status === "CONFIRMED" && "bg-green-100 text-green-800",
                                  purchase.purchaseOrder.status === "DRAFT" && "bg-yellow-100 text-yellow-800",
                                  purchase.purchaseOrder.status === "CANCELLED" && "bg-red-100 text-red-800"
                                )}>
                                  {purchase.purchaseOrder.status === "CONFIRMED" && "Confirmada"}
                                  {purchase.purchaseOrder.status === "DRAFT" && "Rascunho"}
                                  {purchase.purchaseOrder.status === "CANCELLED" && "Cancelada"}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedPurchaseId(purchase.purchaseOrder.id);
                                      setDetailsOpen(true);
                                    }}
                                  >
                                    <Package className="h-3 w-3 mr-1" />
                                    Detalhes
                                  </Button>
                                  {purchase.purchaseOrder.status === "DRAFT" && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => confirmMutation.mutate({ id: purchase.purchaseOrder.id })}
                                        disabled={confirmMutation.isPending}
                                      >
                                        <Check className="h-3 w-3 mr-1" />
                                        Confirmar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          if (confirm("Deseja cancelar esta compra?")) {
                                            cancelMutation.mutate({ id: purchase.purchaseOrder.id });
                                          }
                                        }}
                                        disabled={cancelMutation.isPending}
                                        className="text-destructive"
                                      >
                                        <X className="h-3 w-3 mr-1" />
                                        Cancelar
                                      </Button>
                                    </>
                                  )}
                                  {purchase.purchaseOrder.status === "CONFIRMED" && user?.role === "admin" && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          loadPurchaseForEdit(purchase.purchaseOrder.id);
                                          setIsCreating(true);
                                        }}
                                      >
                                        Editar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          if (confirm("Deseja cancelar esta compra? O estoque será revertido e as parcelas pendentes serão canceladas.")) {
                                            cancelMutation.mutate({ id: purchase.purchaseOrder.id });
                                          }
                                        }}
                                        disabled={cancelMutation.isPending}
                                        className="text-destructive"
                                      >
                                        <X className="h-3 w-3 mr-1" />
                                        Cancelar
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal de Detalhes */}
              <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {selectedPurchaseId && purchases.find(p => p.purchaseOrder.id === selectedPurchaseId) && (
                        <div>
                          <div>Detalhes da Compra #{selectedPurchaseId}</div>
                          <div className="text-sm font-normal text-muted-foreground mt-1">
                            {purchases.find(p => p.purchaseOrder.id === selectedPurchaseId)?.supplier?.name}
                          </div>
                        </div>
                      )}
                    </DialogTitle>
                  </DialogHeader>
                  
                  {selectedPurchaseId && purchases.find(p => p.purchaseOrder.id === selectedPurchaseId) && (
                    <div className="space-y-4">
                      {/* Informações da Compra */}
                      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Documento</div>
                          <div className="font-medium">
                            {purchases.find(p => p.purchaseOrder.id === selectedPurchaseId)?.purchaseOrder.docType.replace('_', ' ')}
                            {purchases.find(p => p.purchaseOrder.id === selectedPurchaseId)?.purchaseOrder.docNumber && (
                              <div className="text-sm text-muted-foreground">
                                {purchases.find(p => p.purchaseOrder.id === selectedPurchaseId)?.purchaseOrder.docNumber}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Data</div>
                          <div className="font-medium">
                            {new Date(purchases.find(p => p.purchaseOrder.id === selectedPurchaseId)?.purchaseOrder.postingDate || '').toLocaleDateString('pt-BR', {
                              timeZone: 'America/Sao_Paulo'
                            })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Total</div>
                          <div className="font-medium text-lg">
                            R$ {parseFloat(purchases.find(p => p.purchaseOrder.id === selectedPurchaseId)?.purchaseOrder.totalAmount.toString() || '0').toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Status</div>
                          <div className="font-medium">
                            {purchases.find(p => p.purchaseOrder.id === selectedPurchaseId)?.purchaseOrder.status === 'CONFIRMED' && 'Confirmada'}
                            {purchases.find(p => p.purchaseOrder.id === selectedPurchaseId)?.purchaseOrder.status === 'DRAFT' && 'Rascunho'}
                            {purchases.find(p => p.purchaseOrder.id === selectedPurchaseId)?.purchaseOrder.status === 'CANCELLED' && 'Cancelada'}
                          </div>
                        </div>
                      </div>

                      {/* Tabela de Itens */}
                      <div>
                        <h3 className="font-semibold mb-3">Itens da Compra ({purchaseDetails.length})</h3>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                              <tr>
                                <th className="text-left p-3 font-medium">Produto</th>
                                <th className="text-right p-3 font-medium">Quantidade</th>
                                <th className="text-right p-3 font-medium">Custo Unit.</th>
                                <th className="text-right p-3 font-medium">Custo Total</th>
                                <th className="text-left p-3 font-medium">Validade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {purchaseDetails.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="text-center py-6 text-muted-foreground">
                                    Nenhum item nesta compra
                                  </td>
                                </tr>
                              ) : (
                                purchaseDetails.map((item: any) => (
                                  <tr key={item.id} className="border-b hover:bg-muted/50">
                                    <td className="p-3">{item.productName}</td>
                                    <td className="text-right p-3">{parseFloat(item.quantity.toString()).toFixed(3)}</td>
                                    <td className="text-right p-3">R$ {parseFloat(item.unitCost.toString()).toFixed(4)}</td>
                                    <td className="text-right p-3 font-medium">R$ {parseFloat(item.totalCost.toString()).toFixed(2)}</td>
                                    <td className="p-3">
                                      {item.expiryDate ? (
                                        new Date(item.expiryDate).toLocaleDateString('pt-BR', {
                                          timeZone: 'America/Sao_Paulo'
                                        })
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </>
        )}
      </div>

      {/* Dialog - Novo Fornecedor */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Nome do fornecedor"
              />
            </div>
            <div>
              <Label>CNPJ/CPF</Label>
              <Input
                value={newSupplierDoc}
                onChange={(e) => setNewSupplierDoc(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <Button
              onClick={() => {
                if (!newSupplierName) {
                  toast.error("Digite o nome do fornecedor");
                  return;
                }
                createSupplierMutation.mutate({
                  name: newSupplierName,
                  docNumber: newSupplierDoc,
                  phone: newSupplierPhone,
                  partnerType: "SUPPLIER",
                });
              }}
              disabled={createSupplierMutation.isPending}
              className="w-full"
            >
              {createSupplierMutation.isPending ? "Criando..." : "Criar Fornecedor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
