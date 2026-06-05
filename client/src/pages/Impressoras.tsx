import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Printer, Plus, Pencil, Trash2, Wifi, Usb, Bluetooth, ChefHat, Wine, CreditCard, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const DEPARTMENT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  KITCHEN: { label: "Cozinha", icon: ChefHat, color: "bg-orange-100 text-orange-700 border-orange-200" },
  BAR: { label: "Bar", icon: Wine, color: "bg-purple-100 text-purple-700 border-purple-200" },
  CASHIER: { label: "Caixa", icon: CreditCard, color: "bg-green-100 text-green-700 border-green-200" },
};

const CONNECTION_LABELS: Record<string, { label: string; icon: any }> = {
  NETWORK: { label: "Rede (Wi-Fi/Ethernet)", icon: Wifi },
  USB: { label: "USB", icon: Usb },
  BLUETOOTH: { label: "Bluetooth", icon: Bluetooth },
};

type PrinterForm = {
  name: string;
  department: "KITCHEN" | "BAR" | "CASHIER";
  connectionType: "NETWORK" | "USB" | "BLUETOOTH";
  ipAddress: string;
  port: number;
  paperWidth: "58mm" | "80mm";
};

const defaultForm: PrinterForm = {
  name: "",
  department: "KITCHEN",
  connectionType: "NETWORK",
  ipAddress: "",
  port: 9100,
  paperWidth: "80mm",
};

