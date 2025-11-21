import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, User, Clock } from "lucide-react";
import { toast } from "sonner";
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

export default function Usuarios() {
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; currentRole: string } | null>(null);
  const [actionType, setActionType] = useState<"promote" | "demote" | null>(null);

  const { data: users, isLoading, refetch } = trpc.users.list.useQuery();
  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success(actionType === "promote" ? "Usuário promovido a administrador" : "Usuário rebaixado para usuário comum");
      refetch();
      setSelectedUser(null);
      setActionType(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao alterar permissões");
    },
  });

  const handlePromote = (user: any) => {
    setSelectedUser({ id: user.id, name: user.name || "Usuário sem nome", currentRole: user.role });
    setActionType("promote");
  };

  const handleDemote = (user: any) => {
    setSelectedUser({ id: user.id, name: user.name || "Usuário sem nome", currentRole: user.role });
    setActionType("demote");
  };

  const confirmAction = () => {
    if (!selectedUser) return;
    updateRoleMutation.mutate({
      userId: selectedUser.id,
      role: actionType === "promote" ? "admin" : "user",
    });
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

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
        </div>
        <p>Carregando usuários...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Gerencie permissões de acesso dos usuários do sistema
      </p>

      <div className="grid gap-4">
        {users?.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {user.role === "admin" ? (
                    <ShieldCheck className="h-8 w-8 text-blue-500" />
                  ) : (
                    <User className="h-8 w-8 text-gray-500" />
                  )}
                  <div>
                    <CardTitle className="text-xl">{user.name || "Usuário sem nome"}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      {user.email || "Email não informado"}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role === "admin" ? "Administrador" : "Usuário"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Último acesso: {formatDate(user.lastSignedIn)}</span>
                  </div>
                  <div>
                    Cadastrado em: {formatDate(user.createdAt)}
                  </div>
                </div>
                <div className="flex gap-2">
                  {user.role === "user" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePromote(user)}
                      disabled={updateRoleMutation.isPending}
                    >
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Promover a Admin
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDemote(user)}
                      disabled={updateRoleMutation.isPending}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Rebaixar para Usuário
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {users?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum usuário cadastrado ainda
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "promote" ? "Promover usuário?" : "Rebaixar administrador?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "promote" ? (
                <>
                  Você está prestes a promover <strong>{selectedUser?.name}</strong> para{" "}
                  <strong>Administrador</strong>. Este usuário terá acesso total ao sistema,
                  incluindo visualização de custos, relatórios financeiros e gerenciamento de
                  usuários.
                </>
              ) : (
                <>
                  Você está prestes a rebaixar <strong>{selectedUser?.name}</strong> para{" "}
                  <strong>Usuário comum</strong>. Este usuário perderá acesso a funcionalidades
                  administrativas e relatórios financeiros.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
