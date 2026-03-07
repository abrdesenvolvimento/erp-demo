import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronRight, Plus, Edit2, Search, BookOpen, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

interface Account {
  id: number;
  companyId: number;
  parentId: number | null;
  code: string;
  name: string;
  parentCode: string | null;
  level: number;
  accountType: string;
  nature: string;
  isAnalytical: boolean | null;
  allowsEntries: boolean | null;
  displayOrder: number | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface TreeNode extends Account {
  children: TreeNode[];
}

// Função para construir árvore hierárquica
function buildTree(accounts: Account[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Primeiro passo: criar nós
  accounts.forEach(account => {
    map.set(account.code, { ...account, children: [] });
  });

  // Segundo passo: construir hierarquia
  accounts.forEach(account => {
    const node = map.get(account.code)!;
    if (account.parentCode && map.has(account.parentCode)) {
      map.get(account.parentCode)!.children.push(node);
    } else if (account.level === 1) {
      roots.push(node);
    }
  });

  // Ordenar filhos por código
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach(node => sortChildren(node.children));
  };
  sortChildren(roots);

  return roots;
}

// Componente de nó da árvore
function TreeNodeComponent({
  node,
  expandedNodes,
  toggleNode,
  onEdit,
  searchTerm,
}: {
  node: TreeNode;
  expandedNodes: Set<string>;
  toggleNode: (code: string) => void;
  onEdit: (account: Account) => void;
  searchTerm: string;
}) {
  const isExpanded = expandedNodes.has(node.code);
  const hasChildren = node.children.length > 0;
  const isMatch = searchTerm && (
    node.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cores por tipo de conta
  const getTypeColor = (type: string) => {
    switch (type) {
      case "ATIVO": return "text-blue-600";
      case "PASSIVO": return "text-red-600";
      case "PL":
      case "PATRIMONIO_LIQUIDO": return "text-purple-600";
      case "RECEITA": return "text-green-600";
      case "CUSTO": return "text-orange-600";
      case "DESPESA": return "text-amber-600";
      default: return "text-gray-600";
    }
  };

  // Badge de natureza
  const getNatureBadge = (nature: string) => {
    return nature === "DEVEDORA" ? (
      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">D</span>
    ) : (
      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">C</span>
    );
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group ${
          isMatch ? "bg-yellow-100" : ""
        } ${!node.isActive ? "opacity-50" : ""}`}
        style={{ paddingLeft: `${(node.level - 1) * 20 + 8}px` }}
      >
        {/* Botão de expandir/colapsar */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hasChildren) toggleNode(node.code);
          }}
          className={`w-5 h-5 flex items-center justify-center cursor-pointer ${
            hasChildren ? "text-muted-foreground hover:text-foreground" : "invisible"
          }`}
        >
          {hasChildren && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
        </button>

        {/* Código - clicável para expandir */}
        <span 
          className={`font-mono text-sm cursor-pointer ${getTypeColor(node.accountType)}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hasChildren) toggleNode(node.code);
          }}
        >
          {node.code}
        </span>

