import { Button } from "@/components/ui/button";
import { useState } from "react";
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
    paidDate: new Date().toISOString().split('T')[0],
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
          console.log('CalendarPayButton clicado!', item);
          setShowModal(true);
        }}
      >
        Pagar
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              {item.supplierName} - Doc: {item.docNumber} - Valor: R$ {amount.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paidDate" className="text-right">
                Data Pagamento
              </Label>
              <Input
                id="paidDate"
                type="date"
                value={paymentForm.paidDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paidDate: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paidAmount" className="text-right">
                Valor Base
              </Label>
              <Input
                id="paidAmount"
                type="number"
                step="0.01"
                value={paymentForm.paidAmount}
                onChange={(e) => setPaymentForm({ ...paymentForm, paidAmount: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="interestAmount" className="text-right">
                Juros/Multa (+)
              </Label>
              <Input
                id="interestAmount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentForm.interestAmount}
                onChange={(e) => setPaymentForm({ ...paymentForm, interestAmount: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="discountAmount" className="text-right">
                Desconto (-)
              </Label>
              <Input
                id="discountAmount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentForm.discountAmount}
                onChange={(e) => setPaymentForm({ ...paymentForm, discountAmount: e.target.value })}
                className="col-span-3"
              />
            </div>
            
            {/* Resumo do pagamento */}
            {(baseAmount > 0 || interestAmount > 0 || discountAmount > 0) && (
              <div className="col-span-4 bg-muted p-3 rounded-md">
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
                  <span className="text-lg">{formatCurrency(totalEffective)}</span>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paymentMethod" className="text-right">
                Forma Pagamento
              </Label>
              <Input
                id="paymentMethod"
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Observações
              </Label>
              <Input
                id="notes"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="col-span-3"
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
