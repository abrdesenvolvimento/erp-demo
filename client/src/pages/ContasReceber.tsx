import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";
import { DollarSign, User, ChevronRight, ArrowLeft, FileDown, Loader2, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { trpc } from "../lib/trpc";
import { getTodayBR } from "../lib/dateUtils";

interface PaymentForm {
  paidDate: string;
  paidAmount: string;
  paymentMethod: string;
  notes: string;
}

export default function ContasReceber() {
  const utils = trpc.useUtils();
  
  // Invalidar cache ao montar a página para garantir dados frescos
  useEffect(() => {
    utils.receivables.totalPending.invalidate();
    utils.receivables.byCustomer.invalidate();
  }, [utils]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState("");
  const [searchCustomer, setSearchCustomer] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "amount">("amount");
  const [paymentForm, setPaymentForm] = useState({
    paidDate: getTodayBR(),
    paidAmount: "",
    paymentMethod: "",
    notes: ""
  });

  // Queries
  const { data: totalPending, refetch: refetchTotal } = trpc.receivables.totalPending.useQuery();
  const { data: customers, refetch: refetchCustomers } = trpc.receivables.byCustomer.useQuery();
  const { data: customerDetail, refetch: refetchDetail } = trpc.receivables.customerDetail.useQuery(
    { customerId: selectedCustomerId! },
    { enabled: !!selectedCustomerId }
  );

  // Mutation
  const registerPayment = trpc.receivables.registerPayment.useMutation({
    onSuccess: () => {
      toast.success("Recebimento registrado com sucesso!");
      setShowPaymentModal(false);
      resetPaymentForm();
      refetchTotal();
      refetchCustomers();
      refetchDetail();
    },
    onError: (error) => {
      toast.error(`Erro ao registrar recebimento: ${error.message}`);
    }
  });

  const exportPDF = trpc.receivables.exportPDF.useMutation({
    onSuccess: (data) => {
      // Converter base64 para blob
      const binaryString = atob(data.pdf);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      
      // Criar link de download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("PDF baixado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao gerar PDF: ${error.message}`);
    }
  });

  const sendViaWhatsApp = trpc.receivables.sendViaWhatsApp.useMutation({
    onSuccess: (data) => {
      toast.success(`Extrato enviado para ${data.customerName} via WhatsApp!`);
      setShowWhatsAppModal(false);
      setWhatsAppPhone("");
    },
    onError: (error) => {
      toast.error(`Erro ao enviar WhatsApp: ${error.message}`);
    }
  });

  const handleSendWhatsApp = () => {
    if (!whatsAppPhone.trim()) {
      toast.error("Digite o número de telefone");
      return;
    }
    if (!selectedCustomerId) {
      toast.error("Selecione um cliente");
      return;
    }
    sendViaWhatsApp.mutate({
      customerId: selectedCustomerId,
      phoneNumber: whatsAppPhone
    });
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      paidDate: getTodayBR(),
      paidAmount: "",
      paymentMethod: "",
      notes: ""
    });
  };

  const handleOpenCustomerDetail = (customerId: number) => {
    setSelectedCustomerId(customerId);
  };

  const handleCloseCustomerDetail = () => {
    setSelectedCustomerId(null);
    resetPaymentForm();
  };

  const handleOpenPaymentModal = () => {
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      toast.error("Cliente não selecionado");
      return;
    }

    if (!paymentForm.paidAmount || parseFloat(paymentForm.paidAmount) <= 0) {
      toast.error("Valor recebido deve ser maior que zero");
      return;
    }

    if (!paymentForm.paymentMethod) {
      toast.error("Selecione a forma de pagamento");
      return;
    }

    // Criar data explicitamente em horário de Brasília (meio-dia) para evitar problemas de timezone
    const [year, month, day] = paymentForm.paidDate.split('-');
    const paidDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);

    registerPayment.mutate({
      customerId: selectedCustomerId,
      paidDate,
      paidAmount: paymentForm.paidAmount,
      paymentMethod: paymentForm.paymentMethod,
      notes: paymentForm.notes || undefined
    });
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Se um cliente está selecionado, mostra o detalhamento
  if (selectedCustomerId && customerDetail) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
        {/* Header com botão voltar */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleCloseCustomerDetail}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Conta Corrente - {customerDetail.customer.name}</h1>
            <p className="text-muted-foreground">Histórico de vendas e recebimentos</p>
          </div>
        </div>

        {/* Informações do Cliente */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{customerDetail.customer.name}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Limite de Crédito</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(customerDetail.customer.creditLimit || "0")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Devedor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(customerDetail.totalPending)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Vendas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Vendas A Prazo</CardTitle>
                <CardDescription>Histórico de compras do cliente</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => exportPDF.mutate({ customerId: selectedCustomerId! })}
                  disabled={exportPDF.isPending}
                  variant="outline"
                >
                  {exportPDF.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  {exportPDF.isPending ? 'Gerando...' : 'Exportar PDF'}
                </Button>
                <Button 
                  onClick={() => setShowWhatsAppModal(true)}
                  variant="outline"
                  className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                <Button onClick={handleOpenPaymentModal}>
                  Registrar Recebimento
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Venda</TableHead>
                  <TableHead>Data de Compra</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Valor Unitário</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerDetail.sales.flatMap((sale) =>
                  sale.items.map((item, idx) => (
                    <TableRow key={`${sale.id}-${idx}`}>
                      {idx === 0 && (
                        <>
                          <TableCell rowSpan={sale.items.length} className="font-medium">
                            #{sale.id}
                          </TableCell>
                          <TableCell rowSpan={sale.items.length}>
                            {formatDate(sale.saleDate!)}
                          </TableCell>
                        </>
                      )}
                      <TableCell>{item.productName}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      {idx === 0 && (
                        <TableCell rowSpan={sale.items.length} className="text-right font-bold">
                          {formatCurrency(sale.totalAmount)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Histórico de Recebimentos */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Recebimentos</CardTitle>
            <CardDescription>Pagamentos realizados pelo cliente</CardDescription>
          </CardHeader>
          <CardContent>
            {customerDetail.payments && customerDetail.payments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Recebimento</TableHead>
                    <TableHead>Forma de Pagamento</TableHead>
                    <TableHead className="text-right">Valor Recebido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerDetail.payments.map((payment: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{formatDate(payment.paidDate)}</TableCell>
                      <TableCell>{payment.paymentMethod}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {formatCurrency(payment.paidAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum recebimento registrado ainda
              </p>
            )}
          </CardContent>
        </Card>

        {/* Modal de Registro de Recebimento */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Recebimento</DialogTitle>
              <DialogDescription>
                Registre o recebimento de valores do cliente
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paidDate">Data do Recebimento *</Label>
                  <Input
                    id="paidDate"
                    type="date"
                    value={paymentForm.paidDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paidDate: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="paidAmount">Valor Recebido *</Label>
                  <Input
                    id="paidAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentForm.paidAmount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paidAmount: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="paymentMethod">Forma de Pagamento *</Label>
                <Select
                  value={paymentForm.paymentMethod}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="CARTAO_DEBITO">Débito</SelectItem>
                    <SelectItem value="CARTAO_CREDITO">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Informações adicionais sobre o recebimento..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={registerPayment.isPending}>
                  {registerPayment.isPending ? "Registrando..." : "Confirmar Recebimento"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal de Envio via WhatsApp */}
        <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                Enviar Extrato via WhatsApp
              </DialogTitle>
              <DialogDescription>
                O extrato será enviado diretamente para o WhatsApp do cliente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="whatsapp-phone">Número de Telefone</Label>
                <Input
                  id="whatsapp-phone"
                  type="tel"
                  placeholder="(11) 98765-4321"
                  value={whatsAppPhone}
                  onChange={(e) => setWhatsAppPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Digite o número com DDD. Ex: 11987654321
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowWhatsAppModal(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSendWhatsApp}
                  disabled={sendViaWhatsApp.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {sendViaWhatsApp.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Enviar WhatsApp
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  // Lista de clientes (tela principal)
  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Contas a Receber</h1>
        <p className="text-muted-foreground">Gestão de recebimentos das vendas a prazo</p>
      </div>

      {/* Card de Resumo */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Pendente de Recebimento
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {totalPending ? formatCurrency(totalPending.total) : "R$ 0,00"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Soma de todas as vendas A_PRAZO pendentes
          </p>
        </CardContent>
      </Card>

      {/* Lista de Clientes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Clientes com Saldo Devedor</CardTitle>
              <CardDescription>
                Clique em um cliente para ver detalhes e registrar recebimentos
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar cliente..."
                value={searchCustomer}
                onChange={(e) => setSearchCustomer(e.target.value)}
                className="w-64"
              />
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Maior débito</SelectItem>
                  <SelectItem value="name">Nome A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!customers || customers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum cliente com saldo devedor
            </p>
          ) : (
            <div className="space-y-2">
              {customers
                .filter((c) => 
                  !searchCustomer || 
                  (c.customerName || "").toLowerCase().includes(searchCustomer.toLowerCase())
                )
                .sort((a, b) => {
                  if (sortBy === "amount") {
                    return parseFloat(b.totalPending) - parseFloat(a.totalPending);
                  }
                  return (a.customerName || "").localeCompare(b.customerName || "");
                })
                .map((customer) => (
                <div
                  key={customer.customerId}
                  onClick={() => handleOpenCustomerDetail(customer.customerId)}
                  className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{customer.customerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {customer.salesCount} {customer.salesCount === 1 ? 'venda' : 'vendas'} pendente{customer.salesCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-red-600">
                      {formatCurrency(customer.totalPending)}
                    </span>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}

