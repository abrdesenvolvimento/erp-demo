import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Edit2,
  Link2,
  Layers,
  Tag,
  FileText,
  CheckCircle,
  XCircle,
} from "lucide-react";

type ManagementAccount = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  nature: "CUSTO" | "DESPESA" | "RECEITA" | "PATRIMONIAL";
  costType: "FIXA" | "VARIAVEL" | null;
  classification: string;
  impactMargin: boolean | null;
  impactPayroll: boolean | null;
  isActive: boolean;
  displayOrder?: number | null;
  accountingCode?: string | null;
  accountingName?: string | null;
};

const NATURE_OPTIONS = [
  { value: "CUSTO", label: "Custo", color: "bg-orange-100 text-orange-800" },
  { value: "DESPESA", label: "Despesa", color: "bg-red-100 text-red-800" },
  { value: "RECEITA", label: "Receita", color: "bg-green-100 text-green-800" },
  { value: "PATRIMONIAL", label: "Patrimonial", color: "bg-blue-100 text-blue-800" },
];

const CLASSIFICATION_OPTIONS = [
  { value: "OPERACIONAL", label: "Operacional" },
  { value: "ADMINISTRATIVA", label: "Administrativa" },
  { value: "COMERCIAL", label: "Comercial" },
  { value: "FINANCEIRA", label: "Financeira" },
  { value: "NAO_OPERACIONAL", label: "Não Operacional" },
  { value: "PATRIMONIAL", label: "Patrimonial" },
];

const COST_TYPE_OPTIONS = [
  { value: "FIXA", label: "Fixa" },
  { value: "VARIAVEL", label: "Variável" },
];

