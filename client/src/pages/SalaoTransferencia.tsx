import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { ArrowLeftRight, User, UtensilsCrossed, Clock, ChevronDown, ChevronUp, AlertTriangle, History } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function SalaoTransferencia() {
  const { user } = useAuth();
  const activeCompanyId = (user as any)?.activeCompanyId;

  const [transferModal, setTransferModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [newWaiterId, setNewWaiterId] = useState("");
  const [reason, setReason] = useState("");
  const [expandedWaiter, setExpandedWaiter] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: waiterData, refetch } = trpc.salon.getWaiterActiveOrders.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId, refetchInterval: 10000 }
  );

  const { data: transferHistory } = trpc.salon.getTransferHistory.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId && showHistory }
  );

  const transferMutation = trpc.salon.transferOrder.useMutation({
    onSuccess: (data) => {
      toast.success(`Comanda #${data.transfer.orderId} transferida de ${data.transfer.from} para ${data.transfer.to}`);
      setTransferModal(false);
      setSelectedOrder(null);
      setNewWaiterId("");
      setReason("");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const allWaiters = useMemo(() => {
    if (!waiterData) return [];
    return waiterData.filter((w: any) => w.role === 'garcom' || w.role === 'admin');
  }, [waiterData]);

  const totalOpenOrders = useMemo(() => {
    if (!waiterData) return 0;
    return waiterData.reduce((sum: number, w: any) => sum + (w.orders?.length ?? 0), 0);
  }, [waiterData]);

  const openTransferModal = (order: any, currentWaiterId: string) => {
    setSelectedOrder({ ...order, currentWaiterId });
    setNewWaiterId("");
    setReason("");
    setTransferModal(true);
  };

  const handleTransfer = () => {
    if (!selectedOrder || !newWaiterId || !reason.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const targetWaiter = allWaiters.find((w: any) => w.userId === newWaiterId);
    if (!targetWaiter) {
      toast.error("Garçom de destino não encontrado");
      return;
    }
    transferMutation.mutate({
      orderId: selectedOrder.id,
      companyId: activeCompanyId!,
      newWaiterId: newWaiterId,
      newWaiterName: targetWaiter.userName ?? "Desconhecido",
      reason: reason.trim(),
    });
  };

  const formatTime = (date: string | Date | null) => {
    if (!date) return "--";
    const d = new Date(date);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateTime = (date: string | Date | null) => {
    if (!date) return "--";
    const d = new Date(date);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const getElapsed = (openedAt: string | Date | null) => {
    if (!openedAt) return "--";
    const diff = Date.now() - new Date(openedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${m.toString().padStart(2, "0")}min`;
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Apenas administradores podem transferir comandas.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <DashboardLayout>
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-blue-600" />
            Transferência de Comanda
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie a transferência de comandas entre garçons</p>
        </div>
        <Button
          variant={showHistory ? "default" : "outline"}
          onClick={() => setShowHistory(!showHistory)}
          className="gap-2"
        >
          <History className="h-4 w-4" />
          Histórico
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Garçons Ativos</p>
            <p className="text-2xl font-bold text-blue-600">
              {allWaiters.filter((w: any) => w.role === 'garcom').length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Comandas Abertas</p>
            <p className="text-2xl font-bold text-green-600">{totalOpenOrders}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Transferências Hoje</p>
            <p className="text-2xl font-bold text-orange-600">
              {transferHistory?.filter((t: any) => {
                const d = new Date(t.timestamp);
                const today = new Date();
                return d.toDateString() === today.toDateString();
              }).length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Waiter List with Orders */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Garçons e Comandas Associadas</h2>
        
        {!waiterData || waiterData.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum garçom ou comanda ativa encontrada.</p>
            </CardContent>
          </Card>
        ) : (
          waiterData.map((waiter: any) => {
            const isExpanded = expandedWaiter === waiter.userId;
            const orderCount = waiter.orders?.length ?? 0;
            const totalValue = waiter.orders?.reduce((sum: number, o: any) => sum + parseFloat(o.subtotal ?? "0"), 0) ?? 0;

            return (
              <Card key={waiter.userId} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedWaiter(isExpanded ? null : waiter.userId)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      {(waiter.userName ?? "?")[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{waiter.userName ?? "Desconhecido"}</span>
                        <Badge variant={waiter.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                          {waiter.role === 'admin' ? 'Admin' : 'Garçom'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{waiter.userEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-medium">{orderCount} comanda{orderCount !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-muted-foreground">
                        R$ {totalValue.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-muted/20">
                    {orderCount === 0 ? (
                      <div className="p-6 text-center text-muted-foreground text-sm">
                        Nenhuma comanda ativa associada a este garçom.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {waiter.orders.map((order: any) => (
                          <div key={order.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-lg bg-white border-2 border-blue-200 flex flex-col items-center justify-center">
                                <UtensilsCrossed className="h-4 w-4 text-blue-600" />
                                <span className="text-xs font-bold text-blue-700">{order.tableNumber}</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">Comanda #{order.id}</span>
                                  <Badge
                                    variant={order.status === 'OPEN' ? 'default' : 'secondary'}
                                    className={`text-xs ${order.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                                  >
                                    {order.status === 'OPEN' ? 'Aberta' : 'Aguardando Pgto'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Aberta {formatTime(order.openedAt)} ({getElapsed(order.openedAt)})
                                  </span>
                                  <span>{order.guestCount} pessoa{order.guestCount !== 1 ? 's' : ''}</span>
                                  <span>{order.itemCount ?? 0} ite{(order.itemCount ?? 0) !== 1 ? 'ns' : 'm'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-semibold">R$ {parseFloat(order.subtotal ?? "0").toFixed(2).replace('.', ',')}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openTransferModal(order, waiter.userId);
                                }}
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                                Transferir
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Transfer History */}
      {showHistory && (
        <div className="space-y-4">
          <Separator />
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Transferências
          </h2>
          {!transferHistory || transferHistory.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma transferência registrada.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {transferHistory.map((t: any, idx: number) => (
                <Card key={idx} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                          <ArrowLeftRight className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm">
                            <span className="font-medium">Comanda #{t.orderId}</span>
                            <span className="text-muted-foreground"> (Mesa {t.tableNumber})</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="text-red-500 font-medium">{t.fromWaiterName}</span>
                            {" → "}
                            <span className="text-green-600 font-medium">{t.toWaiterName}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{formatDateTime(t.timestamp)}</p>
                        <p className="text-xs text-muted-foreground">por {t.adminName}</p>
                      </div>
                    </div>
                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                      <span className="font-medium">Motivo:</span> {t.reason}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transfer Modal */}
      <Dialog open={transferModal} onOpenChange={setTransferModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-blue-600" />
              Transferir Comanda
            </DialogTitle>
            <DialogDescription>
              Transfira a comanda para outro garçom. O motivo é obrigatório para registro.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Order Info */}
              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Comanda #{selectedOrder.id}</p>
                      <p className="text-sm text-muted-foreground">Mesa {selectedOrder.tableNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R$ {parseFloat(selectedOrder.subtotal ?? "0").toFixed(2).replace('.', ',')}</p>
                      <p className="text-xs text-muted-foreground">{selectedOrder.guestCount} pessoa(s)</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Garçom atual: <span className="font-medium text-foreground">{selectedOrder.waiterName ?? "Desconhecido"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* New Waiter Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Novo Garçom *</label>
                <Select value={newWaiterId} onValueChange={setNewWaiterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o garçom de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {allWaiters
                      .filter((w: any) => w.userId !== selectedOrder.currentWaiterId)
                      .map((w: any) => (
                        <SelectItem key={w.userId} value={w.userId}>
                          <div className="flex items-center gap-2">
                            <span>{w.userName ?? "Desconhecido"}</span>
                            <Badge variant="outline" className="text-xs">
                              {w.role === 'admin' ? 'Admin' : 'Garçom'}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo da Transferência *</label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Troca de turno, garçom saiu mais cedo, redistribuição de mesas..."
                  rows={3}
                  className="resize-none"
                />
                {reason.trim() === "" && (
                  <p className="text-xs text-red-500">O motivo é obrigatório para registro.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTransferModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={!newWaiterId || !reason.trim() || transferMutation.isPending}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <ArrowLeftRight className="h-4 w-4" />
              {transferMutation.isPending ? "Transferindo..." : "Confirmar Transferência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
