import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ChefHat, Clock, CheckCircle2, RefreshCw, Play } from "lucide-react";

const ITEM_STATUS_COLORS: Record<string, string> = {
  PENDING: "border-yellow-400 bg-yellow-50",
  IN_PROGRESS: "border-orange-400 bg-orange-50",
  READY: "border-green-400 bg-green-50",
};

export default function SalaoKDSCozinha() {
  const { activeCompanyId } = useCompany();
  const utils = trpc.useUtils();
  const companyId = activeCompanyId ?? 0;

  const { data: items = [], isLoading, refetch } = trpc.salon.getKDSItems.useQuery(
    { companyId, destination: "KITCHEN" },
    { enabled: companyId > 0, refetchInterval: 8000 }
  );

  const updateStatusMutation = trpc.salon.updateItemStatus.useMutation({
    onSuccess: () => {
      utils.salon.getKDSItems.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const formatTime = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "< 1min";
    if (diffMin < 60) return `${diffMin}min`;
    return `${Math.floor(diffMin / 60)}h${diffMin % 60}m`;
  };

  const getTimeColor = (date: Date | string | null) => {
    if (!date) return "text-muted-foreground";
    const diffMin = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diffMin > 20) return "text-red-600 font-bold";
    if (diffMin > 10) return "text-orange-600 font-semibold";
    return "text-muted-foreground";
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500 rounded-lg">
            <ChefHat className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">KDS — Cozinha</h1>
            <p className="text-sm text-gray-400">
              {items.filter((i: any) => i.status === "PENDING").length} aguardando ·{" "}
              {items.filter((i: any) => i.status === "IN_PROGRESS").length} produzindo
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="border-gray-700 text-gray-300 hover:bg-gray-800">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
          <p className="text-white text-xl font-semibold">Tudo em dia!</p>
          <p className="text-gray-400 mt-1">Nenhum item aguardando produção</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {groups.map((group: any) => (
            <Card key={group.orderId} className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base">
                    Mesa {group.tableNumber}
                  </CardTitle>
                  <div className={`flex items-center gap-1 text-sm ${getTimeColor(group.openedAt)}`}>
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatTime(group.openedAt)}</span>
                  </div>
                </div>
                {group.waiterName && (
                  <p className="text-xs text-gray-400">{group.waiterName}</p>
                )}
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                {group.items.map((item: any) => (
                  <div
                    key={item.id}
                    className={`rounded-lg border-2 p-2.5 ${ITEM_STATUS_COLORS[item.status] ?? "border-gray-600 bg-gray-800"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 leading-tight">
                          {parseFloat(String(item.quantity))}x {item.productName}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-gray-600 mt-0.5 italic">"{item.notes}"</p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3 text-gray-500" />
                          <span className="text-[10px] text-gray-500">{formatTime(item.sentAt ?? item.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {item.status === "PENDING" && (
                          <button
                            onClick={() => updateStatusMutation.mutate({ itemId: item.id, status: "IN_PROGRESS", companyId })}
                            className="p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
                            title="Iniciar produção"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {item.status === "IN_PROGRESS" && (
                          <button
                            onClick={() => updateStatusMutation.mutate({ itemId: item.id, status: "READY", companyId })}
                            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                            title="Marcar como pronto"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {item.status === "READY" && (
                          <Badge className="bg-green-500 text-white text-[10px] px-1.5">Pronto</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
