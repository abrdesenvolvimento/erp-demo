import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Store, Bike, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ChannelFormData {
  code: string;
  name: string;
  type: "BALCAO" | "DELIVERY";
  active: boolean;
  commissionPercent: string;
  fixedFeePerOrder: string;
  paymentDays: number;
  description: string;
}

const defaultFormData: ChannelFormData = {
  code: "",
  name: "",
  type: "BALCAO",
  active: true,
  commissionPercent: "0.00",
  fixedFeePerOrder: "0.00",
  paymentDays: 0,
  description: "",
};

export default function CanaisVenda() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ChannelFormData>(defaultFormData);
  const [showInactive, setShowInactive] = useState(false);

  const { data: channels = [], isLoading } = trpc.salesChannels.list.useQuery(
    { activeOnly: !showInactive },
    { staleTime: 30000 }
  );

  const utils = trpc.useUtils();

  const createChannel = trpc.salesChannels.create.useMutation({
    onSuccess: () => {
      toast.success("Canal criado com sucesso");
      utils.salesChannels.list.invalidate();
      handleCloseModal();
    },
    onError: (err) => toast.error("Erro ao criar canal: " + err.message),
  });

  const updateChannel = trpc.salesChannels.update.useMutation({
    onSuccess: () => {
      toast.success("Canal atualizado com sucesso");
      utils.salesChannels.list.invalidate();
      handleCloseModal();
    },
    onError: (err) => toast.error("Erro ao atualizar canal: " + err.message),
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (channel: any) => {
    setEditingId(channel.id);
    setFormData({
      code: channel.code,
      name: channel.name,
      type: channel.type,
      active: channel.active,
      commissionPercent: channel.commissionPercent || "0.00",
      fixedFeePerOrder: channel.fixedFeePerOrder || "0.00",
      paymentDays: channel.paymentDays || 0,
      description: channel.description || "",
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Código e nome são obrigatórios");
      return;
    }

    if (editingId) {
      updateChannel.mutate({
        id: editingId,
        ...formData,
      });
    } else {
      createChannel.mutate(formData);
    }
  };

  const formatPercent = (value: string | null) => {
    if (!value) return "0,00%";
    return `${parseFloat(value).toFixed(2).replace(".", ",")}%`;
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return "R$ 0,00";
    return `R$ ${parseFloat(value).toFixed(2).replace(".", ",")}`;
  };

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Canais de Venda</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie os canais de venda e suas regras de negócio (comissões, taxas, prazos)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={showInactive}
                onCheckedChange={setShowInactive}
                id="show-inactive"
              />
              <Label htmlFor="show-inactive" className="text-sm text-muted-foreground">
                Mostrar inativos
              </Label>
            </div>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Canal
            </Button>
          </div>
        </div>

        {/* Tabela de Canais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Canais Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
              </div>
            ) : channels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Store className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>Nenhum canal cadastrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        Comissão
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Percentual cobrado pela plataforma sobre cada venda
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        Taxa Fixa
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Valor fixo cobrado por pedido (ex: taxa de entrega)
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        Prazo Pgto
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Dias para recebimento do valor pela plataforma
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channels.map((channel: any) => (
                    <TableRow key={channel.id} className={!channel.active ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${channel.type === "DELIVERY" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"}`}>
                            {channel.type === "DELIVERY" ? <Bike className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="font-medium">{channel.name}</div>
                            <div className="text-xs text-muted-foreground">{channel.code}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={channel.type === "DELIVERY" ? "secondary" : "outline"}>
                          {channel.type === "DELIVERY" ? "Delivery" : "Balcão"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {formatPercent(channel.commissionPercent)}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {formatCurrency(channel.fixedFeePerOrder)}
                      </TableCell>
                      <TableCell className="text-center">
                        {channel.paymentDays ? `${channel.paymentDays} dias` : "Imediato"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={channel.active ? "default" : "destructive"}>
                          {channel.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(channel)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Informativo */}
        <Card className="bg-amber-50/50 border-amber-200">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800 space-y-1">
                <p className="font-medium">Como funcionam as regras de negócio dos canais</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                  <li><strong>Comissão (%)</strong>: Percentual cobrado pela plataforma sobre cada venda (ex: iFood cobra ~27%)</li>
                  <li><strong>Taxa Fixa (R$)</strong>: Valor fixo cobrado por pedido, independente do valor da venda</li>
                  <li><strong>Prazo de Pagamento</strong>: Dias que a plataforma leva para repassar o valor (ex: iFood repassa em ~30 dias)</li>
                  <li>Essas informações são usadas na <strong>Análise de Delivery</strong> para calcular a margem líquida real</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Criação/Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Canal de Venda" : "Novo Canal de Venda"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="Ex: IFOOD"
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Delivery iFood"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as "BALCAO" | "DELIVERY" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BALCAO">Balcão</SelectItem>
                    <SelectItem value="DELIVERY">Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="active">Status</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(v) => setFormData({ ...formData, active: v })}
                  />
                  <span className="text-sm">{formData.active ? "Ativo" : "Inativo"}</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Regras de Negócio</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="commission">Comissão (%)</Label>
                  <Input
                    id="commission"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.commissionPercent}
                    onChange={(e) => setFormData({ ...formData, commissionPercent: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fixedFee">Taxa Fixa (R$)</Label>
                  <Input
                    id="fixedFee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.fixedFeePerOrder}
                    onChange={(e) => setFormData({ ...formData, fixedFeePerOrder: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentDays">Prazo (dias)</Label>
                  <Input
                    id="paymentDays"
                    type="number"
                    min="0"
                    value={formData.paymentDays}
                    onChange={(e) => setFormData({ ...formData, paymentDays: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição / Observações</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Informações adicionais sobre o canal..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createChannel.isPending || updateChannel.isPending}
            >
              {createChannel.isPending || updateChannel.isPending ? "Salvando..." : editingId ? "Salvar" : "Criar Canal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
