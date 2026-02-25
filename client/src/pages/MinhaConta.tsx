import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { User, Lock, Activity, Camera, Trash2, Loader2, AlertCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export default function MinhaConta() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadAvatarMutation = trpc.users.uploadAvatar.useMutation({
    onSuccess: () => {
      toast.success("Foto atualizada com sucesso!");
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar foto: " + error.message);
    },
  });

  const removeAvatarMutation = trpc.users.removeAvatar.useMutation({
    onSuccess: () => {
      toast.success("Foto removida com sucesso!");
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error("Erro ao remover foto: " + error.message);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou GIF.");
      return;
    }

    // Validar tamanho
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 2MB.");
      return;
    }

    // Converter para base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      uploadAvatarMutation.mutate({
        avatarBase64: base64,
        contentType: file.type,
      });
    };
    reader.readAsDataURL(file);

    // Limpar input para permitir re-selecionar o mesmo arquivo
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAvatar = () => {
    removeAvatarMutation.mutate();
  };

  const handleSave = () => {
    // TODO: Implementar atualização de perfil via tRPC
    setIsEditing(false);
  };

  const isUploading = uploadAvatarMutation.isPending || removeAvatarMutation.isPending;

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    user: "Usuário",
    operacional: "Operacional",
    consultor: "Consultor",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Minha Conta</h1>
          <p className="text-muted-foreground">
            Gerencie suas informações pessoais e configurações
          </p>
        </div>

        <Tabs defaultValue="perfil" className="space-y-4">
          <TabsList>
            <TabsTrigger value="perfil">
              <User className="h-4 w-4 mr-2" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="seguranca">
              <Lock className="h-4 w-4 mr-2" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="atividades">
              <Activity className="h-4 w-4 mr-2" />
              Atividades
            </TabsTrigger>
          </TabsList>

          {/* Tab: Perfil */}
          <TabsContent value="perfil" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações Pessoais</CardTitle>
                <CardDescription>
                  Atualize suas informações de perfil
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                  {/* Avatar com upload */}
                  <div className="relative group">
                    <div className="h-20 w-20 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                      {isUploading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name || "Avatar"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        user?.name?.charAt(0).toUpperCase() || "U"
                      )}
                    </div>
                    {/* Overlay ao hover */}
                    {!isUploading && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Camera className="h-6 w-6 text-white" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Camera className="h-4 w-4 mr-2" />
                            Alterar Foto
                          </>
                        )}
                      </Button>
                      {user?.avatarUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveAvatar}
                          disabled={isUploading}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG ou GIF. Máximo 2MB.
                    </p>
                  </div>
                  {/* Input file oculto */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                <Separator />

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Função</Label>
                    <Input value={roleLabels[user?.role || 'user'] || user?.role || 'Usuário'} disabled />
                  </div>
                </div>

                <div className="flex gap-2">
                  {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)}>
                      Editar Perfil
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleSave}>Salvar Alterações</Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Segurança */}
          <TabsContent value="seguranca" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
                <CardDescription>
                  Mantenha sua conta segura com uma senha forte
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="current-password">Senha Atual</Label>
                    <Input id="current-password" type="password" />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="new-password">Nova Senha</Label>
                    <Input id="new-password" type="password" />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                </div>

                <Button>Atualizar Senha</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sessões Ativas</CardTitle>
                <CardDescription>
                  Gerencie suas sessões ativas em diferentes dispositivos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Navegador Atual</p>
                      <p className="text-sm text-muted-foreground">
                        Último acesso: Agora
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Encerrar Sessão
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Atividades */}
          <TabsContent value="atividades" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Atividades</CardTitle>
                <CardDescription>
                  Acompanhe suas ações recentes no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Módulo de Auditoria em Desenvolvimento
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md mb-6">
                    O histórico de atividades será habilitado quando o módulo de auditoria for implementado.
                    Ele registrará todas as ações realizadas no sistema para garantir rastreabilidade e segurança.
                  </p>
                  <div className="w-full max-w-md">
                    <Separator className="mb-4" />
                    <p className="text-xs font-medium text-muted-foreground mb-3 text-left">O que será registrado:</p>
                    <div className="grid grid-cols-2 gap-2 text-left">
                      {[
                        "Logins e logouts",
                        "Criação de vendas",
                        "Alterações de estoque",
                        "Cadastro de produtos",
                        "Edição de preços",
                        "Movimentações financeiras",
                        "Alterações de permissões",
                        "Troca de empresa/filial",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground/70">
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
