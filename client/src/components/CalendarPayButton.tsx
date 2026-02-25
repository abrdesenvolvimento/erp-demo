import { Button } from "@/components/ui/button";
import { useState } from "react";
import { getTodayBR } from "@/lib/dateUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CalendarPayButtonProps {
  item: {
    installmentId: number;
    amount: number | string;
    dueDate: string;
    supplierName: string;
    docNumber: string;
    purchaseOrderId: number;
    paymentMethod: string;
    tipo?: string;
  };
  onPaymentSuccess?: () => void;
}

export function CalendarPayButton({ item, onPaymentSuccess }: CalendarPayButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const amount = typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount;
  
  const [paymentForm, setPaymentForm] = useState({
    paidDate: getTodayBR(),
    paidAmount: amount.toString(),
    interestAmount: "",
    discountAmount: "",
    paymentMethod: item.paymentMethod || "",
    notes: "",
  });

  const utils = trpc.useUtils();
  const payInstallmentMutation = trpc.payables.payInstallment.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado com sucesso!");
      setShowModal(false);
      utils.payables.invalidate();
      onPaymentSuccess?.();
    },
    onError: (error) => {
      toast.error(`Erro ao registrar pagamento: ${error.message}`);
    },
  });

  const handlePayment = () => {
    const paidAmount = parseFloat(paymentForm.paidAmount);
    const interestAmount = paymentForm.interestAmount ? parseFloat(paymentForm.interestAmount) : 0;
    const discountAmount = paymentForm.discountAmount ? parseFloat(paymentForm.discountAmount) : 0;

    if (isNaN(paidAmount) || paidAmount <= 0) {
      toast.error("Valor pago inválido");
      return;
    }

    payInstallmentMutation.mutate({
      installmentId: item.installmentId,
      type: (item.tipo === 'DESPESA' ? 'expense' : 'purchase') as 'purchase' | 'expense',
      paidDate: new Date(paymentForm.paidDate),
      paidAmount: paidAmount.toString(),
      paymentMethod: paymentForm.paymentMethod,
      interestAmount: interestAmount > 0 ? interestAmount.toString() : undefined,
      discountAmount: discountAmount > 0 ? discountAmount.toString() : undefined,
      notes: paymentForm.notes,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const baseAmount = parseFloat(paymentForm.paidAmount) || 0;
  const interestAmount = parseFloat(paymentForm.interestAmount) || 0;
  const discountAmount = parseFloat(paymentForm.discountAmount) || 0;
  const totalEffective = baseAmount + interestAmount - discountAmount;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowModal(true);
        }}
      >
        Pagar
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              {item.supplierName} - Doc: {item.docNumber} - Valor: {formatCurrency(amount)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Data e Valor Base */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cal-paidDate">Data do Pagamento *</Label>
                <Input
                  id="cal-paidDate"
                  type="date"
                  value={paymentForm.paidDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paidDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cal-paidAmount">Valor Base *</Label>
                <Input
                  id="cal-paidAmount"
                  type="number"
                  step="0.01"
                  value={paymentForm.paidAmount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paidAmount: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Pendente: {formatCurrency(amount)}
                </p>
              </div>
            </div>

            {/* Juros e Desconto */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cal-interestAmount">Juros/Multa (+)</Label>
                <Input
                  id="cal-interestAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentForm.interestAmount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, interestAmount: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Valor adicional por atraso</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cal-discountAmount">Desconto (-)</Label>
                <Input
                  id="cal-discountAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentForm.discountAmount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, discountAmount: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Desconto obtido</p>
              </div>
            </div>

            {/* Resumo do pagamento */}
            {(baseAmount > 0 || interestAmount > 0 || discountAmount > 0) && (
              <div className="bg-muted p-3 rounded-md">
                <div className="flex justify-between text-sm">
                  <span>Valor Base:</span>
                  <span>{formatCurrency(baseAmount)}</span>
                </div>
                {interestAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>+ Juros/Multa:</span>
                    <span>{formatCurrency(interestAmount)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>- Desconto:</span>
                    <span>{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="flex justify-between font-medium">
                  <span>Total Efetivo:</span>
                  <span className="text-lg font-bold">{formatCurrency(totalEffective)}</span>
                </div>
              </div>
            )}

            {/* Forma de Pagamento */}
            <div className="space-y-1.5">
              <Label htmlFor="cal-paymentMethod">Forma de Pagamento *</Label>
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

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="cal-notes">Observações</Label>
              <Textarea
                id="cal-notes"
                placeholder="Informações adicionais sobre o pagamento..."
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePayment} disabled={payInstallmentMutation.isPending}>
              {payInstallmentMutation.isPending ? "Processando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
