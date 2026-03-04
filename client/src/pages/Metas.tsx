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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import {
  Target, Plus, Edit, TrendingUp, TrendingDown, CheckCircle2,
  History, Store, CreditCard, Flame, Trophy, ArrowRight, Calendar,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

/* ─── constantes ─── */
const MONTHS = [
  { value: 1, label: "Janeiro", short: "Jan" },
  { value: 2, label: "Fevereiro", short: "Fev" },
  { value: 3, label: "Março", short: "Mar" },
  { value: 4, label: "Abril", short: "Abr" },
  { value: 5, label: "Maio", short: "Mai" },
  { value: 6, label: "Junho", short: "Jun" },
  { value: 7, label: "Julho", short: "Jul" },
  { value: 8, label: "Agosto", short: "Ago" },
  { value: 9, label: "Setembro", short: "Set" },
  { value: 10, label: "Outubro", short: "Out" },
  { value: 11, label: "Novembro", short: "Nov" },
  { value: 12, label: "Dezembro", short: "Dez" },
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const IFOOD_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663140687549/7RkrCeS5KipYf8hkuNqrCk/ifood-logo-red_44465bfd.png";
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
function CircularGauge({ progress, achieved, size = 110, strokeWidth = 9 }: { progress: number; achieved: boolean; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(progress, 100);
  const offset = circ - (clamped / 100) * circ;

  let color = "stroke-red-400";
  let glow = "";
  if (achieved) { color = "stroke-emerald-500"; glow = "drop-shadow(0 0 6px rgba(16,185,129,.35))"; }
  else if (progress >= 80) color = "stroke-amber-500";
  else if (progress >= 50) color = "stroke-orange-400";

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size, filter: glow }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/30" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} className={`${color} transition-all duration-700 ease-out`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold leading-none ${achieved ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
          {progress.toFixed(1)}%
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

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [formMonth, setFormMonth] = useState(currentMonth);
  const [formChannelId, setFormChannelId] = useState<string>("geral");
  const [formTargetAmount, setFormTargetAmount] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const utils = trpc.useUtils();

  /* ── queries ── */
  const { data: goals, isLoading: goalsLoading } = trpc.goals.list.useQuery({ year: selectedYear });
  const { data: channels } = trpc.salesChannels.list.useQuery();
  const { data: progress } = trpc.goals.progress.useQuery({ year: currentYear, month: currentMonth });
  const { data: history, isLoading: historyLoading } = trpc.goals.history.useQuery({ year: selectedYear });

  // Comparativo: 2 meses anteriores
  const pm1 = currentMonth === 1 ? 12 : currentMonth - 1;
  const py1 = currentMonth === 1 ? currentYear - 1 : currentYear;
  const pm2 = pm1 === 1 ? 12 : pm1 - 1;
  const py2 = pm1 === 1 ? py1 - 1 : py1;
  const { data: prev1 } = trpc.goals.progress.useQuery({ year: py1, month: pm1 });
  const { data: prev2 } = trpc.goals.progress.useQuery({ year: py2, month: pm2 });

  /* ── mutations ── */
  const upsertMutation = trpc.goals.upsert.useMutation({
    onSuccess: () => {
      toast.success(editingGoal ? "Meta atualizada!" : "Meta criada!");
      utils.goals.list.invalidate();
      utils.goals.progress.invalidate();
      utils.goals.history.invalidate();
      closeDialog();
    },
    onError: (e) => toast.error("Erro ao salvar meta: " + e.message),
  });

  /* ── dialog helpers ── */
  const openDialog = (goal?: any) => {
    if (goal) {
      setEditingGoal(goal);
      setFormMonth(goal.month);
      setFormChannelId(goal.channelId ? goal.channelId.toString() : "geral");
      setFormTargetAmount(goal.targetAmount.toString());
      setFormNotes(goal.notes || "");
    } else {
      setEditingGoal(null);
      setFormMonth(currentMonth);
      setFormChannelId("geral");
      setFormTargetAmount("");
      setFormNotes("");
    }
    setIsDialogOpen(true);
  };
  const closeDialog = () => { setIsDialogOpen(false); setEditingGoal(null); setFormMonth(currentMonth); setFormChannelId("geral"); setFormTargetAmount(""); setFormNotes(""); };

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

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const today = new Date().getDate();
  const daysRemaining = daysInMonth - today;
  const monthPct = Math.round((today / daysInMonth) * 100);

  /* ═══════════════════════════════════ RENDER ═══════════════════════════════════ */
  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Metas de Faturamento
            </h1>
            <p className="text-muted-foreground mt-1">Configure e acompanhe as metas mensais de faturamento</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit && (
              <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" />Nova Meta</Button>
            )}
          </div>
        </div>

        {/* ══════════ PROGRESSO DO MÊS ATUAL ══════════ */}
        {progress && progress.goals.length > 0 && (
          <>
            {/* Barra de tempo do mês */}
            <div className="rounded-xl border bg-gradient-to-r from-muted/50 to-muted/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{monthLabel(currentMonth)} {currentYear}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Dia {today} de {daysInMonth} — <span className="font-medium text-foreground">{daysRemaining} dias restantes</span>
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-500" style={{ width: `${monthPct}%` }} />
              </div>
            </div>

            {/* Cards de progresso com gauge */}
            <div className="grid gap-5 md:grid-cols-2">
              {progress.goals.map((g: any) => {
                const c = channelColors(g.channelName);
                const dailyNeeded = daysRemaining > 0 ? g.remaining / daysRemaining : 0;
                const dailyCurrent = today > 0 ? g.currentRevenue / today : 0;
                const onTrack = dailyCurrent >= (g.targetAmount / daysInMonth);

                return (
                  <Card key={g.id} className={`overflow-hidden transition-all hover:shadow-md ${g.achieved ? "ring-2 ring-emerald-300 dark:ring-emerald-700 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/20 dark:to-background" : ""}`}>
                    <div className={`h-1.5 bg-gradient-to-r ${c.gradient}`} />
                    <CardContent className="p-5">
                      <div className="flex items-start gap-5">
                        <CircularGauge progress={g.progress} achieved={g.achieved} />
                        <div className="flex-1 min-w-0">
                          {/* título + badge */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`p-1.5 rounded-lg ${c.light}`}>
                              <ChannelIcon name={g.channelName} className={`h-6 w-6 ${c.text}`} />
                            </div>
                            <h3 className="font-semibold text-base">{g.channelName}</h3>
                            {g.achieved && (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />Atingida
                              </Badge>
                            )}
                          </div>

                          {/* valores */}
                          <div className="space-y-2">
                            <div className="flex items-baseline justify-between">
                              <span className="text-sm text-muted-foreground">Realizado</span>
                              <span className="text-lg font-bold tabular-nums">{fmtCurrency(g.currentRevenue)}</span>
                            </div>
                            <div className="flex items-baseline justify-between">
                              <span className="text-sm text-muted-foreground">Meta</span>
                              <span className="text-sm font-medium text-muted-foreground tabular-nums">{fmtCurrency(g.targetAmount)}</span>
                            </div>

                            {/* barra horizontal */}
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-700 ease-out ${
                                g.achieved ? "bg-emerald-500" : g.progress >= 80 ? "bg-amber-500" : g.progress >= 50 ? "bg-orange-400" : "bg-red-400"
                              }`} style={{ width: `${Math.min(g.progress, 100)}%` }} />
                            </div>

                            {/* indicadores extras */}
                            {!g.achieved && (
                              <div className="flex items-center justify-between pt-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <ArrowRight className="h-3 w-3" />
                                      <span>Faltam <span className="font-medium text-foreground">{fmtShort(g.remaining)}</span></span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Valor restante: {fmtCurrency(g.remaining)}</p></TooltipContent>
                                </Tooltip>
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
        {(prev1 || prev2) && progress && progress.goals.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Comparativo — Últimos 3 Meses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Canal</th>
                      {prev2 && <th className="text-center py-2 px-3 font-medium text-muted-foreground">{monthShort(pm2)}/{py2}</th>}
                      {prev1 && <th className="text-center py-2 px-3 font-medium text-muted-foreground">{monthShort(pm1)}/{py1}</th>}
                      <th className="text-center py-2 px-3 font-medium">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-semibold">{monthShort(currentMonth)}/{currentYear}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.goals.map((g: any) => {
                      const p1 = prev1?.goals.find((x: any) => x.channelName === g.channelName);
                      const p2 = prev2?.goals.find((x: any) => x.channelName === g.channelName);
                      const c = channelColors(g.channelName);
                      return (
                        <tr key={g.id} className="border-b last:border-0">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <ChannelIcon name={g.channelName} className={`h-6 w-6 ${c.text}`} />
                              <span className="font-medium">{g.channelName}</span>
                            </div>
                          </td>
                          {prev2 && (
                            <td className="text-center py-3 px-3">
                              {p2 ? (
                                <div>
                                  <div className="font-medium tabular-nums">{fmtShort(p2.currentRevenue)}</div>
                                  <div className="text-xs text-muted-foreground">de {fmtShort(p2.targetAmount)}</div>
                                  <Badge variant="outline" className={`text-xs mt-1 ${p2.achieved ? "border-emerald-300 text-emerald-600" : "border-muted text-muted-foreground"}`}>
                                    {p2.progress.toFixed(0)}%
                                  </Badge>
                                </div>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                          )}
                          {prev1 && (
                            <td className="text-center py-3 px-3">
                              {p1 ? (
                                <div>
                                  <div className="font-medium tabular-nums">{fmtShort(p1.currentRevenue)}</div>
                                  <div className="text-xs text-muted-foreground">de {fmtShort(p1.targetAmount)}</div>
                                  <Badge variant="outline" className={`text-xs mt-1 ${p1.achieved ? "border-emerald-300 text-emerald-600" : "border-muted text-muted-foreground"}`}>
                                    {p1.progress.toFixed(0)}%
                                  </Badge>
                                </div>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                          )}
                          <td className="text-center py-3 px-3">
                            <div>
                              <div className="font-bold tabular-nums">{fmtShort(g.currentRevenue)}</div>
                              <div className="text-xs text-muted-foreground">de {fmtShort(g.targetAmount)}</div>
                              <Badge className={`text-xs mt-1 border-0 ${
                                g.achieved ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : g.progress >= 80 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              }`}>{g.progress.toFixed(0)}%</Badge>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

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
                            <div key={goal.id} className={`flex items-center justify-between p-3 rounded-md ${c.light} ${c.border} border`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <ChannelIcon name={goal.channelName} className={`h-6 w-6 shrink-0 ${c.text}`} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{goal.channelName}</p>
                                  <p className="text-base font-bold tabular-nums">{fmtCurrency(goal.targetAmount)}</p>
                                  {goal.notes && <p className="text-xs text-muted-foreground truncate mt-0.5" title={goal.notes}>{goal.notes}</p>}
                                </div>
                              </div>
                              {canEdit && (
                                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => openDialog(goal)} title="Editar meta">
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
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
      </div>
    </DashboardLayout>
  );
}
