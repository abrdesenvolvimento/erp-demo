import { useState, useCallback, useEffect } from "react";
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
import { Upload, FileJson, ArrowRight, CheckCircle2, AlertCircle, AlertTriangle, Search, Edit2, Trash2, Package, History, Loader2, ExternalLink, Download } from "lucide-react";
import * as XLSX from "xlsx";

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

  // Subtle header entrance animation state
  const [headerAnimated, setHeaderAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHeaderAnimated(true), 50);
    return () => clearTimeout(timer);
  }, []);
  
  // De/Para state
  const [searchMapping, setSearchMapping] = useState("");
  const [editingMapping, setEditingMapping] = useState<any>(null);
  const [productSearch, setProductSearch] = useState("");
  const [newMappingSku, setNewMappingSku] = useState("");
  const [newMappingIfoodName, setNewMappingIfoodName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;
  
  // Divergência de valor state
  const [divergenceModal, setDivergenceModal] = useState<{
    order: ProcessedOrder;
    items: ProcessedItem[];
  } | null>(null);
  const [updatingPrice, setUpdatingPrice] = useState(false);
  const [deletingImport, setDeletingImport] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ logId: number; ordersCount: number } | null>(null);
  
  // Queries
  const mappingsQuery = trpc.ifoodImport.listMappings.useQuery({ search: searchMapping, page: currentPage, limit: PAGE_SIZE });
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
  const deleteImportMutation = trpc.ifoodImport.deleteImport.useMutation();
  
  const utils = trpc.useUtils();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportMappings = async () => {
    setIsExporting(true);
    try {
      const data = await utils.ifoodImport.exportMappings.fetch();
      if (!data || data.length === 0) {
        toast.error("Nenhum mapeamento para exportar");
        return;
      }
      const wsData = data.map(row => ({
        'SKU iFood': row.skuIfood,
        'Produto iFood': row.produtoIfood,
        'Produto ABRWF': row.produtoABRWF,
        'EAN ABRWF': row.eanABRWF,
        'Situação': row.situacao,
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      // Auto-width columns
      const colWidths = Object.keys(wsData[0]).map(key => ({
        wch: Math.max(key.length, ...wsData.map(row => String((row as any)[key] || '').length)) + 2
      }));
      ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'De-Para iFood');
      XLSX.writeFile(wb, `depara-ifood-${new Date().toISOString().slice(0,10)}.xlsx`);
      toast.success(`${data.length} mapeamentos exportados com sucesso!`);
    } catch (err) {
      toast.error("Erro ao exportar mapeamentos");
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

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

  const handleCreateNewMapping = async () => {
    if (!editingMapping || !newMappingSku.trim()) {
      toast.error("Informe o SKU/EAN do produto no iFood");
      return;
    }

    try {
      await updateMappingMutation.mutateAsync({
        ifoodSku: newMappingSku.trim(),
        ifoodProductName: newMappingIfoodName.trim() || editingMapping.productName || '',
        productId: editingMapping.productId,
        situation: "Vinculado Manualmente",
      });
      toast.success("Mapeamento criado com sucesso");
      setEditingMapping(null);
      setNewMappingSku("");
      setNewMappingIfoodName("");
      utils.ifoodImport.listMappings.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar mapeamento");
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
        return <Badge className="bg-[#50A773] hover:bg-[#50A773]/90 text-white"><CheckCircle2 className="w-3 h-3 mr-1" /> Pronto</Badge>;
      case "missing_product":
        return <Badge className="bg-[#EA1D2C] hover:bg-[#EA1D2C]/90 text-white"><AlertCircle className="w-3 h-3 mr-1" /> Não localizado</Badge>;
      case "price_divergence":
        return <Badge className="bg-amber-500 hover:bg-amber-500/90 text-white"><AlertTriangle className="w-3 h-3 mr-1" /> Divergência de preço</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      {/* CSS para animação sutil de entrada no header */}
      <style>{`
        @keyframes ifoodHeaderFadeIn {
          0% { opacity: 0; transform: translateY(-8px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ifoodLogoSpin {
          0% { opacity: 0; transform: rotate(-15deg) scale(0.8); }
          60% { transform: rotate(3deg) scale(1.05); }
          100% { opacity: 1; transform: rotate(0deg) scale(1); }
        }
        @keyframes ifoodUnderline {
          0% { width: 0; }
          100% { width: 100%; }
        }
      `}</style>

      <div className="space-y-6">
        {/* Header com identidade iFood */}
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3"
            style={{
              animation: headerAnimated ? 'ifoodHeaderFadeIn 0.5s ease-out forwards' : 'none',
              opacity: headerAnimated ? undefined : 0,
            }}
          >
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663140687549/7RkrCeS5KipYf8hkuNqrCk/ifood-logo-official_825ad8bc.jpg"
              alt="iFood"
              className="w-10 h-10 object-contain"
              style={{
                animation: headerAnimated ? 'ifoodLogoSpin 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s forwards' : 'none',
                opacity: headerAnimated ? undefined : 0,
              }}
            />
            <div>
              <div className="relative">
                <h1 className="text-2xl font-bold text-gray-800">Importador iFood</h1>
                <div
                  className="absolute bottom-0 left-0 h-0.5 bg-[#EA1D2C]/30 rounded-full"
                  style={{
                    animation: headerAnimated ? 'ifoodUnderline 0.8s ease-out 0.4s forwards' : 'none',
                    width: headerAnimated ? undefined : 0,
                  }}
                />
              </div>
              <p className="text-sm text-gray-500">Importe pedidos do iFood para o sistema de vendas</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100/80 p-1">
            <TabsTrigger value="upload" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#EA1D2C] data-[state=active]:shadow-sm">
              <Upload className="w-4 h-4" /> Upload
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#EA1D2C] data-[state=active]:shadow-sm" disabled={!previewData}>
              <FileJson className="w-4 h-4" /> Preview
            </TabsTrigger>
            <TabsTrigger value="depara" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#EA1D2C] data-[state=active]:shadow-sm">
              <ArrowRight className="w-4 h-4" /> De/Para
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#EA1D2C] data-[state=active]:shadow-sm">
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
                      <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${ordersFile ? "border-[#50A773] bg-green-50" : "border-gray-300 hover:border-[#EA1D2C] hover:bg-red-50/30"}`}>
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
                      <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${itemsFile ? "border-[#50A773] bg-green-50" : "border-gray-300 hover:border-[#EA1D2C] hover:bg-red-50/30"}`}>
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
                className="bg-[#EA1D2C] hover:bg-[#C8101E] text-white shadow-md"
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
                {/* Summary Cards - estilo iFood */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-5 pb-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total de Pedidos</p>
                      <div className="text-3xl font-bold text-gray-800">{previewData.summary.totalOrders}</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-[#50A773]/30 bg-[#50A773]/5 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-5 pb-4">
                      <p className="text-xs font-medium text-[#50A773] uppercase tracking-wide mb-1">Prontos</p>
                      <div className="text-3xl font-bold text-[#50A773]">{previewData.summary.readyCount}</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-amber-300/50 bg-amber-50/50 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-5 pb-4">
                      <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-1">Divergência Preço</p>
                      <div className="text-3xl font-bold text-amber-600">{previewData.summary.priceDivergenceCount}</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-[#EA1D2C]/20 bg-[#EA1D2C]/5 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-5 pb-4">
                      <p className="text-xs font-medium text-[#EA1D2C] uppercase tracking-wide mb-1">Não localizado</p>
                      <div className="text-3xl font-bold text-[#EA1D2C]">{previewData.summary.missingProductCount}</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-5 pb-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Valor Total</p>
                      <div className="text-2xl font-bold text-gray-800">{formatCurrency(previewData.summary.totalValue)}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Orders Table */}
                <Card className="border border-gray-200 shadow-sm overflow-hidden">
                  <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg text-gray-800">Pedidos para Importar</CardTitle>
                        <p className="text-sm text-gray-500 mt-0.5">{selectedOrders.size} de {previewData.orders.length} pedido(s) selecionado(s)</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleProcessFiles}
                          disabled={!ordersFile || !itemsFile || isProcessing}
                          className="border-gray-300 hover:border-[#EA1D2C]/50 hover:text-[#EA1D2C]"
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
                            handleImportOrders();
                          }}
                          disabled={selectedOrders.size === 0 || isImporting}
                          className="bg-[#EA1D2C] hover:bg-[#C8101E] text-white shadow-sm"
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
                          <TableRow key={order.ifoodOrderId} className={`transition-colors ${order.status === "missing_product" || order.status === "cancelled" ? "opacity-50 bg-gray-50/50" : "hover:bg-[#EA1D2C]/[0.02]"}`}>
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
                                  onClick={() => {
                                    handleImportSingleOrder(order);
                                  }}
                                  disabled={isImporting}
                                  className="bg-[#EA1D2C] hover:bg-[#C8101E] text-white text-xs h-7 px-3"
                                >
                                  {isImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Importar"}
                                </Button>
                              )}
                              {order.status === "missing_product" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-[#EA1D2C] border-[#EA1D2C]/30 hover:bg-[#EA1D2C]/5 text-xs h-7 px-3"
                                  onClick={() => {
                                    // Abrir modal de De/Para para o primeiro item não mapeado
                                    const unmappedItem = order.items.find(i => !i.isMapped);
                                    if (unmappedItem) {
                                      setEditingMapping({
                                        ifoodSku: unmappedItem.ifoodSku,
                                        ifoodProductName: unmappedItem.ifoodProductName || unmappedItem.ifoodSku || 'Produto sem nome',
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
                                  className="text-amber-600 border-amber-300 hover:bg-amber-50 text-xs h-7 px-3"
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
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-gray-800">De/Para de Produtos</CardTitle>
                    <CardDescription className="text-gray-500">Vincule produtos do iFood aos produtos do ABRWF. Pesquise para encontrar também produtos sem mapeamento.</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportMappings}
                      disabled={isExporting}
                      className="border-[#EA1D2C]/30 text-[#EA1D2C] hover:bg-[#EA1D2C]/5 hover:border-[#EA1D2C]/50 text-xs"
                    >
                      {isExporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                      Exportar Excel
                    </Button>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder="Buscar por nome, SKU ou EAN..."
                        value={searchMapping}
                        onChange={(e) => { setSearchMapping(e.target.value); setCurrentPage(1); }}
                        className="w-72 pl-9 border-gray-300 focus:border-[#EA1D2C] focus:ring-[#EA1D2C]/20"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU / EAN</TableHead>
                      <TableHead>Produto iFood</TableHead>
                      <TableHead>Produto ABRWF</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappingsQuery.data?.items?.map((mapping, idx) => {
                      const isUnmappedProduct = (mapping as any).source === 'product';
                      return (
                        <TableRow key={isUnmappedProduct ? `prod-${mapping.productId}` : `map-${mapping.id}`} className={isUnmappedProduct ? 'bg-blue-50/50' : ''}>
                          <TableCell className="font-mono text-sm">
                            {mapping.ifoodSku || <span className="text-muted-foreground italic">-</span>}
                          </TableCell>
                          <TableCell>
                            {isUnmappedProduct ? (
                              <span className="text-muted-foreground italic">Sem registro iFood</span>
                            ) : (
                              mapping.ifoodProductName || <span className="text-muted-foreground italic">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {mapping.productName ? (
                              <span className={isUnmappedProduct ? 'text-blue-600 font-medium' : 'text-green-600'}>{mapping.productName}</span>
                            ) : (
                              <span className="text-red-500">Não vinculado</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isUnmappedProduct ? (
                              <Badge variant="outline" className="border-blue-300 text-blue-600 bg-blue-50 text-xs">
                                Sem mapeamento iFood
                              </Badge>
                            ) : mapping.productId ? (
                              <Badge className="bg-[#50A773]/10 text-[#50A773] border border-[#50A773]/30 hover:bg-[#50A773]/20 text-xs">
                                {mapping.situation || "Vinculado Manualmente"}
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-50 text-amber-600 border border-amber-300 hover:bg-amber-100 text-xs">
                                {mapping.situation || "Pendente"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isUnmappedProduct ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-blue-300 text-blue-600 hover:bg-blue-100 rounded-lg text-xs"
                                onClick={() => {
                                  setEditingMapping({
                                    ...mapping,
                                    ifoodSku: '',
                                    ifoodProductName: '',
                                    _isNewMapping: true,
                                  });
                                  setProductSearch("");
                                }}
                              >
                                <Package className="w-4 h-4 mr-1" />
                                Criar Vínculo
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-600 hover:text-[#EA1D2C] hover:bg-[#EA1D2C]/5 rounded-lg text-xs"
                                onClick={() => {
                                  setEditingMapping(mapping);
                                  setProductSearch("");
                                }}
                              >
                                <Edit2 className="w-4 h-4 mr-1" />
                                {mapping.productId ? 'Editar' : 'Vincular'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!mappingsQuery.data?.items || mappingsQuery.data.items.length === 0) && !mappingsQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {searchMapping ? 'Nenhum produto encontrado para esta busca' : 'Nenhum mapeamento cadastrado'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {searchMapping && searchMapping.length >= 2 && mappingsQuery.data?.items?.some((m: any) => m.source === 'product') && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <Package className="w-4 h-4 inline mr-1" />
                      Os itens em <strong>azul</strong> são produtos ABRWF que ainda não possuem mapeamento iFood. Clique em "Criar Vínculo" para associá-los.
                    </p>
                  </div>
                )}

                {/* Pagination Controls */}
                {mappingsQuery.data?.pagination && mappingsQuery.data.pagination.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
                    <p className="text-sm text-gray-500">
                      Mostrando página <strong>{mappingsQuery.data.pagination.page}</strong> de <strong>{mappingsQuery.data.pagination.totalPages}</strong>
                      {" "}({mappingsQuery.data.pagination.total} mapeamentos)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="text-xs"
                      >
                        Anterior
                      </Button>
                      {Array.from({ length: Math.min(5, mappingsQuery.data.pagination.totalPages) }, (_, i) => {
                        const totalPages = mappingsQuery.data!.pagination.totalPages;
                        let startPage = Math.max(1, currentPage - 2);
                        if (startPage + 4 > totalPages) startPage = Math.max(1, totalPages - 4);
                        const pageNum = startPage + i;
                        if (pageNum > totalPages) return null;
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`text-xs min-w-[32px] ${pageNum === currentPage ? 'bg-[#EA1D2C] hover:bg-[#C8101E] text-white' : ''}`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!mappingsQuery.data.pagination.hasMore}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="text-xs"
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Histórico */}
          <TabsContent value="historico" className="space-y-4">
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-gray-800">Histórico de Importações</CardTitle>
                <CardDescription className="text-gray-500">Últimas importações realizadas</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Pedidos Importados</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyQuery.data?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{formatDate(log.importedAt?.toString() || "")}</TableCell>
                        <TableCell>{log.importedOrders} pedidos</TableCell>
                        <TableCell>{formatCurrency(Number(log.totalValue || 0))}</TableCell>
                        <TableCell>
                          <Badge className={log.status === "SUCCESS" ? "bg-[#50A773] hover:bg-[#50A773]/90" : "bg-[#EA1D2C] hover:bg-[#EA1D2C]/90"}>
                            {log.status === "SUCCESS" ? "Sucesso" : log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            disabled={deletingImport}
                            onClick={() => setDeleteConfirmModal({ logId: log.id, ordersCount: log.importedOrders || 0 })}
                          >
                            {deletingImport ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!historyQuery.data || historyQuery.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
          <DialogContent className="max-w-6xl w-[98vw] max-h-[90vh] overflow-y-auto z-50">
            <DialogHeader>
              <DialogTitle>Divergência de Valor - Pedido #{divergenceModal?.order.ifoodOrderCode}</DialogTitle>
              <DialogDescription>
                Os preços abaixo estão diferentes entre o iFood e o sistema ABRWF
              </DialogDescription>
            </DialogHeader>
            
            {divergenceModal && (
              <div className="space-y-4">
                <div className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Produto</TableHead>
                        <TableHead className="text-right w-[15%]">Preço iFood</TableHead>
                        <TableHead className="text-right w-[15%]">Preço ABRWF</TableHead>
                        <TableHead className="text-center w-[15%]">Diferença</TableHead>
                        <TableHead className="text-center w-[15%]">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {divergenceModal.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="max-w-[300px]">
                              <p className="font-medium text-sm truncate" title={item.ifoodProductName}>{item.ifoodProductName}</p>
                              <p className="text-xs text-muted-foreground">SKU: {item.ifoodSku}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(item.ifoodPrice)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
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
                                className="whitespace-nowrap text-xs px-2 py-1 h-7"
                                onClick={async () => {
                                setUpdatingPrice(true);
                                try {
                                  const result = await updateChannelPriceMutation.mutateAsync({
                                    productId: item.productId!,
                                    channelId: 2, // iFood
                                    newPrice: item.ifoodPrice,
                                  });
                                  if ((result as any).skipped) {
                                    toast.info(`Preço já estava atualizado (${formatCurrency(item.ifoodPrice)})`);
                                  } else {
                                    toast.success(`Preço atualizado para ${formatCurrency(item.ifoodPrice)}`);
                                  }
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
        <Dialog open={!!editingMapping} onOpenChange={() => { setEditingMapping(null); setNewMappingSku(''); setNewMappingIfoodName(''); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingMapping?._isNewMapping ? 'Criar Mapeamento iFood' : editingMapping?.productName ? 'Editar Vínculo' : 'Vincular Produto'}
              </DialogTitle>
              <DialogDescription>
                {editingMapping?._isNewMapping 
                  ? 'Crie um mapeamento iFood para este produto ABRWF informando o SKU/EAN do iFood'
                  : editingMapping?.productName 
                    ? 'Altere o produto vinculado ao item do iFood' 
                    : 'Vincule o produto do iFood a um produto do ABRWF'}
              </DialogDescription>
            </DialogHeader>
            
            {editingMapping && editingMapping._isNewMapping ? (
              /* Fluxo: Criar novo mapeamento a partir de produto ABRWF */
              <div className="space-y-4">
                <div className="p-4 border rounded-lg border-blue-200 bg-blue-50">
                  <p className="text-sm text-muted-foreground">Produto ABRWF:</p>
                  <p className="font-medium text-blue-700">{editingMapping.productName}</p>
                  {editingMapping.ifoodSku && (
                    <p className="text-sm text-muted-foreground mt-1">EAN: {editingMapping.ifoodSku}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>SKU/EAN do produto no iFood <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Ex: 7894900011159"
                    value={newMappingSku}
                    onChange={(e) => setNewMappingSku(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">Código que identifica o produto no iFood (geralmente o EAN/código de barras)</p>
                </div>

                <div className="space-y-2">
                  <Label>Nome do produto no iFood (opcional)</Label>
                  <Input
                    placeholder="Ex: Refrigerante Coca-Cola Lata 350ml"
                    value={newMappingIfoodName}
                    onChange={(e) => setNewMappingIfoodName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Se não informado, será usado o nome do produto ABRWF</p>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => { setEditingMapping(null); setNewMappingSku(''); setNewMappingIfoodName(''); }}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateNewMapping}
                    disabled={!newMappingSku.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Criar Mapeamento
                  </Button>
                </DialogFooter>
              </div>
            ) : editingMapping && (
              /* Fluxo: Editar mapeamento existente ou vincular produto iFood a ABRWF */
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Produto iFood:</p>
                  <p className="font-medium">{editingMapping.ifoodProductName || <span className="italic text-muted-foreground">-</span>}</p>
                  <p className="text-sm text-muted-foreground mt-1">SKU: {editingMapping.ifoodSku}</p>
                </div>

                {editingMapping.productName && !editingMapping._isNewMapping && (
                  <div className="p-4 border rounded-lg border-green-200 bg-green-50">
                    <p className="text-sm text-muted-foreground">Vínculo atual:</p>
                    <p className="font-medium text-green-700">{editingMapping.productName}</p>
                    <p className="text-xs text-muted-foreground mt-1">Selecione outro produto abaixo para alterar o vínculo</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{editingMapping.productName ? 'Alterar vínculo - Buscar produto:' : 'Buscar produto no ABRWF:'}</Label>
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

                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingMapping(null)}>
                    Cancelar
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Exclusão */}
        <Dialog open={!!deleteConfirmModal} onOpenChange={() => setDeleteConfirmModal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir esta importação?
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Isso irá reverter <span className="font-bold text-foreground">{deleteConfirmModal?.ordersCount || 0} vendas</span> e restaurar o estoque dos produtos.
              </p>
              <p className="text-sm text-destructive mt-2 font-medium">
                Esta ação não pode ser desfeita.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmModal(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deletingImport}
                onClick={async () => {
                  if (!deleteConfirmModal) return;
                  setDeletingImport(true);
                  try {
                    const result = await deleteImportMutation.mutateAsync({ logId: deleteConfirmModal.logId });
                    toast.success(`Importação excluída com sucesso! ${result.deletedOrders} vendas revertidas.`);
                    historyQuery.refetch();
                    setDeleteConfirmModal(null);
                  } catch (error: any) {
                    toast.error(error.message || "Erro ao excluir importação");
                  } finally {
                    setDeletingImport(false);
                  }
                }}
              >
                {deletingImport ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Excluindo...</>
                ) : (
                  "Excluir Importação"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
