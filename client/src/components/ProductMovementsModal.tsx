import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface ProductMovementsModalProps {
  productId: number;
  productName: string;
  open: boolean;
  onClose: () => void;
}

const movementTypeLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ENTRADA: { label: "Entrada", variant: "default" },
  SAIDA: { label: "Saída", variant: "secondary" },
  PERDA: { label: "Perda", variant: "destructive" },
  ACERTO: { label: "Acerto", variant: "outline" },
  ESTORNO: { label: "Estorno", variant: "outline" },
};

export default function ProductMovementsModal({
  productId,
  productName,
  open,
  onClose,
}: ProductMovementsModalProps) {
  const [limit] = useState(50);

  const { data: movements, isLoading } = trpc.products.getMovements.useQuery(
    { productId, limit },
    { enabled: open }
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Movimentações - {productName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !movements || movements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma movimentação registrada para este produto.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Data/Hora</TableHead>
                  <TableHead className="w-[120px]">Tipo</TableHead>
                  <TableHead className="w-[150px]">Documento</TableHead>
                  <TableHead className="w-[100px] text-right">Quantidade</TableHead>
                  <TableHead className="w-[150px]">Usuário</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => {
                  const typeInfo = movementTypeLabels[movement.type] || { label: movement.type, variant: "outline" as const };
                  const quantity = parseFloat(movement.quantity);
                  const isNegative = quantity < 0;

                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="font-mono text-sm">
                        {new Date(movement.date).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {movement.documentNumber || "-"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          isNegative ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {isNegative ? "" : "+"}{quantity.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {movement.userName || "Sistema"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {movement.notes || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-sm text-muted-foreground text-right">
          Mostrando últimas {movements?.length || 0} movimentações
        </div>
      </DialogContent>
    </Dialog>
  );
}
