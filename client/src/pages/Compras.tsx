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
import { Plus, Search, Check, X, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

interface PurchaseItem {
  productId: number;
  productName: string;
  quantity: number;
  unitCost: number;
  expiryDate?: string;
}

export default function Compras() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  
  // Form state
  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [docType, setDocType] = useState<"NOTA_FISCAL" | "CUPOM" | "SEM_DOCUMENTO">("NOTA_FISCAL");
  const [docNumber, setDocNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [freightCost, setFreightCost] = useState("0");
  const [chargesCost, setChargesCost] = useState("0");
  const [notes, setNotes] = useState("");
  
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
      setDialogOpen(false);
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
  
  const resetForm = () => {
    setSupplierId(undefined);
    setDocType("NOTA_FISCAL");
    setDocNumber("");
    setIssueDate(new Date().toISOString().split('T')[0]);
    setPostingDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod("");
    setDueDate("");
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
      unitCost: parseFloat(product.avgCost || "0"),
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
  
  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
  };
  
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const freight = parseFloat(freightCost || "0");
    const charges = parseFloat(chargesCost || "0");
    return subtotal + freight + charges;
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
    
    if (!paymentMethod) {
      toast.error("Informe a forma de pagamento");
      return;
    }
    
    createMutation.mutate({
      supplierId,
      docType,
      docNumber: docNumber || undefined,
      issueDate,
      postingDate,
      paymentMethod,
      dueDate: dueDate || undefined,
      freightCost,
      chargesCost,
      notes: notes || undefined,
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        expiryDate: item.expiryDate,
      })),
    });
  };
  
  const getStatusBadge = (status: string) => {
    const styles = {
      DRAFT: "bg-gray-100 text-gray-800",
      CONFIRMED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    const labels = {
      DRAFT: "Rascunho",
      CONFIRMED: "Confirmado",
      CANCELLED: "Cancelado",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };
  
  if (!user) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Carregando...</p>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Compras</h1>
            <p className="text-gray-500">Registre entradas de produtos e atualize o estoque</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Compra
          </Button>
        </div>
        
        {/* Lista de Compras */}
        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>Nenhuma compra registrada ainda</p>
                      <p className="text-sm">Clique em "Nova Compra" para começar</p>
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase) => (
                    <tr key={purchase.purchaseOrder.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">#{purchase.purchaseOrder.id}</td>
                      <td className="px-6 py-4 text-sm">{purchase.supplier?.name || "-"}</td>
                      <td className="px-6 py-4 text-sm">
                        {purchase.purchaseOrder.docNumber || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {new Date(purchase.purchaseOrder.postingDate).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        R$ {parseFloat(purchase.purchaseOrder.totalAmount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {getStatusBadge(purchase.purchaseOrder.status)}
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        {purchase.purchaseOrder.status === "DRAFT" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => confirmMutation.mutate({ id: purchase.purchaseOrder.id })}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Confirmar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelMutation.mutate({ id: purchase.purchaseOrder.id })}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancelar
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Dialog Nova Compra */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Compra</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Dados da Compra */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fornecedor *</Label>
                  <Select value={supplierId?.toString()} onValueChange={(v) => setSupplierId(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o fornecedor" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Tipo de Documento *</Label>
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
                    placeholder="Ex: 12345"
                  />
                </div>
                
                <div>
                  <Label>Data de Emissão *</Label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label>Data de Lançamento *</Label>
                  <Input
                    type="date"
                    value={postingDate}
                    onChange={(e) => setPostingDate(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label>Forma de Pagamento *</Label>
                  <Input
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="Ex: Dinheiro, PIX, Boleto"
                  />
                </div>
                
                <div>
                  <Label>Data de Vencimento</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Busca de Produtos */}
              <div>
                <Label>Adicionar Produto</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome ou EAN..."
                    className="pl-10"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => addItem(product)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 flex justify-between items-center"
                        >
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-gray-500">EAN: {product.ean || "-"}</div>
                          </div>
                          <div className="text-sm text-gray-500">
                            Estoque: {product.currentStock || 0}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Lista de Itens */}
              {items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Produto</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Qtd</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Custo Unit.</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Validade</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Total</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((item) => (
                        <tr key={item.productId}>
                          <td className="px-4 py-2 text-sm">{item.productName}</td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.productId, 'quantity', parseFloat(e.target.value))}
                              className="w-20"
                              min="0.001"
                              step="0.001"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              value={item.unitCost}
                              onChange={(e) => updateItem(item.productId, 'unitCost', parseFloat(e.target.value))}
                              className="w-24"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="date"
                              value={item.expiryDate || ""}
                              onChange={(e) => updateItem(item.productId, 'expiryDate', e.target.value)}
                              className="w-36"
                            />
                          </td>
                          <td className="px-4 py-2 text-sm font-medium">
                            R$ {(item.quantity * item.unitCost).toFixed(2)}
                          </td>
                          <td className="px-4 py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeItem(item.productId)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Totais */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Frete (R$)</Label>
                  <Input
                    type="number"
                    value={freightCost}
                    onChange={(e) => setFreightCost(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
                
                <div>
                  <Label>Outros Encargos (R$)</Label>
                  <Input
                    type="number"
                    value={chargesCost}
                    onChange={(e) => setChargesCost(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span className="font-medium">R$ {calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Frete:</span>
                  <span className="font-medium">R$ {parseFloat(freightCost || "0").toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Encargos:</span>
                  <span className="font-medium">R$ {parseFloat(chargesCost || "0").toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total:</span>
                  <span>R$ {calculateTotal().toFixed(2)}</span>
                </div>
              </div>
              
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações adicionais sobre a compra..."
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Salvar Compra"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

