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
  QrCode, Users, Clock, ChefHat, CheckCircle2, Search, X, Bell
} from "lucide-react";

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

  // Queries
  const { data: order, isLoading, refetch } = trpc.salon.getOrder.useQuery(
    { orderId, companyId },
    { enabled: orderId > 0 && companyId > 0, refetchInterval: 10000 }
  );

  const { data: products = [], isFetching: productsFetching } = trpc.salon.listSalonProducts.useQuery(
    { companyId, search: productSearch },
    { enabled: addItemModal && companyId > 0 && productSearch.length >= 2 }
  );

  // Track ready items for notification
  const prevReadyCountRef = useRef<number>(0);
  useEffect(() => {
    if (!order?.items) return;
    const readyCount = order.items.filter((i: any) => i.status === "READY").length;
    if (readyCount > prevReadyCountRef.current && prevReadyCountRef.current >= 0) {
      const newReady = readyCount - prevReadyCountRef.current;
      if (prevReadyCountRef.current > 0 || readyCount > 0) {
        // Only notify if there are new ready items (not on first load)
        if (prevReadyCountRef.current > 0) {
          toast.success(
            `${newReady} item(ns) pronto(s) para servir!`,
            { icon: "🔔", duration: 8000 }
          );
          // Play notification sound
          try {
            const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczFjmR0teleUMlTIzO5tqFUjA3dLjl4ZRiQjlhk8Db0JlnTjpLeLPW1KV0VDdJYJDI2a6Hn3dPKUlbj8nYqnRLLUhSSZOQzNOtcEw0R1BFR0dMTk5QUlRWWFpcXmBiZGZoamxucHJ0dnp8gIKEhoiKjI6QkpSWmJqcnqCipKaoqqyusLK0tri6vL7AwsTGyMrMztDS1NbY2tze4OLk5ujq7O7w8vT2+Pr8/v8=");
            audio.volume = 0.5;
            audio.play().catch(() => {});
          } catch {}
        }
      }
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
    requestCheckoutMutation.mutate({ orderId, companyId, tipPercent });
    setCheckoutModal(true);
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
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-sm">{formatCurrency(item.totalPrice)}</p>
                    {!isClosed && item.status !== "DELIVERED" && (
                      <button
                        onClick={() => removeItemMutation.mutate({ itemId: item.id, orderId, companyId })}
                        className="text-red-400 hover:text-red-600 mt-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
                <span className="text-muted-foreground">Gorjeta</span>
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
                <span className="text-muted-foreground">Gorjeta ({tipPercent}%)</span>
                <span>{formatCurrency(tipAmount)}</span>
              </div>
            )}

            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-lg">{formatCurrency(totalWithTip)}</span>
            </div>
            {order.guestCount > 1 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Por pessoa ({order.guestCount})</span>
                <span>{formatCurrency(perPerson)}</span>
              </div>
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

      {/* Checkout Modal */}
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
                  <span className="text-muted-foreground">Gorjeta ({tipPercent}%)</span>
                  <span>{formatCurrency(tipAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(totalWithTip)}</span>
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
