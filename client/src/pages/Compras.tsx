import { useState } from "react";
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
  
  // Form state
  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [docType, setDocType] = useState<"NOTA_FISCAL" | "CUPOM" | "SEM_DOCUMENTO">("NOTA_FISCAL");
  const [docNumber, setDocNumber] = useState("");
  const [accessKey, setAccessKey] = useState(""); // Código de acesso da NF
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [installments, setInstallments] = useState<PaymentInstallment[]>([
    { dueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0], amount: 0 }
  ]);
  const [freightCost, setFreightCost] = useState("0");
  const [chargesCost, setChargesCost] = useState("0");
  const [notes, setNotes] = useState("");
  
  // Novo fornecedor
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierDoc, setNewSupplierDoc] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  
  // Queries
  const { data: purchases = [], refetch } = trpc.purchases.list.useQuery();
  const { data: suppliers = [] } = trpc.partners.list.useQuery({ partnerType: "SUPPLIER" });
  const { data: searchResults = [] } = trpc.purchases.searchProducts.useQuery(
    { search: searchTerm },
    { enabled: searchTerm.length >= 2 }
  );
  
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
      toast.success("Compra cancelada.");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao cancelar compra: ${error.message}`);
    },
  });
  
  const createSupplierMutation = trpc.partners.create.useMutation({
    onSuccess: (data) => {
      toast.success("Fornecedor cadastrado com sucesso!");
      setSupplierId(data.id);
      setSupplierDialogOpen(false);
      setNewSupplierName("");
      setNewSupplierDoc("");
      setNewSupplierPhone("");
    },
    onError: (error) => {
      toast.error(`Erro ao cadastrar fornecedor: ${error.message}`);
    },
  });
  
  const resetForm = () => {
    setSupplierId(undefined);
    setDocType("NOTA_FISCAL");
    setDocNumber("");
    setAccessKey("");
    setIssueDate(new Date().toISOString().split('T')[0]);
    setPostingDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod("");
    setInstallments([{ dueDate: "", amount: 0 }]);
    setFreightCost("0");
    setChargesCost("0");
    setNotes("");
    setItems([]);
    setSearchTerm("");
  };
  
  const addItem = (product: any) => {
    const existing = items.find(i => i.productId === product.id);
    if (existing) {
      toast.warning("Produto já adicionado. Edite a quantidade na lista.");
      return;
    }
    setItems([...items, {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitCost: product.averageCost || 0,
      expiryDate: undefined,
    }]);
    setSearchTerm("");
  };
  
  const removeItem = (productId: number) => {
    setItems(items.filter(i => i.productId !== productId));
  };
  
  const updateItem = (productId: number, field: keyof PurchaseItem, value: any) => {
    setItems(items.map(item => 
      item.productId === productId ? { ...item, [field]: value } : item
    ));
  };
  
  const addInstallment = () => {
    const nextDueDate = new Date(Date.now() + (installments.length + 1) * 30*24*60*60*1000).toISOString().split('T')[0];
    setInstallments([...installments, { dueDate: nextDueDate, amount: 0 }]);
  };
  
  const removeInstallment = (index: number) => {
    if (installments.length === 1) {
      toast.warning("Deve haver pelo menos uma parcela.");
      return;
    }
    setInstallments(installments.filter((_, i) => i !== index));
  };
  
  const updateInstallment = (index: number, field: keyof PaymentInstallment, value: any) => {
    setInstallments(installments.map((inst, i) => 
      i === index ? { ...inst, [field]: value } : inst
    ));
  };
  
  const calculateTotal = () => {
    const itemsTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    const freight = parseFloat(freightCost) || 0;
    const charges = parseFloat(chargesCost) || 0;
    return itemsTotal + freight + charges;
  };
  
  const handleSubmit = () => {
    if (!supplierId) {
      toast.error("Selecione um fornecedor");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }
    if (docType === "NOTA_FISCAL" && !accessKey) {
      toast.error("Informe o código de acesso da nota fiscal");
      return;
    }
    if (!paymentMethod) {
      toast.error("Selecione a forma de pagamento");
      return;
    }
    
    const hasInvalidInstallment = installments.some(inst => !inst.dueDate || inst.amount <= 0);
    if (hasInvalidInstallment) {
      toast.error("Preencha todas as parcelas com data e valor válidos");
      return;
    }
    
    // Validar formato de data das parcelas
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const inst of installments) {
      if (!dateRegex.test(inst.dueDate)) {
        toast.error(`Data de vencimento inválida: ${inst.dueDate}. Use o formato AAAA-MM-DD`);
        return;
      }
    }
    
    console.log("Dados sendo enviados:", {
      installments,
      issueDate,
      postingDate,
    });
    
    createMutation.mutate({
      supplierId,
      docType,
      docNumber,
      accessKey: docType === "NOTA_FISCAL" ? accessKey : undefined,
      issueDate,
      postingDate,
      paymentMethod,
      installments: installments.map(inst => ({
        dueDate: inst.dueDate,
        amount: Number(inst.amount),
      })),
      freightCost,
      chargesCost,
      notes,
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        expiryDate: item.expiryDate,
      })),
    });
  };
  
  const handleCreateSupplier = () => {
    if (!newSupplierName) {
      toast.error("Informe o nome do fornecedor");
      return;
    }
    
    createSupplierMutation.mutate({
      name: newSupplierName,
      docNumber: newSupplierDoc,
      phone: newSupplierPhone,
      partnerType: "SUPPLIER",
      active: true,
    });
  };
  
  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.docNumber?.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  // Tela de criação de compra (fullscreen)
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
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <h1 className="text-2xl font-bold">Nova Compra</h1>
                    <p className="text-sm text-muted-foreground">
                      Registre uma nova ordem de compra
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
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSupplierDialogOpen(true)}
                        title="Cadastrar novo fornecedor"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
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
                            <SelectItem value="NOTA_FISCAL">Nota Fiscal</SelectItem>
                            <SelectItem value="CUPOM">Cupom</SelectItem>
                            <SelectItem value="SEM_DOCUMENTO">Sem Documento</SelectItem>
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
                      {docType === "NOTA_FISCAL" && (
                        <div className="col-span-2">
                          <Label>Código de Acesso da NF-e *</Label>
                          <Input
                            value={accessKey}
                            onChange={(e) => setAccessKey(e.target.value)}
                            placeholder="44 dígitos da chave de acesso"
                            maxLength={44}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Obrigatório para Nota Fiscal
                          </p>
                        </div>
                      )}
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

                  {/* Produtos */}
                  <div className="bg-card border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Produtos</h3>
                    
                    {/* Busca de produtos */}
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar produto por nome ou código de barras..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {searchResults.length > 0 && searchTerm.length >= 2 && (
                        <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                          {searchResults.map((product) => (
                            <button
                              key={product.id}
                              onClick={() => addItem(product)}
                              className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-3"
                            >
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="font-medium">{product.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {product.ean && `EAN: ${product.ean}`}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Lista de produtos */}
                    {items.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum produto adicionado</p>
                        <p className="text-sm">Use a busca acima para adicionar produtos</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div key={item.productId} className="border rounded-lg p-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-1">
                                <div className="font-medium mb-2">{item.productName}</div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-xs">Quantidade</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => updateItem(item.productId, "quantity", parseFloat(e.target.value) || 0)}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Custo Unitário</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={item.unitCost}
                                      onChange={(e) => updateItem(item.productId, "unitCost", parseFloat(e.target.value) || 0)}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Validade</Label>
                                    <Input
                                      type="date"
                                      value={item.expiryDate || ""}
                                      onChange={(e) => updateItem(item.productId, "expiryDate", e.target.value)}
                                      className="h-8"
                                    />
                                  </div>
                                </div>
                                <div className="mt-2 text-sm font-medium">
                                  Total: R$ {(item.quantity * item.unitCost).toFixed(2)}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(item.productId)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna lateral */}
                <div className="space-y-6">
                  {/* Resumo */}
                  <div className="bg-card border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Resumo</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>R$ {items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frete:</span>
                        <span>R$ {parseFloat(freightCost || "0").toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Encargos:</span>
                        <span>R$ {parseFloat(chargesCost || "0").toFixed(2)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-bold text-base">
                        <span>Total:</span>
                        <span>R$ {calculateTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Custos Adicionais */}
                  <div className="bg-card border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Custos Adicionais</h3>
                    <div className="space-y-3">
                      <div>
                        <Label>Frete</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={freightCost}
                          onChange={(e) => setFreightCost(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Encargos</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
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

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Parcelas</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addInstallment}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Adicionar
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {installments.map((inst, index) => (
                            <div key={index} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Parcela {index + 1}</span>
                                {installments.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeInstallment(index)}
                                    className="h-6 w-6 p-0 text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <Label className="text-xs">Vencimento</Label>
                                  <Input
                                    type="date"
                                    value={inst.dueDate}
                                    onChange={(e) => updateInstallment(index, "dueDate", e.target.value)}
                                    className="h-8"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Valor</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={inst.amount || ""}
                                    onChange={(e) => updateInstallment(index, "amount", parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="h-8"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Observações */}
                  <div className="bg-card border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Observações</h3>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Observações adicionais..."
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dialog de novo fornecedor */}
        <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Fornecedor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
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
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSupplierDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateSupplier} disabled={createSupplierMutation.isPending}>
                  {createSupplierMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  // Tela de listagem de compras
  return (
    <DashboardLayout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Compras</h1>
            <p className="text-muted-foreground">Gerencie suas ordens de compra</p>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Compra
          </Button>
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
                  purchases.map((purchase) => (
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
                        {new Date(purchase.purchaseOrder.postingDate).toLocaleDateString('pt-BR')}
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
    </DashboardLayout>
  );
}

