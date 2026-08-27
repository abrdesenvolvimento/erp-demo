import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Clock, CheckCircle2, RefreshCw, Play,
  Flame, AlertTriangle, Timer, Wine, Printer, BarChart3,
  TrendingUp, Hash, ClipboardList
} from "lucide-react";
import { printProductionTicketViaAgent } from "@/lib/printService";

function formatElapsed(date: Date | string | null): string {
  if (!date) return "";
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "< 1min";
  if (diffMin < 60) return `${diffMin}min`;
  return `${Math.floor(diffMin / 60)}h${String(diffMin % 60).padStart(2, "0")}m`;
}

function getUrgencyLevel(date: Date | string | null): "normal" | "warning" | "critical" {
  if (!date) return "normal";
  const diffMin = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diffMin > 15) return "critical";
  if (diffMin > 8) return "warning";
  return "normal";
}

function getUrgencyPercent(date: Date | string | null): number {
  if (!date) return 0;
  const diffMin = (Date.now() - new Date(date).getTime()) / 60000;
  return Math.min(diffMin / 20, 1);
}

const STATUS_CONFIG = {
  PENDING: {
    bg: "bg-sky-500/10",
    border: "border-sky-500/40",
    badge: "bg-sky-500 text-white",
    badgeLabel: "Aguardando",
  },
  IN_PROGRESS: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/50",
    badge: "bg-blue-500 text-white",
    badgeLabel: "Preparando",
  },
  READY: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/50",
    badge: "bg-emerald-500 text-white",
    badgeLabel: "Pronto!",
  },
};

function handlePrintTicket(group: any, destination: string) {
  const win = window.open("", "_blank", "width=400,height=500");
  if (!win) {
    toast.error("Popup bloqueado. Permita popups para imprimir.");
    return;
  }
  const now = new Date().toLocaleString("pt-BR");
  const itemsHtml = group.items
    .map((item: any) => `
      <div class="item">
        <span class="qty">${parseFloat(String(item.quantity))}x</span>
        <span class="name">${item.productName}</span>
      </div>
      ${item.notes ? `<div class="notes"><strong>ATENÇÃO — OBS:</strong> ${item.notes}</div>` : ""}
    `)
    .join("");

  win.document.write(`
    <!DOCTYPE html>
    <html><head><title>Ticket ${destination}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { height: auto !important; min-height: 0 !important; }
      body { font-family: 'Courier New', monospace; padding: 8mm 6mm 5mm 6mm; font-size: 14px; max-width: 80mm; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
      .header h2 { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
      .header .mesa { font-size: 28px; font-weight: 900; margin: 4px 0; }
      .header .info { font-size: 11px; color: #555; }
      .item { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px dotted #ccc; align-items: baseline; }
      .item .qty { font-weight: 900; font-size: 18px; min-width: 35px; }
      .item .name { font-size: 15px; font-weight: 700; flex: 1; }
      .customer { font-size: 14px; font-weight: 900; margin: 3px 0; text-transform: uppercase; }
      .notes { font-size: 15px; font-weight: 900; color: #a00; border: 2px solid #a00; background: #fff2f2; padding: 6px 8px; margin: 3px 0 7px 43px; text-transform: uppercase; line-height: 1.25; }
      .footer { text-align: center; margin-top: 12px; font-size: 10px; border-top: 2px dashed #000; padding-top: 8px; color: #888; }
      @page { size: 80mm auto; margin: 0; }
      @media print { html, body { height: auto !important; width: 80mm; } body { padding: 2mm 4mm; } }
    </style></head><body>
    <div class="header">
      <h2>BAR</h2>
      <div class="mesa">MESA ${group.tableNumber}</div>
      ${group.customerLabel ? `<div class="customer">CLIENTE: ${group.customerLabel}</div>` : ""}
      <div class="info">${now} | Garçom: ${group.waiterName || "—"}</div>
    </div>
    <div class="items">${itemsHtml}</div>
    <div class="footer">Comanda #${group.orderId}</div>
    <script>window.onload = function() { window.print(); window.close(); }<\/script>
    </body></html>
  `);
  win.document.close();
}

