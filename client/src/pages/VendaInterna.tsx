import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeftRight, Plus, Eye, Check, X, Trash2, Search, Link2, AlertTriangle, DollarSign, TrendingUp, Clock, Receipt } from "lucide-react";

interface CartItem {
  sourceProductId: number;
  productName: string;
  quantity: number;
  unitCost: number;
  unitSalePrice: number;
  currentStock: number;
  uom: string;
}

interface MappingEntry {
  sourceProductId: number;
  productName: string;
  targetProductId: number | null;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function VendaInterna() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const activeCompanyId = (user as any)?.activeCompanyId || 1;

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState("vendas");

  // Create form state
  const [targetCompanyId, setTargetCompanyId] = useState<number | null>(null);
  const [marginPercent, setMarginPercent] = useState(15);
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Reject dialog
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectSaleId, setRejectSaleId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // De/Para state
  const [mappingSourceCompany, setMappingSourceCompany] = useState<number | null>(null);
  const [mappingTargetCompany, setMappingTargetCompany] = useState<number | null>(null);
  const [mappingEntries, setMappingEntries] = useState<MappingEntry[]>([]);
  const [targetProductSearch, setTargetProductSearch] = useState("");
  const [editingMappingIdx, setEditingMappingIdx] = useState<number | null>(null);

  // Queries
  const { data: dashboardStats } = trpc.internalSales.dashboardStats.useQuery(
    { companyId: activeCompanyId },
    { enabled: !!activeCompanyId }
  );

  const { data: salesList, isLoading } = trpc.internalSales.list.useQuery(
    { companyId: activeCompanyId, status: statusFilter as any },
    { enabled: !!activeCompanyId }
  );

  const { data: targetCompanies } = trpc.internalSales.getTargetCompanies.useQuery(
    { sourceCompanyId: activeCompanyId },
    { enabled: !!activeCompanyId }
  );

  const { data: companyProducts } = trpc.internalSales.getCompanyProducts.useQuery(
    { companyId: activeCompanyId, search: productSearch },
    { enabled: !!activeCompanyId && showCreateDialog }
  );

  const { data: saleDetail } = trpc.internalSales.getById.useQuery(
    { id: selectedSaleId! },
    { enabled: !!selectedSaleId && showDetailDialog }
  );

  const { data: mappingCheck } = trpc.internalSales.checkMapping.useQuery(
    { id: selectedSaleId! },
    { enabled: !!selectedSaleId && showDetailDialog }
  );

  const { data: existingMappings, refetch: refetchMappings } = trpc.internalSales.mappingList.useQuery(
    { sourceCompanyId: mappingSourceCompany!, targetCompanyId: mappingTargetCompany! },
    { enabled: !!mappingSourceCompany && !!mappingTargetCompany && activeTab === "depara" }
  );

  const { data: targetProducts } = trpc.internalSales.getCompanyProducts.useQuery(
    { companyId: mappingTargetCompany || (saleDetail?.targetCompanyId ?? 0), search: targetProductSearch },
    { enabled: (!!mappingTargetCompany || !!saleDetail?.targetCompanyId) && (showMappingDialog || activeTab === "depara") }
  );

  const { data: sourceProductsForMapping } = trpc.internalSales.getCompanyProducts.useQuery(
    { companyId: mappingSourceCompany || 0, search: "" },
    { enabled: !!mappingSourceCompany && activeTab === "depara" }
  );

