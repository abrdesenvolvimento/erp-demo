import { useState } from "react";
import { Activity, Clock3, Monitor, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OperatorLockButton } from "./OperatorSecurityGate";
import { broadcastOperatorSecurity } from "@/hooks/useOperatorSecuritySignal";
import { SECURITY_TIME_ZONE } from "../../../shared/sessionSecurity";

export function securityDate(value: Date | string | number | null | undefined): string {
  if (value == null) return "Não informado";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SECURITY_TIME_ZONE, dateStyle: "short", timeStyle: "short",
  }).format(date);
}

const EVENT_LABELS: Record<string, string> = {
  login: "Login completo", logout: "Saída da conta", pin_setup: "PIN cadastrado",
  pin_unlock: "PIN confirmado", pin_failed: "PIN não confirmado", pin_blocked: "Limite de tentativas de PIN",
  idle_lock: "Bloqueio por inatividade", manual_lock: "Bloqueio manual", session_revoked: "Sessão revogada",
  policy_changed: "Política atualizada", TERMINAL_PRODUCAO_ATIVADO: "Terminal de produção pareado",
  TERMINAL_PRODUCAO_REVOGADO: "Terminal de produção revogado",
};

export function OperatorSecurityPanel({ showSessions = true, showEvents = true }: {
  showSessions?: boolean; showEvents?: boolean;
}) {
  const utils = trpc.useUtils();
  const status = trpc.operatorSecurity.status.useQuery(undefined, { staleTime: 0, retry: 2 });
  const enabled = status.data?.state === "ACTIVE";
  const sessions = trpc.operatorSecurity.sessions.useQuery(undefined, {
    enabled: enabled && showSessions, retry: 1, refetchOnWindowFocus: true,
  });
  const events = trpc.operatorSecurity.events.useQuery(undefined, {
    enabled: enabled && showEvents, retry: 1, refetchOnWindowFocus: true,
  });
  const [confirmSessionId, setConfirmSessionId] = useState<string | null>(null);
  const revoke = trpc.operatorSecurity.revokeSession.useMutation({
    onSuccess: async () => {
      setConfirmSessionId(null);
      broadcastOperatorSecurity("status");
      await Promise.all([
        utils.operatorSecurity.sessions.invalidate(),
        utils.operatorSecurity.events.invalidate(),
        utils.operatorSecurity.status.invalidate(),
      ]);
      toast.success("Sessão revogada no servidor.");
    },
    onError: () => toast.error("Não foi possível revogar a sessão. Tente novamente com uma conexão ativa."),
  });

  return <div className="space-y-6">
    {showSessions && <>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Proteção da sua sessão</CardTitle>
          <CardDescription>Login completo e PIN individual, com bloqueio automático nas pausas.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">PIN individual</p><p className="mt-1 font-medium">{status.isPending ? "Verificando…" : status.isError ? "Indisponível" : status.data?.hasPin ? "Cadastrado" : "Cadastro necessário"}</p></div>
            <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Bloqueio por inatividade</p><p className="mt-1 font-medium">{status.data ? `${status.data.idleMinutes} minutos` : "—"}</p></div>
            <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Novo login diário</p><p className="mt-1 font-medium">04h · Brasília</p></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm text-muted-foreground">O PIN não substitui o login e não deve ser compartilhado. Ao encerrar seu turno, saia da conta; para uma pausa, bloqueie a sessão.</p><OperatorLockButton /></div>
          <p className="text-xs text-muted-foreground">Fuso de segurança: {SECURITY_TIME_ZONE}. Alteração ou recuperação de PIN exige um fluxo específico; esta tela não altera a senha da sua conta.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Monitor className="h-5 w-5" />Suas sessões</CardTitle><CardDescription>Dispositivos autenticados nesta conta. Revogar a sessão atual exigirá novo login.</CardDescription></CardHeader>
        <CardContent>
          {sessions.isPending ? <p className="py-4 text-sm text-muted-foreground" role="status">Carregando sessões…</p>
            : sessions.isError ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">Não foi possível carregar suas sessões.</p><Button variant="outline" onClick={() => { void sessions.refetch(); }}>Tentar novamente</Button></div>
            : !sessions.data?.length ? <p className="py-4 text-sm text-muted-foreground">Nenhuma sessão disponível.</p>
            : <ul className="space-y-3">{sessions.data.map(session => {
              const revoked = Boolean(session.revokedAt);
              const expired = new Date(session.expiresAt).getTime() <= (status.data?.serverNow ?? Date.now());
              const current = session.id === status.data?.sessionRef;
              return <li key={session.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1"><p className="flex flex-wrap items-center gap-2 text-sm font-medium"><Monitor className="h-4 w-4" />{current ? "Este navegador" : "Sessão de navegador"}<Badge variant="secondary">{revoked ? "Revogada" : expired ? "Expirada" : session.lockedAt ? "Bloqueada" : "Vigente"}</Badge></p>
                    <p className="max-w-xl break-words text-xs text-muted-foreground">{session.userAgent ? session.userAgent.slice(0, 180) : "Navegador não informado"}</p>
                    <p className="text-xs text-muted-foreground">Login: {securityDate(session.authenticatedAt)} · Válida até: {securityDate(session.expiresAt)}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">Referência: {session.id.slice(0, 12)}</p>
                  </div>
                  {!revoked && !expired && <Button variant="outline" size="sm" onClick={() => setConfirmSessionId(session.id)} disabled={revoke.isPending}><Trash2 className="mr-2 h-4 w-4" />Revogar</Button>}
                </div>
                {confirmSessionId === session.id && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3" role="alert"><p className="flex-1 text-sm">Encerrar esta sessão? O dispositivo precisará de novo login completo.</p><Button size="sm" variant="destructive" disabled={revoke.isPending} onClick={() => revoke.mutate({ sessionId: session.id })}>{revoke.isPending ? "Revogando…" : "Confirmar revogação"}</Button><Button size="sm" variant="ghost" disabled={revoke.isPending} onClick={() => setConfirmSessionId(null)}>Cancelar</Button></div>}
              </li>;
            })}</ul>}
        </CardContent>
      </Card>
    </>}
    {showEvents && <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Histórico de segurança</CardTitle><CardDescription>Eventos reais da sua conta, registrados pelo servidor. Horários de Brasília.</CardDescription></CardHeader>
      <CardContent>
        {events.isPending ? <p className="py-4 text-sm text-muted-foreground" role="status">Carregando histórico…</p>
          : events.isError ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">Não foi possível carregar o histórico.</p><Button variant="outline" onClick={() => { void events.refetch(); }}>Tentar novamente</Button></div>
          : !events.data?.length ? <div className="py-5 text-sm text-muted-foreground">Nenhum evento de segurança registrado.</div>
          : <ol className="divide-y">{events.data.map(event => <li key={event.id} className="flex gap-3 py-4"><Clock3 className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{EVENT_LABELS[event.event] ?? event.event}</p><time className="text-xs text-muted-foreground">{securityDate(event.createdAt)}</time></div>{typeof event.details === "string" && event.details && <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{event.details}</p>}</div></li>)}</ol>}
      </CardContent>
    </Card>}
  </div>;
}

export default OperatorSecurityPanel;
