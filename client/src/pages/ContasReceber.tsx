import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { toast } from "sonner";
import { DollarSign, User, ChevronRight } from "lucide-react";

export default function ContasReceber() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paidDate: new Date().toISOString().split('T')[0],
    paidAmount: "",
    paymentMethod: "",
    saleId: "oldest",
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

  const resetPaymentForm = () => {
    setPaymentForm({
      paidDate: new Date().toISOString().split('T')[0],
      paidAmount: "",
      paymentMethod: "",
      saleId: "oldest",
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

    registerPayment.mutate({
      customerId: selectedCustomerId,
      saleId: paymentForm.saleId && paymentForm.saleId !== "oldest" ? parseInt(paymentForm.saleId) : undefined,
      paidDate: new Date(paymentForm.paidDate),
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
    return d.toLocaleDateString('pt-BR');
  };

  return (
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
          <CardTitle>Clientes com Saldo Devedor</CardTitle>
          <CardDescription>
            Clique em um cliente para ver detalhes e registrar recebimentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!customers || customers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum cliente com saldo devedor
            </p>
          ) : (
            <div className="space-y-2">
              {customers.map((customer) => (
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

      {/* Modal de Detalhamento do Cliente */}
      <Dialog open={!!selectedCustomerId} onOpenChange={(open) => !open && handleCloseCustomerDetail()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conta Corrente - {customerDetail?.customer.name}</DialogTitle>
            <DialogDescription>
              Histórico de vendas e recebimentos
            </DialogDescription>
          </DialogHeader>

          {customerDetail && (
            <div className="space-y-6">
              {/* Informações do Cliente */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-accent rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <p className="font-bold">{customerDetail.customer.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Limite de Crédito</Label>
                  <p className="font-medium">{formatCurrency(customerDetail.customer.creditLimit || "0")}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Saldo Devedor</Label>
                  <p className="text-lg font-bold text-red-600">
                    {formatCurrency(customerDetail.totalPending)}
                  </p>
                </div>
              </div>

              {/* Tabela de Vendas */}
              <div>
                <h3 className="font-bold mb-3">Vendas A Prazo</h3>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Venda #</TableHead>
                        <TableHead>Produtos</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerDetail.sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>{formatDate(sale.saleDate!)}</TableCell>
                          <TableCell className="font-medium">#{sale.id}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {sale.items.map(item => item.productName).join(', ')}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(sale.totalAmount)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(sale.paidAmount)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-red-600">
                            {formatCurrency(sale.pendingAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Botão para Registrar Recebimento */}
              <div className="flex justify-end">
                <Button onClick={handleOpenPaymentModal} size="lg">
                  Registrar Recebimento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

            <div className="grid grid-cols-2 gap-4">
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
                    <SelectItem value="CARTAO_DEBITO">Cartão de Débito</SelectItem>
                    <SelectItem value="CARTAO_CREDITO">Cartão de Crédito</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="CREDITO_G">Crédito G</SelectItem>
                    <SelectItem value="CREDITO_R">Crédito R</SelectItem>
                    <SelectItem value="CREDITO_ABR">Crédito ABR</SelectItem>
                    <SelectItem value="A_VISTA">À Vista</SelectItem>
                    <SelectItem value="DEBITO_AUTOMATICO">Débito Automático</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="saleId">Aplicar em</Label>
                <Select
                  value={paymentForm.saleId}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, saleId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Venda mais antiga" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oldest">Venda mais antiga (FIFO)</SelectItem>
                    {customerDetail?.sales.map((sale) => (
                      <SelectItem key={sale.id} value={sale.id?.toString() || ""}>
                        Venda #{sale.id} - {formatCurrency(sale.pendingAmount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
    </div>
  );
}