  // Mutations
  const createMutation = trpc.internalSales.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Venda interna ${data.docNumber} criada! Aguardando aprovação.`);
      setShowCreateDialog(false);
      resetCreateForm();
      utils.internalSales.list.invalidate();
      utils.internalSales.dashboardStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMutation = trpc.internalSales.approve.useMutation({
    onSuccess: () => {
      toast.success("Venda interna aprovada! Estoque e financeiro atualizados.");
      utils.internalSales.list.invalidate();
      utils.internalSales.checkMapping.invalidate();
      utils.internalSales.dashboardStats.invalidate();
      setShowDetailDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.internalSales.reject.useMutation({
    onSuccess: () => {
      toast.success("Venda interna rejeitada.");
      setShowRejectDialog(false);
      setRejectReason("");
      utils.internalSales.list.invalidate();
      utils.internalSales.dashboardStats.invalidate();
      setShowDetailDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelMutation = trpc.internalSales.cancel.useMutation({
    onSuccess: () => {
      toast.success("Venda interna cancelada.");
      utils.internalSales.list.invalidate();
      utils.internalSales.dashboardStats.invalidate();
      setShowDetailDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkMappingMutation = trpc.internalSales.mappingBulkCreate.useMutation({
    onSuccess: (data) => {
      toast.success(`De/Para salvo! ${data.created} criado(s), ${data.updated} atualizado(s).`);
      setShowMappingDialog(false);
      setMappingEntries([]);
      utils.internalSales.checkMapping.invalidate();
      utils.internalSales.mappingList.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const mappingCreateMutation = trpc.internalSales.mappingCreate.useMutation({
    onSuccess: () => {
      toast.success("Mapeamento salvo!");
      utils.internalSales.mappingList.invalidate();
      refetchMappings();
    },
    onError: (err) => toast.error(err.message),
  });

  const mappingDeleteMutation = trpc.internalSales.mappingDelete.useMutation({
    onSuccess: () => {
      toast.success("Mapeamento removido!");
      utils.internalSales.mappingList.invalidate();
      refetchMappings();
    },
    onError: (err) => toast.error(err.message),
  });

  function resetCreateForm() {
    setTargetCompanyId(null);
    setMarginPercent(15);
    setNotes("");
    setCart([]);
    setProductSearch("");
  }

  function addToCart(product: { id: number; name: string; currentStock: number | null; avgCost: string | null; uom: string }) {
    if (cart.find(c => c.sourceProductId === product.id)) {
      toast.error("Produto já adicionado");
      return;
    }
    const cost = parseFloat(product.avgCost || "0");
    const salePrice = cost * (1 + marginPercent / 100);
    setCart([...cart, {
      sourceProductId: product.id,
      productName: product.name,
      quantity: 1,
      unitCost: cost,
      unitSalePrice: parseFloat(salePrice.toFixed(4)),
      currentStock: product.currentStock || 0,
      uom: product.uom,
    }]);
  }

  function updateCartItem(index: number, field: "quantity" | "unitCost" | "unitSalePrice", value: number) {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], [field]: value };
    setCart(newCart);
  }

  function removeFromCart(index: number) {
    setCart(cart.filter((_, i) => i !== index));
  }

  // Recalculate sale prices when margin changes
  function applyMarginToCart() {
    setCart(cart.map(item => ({
      ...item,
      unitSalePrice: parseFloat((item.unitCost * (1 + marginPercent / 100)).toFixed(4)),
    })));
  }

  function handleCreate() {
    if (!targetCompanyId) {
      toast.error("Selecione a empresa de destino");
      return;
    }
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }
    createMutation.mutate({
      sourceCompanyId: activeCompanyId,
      targetCompanyId,
      marginPercent,
      notes: notes || undefined,
      items: cart.map(item => ({
        sourceProductId: item.sourceProductId,
        productName: item.productName,
        quantity: item.quantity,
        unitCost: item.unitCost,
        unitSalePrice: item.unitSalePrice,
      })),
    });
  }

  function openMappingForSale() {
    if (!saleDetail) return;
    const unmapped = mappingCheck?.unmapped || [];
    setMappingEntries(unmapped.map(u => ({
      sourceProductId: u.sourceProductId,
      productName: u.productName,
      targetProductId: null,
    })));
    setShowMappingDialog(true);
  }

  function handleSaveMappings() {
    if (!saleDetail) return;
    const validMappings = mappingEntries.filter(m => m.targetProductId !== null);
    if (validMappings.length === 0) {
      toast.error("Configure pelo menos um mapeamento");
      return;
    }
    bulkMappingMutation.mutate({
      sourceCompanyId: saleDetail.sourceCompanyId,
      targetCompanyId: saleDetail.targetCompanyId,
      mappings: validMappings.map(m => ({
        sourceProductId: m.sourceProductId,
        targetProductId: m.targetProductId!,
      })),
    });
  }

  function handleApprove() {
    if (!saleDetail) return;
    if (mappingCheck && !mappingCheck.allMapped) {
      toast.error("Configure o De/Para de todos os produtos antes de aprovar.");
      return;
    }
    approveMutation.mutate({ id: saleDetail.id });
  }

  const cartTotalCost = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unitCost, 0), [cart]);
  const cartTotalSale = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unitSalePrice, 0), [cart]);

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    CANCELLED: "bg-gray-100 text-gray-800",
  };

  const statusLabels: Record<string, string> = {
    PENDING: "Pendente",
    APPROVED: "Aprovada",
    REJECTED: "Rejeitada",
    CANCELLED: "Cancelada",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6" />
              Venda Interna
            </h1>
            <p className="text-muted-foreground">Transferências de produtos entre empresas do grupo</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Venda Interna
          </Button>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vendido no Mês</p>
                  <p className="text-xl font-bold text-green-700">
                    {formatCurrency(dashboardStats?.totalSoldThisMonth || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo a Receber</p>
                  <p className="text-xl font-bold text-blue-700">
                    {formatCurrency(dashboardStats?.totalReceivable || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Receipt className="h-5 w-5 text-orange-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo a Pagar</p>
                  <p className="text-xl font-bold text-orange-700">
                    {formatCurrency(dashboardStats?.totalPayable || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-xl font-bold text-yellow-700">
                    {dashboardStats?.pendingCount || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="vendas">Vendas Internas</TabsTrigger>
            <TabsTrigger value="depara">
              <Link2 className="h-4 w-4 mr-1" />
              De/Para Produtos
            </TabsTrigger>
          </TabsList>

          {/* Vendas Tab */}
          <TabsContent value="vendas" className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4 items-center">
              <Label>Status:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendentes</SelectItem>
                  <SelectItem value="APPROVED">Aprovadas</SelectItem>
                  <SelectItem value="REJECTED">Rejeitadas</SelectItem>
                  <SelectItem value="CANCELLED">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* List */}
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Vendas Internas</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : !salesList || salesList.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhuma venda interna registrada</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="p-2">Doc</th>
                          <th className="p-2">Data</th>
                          <th className="p-2">Direção</th>
                          <th className="p-2">Origem</th>
                          <th className="p-2">Destino</th>
                          <th className="p-2 text-right">Valor</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Vencimento</th>
                          <th className="p-2">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesList.map((sale) => (
                          <tr key={sale.id} className="border-b hover:bg-muted/50">
                            <td className="p-2 font-mono text-xs">{sale.docNumber || `#${sale.id}`}</td>
                            <td className="p-2">
                              {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString("pt-BR") : "-"}
                            </td>
                            <td className="p-2">
                              <Badge variant="outline" className={sale.direction === "SENT" ? "border-orange-300 text-orange-700" : "border-blue-300 text-blue-700"}>
                                {sale.direction === "SENT" ? "Enviada" : "Recebida"}
                              </Badge>
                            </td>
                            <td className="p-2">{sale.sourceCompanyName}</td>
                            <td className="p-2">{sale.targetCompanyName}</td>
                            <td className="p-2 text-right font-medium">
                              {formatCurrency(parseFloat(sale.totalAmount?.toString() || "0"))}
                            </td>
                            <td className="p-2">
                              <Badge className={statusColors[sale.status] || ""}>
                                {statusLabels[sale.status] || sale.status}
                              </Badge>
                            </td>
                            <td className="p-2 text-xs">
                              {sale.dueDate ? new Date(sale.dueDate).toLocaleDateString("pt-BR") : "-"}
                            </td>
                            <td className="p-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSelectedSaleId(sale.id); setShowDetailDialog(true); }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* De/Para Tab */}
          <TabsContent value="depara" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  De/Para de Produtos
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure o mapeamento entre produtos de empresas diferentes para entrada automática no estoque
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Company Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Empresa Origem (De)</Label>
                    <Select
                      value={mappingSourceCompany?.toString() || ""}
                      onValueChange={(v) => { setMappingSourceCompany(Number(v)); }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {targetCompanies?.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.tradeName || c.name}
                          </SelectItem>
                        ))}
                        <SelectItem value={activeCompanyId.toString()}>
                          Empresa Atual
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Empresa Destino (Para)</Label>
                    <Select
                      value={mappingTargetCompany?.toString() || ""}
                      onValueChange={(v) => { setMappingTargetCompany(Number(v)); }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {targetCompanies?.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.tradeName || c.name}
                          </SelectItem>
                        ))}
                        <SelectItem value={activeCompanyId.toString()}>
                          Empresa Atual
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Existing Mappings */}
                {mappingSourceCompany && mappingTargetCompany && (
                  <div>
                    {existingMappings && existingMappings.length > 0 ? (
                      <div className="border rounded-md">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="p-2 text-left">Produto Origem (De)</th>
                              <th className="p-2 text-center">→</th>
                              <th className="p-2 text-left">Produto Destino (Para)</th>
                              <th className="p-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {existingMappings.map((m) => (
                              <tr key={m.id} className="border-b hover:bg-muted/50">
                                <td className="p-2">{m.sourceProductName}</td>
                                <td className="p-2 text-center text-muted-foreground">→</td>
                                <td className="p-2">{m.targetProductName}</td>
                                <td className="p-2 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => mappingDeleteMutation.mutate({ id: m.id })}
                                    disabled={mappingDeleteMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">Nenhum mapeamento configurado para este par de empresas</p>
                    )}

                    {/* Add new mapping inline */}
                    <div className="mt-4 p-4 border rounded-md bg-muted/30">
                      <Label className="font-medium">Adicionar Novo Mapeamento</Label>
                      <div className="grid grid-cols-5 gap-2 mt-2 items-end">
                        <div className="col-span-2">
                          <Label className="text-xs">Produto Origem</Label>
                          <Select
                            onValueChange={(v) => {
                              const prod = sourceProductsForMapping?.find(p => p.id === Number(v));
                              if (prod) {
                                setMappingEntries([{ sourceProductId: prod.id, productName: prod.name, targetProductId: null }]);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione produto origem..." />
                            </SelectTrigger>
                            <SelectContent>
                              {sourceProductsForMapping?.map((p) => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-center self-center text-muted-foreground">→</div>
                        <div className="col-span-2">
                          <Label className="text-xs">Produto Destino</Label>
                          <Select
                            onValueChange={(v) => {
                              if (mappingEntries.length > 0 && mappingEntries[0].sourceProductId) {
                                mappingCreateMutation.mutate({
                                  sourceCompanyId: mappingSourceCompany!,
                                  targetCompanyId: mappingTargetCompany!,
                                  sourceProductId: mappingEntries[0].sourceProductId,
                                  targetProductId: Number(v),
                                });
                                setMappingEntries([]);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione produto destino..." />
                            </SelectTrigger>
                            <SelectContent>
                              {targetProducts?.map((p) => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Venda Interna</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Target Company + Margin */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Empresa de Destino</Label>
                  <Select value={targetCompanyId?.toString() || ""} onValueChange={(v) => setTargetCompanyId(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {targetCompanies?.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.tradeName || c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Margem (%)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={marginPercent}
                      onChange={(e) => setMarginPercent(parseFloat(e.target.value) || 0)}
                      className="w-24"
                    />
                    <Button variant="outline" size="sm" onClick={applyMarginToCart} disabled={cart.length === 0}>
                      Aplicar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Preço de venda = Custo + {marginPercent}%
                  </p>
                </div>
              </div>

              {/* Product Search */}
              <div>
                <Label>Adicionar Produtos</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto por nome ou EAN..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {productSearch && companyProducts && companyProducts.length > 0 && (
                  <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                    {companyProducts.slice(0, 10).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer"
                        onClick={() => { addToCart(p); setProductSearch(""); }}
                      >
                        <span className="text-sm">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          Est: {p.currentStock || 0} {p.uom} | Custo: R$ {parseFloat(p.avgCost || "0").toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart */}
              {cart.length > 0 && (
                <div>
                  <Label>Itens da Transferência</Label>
                  <div className="border rounded-md mt-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-2 text-left">Produto</th>
                          <th className="p-2 text-center">Qtd</th>
                          <th className="p-2 text-center">Custo Unit.</th>
                          <th className="p-2 text-center">Preço Venda</th>
                          <th className="p-2 text-right">Total Venda</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((item, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="p-2">
                              <div>{item.productName}</div>
                              <div className="text-xs text-muted-foreground">Est: {item.currentStock} {item.uom}</div>
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min={0.001}
                                step={1}
                                value={item.quantity}
                                onChange={(e) => updateCartItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                                className="w-20 text-center mx-auto"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={item.unitCost}
                                onChange={(e) => updateCartItem(idx, "unitCost", parseFloat(e.target.value) || 0)}
                                className="w-24 text-center mx-auto"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={item.unitSalePrice}
                                onChange={(e) => updateCartItem(idx, "unitSalePrice", parseFloat(e.target.value) || 0)}
                                className="w-24 text-center mx-auto"
                              />
                            </td>
                            <td className="p-2 text-right font-medium">
                              {formatCurrency(item.quantity * item.unitSalePrice)}
                            </td>
                            <td className="p-2 text-center">
                              <Button variant="ghost" size="sm" onClick={() => removeFromCart(idx)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/50">
                          <td colSpan={4} className="p-2 text-right text-muted-foreground">Total Custo:</td>
                          <td className="p-2 text-right text-muted-foreground">{formatCurrency(cartTotalCost)}</td>
                          <td></td>
                        </tr>
                        <tr className="bg-muted/50 font-bold">
                          <td colSpan={4} className="p-2 text-right">Total Venda:</td>
                          <td className="p-2 text-right">{formatCurrency(cartTotalSale)}</td>
                          <td></td>
                        </tr>
                        <tr className="bg-green-50">
                          <td colSpan={4} className="p-2 text-right text-green-700 font-medium">Margem:</td>
                          <td className="p-2 text-right text-green-700 font-medium">
                            {formatCurrency(cartTotalSale - cartTotalCost)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações sobre a transferência..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetCreateForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Criando..." : "Criar Venda Interna"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Venda Interna {saleDetail?.docNumber || `#${saleDetail?.id}`}
              </DialogTitle>
            </DialogHeader>

            {saleDetail && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Origem</Label>
                    <p className="font-medium">{saleDetail.sourceCompanyName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Destino</Label>
                    <p className="font-medium">{saleDetail.targetCompanyName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Data Criação</Label>
                    <p>{saleDetail.createdAt ? new Date(saleDetail.createdAt).toLocaleString("pt-BR") : "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={statusColors[saleDetail.status] || ""}>
                      {statusLabels[saleDetail.status] || saleDetail.status}
                    </Badge>
                  </div>
                  {saleDetail.confirmedAt && (
                    <div>
                      <Label className="text-muted-foreground">Confirmada em</Label>
                      <p>{new Date(saleDetail.confirmedAt).toLocaleString("pt-BR")}</p>
                    </div>
                  )}
                  {saleDetail.dueDate && (
                    <div>
                      <Label className="text-muted-foreground">Vencimento</Label>
                      <p className="font-medium">{new Date(saleDetail.dueDate).toLocaleDateString("pt-BR")}</p>
                    </div>
                  )}
                  {saleDetail.marginPercent && (
                    <div>
                      <Label className="text-muted-foreground">Margem</Label>
                      <p>{parseFloat(saleDetail.marginPercent.toString())}%</p>
                    </div>
                  )}
                  {saleDetail.notes && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">Observações</Label>
                      <p>{saleDetail.notes}</p>
                    </div>
                  )}
                  {saleDetail.rejectionReason && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-red-600">Motivo da Rejeição</Label>
                      <p className="text-red-700">{saleDetail.rejectionReason}</p>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div>
                  <Label>Itens</Label>
                  <table className="w-full text-sm mt-2 border rounded-md">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">Produto (Origem)</th>
                        <th className="p-2 text-left">Produto (Destino)</th>
                        <th className="p-2 text-center">Qtd</th>
                        <th className="p-2 text-right">Custo</th>
                        <th className="p-2 text-right">Preço Venda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saleDetail.items.map((item) => {
                        const mappedTarget = mappingCheck?.mapped.find(m => m.sourceProductId === item.sourceProductId);
                        const isUnmapped = mappingCheck?.unmapped.find(u => u.sourceProductId === item.sourceProductId);
                        return (
                          <tr key={item.id} className="border-b">
                            <td className="p-2">{item.productName}</td>
                            <td className="p-2">
                              {item.targetProductId ? (
                                <span className="text-green-700">{mappedTarget?.targetProductName || `#${item.targetProductId}`}</span>
                              ) : mappedTarget ? (
                                <span className="text-green-700">{mappedTarget.targetProductName}</span>
                              ) : isUnmapped ? (
                                <span className="text-yellow-700 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Não mapeado
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-2 text-center">{parseFloat(item.quantity?.toString() || "0")}</td>
                            <td className="p-2 text-right">{formatCurrency(parseFloat(item.unitCost?.toString() || "0"))}</td>
                            <td className="p-2 text-right font-medium">
                              {item.unitSalePrice
                                ? formatCurrency(parseFloat(item.unitSalePrice.toString()))
                                : formatCurrency(parseFloat(item.unitCost?.toString() || "0"))
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 font-bold">
                        <td colSpan={4} className="p-2 text-right">Total:</td>
                        <td className="p-2 text-right">{formatCurrency(parseFloat(saleDetail.totalAmount?.toString() || "0"))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mapping Warning */}
                {saleDetail.status === "PENDING" && mappingCheck && !mappingCheck.allMapped && (
                  <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800">
                        {mappingCheck.unmapped.length} produto(s) sem De/Para configurado
                      </p>
                      <p className="text-xs text-yellow-700">
                        Configure o mapeamento antes de aprovar para que a entrada no estoque seja feita corretamente.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={openMappingForSale}>
                      <Link2 className="h-4 w-4 mr-1" />
                      Configurar De/Para
                    </Button>
                  </div>
                )}

                {saleDetail.status === "PENDING" && mappingCheck?.allMapped && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <Check className="h-5 w-5 text-green-600 shrink-0" />
                    <p className="text-sm text-green-800">
                      Todos os produtos estão mapeados. Pronto para aprovar.
                    </p>
                  </div>
                )}

                {/* Actions */}
                {saleDetail.status === "PENDING" && user?.role === "admin" && (
                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button
                      variant="destructive"
                      onClick={() => { setRejectSaleId(saleDetail.id); setShowRejectDialog(true); }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Rejeitar
                    </Button>
                    <Button
                      onClick={handleApprove}
                      disabled={approveMutation.isPending || (mappingCheck && !mappingCheck.allMapped)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {approveMutation.isPending ? "Aprovando..." : "Aprovar"}
                    </Button>
                  </div>
                )}

                {saleDetail.status === "PENDING" && (
                  <div className="flex justify-start pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelMutation.mutate({ id: saleDetail.id })}
                      disabled={cancelMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Cancelar Venda
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Mapping Dialog (for pending sale approval) */}
        <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Configurar De/Para
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Vincule cada produto da empresa de origem ao produto correspondente na empresa de destino
              </p>
            </DialogHeader>

            <div className="space-y-3">
              {mappingEntries.map((entry, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-2 items-center p-3 border rounded-md">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Produto Origem</Label>
                    <p className="font-medium text-sm">{entry.productName}</p>
                  </div>
                  <div className="text-center text-muted-foreground">→</div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Produto Destino</Label>
                    {editingMappingIdx === idx ? (
                      <div>
                        <Input
                          placeholder="Buscar produto destino..."
                          value={targetProductSearch}
                          onChange={(e) => setTargetProductSearch(e.target.value)}
                          className="text-sm"
                          autoFocus
                        />
                        {targetProducts && targetProducts.length > 0 && (
                          <div className="mt-1 border rounded-md max-h-32 overflow-y-auto">
                            {targetProducts.slice(0, 8).map((p) => (
                              <div
                                key={p.id}
                                className="p-2 hover:bg-muted/50 cursor-pointer text-sm"
                                onClick={() => {
                                  const newEntries = [...mappingEntries];
                                  newEntries[idx] = { ...newEntries[idx], targetProductId: p.id };
                                  setMappingEntries(newEntries);
                                  setEditingMappingIdx(null);
                                  setTargetProductSearch("");
                                }}
                              >
                                {p.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer p-2 border rounded hover:bg-muted/50 text-sm"
                        onClick={() => { setEditingMappingIdx(idx); setTargetProductSearch(""); }}
                      >
                        {entry.targetProductId ? (
                          <span className="text-green-700">
                            {targetProducts?.find(p => p.id === entry.targetProductId)?.name || `Produto #${entry.targetProductId}`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Clique para selecionar...</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMappingDialog(false)}>Cancelar</Button>
              <Button
                onClick={handleSaveMappings}
                disabled={bulkMappingMutation.isPending || mappingEntries.every(m => !m.targetProductId)}
              >
                {bulkMappingMutation.isPending ? "Salvando..." : "Salvar De/Para"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar Venda Interna</DialogTitle>
            </DialogHeader>
            <div>
              <Label>Motivo da Rejeição</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Informe o motivo..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (rejectSaleId) rejectMutation.mutate({ id: rejectSaleId, reason: rejectReason });
                }}
                disabled={!rejectReason || rejectMutation.isPending}
              >
                Confirmar Rejeição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
