import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Plus, Trash2, Building2, Users, ChevronRight, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useAuth } from "@/_core/hooks/useAuth";

export default function GerenciarAcessos() {
  const { user: currentUser } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantForm, setGrantForm] = useState({
    userId: "",
    role: "operacional" as "admin" | "operacional" | "consultor",
  });

  // Queries
  const { data: allCompanies = [], isLoading: loadingCompanies } = trpc.company.allCompanies.useQuery();
  const { data: companyUsers = [], isLoading: loadingUsers, refetch: refetchUsers } = trpc.company.companyUsers.useQuery(
    { companyId: selectedCompanyId! },
    { enabled: !!selectedCompanyId }
  );
  const { data: allUsers = [] } = trpc.company.allUsers.useQuery();

  // Mutations
  const grantMutation = trpc.company.grantAccess.useMutation();
  const revokeMutation = trpc.company.revokeAccess.useMutation();
  const updateRoleMutation = trpc.company.updateUserRole.useMutation();

  // Users that don't have access to the selected company yet
  const availableUsers = useMemo(() => {
    const existingUserIds = new Set(companyUsers.map(u => u.userId));
    return allUsers.filter(u => !existingUserIds.has(u.id));
  }, [allUsers, companyUsers]);

  const selectedCompany = allCompanies.find(c => c.id === selectedCompanyId);

  const handleGrantAccess = async () => {
    if (!selectedCompanyId || !grantForm.userId) return;
    try {
      await grantMutation.mutateAsync({
        userId: grantForm.userId,
        companyId: selectedCompanyId,
        role: grantForm.role,
      });
      toast.success("Acesso concedido com sucesso!");
      setIsGrantModalOpen(false);
      setGrantForm({ userId: "", role: "operacional" });
      refetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Erro ao conceder acesso");
    }
  };

  const handleRevokeAccess = async (userId: string, userName: string) => {
    if (!selectedCompanyId) return;
    if (!confirm(`Tem certeza que deseja revogar o acesso de "${userName}" a esta empresa?`)) return;
    try {
      await revokeMutation.mutateAsync({
        userId,
        companyId: selectedCompanyId,
      });
      toast.success("Acesso revogado com sucesso!");
      refetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Erro ao revogar acesso");
    }
  };

  const handleUpdateRole = async (userId: string, newRole: "admin" | "operacional" | "consultor") => {
    if (!selectedCompanyId) return;
    try {
      await updateRoleMutation.mutateAsync({
        userId,
        companyId: selectedCompanyId,
        role: newRole,
      });
      toast.success("Permissão atualizada com sucesso!");
      refetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar permissão");
    }
  };

  const getRoleBadge = (role: string) => {
    const config: Record<string, { className: string; label: string }> = {
      admin: { className: "bg-amber-100 text-amber-700 border-amber-200", label: "Admin" },
      operacional: { className: "bg-blue-100 text-blue-700 border-blue-200", label: "Operacional" },
      consultor: { className: "bg-purple-100 text-purple-700 border-purple-200", label: "Consultor" },
    };
    const c = config[role] || { className: "bg-gray-100 text-gray-700", label: role };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Nunca";
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Gerenciar Acessos</h1>
          </div>
          <p className="text-muted-foreground">
            Controle quais usuários têm acesso a cada empresa
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Company Selection Panel */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5" />
                  Empresas
                </CardTitle>
                <CardDescription>Selecione uma empresa para gerenciar acessos</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingCompanies ? (
                  <div className="p-4 text-center text-muted-foreground">Carregando...</div>
                ) : (
                  <div className="divide-y">
                    {allCompanies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => setSelectedCompanyId(company.id)}
                        className={`w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors ${
                          selectedCompanyId === company.id ? "bg-muted border-l-4 border-l-primary" : ""
                        }`}
                      >
                        {company.logoUrl ? (
                          <img src={company.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{company.tradeName || company.name}</p>
                          <p className="text-xs text-muted-foreground">{company.segment || "—"}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Users Panel */}
          <div className="lg:col-span-2">
            {!selectedCompanyId ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Selecione uma empresa</h3>
                  <p className="text-muted-foreground">
                    Escolha uma empresa à esquerda para visualizar e gerenciar os acessos dos usuários
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Users className="h-5 w-5" />
                        Usuários — {selectedCompany?.tradeName || selectedCompany?.name}
                      </CardTitle>
                      <CardDescription>
                        {companyUsers.length} usuário{companyUsers.length !== 1 ? "s" : ""} com acesso
                      </CardDescription>
                    </div>
                    <Button onClick={() => setIsGrantModalOpen(true)} size="sm">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Liberar Acesso
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingUsers ? (
                    <div className="p-4 text-center text-muted-foreground">Carregando...</div>
                  ) : companyUsers.length === 0 ? (
                    <div className="p-8 text-center">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Nenhum usuário com acesso a esta empresa</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setIsGrantModalOpen(true)}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Liberar Primeiro Acesso
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Permissão na Empresa</TableHead>
                          <TableHead>Último Acesso</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companyUsers.map((uc) => (
                          <TableRow key={uc.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{uc.userName}</p>
                                <p className="text-xs text-muted-foreground">{uc.userEmail}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={uc.role}
                                onValueChange={(value: "admin" | "operacional" | "consultor") =>
                                  handleUpdateRole(uc.userId, value)
                                }
                                disabled={uc.userId === currentUser?.id}
                              >
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="operacional">Operacional</SelectItem>
                                  <SelectItem value="consultor">Consultor</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(uc.lastSignedIn)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRevokeAccess(uc.userId, uc.userName || "Usuário")}
                                disabled={uc.userId === currentUser?.id}
                                title={uc.userId === currentUser?.id ? "Você não pode revogar seu próprio acesso" : "Revogar acesso"}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Modal Liberar Acesso */}
        <Dialog open={isGrantModalOpen} onOpenChange={setIsGrantModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Liberar Acesso</DialogTitle>
              <DialogDescription>
                Conceda acesso de um usuário à empresa {selectedCompany?.tradeName || selectedCompany?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Usuário</label>
                <Select
                  value={grantForm.userId}
                  onValueChange={(value) => setGrantForm({ ...grantForm, userId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Todos os usuários já possuem acesso
                      </div>
                    ) : (
                      availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex flex-col">
                            <span>{user.name}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Permissão na Empresa</label>
                <Select
                  value={grantForm.role}
                  onValueChange={(value: "admin" | "operacional" | "consultor") =>
                    setGrantForm({ ...grantForm, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex flex-col">
                        <span>Admin</span>
                        <span className="text-xs text-muted-foreground">Acesso total à empresa</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="operacional">
                      <div className="flex flex-col">
                        <span>Operacional</span>
                        <span className="text-xs text-muted-foreground">Vendas, compras e operações</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="consultor">
                      <div className="flex flex-col">
                        <span>Consultor</span>
                        <span className="text-xs text-muted-foreground">Somente visualização</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsGrantModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleGrantAccess}
                disabled={!grantForm.userId || grantMutation.isPending}
              >
                {grantMutation.isPending ? "Liberando..." : "Liberar Acesso"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