export default function SalaoKDSBar() {
  const { activeCompanyId } = useCompany();
  const utils = trpc.useUtils();
  const companyId = activeCompanyId ?? 0;
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<"pedidos" | "analise">("pedidos");
  const [autoPrint, setAutoPrint] = useState(true);
  const printedItemIdsRef = useRef<Set<number>>(new Set());
  const initialLoadRef = useRef(true);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  const { data: items = [], isLoading, refetch } = trpc.salon.getKDSItems.useQuery(
    { companyId, destination: "BAR" },
    { enabled: companyId > 0, refetchInterval: 5000 }
  );

  // Auto-print: detecta novos itens PENDING e imprime automaticamente
  // v48.4: Na carga inicial, imprime itens PENDING recentes (sentAt < 2min)
  // para cobrir o caso onde a tela é aberta logo após o garçom enviar para produção
  useEffect(() => {
    if (!autoPrint || items.length === 0) return;

    const RECENT_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutos
    const nowMs = Date.now();

    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      // Na primeira carga: registra IDs antigos e imprime apenas os recentes
      const recentPendingItems: any[] = [];
      for (const item of items as any[]) {
        const sentTime = item.sentAt ? new Date(item.sentAt).getTime() : 0;
        const isRecent = sentTime > 0 && (nowMs - sentTime) < RECENT_THRESHOLD_MS;
        if (item.status === "PENDING" && isRecent) {
          recentPendingItems.push(item);
        }
        printedItemIdsRef.current.add(item.id);
      }
      // Imprime itens recentes da carga inicial
      if (recentPendingItems.length > 0) {
        const byOrder: Record<number, any[]> = {};
        for (const item of recentPendingItems) {
          if (!byOrder[item.orderId]) byOrder[item.orderId] = [];
          byOrder[item.orderId].push(item);
        }
        for (const [, orderItems] of Object.entries(byOrder)) {
          const first = orderItems[0];
          const ticketData = {
            destination: "BAR" as const,
            tableNumber: first.tableNumber,
            waiterName: first.waiterName,
            customerLabel: first.customerLabel,
            orderId: first.orderId,
            items: orderItems.map((i: any) => ({
              productName: i.productName,
              quantity: i.quantity,
              notes: i.notes,
            })),
          };
          printProductionTicketViaAgent(ticketData).then(r => {
            if (!r.success) {
              if (r.agentOnline && r.printerError) {
                toast.error(`Erro na impressora: ${r.error}`);
              } else {
                toast.error("Print Agent offline — verifique o computador central");
              }
            }
          });
        }
      }
      return;
    }

    // Polls subsequentes: detecta novos itens PENDING que ainda não foram impressos
    const newPendingItems = items.filter(
      (item: any) => item.status === "PENDING" && !printedItemIdsRef.current.has(item.id)
    );
    if (newPendingItems.length === 0) return;
    const byOrder: Record<number, any[]> = {};
    for (const item of newPendingItems) {
      if (!byOrder[item.orderId]) byOrder[item.orderId] = [];
      byOrder[item.orderId].push(item);
      printedItemIdsRef.current.add(item.id);
    }
    // Imprime via Agent ESC/POS ou fallback window.print
    for (const [, orderItems] of Object.entries(byOrder)) {
      const first = orderItems[0];
      const ticketData = {
        destination: "BAR" as const,
        tableNumber: first.tableNumber,
        waiterName: first.waiterName,
        customerLabel: first.customerLabel,
        orderId: first.orderId,
        items: orderItems.map((i: any) => ({
          productName: i.productName,
          quantity: i.quantity,
          notes: i.notes,
        })),
      };
      printProductionTicketViaAgent(ticketData).then(r => {
        if (!r.success) {
          if (r.agentOnline && r.printerError) {
            toast.error(`Erro na impressora: ${r.error}`);
          } else {
            toast.error("Print Agent offline — verifique o computador central");
          }
        }
      });
    }
  }, [items, autoPrint]);

  const { data: stats } = trpc.salon.getKDSStats.useQuery(
    { companyId, destination: "BAR" },
    { enabled: companyId > 0, refetchInterval: 30000 }
  );

  const updateStatusMutation = trpc.salon.updateItemStatus.useMutation({
    onSuccess: () => {
      utils.salon.getKDSItems.invalidate();
      utils.salon.getKDSStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Group items by order
  const orderGroups = items.reduce((acc: Record<number, any>, item: any) => {
    if (!acc[item.orderId]) {
      acc[item.orderId] = {
        orderId: item.orderId,
        tableNumber: item.tableNumber,
        waiterName: item.waiterName,
        customerLabel: item.customerLabel,
        openedAt: item.openedAt,
        items: [],
      };
    }
    acc[item.orderId].items.push(item);
    return acc;
  }, {});

  const groups = Object.values(orderGroups) as any[];

  groups.sort((a: any, b: any) => {
    const aTime = a.items[0]?.sentAt ?? a.items[0]?.createdAt;
    const bTime = b.items[0]?.sentAt ?? b.items[0]?.createdAt;
    if (!aTime) return 1;
    if (!bTime) return -1;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });

  const pendingCount = items.filter((i: any) => i.status === "PENDING").length;
  const inProgressCount = items.filter((i: any) => i.status === "IN_PROGRESS").length;
  const readyCount = items.filter((i: any) => i.status === "READY").length;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-blue-950/30 to-slate-950">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
            <p className="text-gray-400 text-sm">Carregando pedidos...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950/30 to-slate-950">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-md border-b border-blue-900/30 px-4 py-3">
          <div className="flex items-center justify-between max-w-[1800px] mx-auto">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
                  <Wine className="h-6 w-6 text-white" />
                </div>
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">KDS Bar</h1>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-xs">
                    <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                    <span className="text-sky-400">{pendingCount} aguardando</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-blue-400">{inProgressCount} preparando</span>
                  </span>
                  {readyCount > 0 && (
                    <span className="flex items-center gap-1 text-xs">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-emerald-400">{readyCount} pronto{readyCount > 1 ? "s" : ""}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Tab toggle */}
              <div className="flex bg-slate-800/60 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab("pedidos")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeTab === "pedidos" ? "bg-blue-500 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <ClipboardList className="h-3.5 w-3.5 inline mr-1" />
                  Pedidos
                </button>
                <button
                  onClick={() => setActiveTab("analise")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeTab === "analise" ? "bg-blue-500 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <BarChart3 className="h-3.5 w-3.5 inline mr-1" />
                  Análise
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                className="text-gray-400 hover:text-white hover:bg-gray-800/50"
                title="Atualizar"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setAutoPrint(!autoPrint);
                  toast.info(autoPrint ? "Impressão automática desativada" : "Impressão automática ativada");
                }}
                className={autoPrint ? "text-green-400 hover:text-green-300 hover:bg-green-900/30" : "text-gray-500 hover:text-white hover:bg-gray-800/50"}
                title={autoPrint ? "Impressão automática: ATIVADA" : "Impressão automática: DESATIVADA"}
              >
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-w-[1800px] mx-auto">
          {activeTab === "analise" ? (
            /* KDS Analysis Tab */
            <div className="space-y-6">
              {/* Stats cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/80 border border-blue-900/30 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="h-4 w-4 text-blue-400" />
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Pedidos Hoje</span>
                  </div>
                  <p className="text-3xl font-black text-white">{stats?.todayOrders ?? 0}</p>
                  <p className="text-xs text-gray-600 mt-1">{stats?.todayItems ?? 0} itens</p>
                </div>
                <div className="bg-slate-900/80 border border-blue-900/30 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Timer className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Tempo Médio</span>
                  </div>
                  <p className="text-3xl font-black text-white">{stats?.avgPrepTimeMin ?? 0}<span className="text-lg text-gray-500">min</span></p>
                  <p className="text-xs text-gray-600 mt-1">de preparo</p>
                </div>
                <div className="bg-slate-900/80 border border-blue-900/30 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-sky-400" />
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Último Pedido</span>
                  </div>
                  <p className="text-2xl font-black text-white">
                    {stats?.lastOrderTime
                      ? new Date(stats.lastOrderTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">horário</p>
                </div>
                <div className="bg-slate-900/80 border border-blue-900/30 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Em Fila</span>
                  </div>
                  <p className="text-3xl font-black text-white">{pendingCount + inProgressCount}</p>
                  <p className="text-xs text-gray-600 mt-1">itens ativos</p>
                </div>
              </div>

              {/* Item stats table */}
              <div className="bg-slate-900/80 border border-blue-900/30 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-blue-900/30">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-400" />
                    Tempo Médio por Item
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Baseado nos itens preparados hoje</p>
                </div>
                {stats?.itemStats && stats.itemStats.length > 0 ? (
                  <div className="divide-y divide-blue-900/20">
                    {stats.itemStats.map((item: any, idx: number) => (
                      <div key={item.name} className="flex items-center justify-between px-5 py-3 hover:bg-blue-900/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 w-6 text-right">#{idx + 1}</span>
                          <span className="text-white font-medium">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-gray-500">{item.count}x preparado{item.count > 1 ? "s" : ""}</span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min((item.avgPrepMin / (stats.avgPrepTimeMin * 2 || 20)) * 100, 100)}%`,
                                  background: item.avgPrepMin > (stats.avgPrepTimeMin * 1.5)
                                    ? "linear-gradient(90deg, #ef4444, #dc2626)"
                                    : item.avgPrepMin > stats.avgPrepTimeMin
                                    ? "linear-gradient(90deg, #f59e0b, #d97706)"
                                    : "linear-gradient(90deg, #22c55e, #16a34a)",
                                }}
                              />
                            </div>
                            <span className={`text-sm font-bold tabular-nums min-w-[50px] text-right ${
                              item.avgPrepMin > (stats.avgPrepTimeMin * 1.5)
                                ? "text-red-400"
                                : item.avgPrepMin > stats.avgPrepTimeMin
                                ? "text-amber-400"
                                : "text-emerald-400"
                            }`}>
                              {item.avgPrepMin}min
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-gray-600">
                    <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhum item preparado hoje ainda</p>
                  </div>
                )}
              </div>
            </div>
          ) : groups.length === 0 ? (
            /* Empty state with metrics */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-6 bg-emerald-500/10 rounded-full mb-6">
                <CheckCircle2 className="h-20 w-20 text-emerald-500" />
              </div>
              <p className="text-white text-2xl font-bold">Tudo em dia!</p>
              <p className="text-gray-500 mt-2 text-lg">Nenhum item aguardando preparo</p>

              {/* Today's metrics */}
              {stats && (stats.todayOrders > 0 || stats.todayItems > 0) && (
                <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
                  <div className="bg-slate-900/60 border border-blue-900/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-white">{stats.todayOrders}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Pedidos hoje</p>
                  </div>
                  <div className="bg-slate-900/60 border border-blue-900/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-white">{stats.avgPrepTimeMin}<span className="text-sm text-gray-500">min</span></p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Tempo médio</p>
                  </div>
                  <div className="bg-slate-900/60 border border-blue-900/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-white">
                      {stats.lastOrderTime
                        ? new Date(stats.lastOrderTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Último pedido</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Orders grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {groups.map((group: any, groupIdx: number) => {
                const oldestItem = group.items[0];
                const itemTime = oldestItem?.sentAt ?? oldestItem?.createdAt;
                const urgency = getUrgencyLevel(itemTime);
                const urgencyPct = getUrgencyPercent(itemTime);

                const cardBorder =
                  urgency === "critical"
                    ? "border-red-500/60"
                    : urgency === "warning"
                    ? "border-amber-500/40"
                    : "border-blue-800/40";

                const headerBg =
                  urgency === "critical"
                    ? "bg-red-500/15"
                    : urgency === "warning"
                    ? "bg-amber-500/10"
                    : "bg-blue-900/30";

                return (
                  <div
                    key={group.orderId}
                    className={`rounded-2xl border-2 ${cardBorder} bg-slate-900/80 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:scale-[1.01]`}
                    style={{
                      animation: `slideInUp 0.4s ease-out ${groupIdx * 0.05}s both`,
                    }}
                  >
                    {/* Timer bar at top */}
                    <div className="h-1.5 bg-slate-800">
                      <div
                        className="h-full transition-all duration-1000"
                        style={{
                          width: `${urgencyPct * 100}%`,
                          background:
                            urgency === "critical"
                              ? "linear-gradient(90deg, #ef4444, #dc2626)"
                              : urgency === "warning"
                              ? "linear-gradient(90deg, #f59e0b, #d97706)"
                              : "linear-gradient(90deg, #3b82f6, #2563eb)",
                        }}
                      />
                    </div>

                    {/* Card header */}
                    <div className={`px-4 py-3 ${headerBg}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-white">
                            Mesa {group.tableNumber}
                          </span>
                          {urgency === "critical" && (
                            <Flame className="h-5 w-5 text-red-500 animate-pulse" />
                          )}
                          {urgency === "warning" && (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePrintTicket(group, "BAR")}
                            className="p-1.5 text-gray-500 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                            title="Imprimir ticket"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <div className="flex items-center gap-1">
                            <Timer
                              className={`h-4 w-4 ${
                                urgency === "critical"
                                  ? "text-red-400"
                                  : urgency === "warning"
                                  ? "text-amber-400"
                                  : "text-blue-400"
                              }`}
                            />
                            <span
                              className={`text-sm font-bold tabular-nums ${
                                urgency === "critical"
                                  ? "text-red-400"
                                  : urgency === "warning"
                                  ? "text-amber-400"
                                  : "text-blue-400"
                              }`}
                            >
                              {formatElapsed(itemTime)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {group.waiterName && (
                        <p className="text-xs text-gray-400 mt-0.5">{group.waiterName}</p>
                      )}
                      {group.customerLabel && (
                        <p className="text-sm font-bold text-sky-200 mt-1 truncate" title={group.customerLabel}>
                          Cliente: {group.customerLabel}
                        </p>
                      )}
                    </div>

                    {/* Items */}
                    <div className="p-3 space-y-2.5">
                      {group.items.map((item: any) => {
                        const cfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING;
                        return (
                          <div
                            key={item.id}
                            className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3 transition-all`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={`${cfg.badge} text-[10px] px-2 py-0 h-5 font-semibold`}>
                                    {cfg.badgeLabel}
                                  </Badge>
                                </div>
                                <p className="font-bold text-white text-base leading-tight">
                                  <span className="text-blue-400">{parseFloat(String(item.quantity))}x</span>{" "}
                                  {item.productName}
                                </p>
                                {item.notes && (
                                  <div className="mt-3 rounded-xl border-2 border-yellow-400 bg-yellow-400/20 px-3 py-2 shadow-lg shadow-yellow-500/10">
                                    <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-yellow-300">
                                      <AlertTriangle className="h-4 w-4 shrink-0" /> Atenção — observação
                                    </p>
                                    <p className="mt-1 text-base font-extrabold leading-snug text-yellow-100">
                                      {item.notes}
                                    </p>
                                  </div>
                                )}
                                <div className="flex items-center gap-1 mt-1.5">
                                  <Clock className="h-3 w-3 text-gray-600" />
                                  <span className="text-[10px] text-gray-600">
                                    {formatElapsed(item.sentAt ?? item.createdAt)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1.5 shrink-0">
                                {item.status === "PENDING" && (
                                  <button
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        itemId: item.id,
                                        status: "IN_PROGRESS",
                                        companyId,
                                      })
                                    }
                                    className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/30"
                                    title="Iniciar preparo"
                                  >
                                    <Play className="h-5 w-5" />
                                  </button>
                                )}
                                {item.status === "IN_PROGRESS" && (
                                  <button
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        itemId: item.id,
                                        status: "READY",
                                        companyId,
                                      })
                                    }
                                    className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-500/30"
                                    title="Marcar como pronto"
                                  >
                                    <CheckCircle2 className="h-5 w-5" />
                                  </button>
                                )}
                                {item.status === "READY" && (
                                  <div className="p-2 bg-emerald-500/20 rounded-xl">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Animations */}
        <style>{`
          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </DashboardLayout>
  );
}
