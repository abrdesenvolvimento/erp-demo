import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Minus, Trash2, Send, CreditCard, DollarSign,
  QrCode, Users, Clock, ChefHat, CheckCircle2, Search, X, Bell,
  Printer, FileText, ArrowRight
} from "lucide-react";
import { vibrateUrgent } from "@/lib/notificationSound";

const PAYMENT_METHODS = [
  { value: "CASH", label: "Dinheiro", icon: DollarSign },
  { value: "DEBIT", label: "Débito", icon: CreditCard },
  { value: "CREDIT", label: "Crédito", icon: CreditCard },
  { value: "PIX", label: "PIX", icon: QrCode },
];

const ITEM_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Aguardando", color: "bg-yellow-100 text-yellow-700" },
  IN_PROGRESS: { label: "Produzindo", color: "bg-orange-100 text-orange-700" },
  READY: { label: "Pronto", color: "bg-green-100 text-green-700" },
  DELIVERED: { label: "Entregue", color: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "Cancelado", color: "bg-red-100 text-red-600" },
};

export default function SalaoComanda() {
  const [, params] = useRoute("/salao/comanda/:id");
  const [, setLocation] = useLocation();
  const { activeCompanyId, activeBranchId } = useCompany();
  const utils = trpc.useUtils();

  const orderId = parseInt(params?.id ?? "0");
  const companyId = activeCompanyId ?? 0;

  // State
  const [addItemModal, setAddItemModal] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [itemQty, setItemQty] = useState(1);
  const [itemNotes, setItemNotes] = useState("");
  const [tipPercent, setTipPercent] = useState(10);
  const [paymentMethod, setPaymentMethod] = useState("DEBIT");
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [previewModal, setPreviewModal] = useState(false);
  const [serviceFeeModal, setServiceFeeModal] = useState(false);
  const [serviceFeeAccepted, setServiceFeeAccepted] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: order, isLoading, refetch } = trpc.salon.getOrder.useQuery(
    { orderId, companyId },
    { enabled: orderId > 0 && companyId > 0, refetchInterval: 5000 }
  );

  const { data: products = [], isFetching: productsFetching } = trpc.salon.listSalonProducts.useQuery(
    { companyId, search: productSearch },
    { enabled: addItemModal && companyId > 0 && productSearch.length >= 2 }
  );

  // Track ready items for notification
  // -1 = sentinel for "first load, don't alert yet"
  const prevReadyCountRef = useRef<number>(-1);
  useEffect(() => {
    if (!order?.items) return;
    const readyCount = order.items.filter((i: any) => i.status === "READY").length;

    // First load: just record the baseline, don't alert
    if (prevReadyCountRef.current === -1) {
      prevReadyCountRef.current = readyCount;
      return;
    }

    // Alert when ready count increases (new items became READY since last poll)
    if (readyCount > prevReadyCountRef.current) {
      const newReady = readyCount - prevReadyCountRef.current;
      console.log(`[Comanda Alert] ${newReady} new ready items (${prevReadyCountRef.current} \u2192 ${readyCount})`);
      toast.success(
        `${newReady} item(ns) pronto(s) para servir!`,
        { icon: "🔔", duration: 8000 }
      );
      // Vibrate only (sound alert is on the Mesas page)
      vibrateUrgent();
    }
    prevReadyCountRef.current = readyCount;
  }, [order?.items]);

  // Mutations
  const addItemMutation = trpc.salon.addItem.useMutation({
    onSuccess: () => {
      toast.success("Item adicionado!");
      utils.salon.getOrder.invalidate({ orderId, companyId });
      setAddItemModal(false);
      setSelectedProduct(null);
      setItemQty(1);
      setItemNotes("");
      setProductSearch("");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeItemMutation = trpc.salon.removeItem.useMutation({
    onSuccess: () => {
      toast.success("Item removido");
      utils.salon.getOrder.invalidate({ orderId, companyId });
    },
    onError: (e) => toast.error(e.message),
  });

  const requestCheckoutMutation = trpc.salon.requestCheckout.useMutation({
    onSuccess: () => {
      utils.salon.getOrder.invalidate({ orderId, companyId });
    },
    onError: (e) => toast.error(e.message),
  });

  const closeOrderMutation = trpc.salon.closeOrder.useMutation({
    onSuccess: () => {
      toast.success("Conta encerrada com sucesso!");
      utils.salon.listTables.invalidate();
      setLocation("/salao/mesas");
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelOrderMutation = trpc.salon.cancelOrder.useMutation({
    onSuccess: () => {
      toast.success("Comanda cancelada");
      utils.salon.listTables.invalidate();
      setLocation("/salao/mesas");
    },
    onError: (e) => toast.error(e.message),
  });

  const deliverItemMutation = trpc.salon.updateItemStatus.useMutation({
    onSuccess: () => {
      toast.success("Item marcado como entregue!");
      utils.salon.getOrder.invalidate({ orderId, companyId });
      utils.salon.listTables.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAddItem = () => {
    if (!selectedProduct) return;
    addItemMutation.mutate({
      orderId,
      companyId,
      productId: selectedProduct.id,
      quantity: itemQty,
      notes: itemNotes || undefined,
    });
  };

  const handleCheckout = () => {
    closeOrderMutation.mutate({
      orderId,
      companyId,
      branchId: activeBranchId ?? 1,
      payments: [{ method: paymentMethod as any, amount: totalWithTip }],
    });
  };

  const handleRequestCheckout = () => {
    // Step 1: show preview for client to check
    setPreviewModal(true);
  };

  const handleConfirmPreviewAndPay = () => {
    // Step 2: close preview, open service fee confirmation
    setPreviewModal(false);
    setServiceFeeAccepted(true); // default to accepted
    setServiceFeeModal(true);
  };

  const handleServiceFeeDecision = (accepted: boolean) => {
    // Step 3: close service fee modal, set tip, open payment
    setServiceFeeAccepted(accepted);
    setServiceFeeModal(false);
    const finalTip = accepted ? tipPercent : 0;
    if (!accepted) setTipPercent(0);
    requestCheckoutMutation.mutate({ orderId, companyId, tipPercent: finalTip });
    setCheckoutModal(true);
  };

  const handlePrintComanda = () => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) {
      toast.error("Popup bloqueado. Permita popups para imprimir.");
      return;
    }
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>Comanda #${orderId} - Mesa ${order?.tableNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; padding: 10mm; font-size: 12px; max-width: 80mm; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
        .header h2 { font-size: 16px; margin-bottom: 4px; }
        .header p { font-size: 11px; }
        .items { margin: 8px 0; }
        .item { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #ccc; }
        .item-name { flex: 1; }
        .item-qty { width: 30px; text-align: center; }
        .item-price { width: 70px; text-align: right; font-weight: bold; }
        .totals { border-top: 1px dashed #000; margin-top: 8px; padding-top: 8px; }
        .total-row { display: flex; justify-content: space-between; padding: 2px 0; }
        .total-row.grand { font-size: 16px; font-weight: bold; margin-top: 4px; border-top: 2px solid #000; padding-top: 6px; }
        .footer { text-align: center; margin-top: 12px; font-size: 10px; border-top: 1px dashed #000; padding-top: 8px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${printContent}
      <script>window.onload = function() { window.print(); window.close(); }<\/script>
      </body></html>
    `);
    win.document.close();
  };

  const formatCurrency = (v: number | string) =>
    parseFloat(String(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatTime = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Comanda não encontrada</p>
        <Button variant="outline" onClick={() => setLocation("/salao/mesas")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
      </div>
    );
  }

  const activeItems = (order.items ?? []).filter((i: any) => i.status !== "CANCELLED");
  const subtotal = parseFloat(String(order.subtotal ?? "0"));
  const tipAmount = subtotal * (tipPercent / 100);
  const totalWithTip = subtotal + tipAmount;
  const perPerson = order.guestCount > 0 ? totalWithTip / order.guestCount : totalWithTip;

  const isClosed = order.status === "CLOSED" || order.status === "CANCELLED";

  return (
    <DashboardLayout>
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/salao/mesas")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Mesa {order.tableNumber} — Comanda #{orderId}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {order.guestCount} pessoa(s)
            </span>
            {order.openedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Aberta às {formatTime(order.openedAt)}
              </span>
            )}
            {order.waiterName && (
              <span>{order.waiterName}</span>
            )}
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            order.status === "OPEN" ? "border-green-500 text-green-700" :
            order.status === "WAITING_PAYMENT" ? "border-blue-500 text-blue-700" :
            order.status === "CLOSED" ? "border-gray-400 text-gray-600" :
            "border-red-400 text-red-600"
          }
        >
          {order.status === "OPEN" ? "Aberta" :
           order.status === "WAITING_PAYMENT" ? "Aguardando Pgto" :
           order.status === "CLOSED" ? "Encerrada" : "Cancelada"}
        </Badge>
      </div>

      {/* Ready items notification banner */}
      {activeItems.filter((i: any) => i.status === "READY").length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg animate-pulse">
          <Bell className="h-5 w-5 text-green-600" />
          <span className="text-sm font-semibold text-green-700">
            {activeItems.filter((i: any) => i.status === "READY").length} item(ns) pronto(s) para servir!
          </span>
        </div>
      )}

      {/* Items list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Itens da Comanda</CardTitle>
            {!isClosed && (
              <Button size="sm" onClick={() => setAddItemModal(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {activeItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <ChefHat className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Nenhum item adicionado</p>
            </div>
          ) : (
            activeItems.map((item: any) => {
              const statusCfg = ITEM_STATUS_CONFIG[item.status] ?? ITEM_STATUS_CONFIG.PENDING;
              const isReady = item.status === "READY";
              return (
                <div key={item.id} className={`flex items-start gap-3 py-2 border-b last:border-0 ${isReady ? "bg-green-50 border-l-4 border-l-green-500 pl-2 rounded-r" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.productName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {parseFloat(String(item.quantity))}x {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="font-semibold text-sm">{formatCurrency(item.totalPrice)}</p>
                    {isReady && !isClosed && (
                      <button
                        onClick={() => deliverItemMutation.mutate({ itemId: item.id, status: "DELIVERED", companyId })}
                        disabled={deliverItemMutation.isPending}
                        className="flex items-center gap-1 text-[11px] px-2 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors font-medium"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Entregue
                      </button>
                    )}
                    {!isClosed && item.status !== "DELIVERED" && item.status !== "READY" && (
                      <button
                        onClick={() => removeItemMutation.mutate({ itemId: item.id, orderId, companyId })}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!isClosed && item.status === "READY" && (
                      <button
                        onClick={() => removeItemMutation.mutate({ itemId: item.id, orderId, companyId })}
                        className="text-red-400 hover:text-red-600 text-[10px]"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      {activeItems.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>

            {!isClosed && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Taxa de serviço</span>
                <div className="flex items-center gap-2">
                  {[0, 10, 12, 15].map(p => (
                    <button
                      key={p}
                      onClick={() => setTipPercent(p)}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        tipPercent === p
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {p === 0 ? "Sem" : `${p}%`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tipPercent > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa de serviço ({tipPercent}%)</span>
                <span>{formatCurrency(tipAmount)}</span>
              </div>
            )}

            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total com serviço</span>
              <span className="text-lg">{formatCurrency(totalWithTip)}</span>
            </div>
            {tipPercent > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Total sem serviço</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            )}
            {order.guestCount > 1 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Por pessoa ({order.guestCount})</span>
                <span>{formatCurrency(perPerson)}</span>
              </div>
            )}
            {tipPercent > 0 && !isClosed && (
              <p className="text-xs text-muted-foreground italic mt-1">
                Taxa de serviço ({tipPercent}%) é opcional. Informe ao atendente caso não deseje incluir.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!isClosed && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setCancelConfirm(true)}
          >
            Cancelar Comanda
          </Button>
          {activeItems.length > 0 && (
            <Button
              className="flex-1"
              onClick={handleRequestCheckout}
              disabled={requestCheckoutMutation.isPending}
            >
              <Send className="h-4 w-4 mr-1" />
              Fechar Conta
            </Button>
          )}
        </div>
      )}

      {/* Add Item Modal */}
      <Dialog open={addItemModal} onOpenChange={(open) => {
        setAddItemModal(open);
        if (!open) { setSelectedProduct(null); setProductSearch(""); setItemQty(1); setItemNotes(""); }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!selectedProduct ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {productSearch.length < 2 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      Digite o nome do produto para buscar...
                    </p>
                  ) : productsFetching ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                    </div>
                  ) : products.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      Nenhum produto encontrado
                    </p>
                  ) : (
                    products.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProduct(p)}
                        className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                      >
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.productionDestination === "KITCHEN" ? "🍳 Cozinha" :
                             p.productionDestination === "BAR" ? "🍺 Bar" :
                             p.productionDestination === "BOTH" ? "🍳🍺 Cozinha + Bar" : ""}
                          </p>
                        </div>
                        <span className="font-semibold text-sm text-primary">
                          {p.salePrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold">{selectedProduct.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedProduct.salePrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} / un
                    </p>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <Label>Quantidade</Label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Button variant="outline" size="sm" onClick={() => setItemQty(Math.max(1, itemQty - 1))}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-2xl font-bold w-10 text-center">{itemQty}</span>
                    <Button variant="outline" size="sm" onClick={() => setItemQty(itemQty + 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Observação (opcional)</Label>
                  <Input
                    value={itemNotes}
                    onChange={e => setItemNotes(e.target.value)}
                    placeholder="Ex: sem cebola, bem passado..."
                    className="mt-1.5"
                  />
                </div>

                <div className="p-3 bg-muted rounded-lg flex justify-between">
                  <span className="text-sm text-muted-foreground">Total do item</span>
                  <span className="font-bold">
                    {(selectedProduct.salePrice * itemQty).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemModal(false)}>Cancelar</Button>
            {selectedProduct && (
              <Button onClick={handleAddItem} disabled={addItemMutation.isPending}>
                {addItemMutation.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview / Print Comanda Modal (Step 1) */}
      <Dialog open={previewModal} onOpenChange={setPreviewModal}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Pré-visualização da Conta — Mesa {order.tableNumber}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Confira os itens antes de prosseguir com o pagamento</p>
          </DialogHeader>

          {/* Printable content */}
          <div ref={printRef}>
            <div className="header">
              <h2>Comanda #{orderId}</h2>
              <p>Mesa {order.tableNumber} • {order.guestCount} pessoa(s)</p>
              <p>{order.waiterName ? `Garçom: ${order.waiterName}` : ""}</p>
              <p style={{marginTop: '4px'}}>Abertura: {order.openedAt ? new Date(order.openedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</p>
              <p>Tempo de permanência: {order.openedAt ? (() => {
                const diffMs = Date.now() - new Date(order.openedAt).getTime();
                const hours = Math.floor(diffMs / 3600000);
                const mins = Math.floor((diffMs % 3600000) / 60000);
                return hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}min` : `${mins}min`;
              })() : "—"}</p>
            </div>
            <div className="items">
              {activeItems.map((item: any) => (
                <div key={item.id} className="item">
                  <span className="item-name">{item.productName}{item.notes ? ` (${item.notes})` : ""}</span>
                  <span className="item-qty">{parseFloat(String(item.quantity))}x</span>
                  <span className="item-price">{formatCurrency(item.totalPrice)}</span>
                </div>
              ))}
            </div>
            <div className="totals">
              <div className="total-row">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {tipPercent > 0 && (
                <div className="total-row">
                  <span>Taxa de serviço {tipPercent}%</span>
                  <span>{formatCurrency(tipAmount)}</span>
                </div>
              )}
              <div className="total-row grand">
                <span>Total com serviço</span>
                <span>{formatCurrency(totalWithTip)}</span>
              </div>
              <div className="total-row">
                <span>Total sem serviço</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {order.guestCount > 1 && (
                <div className="total-row">
                  <span>Por pessoa ({order.guestCount})</span>
                  <span>{formatCurrency(perPerson)}</span>
                </div>
              )}
            </div>
            <div className="footer">
              <p style={{fontStyle: 'italic', marginBottom: '4px'}}>Taxa de serviço (10%) é opcional.</p>
              <p style={{fontStyle: 'italic', marginBottom: '8px'}}>Informe ao atendente caso não deseje incluir.</p>
              <p>Obrigado pela preferência!</p>
            </div>
          </div>

          {/* Visual preview for screen */}
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Abertura: {order.openedAt ? new Date(order.openedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</span>
              <span>Permanência: {order.openedAt ? (() => {
                const diffMs = Date.now() - new Date(order.openedAt).getTime();
                const hours = Math.floor(diffMs / 3600000);
                const mins = Math.floor((diffMs % 3600000) / 60000);
                return hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}min` : `${mins}min`;
              })() : "—"}</span>
            </div>
            <Separator />
            <h3 className="font-semibold text-sm">Itens da Comanda</h3>
            {activeItems.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b border-dashed last:border-0">
                <div className="flex-1">
                  <span className="font-medium">{item.productName}</span>
                  {item.notes && <span className="text-xs text-muted-foreground ml-1">({item.notes})</span>}
                </div>
                <span className="text-muted-foreground mx-2">{parseFloat(String(item.quantity))}x</span>
                <span className="font-semibold">{formatCurrency(item.totalPrice)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {tipPercent > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa de serviço ({tipPercent}%)</span>
                <span>{formatCurrency(tipAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-1 border-t">
              <span>Total com serviço</span>
              <span>{formatCurrency(totalWithTip)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Total sem serviço</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {order.guestCount > 1 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Por pessoa ({order.guestCount})</span>
                <span>{formatCurrency(perPerson)}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground italic">
              Taxa de serviço (10%) é opcional. Informe ao atendente caso não deseje incluir.
            </p>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handlePrintComanda} className="flex-1">
              <Printer className="h-4 w-4 mr-1" />
              Imprimir Comanda
            </Button>
            <Button onClick={handleConfirmPreviewAndPay} className="flex-1 bg-green-600 hover:bg-green-700">
              Prosseguir para Fechamento
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Modal (Step 2 - Payment) */}
      <Dialog open={checkoutModal} onOpenChange={setCheckoutModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fechar Conta — Mesa {order.tableNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Summary */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {tipPercent > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa de serviço ({tipPercent}%)</span>
                  <span>{formatCurrency(tipAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total com serviço</span>
                <span>{formatCurrency(totalWithTip)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Total sem serviço</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {order.guestCount > 1 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Por pessoa</span>
                  <span>{formatCurrency(perPerson)}</span>
                </div>
              )}
            </div>

            {/* Payment method */}
            <div>
              <Label>Forma de pagamento</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      paymentMethod === m.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <m.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{m.label}</span>
                    {paymentMethod === m.value && (
                      <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutModal(false)}>Voltar</Button>
            <Button
              onClick={handleCheckout}
              disabled={closeOrderMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {closeOrderMutation.isPending ? "Encerrando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Fee Confirmation Modal (Step 2) */}
      <Dialog open={serviceFeeModal} onOpenChange={setServiceFeeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Taxa de Serviço</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal dos itens</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa de serviço (10%)</span>
                <span className="font-semibold">{formatCurrency(subtotal * 0.10)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-1 border-t">
                <span>Total com taxa</span>
                <span>{formatCurrency(subtotal * 1.10)}</span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800 font-medium">O cliente deseja incluir a taxa de serviço?</p>
              <p className="text-xs text-amber-600 mt-1">A taxa de serviço (10%) é opcional conforme legislação vigente.</p>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => handleServiceFeeDecision(false)}
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-1" />
              Não incluir taxa
            </Button>
            <Button
              onClick={() => handleServiceFeeDecision(true)}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Incluir taxa (10%)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirm */}
      <Dialog open={cancelConfirm} onOpenChange={setCancelConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar Comanda?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A comanda #{orderId} da Mesa {order.tableNumber} será cancelada. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelConfirm(false)}>Não</Button>
            <Button
              variant="destructive"
              onClick={() => cancelOrderMutation.mutate({ orderId, companyId })}
              disabled={cancelOrderMutation.isPending}
            >
              Sim, Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
