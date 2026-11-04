import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import {
  Target, Plus, Edit, TrendingUp, TrendingDown, CheckCircle2,
  History, Store, CreditCard, Flame, Trophy, ArrowRight, Calendar, Trash2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { AnnualGoalChart } from "@/components/metas/AnnualGoalChart";
import { GoalComparison } from "@/components/metas/GoalComparison";
import { GOAL_MONTHS, getGoalBrazilDate, goalDailyPace, goalPeriodStatus, offsetGoalMonth } from "@shared/metas";

/* ─── constantes ─── */
const MONTHS = GOAL_MONTHS;

const IFOOD_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663140687549/7RkrCeS5KipYf8hkuNqrCk/ifood-logo-official_825ad8bc.jpg";
const NINETY_NINE_FOOD_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663140687549/7RkrCeS5KipYf8hkuNqrCk/99food-logo_54a15810.png";

/* ─── helpers visuais ─── */
function ChannelIcon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  const n = name.toLowerCase();
  if (n.includes("ifood")) return <img src={IFOOD_LOGO_URL} alt="iFood" className={`${className} object-contain`} />;
  if (n.includes("99") || n.includes("ninety") || n.includes("99food")) return <img src={NINETY_NINE_FOOD_LOGO_URL} alt="99Food" className={`${className} object-contain rounded`} />;
  if (n.includes("balcão") || n.includes("prazo") || n.includes("balcao")) return <Store className={className} />;
  if (n.includes("geral") || n.includes("all")) return <Target className={className} />;
  return <CreditCard className={className} />;
}

