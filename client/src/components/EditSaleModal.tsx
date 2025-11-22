import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Trash2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface SaleItem {
  id?: number;
  productId: number;
  productName?: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  _deleted?: boolean;
}

interface EditSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: number;
  initialItems: SaleItem[];
  onSuccess: () => void;
}

export function EditSaleModal({ open, onOpenChange, saleId, initialItems, onSuccess }: EditSaleModalProps) {
  const [items, setItems] = useState<SaleItem[]>(initialItems);
  const [productSearch, setProductSearch] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  const { data: products } = trpc.products.list.useQuery({ 
    search: productSearch,
    activeOnly: true 
  });
  const updateSale = trpc.sales.update.useMutation({
    onSuccess: () => {
      toast.success("Venda atualizada com sucesso!");
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar venda");
    },
  });
  
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems, open]);
  
  const handleQuantityChange = (index: number, quantity: number) => {
    const newItems = [...items];
    const item = newItems[index];
    const unitPrice = parseFloat(item.unitPrice);
    
    newItems[index] = {
      ...item,
      quantity,
      totalPrice: (unitPrice * quantity).toFixed(2),
    };
    
    setItems(newItems);
  };
  
  const handlePriceChange = (index: number, unitPrice: string) => {
    const newItems = [...items];
    const item = newItems[index];
    const price = parseFloat(unitPrice) || 0;
    
    newItems[index] = {
      ...item,
      unitPrice,
      totalPrice: (price * item.quantity).toFixed(2),
    };
    
    setItems(newItems);
  };
  
  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], _deleted: true };
    setItems(newItems);
  };
  
  const handleAddItem = () => {
    if (!selectedProduct) {
      toast.error("Selecione um produto");
      return;
    }
    
    const unitPrice = parseFloat(selectedProduct.avgCost || '0') || 0;
    
    setItems([
      ...items,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: 1,
        unitPrice: unitPrice.toFixed(2),
        totalPrice: unitPrice.toFixed(2),
      },
    ]);
    
    setSelectedProduct(null);
    setProductSearch("");
  };
  
  const handleSave = () => {
    const activeItems = items.filter(item => !item._deleted);
    
    if (activeItems.length === 0) {
      toast.error("A venda deve ter pelo menos um item");
      return;
    }
    
    updateSale.mutate({
      saleId,
      items: items.map(item => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        _deleted: item._deleted,
      })),
    });
  };
  
  const activeItems = items.filter(item => !item._deleted);
  const subtotal = activeItems.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Venda #{saleId}</DialogTitle>
          <DialogDescription>
            Edite os itens da venda. O estoque será ajustado automaticamente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Lista de itens */}
          <div className="space-y-2">
            <Label>Itens da Venda</Label>
            <div className="border rounded-lg divide-y">
              {items.map((item, index) => (
                !item._deleted && (
                  <div key={index} className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-sm text-muted-foreground">ID: {item.productId}</div>
                    </div>
                    
                    <div className="w-24">
                      <Label className="text-xs">Qtd</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                        className="h-8"
                      />
                    </div>
                    
                    <div className="w-32">
                      <Label className="text-xs">Preço Unit.</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => handlePriceChange(index, e.target.value)}
                        className="h-8"
                      />
                    </div>
                    
                    <div className="w-32">
                      <Label className="text-xs">Total</Label>
                      <div className="h-8 flex items-center font-medium">
                        R$ {parseFloat(item.totalPrice).toFixed(2)}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              ))}
            </div>
          </div>
          
          {/* Adicionar novo item */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <Label className="mb-2 block">Adicionar Produto</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  placeholder="Digite para buscar produto..."
                  value={selectedProduct ? selectedProduct.name : productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setSelectedProduct(null);
                  }}
                  className="pr-10"
                />
                {productSearch && !selectedProduct && products && products.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                    {products.map((product: any) => (
                      <div
                        key={product.id}
                        className="px-4 py-2 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => {
                          setSelectedProduct(product);
                          setProductSearch("");
                        }}
                      >
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Estoque: {product.currentStock} | Preço: R$ {parseFloat(product.avgCost || '0').toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleAddItem} size="icon" disabled={!selectedProduct}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Resumo */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-lg font-semibold">
              <span>Subtotal:</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {activeItems.length} {activeItems.length === 1 ? 'item' : 'itens'}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateSale.isPending}>
            {updateSale.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
