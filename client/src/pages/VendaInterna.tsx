import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeftRight, Plus, Eye, Check, X, Trash2, Search } from "lucide-react";

interface CartItem {
  sourceProductId: number;
  productName: string;
  quantity: number;
  unitCost: number;
  currentStock: number;
  uom: string;
}

export default function VendaInterna() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const activeCompanyId = (user as any)?.activeCompanyId || 1;

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Create form state
  const [targetCompanyId, setTargetCompanyId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Reject dialog
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectSaleId, setRejectSaleId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Queries
  const { data: salesList, isLoading } = trpc.internalSales.list.useQuery(
    { companyId: activeCompanyId, status: statusFilter as any },
    { enabled: !!activeCompanyId }
  );

  const { data: targetCompanies } = trpc.internalSales.getTargetCompanies.useQuery(
    { sourceCompanyId: activeCompanyId },
    { enabled: !!activeCompanyId && showCreateDialog }
  );

  const { data: companyProducts } = trpc.internalSales.getCompanyProducts.useQuery(
    { companyId: activeCompanyId, search: productSearch },
    { enabled: !!activeCompanyId && showCreateDialog }
  );

  const { data: saleDetail } = trpc.internalSales.getById.useQuery(
    { id: selectedSaleId! },
    { enabled: !!selectedSaleId && showDetailDialog }
  );

  // Mutations
  const createMutation = trpc.internalSales.create.useMutation({
    onSuccess: () => {
      toast.success("Venda interna criada! Aguardando aprovação do admin.");
      setShowCreateDialog(false);
      resetCreateForm();
      utils.internalSales.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMutation = trpc.internalSales.approve.useMutation({
    onSuccess: () => {
      toast.success("Venda interna aprovada! Estoque atualizado nas duas empresas.");
      utils.internalSales.list.invalidate();
      setShowDetailDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.internalSales.reject.useMutation({
    onSuccess: () => {
      toast.success("Venda interna rejeitada.");
      setShowRejectDialog(false);
      setRejectReason("");
      utils.internalSales.list.invalidate();
      setShowDetailDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelMutation = trpc.internalSales.cancel.useMutation({
    onSuccess: () => {
      toast.success("Venda interna cancelada.");
      utils.internalSales.list.invalidate();
      setShowDetailDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });

  function resetCreateForm() {
    setTargetCompanyId(null);
    setNotes("");
    setCart([]);
    setProductSearch("");
  }

  function addToCart(product: { id: number; name: string; currentStock: number | null; avgCost: string | null; uom: string }) {
    if (cart.find(c => c.sourceProductId === product.id)) {
      toast.error("Produto já adicionado");
      return;
    }
    setCart([...cart, {
      sourceProductId: product.id,
      productName: product.name,
      quantity: 1,
      unitCost: parseFloat(product.avgCost || "0"),
      currentStock: product.currentStock || 0,
      uom: product.uom,
    }]);
  }

  function updateCartItem(index: number, field: "quantity" | "unitCost", value: number) {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], [field]: value };
    setCart(newCart);
  }

  function removeFromCart(index: number) {
    setCart(cart.filter((_, i) => i !== index));
  }

  function handleCreate() {
    if (!targetCompanyId) {
      toast.error("Selecione a empresa de destino");
      return;
    }
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }
    createMutation.mutate({
      sourceCompanyId: activeCompanyId,
      targetCompanyId,
      notes: notes || undefined,
      items: cart.map(item => ({
        sourceProductId: item.sourceProductId,
        productName: item.productName,
        quantity: item.quantity,
        unitCost: item.unitCost,
      })),
    });
  }

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unitCost, 0), [cart]);

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    CANCELLED: "bg-gray-100 text-gray-800",
  };

  const statusLabels: Record<string, string> = {
    PENDING: "Pendente",
    APPROVED: "Aprovada",
    REJECTED: "Rejeitada",
    CANCELLED: "Cancelada",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6" />
              Venda Interna
            </h1>
            <p className="text-muted-foreground">Transferências de produtos entre empresas</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Venda Interna
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <Label>Status:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="PENDING">Pendentes</SelectItem>
              <SelectItem value="APPROVED">Aprovadas</SelectItem>
              <SelectItem value="REJECTED">Rejeitadas</SelectItem>
              <SelectItem value="CANCELLED">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas Internas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : !salesList || salesList.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhuma venda interna registrada</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">ID</th>
                      <th className="p-2">Data</th>
                      <th className="p-2">Direção</th>
                      <th className="p-2">Origem</th>
                      <th className="p-2">Destino</th>
                      <th className="p-2 text-right">Valor</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesList.map((sale) => (
                      <tr key={sale.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">#{sale.id}</td>
                        <td className="p-2">
                          {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString("pt-BR") : "-"}
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className={sale.direction === "SENT" ? "border-orange-300 text-orange-700" : "border-blue-300 text-blue-700"}>
                            {sale.direction === "SENT" ? "Enviada" : "Recebida"}
                          </Badge>
                        </td>
                        <td className="p-2">{sale.sourceCompanyName}</td>
                        <td className="p-2">{sale.targetCompanyName}</td>
                        <td className="p-2 text-right font-medium">
                          R$ {parseFloat(sale.totalAmount?.toString() || "0").toFixed(2)}
                        </td>
                        <td className="p-2">
                          <Badge className={statusColors[sale.status] || ""}>
                            {statusLabels[sale.status] || sale.status}
                          </Badge>
                        </td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedSaleId(sale.id); setShowDetailDialog(true); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Venda Interna</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Target Company */}
              <div>
                <Label>Empresa de Destino</Label>
                <Select value={targetCompanyId?.toString() || ""} onValueChange={(v) => setTargetCompanyId(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {targetCompanies?.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.tradeName || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product Search */}
              <div>
                <Label>Adicionar Produtos</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {productSearch && companyProducts && companyProducts.length > 0 && (
                  <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                    {companyProducts.slice(0, 10).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer"
                        onClick={() => { addToCart(p); setProductSearch(""); }}
                      >
                        <span className="text-sm">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          Est: {p.currentStock || 0} {p.uom} | Custo: R$ {parseFloat(p.avgCost || "0").toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart */}
              {cart.length > 0 && (
                <div>
                  <Label>Itens da Transferência</Label>
                  <div className="border rounded-md mt-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-2 text-left">Produto</th>
                          <th className="p-2 text-center">Qtd</th>
                          <th className="p-2 text-center">Custo Unit.</th>
                          <th className="p-2 text-right">Total</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((item, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="p-2">
                              <div>{item.productName}</div>
                              <div className="text-xs text-muted-foreground">Est: {item.currentStock} {item.uom}</div>
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min={0.001}
                                step={1}
                                value={item.quantity}
                                onChange={(e) => updateCartItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                                className="w-20 text-center mx-auto"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={item.unitCost}
                                onChange={(e) => updateCartItem(idx, "unitCost", parseFloat(e.target.value) || 0)}
                                className="w-24 text-center mx-auto"
                              />
                            </td>
                            <td className="p-2 text-right font-medium">
                              R$ {(item.quantity * item.unitCost).toFixed(2)}
                            </td>
                            <td className="p-2 text-center">
                              <Button variant="ghost" size="sm" onClick={() => removeFromCart(idx)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/50 font-bold">
                          <td colSpan={3} className="p-2 text-right">Total:</td>
                          <td className="p-2 text-right">R$ {cartTotal.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações sobre a transferência..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetCreateForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Criando..." : "Criar Venda Interna"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Venda Interna #{saleDetail?.id}</DialogTitle>
            </DialogHeader>

            {saleDetail && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Origem</Label>
                    <p className="font-medium">{saleDetail.sourceCompanyName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Destino</Label>
                    <p className="font-medium">{saleDetail.targetCompanyName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Data</Label>
                    <p>{saleDetail.createdAt ? new Date(saleDetail.createdAt).toLocaleString("pt-BR") : "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={statusColors[saleDetail.status] || ""}>
                      {statusLabels[saleDetail.status] || saleDetail.status}
                    </Badge>
                  </div>
                  {saleDetail.notes && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">Observações</Label>
                      <p>{saleDetail.notes}</p>
                    </div>
                  )}
                  {saleDetail.rejectionReason && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-red-600">Motivo da Rejeição</Label>
                      <p className="text-red-700">{saleDetail.rejectionReason}</p>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div>
                  <Label>Itens</Label>
                  <table className="w-full text-sm mt-2 border rounded-md">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">Produto</th>
                        <th className="p-2 text-center">Qtd</th>
                        <th className="p-2 text-right">Custo Unit.</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saleDetail.items.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-2">{item.productName}</td>
                          <td className="p-2 text-center">{parseFloat(item.quantity?.toString() || "0")}</td>
                          <td className="p-2 text-right">R$ {parseFloat(item.unitCost?.toString() || "0").toFixed(2)}</td>
                          <td className="p-2 text-right font-medium">R$ {parseFloat(item.totalCost?.toString() || "0").toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 font-bold">
                        <td colSpan={3} className="p-2 text-right">Total:</td>
                        <td className="p-2 text-right">R$ {parseFloat(saleDetail.totalAmount?.toString() || "0").toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Actions */}
                {saleDetail.status === "PENDING" && user?.role === "admin" && (
                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button
                      variant="destructive"
                      onClick={() => { setRejectSaleId(saleDetail.id); setShowRejectDialog(true); }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Rejeitar
                    </Button>
                    <Button
                      onClick={() => approveMutation.mutate({ id: saleDetail.id })}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {approveMutation.isPending ? "Aprovando..." : "Aprovar"}
                    </Button>
                  </div>
                )}

                {saleDetail.status === "PENDING" && (
                  <div className="flex justify-start pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelMutation.mutate({ id: saleDetail.id })}
                      disabled={cancelMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Cancelar Venda
                    </Button>
                  </div>
                )}

                {saleDetail.generatedPurchaseOrderId && (
                  <p className="text-sm text-muted-foreground">
                    Ordem de compra gerada: #{saleDetail.generatedPurchaseOrderId}
                  </p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar Venda Interna</DialogTitle>
            </DialogHeader>
            <div>
              <Label>Motivo da Rejeição</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Informe o motivo..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (rejectSaleId) rejectMutation.mutate({ id: rejectSaleId, reason: rejectReason });
                }}
                disabled={!rejectReason || rejectMutation.isPending}
              >
                Confirmar Rejeição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
