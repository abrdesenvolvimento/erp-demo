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
  };
  onPaymentSuccess?: () => void;
}

export function CalendarPayButton({ item, onPaymentSuccess }: CalendarPayButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const amount = typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount;
  
  const [paymentForm, setPaymentForm] = useState({
    paidDate: new Date().toISOString().split('T')[0],
    paidAmount: amount.toString(),
    additionalAmount: "",
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
    const additionalAmount = paymentForm.additionalAmount ? parseFloat(paymentForm.additionalAmount) : 0;

    if (isNaN(paidAmount) || paidAmount <= 0) {
      toast.error("Valor pago inválido");
      return;
    }

    payInstallmentMutation.mutate({
      installmentId: item.installmentId,
      type: 'purchase' as const,
      paidDate: new Date(paymentForm.paidDate),
      paidAmount: (paidAmount + additionalAmount).toString(),
      paymentMethod: paymentForm.paymentMethod,
      notes: paymentForm.notes,
    });
  };

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
                Valor Pago
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
              <Label htmlFor="additionalAmount" className="text-right">
                Juros/Multa
              </Label>
              <Input
                id="additionalAmount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentForm.additionalAmount}
                onChange={(e) => setPaymentForm({ ...paymentForm, additionalAmount: e.target.value })}
                className="col-span-3"
              />
            </div>
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
