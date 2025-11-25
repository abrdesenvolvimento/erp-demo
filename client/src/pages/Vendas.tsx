import { useState, useMemo, useEffect } from "react";
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
import { ShoppingCart, Plus, Search, X, Store, Truck, Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { formatSaleType, formatPaymentMethod } from "@/lib/formatters";
import { SaleDetailsModal } from "@/components/SaleDetailsModal";


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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [saleType, setSaleType] = useState<SaleType | null>(null);
  const [step, setStep] = useState<"type" | "form">("type");
  const [statsPeriod, setStatsPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');
  
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

  // Queries
  const { data: sales = [], refetch } = trpc.sales.list.useQuery();
  const { data: stats } = trpc.sales.stats.useQuery({ period: statsPeriod });
  const { data: channels = [] } = trpc.salesChannels.list.useQuery({ activeOnly: true });
  // Buscar parceiros que sejam CUSTOMER ou BOTH (clientes e fornecedores)
  const { data: allPartners = [] } = trpc.partners.list.useQuery({ 
    activeOnly: true 
  });
  
  // Filtrar apenas parceiros que podem ser clientes (CUSTOMER ou BOTH)
  const partners = useMemo(() => 
    allPartners.filter((p: any) => p.partnerType === "CUSTOMER" || p.partnerType === "BOTH"),
    [allPartners]
  );
  const { data: products = [] } = trpc.products.list.useQuery({ 
    search: productSearch,
    activeOnly: true 
  });
  
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

  // Mutations
  const utils = trpc.useUtils();
  const createSale = trpc.sales.create.useMutation({
    onSuccess: () => {
      toast.success("Venda registrada com sucesso!");
      refetch();
      utils.sales.stats.invalidate();
      handleCloseModal();
    },
    onError: (error: any) => {
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

    if (!channelId) {
      toast.error("Selecione um canal de venda primeiro");
      return;
    }

    // Find price for selected channel
    const price = selectedProduct.prices?.find((p: any) => p.channelId === parseInt(channelId));
    if (!price) {
      toast.error("Produto não tem preço configurado para este canal");
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

    // Prepare data
    const saleData = {
      saleType: saleType!,
      channelId: parseInt(channelId),
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
    if ((saleType === "BALCAO" || saleType === "A_PRAZO") && channels.length > 0) {
      const balcaoChannel = channels.find((ch: any) => 
        ch.name.toLowerCase().includes("balcão") || ch.code === "BALCAO"
      );
      if (balcaoChannel) {
        setChannelId(balcaoChannel.id.toString());
      }
    }
  }, [saleType, channels]);

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
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
  };

  const getSaleTypeBadge = (type: string) => {
    const formatted = formatSaleType(type);
    switch (type) {
      case "BALCAO":
        return <Badge className="bg-blue-500">{formatted}</Badge>;
      case "DELIVERY":
        return <Badge className="bg-purple-500">{formatted}</Badge>;
      case "A_PRAZO":
        return <Badge className="bg-orange-500">{formatted}</Badge>;
      default:
        return <Badge>{formatted}</Badge>;
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
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Venda
          </Button>
        </div>

        {/* Filtro de Período */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Período:</span>
          <div className="flex gap-2">
            <Button 
              variant={statsPeriod === 'today' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatsPeriod('today')}
            >
              Hoje
            </Button>
            <Button 
              variant={statsPeriod === 'week' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatsPeriod('week')}
            >
              7 dias
            </Button>
            <Button 
              variant={statsPeriod === 'month' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatsPeriod('month')}
            >
              Mês
            </Button>
            <Button 
              variant={statsPeriod === 'all' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatsPeriod('all')}
            >
              Todos
            </Button>
          </div>
        </div>

        {/* Cards de Resumo */}
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
              <Truck className="h-4 w-4 text-purple-500" />
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Vendas Registradas</h2>
            </div>
          </CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma venda registrada
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
                  {sales.map((sale: any) => (
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
                      <TableCell>{getSaleTypeBadge(sale.saleType)}</TableCell>
                      <TableCell>{sale.customerName || "Venda Avulsa"}</TableCell>
                      <TableCell>
                        {sale.saleType === "DELIVERY" && sale.platformOrderId 
                          ? sale.platformOrderId 
                          : (sale.channelName || "-")}
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(parseFloat(sale.finalAmount))}</TableCell>
                      <TableCell>{sale.paymentMethod}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Modal de Nova Venda */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-5xl h-[85vh] overflow-hidden flex flex-col p-4">
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
                    <Truck className="h-16 w-16 text-purple-500" />
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
              <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-2">
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
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="Buscar produto por nome ou EAN..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setSelectedProduct(null);
                        }}
                      />
                      {productSearch && products.length > 0 && !selectedProduct && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {products.map((product: any) => (
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
                                Estoque: {product.currentStock} {product.unit}
                              </div>
                            </div>
                          ))}
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
                          <TableRow key={index}>
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

                
                {/* Resumo da Venda */}
                  <Card>
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

