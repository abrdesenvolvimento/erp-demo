import { useState } from "react";
import { Plus, Filter, DollarSign, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Despesas() {
  const [showNewExpenseDialog, setShowNewExpenseDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"list" | "pending">("list");

  // Queries
  const { data: expenses, refetch: refetchExpenses } = trpc.expenses.list.useQuery();
  const { data: categories } = trpc.expenses.categories.list.useQuery();
  const { data: suppliers } = trpc.partners.list.useQuery({ partnerType: "SUPPLIER" });
  const { data: pendingInstallments, refetch: refetchPending } = trpc.expenses.installments.pending.useQuery();

  // Mutations
  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: () => {
      toast.success("Despesa cadastrada com sucesso!");
      setShowNewExpenseDialog(false);
      refetchExpenses();
      refetchPending();
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar despesa: " + error.message);
    },
  });

  const payInstallment = trpc.expenses.installments.pay.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado com sucesso!");
      setShowPaymentDialog(false);
      setSelectedInstallment(null);
      refetchExpenses();
      refetchPending();
      resetPaymentForm();
    },
    onError: (error) => {
      toast.error("Erro ao registrar pagamento: " + error.message);
    },
  });

  // Form states
  const [formData, setFormData] = useState({
    categoryId: "",
    description: "",
    totalAmount: "",
    paymentType: "AVISTA" as "AVISTA" | "PARCELADO",
    installments: "1",
    dueDay: "",
    firstDueDate: "",
    supplierId: "",
    notes: "",
  });

  const [paymentData, setPaymentData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentAmount: "",
    paymentMethod: "",
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      categoryId: "",
      description: "",
      totalAmount: "",
      paymentType: "AVISTA",
      installments: "1",
      dueDay: "",
      firstDueDate: "",
      supplierId: "",
      notes: "",
    });
  };

  const resetPaymentForm = () => {
    setPaymentData({
      paymentDate: new Date().toISOString().split('T')[0],
      paymentAmount: "",
      paymentMethod: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.categoryId || !formData.description || !formData.totalAmount || !formData.firstDueDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    createExpense.mutate({
      categoryId: parseInt(formData.categoryId),
      description: formData.description,
      totalAmount: formData.totalAmount,
      paymentType: formData.paymentType,
      installments: parseInt(formData.installments),
      dueDay: formData.dueDay ? parseInt(formData.dueDay) : undefined,
      firstDueDate: new Date(formData.firstDueDate),
      supplierId: formData.supplierId ? parseInt(formData.supplierId) : undefined,
      notes: formData.notes || undefined,
    });
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedInstallment || !paymentData.paymentAmount || !paymentData.paymentMethod) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    payInstallment.mutate({
      id: selectedInstallment.installment.id,
      paymentDate: new Date(paymentData.paymentDate),
      paymentAmount: paymentData.paymentAmount,
      paymentMethod: paymentData.paymentMethod as any,
      notes: paymentData.notes || undefined,
    });
  };

  const openPaymentDialog = (installment: any) => {
    setSelectedInstallment(installment);
    setPaymentData({
      ...paymentData,
      paymentAmount: installment.installment.amount,
    });
    setShowPaymentDialog(true);
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getDaysUntilDue = (dueDate: Date | string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ATIVA: "default",
      CANCELADA: "secondary",
      PENDENTE: "outline",
      PAGO: "default",
      VENCIDO: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Despesas Operacionais</h1>
          <p className="text-muted-foreground">Gerencie as despesas da empresa</p>
        </div>
        <Button onClick={() => setShowNewExpenseDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Despesa
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas Ativas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {expenses?.filter(e => e.expense.status === 'ATIVA').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parcelas Pendentes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingInstallments?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendente</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                pendingInstallments?.reduce((sum, p) => sum + parseFloat(p.installment.amount), 0) || 0
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === "list" ? "default" : "outline"}
          onClick={() => setViewMode("list")}
        >
          Despesas
        </Button>
        <Button
          variant={viewMode === "pending" ? "default" : "outline"}
          onClick={() => setViewMode("pending")}
        >
          Parcelas Pendentes
          {pendingInstallments && pendingInstallments.length > 0 && (
            <Badge className="ml-2" variant="secondary">{pendingInstallments.length}</Badge>
          )}
        </Button>
      </div>

      {/* Lista de Despesas */}
      {viewMode === "list" && (
        <Card>
          <CardHeader>
            <CardTitle>Despesas Cadastradas</CardTitle>
            <CardDescription>Lista de todas as despesas operacionais</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expenses?.map((item) => (
                <div key={item.expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{item.expense.description}</h3>
                      {getStatusBadge(item.expense.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.category?.name} • {item.expense.paymentType === 'AVISTA' ? 'À Vista' : `${item.expense.installments}x`}
                      {item.supplier && ` • ${item.supplier.name}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vencimento: {formatDate(item.expense.firstDueDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(item.expense.totalAmount)}</p>
                  </div>
                </div>
              ))}
              {(!expenses || expenses.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma despesa cadastrada
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parcelas Pendentes */}
      {viewMode === "pending" && (
        <Card>
          <CardHeader>
            <CardTitle>Parcelas Pendentes</CardTitle>
            <CardDescription>Parcelas aguardando pagamento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingInstallments?.map((item) => {
                const daysUntilDue = getDaysUntilDue(item.installment.dueDate);
                const isOverdue = daysUntilDue < 0;
                
                return (
                  <div key={item.installment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{item.expense?.description}</h3>
                        {getStatusBadge(item.installment.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.category?.name} • Parcela {item.installment.installmentNumber}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Vencimento: {formatDate(item.installment.dueDate)}
                        {isOverdue ? (
                          <span className="text-red-600 font-semibold ml-2">
                            (Vencido há {Math.abs(daysUntilDue)} dias)
                          </span>
                        ) : (
                          <span className="ml-2">
                            (Vence em {daysUntilDue} dias)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className="text-lg font-bold">{formatCurrency(item.installment.amount)}</p>
                      </div>
                      <Button onClick={() => openPaymentDialog(item)}>
                        Pagar
                      </Button>
                    </div>
                  </div>
                );
              })}
              {(!pendingInstallments || pendingInstallments.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma parcela pendente
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog: Nova Despesa */}
      <Dialog open={showNewExpenseDialog} onOpenChange={setShowNewExpenseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Despesa Operacional</DialogTitle>
            <DialogDescription>
              Cadastre uma nova despesa da empresa
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoryId">Categoria *</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierId">Fornecedor (opcional)</Label>
                <Select
                  value={formData.supplierId}
                  onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Aluguel do mês de outubro"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalAmount">Valor Total *</Label>
                <Input
                  id="totalAmount"
                  type="number"
                  step="0.01"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstDueDate">Data de Vencimento *</Label>
                <Input
                  id="firstDueDate"
                  type="date"
                  value={formData.firstDueDate}
                  onChange={(e) => setFormData({ ...formData, firstDueDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Pagamento</Label>
              <RadioGroup
                value={formData.paymentType}
                onValueChange={(value: "AVISTA" | "PARCELADO") => 
                  setFormData({ ...formData, paymentType: value, installments: value === 'AVISTA' ? '1' : formData.installments })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="AVISTA" id="avista" />
                  <Label htmlFor="avista">À Vista</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PARCELADO" id="parcelado" />
                  <Label htmlFor="parcelado">Parcelado</Label>
                </div>
              </RadioGroup>
            </div>

            {formData.paymentType === 'PARCELADO' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="installments">Número de Parcelas</Label>
                  <Input
                    id="installments"
                    type="number"
                    min="2"
                    max="60"
                    value={formData.installments}
                    onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDay">Dia do Vencimento (1-31)</Label>
                  <Input
                    id="dueDay"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dueDay}
                    onChange={(e) => setFormData({ ...formData, dueDay: e.target.value })}
                    placeholder="Ex: 10"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Informações adicionais..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewExpenseDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createExpense.isPending}>
                {createExpense.isPending ? "Salvando..." : "Salvar Despesa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar Pagamento */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              {selectedInstallment?.expense?.description} - Parcela {selectedInstallment?.installment?.installmentNumber}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Valor da Parcela</Label>
              <p className="text-2xl font-bold">{formatCurrency(selectedInstallment?.installment?.amount || 0)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Data do Pagamento *</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentData.paymentDate}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Valor Pago *</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  value={paymentData.paymentAmount}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentAmount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
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
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentNotes">Observações</Label>
              <Textarea
                id="paymentNotes"
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                placeholder="Informações adicionais sobre o pagamento..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={payInstallment.isPending}>
                {payInstallment.isPending ? "Registrando..." : "Confirmar Pagamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

