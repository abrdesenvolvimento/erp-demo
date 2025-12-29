import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AdjustStockModalProps {
  productId: number;
  productName: string;
  currentStock: number;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AdjustStockModal({
  productId,
  productName,
  currentStock,
  open,
  onClose,
  onSuccess,
}: AdjustStockModalProps) {
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const utils = trpc.useUtils();

  const adjustMutation = trpc.products.adjustStock.useMutation({
    onSuccess: (data) => {
      toast.success(`Estoque ajustado com sucesso! Novo estoque: ${data.newStock}`);
      utils.products.list.invalidate();
      utils.products.get.invalidate({ id: productId });
      utils.products.getMovements.invalidate({ productId });
      onSuccess?.();
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao ajustar estoque");
    },
  });

  const handleClose = () => {
    setQuantity("");
    setReason("");
    setNotes("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty === 0) {
      toast.error("Quantidade inválida");
      return;
    }

    if (!reason.trim()) {
      toast.error("Justificativa é obrigatória");
      return;
    }

    const newStock = currentStock + qty;
    if (newStock < 0) {
      toast.error(`Estoque não pode ficar negativo. Estoque atual: ${currentStock}`);
      return;
    }

    adjustMutation.mutate({
      productId,
      quantity: qty,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    });
  };

  const previewNewStock = () => {
    const qty = parseFloat(quantity);
    if (isNaN(qty)) return currentStock;
    return currentStock + qty;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Acerto Manual de Estoque</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Produto</Label>
            <p className="text-sm text-muted-foreground mt-1">{productName}</p>
          </div>

          <div>
            <Label className="text-sm font-medium">Estoque Atual</Label>
            <p className="text-lg font-semibold mt-1">{currentStock}</p>
          </div>

          <div>
            <Label htmlFor="quantity">
              Quantidade <span className="text-red-500">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              step="0.001"
              placeholder="Ex: 10 (entrada) ou -5 (saída)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use valores positivos para entrada e negativos para saída
            </p>
          </div>

          {quantity && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">
                Novo Estoque: <span className="text-lg">{previewNewStock()}</span>
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="reason">
              Justificativa <span className="text-red-500">*</span>
            </Label>
            <Input
              id="reason"
              type="text"
              placeholder="Ex: Inventário físico, Correção de erro"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Informações adicionais sobre o ajuste"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={adjustMutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={adjustMutation.isPending}>
              {adjustMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar Acerto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
