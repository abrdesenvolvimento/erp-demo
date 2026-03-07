import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Users, Clock, DollarSign, Settings, ChefHat, X, UtensilsCrossed, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

type TableStatus = "FREE" | "OCCUPIED" | "WAITING_PAYMENT" | "RESERVED";

const STATUS_CONFIG: Record<TableStatus, { label: string; color: string; bg: string; border: string }> = {
  FREE: { label: "Livre", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  OCCUPIED: { label: "Ocupada", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  WAITING_PAYMENT: { label: "Aguardando Pgto", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  RESERVED: { label: "Reservada", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
};

export default function SalaoMesas() {
  const { activeCompanyId, activeBranchId } = useCompany();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Modals
  const [openOrderModal, setOpenOrderModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [guestCount, setGuestCount] = useState(2);
  const [addTableModal, setAddTableModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState("4");
  const [newTableName, setNewTableName] = useState("");
  const [configModal, setConfigModal] = useState(false);

  const companyId = activeCompanyId ?? 0;

  // Queries
  const { data: tables = [], isLoading, refetch } = trpc.salon.listTables.useQuery(
    { companyId },
    { enabled: companyId > 0, refetchInterval: 15000 }
  );

  const { data: stats } = trpc.salon.getDashboardStats.useQuery(
    { companyId },
    { enabled: companyId > 0, refetchInterval: 15000 }
  );

  // Mutations
  const openOrderMutation = trpc.salon.openOrder.useMutation({
    onSuccess: (data) => {
      toast.success("Comanda aberta!");
      utils.salon.listTables.invalidate();
      setOpenOrderModal(false);
      // Navigate to the order page
      setLocation(`/salao/comanda/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const createTableMutation = trpc.salon.createTable.useMutation({
    onSuccess: () => {
      toast.success("Mesa criada!");
      utils.salon.listTables.invalidate();
      setAddTableModal(false);
      setNewTableNumber("");
      setNewTableName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleTableClick = (table: any) => {
    if (table.status === "FREE") {
      setSelectedTable(table);
      setGuestCount(2);
      setOpenOrderModal(true);
    } else if (table.activeOrder) {
      setLocation(`/salao/comanda/${table.activeOrder.id}`);
    }
  };

  const handleOpenOrder = () => {
    if (!selectedTable) return;
    openOrderMutation.mutate({
      companyId,
      tableId: selectedTable.id,
      tableNumber: selectedTable.number,
      guestCount,
      waiterId: user?.id,
      waiterName: user?.name ?? undefined,
    });
  };

  const handleCreateTable = () => {
    const num = parseInt(newTableNumber);
    if (!num || num < 1) {
      toast.error("Número da mesa inválido");
      return;
    }
    createTableMutation.mutate({
      companyId,
      number: num,
      name: newTableName || undefined,
      capacity: parseInt(newTableCapacity) || 4,
    });
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatTime = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return `${h}h${m > 0 ? m + "m" : ""}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const freeTables = tables.filter(t => t.status === "FREE").length;
  const occupiedTables = tables.filter(t => t.status === "OCCUPIED").length;
  const waitingTables = tables.filter(t => t.status === "WAITING_PAYMENT").length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            Salão
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão de mesas e comandas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfigModal(true)}>
            <Settings className="h-4 w-4 mr-1" />
            Configurar
          </Button>
          <Button size="sm" onClick={() => setAddTableModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Mesa
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-3">
            <p className="text-xs text-green-600 font-medium">Livres</p>
            <p className="text-2xl font-bold text-green-700">{freeTables}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-3">
            <p className="text-xs text-orange-600 font-medium">Ocupadas</p>
            <p className="text-2xl font-bold text-orange-700">{occupiedTables}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3">
            <p className="text-xs text-blue-600 font-medium">Aguardando Pgto</p>
            <p className="text-2xl font-bold text-blue-700">{waitingTables}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <p className="text-xs text-primary font-medium">Faturamento Hoje</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(stats?.todayRevenue ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tables grid */}
      {tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <UtensilsCrossed className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">Nenhuma mesa cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Clique em "Nova Mesa" para começar</p>
          <Button className="mt-4" onClick={() => setAddTableModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Mesa
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {tables.map((table) => {
            const statusCfg = STATUS_CONFIG[table.status as TableStatus] ?? STATUS_CONFIG.FREE;
            const order = table.activeOrder;
            const isClickable = table.status === "FREE" || !!order;

            return (
              <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                disabled={!isClickable}
                className={`
                  relative rounded-xl border-2 p-4 text-left transition-all
                  ${statusCfg.bg} ${statusCfg.border}
                  ${isClickable ? "cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]" : "cursor-default opacity-60"}
                `}
              >
                {/* Table number */}
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl font-bold" style={{ color: "inherit" }}>
                    {table.number}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${statusCfg.color} border-current`}
                  >
                    {statusCfg.label}
                  </Badge>
                </div>

                {/* Table name */}
                {table.name && (
                  <p className="text-xs text-muted-foreground mb-1 truncate">{table.name}</p>
                )}

                {/* Order info */}
                {order ? (
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{order.guestCount} pax</span>
                    </div>
                    {order.openedAt && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(order.openedAt)}</span>
                      </div>
                    )}
                    {parseFloat(String(order.totalAmount ?? "0")) > 0 && (
                      <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                        <DollarSign className="h-3 w-3" />
                        <span>{formatCurrency(parseFloat(String(order.totalAmount)))}</span>
                      </div>
                    )}
                    {order.waiterName && (
                      <p className="text-[10px] text-muted-foreground truncate">{order.waiterName}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                    <Users className="h-3 w-3" />
                    <span>Cap. {table.capacity}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Open Order Modal */}
      <Dialog open={openOrderModal} onOpenChange={setOpenOrderModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir Comanda — Mesa {selectedTable?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Número de pessoas</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                >
                  −
                </Button>
                <span className="text-2xl font-bold w-8 text-center">{guestCount}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGuestCount(guestCount + 1)}
                >
                  +
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenOrderModal(false)}>Cancelar</Button>
            <Button onClick={handleOpenOrder} disabled={openOrderMutation.isPending}>
              {openOrderMutation.isPending ? "Abrindo..." : "Abrir Comanda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Table Modal */}
      <Dialog open={addTableModal} onOpenChange={setAddTableModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Mesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Número da mesa *</Label>
              <Input
                type="number"
                min="1"
                value={newTableNumber}
                onChange={e => setNewTableNumber(e.target.value)}
                placeholder="Ex: 1"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Nome / Identificação (opcional)</Label>
              <Input
                value={newTableName}
                onChange={e => setNewTableName(e.target.value)}
                placeholder="Ex: Varanda, VIP..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Capacidade</Label>
              <Select value={newTableCapacity} onValueChange={setNewTableCapacity}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 4, 6, 8, 10, 12].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} pessoas</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTableModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateTable} disabled={createTableMutation.isPending}>
              {createTableMutation.isPending ? "Criando..." : "Criar Mesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Modal placeholder */}
      <Dialog open={configModal} onOpenChange={setConfigModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurações do Salão</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center text-muted-foreground text-sm">
            <ChefHat className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p>Configurações de gorjeta padrão e etiquetas de produção disponíveis em breve.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
