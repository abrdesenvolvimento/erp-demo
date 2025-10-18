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
import { trpc } from "@/lib/trpc";
import { Package, Plus, Search, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Produtos() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { data: products, isLoading, refetch } = trpc.products.list.useQuery({
    search: search || undefined,
  });
  
  const { data: categories } = trpc.categories.list.useQuery();
  
  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("Produto criado com sucesso!");
      setIsDialogOpen(false);
      refetch();
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar produto: " + error.message);
    },
  });

  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    subcategoryId: "",
    ean: "",
    uom: "UN",
    minStock: "0",
    currentStock: "0",
    avgCost: "0.00",
    isComposite: false,
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      categoryId: "",
      subcategoryId: "",
      ean: "",
      uom: "UN",
      minStock: "0",
      currentStock: "0",
      avgCost: "0.00",
      isComposite: false,
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProduct.mutate({
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
    });
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

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Novo Produto</DialogTitle>
                  <DialogDescription>
                    Cadastre um novo produto no sistema
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
                    />
                  </div>

                  {/* Categoria e Subcategoria */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="category">Categoria *</Label>
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, categoryId: value, subcategoryId: "" })
                        }
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="subcategory">Subcategoria</Label>
                      <Select
                        value={formData.subcategoryId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, subcategoryId: value })
                        }
                        disabled={!formData.categoryId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Nenhuma</SelectItem>
                          {/* Aqui viriam as subcategorias filtradas */}
                        </SelectContent>
                      </Select>
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
                        placeholder="7891234567890"
                        maxLength={14}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="uom">Unidade de Medida *</Label>
                      <Select
                        value={formData.uom}
                        onValueChange={(value) =>
                          setFormData({ ...formData, uom: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
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
                      />
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
                      />
                    </div>

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
                  </div>

                  {/* Produto Composto */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isComposite"
                      checked={formData.isComposite}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isComposite: checked as boolean })
                      }
                    />
                    <Label
                      htmlFor="isComposite"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Produto Composto (Pack/Caixa)
                    </Label>
                  </div>

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
                    />
                  </div>
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
                  <Button type="submit" disabled={createProduct.isPending}>
                    {createProduct.isPending ? "Salvando..." : "Salvar Produto"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
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
                    <TableHead className="text-right">Custo Médio</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const isLowStock =
                      product.currentStock !== null &&
                      product.minStock !== null &&
                      product.currentStock < product.minStock;

                    return (
                      <TableRow key={product.id}>
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
                        <TableCell className="text-right text-muted-foreground">
                          R$ {parseFloat(product.avgCost || "0").toFixed(2)}
                        </TableCell>
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
    </DashboardLayout>
  );
}

