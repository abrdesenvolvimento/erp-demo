import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { DollarSign, User, ChevronRight, ArrowLeft, ChevronLeft, Calendar } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";

// Função para determinar cor baseado no vencimento
function getDueDateColor(dueDate: Date | string, status: string): string {
  if (status === 'PAGO' || status === 'PAID') return 'text-green-600';
  
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'text-red-600 font-bold'; // Vencido
  if (diffDays <= 7) return 'text-orange-600 font-semibold'; // Vence em 7 dias
  return 'text-gray-900'; // Normal
}

export default function ContasPagar() {
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [selectedInstallment, setSelectedInstallment] = useState<any | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchSupplier, setSearchSupplier] = useState("");
  
  // Estados do calendário
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "amount">("amount");
  const [historyFilters, setHistoryFilters] = useState({
    supplierId: "",
    startDate: "",
    endDate: "",
    docNumber: "",
    paymentMethod: ""
  });
  const [paymentForm, setPaymentForm] = useState({
    paidDate: new Date().toISOString().split('T')[0],
    paidAmount: "",
    additionalAmount: "",
    paymentMethod: "",
    notes: ""
  });
  
  // Ler parâmetro supplier da URL ao carregar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const supplierParam = params.get('supplier');
    if (supplierParam) {
      setSelectedSupplierId(parseInt(supplierParam));
    }
  }, []);

  // Queries
  const { data: totalPending, refetch: refetchTotal } = trpc.payables.totalPending.useQuery();
  const { data: suppliers, refetch: refetchSuppliers } = trpc.payables.bySupplier.useQuery();
  const { data: supplierDetail, refetch: refetchDetail } = trpc.payables.supplierDetail.useQuery(
    { supplierId: selectedSupplierId! },
    { enabled: !!selectedSupplierId }
  );

  // Query para calendário de contas a pagar
  const { data: calendarData } = trpc.payables.calendar.useQuery({
    year: calendarYear,
    month: calendarMonth,
  });

  // Query para histórico de pagamentos
  const { data: paymentHistory, refetch: refetchHistory } = trpc.payables.paymentHistory.useQuery(
    {
      supplierId: historyFilters.supplierId && historyFilters.supplierId !== "0" ? parseInt(historyFilters.supplierId) : undefined,
      startDate: historyFilters.startDate || undefined,
      endDate: historyFilters.endDate || undefined,
      docNumber: historyFilters.docNumber || undefined,
      paymentMethod: historyFilters.paymentMethod && historyFilters.paymentMethod !== "all" ? historyFilters.paymentMethod : undefined,
    },
    { enabled: showHistory }
  );

  // Mutation para pagamento individual de parcela
  const payInstallment = trpc.payables.payInstallment.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado com sucesso!");
      setShowPaymentModal(false);
      setSelectedInstallment(null);
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

  const handleOpenPaymentModal = (installment: any) => {
    setSelectedInstallment(installment);
    setPaymentForm({
      paidDate: new Date().toISOString().split('T')[0],
      paidAmount: installment.pendingAmount,
      additionalAmount: "",
      paymentMethod: "",
      notes: ""
    });
    setShowPaymentModal(true);
  };
  
  const handleOpenPaymentDetails = (installment: any) => {
    setSelectedInstallment(installment);
    setShowPaymentDetailsModal(true);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInstallment) {
      toast.error("Parcela não selecionada");
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
    
    // Criar data explicitamente em horário de Brasília (meio-dia) para evitar problemas de timezone
    const [year, month, day] = paymentForm.paidDate.split('-');
    const paidDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
    
    payInstallment.mutate({
      installmentId: selectedInstallment.id,
      type: selectedInstallment.type || 'expense',
      paidDate,
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

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });
  };

  // Se um cliente está selecionado, mostra o detalhamento
  if (selectedSupplierId && supplierDetail && supplierDetail.supplier) {
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

        {/* Informações do Fornecedor */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Fornecedor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{supplierDetail.supplier.name}</p>
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
            <CardTitle>Compras A Prazo</CardTitle>
            <CardDescription>Histórico de compras do fornecedor</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Despesa</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(supplierDetail.expenses || []).map((expense) => (
                  <TableRow key={`${expense.type}-${expense.id}`}>
                    <TableCell className="font-medium">#{expense.id}</TableCell>
                    <TableCell>{formatDate(expense.expenseDate!)}</TableCell>
                    <TableCell className="font-medium">
                      {expense.dueDate ? (
                        <span className={getDueDateColor(expense.dueDate, expense.status)}>
                          {formatDate(expense.dueDate)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{expense.description || '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        expense.origin === 'Compra' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {expense.origin || 'Despesa'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {expense.status === 'PAGO' && expense.paidDate ? (
                        <button 
                          onClick={() => handleOpenPaymentDetails(expense)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {formatDate(expense.paidDate)}
                        </button>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(expense.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(expense.paidAmount)}
                    </TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      {formatCurrency(expense.pendingAmount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {parseFloat(expense.pendingAmount) > 0 ? (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleOpenPaymentModal(expense)}
                        >
                          Pagar
                        </Button>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">Pago</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Modal de Registro de Pagamento */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pagamento da Parcela</DialogTitle>
              <DialogDescription>
                {selectedInstallment && (
                  <span>
                    {selectedInstallment.supplierName} - 
                    {selectedInstallment.docNumber ? `Doc: ${selectedInstallment.docNumber}` : `Compra #${selectedInstallment.purchaseOrderId}`} - 
                    Valor: {formatCurrency(selectedInstallment.pendingAmount || selectedInstallment.totalAmount || 0)}
                  </span>
                )}
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Pendente: {selectedInstallment && formatCurrency(selectedInstallment.pendingAmount)}
                  </p>
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
                <Button type="submit" disabled={payInstallment.isPending}>
                  {payInstallment.isPending ? "Registrando..." : "Confirmar Pagamento"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        
        {/* Modal de Detalhes do Pagamento */}
        <Dialog open={showPaymentDetailsModal} onOpenChange={setShowPaymentDetailsModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes do Pagamento</DialogTitle>
            </DialogHeader>
            {selectedInstallment && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p className="font-medium">{selectedInstallment.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Pagamento</p>
                    <p className="font-medium">{formatDate(selectedInstallment.paidDate || selectedInstallment.paymentDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Forma de Pagamento</p>
                    <p className="font-medium">
                      {selectedInstallment.paymentMethod === 'DINHEIRO' ? 'Dinheiro' :
                       selectedInstallment.paymentMethod === 'PIX' ? 'PIX' :
                       selectedInstallment.paymentMethod === 'CARTAO_CREDITO' ? 'Cartão de Crédito' :
                       selectedInstallment.paymentMethod === 'CARTAO_DEBITO' ? 'Cartão de Débito' :
                       selectedInstallment.paymentMethod === 'BOLETO' ? 'Boleto' :
                       selectedInstallment.paymentMethod === 'TRANSFERENCIA' ? 'Transferência' :
                       selectedInstallment.paymentMethod || '-'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                    <p className="font-medium">{formatCurrency(selectedInstallment.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Pago</p>
                    <p className="font-medium text-green-600">{formatCurrency(selectedInstallment.paidAmount || selectedInstallment.paymentAmount)}</p>
                  </div>
                </div>
                {selectedInstallment.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Observações</p>
                    <p className="font-medium">{selectedInstallment.notes}</p>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button onClick={() => setShowPaymentDetailsModal(false)}>
                    Fechar
                  </Button>
                </div>
              </div>
            )}
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

      {/* Calendário de Vencimentos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Calendário de Vencimentos</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (calendarMonth === 1) {
                    setCalendarMonth(12);
                    setCalendarYear(calendarYear - 1);
                  } else {
                    setCalendarMonth(calendarMonth - 1);
                  }
                  setSelectedCalendarDay(null);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium min-w-[140px] text-center">
                {new Date(calendarYear, calendarMonth - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (calendarMonth === 12) {
                    setCalendarMonth(1);
                    setCalendarYear(calendarYear + 1);
                  } else {
                    setCalendarMonth(calendarMonth + 1);
                  }
                  setSelectedCalendarDay(null);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Grid do calendário */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
            {(() => {
              const firstDay = new Date(calendarYear, calendarMonth - 1, 1).getDay();
              const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
              const today = new Date();
              const isCurrentMonth = today.getFullYear() === calendarYear && today.getMonth() + 1 === calendarMonth;
              const todayDay = today.getDate();
              
              const cells = [];
              
              // Dias vazios antes do primeiro dia
              for (let i = 0; i < firstDay; i++) {
                cells.push(<div key={`empty-${i}`} className="h-16" />);
              }
              
              // Dias do mês
              for (let day = 1; day <= daysInMonth; day++) {
                const dayData = calendarData?.find(d => d.day === day);
                const isToday = isCurrentMonth && day === todayDay;
                const isSelected = selectedCalendarDay === day;
                const hasPayables = dayData && dayData.count > 0;
                
                cells.push(
                  <div
                    key={day}
                    onClick={() => hasPayables && setSelectedCalendarDay(isSelected ? null : day)}
                    className={`h-16 p-1 border rounded-md transition-colors ${
                      isToday ? 'border-primary' : 'border-border'
                    } ${
                      isSelected ? 'bg-primary/10 border-primary' : ''
                    } ${
                      hasPayables ? 'cursor-pointer hover:bg-muted' : ''
                    }`}
                  >
                    <div className={`text-sm ${isToday ? 'font-bold text-primary' : ''}`}>
                      {day}
                    </div>
                    {hasPayables && (
                      <div className="mt-1">
                        <div className="text-xs font-semibold text-red-600 truncate">
                          {formatCurrency(dayData.total)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {dayData.count} {dayData.count === 1 ? 'título' : 'títulos'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              
              return cells;
            })()}
          </div>
          
          {/* Detalhes do dia selecionado */}
          {selectedCalendarDay && calendarData && (() => {
            const dayData = calendarData.find(d => d.day === selectedCalendarDay);
            if (!dayData) return null;
            
            return (
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">
                  Vencimentos em {selectedCalendarDay}/{calendarMonth}/{calendarYear}
                </h4>
                <div className="space-y-2">
                  {dayData.items.map((item: any) => (
                    <div
                      key={item.installmentId}
                      className="flex items-center justify-between p-3 bg-muted rounded-md hover:bg-muted/80 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Clicou no título:', item);
                        // Abrir modal de pagamento direto para este título
                        const installmentData = {
                          id: item.installmentId,
                          pendingAmount: item.amount,
                          dueDate: item.dueDate,
                          supplierName: item.supplierName,
                          docNumber: item.docNumber,
                          purchaseOrderId: item.purchaseOrderId,
                          paymentMethod: item.paymentMethod,
                        };
                        console.log('Abrindo modal com:', installmentData);
                        handleOpenPaymentModal(installmentData);
                      }}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.supplierName}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.docNumber ? `Doc: ${item.docNumber}` : `Compra #${item.purchaseOrderId}`}
                        </p>
                        {item.paymentMethod && (
                          <p className={`text-xs font-medium mt-1 ${
                            item.paymentMethod.toLowerCase().includes('crédito') 
                              ? 'text-orange-600' 
                              : 'text-muted-foreground'
                          }`}>
                            {item.paymentMethod}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-red-600">{formatCurrency(item.amount)}</p>
                        <Badge variant={item.status === 'OVERDUE' ? 'destructive' : 'secondary'}>
                          {item.status === 'OVERDUE' ? 'Vencido' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Lista de Fornecedores */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fornecedores com Saldo a Pagar</CardTitle>
              <CardDescription>
                Clique em um fornecedor para ver detalhes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar fornecedor..."
                value={searchSupplier}
                onChange={(e) => setSearchSupplier(e.target.value)}
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
          {!suppliers || suppliers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum fornecedor com saldo devedor
            </p>
          ) : (
            <div className="space-y-2">
              {suppliers
                .filter((s) => 
                  !searchSupplier || 
                  s.supplierName.toLowerCase().includes(searchSupplier.toLowerCase())
                )
                .sort((a, b) => {
                  if (sortBy === "amount") {
                    return parseFloat(b.totalPending) - parseFloat(a.totalPending);
                  }
                  return a.supplierName.localeCompare(b.supplierName);
                })
                .map((supplier) => (
                <div
                  key={supplier.supplierId}
                  onClick={() => setSelectedSupplierId(supplier.supplierId)}
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
      
      {/* Histórico de Pagamentos */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pagamentos</CardTitle>
          <CardDescription>Consulte pagamentos já realizados de todos os fornecedores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="supplierFilter">Fornecedor</Label>
              <Select value={historyFilters.supplierId || ""} onValueChange={(value) => setHistoryFilters({ ...historyFilters, supplierId: value })}>
                <SelectTrigger id="supplierFilter">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Todos</SelectItem>
                  {suppliers?.filter((s: any) => s.supplierId != null).map((s: any) => (
                    <SelectItem key={s.supplierId} value={s.supplierId.toString()}>
                      {s.supplierName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={historyFilters.startDate}
                onChange={(e) => setHistoryFilters({ ...historyFilters, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={historyFilters.endDate}
                onChange={(e) => setHistoryFilters({ ...historyFilters, endDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="docNumber">Número Documento</Label>
              <Input
                id="docNumber"
                type="text"
                placeholder="Ex: 123"
                value={historyFilters.docNumber}
                onChange={(e) => setHistoryFilters({ ...historyFilters, docNumber: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="paymentMethodFilter">Forma Pagamento</Label>
              <Select value={historyFilters.paymentMethod} onValueChange={(value) => setHistoryFilters({ ...historyFilters, paymentMethod: value })}>
                <SelectTrigger id="paymentMethodFilter">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="CARTAO_CREDITO">Cartão de Crédito</SelectItem>
                  <SelectItem value="CARTAO_DEBITO">Cartão de Débito</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button onClick={() => { setShowHistory(true); refetchHistory(); }} className="w-full md:w-auto">
            Buscar Pagamentos
          </Button>
          
          {/* Tabela de Resultados */}
          {showHistory && (
            <div className="mt-4">
              {!paymentHistory || paymentHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum pagamento encontrado com os filtros aplicados
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Data Criação</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Data Pagamento</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Valor Pago</TableHead>
                      <TableHead>Forma Pagamento</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentHistory.map((payment: any) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">#{payment.id}</TableCell>
                        <TableCell>{payment.supplierName}</TableCell>
                        <TableCell>{formatDate(payment.expenseDate)}</TableCell>
                        <TableCell>{formatDate(payment.dueDate)}</TableCell>
                        <TableCell>
                          {formatDate(payment.paidDate)}
                        </TableCell>
                        <TableCell>{payment.description}</TableCell>
                        <TableCell>
                          <Badge variant={payment.origin === 'Compra' ? 'default' : 'secondary'}>
                            {payment.origin}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(payment.totalAmount)}</TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {formatCurrency(payment.paidAmount)}
                        </TableCell>
                        <TableCell>
                          {payment.paymentMethod ? (
                            <Badge variant="outline">
                              {payment.paymentMethod === 'DINHEIRO' ? 'Dinheiro' :
                               payment.paymentMethod === 'PIX' ? 'PIX' :
                               payment.paymentMethod === 'CARTAO_CREDITO' ? 'Cartão Crédito' :
                               payment.paymentMethod === 'CARTAO_DEBITO' ? 'Cartão Débito' :
                               payment.paymentMethod === 'BOLETO' ? 'Boleto' :
                               payment.paymentMethod === 'TRANSFERENCIA' ? 'Transferência' :
                               payment.paymentMethod}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
          
          {!showHistory && (
            <p className="text-center text-muted-foreground py-8">
              Use os filtros acima e clique em "Buscar Pagamentos" para consultar o histórico
            </p>
          )}
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}

