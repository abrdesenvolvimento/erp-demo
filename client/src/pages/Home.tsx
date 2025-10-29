import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { trpc } from "@/lib/trpc";
import { Package, Users, TrendingUp, AlertTriangle, ShoppingCart } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Carregando dados do dashboard..." />
        </div>
      </DashboardLayout>
    );
  }

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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Produtos
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Produtos cadastrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Estoque Baixo
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats?.lowStockProducts || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Produtos abaixo do mínimo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Clientes
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Clientes cadastrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Vendas Hoje
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {stats?.todayRevenue || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.todaySales || 0} vendas realizadas
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
                  {stats.recentSales.map((sale) => (
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
                            {sale.saleType} - {new Date(sale.saleDate!).toLocaleDateString('pt-BR')}
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
                <Link href="/vendas/nova" className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Nova Venda</p>
                    <p className="text-sm text-muted-foreground">
                      Registrar uma nova venda
                    </p>
                  </div>
                </Link>

                <Link href="/produtos" className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors">
                  <Package className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Gerenciar Produtos</p>
                    <p className="text-sm text-muted-foreground">
                      Ver e editar produtos
                    </p>
                  </div>
                </Link>

                <Link href="/parceiros" className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors">
                  <Users className="h-5 w-5 text-primary" />
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
    </DashboardLayout>
  );
}

