import { useEffect, useState, type FormEvent } from "react";
import { Clock3, MonitorCheck, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { securityDate } from "@/components/OperatorSecurityPanel";
import { broadcastOperatorSecurity } from "@/hooks/useOperatorSecuritySignal";
import { ALLOWED_IDLE_MINUTES, DAILY_LOGIN_HOUR, SECURITY_TIME_ZONE } from "../../../shared/sessionSecurity";

type IdleMinutes = typeof ALLOWED_IDLE_MINUTES[number];

export default function Seguranca() {
  const { isAdmin } = usePermissions();
  return <DashboardLayout>
    <div className="space-y-6">
      <header><div className="mb-2 flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-emerald-700" /><h1 className="text-3xl font-bold tracking-tight">Segurança</h1></div><p className="text-muted-foreground">Políticas de identificação e continuidade da produção por empresa.</p></header>
      {isAdmin ? <CompanySecuritySettings /> : <Card><CardHeader><CardTitle>Acesso administrativo necessário</CardTitle><CardDescription>Apenas administradores podem alterar a política de segurança ou parear terminais. Você pode consultar suas sessões em Minha Conta.</CardDescription></CardHeader></Card>}
    </div>
  </DashboardLayout>;
}

function CompanySecuritySettings() {
  const { activeCompanyId, activeCompany } = useCompany();
  const utils = trpc.useUtils();
  const policy = trpc.operatorSecurity.policy.useQuery(undefined, { enabled: Boolean(activeCompanyId), retry: 1 });
  const terminals = trpc.operatorSecurity.terminals.useQuery(undefined, { enabled: Boolean(activeCompanyId), retry: 1 });
  const status = trpc.operatorSecurity.status.useQuery(undefined, { retry: 2, staleTime: 0 });
  const [idleMinutes, setIdleMinutes] = useState<IdleMinutes | "">("");
  const [terminalName, setTerminalName] = useState("");
  const [consent, setConsent] = useState(false);
  const [confirmTerminal, setConfirmTerminal] = useState<string | null>(null);
  useEffect(() => { setIdleMinutes(""); setTerminalName(""); setConsent(false); setConfirmTerminal(null); }, [activeCompanyId]);
  useEffect(() => {
    if (policy.data && ALLOWED_IDLE_MINUTES.includes(policy.data.idleMinutes as IdleMinutes)) setIdleMinutes(policy.data.idleMinutes as IdleMinutes);
  }, [policy.data]);

  const updatePolicy = trpc.operatorSecurity.updatePolicy.useMutation({
    onSuccess: async () => {
      toast.success("Política de inatividade atualizada.");
      broadcastOperatorSecurity("status");
      await Promise.all([utils.operatorSecurity.policy.invalidate(), utils.operatorSecurity.status.invalidate(), utils.operatorSecurity.events.invalidate()]);
    },
    onError: () => toast.error("Não foi possível atualizar a política. Verifique seu acesso administrativo e a conexão."),
  });
  const enable = trpc.operatorSecurity.enableProductionTerminal.useMutation({
    onSuccess: async () => {
      setTerminalName(""); setConsent(false);
      toast.success("Este navegador foi pareado para a continuidade automática do KDS por 30 dias.");
      broadcastOperatorSecurity("status");
      await Promise.all([utils.operatorSecurity.terminals.invalidate(), utils.operatorSecurity.status.invalidate(), utils.operatorSecurity.events.invalidate()]);
    },
    onError: () => toast.error("Não foi possível parear este navegador. É necessário acesso administrativo à empresa atual."),
  });
  const revoke = trpc.operatorSecurity.revokeProductionTerminal.useMutation({
    onSuccess: async () => {
      setConfirmTerminal(null);
      toast.success("Terminal revogado. A continuidade automática não está mais autorizada.");
      broadcastOperatorSecurity("status");
      await Promise.all([utils.operatorSecurity.terminals.invalidate(), utils.operatorSecurity.status.invalidate(), utils.operatorSecurity.events.invalidate()]);
    },
    onError: () => toast.error("Não foi possível revogar o terminal."),
  });
  const submitPolicy = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (idleMinutes === "" || !activeCompanyId || !ALLOWED_IDLE_MINUTES.includes(idleMinutes)) return;
    updatePolicy.mutate({ idleMinutes });
  };
  const submitTerminal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!consent || terminalName.trim().length < 3 || !activeCompanyId || enable.isPending) return;
    enable.mutate({ name: terminalName.trim() });
  };

  if (!activeCompanyId) return <Card><CardHeader><CardTitle>Selecione uma empresa</CardTitle><CardDescription>A política e os terminais são definidos para a empresa atual. Escolha uma empresa para continuar.</CardDescription></CardHeader></Card>;
  const paired = status.data?.productionTerminal;
  return <>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3"><Badge variant="secondary">Empresa atual</Badge><span className="text-sm font-medium">{activeCompany?.companyName || activeCompany?.companyLegalName || `Empresa ${activeCompanyId}`}</span></div>
    <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" />Bloqueio por inatividade</CardTitle><CardDescription>Proteção imediata da interface após uma pausa, sem encerrar o login ainda válido.</CardDescription></CardHeader>
        <CardContent>
          {policy.isPending ? <p className="py-3 text-sm text-muted-foreground" role="status">Carregando política…</p> : policy.isError ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">Não foi possível carregar a política da empresa.</p><Button variant="outline" onClick={() => { void policy.refetch(); }}>Tentar novamente</Button></div> :
            <form onSubmit={submitPolicy} className="space-y-5">
              <div className="space-y-2"><Label htmlFor="security-idle-minutes">Tempo sem atividade real</Label><select id="security-idle-minutes" value={idleMinutes} disabled={updatePolicy.isPending} onChange={event => {
                const value = Number(event.target.value) as IdleMinutes;
                if (ALLOWED_IDLE_MINUTES.includes(value)) setIdleMinutes(value);
              }} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-emerald-700"><option value="" disabled>Selecione o tempo</option>{ALLOWED_IDLE_MINUTES.map(minutes => <option key={minutes} value={minutes}>{minutes} {minutes === 1 ? "minuto" : "minutos"}</option>)}</select>
                <p className="text-xs leading-relaxed text-muted-foreground">Somente cliques/toques e teclas confiáveis contam como atividade. Atualizações automáticas e movimentos do mouse não renovam a sessão.</p></div>
              <Button type="submit" disabled={updatePolicy.isPending || idleMinutes === "" || idleMinutes === policy.data?.idleMinutes}>{updatePolicy.isPending ? "Salvando…" : "Salvar política"}</Button>
            </form>}
        </CardContent>
      </Card>
      <Card className="border-emerald-800/20 bg-emerald-950 text-emerald-50"><CardHeader><CardTitle>Identificação diária obrigatória</CardTitle><CardDescription className="text-emerald-100/75">Uma nova confirmação completa a cada dia operacional.</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-5xl font-semibold tracking-tight">{String(DAILY_LOGIN_HOUR).padStart(2, "0")}:00</p><p className="text-sm text-emerald-100/80">{SECURITY_TIME_ZONE}</p><p className="text-sm leading-relaxed text-emerald-100/80">O horário é fixo e não pode ser alterado. Após o corte diário, é necessário fazer novo login OAuth e confirmar o PIN. O PIN sozinho não renova um login expirado.</p></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><MonitorCheck className="h-5 w-5" />Continuidade de produção</CardTitle><CardDescription>Pareie este navegador à empresa atual para manter somente as rotinas automáticas das estações KDS durante o bloqueio.</CardDescription></CardHeader><CardContent className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950"><strong>Validade: 30 dias.</strong> Esta autorização é exclusiva das rotas KDS cozinha e KDS bar e das leituras de produção validadas no servidor. Ações humanas, mudanças de pedidos e demais rotas continuam exigindo sessão ativa, login válido e PIN. O conteúdo do KDS permanece oculto durante o bloqueio.</div>
      {paired && paired.companyId === activeCompanyId && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Este navegador está pareado: <strong>{paired.name}</strong>.</p>}
      <form onSubmit={submitTerminal} className="max-w-2xl space-y-4">
        <div className="space-y-2"><Label htmlFor="production-terminal-name">Nome deste terminal</Label><Input id="production-terminal-name" placeholder="Ex.: Cozinha · estação principal" minLength={3} maxLength={80} required value={terminalName} onChange={event => setTerminalName(event.target.value)} disabled={enable.isPending} /></div>
        <label className="flex items-start gap-3 text-sm leading-relaxed" htmlFor="production-terminal-consent"><input id="production-terminal-consent" type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} disabled={enable.isPending} className="mt-1 h-4 w-4 shrink-0 accent-emerald-700" /><span>Confirmo que este navegador pertence a uma estação de produção controlada da empresa atual. Autorizo somente a continuidade automática do KDS por 30 dias.</span></label>
        <Button type="submit" disabled={enable.isPending || !consent || terminalName.trim().length < 3}>{enable.isPending ? "Pareando…" : paired?.companyId === activeCompanyId ? "Renovar pareamento deste navegador" : "Registrar este navegador"}</Button>
        <p className="text-xs leading-relaxed text-muted-foreground">O servidor configura uma credencial em cookie protegido, sem exposição na interface. Pareie e teste esta estação antes do primeiro uso do terminal. O pareamento não dá acesso a outros operadores, empresas ou funções.</p>
      </form>
      <div className="border-t pt-5"><h3 className="mb-3 text-sm font-semibold">Terminais da empresa</h3>
        {terminals.isPending ? <p className="text-sm text-muted-foreground" role="status">Carregando terminais…</p> : terminals.isError ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">Não foi possível carregar os terminais.</p><Button variant="outline" onClick={() => { void terminals.refetch(); }}>Tentar novamente</Button></div> : !terminals.data?.length ? <p className="text-sm text-muted-foreground">Nenhum terminal pareado nesta empresa.</p> : <ul className="space-y-3">{terminals.data.map(terminal => {
          const revoked = Boolean(terminal.revokedAt);
          const expired = new Date(terminal.expiresAt).getTime() <= (status.data?.serverNow ?? Date.now());
          return <li key={terminal.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex flex-wrap items-center gap-2 text-sm font-medium">{terminal.name}<Badge variant="secondary">{revoked ? "Revogado" : expired ? "Expirado" : "Pareado"}</Badge></p><p className="mt-1 text-xs text-muted-foreground">Válido até {securityDate(terminal.expiresAt)}</p></div>{!revoked && !expired && <Button variant="outline" size="sm" disabled={revoke.isPending} onClick={() => setConfirmTerminal(terminal.id)}><Trash2 className="mr-2 h-4 w-4" />Revogar</Button>}</div>{confirmTerminal === terminal.id && <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3"><p className="flex-1 text-sm">Revogar a continuidade automática deste terminal?</p><Button size="sm" variant="destructive" disabled={revoke.isPending} onClick={() => revoke.mutate({ terminalId: terminal.id })}>{revoke.isPending ? "Revogando…" : "Confirmar"}</Button><Button size="sm" variant="ghost" disabled={revoke.isPending} onClick={() => setConfirmTerminal(null)}>Cancelar</Button></div>}</li>;
        })}</ul>}
      </div>
    </CardContent></Card>
    <AdminPinRecovery companyId={activeCompanyId} />
  </>;
}

