import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, ClipboardList, FilePenLine, Loader2, Plus, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value || 0);

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const parseCurrencyInput = (value: string) => {
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  return Number(normalized);
};

type DraftForm = {
  adjustmentDate: string;
  amount: string;
  description: string;
  notes: string;
};

const initialForm: DraftForm = {
  adjustmentDate: "",
  amount: "",
  description: "Faturamento histórico de Balcão — pós-backup de 11/08/2026",
  notes: "Valor agregado informado para implantação histórica. Não possui produtos, formas de pagamento ou movimentações de estoque detalhadas.",
};

export default function AjustesFaturamentoHistorico() {
  const { activeCompany } = useCompany();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<DraftForm>(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  const { data: adjustments = [], isLoading } = trpc.historicalRevenueAdjustments.list.useQuery();
  const { data: summary } = trpc.historicalRevenueAdjustments.summary.useQuery();

  const createDraft = trpc.historicalRevenueAdjustments.createDraft.useMutation({
    onSuccess: () => {
      toast.success("Rascunho de faturamento histórico criado.");
      setForm(initialForm);
      setShowForm(false);
      utils.historicalRevenueAdjustments.list.invalidate();
      utils.historicalRevenueAdjustments.summary.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteDraft = trpc.historicalRevenueAdjustments.deleteDraft.useMutation({
    onSuccess: () => {
      toast.success("Rascunho removido.");
      utils.historicalRevenueAdjustments.list.invalidate();
      utils.historicalRevenueAdjustments.summary.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const refreshAfterStatusChange = () => {
    utils.historicalRevenueAdjustments.list.invalidate();
    utils.historicalRevenueAdjustments.summary.invalidate();
    utils.sales.calendar.invalidate();
    utils.sales.monthlyStats.invalidate();
    utils.dashboard.stats.invalidate();
    utils.invalidate();
  };

  const approveDrafts = trpc.historicalRevenueAdjustments.approveDrafts.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count} ajuste(s) publicados na visão gerencial.`);
      setShowApprovalDialog(false);
      refreshAfterStatusChange();
    },
    onError: (error) => toast.error(error.message),
  });

  const cancelApproved = trpc.historicalRevenueAdjustments.cancelApproved.useMutation({
    onSuccess: () => {
      toast.success("Ajuste cancelado e removido das análises gerenciais.");
      setCancelTarget(null);
      setCancellationReason("");
      refreshAfterStatusChange();
    },
    onError: (error) => toast.error(error.message),
  });

  const draftTotal = summary?.DRAFT.total || 0;
  const approvedTotal = summary?.APPROVED.total || 0;
  const pendingDates = useMemo(() => ["2026-08-22", "2026-08-24"], []);
  const draftIds = useMemo(() => adjustments.filter((adjustment) => adjustment.status === "DRAFT").map((adjustment) => adjustment.id), [adjustments]);

  const handleCreate = () => {
    const amount = parseCurrencyInput(form.amount);
    if (!form.adjustmentDate || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe uma data e um valor maior que zero.");
      return;
    }
    createDraft.mutate({
      adjustmentDate: form.adjustmentDate,
      amount,
      description: form.description,
      notes: form.notes || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <ClipboardList className="h-6 w-6" />
              <h1 className="text-2xl font-bold tracking-tight">Implantação Histórica de Faturamento</h1>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Valores agregados preservados separadamente das vendas operacionais. Enquanto estiverem em rascunho, não afetam faturamento, estoque, caixa, Contas a Receber ou contabilidade.
            </p>
          </div>
          <Button onClick={() => setShowForm((open) => !open)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo rascunho
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Empresa ativa</CardDescription><CardTitle className="text-lg">{activeCompany?.tradeName || activeCompany?.name || "Empresa"}</CardTitle></CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Total em rascunho</CardDescription><CardTitle className="text-2xl text-amber-700">{formatCurrency(draftTotal)}</CardTitle></CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Publicado em análises</CardDescription><CardTitle className="text-2xl text-emerald-700">{formatCurrency(approvedTotal)}</CardTitle></CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Dias ainda pendentes de apuração</CardDescription><CardTitle className="text-lg">22/08 e 24/08/2026</CardTitle></CardHeader>
          </Card>
        </div>

        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="flex gap-3 pt-5 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <p><strong>Escopo controlado:</strong> ajustes aprovados entram somente no faturamento gerencial por data e canal. Eles não criam vendas, produtos, formas de pagamento, estoque, caixa, Contas a Receber, CMV, DRE ou lançamentos contábeis. Quantidade de vendas e ticket médio continuam baseados exclusivamente nas vendas reais.</p>
          </CardContent>
        </Card>

        {draftIds.length > 0 && (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardContent className="flex flex-col gap-4 pt-5 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-3 text-sm text-emerald-950">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <p><strong>Pronto para publicação controlada:</strong> {draftIds.length} rascunho(s), total de {formatCurrency(draftTotal)}, serão disponibilizados em análises gerenciais da empresa ativa.</p>
              </div>
              <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setShowApprovalDialog(true)} disabled={approveDrafts.isPending}>
                {approveDrafts.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Publicar {draftIds.length} rascunho(s)
              </Button>
            </CardContent>
          </Card>
        )}

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FilePenLine className="h-5 w-5" /> Novo ajuste em rascunho</CardTitle>
              <CardDescription>Use somente valores agregados cuja origem esteja documentada.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adjustmentDate">Data de competência</Label>
                <Input id="adjustmentDate" type="date" value={form.adjustmentDate} onChange={(event) => setForm({ ...form, adjustmentDate: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Valor agregado (R$)</Label>
                <Input id="amount" inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Descrição</Label>
                <Input id="description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Observação de origem</Label>
                <textarea id="notes" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </div>
              <div className="flex justify-end gap-2 md:col-span-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={createDraft.isPending}>
                  {createDraft.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar rascunho
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ajustes cadastrados</CardTitle>
            <CardDescription>Canal fixado em Balcão para esta primeira etapa da Adega Beira Rio.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando rascunhos...</div>
            ) : adjustments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhum rascunho foi cadastrado para a empresa ativa.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr><th className="px-3 py-3 font-medium">Data</th><th className="px-3 py-3 font-medium">Canal</th><th className="px-3 py-3 font-medium">Descrição</th><th className="px-3 py-3 font-medium">Valor</th><th className="px-3 py-3 font-medium">Situação</th><th className="px-3 py-3 font-medium text-right">Ação</th></tr>
                  </thead>
                  <tbody>
                    {adjustments.map((adjustment) => (
                      <tr key={adjustment.id} className="border-b last:border-0">
                        <td className="px-3 py-3">{formatDate(adjustment.adjustmentDate)}</td>
                        <td className="px-3 py-3">Balcão</td>
                        <td className="px-3 py-3"><p className="font-medium">{adjustment.description}</p><p className="mt-1 max-w-xl text-xs text-muted-foreground">{adjustment.notes || "Sem observação adicional."}</p></td>
                        <td className="px-3 py-3 font-semibold">{formatCurrency(adjustment.amount)}</td>
                        <td className="px-3 py-3">
                          {adjustment.status === "DRAFT" && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Rascunho</Badge>}
                          {adjustment.status === "APPROVED" && <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">Publicado</Badge>}
                          {adjustment.status === "CANCELLED" && <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">Cancelado</Badge>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {adjustment.status === "DRAFT" && <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteDraft.mutate({ id: adjustment.id })} disabled={deleteDraft.isPending} aria-label={`Excluir ajuste de ${formatDate(adjustment.adjustmentDate)}`}><Trash2 className="h-4 w-4" /></Button>}
                          {adjustment.status === "APPROVED" && <Button variant="ghost" size="sm" className="text-slate-700" onClick={() => setCancelTarget(adjustment)} disabled={cancelApproved.isPending}><Undo2 className="mr-1 h-4 w-4" /> Cancelar</Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td colSpan={3} className="px-3 py-4 font-semibold">Total em rascunho</td><td className="px-3 py-4 font-bold">{formatCurrency(draftTotal)}</td><td colSpan={2} /></tr></tfoot>
                </table>
              </div>
            )}
            <Separator className="my-5" />
            <p className="text-xs text-muted-foreground">Pendências registradas para inclusão posterior: {pendingDates.map(formatDate).join(" e ")}. Elas não compõem o total atual.</p>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar implantação histórica?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão aprovados <strong>{draftIds.length} ajustes diários de Balcão</strong> da empresa ativa, no total de <strong>{formatCurrency(draftTotal)}</strong>. O valor passará a compor faturamento gerencial e análise por canal, mas não gerará vendas, estoque, caixa, clientes, CMV, DRE ou contabilidade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-emerald-700 hover:bg-emerald-800" onClick={() => approveDrafts.mutate({ ids: draftIds })} disabled={approveDrafts.isPending}>
              {approveDrafts.isPending ? "Publicando..." : "Confirmar publicação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar ajuste publicado?</AlertDialogTitle>
            <AlertDialogDescription>
              O ajuste de {cancelTarget && formatDate(cancelTarget.adjustmentDate)} será removido das análises gerenciais. Informe a justificativa para preservar a auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} placeholder="Ex.: valor diário corrigido após nova apuração" />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancellationReason("")}>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => cancelTarget && cancelApproved.mutate({ id: cancelTarget.id, reason: cancellationReason })} disabled={cancelApproved.isPending || cancellationReason.trim().length < 3}>
              {cancelApproved.isPending ? "Cancelando..." : "Confirmar cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
