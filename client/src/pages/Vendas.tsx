import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { formatDateForInput, getTodayInBrazil } from "@shared/dateUtils";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingCart, Plus, Search, X, Store, Bike, Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { formatSaleType, formatPaymentMethod } from "@/lib/formatters";
import { SaleDetailsModal } from "@/components/SaleDetailsModal";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";


type SaleType = "BALCAO" | "DELIVERY" | "A_PRAZO";

interface SaleItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  currentStock: number;
}

export default function Vendas() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [saleType, setSaleType] = useState<SaleType | null>(null);
  const [step, setStep] = useState<"type" | "form">("type");
  const lastItemRef = useRef<HTMLTableRowElement>(null);
  
  // Filter states for sales list
  const [filterFromDate, setFilterFromDate] = useState<string>("");
  const [filterToDate, setFilterToDate] = useState<string>("");
  const [filterSaleType, setFilterSaleType] = useState<string>("");
  
  // Form states
  const [channelId, setChannelId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [platformOrderId, setPlatformOrderId] = useState("");
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState("1");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [surchargeAmount, setSurchargeAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");

  // ========== OTIMIZAÇÕES DE PERFORMANCE ==========
  // Debounce para busca de produtos (evita queries a cada tecla)
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProductSearch(productSearch);
    }, 300); // 300ms de debounce
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Queries
  const utils = trpc.useUtils();
  
  // OTIMIZAÇÃO: Buscar vendas com filtro de data no backend
  const { data: sales = [], refetch, isLoading: salesLoading } = trpc.sales.list.useQuery({
    dateFrom: filterFromDate || undefined,
    dateTo: filterToDate || undefined,
    saleType: filterSaleType && filterSaleType !== "all" ? (filterSaleType as "BALCAO" | "DELIVERY" | "A_PRAZO") : undefined,
  }, {
    enabled: !!filterFromDate || !!filterToDate, // Só busca quando tem filtro de data
    staleTime: 30000, // Cache por 30 segundos
  });
  
  const { data: stats } = trpc.sales.stats.useQuery({ 
    dateFrom: filterFromDate || undefined,
    dateTo: filterToDate || undefined,
    channel: filterSaleType === "" ? 'all' : (filterSaleType as 'BALCAO' | 'DELIVERY' | 'A_PRAZO')
  }, {
    refetchOnMount: true,
    staleTime: 30000, // Cache por 30 segundos
  });

  // Query de exportação
  const exportSales = trpc.sales.exportSales.useQuery(
    {
      startDate: filterFromDate ? new Date(filterFromDate + 'T12:00:00') : undefined,
      endDate: filterToDate ? new Date(filterToDate + 'T12:00:00') : undefined,
      saleType: filterSaleType ? (filterSaleType as "BALCAO" | "DELIVERY" | "A_PRAZO") : undefined,
    },
    { enabled: false } // Não executar automaticamente
  );
  
  // OTIMIZAÇÃO: Carregar canais apenas quando modal está aberto
  const { data: channels = [] } = trpc.salesChannels.list.useQuery(
    { activeOnly: true },
    { 
      enabled: isModalOpen,
      staleTime: 60000, // Cache por 1 minuto
    }
  );
  
  // OTIMIZAÇÃO: Carregar parceiros apenas quando necessário (modal aberto e não é delivery)
  const { data: allPartners = [] } = trpc.partners.list.useQuery(
    { activeOnly: true },
    { 
      enabled: isModalOpen && saleType !== "DELIVERY",
      staleTime: 60000, // Cache por 1 minuto
    }
  );
  
  // Filtrar apenas parceiros que podem ser clientes (CUSTOMER ou BOTH)
  const partners = useMemo(() => 
    allPartners.filter((p: any) => p.partnerType === "CUSTOMER" || p.partnerType === "BOTH"),
    [allPartners]
  );
  
  // OTIMIZAÇÃO: Buscar produtos com debounce e com preços para exibir no autocomplete
  const { data: products = [], isLoading: productsLoading } = trpc.products.list.useQuery(
    { 
      search: debouncedProductSearch,
      activeOnly: true,
      includePrices: true // Carregar preços para exibir no autocomplete
    },
    {
      enabled: isModalOpen && step === "form" && debouncedProductSearch.length >= 2,
      staleTime: 60000, // Cache por 1 minuto
    }
  );
  
  // OTIMIZAÇÃO: Buscar preço apenas do produto selecionado
  const { data: selectedProductWithPrices } = trpc.products.getWithPrices.useQuery(
    { id: selectedProduct?.id || 0 },
    {
      enabled: !!selectedProduct?.id && !!channelId,
      staleTime: 30000,
    }
  );
  
  // Buscar crédito disponível em tempo real quando cliente é selecionado
  const { data: creditInfo } = trpc.partners.getAvailableCredit.useQuery(
    { customerId: selectedCustomer?.id },
    { enabled: !!selectedCustomer && saleType === "A_PRAZO" }
  );

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return partners;
    const searchLower = customerSearch.toLowerCase();
    return partners.filter((p: any) => 
      p.name.toLowerCase().includes(searchLower) ||
      p.docNumber?.toLowerCase().includes(searchLower)
    );
  }, [partners, customerSearch]);

  // OTIMIZAÇÃO: Filtro agora é feito no backend, apenas ordenar aqui
  const filteredSales = useMemo(() => {
    // Vendas já vem filtradas do backend, apenas retornar
    return sales;
  }, [sales]);

  // Initialize filter to today only (using Brazil timezone)
  useEffect(() => {
    const todayStr = formatDateForInput(getTodayInBrazil());
    setFilterFromDate(todayStr);
    setFilterToDate(todayStr);
  }, []);

  // Mutations
  const createSale = trpc.sales.create.useMutation({
    onSuccess: () => {
      toast.success("Venda registrada com sucesso!");
      refetch();
      utils.sales.stats.invalidate();
      handleCloseModal();
    },
    onError: (error: any) => {
      // Safari throws "The string did not match the expected pattern" on 204/empty responses
      // The sale may have been created successfully on the server
      const isSafariPatternError = error.message?.includes('did not match the expected pattern') ||
        error.message?.includes('did not match');
      if (isSafariPatternError) {
        toast.warning("Venda possivelmente registrada. Atualizando lista...");
        refetch();
        utils.sales.stats.invalidate();
        handleCloseModal();
        return;
      }
      toast.error("Erro ao registrar venda: " + error.message);
    },
  });

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSaleType(null);
    setStep("type");
    setChannelId("");
    setCustomerId("");
    setCustomerSearch("");
    setSelectedCustomer(null);
    setPlatformOrderId("");
    setSaleItems([]);
    setProductSearch("");
    setSelectedProduct(null);
    setQuantity("1");
    setDiscountAmount("0");
    setSurchargeAmount("0");
    setPaymentMethod("");
    setNotes("");
  };

  const handleExportSales = async () => {
    try {
      toast.info("Preparando exportação...");
      
      // Refetch para obter os dados
      const result = await exportSales.refetch();
      
      if (!result.data || result.data.length === 0) {
        toast.warning("Nenhuma venda encontrada para exportar");
        return;
      }

      // Importar biblioteca xlsx dinamicamente
      const XLSX = await import('xlsx');
      
      // Formatar dados para Excel
      const excelData = result.data.map((row: any) => ({
        'ID da Venda': row.saleId,
        'Canal': row.channel === 'BALCAO' ? 'Balcão' : row.channel === 'DELIVERY' ? 'Delivery' : 'A Prazo',
        'Número do Pedido': row.orderNumber || '-',
        'Cliente': row.customerName,
        'Produto': row.productName,
        'Quantidade': row.quantity,
        'Data/Hora': (() => {
          const m = row.saleDate?.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
          return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : row.saleDate || '-';
        })(),
        'Valor Unitário': `R$ ${parseFloat(row.unitPrice).toFixed(2).replace('.', ',')}`,
        'Valor Total': `R$ ${parseFloat(row.totalPrice).toFixed(2).replace('.', ',')}`,
        'Forma de Pagamento': row.paymentMethod || '-',
      }));

      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Ajustar largura das colunas
      ws['!cols'] = [
        { wch: 12 }, // ID da Venda
        { wch: 12 }, // Canal
        { wch: 20 }, // Número do Pedido
        { wch: 30 }, // Cliente
        { wch: 40 }, // Produto
        { wch: 12 }, // Quantidade
        { wch: 20 }, // Data/Hora
        { wch: 15 }, // Valor Unitário
        { wch: 15 }, // Valor Total
        { wch: 20 }, // Forma de Pagamento
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
      
      // Gerar nome do arquivo com data
      const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const nomeArquivo = `vendas_${hoje}.xlsx`;
      
      // Download
      XLSX.writeFile(wb, nomeArquivo);
      
      toast.success(`Exportado ${result.data.length} registros com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao exportar:', error);
      toast.error("Erro ao exportar vendas: " + error.message);
    }
  };

  const handleSelectType = (type: SaleType) => {
    setSaleType(type);
    setStep("form");
  };

  const handleAddProduct = () => {
    if (!selectedProduct) {
      toast.error("Selecione um produto");
      return;
    }

    const qty = parseInt(quantity);
    if (qty <= 0) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }

    if (qty > selectedProduct.currentStock) {
      toast.error(`Estoque insuficiente. Disponível: ${selectedProduct.currentStock}`);
      return;
    }

    // Fallback: tentar auto-selecionar canal se ainda não selecionado
    let effectiveChannelId = channelId;
    if (!effectiveChannelId && (saleType === "BALCAO" || saleType === "A_PRAZO") && channels.length > 0) {
      const balcaoChannel = channels.find((ch: any) => {
        const name = (ch.name || '').toLowerCase();
        const code = (ch.code || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return name.includes("balcão") || name.includes("balcao") || code === "BALCAO";
      });
      if (balcaoChannel) {
        effectiveChannelId = balcaoChannel.id.toString();
        setChannelId(effectiveChannelId);
      } else if (channels.length === 1) {
        effectiveChannelId = channels[0].id.toString();
        setChannelId(effectiveChannelId);
      }
    }

    if (!effectiveChannelId) {
      toast.error("Selecione um canal de venda primeiro");
      return;
    }

    // Buscar preço: tentar selectedProductWithPrices primeiro, depois selectedProduct
    const channelIdNum = parseInt(effectiveChannelId);
    let price = selectedProductWithPrices?.prices?.find((p: any) => p.channelId === channelIdNum);
    
    // Fallback: usar preços do produto carregado na lista (includePrices=true)
    if (!price) {
      price = selectedProduct.prices?.find((p: any) => p.channelId === channelIdNum);
    }
    
    // Se ainda não encontrou, tentar buscar pelo canal Balcão (para A_PRAZO)
    if (!price && saleType === 'A_PRAZO') {
      const balcaoChannel = channels.find((ch: any) => 
        ch.name.toLowerCase().includes('balcão') || ch.code === 'BALCAO'
      );
      if (balcaoChannel) {
        price = selectedProductWithPrices?.prices?.find((p: any) => p.channelId === balcaoChannel.id)
          || selectedProduct.prices?.find((p: any) => p.channelId === balcaoChannel.id);
      }
    }
    
    if (!price) {
      const channelName = channels.find((ch: any) => ch.id === channelIdNum)?.name || channelId;
      console.error('[Vendas] Preço não encontrado:', {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        channelId: channelIdNum,
        channelName,
        pricesFromList: selectedProduct.prices?.map((p: any) => ({ channelId: p.channelId, price: p.price })),
        pricesFromGetWithPrices: selectedProductWithPrices?.prices?.map((p: any) => ({ channelId: p.channelId, price: p.price })),
      });
      toast.error(`Produto "${selectedProduct.name}" não tem preço configurado para o canal ${channelName}. Cadastre o preço na tela de Produtos.`);
      return;
    }

    const unitPrice = parseFloat(price.price);
    const totalPrice = unitPrice * qty;

    const newItem: SaleItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: qty,
      unitPrice: unitPrice.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
      currentStock: selectedProduct.currentStock,
    };

    setSaleItems([...saleItems, newItem]);
    setProductSearch("");
    setSelectedProduct(null);
    setQuantity("1");
    
    // Auto-scroll para o último item adicionado
    setTimeout(() => {
      lastItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const handleRemoveItem = (index: number) => {
    setSaleItems(saleItems.filter((_, i) => i !== index));
  };

  const subtotal = saleItems.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
  const discount = parseFloat(discountAmount) || 0;
  const surcharge = parseFloat(surchargeAmount) || 0;
  const total = subtotal - discount + surcharge;

  const handleFinalizeSale = () => {
    // Validations
    if (!channelId) {
      toast.error("Selecione um canal de venda");
      return;
    }

    if (saleType === "A_PRAZO" && !customerId) {
      toast.error("Selecione um cliente para venda a prazo");
      return;
    }

    if (saleItems.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }

    // Payment method not required for A_PRAZO (will be defined on closing)
    if (saleType !== "A_PRAZO" && !paymentMethod) {
      toast.error("Selecione uma forma de pagamento");
      return;
    }

    // Prepare data — guard against NaN channelId
    const parsedChannelId = parseInt(channelId);
    if (isNaN(parsedChannelId)) {
      toast.error("Canal de venda inválido. Feche e reabra o formulário.");
      return;
    }

    const saleData = {
      saleType: saleType!,
      channelId: parsedChannelId,
      customerId: customerId ? parseInt(customerId) : undefined,
      platformOrderId: platformOrderId || undefined,
      subtotal: subtotal.toFixed(2),
      discountAmount: discount.toFixed(2),
      surchargeAmount: surcharge.toFixed(2),
      finalAmount: total.toFixed(2),
      paymentMethod: saleType === "A_PRAZO" ? "A Prazo" : paymentMethod,
      notes: notes || undefined,
      items: saleItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
    };

    console.log('[handleFinalizeSale] Sending sale data:', saleData);
    console.log('[handleFinalizeSale] channelId raw:', channelId);
    console.log('[handleFinalizeSale] channelId parsed:', parseInt(channelId));
    console.log('[handleFinalizeSale] paymentMethod:', paymentMethod);
    
    createSale.mutate(saleData);
  };

  // Auto-select channel for BALCAO and A_PRAZO
  useEffect(() => {
    if ((saleType === "BALCAO" || saleType === "A_PRAZO") && channels.length > 0 && !channelId) {
      const balcaoChannel = channels.find((ch: any) => {
        const name = (ch.name || '').toLowerCase();
        const code = (ch.code || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return name.includes("balcão") || name.includes("balcao") || code === "BALCAO";
      });
      if (balcaoChannel) {
        setChannelId(balcaoChannel.id.toString());
      } else if (channels.length === 1) {
        // Se só tem 1 canal, auto-selecionar
        setChannelId(channels[0].id.toString());
      }
    }
  }, [saleType, channels, channelId]);

  // Auto-select "Pago na Plataforma" for DELIVERY
  useEffect(() => {
    if (saleType === "DELIVERY") {
      setPaymentMethod("Pago na Plataforma");
    }
  }, [saleType]);

  const filteredChannels = channels.filter((ch: any) => {
    if (saleType === "DELIVERY") {
      return ch.type === "DELIVERY" || 
             ch.name.toLowerCase().includes("ifood") ||
             ch.name.toLowerCase().includes("99") ||
             ch.name.toLowerCase().includes("próprio");
    }
    // For BALCAO and A_PRAZO, return balcao channel
    return ch.name.toLowerCase().includes("balcão") || ch.code === "BALCAO";
  });

  const paymentOptions = useMemo(() => {
    const baseOptions = ["Dinheiro", "Cartão de Débito", "Cartão de Crédito", "PIX"];
    
    if (saleType === "A_PRAZO") {
      return [...baseOptions, "A Prazo"];
    }
    
    if (saleType === "DELIVERY") {
      return [...baseOptions, "Pago na Plataforma"];
    }
    
    return baseOptions;
  }, [saleType]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDateTime = (dateString: string) => {
    // Server retorna datas já convertidas para Brasília via CONVERT_TZ
    // NÃO usar timeZone aqui para evitar dupla conversão
    // Formato do server: '2026-05-14 23:54:22.000000'
    // Parsear manualmente para evitar diferenças entre browsers
    if (!dateString) return '-';
    const match = dateString.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      return `${day}/${month}/${year}, ${hour}:${minute}`;
    }
    // Fallback
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSaleTypeBadge = (type: string, status?: string) => {
    const formatted = formatSaleType(type);
    const isCancelled = status === "CANCELLED";
    const label = isCancelled ? `${formatted}-CANCELADO` : formatted;
    
    if (isCancelled) {
      return <Badge variant="destructive">{label}</Badge>;
    }
    
    switch (type) {
      case "BALCAO":
        return <Badge className="bg-blue-500">{label}</Badge>;
      case "DELIVERY":
        return <Badge className="bg-purple-500">{label}</Badge>;
      case "A_PRAZO":
        return <Badge className="bg-orange-500">{label}</Badge>;
      default:
        return <Badge>{label}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-8 w-8" />
              Vendas
            </h1>
            <p className="text-muted-foreground">
              Registre e gerencie vendas do sistema
            </p>
          </div>
          <Button 
            onClick={() => setIsModalOpen(true)}
            disabled={!permissions.sales.canCreate}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Venda
          </Button>
        </div>



        {/* Cards de Resumo - Oculto para Operacional */}
        {!permissions.isOperacional && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-t-4 border-t-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas Balcão</CardTitle>
              <Store className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats?.balcao.count || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                R$ {stats?.balcao.total ? parseFloat(stats.balcao.total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas Delivery</CardTitle>
              <Bike className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {stats?.delivery.count || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                R$ {stats?.delivery.total ? parseFloat(stats.delivery.total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas A Prazo</CardTitle>
              <Calendar className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats?.aPrazo.count || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                R$ {stats?.aPrazo.total ? parseFloat(stats.aPrazo.total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-gray-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
              <ShoppingCart className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">
                {stats?.total.count || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                R$ {stats?.total.total ? parseFloat(stats.total.total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
              </p>
            </CardContent>
          </Card>
        </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Vendas Registradas</h2>
{!permissions.isOperacional && (
              <Button
                variant="outline"
                onClick={handleExportSales}
                disabled={exportSales.isLoading}
              >
                {exportSales.isLoading ? "Exportando..." : "Exportar para Excel"}
              </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="filter-from-date" className="text-sm">De</Label>
                <Input
                  id="filter-from-date"
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="filter-to-date" className="text-sm">Ate</Label>
                <Input
                  id="filter-to-date"
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="filter-type" className="text-sm">Canal</Label>
                <Select value={filterSaleType} onValueChange={setFilterSaleType}>
                  <SelectTrigger id="filter-type" className="mt-1">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="BALCAO">Balcão</SelectItem>
                    <SelectItem value="DELIVERY">Delivery</SelectItem>
                    <SelectItem value="A_PRAZO">A Prazo</SelectItem>
                    <SelectItem value="SALAO">Salão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    const todayStr = formatDateForInput(getTodayInBrazil());
                    setFilterFromDate(todayStr);
                    setFilterToDate(todayStr);
                    setFilterSaleType("all");
                  }}
                  className="w-full"
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
            {salesLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="animate-pulse">Carregando vendas...</div>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma venda encontrada no período selecionado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Pagamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale: any) => (
                    <TableRow 
                      key={sale.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedSaleId(sale.id);
                        setIsDetailsModalOpen(true);
                      }}
                    >
                      <TableCell>#{sale.id}</TableCell>
                      <TableCell>{formatDateTime(sale.saleDate || sale.createdAt)}</TableCell>
                      <TableCell>{getSaleTypeBadge(sale.saleType, sale.status)}</TableCell>
                      <TableCell>{sale.customerName || "Venda Avulsa"}</TableCell>
                      <TableCell>
                        {sale.saleType === "DELIVERY" && sale.platformOrderId 
                          ? sale.platformOrderId 
                          : (sale.channelName || "-")}
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(parseFloat(sale.finalAmount))}</TableCell>
                      <TableCell>{formatPaymentMethod(sale.paymentMethod)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Modal de Nova Venda */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-5xl h-[92vh] overflow-y-auto flex flex-col p-4">
            <DialogHeader>
              <DialogTitle>
                {step === "type" ? "Nova Venda - Selecione o Tipo" : `Nova Venda - ${saleType?.replace("_", " ")}`}
              </DialogTitle>
            </DialogHeader>

            {step === "type" && (
              <div className="grid grid-cols-3 gap-4 py-6">
                <Card 
                  className="cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={() => handleSelectType("BALCAO")}
                >
                  <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                    <Store className="h-16 w-16 text-blue-500" />
                    <div className="text-center">
                      <h3 className="font-bold text-lg">Balcão</h3>
                      <p className="text-sm text-muted-foreground">Venda presencial no balcão</p>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:border-purple-500 transition-colors"
                  onClick={() => handleSelectType("DELIVERY")}
                >
                  <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                    <Bike className="h-16 w-16 text-purple-500" />
                    <div className="text-center">
                      <h3 className="font-bold text-lg">DELIVERY</h3>
                      <p className="text-sm text-muted-foreground">Pedido de entrega via plataforma</p>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:border-orange-500 transition-colors"
                  onClick={() => handleSelectType("A_PRAZO")}
                >
                  <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                    <Calendar className="h-16 w-16 text-orange-500" />
                    <div className="text-center">
                      <h3 className="font-bold text-lg">A Prazo</h3>
                      <p className="text-sm text-muted-foreground">Venda parcelada para cliente</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === "form" && (
              <div className="flex-1 grid md:grid-cols-[1fr,400px] gap-6">
                {/* Coluna Esquerda: Formulário */}
                <div className="space-y-4 py-2 pr-2">
                {/* Canal de Venda - Apenas para DELIVERY */}
                {saleType === "DELIVERY" && (
                  <div className="space-y-2">
                    <Label htmlFor="channel">Canal de Venda *</Label>
                    <Select value={channelId} onValueChange={setChannelId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o canal" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredChannels.map((channel: any) => (
                          <SelectItem key={channel.id} value={channel.id.toString()}>
                            {channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Cliente - Apenas para BALCAO e A_PRAZO */}
                {saleType !== "DELIVERY" && (
                  <div className="space-y-2">
                    <Label htmlFor="customer">
                      Cliente {saleType === "A_PRAZO" ? "*" : "(opcional)"}
                    </Label>
                    <div className="relative">
                      <Input
                        id="customer"
                        placeholder="Digite o nome ou CPF/CNPJ do cliente..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setSelectedCustomer(null);
                          setCustomerId("");
                        }}
                      />
                      {customerSearch && filteredCustomers.length > 0 && !selectedCustomer && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {filteredCustomers.map((customer: any) => (
                            <div
                              key={customer.id}
                              className="px-4 py-3 cursor-pointer hover:bg-gray-100 border-b last:border-b-0"
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setCustomerId(customer.id.toString());
                                setCustomerSearch(customer.name);
                              }}
                            >
                              <div className="font-medium">{customer.name}</div>
                              <div className="text-sm text-gray-600">
                                {customer.docNumber}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedCustomer && saleType === "A_PRAZO" && (
                      <div className="text-sm text-blue-600 mt-1">
                        Cliente selecionado: {selectedCustomer.name} | 
                        Limite: {formatCurrency(parseFloat(creditInfo?.creditLimit || selectedCustomer.creditLimit || "0"))} | 
                        Disponível: {formatCurrency(parseFloat(creditInfo?.available || "0"))}
                      </div>
                    )}
                  </div>
                )}

                {/* ID do Pedido na Plataforma - Apenas para DELIVERY */}
                {saleType === "DELIVERY" && (
                  <div className="space-y-2">
                    <Label htmlFor="platformOrderId">ID do Pedido na Plataforma</Label>
                    <Input
                      id="platformOrderId"
                      placeholder="Ex: 99-12345, IFOOD-67890"
                      value={platformOrderId}
                      onChange={(e) => setPlatformOrderId(e.target.value)}
                    />
                  </div>
                )}

                {/* Produtos */}
                <div className="space-y-4">
                  <Label>Produtos</Label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 relative min-w-0">
                      <Input
                        placeholder="Buscar produto por nome ou EAN..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setSelectedProduct(null);
                        }}
                      />
                      {/* Loading indicator */}
                      {productSearch && productsLoading && !selectedProduct && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg p-4 text-center text-gray-500">
                          Buscando produtos...
                        </div>
                      )}
                      {/* Lista de produtos com preços */}
                      {productSearch && debouncedProductSearch.length >= 2 && !productsLoading && products.length > 0 && !selectedProduct && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {products.slice(0, 20).map((product: any) => {
                            // Buscar preço do canal selecionado
                            const channelPrice = product.prices?.find((p: any) => p.channelId === parseInt(channelId));
                            const priceDisplay = channelPrice ? `R$ ${parseFloat(channelPrice.price).toFixed(2).replace('.', ',')}` : null;
                            
                            return (
                              <div
                                key={product.id}
                                className="px-4 py-2 cursor-pointer hover:bg-gray-100"
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setProductSearch(product.name);
                                }}
                              >
                                <div className="font-medium">{product.name}</div>
                                <div className="text-sm text-gray-600">
                                  Estoque: {product.currentStock} {priceDisplay ? `| Preço: ${priceDisplay}` : ''}
                                </div>
                              </div>
                            );
                          })}
                          {products.length > 20 && (
                            <div className="px-4 py-2 text-sm text-gray-500 text-center border-t">
                              Mostrando 20 de {products.length} resultados. Digite mais para refinar.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Input
                        type="number"
                        placeholder="Qtd"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-24"
                      />
                      {selectedProduct && (
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          Disp: {selectedProduct.currentStock}
                          {selectedProductWithPrices?.prices?.find((p: any) => p.channelId === parseInt(channelId)) && (
                            <span className="ml-1 text-green-600">
                              R$ {parseFloat(selectedProductWithPrices.prices.find((p: any) => p.channelId === parseInt(channelId))?.price || '0').toFixed(2).replace('.', ',')}
                            </span>
                          )}
                          {parseInt(quantity) > selectedProduct.currentStock && (
                            <span className="text-destructive ml-1">⚠️</span>
                          )}
                        </div>
                      )}
                    </div>
                    <Button onClick={handleAddProduct} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {saleItems.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Preço Un.</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {saleItems.map((item, index) => (
                          <TableRow 
                            key={index}
                            ref={index === saleItems.length - 1 ? lastItemRef : null}
                          >
                            <TableCell>{item.productName}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                            <TableCell>{formatCurrency(parseFloat(item.totalPrice))}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Resumo */}
                {/* Forma de Pagamento - Não aparece para A_PRAZO */}
                {saleType !== "A_PRAZO" && (
                  <div className="space-y-2">
                    <Label htmlFor="payment">Forma de Pagamento *</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Observações */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    placeholder="Digite observações sobre a venda..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                </div>
                
                {/* Coluna Direita: Resumo (fixo) */}
                <div className="py-2">
                  <Card className="sticky top-0">
                    <CardHeader>
                      <h3 className="font-semibold text-lg">Resumo da Venda</h3>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="font-semibold">{formatCurrency(subtotal)}</span>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm">Desconto:</Label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(e.target.value)}
                            className="text-right"
                          />
                          <span className="text-red-600 font-semibold text-sm">-{formatCurrency(discount)}</span>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm">Acréscimo:</Label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={surchargeAmount}
                            onChange={(e) => setSurchargeAmount(e.target.value)}
                            className="text-right"
                          />
                          <span className="text-green-600 font-semibold text-sm">+{formatCurrency(surcharge)}</span>
                        </div>

                        <div className="flex justify-between text-xl font-bold pt-3 border-t-2">
                          <span>TOTAL:</span>
                          <span className="text-blue-600">{formatCurrency(total)}</span>
                        </div>
                      </div>
                      
                      {/* Botões */}
                      <div className="flex flex-col gap-2 pt-4 border-t">
                        <Button onClick={handleFinalizeSale} disabled={createSale.isPending} className="w-full">
                          {createSale.isPending ? "Salvando..." : "Finalizar Venda"}
                        </Button>
                        <Button variant="outline" onClick={handleCloseModal} className="w-full">
                          Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <SaleDetailsModal
        saleId={selectedSaleId}
        open={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedSaleId(null);
        }}
      />

    </DashboardLayout>
  );
}

