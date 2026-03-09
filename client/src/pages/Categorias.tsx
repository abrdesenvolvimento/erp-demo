import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronRight, Edit, FolderTree, Package, Plus, Receipt, Tags } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ==================== PRODUCT CATEGORIES TAB ====================

function ProductCategoriesTab() {
  const { data: categories, isLoading: loadingCats } = trpc.categories.list.useQuery({ activeOnly: false });
  const { data: subcategories, isLoading: loadingSubs } = trpc.subcategories.list.useQuery({});
  const utils = trpc.useUtils();

  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());
  const [showCreateCat, setShowCreateCat] = useState(false);
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [showEditCat, setShowEditCat] = useState(false);
  const [showEditSub, setShowEditSub] = useState(false);

  const [newCatName, setNewCatName] = useState("");
  const [newSubName, setNewSubName] = useState("");
  const [newSubCatId, setNewSubCatId] = useState<number | null>(null);
  const [editCat, setEditCat] = useState<{ id: number; name: string; active: boolean } | null>(null);
  const [editSub, setEditSub] = useState<{ id: number; name: string; categoryId: number; active: boolean } | null>(null);

  const createCatMutation = trpc.categories.create.useMutation({
    onSuccess: () => {
      toast.success("Categoria criada com sucesso!");
      setShowCreateCat(false);
      setNewCatName("");
      utils.categories.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateCatMutation = trpc.categories.update.useMutation({
    onSuccess: () => {
      toast.success("Categoria atualizada!");
      setShowEditCat(false);
      setEditCat(null);
      utils.categories.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const createSubMutation = trpc.subcategories.create.useMutation({
    onSuccess: () => {
      toast.success("Subcategoria criada com sucesso!");
      setShowCreateSub(false);
      setNewSubName("");
      setNewSubCatId(null);
      utils.subcategories.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateSubMutation = trpc.subcategories.update.useMutation({
    onSuccess: () => {
      toast.success("Subcategoria atualizada!");
      setShowEditSub(false);
      setEditSub(null);
      utils.subcategories.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleExpand = (catId: number) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const expandAll = () => {
    if (categories) setExpandedCats(new Set(categories.map((c) => c.id)));
  };

  const collapseAll = () => setExpandedCats(new Set());

  if (loadingCats || loadingSubs) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const activeCats = categories?.filter((c) => c.active) || [];
  const inactiveCats = categories?.filter((c) => !c.active) || [];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expandir Tudo
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Recolher Tudo
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowCreateSub(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Subcategoria
          </Button>
          <Button size="sm" onClick={() => setShowCreateCat(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Categoria
          </Button>
        </div>
      </div>

      {/* Active categories tree */}
      <div className="space-y-1">
        {activeCats.map((cat) => {
          const subs = subcategories?.filter((s) => s.categoryId === cat.id) || [];
          const activeSubs = subs.filter((s) => s.active);
          const inactiveSubs = subs.filter((s) => !s.active);
          const isExpanded = expandedCats.has(cat.id);

          return (
            <div key={cat.id} className="border rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => toggleExpand(cat.id)}
              >
                <div className="flex items-center gap-3">
                  {subs.length > 0 ? (
                    isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )
                  ) : (
                    <div className="w-4" />
                  )}
                  <FolderTree className="h-4 w-4 text-primary" />
                  <span className="font-medium">{cat.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {activeSubs.length} subcategoria{activeSubs.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditCat({ id: cat.id, name: cat.name, active: cat.active });
                      setShowEditCat(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewSubCatId(cat.id);
                      setShowCreateSub(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isExpanded && subs.length > 0 && (
                <div className="border-t">
                  {activeSubs.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between px-4 py-2 pl-14 hover:bg-muted/20 transition-colors border-b last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <Tags className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{sub.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditSub({ id: sub.id, name: sub.name, categoryId: sub.categoryId, active: sub.active });
                          setShowEditSub(true);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {inactiveSubs.length > 0 && (
                    <div className="px-4 py-2 pl-14 bg-muted/10">
                      <p className="text-xs text-muted-foreground mb-1">
                        Inativas ({inactiveSubs.length})
                      </p>
                      {inactiveSubs.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between py-1"
                        >
                          <div className="flex items-center gap-2 opacity-50">
                            <Tags className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm line-through">{sub.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditSub({ id: sub.id, name: sub.name, categoryId: sub.categoryId, active: sub.active });
                              setShowEditSub(true);
                            }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inactive categories */}
      {inactiveCats.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Categorias Inativas ({inactiveCats.length})
          </h3>
          <div className="space-y-1">
            {inactiveCats.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between px-4 py-3 border rounded-lg opacity-60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-4" />
                  <FolderTree className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium line-through">{cat.name}</span>
                  <Badge variant="outline" className="text-xs">
                    Inativa
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditCat({ id: cat.id, name: cat.name, active: cat.active });
                    setShowEditCat(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
        <span>{activeCats.length} categorias ativas</span>
        <span>·</span>
        <span>{subcategories?.filter((s) => s.active).length || 0} subcategorias ativas</span>
        {inactiveCats.length > 0 && (
          <>
            <span>·</span>
            <span>{inactiveCats.length} categorias inativas</span>
          </>
        )}
      </div>

      {/* Create Category Dialog */}
      <Dialog open={showCreateCat} onOpenChange={setShowCreateCat}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Categoria de Produto</DialogTitle>
            <DialogDescription>
              Crie uma nova categoria para organizar seus produtos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="catName" className="text-right">
                Nome
              </Label>
              <Input
                id="catName"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Ex: Cervejas, Destilados..."
                className="col-span-3"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCatName.trim()) {
                    createCatMutation.mutate({ name: newCatName.trim() });
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCat(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createCatMutation.mutate({ name: newCatName.trim() })}
              disabled={!newCatName.trim() || createCatMutation.isPending}
            >
              {createCatMutation.isPending ? "Criando..." : "Criar Categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={showEditCat} onOpenChange={setShowEditCat}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
          </DialogHeader>
          {editCat && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editCatName" className="text-right">
                  Nome
                </Label>
                <Input
                  id="editCatName"
                  value={editCat.name}
                  onChange={(e) => setEditCat({ ...editCat, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editCatActive" className="text-right">
                  Ativa
                </Label>
                <div className="col-span-3">
                  <Switch
                    id="editCatActive"
                    checked={editCat.active}
                    onCheckedChange={(checked) => setEditCat({ ...editCat, active: checked })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCat(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editCat) {
                  updateCatMutation.mutate({
                    id: editCat.id,
                    data: { name: editCat.name, active: editCat.active },
                  });
                }
              }}
              disabled={updateCatMutation.isPending}
            >
              {updateCatMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Subcategory Dialog */}
      <Dialog open={showCreateSub} onOpenChange={setShowCreateSub}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Subcategoria</DialogTitle>
            <DialogDescription>
              Crie uma subcategoria dentro de uma categoria existente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Categoria</Label>
              <Select
                value={newSubCatId?.toString() || ""}
                onValueChange={(v) => setNewSubCatId(parseInt(v))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {activeCats.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subName" className="text-right">
                Nome
              </Label>
              <Input
                id="subName"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="Ex: IPA, Lager, Pilsen..."
                className="col-span-3"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSubName.trim() && newSubCatId) {
                    createSubMutation.mutate({ name: newSubName.trim(), categoryId: newSubCatId });
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSub(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (newSubCatId) {
                  createSubMutation.mutate({ name: newSubName.trim(), categoryId: newSubCatId });
                }
              }}
              disabled={!newSubName.trim() || !newSubCatId || createSubMutation.isPending}
            >
              {createSubMutation.isPending ? "Criando..." : "Criar Subcategoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subcategory Dialog */}
      <Dialog open={showEditSub} onOpenChange={setShowEditSub}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Subcategoria</DialogTitle>
          </DialogHeader>
          {editSub && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Categoria</Label>
                <Select
                  value={editSub.categoryId.toString()}
                  onValueChange={(v) => setEditSub({ ...editSub, categoryId: parseInt(v) })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCats.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editSubName" className="text-right">
                  Nome
                </Label>
                <Input
                  id="editSubName"
                  value={editSub.name}
                  onChange={(e) => setEditSub({ ...editSub, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editSubActive" className="text-right">
                  Ativa
                </Label>
                <div className="col-span-3">
                  <Switch
                    id="editSubActive"
                    checked={editSub.active}
                    onCheckedChange={(checked) => setEditSub({ ...editSub, active: checked })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSub(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editSub) {
                  updateSubMutation.mutate({
                    id: editSub.id,
                    data: { name: editSub.name, categoryId: editSub.categoryId, active: editSub.active },
                  });
                }
              }}
              disabled={updateSubMutation.isPending}
            >
              {updateSubMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== EXPENSE CATEGORIES TAB ====================

function ExpenseCategoriesTab() {
  const { data: expCategories, isLoading } = trpc.expenses.categories.list.useQuery({ activeOnly: false });
  const utils = trpc.useUtils();

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editItem, setEditItem] = useState<{ id: number; name: string; description: string | null; active: boolean } | null>(null);

  const createMutation = trpc.expenses.categories.create.useMutation({
    onSuccess: () => {
      toast.success("Categoria de despesa criada!");
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      utils.expenses.categories.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.expenses.categories.update.useMutation({
    onSuccess: () => {
      toast.success("Categoria de despesa atualizada!");
      setShowEdit(false);
      setEditItem(null);
      utils.expenses.categories.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const activeItems = expCategories?.filter((c) => c.active) || [];
  const inactiveItems = expCategories?.filter((c) => !c.active) || [];

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Categoria
        </Button>
      </div>

      <div className="space-y-1">
        {activeItems.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center justify-between px-4 py-3 border rounded-lg hover:bg-muted/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Receipt className="h-4 w-4 text-primary" />
              <div>
                <span className="font-medium">{cat.name}</span>
                {cat.description && (
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditItem({ id: cat.id, name: cat.name, description: cat.description, active: cat.active });
                setShowEdit(true);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {inactiveItems.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Inativas ({inactiveItems.length})
          </h3>
          <div className="space-y-1">
            {inactiveItems.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between px-4 py-3 border rounded-lg opacity-60"
              >
                <div className="flex items-center gap-3">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium line-through">{cat.name}</span>
                  <Badge variant="outline" className="text-xs">
                    Inativa
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditItem({ id: cat.id, name: cat.name, description: cat.description, active: cat.active });
                    setShowEdit(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
        <span>{activeItems.length} categorias ativas</span>
        {inactiveItems.length > 0 && (
          <>
            <span>·</span>
            <span>{inactiveItems.length} inativas</span>
          </>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Categoria de Despesa</DialogTitle>
            <DialogDescription>
              Crie uma nova categoria para classificar suas despesas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expCatName" className="text-right">
                Nome
              </Label>
              <Input
                id="expCatName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Aluguel, Energia, Marketing..."
                className="col-span-3"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) {
                    createMutation.mutate({ name: newName.trim(), description: newDesc || undefined });
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expCatDesc" className="text-right">
                Descrição
              </Label>
              <Input
                id="expCatDesc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Descrição opcional..."
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate({ name: newName.trim(), description: newDesc || undefined })}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Criando..." : "Criar Categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Categoria de Despesa</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editExpName" className="text-right">
                  Nome
                </Label>
                <Input
                  id="editExpName"
                  value={editItem.name}
                  onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editExpDesc" className="text-right">
                  Descrição
                </Label>
                <Input
                  id="editExpDesc"
                  value={editItem.description || ""}
                  onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editExpActive" className="text-right">
                  Ativa
                </Label>
                <div className="col-span-3">
                  <Switch
                    id="editExpActive"
                    checked={editItem.active}
                    onCheckedChange={(checked) => setEditItem({ ...editItem, active: checked })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editItem) {
                  updateMutation.mutate({
                    id: editItem.id,
                    data: {
                      name: editItem.name,
                      description: editItem.description || undefined,
                      active: editItem.active,
                    },
                  });
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== MAIN PAGE ====================

export default function Categorias() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
          <p className="text-muted-foreground">
            Gerencie as categorias e subcategorias de produtos.
          </p>
        </div>

        <Tabs defaultValue="produtos" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-1">
            <TabsTrigger value="produtos" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="produtos" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderTree className="h-5 w-5" />
                  Categorias de Produtos
                </CardTitle>
                <CardDescription>
                  Organize seus produtos em categorias e subcategorias. As categorias são usadas nos cadastros de produtos e nas análises.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProductCategoriesTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="despesas" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Categorias de Despesas
                </CardTitle>
                <CardDescription>
                  Classifique suas despesas em categorias para facilitar a análise financeira e o controle de gastos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExpenseCategoriesTab />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
