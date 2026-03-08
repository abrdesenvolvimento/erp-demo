import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Beer, Clock, CheckCircle2, RefreshCw, Play,
  Flame, AlertTriangle, Timer, Wine
} from "lucide-react";

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
  return Math.min(diffMin / 20, 1); // 20 min = 100%
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

export default function SalaoKDSBar() {
  const { activeCompanyId } = useCompany();
  const utils = trpc.useUtils();
  const companyId = activeCompanyId ?? 0;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  const { data: items = [], isLoading, refetch } = trpc.salon.getKDSItems.useQuery(
    { companyId, destination: "BAR" },
    { enabled: companyId > 0, refetchInterval: 5000 }
  );

  const updateStatusMutation = trpc.salon.updateItemStatus.useMutation({
    onSuccess: () => {
      utils.salon.getKDSItems.invalidate();
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
        openedAt: item.openedAt,
        items: [],
      };
    }
    acc[item.orderId].items.push(item);
    return acc;
  }, {});

  const groups = Object.values(orderGroups) as any[];

  // Sort by oldest first
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="text-gray-400 hover:text-white hover:bg-gray-800/50"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-w-[1800px] mx-auto">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="p-6 bg-emerald-500/10 rounded-full mb-6">
                <CheckCircle2 className="h-20 w-20 text-emerald-500" />
              </div>
              <p className="text-white text-2xl font-bold">Tudo em dia!</p>
              <p className="text-gray-500 mt-2 text-lg">Nenhum item aguardando preparo</p>
            </div>
          ) : (
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
                        <div className="flex items-center gap-1.5">
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
                      {group.waiterName && (
                        <p className="text-xs text-gray-400 mt-0.5">{group.waiterName}</p>
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
                                  <div className="mt-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg px-2.5 py-1.5">
                                    <p className="text-xs text-yellow-300 font-medium">
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
