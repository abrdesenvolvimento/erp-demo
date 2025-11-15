import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { trpc } from "@/lib/trpc";
import { TrendingUp, AlertTriangle, ShoppingCart, DollarSign, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

export default function Home() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const [showLowStockModal, setShowLowStockModal] = useState(false);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Carregando dados do dashboard..." />
        </div>
      </DashboardLayout>
    );
  }

  const formatSaleType = (saleType: string, channelName: string | null, customerTradeName: string | null) => {
    if (saleType === "BALCAO") return "Balcão";
    if (saleType === "A_PRAZO") {
      return customerTradeName ? `A Prazo (${customerTradeName})` : "A Prazo";
    }
    if (saleType === "DELIVERY") {
      return channelName || "Delivery";
    }
    return saleType;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do sistema ERP Adega Beira Rio
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-t-4 border-t-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Faturamento Mês
              </CardTitle>
              <Calendar className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                R$ {stats?.monthRevenue || "0.00"}
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Balcão/A Prazo</span>
                  <span className="font-medium text-blue-600">
                    R$ {stats?.monthRevenueBalcao || "0.00"}
                    <span className="text-muted-foreground ml-1">
                      ({stats ? Math.round((parseFloat(stats.monthRevenueBalcao) / parseFloat(stats.monthRevenue)) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium text-blue-600">
                    R$ {stats?.monthRevenueDelivery || "0.00"}
                    <span className="text-muted-foreground ml-1">
                      ({stats ? Math.round((parseFloat(stats.monthRevenueDelivery) / parseFloat(stats.monthRevenue)) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pendente Recebimento
              </CardTitle>
              <DollarSign className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                R$ {stats?.totalPendingReceivables || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total em aberto de vendas a prazo
              </p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Venda Diária
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {stats?.todayRevenue || "0.00"}
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Balcão/A Prazo</span>
                  <span className="font-medium text-green-600">
                    R$ {stats?.todayRevenueBalcao || "0.00"}
                    <span className="text-muted-foreground ml-1">
                      ({stats && parseFloat(stats.todayRevenue) > 0 ? Math.round((parseFloat(stats.todayRevenueBalcao) / parseFloat(stats.todayRevenue)) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium text-green-600">
                    R$ {stats?.todayRevenueDelivery || "0.00"}
                    <span className="text-muted-foreground ml-1">
                      ({stats && parseFloat(stats.todayRevenue) > 0 ? Math.round((parseFloat(stats.todayRevenueDelivery) / parseFloat(stats.todayRevenue)) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-t-4 border-t-yellow-500 cursor-pointer hover:bg-accent transition-colors"
            onClick={() => setShowLowStockModal(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Estoque Baixo
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats?.lowStockCount || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Produtos abaixo do mínimo
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Vendas Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.recentSales && stats.recentSales.length > 0 ? (
                <div className="space-y-4">
                  {stats.recentSales.map((sale: any) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <ShoppingCart className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            Venda #{sale.id}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatSaleType(sale.saleType, sale.channelName, sale.customerTradeName)} - {new Date(sale.saleDate!).toLocaleDateString('pt-BR')} às {new Date(sale.saleDate!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">
                          R$ {sale.finalAmount}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma venda registrada ainda
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <Link href="/vendas" className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Nova Venda</p>
                    <p className="text-sm text-muted-foreground">
                      Registrar uma nova venda
                    </p>
                  </div>
                </Link>

                <Link href="/produtos" className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Gerenciar Produtos</p>
                    <p className="text-sm text-muted-foreground">
                      Ver e editar produtos
                    </p>
                  </div>
                </Link>

                <Link href="/parceiros" className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Gerenciar Parceiros</p>
                    <p className="text-sm text-muted-foreground">
                      Clientes e fornecedores
                    </p>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Estoque Baixo */}
      <Dialog open={showLowStockModal} onOpenChange={setShowLowStockModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Produtos com Estoque Baixo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {stats?.lowStockProducts && stats.lowStockProducts.length > 0 ? (
              stats.lowStockProducts.map((product: any) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      ID: {product.id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      <span className="font-semibold text-yellow-600">
                        {product.currentStock || 0}
                      </span>
                      {" / "}
                      <span className="text-muted-foreground">
                        {product.minStock || 0}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Atual / Mínimo
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum produto com estoque baixo
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