function channelColors(name: string) {
  const n = name.toLowerCase();
  if (n.includes("ifood"))
    return { gradient: "from-red-500 to-red-600", light: "bg-red-50 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400", border: "border-red-200 dark:border-red-800" };
  if (n.includes("99") || n.includes("99food"))
    return { gradient: "from-yellow-500 to-amber-500", light: "bg-yellow-50 dark:bg-yellow-950/30", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-200 dark:border-yellow-800" };
  if (n.includes("balcão") || n.includes("prazo") || n.includes("balcao"))
    return { gradient: "from-blue-500 to-blue-600", light: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" };
  if (n.includes("geral") || n.includes("all"))
    return { gradient: "from-amber-500 to-amber-600", light: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" };
  return { gradient: "from-purple-500 to-purple-600", light: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-600 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" };
}

/* ─── gauge circular SVG ─── */
function CircularGauge({ progress, achieved, future = false, size = 110, strokeWidth = 9 }: { progress: number | null; achieved: boolean; future?: boolean; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = future ? 0 : Math.max(0, Math.min(progress ?? 0, 100));
  const offset = circ - (clamped / 100) * circ;

  let color = future || progress === null ? "stroke-muted-foreground" : "stroke-red-400";
  let glow = "";
  if (achieved) { color = "stroke-emerald-500"; glow = "drop-shadow(0 0 6px rgba(16,185,129,.35))"; }
  else if ((progress ?? 0) >= 80) color = "stroke-amber-500";
  else if ((progress ?? 0) >= 50) color = "stroke-orange-400";

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size, filter: glow }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/30" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} className={`${color} transition-all duration-700 ease-out`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold leading-none ${achieved ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
          {future ? "—" : progress === null ? "—" : `${progress.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
        </span>
        {achieved && <Trophy className="h-3.5 w-3.5 text-amber-500 mt-1" />}
      </div>
    </div>
  );
}

/* ─── formatadores ─── */
const fmtCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtShort = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmtCurrency(v);
const monthLabel = (m: number) => MONTHS.find(x => x.value === m)?.label ?? "";
const monthShort = (m: number) => MONTHS.find(x => x.value === m)?.short ?? "";

/* ═══════════════════════════════════════════ COMPONENTE ═══════════════════════════════════════════ */
export default function Metas() {
  const { goals: goalsPermissions } = usePermissions();
  const canEdit = goalsPermissions.canEdit;

  const [initialBrazilDate] = useState(() => getGoalBrazilDate());
  const [selectedYear, setSelectedYear] = useState(initialBrazilDate.year);
  const [selectedMonth, setSelectedMonth] = useState(initialBrazilDate.month);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [formMonth, setFormMonth] = useState(initialBrazilDate.month);
  const [formChannelId, setFormChannelId] = useState<string>("geral");
  const [formTargetAmount, setFormTargetAmount] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const utils = trpc.useUtils();

  /* ── queries ── */
  const { data: goals, isLoading: goalsLoading } = trpc.goals.list.useQuery({ year: selectedYear });
  const { data: channels } = trpc.salesChannels.list.useQuery();
  const annualQuery = trpc.goals.annualProgress.useQuery({ year: selectedYear });
  const { data: annual } = annualQuery;
  const previousAnnualQuery = trpc.goals.annualProgress.useQuery({ year: selectedYear - 1 }, { enabled: selectedMonth <= 2 });
  const currentDate = annual?.current ?? initialBrazilDate;
  const currentYear = currentDate.year;
  const currentMonth = currentDate.month;
  const selectedPeriod = { year: selectedYear, month: selectedMonth };
  const periodStatus = goalPeriodStatus(selectedPeriod, currentDate);
  const isActivePeriod = periodStatus === "active";
  const isFuturePeriod = periodStatus === "future";
  const progress = annual?.months.find(period => period.month === selectedMonth);
  const { data: history, isLoading: historyLoading } = trpc.goals.history.useQuery({ year: selectedYear });

  // Os dois meses anteriores são relativos ao período escolhido, incluindo a virada do ano.
  const { month: pm1, year: py1 } = offsetGoalMonth(selectedPeriod, -1);
  const { month: pm2, year: py2 } = offsetGoalMonth(selectedPeriod, -2);
  const prev1 = (py1 === selectedYear ? annual : previousAnnualQuery.data)?.months.find(period => period.month === pm1);
  const prev2 = (py2 === selectedYear ? annual : previousAnnualQuery.data)?.months.find(period => period.month === pm2);

  /* ── mutations ── */
  const upsertMutation = trpc.goals.upsert.useMutation({
    onSuccess: () => {
      toast.success(editingGoal ? "Meta atualizada!" : "Meta criada!");
      utils.goals.list.invalidate();
      utils.goals.progress.invalidate();
      utils.goals.history.invalidate();
      utils.goals.annualProgress.invalidate();
      closeDialog();
    },
    onError: (e) => toast.error("Erro ao salvar meta: " + e.message),
  });

  const deleteMutation = trpc.goals.delete.useMutation({
    onSuccess: () => {
      toast.success("Meta excluída com sucesso!");
      utils.goals.list.invalidate();
      utils.goals.progress.invalidate();
      utils.goals.history.invalidate();
      utils.goals.annualProgress.invalidate();
      setDeleteConfirm(null);
    },
    onError: (e) => toast.error("Erro ao excluir meta: " + e.message),
  });

  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);

  /* ── dialog helpers ── */
  const openDialog = (goal?: any) => {
    if (goal) {
      setEditingGoal(goal);
      setFormMonth(goal.month);
      setFormChannelId(goal.channelId ? goal.channelId.toString() : "geral");
      setFormTargetAmount(Number(goal.targetAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setFormNotes(goal.notes || "");
    } else {
      setEditingGoal(null);
      setFormMonth(selectedMonth);
      setFormChannelId("geral");
      setFormTargetAmount("");
      setFormNotes("");
    }
    setIsDialogOpen(true);
  };
  const closeDialog = () => { setIsDialogOpen(false); setEditingGoal(null); setFormMonth(selectedMonth); setFormChannelId("geral"); setFormTargetAmount(""); setFormNotes(""); };

  const handleSubmit = () => {
    const val = parseFloat(formTargetAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(val) || val <= 0) { toast.error("Informe um valor válido para a meta"); return; }
    upsertMutation.mutate({ year: selectedYear, month: formMonth, channelId: formChannelId === "geral" ? null : parseInt(formChannelId), targetAmount: val, notes: formNotes || undefined });
  };

  /* ── dados derivados ── */
  const goalsByMonth = useMemo(() => {
    if (!goals) return {} as Record<number, any[]>;
    return goals.reduce((acc: Record<number, any[]>, g) => { (acc[g.month] ??= []).push(g); return acc; }, {} as Record<number, any[]>);
  }, [goals]);

  const daysInMonth = new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate();
  const today = currentDate.day;
  const daysRemaining = daysInMonth - today;
  const monthPct = Math.round((today / daysInMonth) * 100);

  /* ═══════════════════════════════════ RENDER ═══════════════════════════════════ */
  return (
    <DashboardLayout>
      <div className="min-w-0 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Metas de Faturamento
            </h1>
            <p className="text-muted-foreground mt-1">Configure e acompanhe as metas mensais de faturamento da empresa ativa</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[120px]" aria-label="Ano de acompanhamento"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 7 }, (_, index) => currentYear - 5 + index).map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMonth.toString()} onValueChange={v => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[150px]" aria-label="Mês de acompanhamento"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map(month => <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>)}</SelectContent>
            </Select>
            {canEdit && (
              <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" />Nova Meta</Button>
            )}
          </div>
        </div>

        <AnnualGoalChart data={annual} year={selectedYear} loading={annualQuery.isLoading} error={annualQuery.error?.message} onRetry={() => { void annualQuery.refetch(); }} />

        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Acompanhamento — {monthLabel(selectedMonth)}/{selectedYear}</h2>
          <Badge variant="outline">{isActivePeriod ? "Mês atual · parcial" : isFuturePeriod ? "Não iniciado" : "Histórico · encerrado"}</Badge>
        </div>
        {!annualQuery.isLoading && !annualQuery.error && progress?.goals.length === 0 && <p className="rounded-lg border p-4 text-sm text-muted-foreground">Nenhuma meta configurada para {monthLabel(selectedMonth)}/{selectedYear} nesta empresa.</p>}

        {/* ══════════ PROGRESSO DO PERÍODO ESCOLHIDO ══════════ */}
        {progress && progress.goals.length > 0 && (
          <>
            {/* Barra de tempo do mês */}
            {isActivePeriod && (
            <div className="rounded-xl border bg-gradient-to-r from-muted/50 to-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{monthLabel(selectedMonth)} {selectedYear}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Dia {today} de {daysInMonth} — <span className="font-medium text-foreground">{daysRemaining} dias restantes</span>
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-500" style={{ width: `${monthPct}%` }} />
              </div>
            </div>
            )}

            {/* Cards de progresso com gauge */}
            <div className="grid gap-5 md:grid-cols-2">
              {progress.goals.map((g: any) => {
                const c = channelColors(g.channelName);
                const pace = goalDailyPace(selectedPeriod, currentDate, g.currentRevenue, g.targetAmount);
                const dailyNeeded = pace?.dailyNeeded;
                const dailyCurrent = pace?.dailyCurrent ?? 0;
                const onTrack = pace?.onTrack;

                return (
                  <Card key={g.id} className={`min-w-0 overflow-hidden transition-all hover:shadow-md ${g.achieved ? "ring-2 ring-emerald-300 dark:ring-emerald-700 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/20 dark:to-background" : ""}`}>
                    <div className={`h-1.5 bg-gradient-to-r ${c.gradient}`} />
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-start gap-5">
                        <CircularGauge progress={g.progress} achieved={g.achieved} future={isFuturePeriod} />
                        <div className="flex-1 min-w-0 basis-[180px]">
                          {/* título + badge */}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <div className={`p-1.5 rounded-lg ${c.light}`}>
                              <ChannelIcon name={g.channelName} className={`h-6 w-6 ${c.text}`} />
                            </div>
                            <h3 className="font-semibold text-base break-words">{g.channelName}</h3>
                            {isFuturePeriod && <Badge variant="outline" className="text-xs">Não iniciado</Badge>}
                            {!isFuturePeriod && g.progress === null && <Badge variant="outline" className="text-xs">Sem meta válida</Badge>}
                            {periodStatus === "closed" && !g.achieved && g.progress !== null && <Badge variant="outline" className="text-xs">Encerrado · não atingida</Badge>}
                            {g.achieved && (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />Atingida
                              </Badge>
                            )}
                          </div>

                          {/* valores */}
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <span className="text-sm text-muted-foreground">Realizado</span>
                              <span className="text-lg font-bold tabular-nums break-all">{fmtCurrency(g.currentRevenue)}</span>
                            </div>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <span className="text-sm text-muted-foreground">Meta</span>
                              <span className="text-sm font-medium text-muted-foreground tabular-nums break-all">{fmtCurrency(g.targetAmount)}</span>
                            </div>

                            {/* barra horizontal */}
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-700 ease-out ${
                                isFuturePeriod || g.progress === null ? "bg-muted-foreground" : g.achieved ? "bg-emerald-500" : g.progress >= 80 ? "bg-amber-500" : g.progress >= 50 ? "bg-orange-400" : "bg-red-400"
                              }`} style={{ width: `${isFuturePeriod ? 0 : Math.max(0, Math.min(g.progress ?? 0, 100))}%` }} />
                            </div>

                            {/* indicadores extras */}
                            {!g.achieved && isActivePeriod && g.progress !== null && (
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <ArrowRight className="h-3 w-3" />
                                      <span>Faltam <span className="font-medium text-foreground">{fmtShort(g.remaining)}</span></span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Valor restante: {fmtCurrency(g.remaining)}</p></TooltipContent>
                                </Tooltip>
                                {dailyNeeded != null ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={`flex items-center gap-1 text-xs ${onTrack ? "text-emerald-600" : "text-amber-600"}`}>
                                      {onTrack ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                      <span>{fmtShort(dailyNeeded)}/dia necessário</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Média diária atual: {fmtCurrency(dailyCurrent)}</p>
                                    <p>Necessário por dia: {fmtCurrency(dailyNeeded)}</p>
                                  </TooltipContent>
                                </Tooltip>
                                ) : <span className="text-xs text-muted-foreground">Último dia do mês</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* ══════════ COMPARATIVO MÊS A MÊS ══════════ */}
        <GoalComparison periods={[
          { period: { year: py2, month: pm2 }, data: prev2 },
          { period: { year: py1, month: pm1 }, data: prev1 },
          { period: selectedPeriod, data: progress },
        ]} loading={annualQuery.isLoading || (selectedMonth <= 2 && previousAnnualQuery.isLoading)} error={annualQuery.error?.message || (selectedMonth <= 2 ? previousAnnualQuery.error?.message : undefined)} />

        {/* ══════════ METAS DO ANO (cards por mês) ══════════ */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-orange-500" />Metas de {selectedYear}</CardTitle>
                <CardDescription>{goals?.length || 0} meta(s) configurada(s)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {goalsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando metas...</div>
            ) : goals && goals.length > 0 ? (
              <div className="space-y-4">
                {MONTHS.map(month => {
                  const mg = goalsByMonth[month.value] || [];
                  if (mg.length === 0) return null;
                  const isCurrent = month.value === currentMonth && selectedYear === currentYear;
                  const isPast = selectedYear < currentYear || (selectedYear === currentYear && month.value < currentMonth);

                  return (
                    <div key={month.value} className={`rounded-lg border p-4 transition-colors ${isCurrent ? "border-primary/30 bg-primary/5" : isPast ? "bg-muted/30" : ""}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`text-sm font-bold px-3 py-1 rounded-full ${isCurrent ? "bg-primary text-primary-foreground" : isPast ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground"}`}>
                          {month.short}
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">{month.label}</span>
                        {isCurrent && <Badge variant="outline" className="text-xs border-primary/30 text-primary">Mês Atual</Badge>}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {mg.map((goal: any) => {
                          const c = channelColors(goal.channelName);
                          return (
                            <div key={goal.id} className={`min-w-0 flex flex-wrap items-center justify-between gap-2 p-3 rounded-md ${c.light} ${c.border} border`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <ChannelIcon name={goal.channelName} className={`h-6 w-6 shrink-0 ${c.text}`} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{goal.channelName}</p>
                                  <p className="text-base font-bold tabular-nums break-all">{fmtCurrency(goal.targetAmount)}</p>
                                  {goal.notes && <p className="text-xs text-muted-foreground truncate mt-0.5" title={goal.notes}>{goal.notes}</p>}
                                </div>
                              </div>
                              {canEdit && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(goal)} title="Editar meta">
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteConfirm(goal)} title="Excluir meta">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <Target className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground mb-4">Nenhuma meta configurada para {selectedYear}</p>
                {canEdit && <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" />Criar Primeira Meta</Button>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ══════════ HISTÓRICO DE ALTERAÇÕES ══════════ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-muted-foreground" />Histórico de Alterações
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {historyLoading ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Carregando...</div>
            ) : history && history.length > 0 ? (
              <div className="space-y-2">
                {history.slice(0, 8).map((item: any) => {
                  const up = item.newAmount > item.previousAmount;
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors text-sm">
                      <div className={`p-1 rounded ${up ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                        {up ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{monthShort(item.month)}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{item.channelName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="tabular-nums">{fmtShort(item.previousAmount)}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className={`font-medium tabular-nums ${up ? "text-emerald-600" : "text-red-600"}`}>{fmtShort(item.newAmount)}</span>
                          {item.notes && (<><span>·</span><span className="truncate">{item.notes}</span></>)}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <History className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                Nenhuma alteração registrada em {selectedYear}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ══════════ DIALOG CRIAR/EDITAR ══════════ */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGoal ? "Editar Meta" : "Nova Meta"}</DialogTitle>
              <DialogDescription>Configure a meta de faturamento mensal</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select value={formMonth.toString()} onValueChange={v => setFormMonth(parseInt(v))} disabled={!!editingGoal}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Canal</Label>
                  <Select value={formChannelId} onValueChange={setFormChannelId} disabled={!!editingGoal}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geral">Geral (Todos)</SelectItem>
                      {channels?.map((ch: any) => <SelectItem key={ch.id} value={ch.id.toString()}>{ch.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor da Meta (R$)</Label>
                <Input type="text" placeholder="Ex: 50.000,00" value={formTargetAmount}
                  onChange={e => { let v = e.target.value.replace(/\D/g, ""); if (v) v = (parseInt(v) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); setFormTargetAmount(v); }} />
              </div>
              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Input type="text" placeholder="Ex: Meta baseada no histórico de 2024" value={formNotes} onChange={e => setFormNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={upsertMutation.isPending}>{upsertMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ══════════ CONFIRMAÇÃO DE EXCLUSÃO ══════════ */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Meta</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a meta de <strong>{deleteConfirm?.channelName}</strong> de{" "}
                <strong>{monthLabel(deleteConfirm?.month ?? 0)}/{deleteConfirm?.year}</strong> no valor de{" "}
                <strong>{fmtCurrency(deleteConfirm?.targetAmount ?? 0)}</strong>?
                <br /><br />
                Esta ação não pode ser desfeita. O histórico de alterações desta meta também será removido.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm.id })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
