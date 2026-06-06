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
// Impressão de comanda é enviada via fila do servidor → Print Agent busca e imprime

const PAYMENT_METHODS = [
  { value: "CASH", label: "Dinheiro", icon: DollarSign },
  { value: "DEBIT", label: "Débito", icon: CreditCard },
  { value: "CREDIT", label: "Crédito", icon: CreditCard },
  { value: "PIX", label: "PIX", icon: QrCode },
];

const ITEM_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Rascunho", color: "bg-blue-100 text-blue-700" },
  PENDING: { label: "Enviado", color: "bg-yellow-100 text-yellow-700" },
  IN_PROGRESS: { label: "Produzindo", color: "bg-orange-100 text-orange-700" },
  READY: { label: "Pronto", color: "bg-green-100 text-green-700" },
  DELIVERED: { label: "Entregue", color: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "Cancelado", color: "bg-red-100 text-red-600" },
};

export default function SalaoComanda() {
  const [, params] = useRoute("/salao/comanda/:id");
  const [, setLocation] = useLocation();
  const { activeCompanyId, activeBranchId, activeCompany } = useCompany();
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
  const [splitPayments, setSplitPayments] = useState<Array<{ method: string; amount: number }>>([]);
  const [splitMode, setSplitMode] = useState(false);
  const [splitMethodToAdd, setSplitMethodToAdd] = useState("DEBIT");
  const [splitAmountToAdd, setSplitAmountToAdd] = useState("");
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

  const { data: salonCfg } = trpc.salon.getConfig.useQuery(
    { companyId },
    { enabled: companyId > 0 }
  );

  // Set default tip percent from config when it loads
  const configLoadedRef = useRef(false);
  useEffect(() => {
    if (salonCfg && !configLoadedRef.current) {
      configLoadedRef.current = true;
      if (salonCfg.tipEnabled) {
        setTipPercent(parseFloat(String(salonCfg.defaultTipPercent ?? "10")));
      } else {
        setTipPercent(0);
      }
    }
  }, [salonCfg]);

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
      // Impressão automática é feita no KDS (computador central), não no celular do garçom
      utils.salon.getOrder.invalidate({ orderId, companyId });
      setAddItemModal(false);
      setSelectedProduct(null);
      setItemQty(1);
      setItemNotes("");
      setProductSearch("");
    },
    onError: (e) => toast.error(e.message),
  });

  const sendToProductionMutation = trpc.salon.sendToProduction.useMutation({
    onSuccess: (data) => {
      if (data.sent > 0) {
        toast.success(`${data.sent} item(ns) enviado(s) para produção!`, {
          icon: "\uD83D\uDE80",
        });
      } else {
        toast.info("Nenhum item pendente para enviar");
      }
      utils.salon.getOrder.invalidate({ orderId, companyId });
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

  const decreaseItemMutation = trpc.salon.decreaseItemQuantity.useMutation({
    onSuccess: (data) => {
      toast.success(data.newQuantity === 0 ? "Item removido" : "Quantidade reduzida");
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
      // Impressão do cupom é feita automaticamente na tela do Caixa (computador central)
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

  // Computed values (safe defaults when order not yet loaded)
  const subtotal = parseFloat(String(order?.subtotal ?? "0"));
  const tipAmount = subtotal * (tipPercent / 100);
  const totalWithTip = subtotal + tipAmount;

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
    const finalTotal = tipPercent > 0 ? totalWithTip : subtotal;
    let payments: Array<{ method: string; amount: number }>;
    if (splitMode && splitPayments.length > 0) {
      payments = splitPayments.map(p => ({ method: p.method, amount: p.amount }));
    } else {
      payments = [{ method: paymentMethod, amount: finalTotal }];
    }
    closeOrderMutation.mutate({
      orderId,
      companyId,
      branchId: activeBranchId ?? 1,
      payments: payments as any,
    });
  };

  const splitTotal = splitPayments.reduce((sum, p) => sum + p.amount, 0);
  const finalTotal = tipPercent > 0 ? totalWithTip : subtotal;
  const splitRemaining = Math.max(0, finalTotal - splitTotal);
  const splitComplete = splitMode && Math.abs(splitRemaining) < 0.01;

  const handleAddSplitPayment = () => {
    const amt = parseFloat(splitAmountToAdd);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (amt > splitRemaining + 0.01) {
      toast.error("Valor excede o saldo restante");
      return;
    }
    setSplitPayments(prev => [...prev, { method: splitMethodToAdd, amount: amt }]);
    setSplitAmountToAdd("");
  };

  const handleRemoveSplitPayment = (index: number) => {
    setSplitPayments(prev => prev.filter((_, i) => i !== index));
  };

  const handleFillRemaining = () => {
    if (splitRemaining > 0) {
      setSplitAmountToAdd(splitRemaining.toFixed(2));
    }
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
    // Reset split payment state
    setSplitMode(false);
    setSplitPayments([]);
    setSplitAmountToAdd("");
    setCheckoutModal(true);
  };

  const requestPrintMutation = trpc.salon.requestPrint.useMutation();

  const handlePrintComanda = async () => {
    if (!order) return;
    const activeItems = (order.items ?? []).filter((i: any) => i.status !== "CANCELLED");
    const mappedItems = activeItems.map((i: any) => ({
      productName: i.productName,
      quantity: parseFloat(String(i.quantity)),
      unitPrice: typeof i.unitPrice === "string" ? parseFloat(i.unitPrice) : (i.unitPrice ?? 0),
      totalPrice: typeof i.totalPrice === "string" ? parseFloat(i.totalPrice) : (i.totalPrice ?? 0),
      status: i.status,
    }));
    // Recalcular subtotal a partir dos itens para garantir consistência
    const printSubtotal = mappedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const printTipAmount = printSubtotal * (tipPercent / 100);
    const printTotal = printSubtotal + printTipAmount;
    const receiptData = {
      tableNumber: order.tableNumber,
      orderId: order.id,
      waiterName: order.waiterName,
      guestCount: order.guestCount,
      openedAt: order.openedAt,
      items: mappedItems,
      subtotal: printSubtotal,
      tipPercent,
      tipAmount: printTipAmount,
      totalAmount: printTotal,
      companyName: activeCompany?.companyName || activeCompany?.companyLegalName || "A Brasa Reúne",
      timestamp: new Date().toISOString(),
    };
    try {
      await requestPrintMutation.mutateAsync({
        companyId,
        type: "receipt",
        department: "CASHIER",
        payload: receiptData,
      });
      toast.success("Comanda enviada para impressão (Caixa)");
    } catch (err: any) {
      toast.error(`Erro ao enviar impressão: ${err.message || "Tente novamente"}`);
    }
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
  const perPerson = order.guestCount > 0 ? totalWithTip / order.guestCount : totalWithTip;

  const isClosed = order.status === "CLOSED" || order.status === "CANCELLED";

  return (
    <DashboardLayout>
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/salao/mesas")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-xl font-bold truncate">Mesa {order.tableNumber} — Comanda #{orderId}</h1>
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-0.5 flex-wrap">
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
                    {!isClosed && (item.status !== "DELIVERED" || item.status === "READY") && (
                      <div className="flex items-center gap-1">
                        {parseFloat(String(item.quantity)) > 1 && (
                          <button
                            onClick={() => decreaseItemMutation.mutate({ itemId: item.id, orderId, companyId })}
                            disabled={decreaseItemMutation.isPending}
                            className="text-amber-500 hover:text-amber-700 p-0.5"
                            title="Diminuir 1 unidade"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => removeItemMutation.mutate({ itemId: item.id, orderId, companyId })}
                          disabled={removeItemMutation.isPending}
                          className="text-red-400 hover:text-red-600 p-0.5"
                          title="Remover item completo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Send to Production Button */}
      {!isClosed && activeItems.filter((i: any) => i.status === "DRAFT").length > 0 && (
        <Button
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-6 text-base"
          onClick={() => sendToProductionMutation.mutate({ orderId, companyId })}
          disabled={sendToProductionMutation.isPending}
        >
          <Send className="h-5 w-5 mr-2" />
          {sendToProductionMutation.isPending
            ? "Enviando..."
            : `Enviar para Produção (${activeItems.filter((i: any) => i.status === "DRAFT").length} item(ns))`}
        </Button>
      )}

      {/* Totals */}
      {activeItems.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>



            {tipPercent > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{salonCfg?.gratuityLabel || "Taxa de serviço"} ({tipPercent}%)</span>
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
                {salonCfg?.gratuityLabel || "Taxa de serviço"} ({tipPercent}%) é opcional. Informe ao atendente caso não deseje incluir.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!isClosed && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1 text-red-600 border-red-200 hover:bg-red-50 text-sm"
            onClick={() => setCancelConfirm(true)}
          >
            Cancelar Comanda
          </Button>
          {activeItems.length > 0 && (
            <Button
              className="flex-1 text-sm"
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <p>Mesa {order.tableNumber} &bull; {order.guestCount} pessoa(s)</p>
              <p>{order.waiterName ? `Garçom: ${order.waiterName}` : ""}</p>
              <p style={{marginTop: '4px'}}>Abertura: {order.openedAt ? new Date(order.openedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</p>
              <p>Permanência: {order.openedAt ? (() => {
                const diffMs = Date.now() - new Date(order.openedAt).getTime();
                const hours = Math.floor(diffMs / 3600000);
                const mins = Math.floor((diffMs % 3600000) / 60000);
                return hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}min` : `${mins}min`;
              })() : "—"}</p>
            </div>
            <table className="print-items-table" style={{width: '100%', borderCollapse: 'collapse', marginTop: '8px'}}>
              <thead>
                <tr style={{borderBottom: '1px solid #000', fontSize: '11px', textAlign: 'left'}}>
                  <th style={{padding: '2px 0'}}>Item</th>
                  <th style={{padding: '2px 4px', textAlign: 'center'}}>Qtd</th>
                  <th style={{padding: '2px 4px', textAlign: 'right'}}>Vlr Unit</th>
                  <th style={{padding: '2px 0', textAlign: 'right'}}>Total</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map((item: any) => (
                  <tr key={item.id} style={{fontSize: '12px', borderBottom: '1px dashed #ccc'}}>
                    <td style={{padding: '3px 0'}}>{item.productName}{item.notes ? ` (${item.notes})` : ""}</td>
                    <td style={{padding: '3px 4px', textAlign: 'center'}}>{parseFloat(String(item.quantity))}</td>
                    <td style={{padding: '3px 4px', textAlign: 'right'}}>{formatCurrency(item.unitPrice)}</td>
                    <td style={{padding: '3px 0', textAlign: 'right'}}>{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="totals">
              <div className="total-row">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {tipPercent > 0 && (
                <div className="total-row">
                  <span>{salonCfg?.gratuityLabel || "Taxa de serviço"} {tipPercent}%</span>
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
              <p style={{fontStyle: 'italic', marginBottom: '4px'}}>{salonCfg?.gratuityLabel || "Taxa de serviço"} ({salonCfg?.defaultTipPercent ?? 10}%) é opcional.</p>
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
            {/* Items table with columns */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-1 font-medium">Item</th>
                  <th className="text-center py-1 font-medium w-12">Qtd</th>
                  <th className="text-right py-1 font-medium w-24">Vlr Unit</th>
                  <th className="text-right py-1 font-medium w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map((item: any) => (
                  <tr key={item.id} className="border-b border-dashed last:border-0">
                    <td className="py-1.5">
                      <span className="font-medium">{item.productName}</span>
                      {item.notes && <span className="text-xs text-muted-foreground ml-1">({item.notes})</span>}
                    </td>
                    <td className="text-center py-1.5 text-muted-foreground">{parseFloat(String(item.quantity))}</td>
                    <td className="text-right py-1.5 text-muted-foreground">{formatCurrency(item.unitPrice)}</td>
                    <td className="text-right py-1.5 font-semibold">{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {tipPercent > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{salonCfg?.gratuityLabel || "Taxa de serviço"} ({tipPercent}%)</span>
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
              {salonCfg?.gratuityLabel || "Taxa de serviço"} ({salonCfg?.defaultTipPercent ?? 10}%) é opcional. Informe ao atendente caso não deseje incluir.
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fechar Conta — Mesa {order.tableNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
            {/* Summary */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {tipPercent > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{salonCfg?.gratuityLabel || "Taxa de serviço"} ({tipPercent}%)</span>
                  <span>{formatCurrency(tipAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>{tipPercent > 0 ? "Total com serviço" : "Total"}</span>
                <span>{formatCurrency(finalTotal)}</span>
              </div>
              {tipPercent > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Total sem serviço</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              )}
              {order.guestCount > 1 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Por pessoa</span>
                  <span>{formatCurrency(perPerson)}</span>
                </div>
              )}
            </div>

            {/* Toggle: Single vs Split */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSplitMode(false); setSplitPayments([]); }}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                  !splitMode ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                Pagamento Único
              </button>
              <button
                onClick={() => setSplitMode(true)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                  splitMode ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                Dividir Pagamento
              </button>
            </div>

            {!splitMode ? (
              /* Single payment mode */
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
            ) : (
              /* Split payment mode */
              <div className="space-y-3">
                {/* Already added payments */}
                {splitPayments.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Pagamentos adicionados</Label>
                    {splitPayments.map((p, i) => {
                      const methodInfo = PAYMENT_METHODS.find(m => m.value === p.method);
                      return (
                        <div key={i} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            {methodInfo && <methodInfo.icon className="h-4 w-4 text-green-700" />}
                            <span className="text-sm font-medium text-green-800">{methodInfo?.label ?? p.method}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-green-800">{formatCurrency(p.amount)}</span>
                            <button
                              onClick={() => handleRemoveSplitPayment(i)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Remaining balance */}
                <div className={`rounded-lg p-3 text-center font-bold text-lg ${
                  splitComplete
                    ? "bg-green-100 text-green-800 border border-green-300"
                    : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}>
                  {splitComplete
                    ? <span className="flex items-center justify-center gap-2"><CheckCircle2 className="h-5 w-5" /> Valor completo!</span>
                    : <span>Saldo restante: {formatCurrency(splitRemaining)}</span>
                  }
                </div>

                {/* Add new payment */}
                {!splitComplete && (
                  <div className="border rounded-lg p-3 space-y-3">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Adicionar pagamento</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map(m => (
                        <button
                          key={m.value}
                          onClick={() => setSplitMethodToAdd(m.value)}
                          className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-colors text-sm ${
                            splitMethodToAdd === m.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <m.icon className="h-3.5 w-3.5" />
                          <span className="font-medium">{m.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={splitRemaining}
                          value={splitAmountToAdd}
                          onChange={(e) => setSplitAmountToAdd(e.target.value)}
                          placeholder="0,00"
                          className="pl-9"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleFillRemaining}
                        className="text-xs whitespace-nowrap"
                      >
                        Restante
                      </Button>
                      <Button
                        onClick={handleAddSplitPayment}
                        size="sm"
                        className="bg-primary"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutModal(false)}>Voltar</Button>
            <Button
              onClick={handleCheckout}
              disabled={closeOrderMutation.isPending || (splitMode && !splitComplete)}
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
            <DialogTitle>{salonCfg?.gratuityLabel || "Taxa de Serviço"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal dos itens</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{salonCfg?.gratuityLabel || "Taxa de serviço"} ({tipPercent}%)</span>
                <span className="font-semibold">{formatCurrency(tipAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-1 border-t">
                <span>Total com taxa</span>
                <span>{formatCurrency(totalWithTip)}</span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800 font-medium">O cliente deseja incluir a {(salonCfg?.gratuityLabel || "taxa de serviço").toLowerCase()}?</p>
              <p className="text-xs text-amber-600 mt-1">{salonCfg?.gratuityLabel || "Taxa de serviço"} ({tipPercent}%) é opcional conforme legislação vigente.</p>
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
              Incluir {(salonCfg?.gratuityLabel || "taxa").toLowerCase()} ({tipPercent}%)
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
