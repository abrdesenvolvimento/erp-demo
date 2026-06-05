import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CreditCard, Clock, RefreshCw, Printer, CheckCircle2,
  Receipt, DollarSign, Users, Hash
} from "lucide-react";
import { printReceipt } from "@/lib/printTicket";
import { printReceiptViaAgent } from "@/lib/printService";

function formatTime(date: Date | string | null): string {
  if (!date) return "--:--";
  const d = new Date(date);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(value: number | string | null): string {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function SalaoCaixa() {
  const { activeCompanyId } = useCompany();
  const companyId = activeCompanyId ?? 0;
  const [autoPrint, setAutoPrint] = useState(true);
  const printedOrderIdsRef = useRef<Set<number>>(new Set());
  const initialLoadRef = useRef(true);

  const { data: recentOrders = [], refetch } = trpc.salon.recentlyClosedOrders.useQuery(
    { companyId, sinceMinutes: 30 },
    { enabled: companyId > 0, refetchInterval: 5000 }
  );

  // Auto-print: detecta novas ordens fechadas e imprime cupom
  useEffect(() => {
    if (!autoPrint || recentOrders.length === 0) return;
    if (initialLoadRef.current) {
      recentOrders.forEach((order: any) => printedOrderIdsRef.current.add(order.id));
      initialLoadRef.current = false;
      return;
    }
    const newOrders = recentOrders.filter(
      (order: any) => !printedOrderIdsRef.current.has(order.id)
    );
    if (newOrders.length === 0) return;
    for (const order of newOrders) {
      printedOrderIdsRef.current.add(order.id);
      const activeItems = (order.items || []).filter((i: any) => i.status !== "CANCELLED");
      const subtotal = activeItems.reduce((sum: number, i: any) => {
        const price = typeof i.totalPrice === "string" ? parseFloat(i.totalPrice) : (i.totalPrice ?? 0);
        return sum + price;
      }, 0);
      const tipPercent = order.tipPercent ? parseFloat(String(order.tipPercent)) : 0;
      const tipAmount = subtotal * (tipPercent / 100);
      const totalAmount = typeof order.totalAmount === "string" ? parseFloat(order.totalAmount) : (order.totalAmount ?? subtotal + tipAmount);

      const receiptData = {
        tableNumber: order.tableNumber,
        orderId: order.id,
        waiterName: order.waiterName,
        guestCount: order.guestCount,
        openedAt: order.openedAt,
        items: activeItems.map((i: any) => ({
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: typeof i.unitPrice === "string" ? parseFloat(i.unitPrice) : (i.unitPrice ?? 0),
          totalPrice: typeof i.totalPrice === "string" ? parseFloat(i.totalPrice) : (i.totalPrice ?? 0),
          status: i.status,
        })),
        subtotal,
        tipPercent,
        tipAmount,
        totalAmount,
      };
      printReceiptViaAgent(receiptData, () => printReceipt(receiptData));
      toast.success(`Cupom Mesa ${order.tableNumber} impresso automaticamente`);
    }
  }, [recentOrders, autoPrint]);

  const handleManualPrint = (order: any) => {
    const activeItems = (order.items || []).filter((i: any) => i.status !== "CANCELLED");
    const subtotal = activeItems.reduce((sum: number, i: any) => {
      const price = typeof i.totalPrice === "string" ? parseFloat(i.totalPrice) : (i.totalPrice ?? 0);
      return sum + price;
    }, 0);
    const tipPercent = order.tipPercent ? parseFloat(String(order.tipPercent)) : 0;
    const tipAmount = subtotal * (tipPercent / 100);
    const totalAmount = typeof order.totalAmount === "string" ? parseFloat(order.totalAmount) : (order.totalAmount ?? subtotal + tipAmount);

    const receiptData = {
      tableNumber: order.tableNumber,
      orderId: order.id,
      waiterName: order.waiterName,
      guestCount: order.guestCount,
      openedAt: order.openedAt,
      items: activeItems.map((i: any) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: typeof i.unitPrice === "string" ? parseFloat(i.unitPrice) : (i.unitPrice ?? 0),
        totalPrice: typeof i.totalPrice === "string" ? parseFloat(i.totalPrice) : (i.totalPrice ?? 0),
        status: i.status,
      })),
      subtotal,
      tipPercent,
      tipAmount,
      totalAmount,
    };
    printReceiptViaAgent(receiptData, () => printReceipt(receiptData));
    toast.success(`Cupom Mesa ${order.tableNumber} reimpresso`);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-950">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <CreditCard className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Caixa</h1>
                  <p className="text-xs text-gray-400">Impressão automática de cupons</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={autoPrint ? "border-emerald-500 text-emerald-400" : "border-gray-600 text-gray-400"}>
                  {autoPrint ? "Auto-print ON" : "Auto-print OFF"}
                </Badge>
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
        </div>

        {/* Content */}
        <div className="p-4 max-w-4xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Receipt className="h-3.5 w-3.5" />
                Contas fechadas (30min)
              </div>
              <div className="text-2xl font-bold text-white">{recentOrders.length}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <DollarSign className="h-3.5 w-3.5" />
                Total faturado
              </div>
              <div className="text-2xl font-bold text-emerald-400">
                {formatCurrency(recentOrders.reduce((sum: number, o: any) => {
                  const amt = typeof o.totalAmount === "string" ? parseFloat(o.totalAmount) : (o.totalAmount ?? 0);
                  return sum + amt;
                }, 0))}
              </div>
            </div>
          </div>

          {/* Orders list */}
          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 rounded-full bg-slate-800/50 mb-4">
                <CheckCircle2 className="h-10 w-10 text-emerald-500/50" />
              </div>
              <h3 className="text-lg font-medium text-gray-300 mb-1">Nenhuma conta encerrada recentemente</h3>
              <p className="text-sm text-gray-500">Quando o garçom encerrar uma conta, o cupom será impresso automaticamente aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.slice().reverse().map((order: any) => {
                const activeItems = (order.items || []).filter((i: any) => i.status !== "CANCELLED");
                const totalAmount = typeof order.totalAmount === "string" ? parseFloat(order.totalAmount) : (order.totalAmount ?? 0);
                const wasPrinted = printedOrderIdsRef.current.has(order.id);
                return (
                  <div key={order.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-4 w-4 text-gray-500" />
                          <span className="font-bold text-white text-lg">Mesa {order.tableNumber}</span>
                        </div>
                        {wasPrinted && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Impresso
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManualPrint(order)}
                        className="border-slate-600 text-gray-300 hover:text-white hover:bg-slate-700"
                      >
                        <Printer className="h-3.5 w-3.5 mr-1.5" />
                        Reimprimir
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Fechada às {formatTime(order.closedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {order.waiterName || "Garçom"}
                      </span>
                      <span>{activeItems.length} itens</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                      <span className="text-sm text-gray-400">Total</span>
                      <span className="text-lg font-bold text-emerald-400">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
