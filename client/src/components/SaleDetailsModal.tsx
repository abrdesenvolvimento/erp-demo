import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Printer, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SaleDetailsModalProps {
  saleId: number | null;
  open: boolean;
  onClose: () => void;
}

export function SaleDetailsModal({ saleId, open, onClose }: SaleDetailsModalProps) {
  const { data: saleData, isLoading } = trpc.sales.get.useQuery(
    { id: saleId! },
    { enabled: !!saleId && open }
  );

  if (!saleId) return null;

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
            <span>Detalhes da Venda #{saleId}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={isLoading || !saleData}
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
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
              <h3 className="font-semibold mb-3">Itens da Venda</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Produto</th>
                      <th className="text-center p-3">Qtd</th>
                      <th className="text-right p-3">Preço Unit.</th>
                      <th className="text-right p-3">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleData.items?.map((item: any) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{item.productName || 'Produto'}</p>
                            <p className="text-sm text-muted-foreground">ID: {item.productId}</p>
                          </div>
                        </td>
                        <td className="text-center p-3">{item.quantity}</td>
                        <td className="text-right p-3">{formatCurrency(item.unitPrice)}</td>
                        <td className="text-right p-3 font-semibold">{formatCurrency(item.totalPrice)}</td>
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
                <span>{formatCurrency(saleData.subtotal)}</span>
              </div>
              
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
              
              <Separator />
              
              <div className="flex justify-between text-lg font-bold">
                <span>TOTAL:</span>
                <span className="text-primary">{formatCurrency(saleData.finalAmount)}</span>
              </div>
              

            </div>

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
    </Dialog>
  );
}
