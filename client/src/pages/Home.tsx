import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, AlertTriangle, ShoppingCart, DollarSign, Calendar, Package, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { SaleDetailsModal } from "@/components/SaleDetailsModal";
import { CompactSalesCalendar } from "@/components/CompactSalesCalendar";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: purchaseStats, isLoading: isPurchaseLoading } = trpc.dashboard.purchaseStats.useQuery();
  const { data: marginData, isLoading: isMarginLoading } = trpc.dashboard.grossMarginByCategory.useQuery();
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [showExpiringModal, setShowExpiringModal] = useState(false);
  const [showStockValueModal, setShowStockValueModal] = useState(false);
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
                R$ {formatCurrency(stats?.monthRevenue)}
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Balcão</span>
                  <span className="font-medium text-blue-600">
                    R$ {formatCurrency(stats?.monthRevenueBalcao)}
                    <span className="text-muted-foreground ml-1">
                      ({stats ? Math.round((parseFloat(stats.monthRevenueBalcao) / parseFloat(stats.monthRevenue)) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium text-blue-600">
                    R$ {formatCurrency(stats?.monthRevenueDelivery)}
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
                R$ {formatCurrency(stats?.totalPendingReceivables)}
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

          {isAdmin && (
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
        </div>

        {/* Card de Margem Bruta por Categoria - Apenas para Admin */}
        {isAdmin && (
          <Card className="border-t-4 border-t-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg font-semibold">
                Mg Bruta por Categoria
              </CardTitle>
              <TrendingDown className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {isMarginLoading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : marginData && marginData.length > 0 ? (
                <>
                  {/* Margem Geral */}
                  <div className="mb-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
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
                        <p className="text-3xl font-bold text-emerald-600">
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
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma venda no mês atual</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Calendário Compacto de Vendas */}
        <Card>
          <CardContent className="pt-6">
            <CompactSalesCalendar />
          </CardContent>
        </Card>

        {/* Vendas Recentes - largura completa */}
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
                      onClick={() => handleSaleClick(sale.id)}
                      className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0 cursor-pointer hover:bg-muted/50 transition-colors rounded-lg p-2 -m-2"
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
                              {((parseFloat(category.value) / parseFloat(stats.totalStockValue)) * 100).toFixed(1)}% do total • {category.products?.length || 0} produtos
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
                        {new Date(product.expirationDate).toLocaleDateString('pt-BR')}
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
    </DashboardLayout>
  );
}
