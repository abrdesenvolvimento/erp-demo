import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, AlertTriangle, ShoppingCart, DollarSign, Calendar, Package, Clock, ChevronDown, ChevronRight, Target, CreditCard, Users, UserCheck, UserX, LogIn, LogOut } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { SaleDetailsModal } from "@/components/SaleDetailsModal";
import { CompactSalesCalendar } from "@/components/CompactSalesCalendar";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDateBR } from "@shared/dateUtils";
import { useCompany } from "@/contexts/CompanyContext";
import { UtensilsCrossed } from "lucide-react";
import { useLocation } from "wouter";

function SalonOccupiedCard() {
  const { data: salonStats, isLoading } = trpc.salon.getDashboardStats.useQuery();
  return (
    <Link href="/salao/mesas">
      <Card className="border-t-4 border-t-orange-500 cursor-pointer hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mesas Ocupadas</CardTitle>
          <UtensilsCrossed className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <>
              <div className="text-2xl font-bold text-orange-600">
                {salonStats?.occupiedTables ?? 0} / {salonStats?.totalTables ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">mesas em uso agora</p>
              <p className="text-xs text-orange-600 mt-2">Clique para gerenciar mesas →</p>
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const effectiveRole = activeCompany?.role || user?.role;
  const isAdmin = effectiveRole === "admin";
  const isConsultor = effectiveRole === "consultor";
  const isOperacional = effectiveRole === "operacional";
  const isGarcom = effectiveRole === "garcom";
  const canViewFinancials = isAdmin || isConsultor; // Admin e Consultor podem ver informações financeiras
  const isHamburgueria = activeCompany?.segment === 'Hamburgueria' || activeCompany?.companyId === 2;
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: purchaseStats, isLoading: isPurchaseLoading } = trpc.dashboard.purchaseStats.useQuery();
  const { data: marginData, isLoading: isMarginLoading } = trpc.dashboard.grossMarginByCategory.useQuery();
  const { data: creditSummary, isLoading: isCreditLoading } = trpc.dashboard.creditSummary.useQuery();
  const { data: deliveryMargin, isLoading: isDeliveryMarginLoading } = trpc.dashboard.deliveryNetMargin.useQuery();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const { data: goalProgress, isLoading: isGoalProgressLoading } = trpc.goals.progress.useQuery(
    { year: currentYear, month: currentMonth },
    { enabled: isAdmin || isConsultor }
  );
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [showExpiringModal, setShowExpiringModal] = useState(false);
  const [showStockValueModal, setShowStockValueModal] = useState(false);
  const [showDeliveryMarginModal, setShowDeliveryMarginModal] = useState(false);
  const [showGrossMarginModal, setShowGrossMarginModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [showSaleDetailsModal, setShowSaleDetailsModal] = useState(false);

  const handleSaleClick = (saleId: number) => {
    setSelectedSaleId(saleId);
    setShowSaleDetailsModal(true);
  };

  const closeSaleDetailsModal = () => {
    setShowSaleDetailsModal(false);
    setSelectedSaleId(null);
  };

  const toggleCategory = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Garçom é redirecionado automaticamente para a tela de mesas
  const [, navigate] = useLocation();
  useEffect(() => {
    if (isGarcom) {
      navigate('/salao/mesas');
    }
  }, [isGarcom, navigate]);

  if (isGarcom) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Redirecionando para o Salão..." />
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Carregando dados do dashboard..." />
        </div>
      </DashboardLayout>
    );
  }

  const formatCurrency = (value: string | number | null | undefined): string => {
    if (!value) return "0,00";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const formatSaleType = (saleType: string, channelName: string | null, customerTradeName: string | null) => {
    if (saleType === "BALCAO") return "Balcão";
    if (saleType === "A_PRAZO") {
      return customerTradeName ? `A Prazo (${customerTradeName})` : "A Prazo";
    }
    if (saleType === "DELIVERY") {
      return channelName || "Delivery";
    }
    if (saleType === "SALAO") return "Salão";
    return saleType;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão Geral
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {canViewFinancials && (
          <Card className="border-t-4 border-t-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Faturamento Mês
              </CardTitle>
              <Calendar className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                R$ {formatCurrency(stats?.monthRevenue)}
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Balcão</span>
                  <span className="font-medium text-blue-600">
                    R$ {formatCurrency(stats?.monthRevenueBalcao)}
                    <span className="text-muted-foreground ml-1">
                      ({stats && parseFloat(stats.monthRevenue) > 0 ? Math.round((parseFloat(stats.monthRevenueBalcao) / parseFloat(stats.monthRevenue)) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium text-blue-600">
                    R$ {formatCurrency(stats?.monthRevenueDelivery)}
                    <span className="text-muted-foreground ml-1">
                      ({stats && parseFloat(stats.monthRevenue) > 0 ? Math.round((parseFloat(stats.monthRevenueDelivery) / parseFloat(stats.monthRevenue)) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {canViewFinancials && (
          <Card className="border-t-4 border-t-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pendente Recebimento
              </CardTitle>
              <DollarSign className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                R$ {formatCurrency(stats?.totalPendingReceivables)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total em aberto de vendas a prazo
              </p>
            </CardContent>
          </Card>
          )}

          <Card className="border-t-4 border-t-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Venda Diária
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {formatCurrency(stats?.todayRevenue)}
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Balcão</span>
                  <span className="font-medium text-green-600">
                    R$ {formatCurrency(stats?.todayRevenueBalcao)}
                    <span className="text-muted-foreground ml-1">
                      ({stats && parseFloat(stats.todayRevenue) > 0 ? Math.round((parseFloat(stats.todayRevenueBalcao) / parseFloat(stats.todayRevenue)) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium text-green-600">
                    R$ {formatCurrency(stats?.todayRevenueDelivery)}
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

          {isAdmin && (
            <Card 
              className="border-t-4 border-t-purple-500 cursor-pointer hover:bg-accent transition-colors"
              onClick={() => setShowStockValueModal(true)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Valor Total em Estoque
                </CardTitle>
                <Package className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {stats?.totalStockValue 
                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(stats.totalStockValue))
                    : 'R$ 0,00'
                  }
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Clique para ver detalhes por categoria
                </p>
              </CardContent>
            </Card>
          )}

          <Card 
            className={`border-t-4 cursor-pointer hover:bg-accent transition-colors ${
              (stats?.expiringProductsCount || 0) > 0 
                ? 'border-t-red-500' 
                : 'border-t-gray-300'
            }`}
            onClick={() => setShowExpiringModal(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Produtos Vencendo
              </CardTitle>
              <Clock className={`h-4 w-4 ${
                (stats?.expiringProductsCount || 0) > 0 
                  ? 'text-red-500' 
                  : 'text-gray-400'
              }`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                (stats?.expiringProductsCount || 0) > 0 
                  ? 'text-red-600' 
                  : 'text-gray-400'
              }`}>
                {stats?.expiringProductsCount || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {(stats?.expiringProductsCount || 0) > 0 
                  ? 'Produtos com vencimento em até 30 dias' 
                  : 'Nenhum produto vencendo'}
              </p>
            </CardContent>
          </Card>

          {canViewFinancials && (
            <Card className="border-t-4 border-t-indigo-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Compras do Mês
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                {isPurchaseLoading ? (
                  <div className="text-sm text-muted-foreground">Carregando...</div>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-indigo-600">
                      R$ {formatCurrency(purchaseStats?.totalCurrentMonth)}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {purchaseStats?.byDocType.map((item) => (
                        <div key={item.docType} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-medium text-indigo-600">
                            R$ {formatCurrency(item.total)}
                            <span className="text-muted-foreground ml-1">
                              ({purchaseStats.totalCurrentMonth && parseFloat(purchaseStats.totalCurrentMonth) > 0
                                ? Math.round((parseFloat(item.total) / parseFloat(purchaseStats.totalCurrentMonth)) * 100)
                                : 0}%)
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Card de Margem Líquida Delivery - Apenas para Admin */}
          {isAdmin && (
            <Card 
              className="border-t-4 border-t-pink-500 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setShowDeliveryMarginModal(true)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Mg Líquida Delivery
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-pink-500" />
              </CardHeader>
              <CardContent>
                {isDeliveryMarginLoading ? (
                  <div className="text-sm text-muted-foreground">Carregando...</div>
                ) : deliveryMargin && parseFloat(deliveryMargin.deliveryRevenue) > 0 ? (
                  <>
                    <div className="text-2xl font-bold text-pink-600">{deliveryMargin.netMarginPercent}%</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Faturamento: R$ {formatCurrency(deliveryMargin.deliveryRevenue)}
                    </p>
                    <p className="text-xs text-pink-600 mt-2">
                      Clique para ver detalhes
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem vendas delivery</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Card de Margem Bruta por Categoria - Apenas para Admin */}
          {isAdmin && (
            <Card 
              className="border-t-4 border-t-teal-500 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setShowGrossMarginModal(true)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Mg Bruta por Categoria
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-teal-500" />
              </CardHeader>
              <CardContent>
                {isMarginLoading ? (
                  <div className="text-sm text-muted-foreground">Carregando...</div>
                ) : marginData && marginData.length > 0 ? (
                  <>
                    <div className="text-2xl font-bold text-teal-600">
                      {(() => {
                        const totalRevenue = marginData.reduce((sum, cat) => sum + parseFloat(cat.totalRevenue), 0);
                        const totalCost = marginData.reduce((sum, cat) => sum + parseFloat(cat.totalCost), 0);
                        const overallMargin = totalRevenue > 0 ? (1 - (totalCost / totalRevenue)) * 100 : 0;
                        return overallMargin.toFixed(1);
                      })()}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Margem geral do mês
                    </p>
                    <p className="text-xs text-teal-600 mt-2">
                      Clique para ver por categoria
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem vendas no mês</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Card de Crédito Concedido - Admin */}
          {isAdmin && (
            <Card 
              className="border-t-4 border-t-cyan-500 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setShowCreditModal(true)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Crédito Concedido
                </CardTitle>
                <CreditCard className="h-4 w-4 text-cyan-500" />
              </CardHeader>
              <CardContent>
                {isCreditLoading ? (
                  <div className="text-sm text-muted-foreground">Carregando...</div>
                ) : creditSummary ? (
                  <>
                    <div className="text-2xl font-bold text-cyan-600">
                      R$ {formatCurrency(creditSummary.totalUsed)}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Limite Total</span>
                        <span className="font-medium">R$ {formatCurrency(creditSummary.totalLimit)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Disponível</span>
                        <span className="font-medium text-green-600">R$ {formatCurrency(creditSummary.totalAvailable)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div 
                          className={`h-1.5 rounded-full ${creditSummary.usagePercent > 80 ? 'bg-red-500' : creditSummary.usagePercent > 50 ? 'bg-amber-500' : 'bg-cyan-500'}`}
                          style={{ width: `${Math.min(creditSummary.usagePercent, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        {creditSummary.usagePercent.toFixed(1)}% utilizado • {creditSummary.customersWithBalance} cliente(s)
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Card de Meta do Mês - Admin e Consultor */}
          {canViewFinancials && (
            <Link href="/metas">
              <Card 
                className="border-t-4 border-t-emerald-500 cursor-pointer hover:shadow-md transition-shadow"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Meta do Mês
                  </CardTitle>
                  <Target className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  {isGoalProgressLoading ? (
                    <div className="text-sm text-muted-foreground">Carregando...</div>
                  ) : goalProgress && goalProgress.goals.length > 0 ? (
                    <>
                      <div className={`text-2xl font-bold ${
                        goalProgress.overallProgress >= 100 
                          ? 'text-green-600' 
                          : goalProgress.overallProgress >= 80 
                            ? 'text-amber-600' 
                            : 'text-emerald-600'
                      }`}>
                        {goalProgress.overallProgress.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {goalProgress.overallProgress >= 100 
                          ? 'Meta atingida!' 
                          : `Faltam R$ ${formatCurrency(goalProgress.totalTarget - goalProgress.totalRevenue)}`
                        }
                      </p>
                      <p className="text-xs text-emerald-600 mt-2">
                        Clique para gerenciar metas
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">Nenhuma meta configurada</p>
                      <p className="text-xs text-emerald-600 mt-2">
                        Clique para criar metas
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>
          )}

          {/* Card de Mesas Ocupadas - apenas para Hamburgueria */}
          {isHamburgueria && <SalonOccupiedCard />}
        </div>

        {/* Painel de Presença dos Garçons - apenas para Hamburgueria e Admin */}
        {isHamburgueria && isAdmin && <WaiterPresencePanel />}

        {/* Calendário Compacto de Vendas - Oculto para Operacional */}
        {!isOperacional && (
        <Card>
          <CardContent className="pt-6">
            <CompactSalesCalendar />
          </CardContent>
        </Card>
        )}

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

      {/* Modal de Valor em Estoque por Categoria */}
      <Dialog open={showStockValueModal} onOpenChange={setShowStockValueModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Valor em Estoque por Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-muted-foreground">Valor Total em Estoque</p>
              <p className="text-3xl font-bold text-purple-600">
                {stats?.totalStockValue 
                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(stats.totalStockValue))
                  : 'R$ 0,00'
                }
              </p>
            </div>
            
            <div className="space-y-3">
              {stats?.stockValueByCategory && stats.stockValueByCategory.length > 0 ? (
                stats.stockValueByCategory.map((category: any) => {
                  const isExpanded = expandedCategories.has(category.categoryId);
                  return (
                    <div key={category.categoryId} className="border rounded-lg">
                      {/* Cabeçalho da categoria (clicável) */}
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => toggleCategory(category.categoryId)}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <p className="font-medium">{category.categoryName}</p>
                            <p className="text-xs text-muted-foreground">
                              {(parseFloat(stats.totalStockValue) > 0 ? ((parseFloat(category.value) / parseFloat(stats.totalStockValue)) * 100).toFixed(1) : '0.0')}% do total • {category.products?.length || 0} produtos
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-purple-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(category.value))}
                          </p>
                        </div>
                      </div>

                      {/* Lista de produtos (expansível) */}
                      {isExpanded && category.products && category.products.length > 0 && (
                        <div className="border-t bg-muted/30">
                          <div className="p-3 space-y-2">
                            {category.products.map((product: any) => (
                              <div
                                key={product.id}
                                className="flex items-center justify-between p-3 bg-background rounded border text-sm"
                              >
                                <div className="flex-1">
                                  <p className="font-medium">{product.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    ID: {product.id} • Estoque: {product.currentStock} un • Custo médio: R$ {product.avgCost}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-purple-600">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(product.value))}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum produto com estoque
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Produtos Vencendo */}
      <Dialog open={showExpiringModal} onOpenChange={setShowExpiringModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Produtos Próximos ao Vencimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {stats?.expiringProducts && stats.expiringProducts.length > 0 ? (
              stats.expiringProducts.map((product: any) => {
                const isExpired = product.daysUntilExpiration < 0;
                const isUrgent = product.daysUntilExpiration >= 0 && product.daysUntilExpiration <= 7;
                const isWarning = product.daysUntilExpiration > 7 && product.daysUntilExpiration <= 15;
                
                return (
                  <div
                    key={product.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      isExpired ? 'bg-red-50 border-red-300' :
                      isUrgent ? 'bg-orange-50 border-orange-300' :
                      isWarning ? 'bg-yellow-50 border-yellow-300' :
                      'bg-blue-50 border-blue-300'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-sm text-muted-foreground">
                          ID: {product.id}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Estoque: {product.currentStock || 0} un
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${
                        isExpired ? 'text-red-600' :
                        isUrgent ? 'text-orange-600' :
                        isWarning ? 'text-yellow-600' :
                        'text-blue-600'
                      }`}>
                        {isExpired 
                          ? `Vencido há ${Math.abs(product.daysUntilExpiration)} dias`
                          : product.daysUntilExpiration === 0
                          ? 'Vence hoje!'
                          : product.daysUntilExpiration === 1
                          ? 'Vence amanhã!'
                          : `Vence em ${product.daysUntilExpiration} dias`
                        }
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateBR(product.expirationDate)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Nenhum produto com vencimento próximo
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Produtos com data de vencimento em até 30 dias aparecerão aqui
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes da Venda */}
      <SaleDetailsModal
        saleId={selectedSaleId}
        open={showSaleDetailsModal}
        onClose={closeSaleDetailsModal}
      />

      {/* Modal de Margem Líquida Delivery */}
      <Dialog open={showDeliveryMarginModal} onOpenChange={setShowDeliveryMarginModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Margem Líquida Delivery
            </DialogTitle>
          </DialogHeader>
          {deliveryMargin && parseFloat(deliveryMargin.deliveryRevenue) > 0 ? (
            <div className="space-y-4">
              {/* Resumo Principal */}
              <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-purple-900">Margem Líquida (após taxa 7%)</p>
                    <p className="text-xs text-purple-700 mt-0.5">
                      Faturamento Delivery: <span className="font-semibold">R$ {formatCurrency(deliveryMargin.deliveryRevenue)}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold text-purple-600">
                      {deliveryMargin.netMarginPercent}%
                    </p>
                    <p className="text-xs text-purple-700">margem líquida</p>
                  </div>
                </div>
                
                {/* Detalhamento */}
                <div className="space-y-2 pt-3 border-t border-purple-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-700">Custo dos Produtos:</span>
                    <span className="font-semibold text-purple-900">R$ {formatCurrency(deliveryMargin.totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-700">Lucro Bruto:</span>
                    <span className="font-semibold text-purple-900">R$ {formatCurrency(deliveryMargin.grossProfit)} ({deliveryMargin.grossMarginPercent}%)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-700">Taxa iFood (7%):</span>
                    <span className="font-semibold text-red-600">- R$ {formatCurrency(deliveryMargin.ifoodFee)}</span>
                  </div>
                  <div className="flex justify-between text-base pt-2 border-t border-purple-200">
                    <span className="font-semibold text-purple-900">Lucro Líquido:</span>
                    <span className="font-bold text-purple-600">R$ {formatCurrency(deliveryMargin.netProfit)}</span>
                  </div>
                </div>
              </div>
              
              {/* Comparação */}
              <div className="text-sm text-muted-foreground">
                <p className="mb-1">
                  <span className="font-semibold">Impacto da taxa:</span> A taxa de 7% do iFood reduz a margem de {deliveryMargin.grossMarginPercent}% para {deliveryMargin.netMarginPercent}%
                </p>
              </div>
              
              {/* Botão para análise detalhada */}
              <Link href="/analise-delivery">
                <Button variant="default" className="w-full" onClick={() => setShowDeliveryMarginModal(false)}>
                  Ver Análise Detalhada por Produto →
                </Button>
              </Link>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Nenhuma venda delivery no mês atual</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Margem Bruta por Categoria */}
      <Dialog open={showGrossMarginModal} onOpenChange={setShowGrossMarginModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-emerald-500" />
              Margem Bruta por Categoria
            </DialogTitle>
          </DialogHeader>
          {marginData && marginData.length > 0 ? (
            <div className="space-y-4">
              {/* Margem Geral */}
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-900">Margem Geral</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Faturamento Total: <span className="font-semibold">R$ {formatCurrency(
                        stats?.monthRevenue || 0
                      )}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold text-emerald-600">
                      {(() => {
                        const totalRevenue = marginData.reduce((sum, cat) => sum + parseFloat(cat.totalRevenue), 0);
                        const totalCost = marginData.reduce((sum, cat) => sum + parseFloat(cat.totalCost), 0);
                        const overallMargin = totalRevenue > 0 ? (1 - (totalCost / totalRevenue)) * 100 : 0;
                        return overallMargin.toFixed(1);
                      })()}%
                    </p>
                    <p className="text-xs text-emerald-700">margem média</p>
                  </div>
                </div>
              </div>

              {/* Margem por Categoria */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Breakdown por Categoria</h3>
                {marginData.map((category) => (
                  <div key={category.categoryId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{category.categoryName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Faturamento: <span className="font-semibold text-emerald-600">R$ {formatCurrency(category.totalRevenue)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600">{category.marginPercent}%</p>
                      <p className="text-xs text-muted-foreground">margem</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Nenhuma venda no mês atual</p>
          )}
        </DialogContent>
      </Dialog>
      {/* Modal de Crédito Concedido */}
      <Dialog open={showCreditModal} onOpenChange={setShowCreditModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-cyan-500" />
              Crédito Concedido a Clientes
            </DialogTitle>
          </DialogHeader>
          {creditSummary ? (
            <div className="space-y-4">
              {/* Resumo Principal */}
              <div className="p-4 rounded-lg bg-cyan-50 border border-cyan-200">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-cyan-700">Limite Total</p>
                    <p className="text-lg font-bold text-cyan-900">R$ {formatCurrency(creditSummary.totalLimit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-cyan-700">Em Aberto</p>
                    <p className="text-lg font-bold text-red-600">R$ {formatCurrency(creditSummary.totalUsed)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-cyan-700">Disponível</p>
                    <p className="text-lg font-bold text-green-600">R$ {formatCurrency(creditSummary.totalAvailable)}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-3">
                  <div 
                    className={`h-2.5 rounded-full transition-all ${creditSummary.usagePercent > 80 ? 'bg-red-500' : creditSummary.usagePercent > 50 ? 'bg-amber-500' : 'bg-cyan-500'}`}
                    style={{ width: `${Math.min(creditSummary.usagePercent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-cyan-700 text-center mt-1">
                  {creditSummary.usagePercent.toFixed(1)}% do limite utilizado • {creditSummary.activeCustomers} cliente(s) com limite ativo
                </p>
              </div>

              {/* Top Clientes com Saldo */}
              {creditSummary.topCustomers.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Maiores Saldos em Aberto</h3>
                  {creditSummary.topCustomers.map((customer) => {
                    const limit = parseFloat(customer.creditLimit || '0');
                    const balance = parseFloat(customer.currentBalance || '0');
                    const usage = limit > 0 ? (balance / limit) * 100 : 0;
                    return (
                      <div key={customer.id} className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm">{customer.name}</p>
                          <p className="font-bold text-sm text-red-600">R$ {formatCurrency(balance)}</p>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Limite: R$ {formatCurrency(limit)}</span>
                          <span>{usage.toFixed(0)}% utilizado</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                          <div 
                            className={`h-1 rounded-full ${usage > 80 ? 'bg-red-400' : usage > 50 ? 'bg-amber-400' : 'bg-cyan-400'}`}
                            style={{ width: `${Math.min(usage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Link para Contas a Receber */}
              <Link href="/contas-receber">
                <Button variant="default" className="w-full" onClick={() => setShowCreditModal(false)}>
                  Ver Contas a Receber Detalhado →
                </Button>
              </Link>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Nenhum cliente com crédito configurado</p>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ==================== Painel de Presença dos Garçons ====================

function WaiterPresencePanel() {
  const { activeCompanyId } = useCompany();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.salon.waiterPresence.useQuery(undefined, {
    refetchInterval: 60000, // atualiza a cada 60s
  });

  const checkInMutation = trpc.salon.waiterCheckIn.useMutation({
    onSuccess: () => {
      toast.success('Garçom liberado!');
      utils.salon.waiterPresence.invalidate();
      utils.salon.listWaiters.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const checkOutMutation = trpc.salon.waiterCheckOut.useMutation({
    onSuccess: () => {
      toast.success('Check-out realizado');
      utils.salon.waiterPresence.invalidate();
      utils.salon.listWaiters.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCheckIn = useCallback((userId: string) => {
    if (!activeCompanyId) return;
    checkInMutation.mutate({ companyId: activeCompanyId, waiterId: userId });
  }, [activeCompanyId, checkInMutation]);

  const handleCheckOut = useCallback((userId: string) => {
    if (!activeCompanyId) return;
    checkOutMutation.mutate({ companyId: activeCompanyId, waiterId: userId });
  }, [activeCompanyId, checkOutMutation]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Carregando presença dos garçons...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.waiters.length === 0) {
    return null; // Não exibir se não há garçons cadastrados
  }

  const activeCount = data.waiters.filter(w => w.status === 'active').length;
  const totalCount = data.waiters.length;

  const formatTime = (dateVal: string | Date | null) => {
    if (!dateVal) return '--:--';
    const d = new Date(dateVal);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const statusConfig = {
    active: { label: 'Ativo', color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', icon: UserCheck },
    checked_out: { label: 'Saiu', color: 'bg-gray-400', textColor: 'text-gray-600', bgColor: 'bg-gray-50', icon: LogOut },
    absent: { label: 'Ausente', color: 'bg-red-400', textColor: 'text-red-600', bgColor: 'bg-red-50', icon: UserX },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-lg">Presença dos Garçons</CardTitle>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="font-medium">{activeCount}</span>
              <span className="text-muted-foreground">ativos</span>
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{totalCount} total</span>
            {data.config?.openingTime && data.config?.closingTime && (
              <span className="text-xs text-muted-foreground border rounded px-2 py-0.5">
                {data.config.openingTime} - {data.config.closingTime}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.waiters.map((waiter) => {
            const cfg = statusConfig[waiter.status];
            const StatusIcon = cfg.icon;
            return (
              <div
                key={waiter.userId}
                className={`flex items-center gap-3 p-3 rounded-lg border ${cfg.bgColor} transition-all`}
              >
                {/* Status indicator */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full ${cfg.bgColor} border-2 ${waiter.status === 'active' ? 'border-green-400' : waiter.status === 'checked_out' ? 'border-gray-300' : 'border-red-300'} flex items-center justify-center`}>
                  <StatusIcon className={`h-5 w-5 ${cfg.textColor}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{waiter.name}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      waiter.status === 'active' ? 'bg-green-200 text-green-800' :
                      waiter.status === 'checked_out' ? 'bg-gray-200 text-gray-700' :
                      'bg-red-200 text-red-800'
                    }`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {waiter.checkedInAt && (
                      <span className="flex items-center gap-1">
                        <LogIn className="h-3 w-3" />
                        {formatTime(waiter.checkedInAt)}
                      </span>
                    )}
                    {waiter.checkedOutAt && (
                      <span className="flex items-center gap-1">
                        <LogOut className="h-3 w-3" />
                        {formatTime(waiter.checkedOutAt)}
                      </span>
                    )}
                    {waiter.status === 'absent' && (
                      <span className="italic">Sem check-in hoje</span>
                    )}
                  </div>
                </div>

                {/* Actions + Stats */}
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  {waiter.status === 'absent' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 border-green-300 text-green-700 hover:bg-green-50"
                      onClick={() => handleCheckIn(waiter.userId)}
                      disabled={checkInMutation.isPending}
                    >
                      <LogIn className="h-3 w-3 mr-1" />
                      Liberar
                    </Button>
                  )}
                  {waiter.status === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => handleCheckOut(waiter.userId)}
                      disabled={checkOutMutation.isPending}
                    >
                      <LogOut className="h-3 w-3 mr-1" />
                      Check-out
                    </Button>
                  )}
                  {waiter.todayOrders > 0 && (
                    <div className="text-right">
                      <span className="text-xs font-semibold">{waiter.todayOrders} ped.</span>
                      <span className="text-xs font-medium text-green-700 ml-1">
                        R$ {formatCurrency(waiter.todayRevenue)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
