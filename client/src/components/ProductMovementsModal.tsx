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
import { Button } from "@/components/ui/button";

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
  const [page, setPage] = useState(1);

  const offset = (page - 1) * limit;

  const { data: movements, isLoading } = trpc.products.getMovements.useQuery(
    { productId, limit, offset },
    { enabled: open }
  );

  const hasNextPage = movements && movements.length === limit;
  const hasPrevPage = page > 1;

  const handleNextPage = () => {
    if (hasNextPage) setPage(page + 1);
  };

  const handlePrevPage = () => {
    if (hasPrevPage) setPage(page - 1);
  };

  // Resetar página ao abrir modal
  const handleClose = () => {
    setPage(1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto">
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
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
                  <TableHead className="whitespace-nowrap">Tipo</TableHead>
                  <TableHead className="whitespace-nowrap">Documento</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Quantidade</TableHead>
                  <TableHead className="whitespace-nowrap">Usuário</TableHead>
                  <TableHead className="min-w-[200px]">Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => {
                  const typeInfo = movementTypeLabels[movement.type] || { label: movement.type, variant: "outline" as const };
                  const quantity = parseFloat(movement.quantity);
                  const isNegative = quantity < 0;

                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="font-mono text-sm whitespace-nowrap">
                        {new Date(movement.date).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {movement.documentNumber || "-"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold whitespace-nowrap ${
                          isNegative ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {isNegative ? "" : "+"}{quantity.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
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

        {/* Controles de Paginação */}
        {!isLoading && movements && movements.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Página {page} • Mostrando {movements.length} movimentações
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={!hasPrevPage}
              >
                ← Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasNextPage}
              >
                Próximo →
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
