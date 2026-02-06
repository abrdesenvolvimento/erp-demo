import { useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Upload, FileJson, ArrowRight, CheckCircle2, AlertCircle, AlertTriangle, Search, Edit2, Trash2, Package, History, Loader2 } from "lucide-react";

interface ProcessedOrder {
  ifoodOrderId: string;
  ifoodOrderCode: string;
  orderDate: string;
  totalValue: number;
  items: ProcessedItem[];
  status: "ready" | "missing_product" | "price_divergence";
  issues: string[];
}

interface ProcessedItem {
  ifoodSku: string;
  ifoodProductName: string;
  quantity: number;
  ifoodPrice: number;
  productId: number | null;
  productName: string | null;
  abrwfPrice: number | null;
  hasPriceDivergence: boolean;
  divergencePercent: number | null;
  isMapped: boolean;
}

interface PreviewData {
  summary: {
    totalOrders: number;
    readyCount: number;
    missingProductCount: number;
    priceDivergenceCount: number;
    skippedCount: number;
    totalValue: number;
  };
  orders: ProcessedOrder[];
}

export default function ImportadorIfood() {
  const [activeTab, setActiveTab] = useState("upload");
  const [ordersFile, setOrdersFile] = useState<File | null>(null);
  const [itemsFile, setItemsFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  // De/Para state
  const [searchMapping, setSearchMapping] = useState("");
  const [editingMapping, setEditingMapping] = useState<any>(null);
  const [productSearch, setProductSearch] = useState("");
  
  // Divergência de valor state
  const [divergenceModal, setDivergenceModal] = useState<{
    order: ProcessedOrder;
    items: ProcessedItem[];
  } | null>(null);
  const [updatingPrice, setUpdatingPrice] = useState(false);
  
  // Queries
  const mappingsQuery = trpc.ifoodImport.listMappings.useQuery({ search: searchMapping, limit: 100 });
  const historyQuery = trpc.ifoodImport.listImportHistory.useQuery({ limit: 20 });
  const searchProductsQuery = trpc.ifoodImport.searchProducts.useQuery(
    { search: productSearch },
    { enabled: productSearch.length >= 2 }
  );
  
  // Mutations
  const processFilesMutation = trpc.ifoodImport.processFiles.useMutation();
  const importOrdersMutation = trpc.ifoodImport.importOrders.useMutation();
  const updateMappingMutation = trpc.ifoodImport.updateMapping.useMutation();
  const updateChannelPriceMutation = trpc.ifoodImport.updateChannelPrice.useMutation();
  
  const utils = trpc.useUtils();

  // Handlers
  const handleFileChange = (type: "orders" | "items") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === "orders") {
        setOrdersFile(file);
      } else {
        setItemsFile(file);
      }
    }
  };

  const handleProcessFiles = async () => {
    if (!ordersFile || !itemsFile) {
      toast.error("Selecione os dois arquivos JSON");
      return;
    }

    setIsProcessing(true);
    try {
      const ordersJson = await ordersFile.text();
      const itemsJson = await itemsFile.text();

      const result = await processFilesMutation.mutateAsync({
        ordersJson,
        itemsJson,
      });

      setPreviewData(result);
      // Selecionar automaticamente pedidos prontos e com divergência de preço
      const autoSelect = new Set(
        result.orders
          .filter((o) => o.status === "ready" || o.status === "price_divergence")
          .map((o) => o.ifoodOrderId)
      );
      setSelectedOrders(autoSelect);
      setActiveTab("preview");
      toast.success(`${result.summary.totalOrders} pedidos processados`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar arquivos");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportOrders = async () => {
    alert('handleImportOrders chamada! selectedOrders.size = ' + selectedOrders.size);
    console.log('[handleImportOrders] Called with selectedOrders:', selectedOrders.size);
    if (selectedOrders.size === 0) {
      console.log('[handleImportOrders] No orders selected');
      toast.error("Selecione pelo menos um pedido para importar");
      return;
    }

    // Verificar se há pedidos com produto não localizado selecionados
    const ordersWithMissingProducts = previewData?.orders.filter(
      (o) => selectedOrders.has(o.ifoodOrderId) && o.status === "missing_product"
    );
    
    if (ordersWithMissingProducts && ordersWithMissingProducts.length > 0) {
      toast.error("Remova os pedidos com produtos não localizados antes de importar");
      return;
    }

    setIsImporting(true);
    try {
      const ordersToImport = previewData?.orders.filter((o) => selectedOrders.has(o.ifoodOrderId)) || [];
      
      const result = await importOrdersMutation.mutateAsync({
        orders: ordersToImport,
      });

      toast.success(`${result.importedCount} pedidos importados com sucesso!`);
      
      // Limpar estado
      setPreviewData(null);
      setSelectedOrders(new Set());
      setOrdersFile(null);
      setItemsFile(null);
      setActiveTab("historico");
      
      // Atualizar histórico
      utils.ifoodImport.listImportHistory.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Erro ao importar pedidos");
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportSingleOrder = async (order: ProcessedOrder) => {
    setIsImporting(true);
    try {
      const result = await importOrdersMutation.mutateAsync({
        orders: [order],
      });
      toast.success(`${result.importedCount} pedido(s) importado(s) com sucesso!`);
      // Reprocessar arquivos para atualizar preview
      if (ordersFile && itemsFile) {
        await handleProcessFiles();
      }
      utils.ifoodImport.listImportHistory.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Erro ao importar pedido");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && previewData) {
      // Selecionar apenas pedidos que podem ser importados (ready ou price_divergence)
      const importable = previewData.orders
        .filter((o) => o.status !== "missing_product")
        .map((o) => o.ifoodOrderId);
      setSelectedOrders(new Set(importable));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSaveMapping = async (productId: number) => {
    if (!editingMapping) return;

    try {
      await updateMappingMutation.mutateAsync({
        ifoodSku: editingMapping.ifoodSku,
        ifoodProductName: editingMapping.ifoodProductName,
        productId,
        situation: "Vinculado Manualmente",
      });
      toast.success("Vínculo salvo com sucesso");
      setEditingMapping(null);
      setProductSearch("");
      utils.ifoodImport.listMappings.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar vínculo");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Pronto</Badge>;
      case "missing_product":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Produto não localizado</Badge>;
      case "price_divergence":
        return <Badge className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" /> Divergência de preço</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Importador iFood</h1>
          <p className="text-muted-foreground">Importe pedidos do iFood para o sistema de vendas</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2" disabled={!previewData}>
              <FileJson className="w-4 h-4" /> Preview
            </TabsTrigger>
            <TabsTrigger value="depara" className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4" /> De/Para
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="w-4 h-4" /> Histórico
            </TabsTrigger>
          </TabsList>

          {/* Tab Upload */}
          <TabsContent value="upload" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileJson className="w-5 h-5" /> Vendas e Pedidos
                  </CardTitle>
                  <CardDescription>Arquivo VendasePedidos.json do iFood</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Label htmlFor="orders-file" className="cursor-pointer">
                      <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${ordersFile ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-primary"}`}>
                        {ordersFile ? (
                          <>
                            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-2" />
                            <p className="font-medium">{ordersFile.name}</p>
                            <p className="text-sm text-muted-foreground">Clique para trocar</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                            <p className="font-medium">Clique para selecionar</p>
                            <p className="text-sm text-muted-foreground">ou arraste o arquivo aqui</p>
                          </>
                        )}
                      </div>
                    </Label>
                    <Input
                      id="orders-file"
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleFileChange("orders")}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" /> Itens por Pedido
                  </CardTitle>
                  <CardDescription>Arquivo Itensporpedido.json do iFood</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Label htmlFor="items-file" className="cursor-pointer">
                      <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${itemsFile ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-primary"}`}>
                        {itemsFile ? (
                          <>
                            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-2" />
                            <p className="font-medium">{itemsFile.name}</p>
                            <p className="text-sm text-muted-foreground">Clique para trocar</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                            <p className="font-medium">Clique para selecionar</p>
                            <p className="text-sm text-muted-foreground">ou arraste o arquivo aqui</p>
                          </>
                        )}
                      </div>
                    </Label>
                    <Input
                      id="items-file"
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleFileChange("items")}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={handleProcessFiles}
                disabled={!ordersFile || !itemsFile || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...
                  </>
                ) : (
                  <>
                    <FileJson className="w-4 h-4 mr-2" /> Processar Arquivos
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Tab Preview */}
          <TabsContent value="preview" className="space-y-4">
            {previewData && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{previewData.summary.totalOrders}</div>
                      <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                    </CardContent>
                  </Card>
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-green-600">{previewData.summary.readyCount}</div>
                      <p className="text-sm text-green-600">Prontos</p>
                    </CardContent>
                  </Card>
                  <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-yellow-600">{previewData.summary.priceDivergenceCount}</div>
                      <p className="text-sm text-yellow-600">Divergência Preço</p>
                    </CardContent>
                  </Card>
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-red-600">{previewData.summary.missingProductCount}</div>
                      <p className="text-sm text-red-600">Produto não localizado</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{formatCurrency(previewData.summary.totalValue)}</div>
                      <p className="text-sm text-muted-foreground">Valor Total</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Orders Table */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Pedidos para Importar</CardTitle>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {selectedOrders.size} selecionado(s)
                        </span>
                        <Button
                          variant="outline"
                          onClick={handleProcessFiles}
                          disabled={!ordersFile || !itemsFile || isProcessing}
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Atualizando...
                            </>
                          ) : (
                            "Atualizar Importação"
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            console.log('[Button Click] selectedOrders.size:', selectedOrders.size);
                            console.log('[Button Click] isImporting:', isImporting);
                            handleImportOrders();
                          }}
                          disabled={selectedOrders.size === 0 || isImporting}
                        >
                          {isImporting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Importar Selecionados
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedOrders.size > 0 && selectedOrders.size === previewData.orders.filter(o => o.status !== "missing_product").length}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Itens</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.orders.map((order) => (
                          <TableRow key={order.ifoodOrderId} className={order.status === "missing_product" || order.status === "cancelled" ? "opacity-50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedOrders.has(order.ifoodOrderId)}
                                onCheckedChange={(checked) => handleSelectOrder(order.ifoodOrderId, checked as boolean)}
                                disabled={order.status === "missing_product" || order.status === "cancelled"}
                              />
                            </TableCell>
                            <TableCell className="font-mono">#{order.ifoodOrderCode}</TableCell>
                            <TableCell>{formatDate(order.orderDate)}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="text-sm">
                                    <span className={!item.productId ? "text-red-500" : item.hasPriceDivergence ? "text-yellow-600" : ""}>
                                      {item.quantity}x {item.ifoodProductName}
                                      {item.hasPriceDivergence && item.divergencePercent && (
                                        <span className="ml-1 text-xs">
                                          ({item.divergencePercent > 0 ? "+" : ""}{item.divergencePercent.toFixed(1)}%)
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(order.totalValue)}</TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell className="text-right">
                              {order.status === "ready" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    toast.info(`Clique detectado! Pedido #${order.ifoodOrderCode}`);
                                    handleImportSingleOrder(order);
                                  }}
                                  disabled={isImporting}
                                >
                                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Importar"}
                                </Button>
                              )}
                              {order.status === "missing_product" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-300 hover:bg-red-50"
                                  onClick={() => {
                                    // Abrir modal de De/Para para o primeiro item não mapeado
                                    const unmappedItem = order.items.find(i => !i.isMapped);
                                    if (unmappedItem) {
                                      setEditingMapping({
                                        ifoodSku: unmappedItem.ifoodSku,
                                        ifoodProductName: unmappedItem.ifoodProductName,
                                      });
                                    }
                                  }}
                                >
                                  Verificar De/Para
                                </Button>
                              )}
                              {order.status === "price_divergence" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                                  onClick={() => {
                                    const divergentItems = order.items.filter(i => i.hasPriceDivergence);
                                    setDivergenceModal({ order, items: divergentItems });
                                  }}
                                >
                                  Verificar Valor
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Tab De/Para */}
          <TabsContent value="depara" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>De/Para de Produtos</CardTitle>
                    <CardDescription>Vincule produtos do iFood aos produtos do ABRWF</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produto..."
                      value={searchMapping}
                      onChange={(e) => setSearchMapping(e.target.value)}
                      className="w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU iFood</TableHead>
                      <TableHead>Produto iFood</TableHead>
                      <TableHead>Produto ABRWF</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappingsQuery.data?.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-mono text-sm">{mapping.ifoodSku}</TableCell>
                        <TableCell>{mapping.ifoodProductName}</TableCell>
                        <TableCell>
                          {mapping.productName ? (
                            <span className="text-green-600">{mapping.productName}</span>
                          ) : (
                            <span className="text-red-500">Não vinculado</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={mapping.productId ? "default" : "destructive"}>
                            {mapping.situation || "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingMapping(mapping);
                              setProductSearch("");
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Histórico */}
          <TabsContent value="historico" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Importações</CardTitle>
                <CardDescription>Últimas importações realizadas</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Pedidos Importados</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyQuery.data?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{formatDate(log.importedAt?.toString() || "")}</TableCell>
                        <TableCell>{log.importedOrders} pedidos</TableCell>
                        <TableCell>{formatCurrency(Number(log.totalValue || 0))}</TableCell>
                        <TableCell>
                          <Badge className={log.status === "SUCCESS" ? "bg-green-500" : "bg-red-500"}>
                            {log.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!historyQuery.data || historyQuery.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhuma importação realizada ainda
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal de Divergência de Valor */}
        <Dialog open={!!divergenceModal} onOpenChange={() => setDivergenceModal(null)}>
          <DialogContent className="max-w-4xl w-[95vw] z-50">
            <DialogHeader>
              <DialogTitle>Divergência de Valor - Pedido #{divergenceModal?.order.ifoodOrderCode}</DialogTitle>
              <DialogDescription>
                Os preços abaixo estão diferentes entre o iFood e o sistema ABRWF
              </DialogDescription>
            </DialogHeader>
            
            {divergenceModal && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Produto</TableHead>
                        <TableHead className="text-right min-w-[100px]">Preço iFood</TableHead>
                        <TableHead className="text-right min-w-[100px]">Preço ABRWF</TableHead>
                        <TableHead className="text-center min-w-[80px]">Diferença</TableHead>
                        <TableHead className="text-center min-w-[120px]">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {divergenceModal.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.ifoodProductName}</p>
                              <p className="text-sm text-muted-foreground">SKU: {item.ifoodSku}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(item.ifoodPrice)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.abrwfPrice ? formatCurrency(item.abrwfPrice) : 'N/A'}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.divergencePercent && (
                              <Badge className={item.divergencePercent > 0 ? "bg-red-500" : "bg-green-500"}>
                                {item.divergencePercent > 0 ? "+" : ""}{item.divergencePercent.toFixed(1)}%
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                          {item.productId && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updatingPrice}
                              onClick={async () => {
                                setUpdatingPrice(true);
                                try {
                                  await updateChannelPriceMutation.mutateAsync({
                                    productId: item.productId!,
                                    channelId: 2, // iFood
                                    newPrice: item.ifoodPrice,
                                  });
                                  toast.success(`Preço atualizado para ${formatCurrency(item.ifoodPrice)}`);
                                  // Reprocessar arquivos para atualizar preview
                                  if (ordersFile && itemsFile) {
                                    await handleProcessFiles();
                                  }
                                  setDivergenceModal(null);
                                } catch (error: any) {
                                  toast.error(error.message || "Erro ao atualizar preço");
                                } finally {
                                  setUpdatingPrice(false);
                                }
                              }}
                            >
                              {updatingPrice ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "Corrigir Preço"
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Nota:</strong> Ao clicar em "Corrigir Preço", o preço do canal iFood no sistema ABRWF será atualizado para o valor praticado no iFood.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDivergenceModal(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Edição de Vínculo */}
        <Dialog open={!!editingMapping} onOpenChange={() => setEditingMapping(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Vincular Produto</DialogTitle>
              <DialogDescription>
                Vincule o produto do iFood a um produto do ABRWF
              </DialogDescription>
            </DialogHeader>
            
            {editingMapping && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Produto iFood:</p>
                  <p className="font-medium">{editingMapping.ifoodProductName}</p>
                  <p className="text-sm text-muted-foreground mt-1">SKU: {editingMapping.ifoodSku}</p>
                </div>

                <div className="space-y-2">
                  <Label>Buscar produto no ABRWF:</Label>
                  <Input
                    placeholder="Digite o nome ou EAN do produto..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>

                {productSearch.length >= 2 && (
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    {searchProductsQuery.isLoading ? (
                      <div className="p-4 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </div>
                    ) : searchProductsQuery.data?.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        Nenhum produto encontrado
                      </div>
                    ) : (
                      <div className="divide-y">
                        {searchProductsQuery.data?.map((product) => (
                          <button
                            key={product.id}
                            className="w-full p-3 text-left hover:bg-muted transition-colors"
                            onClick={() => handleSaveMapping(product.id)}
                          >
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              EAN: {product.ean || "N/A"} | Custo: {formatCurrency(Number(product.avgCost || 0))}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingMapping(null)}>
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
