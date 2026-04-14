import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { Package, Plus, Search, AlertTriangle, Edit, Trash2, Check, X, ChevronsUpDown, History, Settings, Download, Filter } from "lucide-react";
import * as XLSX from 'xlsx';
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { validateEAN } from "@/lib/validators";
import ProductMovementsModal from "@/components/ProductMovementsModal";
import AdjustStockModal from "@/components/AdjustStockModal";
import { getTodayBR } from "@/lib/dateUtils";
import { useCompany } from "@/contexts/CompanyContext";

// Componente para gerenciar composições de produtos
function CompositionsSection({ productId, refreshKey, onSaved }: { productId: number; refreshKey?: number; onSaved?: () => void }) {
  const [compositions, setCompositions] = useState<any[]>([]);
  const [newComposition, setNewComposition] = useState({ childProductId: "", quantity: "" });
  const [productSearch, setProductSearch] = useState("");
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingQuantity, setEditingQuantity] = useState("");
  
  const utils = trpc.useUtils();
  const { data: productsForComposition } = trpc.products.list.useQuery({ activeOnly: true, includePrices: false });
  const { data: compositionsData, refetch } = trpc.products.getCompositions.useQuery(
    { productId },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      staleTime: 0, // Sempre considerar dados como stale
    }
  );
  
  const filteredProducts = productsForComposition?.filter(p => 
    !p.isComposite && 
    p.id !== productId &&
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  ) || [];
  const setCompositionsMutation = trpc.products.setCompositions.useMutation({
    onSuccess: async () => {
      console.log('[setCompositionsMutation] Success! Invalidating and refetching...');
      toast.success("Composições atualizadas!");
      // Invalidar cache E forçar refetch manual
      await utils.products.getCompositions.invalidate({ productId });
      await refetch();
      console.log('[setCompositionsMutation] Refetch completed');
      // Forçar atualização do custo do produto
      await utils.products.list.invalidate();
      // Notificar o componente pai para forçar remontagem
      if (onSaved) {
        console.log('[setCompositionsMutation] Calling onSaved callback');
        onSaved();
      }
    },
    onError: (error) => {
      console.error('[setCompositionsMutation] Error:', error);
      toast.error("Erro ao atualizar composições: " + error.message);
    },
  });
  
  useEffect(() => {
    console.log('[CompositionsSection] useEffect triggered');
    console.log('[CompositionsSection] compositionsData:', compositionsData);
    if (compositionsData) {
      console.log('[CompositionsSection] compositionsData.length:', compositionsData.length);
      const mapped = compositionsData.map((c: any) => {
        console.log('[CompositionsSection] Processing composition:', c);
        return {
          childProductId: c.childProduct?.id,
          quantity: c.quantity,
          childProduct: c.childProduct
        };
      });
      console.log('[CompositionsSection] Mapped compositions:', mapped);
      setCompositions(mapped);
    }
  }, [compositionsData]);
  
  const handleSelectProduct = (product: any) => {
    setNewComposition({ ...newComposition, childProductId: product.id.toString() });
    setProductSearch(product.name);
    setShowProductSuggestions(false);
  };
  
  const handleAddComposition = () => {
    if (!newComposition.childProductId || !newComposition.quantity) {
      toast.error("Selecione um produto e quantidade");
      return;
    }
    
    const product = productsForComposition?.find((p: any) => p.id === parseInt(newComposition.childProductId));
    if (!product) return;
    
    setCompositions([...compositions, {
      childProductId: parseInt(newComposition.childProductId),
      quantity: parseFloat(newComposition.quantity),
      childProduct: product
    }]);
    setNewComposition({ childProductId: "", quantity: "" });
    setProductSearch("");
  };
  
  const handleRemoveComposition = (index: number) => {
    setCompositions(compositions.filter((_, i) => i !== index));
  };
  
  const handleStartEdit = (index: number, currentQuantity: number | string) => {
    setEditingIndex(index);
    setEditingQuantity(currentQuantity.toString());
  };
  
  const handleSaveEdit = (index: number) => {
    const newQuantity = parseFloat(editingQuantity);
    if (isNaN(newQuantity) || newQuantity <= 0) {
      toast.error("Quantidade inválida");
      return;
    }
    
    const updatedCompositions = [...compositions];
    updatedCompositions[index] = {
      ...updatedCompositions[index],
      quantity: newQuantity
    };
    setCompositions(updatedCompositions);
    setEditingIndex(null);
    setEditingQuantity("");
  };
  
  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingQuantity("");
  };
  
  const handleSaveCompositions = () => {
    setCompositionsMutation.mutate({
      productId,
      compositions: compositions.map(c => ({
        childProductId: c.childProductId,
        quantity: c.quantity
      }))
    });
  };
  
  return (
    <div className="grid gap-3 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Composição do Produto</Label>
        <Button size="sm" onClick={handleSaveCompositions} disabled={setCompositionsMutation.isPending}>
          Salvar Composições
        </Button>
      </div>
      
      {/* Lista de composições */}
      {compositions.length > 0 && (
        <div className="space-y-2">
          {compositions.map((comp, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-background rounded border">
              <div className="flex-1 flex items-center gap-2">
                <span className="font-medium">{comp.childProduct?.name}</span>
                {editingIndex === index ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.001"
                      value={editingQuantity}
                      onChange={(e) => setEditingQuantity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(index);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="w-20 h-7"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(index)} className="h-7 w-7 p-0">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 w-7 p-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <span 
                    className="text-sm text-muted-foreground ml-2 cursor-pointer hover:text-primary hover:underline"
                    onClick={() => handleStartEdit(index, comp.quantity)}
                    title="Clique para editar"
                  >
                    x {comp.quantity}
                  </span>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleRemoveComposition(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      
      {/* Adicionar nova composição */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <div className="relative">
          <Input
            placeholder="Digite o nome do produto..."
            value={productSearch}
            onChange={(e) => {
              setProductSearch(e.target.value);
              setShowProductSuggestions(true);
              if (!e.target.value) {
                setNewComposition({ ...newComposition, childProductId: "" });
              }
            }}
            onFocus={() => setShowProductSuggestions(true)}
          />
          {showProductSuggestions && productSearch && filteredProducts.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="px-3 py-2 hover:bg-accent cursor-pointer"
                  onClick={() => handleSelectProduct(product)}
                >
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Estoque: {product.currentStock}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <Input
          type="number"
          placeholder="Qtd"
          value={newComposition.quantity}
          onChange={(e) => setNewComposition({ ...newComposition, quantity: e.target.value })}
          className="w-20"
        />
        
        <Button type="button" size="sm" onClick={handleAddComposition}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Defina quais produtos serão descontados do estoque ao vender este pack.
      </p>
    </div>
  );
}

// Componente para gerenciar composições temporárias (durante criação)
function TempCompositionsSection({ 
  compositions, 
  onCompositionsChange 
}: { 
  compositions: { childProductId: number | string; quantity: number | string; childProduct?: any }[];
  onCompositionsChange: (compositions: { childProductId: number | string; quantity: number | string; childProduct?: any }[]) => void;
}) {
  const [newComposition, setNewComposition] = useState({ childProductId: "", quantity: "" });
  const [productSearch, setProductSearch] = useState("");
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingQuantity, setEditingQuantity] = useState("");
  
  const { data: productsForTemp } = trpc.products.list.useQuery({ activeOnly: true, includePrices: false });
  
  const filteredProducts = productsForTemp?.filter((p: any) => 
    !p.isComposite && 
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  ) || [];
  
  const handleSelectProduct = (product: any) => {
    setNewComposition({ ...newComposition, childProductId: product.id.toString() });
    setProductSearch(product.name);
    setShowProductSuggestions(false);
  };
  
  const handleAddComposition = () => {
    if (!newComposition.childProductId || !newComposition.quantity) {
      toast.error("Selecione um produto e quantidade");
      return;
    }
    
    const product = productsForTemp?.find((p: any) => p.id === parseInt(newComposition.childProductId));
    if (!product) return;
    
    onCompositionsChange([...compositions, {
      childProductId: parseInt(newComposition.childProductId),
      quantity: parseFloat(newComposition.quantity),
      childProduct: product
    }]);
    setNewComposition({ childProductId: "", quantity: "" });
    setProductSearch("");
  };
  
  const handleRemoveComposition = (index: number) => {
    onCompositionsChange(compositions.filter((_, i) => i !== index));
  };
  
  const handleStartEdit = (index: number, currentQuantity: number | string) => {
    setEditingIndex(index);
    setEditingQuantity(currentQuantity.toString());
  };
  
  const handleSaveEdit = (index: number) => {
    const newQuantity = parseFloat(editingQuantity);
    if (isNaN(newQuantity) || newQuantity <= 0) {
      toast.error("Quantidade inválida");
      return;
    }
    
    const updatedCompositions = compositions.map((comp, i) => 
      i === index ? { ...comp, quantity: newQuantity } : comp
    );
    onCompositionsChange(updatedCompositions);
    setEditingIndex(null);
    setEditingQuantity("");
  };
  
  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingQuantity("");
  };
  
  return (
    <div className="grid gap-3 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Composição do Produto</Label>
      </div>
      
      {/* Lista de composições */}
      {compositions.length > 0 && (
        <div className="space-y-2">
          {compositions.map((comp, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-background rounded border">
              <div className="flex-1 flex items-center gap-2">
                <span className="font-medium">{comp.childProduct?.name}</span>
                {editingIndex === index ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.001"
                      value={editingQuantity}
                      onChange={(e) => setEditingQuantity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(index);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="w-20 h-7"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(index)} className="h-7 w-7 p-0">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 w-7 p-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <span 
                    className="text-sm text-muted-foreground ml-2 cursor-pointer hover:text-primary hover:underline"
                    onClick={() => handleStartEdit(index, comp.quantity)}
                    title="Clique para editar"
                  >
                    x {comp.quantity}
                  </span>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleRemoveComposition(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      
      {/* Adicionar nova composição */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <div className="relative">
          <Input
            placeholder="Digite o nome do produto..."
            value={productSearch}
            onChange={(e) => {
              setProductSearch(e.target.value);
              setShowProductSuggestions(true);
              if (!e.target.value) {
                setNewComposition({ ...newComposition, childProductId: "" });
              }
            }}
            onFocus={() => setShowProductSuggestions(true)}
          />
          {showProductSuggestions && productSearch && filteredProducts.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="px-3 py-2 hover:bg-accent cursor-pointer"
                  onClick={() => handleSelectProduct(product)}
                >
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Estoque: {product.currentStock}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <Input
          type="number"
          placeholder="Qtd"
          value={newComposition.quantity}
          onChange={(e) => setNewComposition({ ...newComposition, quantity: e.target.value })}
          className="w-20"
        />
        
        <Button type="button" size="sm" onClick={handleAddComposition}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Defina quais produtos serão descontados do estoque ao vender este pack.
      </p>
    </div>
  );
}

type ProductFormData = {
  name: string;
  categoryId: string;
  subcategoryId: string;
  ean: string;
  uom: string;
  minStock: string;
  currentStock: string;
  avgCost: string;
  isComposite: boolean;
  notes: string;
  prices: { [channelId: string]: string };
  compositions: { childProductId: number | string; quantity: number | string; childProduct?: any }[];
  productionDestination: string;
  availableInSalon: boolean;
};

export default function Produtos() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const isAdmin = permissions.isAdmin;
  const { activeCompany } = useCompany();
  const isHamburgueria = activeCompany?.segment === 'Hamburgueria' || activeCompany?.companyId === 2;
  
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [compositionsKey, setCompositionsKey] = useState(0);
  
  // Filtros de categoria e subcategoria
  const [filterCategoryId, setFilterCategoryId] = useState<string>("");
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Estados para modais de movimentações
  const [movementsModalOpen, setMovementsModalOpen] = useState(false);
  const [adjustStockModalOpen, setAdjustStockModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  const { data: categories } = trpc.categories.list.useQuery();
  const { data: subcategories } = trpc.subcategories.list.useQuery();
  const { data: channels } = trpc.salesChannels.list.useQuery();
  const utils = trpc.useUtils();
  
  // Query principal para listagem (com preços para exportação)
  const { data: products, isLoading, refetch } = trpc.products.list.useQuery({
    search: search || undefined,
    activeOnly: false, // Mostrar todos os produtos (ativos e inativos)
    categoryId: filterCategoryId ? parseInt(filterCategoryId) : undefined,
    subcategoryId: filterSubcategoryId ? parseInt(filterSubcategoryId) : undefined,
    includePrices: true, // Incluir preços para exportação
  });
  
  // Subcategorias filtradas pela categoria selecionada
  const filteredSubcategoriesForFilter = subcategories?.filter(
    (sub: any) => !filterCategoryId || sub.categoryId === parseInt(filterCategoryId)
  ) || [];
  
  // Função para exportar produtos para Excel
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExportExcel = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    toast.info("Carregando dados para exportação...");
    
    try {
      // Buscar produtos com preços usando endpoint específico
      const productsWithPrices = await utils.client.products.exportWithPrices.query();
      
      if (!productsWithPrices || productsWithPrices.length === 0) {
        toast.error("Nenhum produto para exportar");
        setIsExporting(false);
        return;
      }
      
      // Debug: verificar se os preços estão sendo carregados
      console.log('[Export] Total produtos:', productsWithPrices.length);
      console.log('[Export] Primeiro produto:', productsWithPrices[0]);
      console.log('[Export] Preços do primeiro produto:', productsWithPrices[0]?.prices);
      console.log('[Export] Canais disponíveis:', channels);
      
      // IDs dos canais de venda:
      // 1 = Balcão / A Prazo
      // 2 = Delivery iFood
      // 3 = Delivery 99Food
      // 4 = Delivery Próprio
      const BALCAO_APRAZO_ID = 1;
      const DELIVERY_IFOOD_ID = 2;
      const DELIVERY_99FOOD_ID = 3;
      const DELIVERY_PROPRIO_ID = 4;
      
      const exportData = productsWithPrices.map((product: any) => {
        const category = categories?.find(c => c.id === product.categoryId);
        const subcategory = subcategories?.find((s: any) => s.id === product.subcategoryId);
        
        // Buscar preços por canal usando IDs fixos
        const precoBalcaoAPrazo = product.prices?.find((p: any) => p.channelId === BALCAO_APRAZO_ID)?.price || '';
        const precoDelivery99Food = product.prices?.find((p: any) => p.channelId === DELIVERY_99FOOD_ID)?.price || '';
        const precoDeliveryProprio = product.prices?.find((p: any) => p.channelId === DELIVERY_PROPRIO_ID)?.price || '';
        const precoDeliveryIFood = product.prices?.find((p: any) => p.channelId === DELIVERY_IFOOD_ID)?.price || '';
        
        // Mapear destino de produção para label legível
        const destinoMap: Record<string, string> = {
          'KITCHEN': 'Cozinha',
          'BAR': 'Bar',
          'BOTH': 'Ambos (Cozinha + Bar)',
          'NONE': 'Nenhum',
        };
        
        const baseData: Record<string, any> = {
          'ID': product.id,
          'Nome': product.name,
          'EAN': product.ean || '',
          'Categoria': category?.name || '',
          'Subcategoria': subcategory?.name || '',
          'Unidade': product.uom,
          'Estoque Atual': product.currentStock || 0,
          'Estoque Mínimo': product.minStock || 0,
          'Custo Médio': isAdmin ? parseFloat(product.avgCost || '0').toFixed(2) : '',
          'Preço Balcão/A Prazo': precoBalcaoAPrazo ? parseFloat(precoBalcaoAPrazo).toFixed(2) : '',
          'Preço Delivery 99Food': precoDelivery99Food ? parseFloat(precoDelivery99Food).toFixed(2) : '',
          'Preço Delivery Próprio': precoDeliveryProprio ? parseFloat(precoDeliveryProprio).toFixed(2) : '',
          'Preço Delivery iFood': precoDeliveryIFood ? parseFloat(precoDeliveryIFood).toFixed(2) : '',
          'Tipo': product.isComposite ? 'Composto' : 'Simples',
          'Ativo': product.active ? 'Sim' : 'Não',
        };
        
        // Incluir colunas de salão para empresas com salão ativo
        if (isHamburgueria) {
          baseData['Destino Produção'] = destinoMap[product.productionDestination || 'NONE'] || 'Nenhum';
          baseData['Disponível Salão'] = product.availableInSalon ? 'Sim' : 'Não';
        }
        
        baseData['Observações'] = product.notes || '';
        
        return baseData;
      });
      
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Ajustar largura das colunas
      const baseCols = [
        { wch: 8 },   // ID
        { wch: 40 },  // Nome
        { wch: 15 },  // EAN
        { wch: 20 },  // Categoria
        { wch: 20 },  // Subcategoria
        { wch: 10 },  // Unidade
        { wch: 12 },  // Estoque Atual
        { wch: 12 },  // Estoque Mínimo
        { wch: 12 },  // Custo Médio
        { wch: 18 },  // Preço Balcão/A Prazo
        { wch: 18 },  // Preço Delivery 99Food
        { wch: 18 },  // Preço Delivery Próprio
        { wch: 18 },  // Preço Delivery iFood
        { wch: 10 },  // Tipo
        { wch: 8 },   // Ativo
      ];
      
      // Adicionar colunas de salão se aplicável
      if (isHamburgueria) {
        baseCols.push(
          { wch: 22 },  // Destino Produção
          { wch: 16 },  // Disponível Salão
        );
      }
      
      baseCols.push({ wch: 30 });  // Observações
      
      ws['!cols'] = baseCols;
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
      
      const fileName = `produtos_${getTodayBR()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success(`Exportados ${productsWithPrices.length} produtos para Excel`);
    } catch (error) {
      console.error('[Export] Erro:', error);
      toast.error("Erro ao exportar produtos");
    } finally {
      setIsExporting(false);
    }
  };
  
  const createSubcategory = trpc.subcategories.create.useMutation({
    onSuccess: (data) => {
      toast.success("Subcategoria criada com sucesso!");
      setIsSubcategoryDialogOpen(false);
      utils.subcategories.list.invalidate();
      // Selecionar automaticamente a nova subcategoria
      setFormData({ ...formData, subcategoryId: data.id.toString() });
      // Manter o nome no campo de busca
      setShowSubcategorySuggestions(false);
    },
    onError: (error) => {
      toast.error("Erro ao criar subcategoria: " + error.message);
    },
  });

  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("Produto criado com sucesso!");
      setIsDialogOpen(false);
      setTimeout(() => {
        refetch();
        resetForm();
      }, 150);
    },
    onError: (error) => {
      toast.error("Erro ao criar produto: " + error.message);
    },
  });

  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("Produto atualizado com sucesso!");
      setIsDialogOpen(false);
      setTimeout(() => {
        refetch();
        resetForm();
        setEditingProduct(null);
      }, 150);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar produto: " + error.message);
    },
  });

  const toggleProductStatus = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("Status do produto atualizado!");
      refetch();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar status: " + error.message);
    },
  });

  const handleToggleActive = (product: any) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem ativar/desativar produtos");
      return;
    }
    
    toggleProductStatus.mutate({
      id: product.id,
      data: { active: !product.active }
    });
  };

  const initialFormData: ProductFormData = {
    name: "",
    categoryId: "",
    subcategoryId: "",
    ean: "",
    uom: "UN" as string,
    minStock: "0",
    currentStock: "0",
    avgCost: "0.00",
    isComposite: false,
    notes: "",
    prices: {},
    compositions: [],
    productionDestination: "NONE",
    availableInSalon: false,
  };

  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
  
  // Estados para autocomplete de categoria
  const [categorySearch, setCategorySearch] = useState("");
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  
  // Estados para autocomplete de subcategoria
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [showSubcategorySuggestions, setShowSubcategorySuggestions] = useState(false);

  const resetForm = () => {
    setIsSubmitting(false);
    setFormData(initialFormData);
    setEditingProduct(null);
    setCategorySearch("");
    setSubcategorySearch("");
    setShowCategorySuggestions(false);
    setShowSubcategorySuggestions(false);
  };

  const handleEdit = async (product: any) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
    
    try {
      // Carregar preços por canal
      const productPrices: any = await utils.client.products.getPrices.query({ productId: product.id });
      const pricesData: Record<string, string> = {};
      productPrices.forEach((p: any) => {
        pricesData[p.channelId.toString()] = p.price;
      });
      
      // Carregar composições se for produto composto
      let compositionsData: any[] = [];
      if (product.isComposite) {
        try {
          console.log('[handleEdit] Carregando composições para produto', product.id);
          compositionsData = await utils.client.products.getCompositions.query({ productId: product.id });
          console.log('[handleEdit] Composições carregadas:', compositionsData);
        } catch (error) {
          console.error("Erro ao carregar composições:", error);
        }
      }
      
      const mappedCompositions = compositionsData.map((c: any) => {
        console.log('[handleEdit] Mapeando composição:', c);
        return {
          childProductId: c.childProductId,
          quantity: parseFloat(c.quantity),
          childProduct: c.childProduct
        };
      });
      console.log('[handleEdit] Composições mapeadas:', mappedCompositions);
      console.log('[handleEdit] Exemplo childProduct:', mappedCompositions[0]?.childProduct);
      
      setFormData({
        name: product.name || "",
        categoryId: product.categoryId?.toString() || "",
        subcategoryId: product.subcategoryId?.toString() || "",
        ean: product.ean || "",
        uom: (product.uom || "UN") as string,
        minStock: product.minStock?.toString() || "0",
        currentStock: product.currentStock?.toString() || "0",
        avgCost: product.avgCost || "0.00",
        isComposite: product.isComposite || false,
        notes: product.notes || "",
        prices: pricesData,
        compositions: mappedCompositions,
        productionDestination: product.productionDestination || "NONE",
        availableInSalon: product.availableInSalon ?? false,
      });
      
      // Popular campos de busca
      const category = categories?.find(c => c.id.toString() === product.categoryId?.toString());
      const subcategory = subcategories?.find((s: any) => s.id.toString() === product.subcategoryId?.toString());
      setCategorySearch(category?.name || "");
      setSubcategorySearch(subcategory?.name || "");
    } catch (error: any) {
      console.error("Erro ao carregar dados do produto:", error);
      // Preencher formulário mesmo com erro
      setFormData({
        name: product.name || "",
        categoryId: product.categoryId?.toString() || "",
        subcategoryId: product.subcategoryId?.toString() || "",
        ean: product.ean || "",
        uom: (product.uom || "UN") as string,
        minStock: product.minStock?.toString() || "0",
        currentStock: product.currentStock?.toString() || "0",
        avgCost: product.avgCost || "0.00",
        isComposite: product.isComposite || false,
        notes: product.notes || "",
        prices: {},
        compositions: [],
        productionDestination: product.productionDestination || "NONE",
        availableInSalon: product.availableInSalon ?? false,
      });
    }
  };

  const handleCreateSubcategory = () => {
    if (!subcategorySearch.trim()) {
      toast.error("Digite o nome da subcategoria");
      return;
    }

    if (!formData.categoryId) {
      toast.error("Selecione uma categoria primeiro");
      return;
    }

    createSubcategory.mutate({
      name: subcategorySearch.trim(),
      categoryId: parseInt(formData.categoryId),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) {
      return; // Evita clique duplo
    }
    
    if (!formData.categoryId) {
      toast.error("Selecione uma categoria");
      return;
    }
    
    setIsSubmitting(true);

    console.log('[DEBUG] formData.compositions ANTES do processamento:', formData.compositions);
    
    const compositionsFiltered = formData.compositions
      .filter(c => c.childProductId && (c.quantity !== null && c.quantity !== undefined && c.quantity !== '' && c.quantity !== 0));
    console.log('[DEBUG] Composições após primeiro filtro:', compositionsFiltered);
    
    const compositionsMapped = compositionsFiltered.map(c => {
      const childId = typeof c.childProductId === 'number' ? c.childProductId : parseInt(String(c.childProductId));
      const qty = typeof c.quantity === 'number' ? c.quantity : parseFloat(String(c.quantity));
      return {
        childProductId: childId,
        quantity: qty
      };
    });
    console.log('[DEBUG] Composições após mapeamento:', compositionsMapped);
    
    const compositionsFinal = compositionsMapped.filter(c => !isNaN(c.childProductId) && !isNaN(c.quantity) && c.quantity > 0);
    console.log('[DEBUG] Composições FINAIS (após filtro de NaN):', compositionsFinal);
    
    const productData: any = {
      name: formData.name,
      categoryId: parseInt(formData.categoryId),
      subcategoryId: formData.subcategoryId ? parseInt(formData.subcategoryId) : undefined,
      ean: formData.ean || undefined,
      uom: formData.uom,
      minStock: parseInt(formData.minStock),
      currentStock: parseInt(formData.currentStock),
      avgCost: formData.avgCost,
      isComposite: formData.isComposite,
      notes: formData.notes || undefined,
      prices: formData.prices,
      productionDestination: formData.productionDestination || "NONE",
      availableInSalon: formData.availableInSalon,
    };
    
    // IMPORTANTE: Ao editar, compositions são gerenciadas separadamente pelo CompositionsSection
    // Só incluir compositions ao CRIAR produto (undefined = não atualizar)
    if (!editingProduct) {
      productData.compositions = compositionsFinal;
    }
    
    console.log('[DEBUG] Enviando productData:', productData);
    console.log('[DEBUG] editingProduct:', editingProduct ? 'SIM (compositions ignoradas)' : 'NÃO (compositions incluídas)');

    if (editingProduct) {
      updateProduct.mutate({
        id: editingProduct.id,
        data: productData,
      });
    } else {
      createProduct.mutate(productData);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
            <p className="text-muted-foreground">
              Gerencie o catálogo de produtos
            </p>
          </div>

          <Button 
            onClick={() => {
              resetForm();
              setEditingProduct(null);
              setIsDialogOpen(true);
            }}
            disabled={!permissions.products.canCreate}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (!open) {
              resetForm();
              setEditingProduct(null);
            }
            setIsDialogOpen(open);
          }}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? "Editar Produto" : "Novo Produto"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingProduct
                      ? "Atualize as informações do produto"
                      : "Cadastre um novo produto no sistema"}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* Nome do Produto */}
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome do Produto *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Ex: Cerveja Skol 269ml"
                      required
                      disabled={!permissions.canEdit}
                    />
                  </div>

                  {/* Categoria e Subcategoria */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2 relative">
                      <Label htmlFor="category">Categoria *</Label>
                           <Input
                             id="category"
                             value={categorySearch}
                             onChange={(e) => {
                               setCategorySearch(e.target.value);
                               setShowCategorySuggestions(true);
                             }}
                             placeholder="Selecione uma categoria"
                             disabled={!permissions.canEdit}
                           />
                      {showCategorySuggestions && categorySearch && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                          {categories
                            ?.filter((cat) =>
                              cat.name.toLowerCase().includes(categorySearch.toLowerCase())
                            )
                            .map((cat) => (
                              <div
                                key={cat.id}
                                className="px-3 py-2 hover:bg-accent cursor-pointer"
                                onClick={() => {
                                  setFormData({ ...formData, categoryId: cat.id.toString() });
                                  setCategorySearch(cat.name);
                                  setShowCategorySuggestions(false);
                                }}
                              >
                                {cat.name}
                              </div>
                            ))}
                          {categories?.filter((cat) =>
                            cat.name.toLowerCase().includes(categorySearch.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              Nenhuma categoria encontrada
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2 relative">
                      <Label htmlFor="subcategory">Subcategoria</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="subcategory"
                            value={subcategorySearch}
                            onChange={(e) => {
                              setSubcategorySearch(e.target.value);
                              setShowSubcategorySuggestions(true);
                            }}
                            onFocus={() => setShowSubcategorySuggestions(true)}
                            placeholder="Digite para buscar ou criar subcategoria"
                            disabled={!permissions.canEdit}
                          />
                          {showSubcategorySuggestions && subcategorySearch && formData.categoryId && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                              {subcategories
                                ?.filter((sub: any) =>
                                  sub.name.toLowerCase().includes(subcategorySearch.toLowerCase())
                                )
                                .map((sub: any) => (
                                  <div
                                    key={sub.id}
                                    className="px-3 py-2 hover:bg-accent cursor-pointer"
                                    onClick={() => {
                                      setFormData({ ...formData, subcategoryId: sub.id.toString() });
                                      setSubcategorySearch(sub.name);
                                      setShowSubcategorySuggestions(false);
                                    }}
                                  >
                                    {sub.name}
                                  </div>
                                ))}
                              {subcategories?.filter((sub: any) =>
                                sub.name.toLowerCase().includes(subcategorySearch.toLowerCase())
                              ).length === 0 && (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                  Nenhuma subcategoria encontrada
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <Dialog open={isSubcategoryDialogOpen} onOpenChange={setIsSubcategoryDialogOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm"
                              disabled={
                                !formData.categoryId || 
                                !subcategorySearch.trim() ||
                                (subcategories?.filter((sub: any) =>
                                  sub.name.toLowerCase().includes(subcategorySearch.toLowerCase())
                                ).length ?? 0) > 0
                              }
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Incluir
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Nova Subcategoria</DialogTitle>
                              <DialogDescription>
                                Crie uma nova subcategoria para organizar melhor seus produtos
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label htmlFor="new-subcategory-name">Nome da Subcategoria *</Label>
                                 <Input
                                   id="new-subcategory-name"
                                   placeholder="Ex: Cerveja Artesanal"
                                   value={subcategorySearch}
                                   onChange={(e) => setSubcategorySearch(e.target.value)}
                                   disabled={false}
                                 />
                                <p className="text-sm text-muted-foreground">
                                  Confirme a criação da subcategoria "{subcategorySearch}"
                                </p>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                type="button"
                                onClick={handleCreateSubcategory}
                                disabled={!subcategorySearch.trim()}
                              >
                                Criar Subcategoria
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Selecione a subcategoria do produto</p>
                    </div>
                  </div>

                  {/* EAN e Unidade */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="ean">Código EAN/Barras</Label>
                      <Input
                        id="ean"
                        value={formData.ean}
                        onChange={(e) =>
                          setFormData({ ...formData, ean: e.target.value })
                        }
                        onBlur={(e) => {
                          const ean = e.target.value.trim();
                          if (ean && !validateEAN(ean)) {
                            toast.error("EAN inválido. Deve ter 8, 13 ou 14 dígitos válidos.");
                          }
                        }}
                        placeholder="7891234567890"
                        maxLength={14}
                        className={formData.ean && !validateEAN(formData.ean) ? "border-destructive" : ""}
                        disabled={!permissions.canEdit}
                      />
                      {formData.ean && !validateEAN(formData.ean) && (
                        <p className="text-xs text-destructive">
                          EAN inválido. Verifique o código de barras.
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="uom">Unidade de Medida *</Label>
                      <Select
                        value={formData.uom || "UN"}
                        onValueChange={(value) =>
                          setFormData({ ...formData, uom: value })
                        }
                        disabled={!permissions.canEdit}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={5}>
                          <SelectItem value="UN">Unidade (UN)</SelectItem>
                          <SelectItem value="CX">Caixa (CX)</SelectItem>
                          <SelectItem value="KG">Quilograma (KG)</SelectItem>
                          <SelectItem value="L">Litro (L)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Estoque */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="currentStock">Estoque Atual</Label>
                      <Input
                        id="currentStock"
                        type="number"
                        step="0.001"
                        value={formData.currentStock}
                        onChange={(e) =>
                          setFormData({ ...formData, currentStock: e.target.value })
                        }
                        disabled={true}
                        className="bg-muted cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        🔒 Estoque alterado apenas via Compras, Vendas, Perdas ou Acerto Manual
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="minStock">Estoque Mínimo</Label>
                      <Input
                        id="minStock"
                        type="number"
                        step="0.001"
                        value={formData.minStock}
                        onChange={(e) =>
                          setFormData({ ...formData, minStock: e.target.value })
                        }
                        disabled={!permissions.canEdit}
                      />
                    </div>

                    {isAdmin && (
                      <div className="grid gap-2">
                        <Label htmlFor="avgCost">Custo Médio (R$)</Label>
                        <Input
                          id="avgCost"
                          type="number"
                          step="0.01"
                          value={formData.avgCost}
                          onChange={(e) =>
                            setFormData({ ...formData, avgCost: e.target.value })
                          }
                        />
                      </div>
                    )}
                  </div>

                  {/* Preços por Canal */}
                  <div className="grid gap-2">
                    <Label>Preços por Canal de Venda</Label>
                    <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg">
                      {channels?.map((channel) => (
                        <div key={channel.id} className="grid gap-1.5">
                          <Label htmlFor={`price-${channel.id}`} className="text-sm">
                            {channel.name}
                          </Label>
                          <Input
                            id={`price-${channel.id}`}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.prices[channel.id] || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                prices: {
                                  ...formData.prices,
                                  [channel.id]: e.target.value,
                                },
                              })
                            }
                            disabled={!permissions.canEdit}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Produto Composto */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isComposite"
                      checked={formData.isComposite}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isComposite: checked as boolean })
                      }
                      disabled={!permissions.canEdit}
                    />
                    <Label
                      htmlFor="isComposite"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Produto Composto (Pack/Caixa)
                    </Label>
                  </div>

                  {/* Composições */}
                  {formData.isComposite && (
                    editingProduct ? (
                      <CompositionsSection 
                        key={`compositions-${editingProduct.id}-${compositionsKey}`}
                        productId={editingProduct.id} 
                        refreshKey={compositionsKey}
                        onSaved={() => {
                          console.log('[Produtos] onSaved called, incrementing compositionsKey');
                          setCompositionsKey(prev => prev + 1);
                        }}
                      />
                    ) : (
                      <TempCompositionsSection 
                        compositions={formData.compositions}
                        onCompositionsChange={(compositions) => {
                          console.log('[DEBUG] onCompositionsChange called with:', compositions);
                          setFormData({ ...formData, compositions });
                          console.log('[DEBUG] formData.compositions updated to:', compositions);
                        }}
                      />
                    )
                  )}

                  {/* Observações */}
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder="Informações adicionais sobre o produto..."
                      rows={3}
                      disabled={!permissions.canEdit}
                    />
                  </div>
                  {/* Campos de Salão — apenas para Hamburgueria */}
                  {isHamburgueria && (
                    <div className="border rounded-lg p-4 space-y-3 bg-orange-50/50 border-orange-200">
                      <p className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">
                        <span>🍔</span> Configurações do Salão
                      </p>
                      <div className="grid gap-2">
                        <Label htmlFor="productionDestination">Destino de Produção</Label>
                        <Select
                          value={formData.productionDestination}
                          onValueChange={(v) => setFormData({ ...formData, productionDestination: v })}
                          disabled={!permissions.canEdit}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o destino" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">Não se aplica</SelectItem>
                            <SelectItem value="KITCHEN">Cozinha</SelectItem>
                            <SelectItem value="BAR">Bar</SelectItem>
                            <SelectItem value="BOTH">Cozinha e Bar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          id="availableInSalon"
                          checked={formData.availableInSalon}
                          onCheckedChange={(v) => setFormData({ ...formData, availableInSalon: v })}
                          disabled={!permissions.canEdit}
                        />
                        <Label htmlFor="availableInSalon" className="cursor-pointer">
                          Disponível no cardápio do salão
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || createProduct.isPending || updateProduct.isPending}
                  >
                    {isSubmitting || createProduct.isPending || updateProduct.isPending
                      ? "Salvando..."
                      : editingProduct
                      ? "Atualizar Produto"
                      : "Salvar Produto"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produtos por nome ou EAN..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={showFilters ? "bg-accent" : ""}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={!products || products.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
              </div>
              
              {showFilters && (
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <Label className="text-sm font-medium mb-1 block">Categoria</Label>
                    <Select
                      value={filterCategoryId}
                      onValueChange={(value) => {
                        setFilterCategoryId(value === "all" ? "" : value);
                        setFilterSubcategoryId(""); // Limpar subcategoria ao mudar categoria
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as categorias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as categorias</SelectItem>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex-1">
                    <Label className="text-sm font-medium mb-1 block">Subcategoria</Label>
                    <Select
                      value={filterSubcategoryId}
                      onValueChange={(value) => setFilterSubcategoryId(value === "all" ? "" : value)}
                      disabled={!filterCategoryId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={filterCategoryId ? "Todas as subcategorias" : "Selecione uma categoria"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as subcategorias</SelectItem>
                        {filteredSubcategoriesForFilter.map((sub: any) => (
                          <SelectItem key={sub.id} value={sub.id.toString()}>
                            {sub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilterCategoryId("");
                        setFilterSubcategoryId("");
                      }}
                    >
                      Limpar Filtros
                    </Button>
                  </div>
                </div>
              )}
              
              {(filterCategoryId || filterSubcategoryId) && (
                <div className="text-sm text-muted-foreground">
                  Mostrando {products?.length || 0} produto(s)
                  {filterCategoryId && ` na categoria "${categories?.find(c => c.id.toString() === filterCategoryId)?.name}"`}
                  {filterSubcategoryId && ` / subcategoria "${subcategories?.find((s: any) => s.id.toString() === filterSubcategoryId)?.name}"`}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Carregando produtos...</p>
              </div>
            ) : products && products.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>EAN</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    {isAdmin && <TableHead className="text-right">Custo Médio</TableHead>}
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const isLowStock =
                      product.currentStock !== null &&
                      product.minStock !== null &&
                      product.currentStock < product.minStock;

                    return (
                      <TableRow key={product.id} className={!product.active ? "opacity-50 bg-muted/30" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{product.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.ean || "-"}
                        </TableCell>
                        <TableCell>{product.uom}</TableCell>
                        <TableCell className="text-right font-medium">
                          {product.currentStock ?? 0}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {product.minStock ?? 0}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right text-muted-foreground">
                            R$ {parseFloat((product as any).avgCost || "0").toFixed(2)}
                          </TableCell>
                        )}
                        <TableCell>
                          {product.isComposite ? (
                            <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700">
                              Composto
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Simples</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isLowStock ? (
                            <div className="flex items-center gap-2 text-yellow-600">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                Estoque Baixo
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-green-600 font-medium">
                              OK
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={product.active}
                              onCheckedChange={() => handleToggleActive(product)}
                              disabled={!isAdmin}
                            />
                            {!product.active && (
                              <span className="text-xs text-muted-foreground">Inativo</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedProduct(product);
                                setMovementsModalOpen(true);
                              }}
                              title="Histórico de Movimentações"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setAdjustStockModalOpen(true);
                                }}
                                title="Acerto Manual de Estoque"
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(product)}
                              title="Editar Produto"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {search
                    ? "Nenhum produto encontrado"
                    : "Nenhum produto cadastrado ainda"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Clique em "Novo Produto" para começar
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modais de Movimentações */}
      {selectedProduct && (
        <>
          <ProductMovementsModal
            productId={selectedProduct.id}
            productName={selectedProduct.name}
            open={movementsModalOpen}
            onClose={() => {
              setMovementsModalOpen(false);
              setSelectedProduct(null);
            }}
          />
          
          <AdjustStockModal
            productId={selectedProduct.id}
            productName={selectedProduct.name}
            currentStock={selectedProduct.currentStock || 0}
            open={adjustStockModalOpen}
            onClose={() => {
              setAdjustStockModalOpen(false);
              setSelectedProduct(null);
            }}
            onSuccess={() => {
              refetch();
            }}
          />
        </>
      )}
    </DashboardLayout>
  );
}

