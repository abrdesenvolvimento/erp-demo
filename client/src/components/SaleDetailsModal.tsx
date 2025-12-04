import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Printer, X, Edit, Ban, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

interface SaleDetailsModalProps {
  saleId: number | null;
  open: boolean;
  onClose: () => void;
}

export function SaleDetailsModal({ saleId, open, onClose }: SaleDetailsModalProps) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [editedDiscount, setEditedDiscount] = useState("0");
  const [editedSurcharge, setEditedSurcharge] = useState("0");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [newItemQuantity, setNewItemQuantity] = useState(1);

  const { data: products } = trpc.products.list.useQuery();

  const { data: saleData, isLoading } = trpc.sales.get.useQuery(
    { id: saleId! },
    { enabled: !!saleId && open }
  );

  const cancelMutation = trpc.sales.cancel.useMutation({
    onSuccess: () => {
      toast.success("Venda cancelada com sucesso!");
      utils.sales.list.invalidate();
      utils.sales.stats.invalidate();
      setShowCancelDialog(false);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao cancelar venda");
    },
  });

  const updateMutation = trpc.sales.update.useMutation({
    onSuccess: () => {
      toast.success("Venda atualizada com sucesso!");
      utils.sales.list.invalidate();
      utils.sales.stats.invalidate();
      utils.sales.get.invalidate({ id: saleId! });
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar venda");
    },
  });

  if (!saleId) return null;

  // Verificar se venda tem menos de 24h
  const canEditOrCancel = () => {
    if (!saleData?.saleDate) return false;
    const saleDate = new Date(saleData.saleDate);
    const now = new Date();
    const hoursDiff = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 24 && saleData.status !== "CANCELLED";
  };

  const handleCancelSale = () => {
    if (!saleId) return;
    cancelMutation.mutate({ id: saleId, reason: cancellationReason || undefined });
  };

  const handleStartEdit = () => {
    if (!saleData) return;
    setEditedItems(saleData.items || []);
    setEditedDiscount(saleData.discountAmount?.toString() || "0");
    setEditedSurcharge(saleData.surchargeAmount?.toString() || "0");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedItems([]);
    setEditedDiscount("0");
    setEditedSurcharge("0");
  };

  const handleSaveEdit = () => {
    if (!saleId || editedItems.length === 0) {
      toast.error("A venda deve ter pelo menos um item");
      return;
    }

    const discount = parseFloat(editedDiscount || '0');
    const surcharge = parseFloat(editedSurcharge || '0');

    updateMutation.mutate({
      saleId: saleId,
      items: editedItems.map(item => {
        const unitPrice = parseFloat(item.unitPrice);
        const totalPrice = unitPrice * item.quantity;
        return {
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: unitPrice.toFixed(2),
          totalPrice: totalPrice.toFixed(2),
        };
      }),
      discountAmount: discount > 0 ? discount.toFixed(2) : undefined,
      surchargeAmount: surcharge > 0 ? surcharge.toFixed(2) : undefined,
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItemQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) return;
    setEditedItems(prev => prev.map((item, i) => 
      i === index ? { ...item, quantity } : item
    ));
  };

  const handleAddItem = () => {
    if (!selectedProduct || newItemQuantity <= 0) return;

    // Buscar preço do produto para o canal da venda
    if (!saleData?.channelId) {
      toast.error("Canal da venda não identificado");
      return;
    }

    const price = selectedProduct.prices?.find((p: any) => p.channelId === saleData.channelId);
    if (!price) {
      toast.error(`Produto "${selectedProduct.name}" não tem preço configurado para este canal`);
      return;
    }

    // Verificar se produto já existe na lista
    const existingIndex = editedItems.findIndex(item => item.productId === selectedProduct.id);
    
    if (existingIndex >= 0) {
      // Se já existe, aumentar quantidade
      setEditedItems(prev => prev.map((item, i) => 
        i === existingIndex ? { ...item, quantity: item.quantity + newItemQuantity } : item
      ));
      toast.success(`Quantidade de "${selectedProduct.name}" atualizada`);
    } else {
      // Se não existe, adicionar novo item
      const newItem = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: newItemQuantity,
        unitPrice: price.price,
      };
      setEditedItems(prev => [...prev, newItem]);
      toast.success(`"${selectedProduct.name}" adicionado à venda`);
    }

    // Limpar seleção
    setProductSearch("");
    setSelectedProduct(null);
    setNewItemQuantity(1);
  };

  const filteredProducts = products?.filter(p => 
    p.active && 
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 5) || [];

  const formatDate = (date: string | Date | null) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value: string | number | null) => {
    if (!value) return 'R$ 0,00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num);
  };

  const getSaleTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'BALCAO': 'Balcão',
      'DELIVERY': 'Delivery',
      'A_PRAZO': 'A Prazo'
    };
    return types[type] || type;
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      'DINHEIRO': 'Dinheiro',
      'DEBITO': 'Débito',
      'CREDITO': 'Crédito',
      'PIX': 'PIX',
      'FIADO': 'Fiado'
    };
    return methods[method] || method;
  };

  const handlePrint = () => {
    if (!saleData) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Comprovante de Venda #${saleData.id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { font-size: 14px; color: #666; }
          .info { margin-bottom: 30px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
          .items { margin-bottom: 30px; }
          .items table { width: 100%; border-collapse: collapse; }
          .items th { text-align: left; border-bottom: 2px solid #333; padding: 10px; font-size: 14px; }
          .items td { padding: 10px; border-bottom: 1px solid #ddd; }
          .totals { border-top: 2px solid #333; padding-top: 20px; }
          .totals-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 16px; }
          .totals-row.final { font-weight: bold; font-size: 20px; margin-top: 15px; }
          .footer { text-align: center; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; color: #666; }
          @media print {
            body { padding: 20px; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo-adega.png" alt="Adega Beira Rio" style="max-width: 150px; margin: 0 auto 10px; display: block;">
          <h1>Adega Beira Rio</h1>
          <p>Comprovante de Venda</p>
        </div>
        
        <div class="info">
          <div class="info-row">
            <span><strong>Venda:</strong> #${saleData.id}</span>
            <span><strong>Tipo:</strong> ${getSaleTypeLabel(saleData.saleType)}</span>
          </div>
          <div class="info-row">
            <span><strong>Data:</strong> ${formatDate(saleData.saleDate)}</span>
          </div>
          ${saleData.customerId ? `<div class="info-row"><span><strong>Cliente ID:</strong> ${saleData.customerId}</span></div>` : ''}
        </div>
        
        <div class="items">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th style="text-align: center;">Qtd</th>
                <th style="text-align: right;">Unit.</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${saleData.items?.map((item: any) => `
                <tr>
                  <td>${item.productName || 'Produto'}</td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: right;">${formatCurrency(item.unitPrice)}</td>
                  <td style="text-align: right;">${formatCurrency(item.totalPrice)}</td>
                </tr>
              `).join('') || ''}
            </tbody>
          </table>
        </div>
        
        <div class="totals">
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>${formatCurrency(saleData.subtotal)}</span>
          </div>
          ${parseFloat(saleData.discountAmount || '0') > 0 ? `
            <div class="totals-row">
              <span>Desconto:</span>
              <span>- ${formatCurrency(saleData.discountAmount)}</span>
            </div>
          ` : ''}
          ${parseFloat(saleData.surchargeAmount || '0') > 0 ? `
            <div class="totals-row">
              <span>Acréscimo:</span>
              <span>+ ${formatCurrency(saleData.surchargeAmount)}</span>
            </div>
          ` : ''}
          <div class="totals-row final">
            <span>TOTAL:</span>
            <span>${formatCurrency(saleData.finalAmount)}</span>
          </div>
          <div class="totals-row" style="margin-top: 10px;">
            <span>Pagamento:</span>
            <span>${getPaymentMethodLabel(saleData.paymentMethod || 'N/A')}</span>
          </div>

        </div>
        
        ${saleData.notes ? `
          <div style="margin-top: 15px; font-size: 11px;">
            <strong>Observações:</strong><br>
            ${saleData.notes}
          </div>
        ` : ''}
        
        <div class="footer">
          <p>Obrigado pela preferência!</p>
          <p>${new Date().toLocaleString('pt-BR')}</p>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">
            Imprimir
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span>Detalhes da Venda #{saleId}</span>
              {saleData?.status === "CANCELLED" && (
                <Badge variant="destructive" className="text-xs">
                  CANCELADO
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {user?.role === "admin" && canEditOrCancel() && !isEditing && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartEdit}
                    disabled={isLoading || !saleData}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowCancelDialog(true)}
                    disabled={isLoading || !saleData || cancelMutation.isPending}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                </>
              )}
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  disabled={isLoading || !saleData}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {!isLoading && saleData && (
          <div className="space-y-6">
            {/* Cabeçalho */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Tipo de Venda</p>
                <p className="font-semibold">{getSaleTypeLabel(saleData.saleType)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data/Hora</p>
                <p className="font-semibold">{formatDate(saleData.saleDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pagamento</p>
                <p className="font-semibold">{getPaymentMethodLabel(saleData.paymentMethod || 'N/A')}</p>
              </div>
              {saleData.customerId && (
                <div>
                  <p className="text-sm text-muted-foreground">Cliente ID</p>
                  <p className="font-semibold">{saleData.customerId}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Itens */}
            <div>
              <h3 className="font-semibold mb-3">{isEditing ? "Editar Itens" : "Itens da Venda"}</h3>
              
              {/* Campo de busca para adicionar produtos (modo edição) */}
              {isEditing && (
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <h4 className="text-sm font-medium mb-3">Adicionar Produto</h4>
                  <div className="flex gap-2">
                    {/* Campo de busca com autocomplete */}
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Buscar produto por nome ou EAN..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setSelectedProduct(null);
                        }}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                      {productSearch && filteredProducts.length > 0 && !selectedProduct && (
                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {filteredProducts.map((product) => {
                            const price = product.prices?.find((p: any) => p.channelId === saleData?.channelId);
                            return (
                              <div
                                key={product.id}
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setProductSearch(product.name);
                                }}
                                className="px-3 py-2 hover:bg-muted cursor-pointer"
                              >
                                <div className="font-medium">{product.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  Estoque: {product.currentStock} | Preço: {price ? formatCurrency(price.price) : 'N/D'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {/* Campo de quantidade com indicador de estoque */}
                    <div className="flex flex-col gap-1">
                      <input
                        type="number"
                        min="1"
                        value={newItemQuantity}
                        onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                        placeholder="Qtd"
                        className="w-20 px-2 py-2 border rounded-md text-center"
                      />
                      {selectedProduct && (
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          Disp: {selectedProduct.currentStock}
                          {newItemQuantity > selectedProduct.currentStock && (
                            <span className="text-destructive ml-1">⚠️</span>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Botão + */}
                    <Button
                      onClick={handleAddItem}
                      disabled={!selectedProduct}
                      size="icon"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Produto</th>
                      <th className="text-center p-3">Qtd</th>
                      <th className="text-right p-3">Preço Unit.</th>
                      <th className="text-right p-3">Subtotal</th>
                      {isEditing && <th className="text-center p-3">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditing ? editedItems : saleData.items)?.map((item: any, index: number) => (
                      <tr key={item.id || index} className="border-t">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{item.productName || 'Produto'}</p>
                            <p className="text-sm text-muted-foreground">ID: {item.productId}</p>
                          </div>
                        </td>
                        <td className="text-center p-3">
                          {isEditing ? (
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItemQuantity(index, parseInt(e.target.value) || 1)}
                              className="w-16 px-2 py-1 text-center border rounded"
                            />
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td className="text-right p-3">{formatCurrency(item.unitPrice)}</td>
                        <td className="text-right p-3 font-semibold">
                          {formatCurrency(parseFloat(item.unitPrice) * item.quantity)}
                        </td>
                        {isEditing && (
                          <td className="text-center p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                              disabled={editedItems.length === 1}
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Separator />

            {/* Totais */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>
                  {isEditing
                    ? formatCurrency(editedItems.reduce((sum, item) => sum + (parseFloat(item.unitPrice) * item.quantity), 0))
                    : formatCurrency(saleData.subtotal)
                  }
                </span>
              </div>
              
              {/* Campos de Desconto e Acréscimo (editáveis no modo edição) */}
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Desconto:</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editedDiscount}
                      onChange={(e) => setEditedDiscount(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-right"
                      placeholder="0,00"
                    />
                    {parseFloat(editedDiscount) > 0 && (
                      <div className="text-sm text-red-600 text-right">
                        - {formatCurrency(editedDiscount)}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Acréscimo:</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editedSurcharge}
                      onChange={(e) => setEditedSurcharge(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-right"
                      placeholder="0,00"
                    />
                    {parseFloat(editedSurcharge) > 0 && (
                      <div className="text-sm text-green-600 text-right">
                        + {formatCurrency(editedSurcharge)}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {parseFloat(saleData.discountAmount || '0') > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Desconto:</span>
                      <span>- {formatCurrency(saleData.discountAmount)}</span>
                    </div>
                  )}
                  
                  {parseFloat(saleData.surchargeAmount || '0') > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Acréscimo:</span>
                      <span>+ {formatCurrency(saleData.surchargeAmount)}</span>
                    </div>
                  )}
                </>
              )}
              
              <Separator />
              
              <div className="flex justify-between text-lg font-bold">
                <span>TOTAL:</span>
                <span className="text-primary">
                  {isEditing 
                    ? formatCurrency(
                        editedItems.reduce((sum, item) => sum + (parseFloat(item.unitPrice) * item.quantity), 0)
                        - parseFloat(editedDiscount || '0')
                        + parseFloat(editedSurcharge || '0')
                      )
                    : formatCurrency(saleData.finalAmount)
                  }
                </span>
              </div>
            </div>

            {/* Botões de edição */}
            {isEditing && (
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={updateMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateMutation.isPending || editedItems.length === 0}
                >
                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            )}

            {saleData.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Observações</h3>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {saleData.notes}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {!isLoading && !saleData && (
          <div className="text-center py-8 text-muted-foreground">
            Venda não encontrada
          </div>
        )}
      </DialogContent>

      {/* Dialog de confirmação de cancelamento */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Venda #{saleId}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá cancelar a venda e reverter o estoque dos produtos. Esta operação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <label className="text-sm font-medium mb-2 block">Motivo do Cancelamento (opcional)</label>
            <Textarea
              placeholder="Descreva o motivo do cancelamento..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancellationReason("")}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSale}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
