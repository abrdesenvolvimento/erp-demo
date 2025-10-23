import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Users, Plus, Search, Pencil, Ban, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatCPFCNPJ, validateCPFCNPJ } from "@/lib/validators";
import { fetchCEP, formatCEP } from "@/lib/cep";

export default function Parceiros() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any>(null);
  
  const { data: partners, isLoading, refetch } = trpc.partners.list.useQuery({
    search: search || undefined,
  });
  
  const createPartner = trpc.partners.create.useMutation({
    onSuccess: () => {
      toast.success("Parceiro criado com sucesso!");
      setIsDialogOpen(false);
      refetch();
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erro ao criar parceiro: " + error.message);
    },
  });

  const updatePartner = trpc.partners.update.useMutation({
    onSuccess: () => {
      toast.success("Parceiro atualizado com sucesso!");
      setIsDialogOpen(false);
      setEditingPartner(null);
      refetch();
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar parceiro: " + error.message);
    },
  });

  const togglePartnerStatus = trpc.partners.update.useMutation({
    onSuccess: () => {
      toast.success("Status do parceiro atualizado!");
      refetch();
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar status: " + error.message);
    },
  });

  const handleToggleActive = (partner: any) => {
    togglePartnerStatus.mutate({
      id: partner.id,
      name: partner.name,
      partnerType: partner.partnerType,
      docNumber: partner.docNumber || undefined,
      phone: partner.phone || undefined,
      email: partner.email || undefined,
      street: partner.street || undefined,
      neighborhood: partner.neighborhood || undefined,
      city: partner.city || undefined,
      state: partner.state || undefined,
      zipCode: partner.zipCode || undefined,
      notes: partner.notes || undefined,
      creditLimit: partner.creditLimit || undefined,
      creditPolicy: partner.creditPolicy || undefined,
      active: !partner.active,
    });
  };

  const [formData, setFormData] = useState({
    name: "",
    docNumber: "",
    partnerType: "CUSTOMER" as "CUSTOMER" | "SUPPLIER" | "BOTH",
    phone: "",
    email: "",
    // Endereço separado
    street: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
    notes: "",
    creditLimit: "0.00",
    creditPolicy: "ACTIVE" as "ACTIVE" | "BLOCKED",
    active: true,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      docNumber: "",
      partnerType: "CUSTOMER",
      phone: "",
      email: "",
      street: "",
      neighborhood: "",
      city: "",
      state: "",
      zipCode: "",
      notes: "",
      creditLimit: "0.00",
      creditPolicy: "ACTIVE",
      active: true,
    });
    setEditingPartner(null);
  };

  const handleEdit = (partner: any) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      docNumber: partner.docNumber || "",
      partnerType: partner.partnerType,
      phone: partner.phone || "",
      email: partner.email || "",
      street: partner.street || "",
      neighborhood: partner.neighborhood || "",
      city: partner.city || "",
      state: partner.state || "",
      zipCode: partner.zipCode || "",
      notes: partner.notes || "",
      creditLimit: partner.creditLimit || "0.00",
      creditPolicy: partner.creditPolicy || "ACTIVE",
      active: partner.active ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingPartner) {
      updatePartner.mutate({
        id: editingPartner.id,
        ...formData,
        docNumber: formData.docNumber || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        street: formData.street || undefined,
        neighborhood: formData.neighborhood || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zipCode: formData.zipCode || undefined,
        notes: formData.notes || undefined,
      });
    } else {
      createPartner.mutate({
        ...formData,
        docNumber: formData.docNumber || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        street: formData.street || undefined,
        neighborhood: formData.neighborhood || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zipCode: formData.zipCode || undefined,
        notes: formData.notes || undefined,
      });
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  // Filtrar parceiros por tipo
  const filteredPartners = partners?.filter((partner) => {
    if (activeTab === "all") return true;
    if (activeTab === "customers") return partner.partnerType === "CUSTOMER" || partner.partnerType === "BOTH";
    if (activeTab === "suppliers") return partner.partnerType === "SUPPLIER" || partner.partnerType === "BOTH";
    return true;
  }) || [];

  const renderPartnersTable = (partnersList: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Documento</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Contato</TableHead>
          <TableHead className="text-right">Limite Crédito</TableHead>
          <TableHead className="text-right">Saldo Atual</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {partnersList.map((partner) => (
          <TableRow key={partner.id} className={!partner.active ? "opacity-50" : ""}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{partner.name}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {partner.docNumber || "-"}
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {partner.partnerType === "CUSTOMER"
                  ? "Cliente"
                  : partner.partnerType === "SUPPLIER"
                  ? "Fornecedor"
                  : "Ambos"}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {partner.phone || partner.email || "-"}
            </TableCell>
            <TableCell className="text-right font-medium">
              R$ {parseFloat(partner.creditLimit || "0").toFixed(2)}
            </TableCell>
            <TableCell className="text-right">
              <span
                className={
                  parseFloat(partner.currentBalance || "0") > 0
                    ? "text-red-600 font-medium"
                    : "text-green-600 font-medium"
                }
              >
                R$ {parseFloat(partner.currentBalance || "0").toFixed(2)}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {partner.active ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Check className="h-3 w-3 mr-1" />
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    <Ban className="h-3 w-3 mr-1" />
                    Inativo
                  </Badge>
                )}
                {partner.creditPolicy === "BLOCKED" && (
                  <Badge variant="destructive" className="text-xs">
                    Crédito Bloqueado
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={partner.active}
                    onCheckedChange={() => handleToggleActive(partner)}
                  />
                  {!partner.active && (
                    <span className="text-xs text-muted-foreground">Inativo</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(partner)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Parceiros</h1>
            <p className="text-muted-foreground">
              Gerencie clientes e fornecedores
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Parceiro
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingPartner ? "Editar Parceiro" : "Novo Parceiro"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingPartner
                      ? "Atualize as informações do parceiro"
                      : "Cadastre um novo cliente ou fornecedor"}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* Nome */}
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome/Razão Social *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  {/* Documento e Tipo */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="docNumber">CPF/CNPJ</Label>
                      <Input
                        id="docNumber"
                        value={formatCPFCNPJ(formData.docNumber)}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, docNumber: cleaned });
                        }}
                        onBlur={(e) => {
                          const doc = e.target.value.replace(/\D/g, '');
                          if (doc && !validateCPFCNPJ(doc)) {
                            toast.error("CPF/CNPJ inválido. Verifique os dígitos.");
                          }
                        }}
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        maxLength={18}
                        className={formData.docNumber && !validateCPFCNPJ(formData.docNumber) ? "border-destructive" : ""}
                      />
                      {formData.docNumber && !validateCPFCNPJ(formData.docNumber) && (
                        <p className="text-xs text-destructive">
                          CPF/CNPJ inválido
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="partnerType">Tipo *</Label>
                      <Select
                        value={formData.partnerType}
                        onValueChange={(value: any) =>
                          setFormData({ ...formData, partnerType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CUSTOMER">Cliente</SelectItem>
                          <SelectItem value="SUPPLIER">Fornecedor</SelectItem>
                          <SelectItem value="BOTH">Ambos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Telefone e E-mail */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder="(00) 00000-0000"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>

                  {/* Endereço Separado */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Endereço</h3>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="street">Logradouro (Rua + Número)</Label>
                        <Input
                          id="street"
                          value={formData.street}
                          onChange={(e) =>
                            setFormData({ ...formData, street: e.target.value })
                          }
                          placeholder="Ex: Rua Américo de Campo, 174"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="neighborhood">Bairro</Label>
                          <Input
                            id="neighborhood"
                            value={formData.neighborhood}
                            onChange={(e) =>
                              setFormData({ ...formData, neighborhood: e.target.value })
                            }
                            placeholder="Ex: Rochdale"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="city">Cidade</Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) =>
                              setFormData({ ...formData, city: e.target.value })
                            }
                            placeholder="Ex: Osasco"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="state">Estado (UF)</Label>
                          <Input
                            id="state"
                            value={formData.state}
                            onChange={(e) =>
                              setFormData({ ...formData, state: e.target.value.toUpperCase() })
                            }
                            placeholder="Ex: SP"
                            maxLength={2}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="zipCode">CEP</Label>
                          <Input
                            id="zipCode"
                            value={formatCEP(formData.zipCode)}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/\D/g, '');
                              setFormData({ ...formData, zipCode: cleaned });
                            }}
                            onBlur={async (e) => {
                              const cep = e.target.value.replace(/\D/g, '');
                              if (cep.length === 8) {
                                const data = await fetchCEP(cep);
                                if (data) {
                                  setFormData({
                                    ...formData,
                                    zipCode: cep,
                                    street: data.logradouro || formData.street,
                                    neighborhood: data.bairro || formData.neighborhood,
                                    city: data.localidade || formData.city,
                                    state: data.uf || formData.state,
                                  });
                                  toast.success("Endere\u00e7o preenchido automaticamente!");
                                } else {
                                  toast.error("CEP n\u00e3o encontrado. Preencha manualmente.");
                                }
                              }
                            }}
                            placeholder="00000-000"
                            maxLength={9}
                          />
                          <p className="text-xs text-muted-foreground">
                            Digite o CEP e pressione Tab para buscar automaticamente
                          </p>
                        </div>
                      </div>
                    </div>
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
                      placeholder="Informações complementares sobre o parceiro..."
                      rows={3}
                    />
                  </div>

                  {/* Campos para Clientes */}
                  {(formData.partnerType === "CUSTOMER" || formData.partnerType === "BOTH") && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="creditLimit">Limite de Crédito (R$)</Label>
                          <Input
                            id="creditLimit"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.creditLimit}
                            onChange={(e) =>
                              setFormData({ ...formData, creditLimit: e.target.value })
                            }
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="creditPolicy">Política de Crédito</Label>
                          <Select
                            value={formData.creditPolicy}
                            onValueChange={(value: any) =>
                              setFormData({ ...formData, creditPolicy: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ACTIVE">Ativo</SelectItem>
                              <SelectItem value="BLOCKED">Bloqueado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Status Ativo/Inativo */}
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="active">Parceiro Ativo</Label>
                      <p className="text-sm text-muted-foreground">
                        Desative para ocultar este parceiro das listagens
                      </p>
                    </div>
                    <Switch
                      id="active"
                      checked={formData.active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, active: checked })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDialogClose(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createPartner.isPending || updatePartner.isPending}
                  >
                    {createPartner.isPending || updatePartner.isPending
                      ? "Salvando..."
                      : "Salvar"}
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
                  placeholder="Buscar parceiros..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="all">
                  Todos ({partners?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="customers">
                  Clientes ({partners?.filter(p => p.partnerType === "CUSTOMER" || p.partnerType === "BOTH").length || 0})
                </TabsTrigger>
                <TabsTrigger value="suppliers">
                  Fornecedores ({partners?.filter(p => p.partnerType === "SUPPLIER" || p.partnerType === "BOTH").length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Carregando parceiros...</p>
                  </div>
                ) : filteredPartners.length > 0 ? (
                  renderPartnersTable(filteredPartners)
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {search
                        ? "Nenhum parceiro encontrado"
                        : "Nenhum parceiro cadastrado ainda"}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="customers">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Carregando clientes...</p>
                  </div>
                ) : filteredPartners.length > 0 ? (
                  renderPartnersTable(filteredPartners)
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {search
                        ? "Nenhum cliente encontrado"
                        : "Nenhum cliente cadastrado ainda"}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="suppliers">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Carregando fornecedores...</p>
                  </div>
                ) : filteredPartners.length > 0 ? (
                  renderPartnersTable(filteredPartners)
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {search
                        ? "Nenhum fornecedor encontrado"
                        : "Nenhum fornecedor cadastrado ainda"}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