function AdminPinRecovery({ companyId }: { companyId: number }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const companyUsers = trpc.company.companyUsers.useQuery({ companyId }, { retry: 1 });
  const [selectedUserId, setSelectedUserId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { setSelectedUserId(""); setReason(""); setConfirmed(false); }, [companyId]);
  const eligible = [...new Map((companyUsers.data ?? [])
    .filter(row => row.userId !== user?.id)
    .map(row => [row.userId, row] as const)).values()];
  const reset = trpc.operatorSecurity.resetUserPin.useMutation({
    onSuccess: async () => {
      setSelectedUserId(""); setReason(""); setConfirmed(false);
      toast.success("PIN redefinido e sessões do operador revogadas. Ele deverá fazer novo login completo e criar um PIN.");
      broadcastOperatorSecurity("status");
      await utils.operatorSecurity.events.invalidate();
    },
    onError: () => toast.error("Não foi possível redefinir o PIN. Verifique a autorização sobre o usuário na empresa atual."),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confirmed || reason.trim().length < 10 || !eligible.some(row => row.userId === selectedUserId) || reset.isPending) return;
    reset.mutate({ userId: selectedUserId, reason: reason.trim() });
  };
  return <Card><CardHeader><CardTitle>Recuperação assistida de PIN</CardTitle><CardDescription>Um administrador autorizado pode redefinir o PIN de outro operador vinculado à empresa atual. Não é possível redefinir o próprio PIN aqui.</CardDescription></CardHeader><CardContent>
    {companyUsers.isPending ? <p className="text-sm text-muted-foreground" role="status">Carregando operadores…</p>
      : companyUsers.isError ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">Não foi possível carregar os operadores.</p><Button variant="outline" onClick={() => { void companyUsers.refetch(); }}>Tentar novamente</Button></div>
      : !eligible.length ? <p className="text-sm text-muted-foreground">Nenhum outro operador vinculado à empresa.</p>
      : <form onSubmit={submit} className="max-w-2xl space-y-4">
        <div className="space-y-2"><Label htmlFor="pin-recovery-user">Operador</Label><select id="pin-recovery-user" value={selectedUserId} required disabled={reset.isPending} onChange={event => { setSelectedUserId(event.target.value); setConfirmed(false); }} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-emerald-700"><option value="" disabled>Selecione outro operador</option>{eligible.map(row => <option key={row.userId} value={row.userId}>{row.userName || row.userEmail || row.userId}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="pin-recovery-reason">Motivo da recuperação</Label><Input id="pin-recovery-reason" value={reason} onChange={event => setReason(event.target.value)} minLength={10} maxLength={250} required disabled={reset.isPending} placeholder="Descreva o motivo (mínimo 10 caracteres)" /></div>
        <label className="flex items-start gap-3 text-sm leading-relaxed" htmlFor="pin-recovery-confirmation"><input id="pin-recovery-confirmation" type="checkbox" required checked={confirmed} disabled={reset.isPending} onChange={event => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-emerald-700" /><span>Verifiquei a identidade do operador e confirmo a revogação de todas as suas sessões. Ele precisará fazer um novo login completo para cadastrar outro PIN.</span></label>
        <Button type="submit" variant="destructive" disabled={reset.isPending || !confirmed || !selectedUserId || reason.trim().length < 10}>{reset.isPending ? "Redefinindo…" : "Redefinir PIN e revogar sessões"}</Button>
        <p className="text-xs leading-relaxed text-muted-foreground">O responsável e o motivo são registrados pelo servidor. Esta ação não exibe o PIN anterior, não define uma credencial compartilhada e não altera a senha OAuth.</p>
      </form>}
  </CardContent></Card>;
}
