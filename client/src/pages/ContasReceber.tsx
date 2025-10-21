import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, AlertCircle, TrendingUp, Calendar } from "lucide-react";

export default function ContasReceber() {
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
  const [paymentData, setPaymentData] = useState({
    paidDate: new Date().toISOString().split('T')[0],
    paidAmount: "",
    paymentMethod: "",
    notes: ""
  });

  // Queries
  const { data: summary, refetch: refetchSummary } = trpc.receivables.summary.useQuery();
  const { data: pendingInstallments, refetch: refetchPending } = trpc.receivables.installments.pending.useQuery();
  const { data: overdueInstallments, refetch: refetchOverdue } = trpc.receivables.installments.overdue.useQuery();

  // Mutation
  const payMutation = trpc.receivables.installments.pay.useMutation({
    onSuccess: () => {
      toast.success("Recebimento registrado com sucesso!");
      setPaymentModalOpen(false);
      refetchSummary();
      refetchPending();
      refetchOverdue();
      resetPaymentForm();
    },
    onError: (error) => {
      toast.error(`Erro ao registrar recebimento: ${error.message}`);
    }
  });

  const resetPaymentForm = () => {
    setSelectedInstallment(null);
    setPaymentData({
      paidDate: new Date().toISOString().split('T')[0],
      paidAmount: "",
      paymentMethod: "",
      notes: ""
    });
  };

  const handleOpenPaymentModal = (installment: any) => {
    setSelectedInstallment(installment);
    setPaymentData({
      paidDate: new Date().toISOString().split('T')[0],
      paidAmount: installment.installment.amount,
      paymentMethod: "",
      notes: ""
    });
    setPaymentModalOpen(true);
  };

  const handlePayInstallment = () => {
    if (!selectedInstallment) return;

    if (!paymentData.paymentMethod) {
      toast.error("Selecione a forma de pagamento");
      return;
    }

    payMutation.mutate({
      id: selectedInstallment.installment.id,
      paidDate: new Date(paymentData.paidDate),
      paidAmount: paymentData.paidAmount,
      paymentMethod: paymentData.paymentMethod,
      notes: paymentData.notes || undefined
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
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getDaysUntilDue = (dueDate: Date | string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Contas a Receber</h1>
        <p className="text-muted-foreground">Gerencie os recebimentos das vendas a prazo</p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.totalPending || 0)}</div>
            <p className="text-xs text-muted-foreground">Parcelas pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(summary?.totalOverdue || 0)}</div>
            <p className="text-xs text-muted-foreground">Parcelas em atraso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebido Hoje</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary?.receivedToday || 0)}</div>
            <p className="text-xs text-muted-foreground">Total do dia</p>
          </CardContent>
        </Card>
      </div>

      {/* Abas */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Parcelas Pendentes
            {pendingInstallments && pendingInstallments.length > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {pendingInstallments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Parcelas Vencidas
            {overdueInstallments && overdueInstallments.length > 0 && (
              <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                {overdueInstallments.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Parcelas Pendentes */}
        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parcelas Pendentes</CardTitle>
              <CardDescription>Parcelas a receber nos próximos dias</CardDescription>
            </CardHeader>
            <CardContent>
              {!pendingInstallments || pendingInstallments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma parcela pendente</p>
              ) : (
                <div className="space-y-3">
                  {pendingInstallments.map((item: any) => {
                    const daysUntilDue = getDaysUntilDue(item.installment.dueDate);
                    return (
                      <div key={item.installment.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <p className="font-medium">Venda #{item.receivable?.saleId}</p>
                          <p className="text-sm text-muted-foreground">
                            Parcela {item.installment.installmentNumber}
                          </p>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-3 w-3" />
                            <span>Vencimento: {formatDate(item.installment.dueDate)}</span>
                            <span className={daysUntilDue < 7 ? "text-orange-600 font-medium" : "text-muted-foreground"}>
                              ({daysUntilDue > 0 ? `Vence em ${daysUntilDue} dias` : `Vence hoje`})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-bold">{formatCurrency(item.installment.amount)}</p>
                          </div>
                          <Button onClick={() => handleOpenPaymentModal(item)}>
                            Receber
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Parcelas Vencidas */}
        <TabsContent value="overdue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parcelas Vencidas</CardTitle>
              <CardDescription>Parcelas com vencimento atrasado</CardDescription>
            </CardHeader>
            <CardContent>
              {!overdueInstallments || overdueInstallments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma parcela vencida</p>
              ) : (
                <div className="space-y-3">
                  {overdueInstallments.map((item: any) => {
                    const daysOverdue = Math.abs(getDaysUntilDue(item.installment.dueDate));
                    return (
                      <div key={item.installment.id} className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg">
                        <div className="space-y-1">
                          <p className="font-medium">Venda #{item.receivable?.saleId}</p>
                          <p className="text-sm text-muted-foreground">
                            Parcela {item.installment.installmentNumber}
                          </p>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-3 w-3 text-red-600" />
                            <span>Vencimento: {formatDate(item.installment.dueDate)}</span>
                            <span className="text-red-600 font-medium">
                              ({daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'} de atraso)
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-bold text-red-600">{formatCurrency(item.installment.amount)}</p>
                          </div>
                          <Button variant="destructive" onClick={() => handleOpenPaymentModal(item)}>
                            Receber
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Pagamento */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Registrar Recebimento</DialogTitle>
            <DialogDescription>
              Registre o recebimento da parcela
            </DialogDescription>
          </DialogHeader>

          {selectedInstallment && (
            <div className="space-y-4">
              {/* Informações da Parcela */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Venda:</span>
                  <span className="font-medium">#{selectedInstallment.receivable?.saleId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Parcela:</span>
                  <span className="font-medium">{selectedInstallment.installment.installmentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor da Parcela:</span>
                  <span className="text-lg font-bold">{formatCurrency(selectedInstallment.installment.amount)}</span>
                </div>
              </div>

              {/* Formulário */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="paidDate">Data do Recebimento *</Label>
                  <Input
                    id="paidDate"
                    type="date"
                    value={paymentData.paidDate}
                    onChange={(e) => setPaymentData({ ...paymentData, paidDate: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="paidAmount">Valor Recebido *</Label>
                  <Input
                    id="paidAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentData.paidAmount}
                    onChange={(e) => setPaymentData({ ...paymentData, paidAmount: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="paymentMethod">Forma de Pagamento *</Label>
                  <Select
                    value={paymentData.paymentMethod}
                    onValueChange={(value) => setPaymentData({ ...paymentData, paymentMethod: value })}
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
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    placeholder="Informações adicionais sobre o recebimento..."
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePayInstallment} disabled={payMutation.isPending}>
              {payMutation.isPending ? "Registrando..." : "Confirmar Recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

