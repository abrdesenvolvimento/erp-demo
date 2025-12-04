import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, DollarSign } from "lucide-react";

import { getTodayInBrazil, getNowInBrazil, formatDateBR, formatDateTimeBR } from "@shared/dateUtils";
import { toast } from "sonner";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export default function ContasReceberNovo() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Buscar lista de clientes com saldo
  const { data: customers, isLoading: loadingCustomers, refetch: refetchCustomers } = 
    trpc.accountReceivable.customers.useQuery();

  // Buscar histórico do cliente selecionado
  const { data: history, isLoading: loadingHistory, refetch: refetchHistory } = 
    trpc.accountReceivable.history.useQuery(
      { customerId: selectedCustomerId! },
      { enabled: selectedCustomerId !== null }
    );

  // Mutation para registrar pagamento
  const registerPayment = trpc.accountReceivable.registerPayment.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado com sucesso!");
      setShowPaymentModal(false);
      refetchCustomers();
      refetchHistory();
      resetForm();
    },
    onError: (error) => {
      toast.error(`Erro ao registrar pagamento: ${error.message}`);
    }
  });

  // Form state
  const [formData, setFormData] = useState({
    paidDate: getTodayInBrazil().toISOString().split('T')[0],
    paidAmount: "",
    paymentMethod: "DINHEIRO",
    notes: ""
  });

  const resetForm = () => {
    setFormData({
      paidDate: getTodayInBrazil().toISOString().split('T')[0],
      paidAmount: "",
      paymentMethod: "DINHEIRO",
      notes: ""
    });
  };

  const handleSubmit = () => {
    if (!selectedCustomerId) return;
    
    if (!formData.paidAmount || parseFloat(formData.paidAmount) <= 0) {
      toast.error("Valor do pagamento deve ser maior que zero");
      return;
    }

    // Se a data selecionada é hoje, usar horário atual; senão usar meio-dia
    const selectedDate = new Date(formData.paidDate + "T00:00:00");
    const today = getTodayInBrazil();
    const isToday = selectedDate.toDateString() === today.toDateString();
    
    registerPayment.mutate({
      customerId: selectedCustomerId,
      paidDate: isToday ? getNowInBrazil() : new Date(formData.paidDate + "T12:00:00"),
      paidAmount: formData.paidAmount,
      paymentMethod: formData.paymentMethod,
      notes: formData.notes || undefined
    });
  };

  // Filtrar clientes
  const filteredCustomers = customers?.filter(c => 
    c.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Calcular total a receber
  const totalReceivable = customers?.reduce((sum, c) => sum + parseFloat(c.totalPending || "0"), 0) || 0;

  if (selectedCustomerId && history) {
    // Tela de histórico do cliente
    return (
      <div className="container mx-auto p-6">
        <Button
          variant="ghost"
          onClick={() => setSelectedCustomerId(null)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Conta Corrente - {history.customer.name}</CardTitle>
            <div className="flex justify-between items-center mt-4">
              <div className="flex gap-8">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Devedor</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(parseFloat(history.currentBalance))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Limite de Crédito</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(parseFloat(history.customer.creditLimit || "0"))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Crédito Disponível</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(Math.max(0, parseFloat(history.customer.creditLimit || "0") - parseFloat(history.currentBalance)))}
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowPaymentModal(true)}>
                <DollarSign className="mr-2 h-4 w-4" />
                Registrar Pagamento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Data</th>
                      <th className="text-left p-2">Descrição</th>
                      <th className="text-right p-2">Débito</th>
                      <th className="text-right p-2">Crédito</th>
                      <th className="text-right p-2">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.history.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="p-2">{item.date ? formatDateTimeBR(new Date(item.date)) : '-'}</td>
                        <td className="p-2">
                          {item.description}
                          {item.type === 'PAYMENT' && (item as any).notes && <span className="text-xs text-muted-foreground ml-2">({(item as any).notes})</span>}
                        </td>
                        <td className="p-2 text-right text-red-600">
                          {item.type === 'SALE' ? formatCurrency(parseFloat(item.amount)) : '-'}
                        </td>
                        <td className="p-2 text-right text-green-600">
                          {item.type === 'PAYMENT' ? formatCurrency(parseFloat(item.amount)) : '-'}
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {formatCurrency(parseFloat(item.balance))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modal de Pagamento */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pagamento - {history.customer.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Data do Pagamento</Label>
                <Input
                  type="date"
                  value={formData.paidDate}
                  onChange={(e) => setFormData({ ...formData, paidDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.paidAmount}
                  onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                />
              </div>
              <div>
                <Label>Forma de Pagamento</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="CARTAO_DEBITO">Cartão de Débito</SelectItem>
                    <SelectItem value="CARTAO_CREDITO">Cartão de Crédito</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações (opcional)</Label>
                <Input
                  placeholder="Ex: Pagamento parcial, referente à venda X..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={registerPayment.isPending}>
                  {registerPayment.isPending ? "Salvando..." : "Confirmar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Tela de lista de clientes
  return (
    <div className="container mx-auto p-6">
      {/* Card de Total a Receber */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Pendente a Receber</p>
              <p className="text-3xl font-bold text-orange-600">{formatCurrency(totalReceivable)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {customers?.length || 0} cliente(s) com saldo devedor
              </p>
            </div>
            <DollarSign className="h-12 w-12 text-orange-600 opacity-20" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contas a Receber - Conta Corrente</CardTitle>
          <div className="mt-4">
            <Input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loadingCustomers ? (
            <p>Carregando...</p>
          ) : filteredCustomers.length === 0 ? (
            <p className="text-center text-muted-foreground">Nenhum cliente com saldo devedor</p>
          ) : (
            <div className="space-y-2">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.customerId}
                  onClick={() => setSelectedCustomerId(customer.customerId)}
                  className="flex justify-between items-center p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <div>
                    <p className="font-semibold">{customer.customerName}</p>
                    <p className="text-sm text-muted-foreground">
                      {customer.salesCount} {customer.salesCount === 1 ? 'venda pendente' : 'vendas pendentes'}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(parseFloat(customer.totalPending))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
