import DashboardLayout from "@/components/DashboardLayout";
import OperatorSecurityPanel from "@/components/OperatorSecurityPanel";
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

          {/* Tab: Segurança — operações reais, sem formulário fictício de senha OAuth */}
          <TabsContent value="seguranca" className="space-y-4">
            <OperatorSecurityPanel showEvents={false} />
          </TabsContent>

          {/* Tab: Atividades — eventos reais da própria conta */}
          <TabsContent value="atividades" className="space-y-4">
            <OperatorSecurityPanel showSessions={false} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