        {/* Nome - clicável para expandir */}
        <span 
          className={`flex-1 text-sm cursor-pointer ${node.isAnalytical ? "font-normal" : "font-medium"}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hasChildren) toggleNode(node.code);
          }}
        >
          {node.name}
        </span>

        {/* Badges */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {getNatureBadge(node.nature)}
          {node.isAnalytical && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Analítica</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(node);
            }}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Filhos */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNodeComponent
              key={child.code}
              node={child}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              onEdit={onEdit}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlanoContas() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["1", "2", "3", "4", "5", "6"]));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    parentCode: "",
    accountType: "ATIVO" as string,
    nature: "DEVEDORA" as string,
    isAnalytical: true,
    allowsEntries: true,
  });

  // Queries
  const { data: accounts = [], isLoading, refetch } = trpc.accounting.chartOfAccounts.list.useQuery();
  const createAccount = trpc.accounting.chartOfAccounts.create.useMutation({
    onSuccess: () => {
      toast.success("Conta criada com sucesso!");
      refetch();
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Erro ao criar conta: ${error.message}`);
    },
  });
  const updateAccount = trpc.accounting.chartOfAccounts.update.useMutation({
    onSuccess: () => {
      toast.success("Conta atualizada com sucesso!");
      refetch();
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar conta: ${error.message}`);
    },
  });

  // Construir árvore
  const tree = useMemo(() => buildTree(accounts), [accounts]);

  // Filtrar por busca
  const filteredTree = useMemo(() => {
    if (!debouncedSearch) return tree;
    
    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.reduce<TreeNode[]>((acc, node) => {
        const matches = 
          node.code.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          node.name.toLowerCase().includes(debouncedSearch.toLowerCase());
        
        const filteredChildren = filterNodes(node.children);
        
        if (matches || filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren });
        }
        
        return acc;
      }, []);
    };
    
    return filterNodes(tree);
  }, [tree, debouncedSearch]);

  // Expandir todos os nós quando buscar
  useMemo(() => {
    if (debouncedSearch) {
      const allCodes = new Set<string>();
      const collectCodes = (nodes: TreeNode[]) => {
        nodes.forEach(node => {
          allCodes.add(node.code);
          collectCodes(node.children);
        });
      };
      collectCodes(filteredTree);
      setExpandedNodes(allCodes);
    }
  }, [debouncedSearch, filteredTree]);

  const toggleNode = (code: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allCodes = new Set<string>();
    const collectCodes = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        allCodes.add(node.code);
        collectCodes(node.children);
      });
    };
    collectCodes(tree);
    setExpandedNodes(allCodes);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set(["1", "2", "3", "4", "5", "6"]));
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      parentCode: "",
      accountType: "ATIVO",
      nature: "DEVEDORA",
      isAnalytical: true,
      allowsEntries: true,
    });
    setEditingAccount(null);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      parentCode: account.parentCode || "",
      accountType: account.accountType,
      nature: account.nature,
      isAnalytical: account.isAnalytical ?? true,
      allowsEntries: account.allowsEntries ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingAccount) {
      updateAccount.mutate({
        id: editingAccount.id,
        name: formData.name,
        allowsEntries: formData.allowsEntries,
      });
    } else {
      // Calcular nível baseado no código
      const level = formData.code.split(".").length;
      createAccount.mutate({
        code: formData.code,
        name: formData.name,
        parentCode: formData.parentCode || undefined,
        level,
        accountType: formData.accountType as any,
        nature: formData.nature as any,
        isAnalytical: formData.isAnalytical,
        allowsEntries: formData.allowsEntries,
      });
    }
  };

  // Estatísticas
  const stats = useMemo(() => {
    const total = accounts.length;
    const analytical = accounts.filter(a => a.isAnalytical).length;
    const synthetic = total - analytical;
    const active = accounts.filter(a => a.isActive).length;
    return { total, analytical, synthetic, active };
  }, [accounts]);

  if (user?.role !== "admin" && user?.role !== "consultor") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Acesso restrito</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Plano de Contas</h1>
            <p className="text-muted-foreground">Estrutura contábil hierárquica</p>
          </div>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Contas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contas Analíticas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.analytical}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contas Sintéticas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{stats.synthetic}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contas Ativas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.active}</p>
            </CardContent>
          </Card>
        </div>

        {/* Árvore de Contas */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Estrutura Hierárquica</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar conta..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={expandAll}>
                  Expandir
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll}>
                  Recolher
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="border rounded-lg p-4 max-h-[600px] overflow-y-auto">
                {filteredTree.map(node => (
                  <TreeNodeComponent
                    key={node.code}
                    node={node}
                    expandedNodes={expandedNodes}
                    toggleNode={toggleNode}
                    onEdit={handleEdit}
                    searchTerm={searchTerm}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legenda */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-6 text-sm">
              <span className="font-medium">Legenda:</span>
              <span className="text-blue-600">● Ativo</span>
              <span className="text-red-600">● Passivo</span>
              <span className="text-purple-600">● Patrimônio Líquido</span>
              <span className="text-green-600">● Receita</span>
              <span className="text-orange-600">● Custo</span>
              <span className="text-amber-600">● Despesa</span>
              <span className="ml-4">
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">D</span> Devedora
              </span>
              <span>
                <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs">C</span> Credora
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Criação/Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Editar Conta" : "Nova Conta"}</DialogTitle>
            <DialogDescription>
              {editingAccount
                ? "Atualize as informações da conta contábil."
                : "Preencha os dados para criar uma nova conta contábil."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Ex: 1.1.1.01"
                  disabled={!!editingAccount}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentCode">Código Pai</Label>
                <Input
                  id="parentCode"
                  value={formData.parentCode}
                  onChange={(e) => setFormData({ ...formData, parentCode: e.target.value })}
                  placeholder="Ex: 1.1.1"
                  disabled={!!editingAccount}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da conta"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountType">Tipo</Label>
                <Select
                  value={formData.accountType}
                  onValueChange={(value) => setFormData({ ...formData, accountType: value })}
                  disabled={!!editingAccount}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="PASSIVO">Passivo</SelectItem>
                    <SelectItem value="PL">Patrimônio Líquido</SelectItem>
                    <SelectItem value="RECEITA">Receita</SelectItem>
                    <SelectItem value="CUSTO">Custo</SelectItem>
                    <SelectItem value="DESPESA">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nature">Natureza</Label>
                <Select
                  value={formData.nature}
                  onValueChange={(value) => setFormData({ ...formData, nature: value })}
                  disabled={!!editingAccount}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEVEDORA">Devedora</SelectItem>
                    <SelectItem value="CREDORA">Credora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="isAnalytical"
                  checked={formData.isAnalytical}
                  onCheckedChange={(checked) => setFormData({ ...formData, isAnalytical: checked })}
                  disabled={!!editingAccount}
                />
                <Label htmlFor="isAnalytical">Conta Analítica</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="allowsEntries"
                  checked={formData.allowsEntries}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowsEntries: checked })}
                />
                <Label htmlFor="allowsEntries">Permite Lançamentos</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createAccount.isPending || updateAccount.isPending}
            >
              {(createAccount.isPending || updateAccount.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingAccount ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