export default function Impressoras() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.companyId ?? 0;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PrinterForm>(defaultForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: printersList, isLoading } = trpc.printers.list.useQuery(
    { companyId },
    { enabled: companyId > 0 }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.printers.create.useMutation({
    onSuccess: () => {
      toast.success("Impressora cadastrada com sucesso!");
      utils.printers.list.invalidate();
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.printers.update.useMutation({
    onSuccess: () => {
      toast.success("Impressora atualizada!");
      utils.printers.list.invalidate();
      setDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.printers.delete.useMutation({
    onSuccess: () => {
      toast.success("Impressora removida!");
      utils.printers.list.invalidate();
      setDeleteConfirm(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Nome da impressora é obrigatório");
      return;
    }
    if (form.connectionType === "NETWORK" && !form.ipAddress.trim()) {
      toast.error("Endereço IP é obrigatório para conexão de rede");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        companyId,
        name: form.name,
        department: form.department,
        connectionType: form.connectionType,
        ipAddress: form.ipAddress || null,
        port: form.port,
        paperWidth: form.paperWidth,
      });
    } else {
      createMutation.mutate({
        companyId,
        name: form.name,
        department: form.department,
        connectionType: form.connectionType,
        ipAddress: form.ipAddress || undefined,
        port: form.port,
        paperWidth: form.paperWidth,
      });
    }
  };

  const handleEdit = (printer: any) => {
    setEditingId(printer.id);
    setForm({
      name: printer.name,
      department: printer.department,
      connectionType: printer.connectionType,
      ipAddress: printer.ipAddress || "",
      port: printer.port || 9100,
      paperWidth: printer.paperWidth || "80mm",
    });
    setDialogOpen(true);
  };

  const handleToggleActive = (printer: any) => {
    updateMutation.mutate({
      id: printer.id,
      companyId,
      active: !printer.active,
    });
  };

  // Group printers by department
  const grouped = {
    KITCHEN: printersList?.filter(p => p.department === "KITCHEN") || [],
    BAR: printersList?.filter(p => p.department === "BAR") || [],
    CASHIER: printersList?.filter(p => p.department === "CASHIER") || [],
  };

  return (
    <div className="container max-w-4xl py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/salao/mesas">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Printer className="h-6 w-6" />
            Impressoras
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure as impressoras por departamento para impressão automática de pedidos
          </p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(defaultForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Impressora
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(["KITCHEN", "BAR", "CASHIER"] as const).map(dept => {
          const info = DEPARTMENT_LABELS[dept];
          const Icon = info.icon;
          const count = grouped[dept].filter(p => p.active).length;
          return (
            <Card key={dept} className={`border ${count > 0 ? 'border-green-200 bg-green-50/50' : 'border-dashed border-muted-foreground/30'}`}>
              <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${info.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">{info.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {count > 0 ? `${count} impressora${count > 1 ? 's' : ''} ativa${count > 1 ? 's' : ''}` : 'Não configurada'}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Printer List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : !printersList || printersList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Printer className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-2">Nenhuma impressora configurada</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Configure impressoras para Cozinha, Bar e Caixa para impressão automática dos pedidos.
            </p>
            <Button onClick={() => { setEditingId(null); setForm(defaultForm); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeira Impressora
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(["KITCHEN", "BAR", "CASHIER"] as const).map(dept => {
            const deptPrinters = grouped[dept];
            if (deptPrinters.length === 0) return null;
            const info = DEPARTMENT_LABELS[dept];
            const Icon = info.icon;
            return (
              <div key={dept}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{info.label}</h3>
                </div>
                <div className="space-y-2 mb-4">
                  {deptPrinters.map(printer => {
                    const connInfo = CONNECTION_LABELS[printer.connectionType];
                    const ConnIcon = connInfo.icon;
                    return (
                      <Card key={printer.id} className={`${!printer.active ? 'opacity-50' : ''}`}>
                        <CardContent className="py-3 px-4 flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${info.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{printer.name}</p>
                              {!printer.active && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <ConnIcon className="h-3 w-3" />
                                {connInfo.label}
                              </span>
                              {printer.ipAddress && (
                                <span className="font-mono">{printer.ipAddress}:{printer.port}</span>
                              )}
                              <span>{printer.paperWidth}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={printer.active}
                              onCheckedChange={() => handleToggleActive(printer)}
                              className="scale-90"
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(printer)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(printer.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Card */}
      <Card className="mt-6 bg-blue-50/50 border-blue-200">
        <CardContent className="py-4 px-4">
          <h4 className="font-medium text-sm mb-2">Como funciona a impressão automática</h4>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li className="flex items-start gap-2">
              <ChefHat className="h-3.5 w-3.5 mt-0.5 text-orange-600 shrink-0" />
              <span><strong>Cozinha:</strong> Recebe automaticamente os itens com destino "Cozinha" quando adicionados à comanda</span>
            </li>
            <li className="flex items-start gap-2">
              <Wine className="h-3.5 w-3.5 mt-0.5 text-purple-600 shrink-0" />
              <span><strong>Bar:</strong> Recebe automaticamente os itens com destino "Bar" quando adicionados à comanda</span>
            </li>
            <li className="flex items-start gap-2">
              <CreditCard className="h-3.5 w-3.5 mt-0.5 text-green-600 shrink-0" />
              <span><strong>Caixa:</strong> Imprime o cupom da comanda ao encerrar a conta</span>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground mt-3 border-t border-blue-200 pt-2">
            A impressão via rede requer que a impressora esteja conectada à mesma rede Wi-Fi do dispositivo. 
            O navegador enviará o comando de impressão diretamente para o IP configurado.
          </p>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingId(null); setForm(defaultForm); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Impressora" : "Nova Impressora"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome da Impressora</Label>
              <Input
                placeholder="Ex: Impressora Cozinha Principal"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Departamento</Label>
              <Select value={form.department} onValueChange={(v: any) => setForm({ ...form, department: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KITCHEN">
                    <span className="flex items-center gap-2"><ChefHat className="h-4 w-4" /> Cozinha</span>
                  </SelectItem>
                  <SelectItem value="BAR">
                    <span className="flex items-center gap-2"><Wine className="h-4 w-4" /> Bar</span>
                  </SelectItem>
                  <SelectItem value="CASHIER">
                    <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Caixa</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Conexão</Label>
              <Select value={form.connectionType} onValueChange={(v: any) => setForm({ ...form, connectionType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NETWORK">
                    <span className="flex items-center gap-2"><Wifi className="h-4 w-4" /> Rede (Wi-Fi/Ethernet)</span>
                  </SelectItem>
                  <SelectItem value="USB">
                    <span className="flex items-center gap-2"><Usb className="h-4 w-4" /> USB</span>
                  </SelectItem>
                  <SelectItem value="BLUETOOTH">
                    <span className="flex items-center gap-2"><Bluetooth className="h-4 w-4" /> Bluetooth</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.connectionType === "NETWORK" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Endereço IP</Label>
                  <Input
                    placeholder="192.168.1.100"
                    value={form.ipAddress}
                    onChange={e => setForm({ ...form, ipAddress: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Porta</Label>
                  <Input
                    type="number"
                    value={form.port}
                    onChange={e => setForm({ ...form, port: parseInt(e.target.value) || 9100 })}
                  />
                </div>
              </div>
            )}
            <div>
              <Label>Largura do Papel</Label>
              <Select value={form.paperWidth} onValueChange={(v: any) => setForm({ ...form, paperWidth: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">80mm (padrão)</SelectItem>
                  <SelectItem value="58mm">58mm (compacta)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); setForm(defaultForm); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover Impressora</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja remover esta impressora? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteConfirm) deleteMutation.mutate({ id: deleteConfirm, companyId }); }}
              disabled={deleteMutation.isPending}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
