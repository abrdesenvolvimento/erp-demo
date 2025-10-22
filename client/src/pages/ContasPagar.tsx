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
import { DollarSign, User, ChevronRight, ArrowLeft } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";

export default function ContasPagar() {
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paidDate: new Date().toISOString().split('T')[0],
    paidAmount: "",
    additionalAmount: "",
    paymentMethod: "",
    notes: ""
  });

  // Queries
  const { data: totalPending, refetch: refetchTotal } = trpc.payables.totalPending.useQuery();
  const { data: suppliers, refetch: refetchSuppliers } = trpc.payables.bySupplier.useQuery();
  const { data: supplierDetail, refetch: refetchDetail } = trpc.payables.supplierDetail.useQuery(
    { supplierId: selectedSupplierId! },
    { enabled: !!selectedSupplierId }
  );

  // Mutation
  const registerPayment = trpc.payables.registerPayment.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado com sucesso!");
      setShowPaymentModal(false);
      resetPaymentForm();
      refetchTotal();
      refetchSuppliers();
      refetchDetail();
    },
    onError: (error) => {
      toast.error(`Erro ao registrar pagamento: ${error.message}`);
    }
  });

  const resetPaymentForm = () => {
    setPaymentForm({
      paidDate: new Date().toISOString().split('T')[0],
      paidAmount: "",
      additionalAmount: "",
      paymentMethod: "",
      notes: ""
    });
  };

  const handleOpenSupplierDetail = (supplierId: number) => {
    setSelectedSupplierId(supplierId);
  };

  const handleCloseSupplierDetail = () => {
    setSelectedSupplierId(null);
    resetPaymentForm();
  };

  const handleOpenPaymentModal = (supplierId?: number) => {
    if (supplierId) {
      setSelectedSupplierId(supplierId);
    }
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSupplierId) {
      toast.error("Cliente não selecionado");
      return;
    }

    if (!paymentForm.paidAmount || parseFloat(paymentForm.paidAmount) <= 0) {
      toast.error("Valor pago deve ser maior que zero");
      return;
    }

    if (!paymentForm.paymentMethod) {
      toast.error("Selecione a forma de pagamento");
      return;
    }

    const totalAmount = parseFloat(paymentForm.paidAmount) + (parseFloat(paymentForm.additionalAmount) || 0);
    
    registerPayment.mutate({
      supplierId: selectedSupplierId,
      paidDate: new Date(paymentForm.paidDate),
      paidAmount: totalAmount.toFixed(2),
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

  // Se um cliente está selecionado, mostra o detalhamento
  if (selectedSupplierId && supplierDetail) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
        {/* Header com botão voltar */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleCloseSupplierDetail}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Conta Corrente - {supplierDetail.supplier.name}</h1>
            <p className="text-muted-foreground">Histórico de vendas e pagamentos</p>
          </div>
        </div>

        {/* Informações do Cliente */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{supplierDetail.supplier.name}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Limite de Compra</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(supplierDetail.supplier.creditLimit || "0")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo a Pagar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(supplierDetail.totalPending)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Vendas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Compras A Prazo</CardTitle>
                <CardDescription>Histórico de compras do fornecedor</CardDescription>
              </div>
              <Button onClick={handleOpenPaymentModal}>
                Registrar Pagamento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Despesa</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierDetail.expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">#{expense.id}</TableCell>
                    <TableCell>{formatDate(expense.expenseDate!)}</TableCell>
                    <TableCell>{expense.description || '-'}</TableCell>
                    <TableCell>{expense.category || '-'}</TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(expense.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(expense.paidAmount)}
                    </TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      {formatCurrency(expense.pendingAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Histórico de Pagamentos */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Pagamentos</CardTitle>
            <CardDescription>Pagamentos realizados ao fornecedor</CardDescription>
          </CardHeader>
          <CardContent>
            {supplierDetail.payments && supplierDetail.payments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Forma de Pagamento</TableHead>
                    <TableHead className="text-right">Valor Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierDetail.payments.map((payment: any, idx: number) => (
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
                Nenhum pagamento registrado ainda
              </p>
            )}
          </CardContent>
        </Card>

        {/* Modal de Registro de Pagamento */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
              <DialogDescription>
                Registre o pagamento de valores do cliente
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paidDate">Data do Pagamento *</Label>
                  <Input
                    id="paidDate"
                    type="date"
                    value={paymentForm.paidDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paidDate: e.target.value })}
                    required
                  />
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
                      <SelectItem value="TRANSFERENCIA">Transferência Bancária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paidAmount">Valor Base *</Label>
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

                <div>
                  <Label htmlFor="additionalAmount">Acréscimo (Juros/Multa)</Label>
                  <Input
                    id="additionalAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentForm.additionalAmount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, additionalAmount: e.target.value })}
                  />
                </div>
              </div>

              {(paymentForm.paidAmount || paymentForm.additionalAmount) && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm font-medium">Total a Pagar:</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      (parseFloat(paymentForm.paidAmount) || 0) + 
                      (parseFloat(paymentForm.additionalAmount) || 0)
                    )}
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Informações adicionais sobre o pagamento..."
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
                  {registerPayment.isPending ? "Registrando..." : "Confirmar Pagamento"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  // Lista de fornecedores (tela principal)
  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Contas a Pagar</h1>
        <p className="text-muted-foreground">Gestão de pagamentos a fornecedores</p>
      </div>

      {/* Card de Resumo */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Pendente de Pagamento
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">
            {totalPending ? formatCurrency(totalPending.total) : "R$ 0,00"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Soma de todas as compras pendentes de pagamento
          </p>
        </CardContent>
      </Card>

      {/* Lista de Fornecedores */}
      <Card>
        <CardHeader>
          <CardTitle>Fornecedores com Saldo a Pagar</CardTitle>
          <CardDescription>
            Clique em um fornecedor para registrar pagamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!suppliers || suppliers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum fornecedor com saldo devedor
            </p>
          ) : (
            <div className="space-y-2">
              {suppliers.map((supplier) => (
                <div
                  key={supplier.supplierId}
                  onClick={() => handleOpenPaymentModal(supplier.supplierId)}
                  className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{supplier.supplierName}</p>
                      <p className="text-sm text-muted-foreground">
                        {supplier.expensesCount} {supplier.expensesCount === 1 ? 'despesa' : 'despesas'} pendente{supplier.expensesCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-red-600">
                      {formatCurrency(supplier.totalPending)}
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