export default function ContasGerenciais() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterNature, setFilterNature] = useState<string>("all");
  const [filterClassification, setFilterClassification] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ManagementAccount | null>(null);
  const [mappingAccount, setMappingAccount] = useState<ManagementAccount | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    nature: "DESPESA" as "CUSTO" | "DESPESA" | "RECEITA" | "PATRIMONIAL",
    costType: null as "FIXA" | "VARIAVEL" | null,
    classification: "OPERACIONAL" as "OPERACIONAL" | "ADMINISTRATIVA" | "COMERCIAL" | "FINANCEIRA" | "NAO_OPERACIONAL" | "PATRIMONIAL",
    impactMargin: false,
    impactPayroll: false,
    isActive: true,
  });

  // Mapping form state
  const [mappingData, setMappingData] = useState({
    accountingCode: "",
    notes: "",
  });

  // Queries
  const { data: accounts = [], isLoading, refetch } = trpc.accounting.listManagementAccounts.useQuery();
  const { data: chartOfAccounts = [] } = trpc.accounting.listChartOfAccounts.useQuery();

  // Mutations
  const createMutation = trpc.accounting.createManagementAccount.useMutation({
    onSuccess: () => {
      toast.success("Conta gerencial criada com sucesso!");
      setIsModalOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao criar conta: ${error.message}`);
    },
  });

  const updateMutation = trpc.accounting.updateManagementAccount.useMutation({
    onSuccess: () => {
      toast.success("Conta gerencial atualizada com sucesso!");
      setIsModalOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar conta: ${error.message}`);
    },
  });

  const updateMappingMutation = trpc.accounting.updateAccountingMapping.useMutation({
    onSuccess: () => {
      toast.success("Amarração contábil atualizada com sucesso!");
      setIsMappingModalOpen(false);
      setMappingAccount(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar amarração: ${error.message}`);
    },
  });

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((account: ManagementAccount) => {
      const matchesSearch =
        account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesNature = filterNature === "all" || account.nature === filterNature;
      const matchesClassification =
        filterClassification === "all" || account.classification === filterClassification;
      return matchesSearch && matchesNature && matchesClassification;
    });
  }, [accounts, searchTerm, filterNature, filterClassification]);

  // Get analytical accounts for mapping
  const analyticalAccounts = useMemo(() => {
    return chartOfAccounts.filter((acc: any) => acc.allowsEntries);
  }, [chartOfAccounts]);

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      nature: "DESPESA",
      costType: null,
      classification: "OPERACIONAL",
      impactMargin: false,
      impactPayroll: false,
      isActive: true,
    });
    setEditingAccount(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (account: ManagementAccount) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      description: account.description || "",
      nature: account.nature as "CUSTO" | "DESPESA" | "RECEITA" | "PATRIMONIAL",
      costType: account.costType,
      classification: account.classification as "OPERACIONAL" | "ADMINISTRATIVA" | "COMERCIAL" | "FINANCEIRA" | "NAO_OPERACIONAL" | "PATRIMONIAL",
      impactMargin: account.impactMargin ?? false,
      impactPayroll: account.impactPayroll ?? false,
      isActive: account.isActive,
    });
    setIsModalOpen(true);
  };

  const handleOpenMapping = (account: ManagementAccount) => {
    setMappingAccount(account);
    setMappingData({
      accountingCode: account.accountingCode || "",
      notes: "",
    });
    setIsMappingModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.code || !formData.name) {
      toast.error("Código e nome são obrigatórios");
      return;
    }

    if (editingAccount) {
      updateMutation.mutate({
        id: editingAccount.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleSubmitMapping = () => {
    if (!mappingAccount || !mappingData.accountingCode) {
      toast.error("Selecione uma conta contábil");
      return;
    }

    updateMappingMutation.mutate({
      managementAccountId: mappingAccount.id,
      accountingCode: mappingData.accountingCode,
      notes: mappingData.notes || undefined,
    });
  };

  const getNatureColor = (nature: string) => {
    const option = NATURE_OPTIONS.find((o) => o.value === nature);
    return option?.color || "bg-gray-100 text-gray-800";
  };

  // Stats
  const stats = useMemo(() => {
    const total = accounts.length;
    const custos = accounts.filter((a) => a.nature === "CUSTO").length;
    const despesas = accounts.filter((a) => a.nature === "DESPESA").length;
    const receitas = accounts.filter((a) => a.nature === "RECEITA").length;
    const comAmarracao = accounts.filter((a) => a.accountingCode).length;
    return { total, custos, despesas, receitas, comAmarracao };
  }, [accounts]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contas Gerenciais</h1>
            <p className="text-muted-foreground">
              Gerencie as contas gerenciais e suas amarrações com o Plano Contábil
            </p>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Custos</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">{stats.custos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Despesas</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{stats.despesas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Receitas</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.receitas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Com Amarração</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{stats.comAmarracao}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por código ou nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterNature} onValueChange={setFilterNature}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Natureza" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {NATURE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterClassification} onValueChange={setFilterClassification}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {CLASSIFICATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Lista de Contas ({filteredAccounts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredAccounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma conta encontrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Natureza</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Conta Contábil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account: ManagementAccount) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono font-medium">{account.code}</TableCell>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>
                        <Badge className={getNatureColor(account.nature)}>
                          {NATURE_OPTIONS.find((o) => o.value === account.nature)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {CLASSIFICATION_OPTIONS.find((o) => o.value === account.classification)?.label}
                      </TableCell>
                      <TableCell>
                        {account.accountingCode ? (
                          <span className="font-mono text-sm text-blue-600">
                            {account.accountingCode}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Não amarrada</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {account.isActive ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ativa
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600 border-red-600">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inativa
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenMapping(account)}
                            title="Amarrar conta contábil"
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(account)}
                            title="Editar conta"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "Editar Conta Gerencial" : "Nova Conta Gerencial"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código *</Label>
                  <Input
                    id="code"
                    placeholder="Ex: COP001"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nature">Natureza *</Label>
                  <Select
                    value={formData.nature}
                    onValueChange={(v) => setFormData({ ...formData, nature: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NATURE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Energia Elétrica"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="classification">Classificação *</Label>
                  <Select
                    value={formData.classification}
                    onValueChange={(v) => setFormData({ ...formData, classification: v as "OPERACIONAL" | "ADMINISTRATIVA" | "COMERCIAL" | "FINANCEIRA" | "NAO_OPERACIONAL" | "PATRIMONIAL" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASSIFICATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costType">Tipo de Custo</Label>
                  <Select
                    value={formData.costType || "none"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, costType: v === "none" ? null : (v as any) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não aplicável</SelectItem>
                      {COST_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descrição detalhada da conta..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.impactMargin}
                    onCheckedChange={(v) => setFormData({ ...formData, impactMargin: v })}
                  />
                  <Label>Impacta Margem</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.impactPayroll}
                    onCheckedChange={(v) => setFormData({ ...formData, impactPayroll: v })}
                  />
                  <Label>Impacta Folha</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                  />
                  <Label>Ativa</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingAccount ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mapping Modal */}
        <Dialog open={isMappingModalOpen} onOpenChange={setIsMappingModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Amarração Contábil</DialogTitle>
            </DialogHeader>
            {mappingAccount && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Conta Gerencial</p>
                  <p className="font-medium">
                    {mappingAccount.code} - {mappingAccount.name}
                  </p>
                  <Badge className={`mt-2 ${getNatureColor(mappingAccount.nature)}`}>
                    {NATURE_OPTIONS.find((o) => o.value === mappingAccount.nature)?.label}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountingCode">Conta Contábil *</Label>
                  <Select
                    value={mappingData.accountingCode}
                    onValueChange={(v) => setMappingData({ ...mappingData, accountingCode: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta contábil..." />
                    </SelectTrigger>
                    <SelectContent>
                      {analyticalAccounts.map((acc: any) => (
                        <SelectItem key={acc.code} value={acc.code}>
                          {acc.code} - {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    placeholder="Observações sobre a amarração..."
                    value={mappingData.notes}
                    onChange={(e) => setMappingData({ ...mappingData, notes: e.target.value })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMappingModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmitMapping} disabled={updateMappingMutation.isPending}>
                Salvar Amarração
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
