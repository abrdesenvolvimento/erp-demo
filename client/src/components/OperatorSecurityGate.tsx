import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { ArrowRight, LockKeyhole, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { warmUpAndLogin } from "@/const";
import AnniversaryAccess from "./AnniversaryAccess";
import type { OperatorSessionState, OperatorSessionStatus } from "../../../shared/sessionSecurity";
import {
  effectiveOperatorState,
  isOperatorStatusQuery,
  isTrustedOperatorActivity,
  isValidOperatorPin,
  operatorDeadline,
  operatorIdentitySignature,
  OPERATOR_ACTIVITY_THROTTLE_MS,
  OPERATOR_STATUS_POLL_MS,
  remainingCooldownSeconds,
} from "@/hooks/operatorSecurityRuntime";
import { broadcastOperatorSecurity, useOperatorSecuritySignal } from "@/hooks/useOperatorSecuritySignal";

export function isOperatorPublicPath(path: string): boolean {
  // Deliberately exact: /cardapio/stories is a protected operational route.
  return path === "/cardapio" || path === "/aviso-inauguracao";
}

export function isProductionStationPath(path: string): boolean {
  return path === "/salao/kds-cozinha" || path === "/salao/kds-bar";
}

/** For DashboardLayout: beginning the mutation blocks every open tab immediately. */
export function OperatorLockButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const utils = trpc.useUtils();
  const lock = trpc.operatorSecurity.lock.useMutation({
    onMutate: () => broadcastOperatorSecurity("lock"),
    onSuccess: async () => {
      broadcastOperatorSecurity("status");
      await utils.operatorSecurity.status.invalidate();
    },
    onError: () => toast.error("Não foi possível confirmar o bloqueio no servidor. A tela permanece protegida; verifique a conexão."),
  });
  return <button type="button" onClick={() => lock.mutate()} disabled={lock.isPending}
    className={className ?? "inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2"}
    aria-label="Bloquear minha sessão" title="Bloquear minha sessão">
    <LockKeyhole size={16} aria-hidden="true" />{!compact && (lock.isPending ? "Bloqueando…" : "Bloquear")}
  </button>;
}

/** Mount inside CompanyProvider and TooltipProvider; production access is server-paired only. */
export function OperatorSecurityGate({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  if (isOperatorPublicPath(path)) return <>{children}</>;
  return <ProtectedOperatorGate path={path}>{children}</ProtectedOperatorGate>;
}

type LocalBlock = "LOCKED" | "LOGIN_REQUIRED" | "VERIFYING" | null;

function ProtectedOperatorGate({ children, path }: { children: ReactNode; path: string }) {
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const statusQuery = trpc.operatorSecurity.status.useQuery(undefined, {
    enabled: true,
    refetchInterval: OPERATOR_STATUS_POLL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: 2,
    retryDelay: attempt => Math.min(1000 * (attempt + 1), 3000),
    staleTime: 0,
  });
  const activity = trpc.operatorSecurity.activity.useMutation();
  const [localBlock, setLocalBlock] = useState<LocalBlock>(null);
  const [clearedIdentity, setClearedIdentity] = useState<string | null>(null);
  const [authReadyIdentity, setAuthReadyIdentity] = useState<string | null>(null);
  const [authHydrationError, setAuthHydrationError] = useState(false);
  const authHydrationEpoch = useRef(0);
  const [, setClockRevision] = useState(0);
  const identityEpoch = useRef(0);
  const validationEpoch = useRef(0);
  const lastInputSentAt = useRef(Number.NEGATIVE_INFINITY);
  const serverClock = useRef({ offset: 0, updatedAt: 0 });
  const status = statusQuery.data as OperatorSessionStatus | undefined;
  // An offset is captured once per server response, not on each UI render.
  if (status && serverClock.current.updatedAt !== statusQuery.dataUpdatedAt) {
    serverClock.current = { offset: status.serverNow - Date.now(), updatedAt: statusQuery.dataUpdatedAt };
  }
  const estimatedServerNow = () => Date.now() + serverClock.current.offset;
  const signature = status ? operatorIdentitySignature(status) : null;
  const identityReady = signature !== null && signature === clearedIdentity;
  const state = status ? effectiveOperatorState(status, estimatedServerNow()) : null;
  const authReady = signature !== null && authReadyIdentity === signature;
  const active = identityReady && authReady && state === "ACTIVE" && localBlock === null && !statusQuery.isError;
  const statusRef = useRef(status);
  const activeRef = useRef(active);
  statusRef.current = status;
  activeRef.current = active;

  // Block rendering synchronously on a changed signature, then discard operator-scoped caches.
  useEffect(() => {
    if (signature === null || signature === clearedIdentity) return;
    const epoch = ++identityEpoch.current;
    const scoped = { predicate: (query: { queryKey: readonly unknown[] }) => !isOperatorStatusQuery(query.queryKey) };
    void (async () => {
      await queryClient.cancelQueries(scoped);
      if (epoch !== identityEpoch.current) return;
      queryClient.removeQueries(scoped);
      queryClient.getMutationCache().clear();
      if (epoch === identityEpoch.current) {
        lastInputSentAt.current = Number.NEGATIVE_INFINITY;
        setClearedIdentity(signature);
      }
    })();
    return () => { identityEpoch.current++; };
  }, [signature, clearedIdentity, queryClient]);

  // auth.me is null before PIN by design. Never release business children from
  // a fresh 30-second cached null or from the previous operator's auth snapshot.
  useEffect(() => {
    const epoch = ++authHydrationEpoch.current;
    if (!identityReady || state !== "ACTIVE" || localBlock !== null || statusQuery.isError || !signature) {
      setAuthReadyIdentity(null);
      return;
    }
    setAuthHydrationError(false);
    void (async () => {
      try {
        await utils.auth.me.invalidate(undefined, { refetchType: "none" });
        const me = await utils.auth.me.fetch();
        if (!me || me.id !== statusRef.current?.user?.id) throw new Error("Operator identity not confirmed");
        await utils.company.myCompanies.invalidate();
        if (epoch === authHydrationEpoch.current) setAuthReadyIdentity(signature);
      } catch {
        if (epoch === authHydrationEpoch.current) {
          setAuthReadyIdentity(null);
          setAuthHydrationError(true);
        }
      }
    })();
    return () => { authHydrationEpoch.current++; };
  }, [identityReady, signature, state, localBlock, statusQuery.isError, utils]);

  const validateStatus = useCallback(async () => {
    const epoch = ++validationEpoch.current;
    setAuthReadyIdentity(null);
    setLocalBlock("VERIFYING");
    await queryClient.cancelQueries({ predicate: query => isOperatorStatusQuery(query.queryKey) });
    const result = await statusQuery.refetch();
    if (epoch === validationEpoch.current && !result.error && result.data) setLocalBlock(null);
  }, [queryClient, statusQuery.refetch]);

  useOperatorSecuritySignal(signal => {
    if (signal.type === "status") {
      void validateStatus();
      return;
    }
    validationEpoch.current++;
    setAuthReadyIdentity(null);
    setLocalBlock(signal.type === "logout" ? "LOGIN_REQUIRED" : "LOCKED");
    void statusQuery.refetch();
    if (signal.type === "logout") {
      setClearedIdentity(null);
      void queryClient.cancelQueries({ predicate: query => !isOperatorStatusQuery(query.queryKey) })
        .then(() => queryClient.removeQueries({ predicate: query => !isOperatorStatusQuery(query.queryKey) }));
    }
  });

  // A server-clock deadline blocks locally without waiting for the next poll.
  useEffect(() => {
    if (!status || status.state !== "ACTIVE") return;
    const deadline = operatorDeadline(status);
    const verifyDeadline = () => {
      const remaining = deadline - estimatedServerNow();
      if (remaining > 0) return;
      setClockRevision(value => value + 1);
      void statusQuery.refetch();
    };
    const timer = setTimeout(verifyDeadline, Math.max(0, deadline - estimatedServerNow()) + 1);
    document.addEventListener("visibilitychange", verifyDeadline);
    window.addEventListener("focus", verifyDeadline);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", verifyDeadline);
      window.removeEventListener("focus", verifyDeadline);
    };
  }, [status, statusQuery.dataUpdatedAt, statusQuery.refetch]);

  // No mousemove, timers, polling, synthetic dispatches or heartbeat can prolong a session.
  useEffect(() => {
    if (!active) return;
    const onTrustedInput = (event: Event) => {
      if (!isTrustedOperatorActivity(event) || !activeRef.current) return;
      const current = statusRef.current;
      if (!current || effectiveOperatorState(current, estimatedServerNow()) !== "ACTIVE") {
        event.preventDefault();
        event.stopImmediatePropagation();
        flushSync(() => setClockRevision(value => value + 1));
        void statusQuery.refetch();
        return;
      }
      const now = performance.now();
      if (now - lastInputSentAt.current < OPERATOR_ACTIVITY_THROTTLE_MS || activity.isPending) return;
      lastInputSentAt.current = now;
      // Server asserts ACTIVE and timestamps with its own clock. No client time is sent.
      activity.mutate(undefined, { onSettled: () => { void statusQuery.refetch(); } });
    };
    window.addEventListener("pointerdown", onTrustedInput, { capture: true });
    window.addEventListener("keydown", onTrustedInput, { capture: true });
    window.addEventListener("touchstart", onTrustedInput, { capture: true, passive: false });
    return () => {
      window.removeEventListener("pointerdown", onTrustedInput, true);
      window.removeEventListener("keydown", onTrustedInput, true);
      window.removeEventListener("touchstart", onTrustedInput, true);
    };
  }, [active, activity.isPending, activity.mutate, statusQuery.refetch]);

  const renderedState: OperatorSessionState | "VERIFYING" = !status || !identityReady || statusQuery.isError ||
    (state === "ACTIVE" && localBlock === null && !authReady)
    ? "VERIFYING" : localBlock ?? state ?? "VERIFYING";
  const productionTerminal = (status as (OperatorSessionStatus & {
    productionTerminal?: { companyId: number; name: string } | null;
  }) | undefined)?.productionTerminal;
  const productionStation = Boolean(productionTerminal) && isProductionStationPath(path);

  return <>
    {productionStation ?
      // Only server-paired KDS retain printing effects. Hidden/inert prevents human interaction.
      <div hidden={!active} inert={!active} aria-hidden={!active} style={active ? undefined : { display: "none" }}>{children}</div>
      : active ? <>{children}</> : null}
    {!active && <AnniversaryAccess serverNow={status?.serverNow} company={identityReady ? status?.company : null}>
      <OperatorAccessForm key={`${signature}:${renderedState}`} status={status} state={renderedState}
        unavailable={statusQuery.isError || authHydrationError} onRecheck={validateStatus}
        productionStation={productionStation} unpairedStation={isProductionStationPath(path) && !productionTerminal} />
    </AnniversaryAccess>}
  </>;
}

type AccessFormProps = {
  status?: OperatorSessionStatus;
  state: OperatorSessionState | "VERIFYING";
  unavailable: boolean;
  onRecheck: () => Promise<void>;
  productionStation: boolean;
  unpairedStation: boolean;
};

function OperatorAccessForm({ status, state, unavailable, onRecheck, productionStation, unpairedStation }: AccessFormProps) {
  const { logout } = useAuth({ redirectOnUnauthenticated: false });
  const queryClient = useQueryClient();
  const unlock = trpc.operatorSecurity.unlock.useMutation();
  const setup = trpc.operatorSecurity.setupPin.useMutation();
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ownsAccount, setOwnsAccount] = useState(false);
  const [message, setMessage] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [cooldownDeadline, setCooldownDeadline] = useState(0);
  const [cooldownNow, setCooldownNow] = useState(Date.now());
  const id = useId();
  const setupRequired = state === "PIN_SETUP_REQUIRED";
  const pinRequired = setupRequired || state === "PIN_CONFIRM_REQUIRED" || state === "LOCKED";
  const busy = connecting || unlock.isPending || setup.isPending;
  const cooldown = remainingCooldownSeconds(cooldownDeadline, cooldownNow);

  useEffect(() => {
    const seconds = status?.retryAfterSeconds ?? 0;
    setCooldownDeadline(seconds > 0 ? Date.now() + seconds * 1000 : 0);
    setCooldownNow(Date.now());
  }, [status?.serverNow, status?.retryAfterSeconds]);
  useEffect(() => {
    if (cooldownDeadline <= Date.now()) return;
    const tick = () => setCooldownNow(Date.now());
    const interval = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", tick); };
  }, [cooldownDeadline]);

  const freshLogin = async (loginAfterLogout: boolean) => {
    setConnecting(true);
    setMessage("");
    try {
      // useAuth.logout awaits the existing trpc.auth.logout and removes company cookies.
      await logout();
      await queryClient.cancelQueries();
      queryClient.clear();
      if (loginAfterLogout) await warmUpAndLogin();
      else window.location.assign("/");
    } catch {
      setMessage("Não foi possível encerrar a sessão no servidor. Verifique a conexão antes de trocar de operador.");
      setConnecting(false);
    }
  };

  const submitPin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || cooldown > 0) return;
    setMessage("");
    if (!isValidOperatorPin(pin)) { setMessage("Digite um PIN com exatamente 6 números."); return; }
    if (setupRequired && (!isValidOperatorPin(confirmation) || pin !== confirmation)) {
      setMessage("Os dois PINs devem ser iguais e conter 6 números."); return;
    }
    if (setupRequired && (!ownsAccount || !status?.user)) {
      setMessage("Confirme que a conta identificada é sua antes de criar o PIN."); return;
    }
    const submittedPin = pin;
    // Clear before each network attempt. Never put this secret in storage or messages.
    setPin("");
    setConfirmation("");
    try {
      if (setupRequired) {
        await setup.mutateAsync({ pin: submittedPin });
        setOwnsAccount(false);
      } else {
        const result = await unlock.mutateAsync({ pin: submittedPin });
        if (!result.success) {
          const seconds = Math.max(0, result.retryAfterSeconds);
          setCooldownDeadline(Date.now() + seconds * 1000);
          setCooldownNow(Date.now());
          setMessage(seconds > 0 ? "Limite de tentativas. Aguarde antes de tentar novamente." : "PIN não confirmado. Confira os números e tente novamente.");
          return;
        }
      }
      broadcastOperatorSecurity("status");
    } catch (error) {
      const safeSetupMessage = setupRequired && error instanceof TRPCClientError &&
        error.data?.code === "BAD_REQUEST" ? error.message : null;
      setMessage(safeSetupMessage ?? (setupRequired
        ? "Não foi possível criar o PIN. Se o prazo de cadastro expirou, faça um novo login completo."
        : "Não foi possível confirmar o acesso. Se a sessão expirou, faça um novo login completo."));
      // The server, not this form, decides whether OAuth must be performed again.
      if (error instanceof TRPCClientError &&
        ["UNAUTHORIZED", "FORBIDDEN"].includes(error.data?.code ?? "")) void onRecheck();
    } finally {
      setPin("");
      setConfirmation("");
    }
  };

  const titles: Record<string, string> = {
    SIGNED_OUT: "Bem-vindo à sua operação",
    LOGIN_REQUIRED: "É hora de se identificar novamente",
    PIN_SETUP_REQUIRED: "Crie seu PIN de operador",
    PIN_CONFIRM_REQUIRED: "Confirme sua identidade",
    LOCKED: "Sua operação está protegida",
    VERIFYING: unavailable ? "Conexão indisponível" : "Verificando seu acesso",
  };
  return <div>
    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7eee5] text-[#285847]">
      {pinRequired ? <LockKeyhole size={22} aria-hidden="true" /> : <ShieldCheck size={22} aria-hidden="true" />}
    </div>
    <h2 className="text-2xl font-semibold tracking-tight leading-tight">{titles[state]}</h2>
    <p className="mt-3 text-sm leading-relaxed text-[#597068]">
      {state === "LOCKED" ? "A sessão foi bloqueada por segurança. Use seu PIN para continuar, se o login ainda estiver válido."
        : setupRequired ? "Um PIN individual protege sua sessão nas pausas do dia. Ele não substitui o login completo."
        : state === "PIN_CONFIRM_REQUIRED" ? "Login concluído. Digite seu PIN individual para liberar a operação."
        : state === "LOGIN_REQUIRED" ? "Às 04h (America/Sao_Paulo), é necessário um novo login completo e, em seguida, a confirmação por PIN."
        : state === "SIGNED_OUT" ? "Entre com sua conta. Depois, confirme o PIN do operador para acessar o sistema."
        : unavailable ? "Não foi possível validar a sessão. Os dados da operação ficam ocultos até o servidor confirmar o acesso."
        : "Aguarde a confirmação do servidor. Nenhum dado da operação é exibido antes dela."}
    </p>
    {pinRequired && status?.user && <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#d6e0d4] p-3">
      {status.user.avatarUrl ? <img src={status.user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <UserRound size={25} aria-hidden="true" />}
      <div className="min-w-0"><p className="truncate text-sm font-semibold">{status.user.name || "Operador identificado"}</p><p className="break-all text-xs text-[#597068]">Conta: {status.user.id}</p></div>
    </div>}
    <div className="mt-5" aria-live="polite">{message && <p className="operator-access-message" role="alert">{message}</p>}</div>
    {pinRequired && <form className="mt-5 space-y-4" onSubmit={submitPin} autoComplete="off">
      <div className="space-y-2"><label htmlFor={`${id}-pin`} className="text-sm font-medium">{setupRequired ? "Novo PIN · 6 números" : "Seu PIN · 6 números"}</label>
        <input id={`${id}-pin`} name="operator-pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6}
          autoComplete="off" autoCorrect="off" spellCheck={false} required autoFocus disabled={busy || cooldown > 0}
          value={pin} onChange={event => setPin(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          aria-describedby={cooldown > 0 ? `${id}-cooldown` : `${id}-help`} />
      </div>
      {setupRequired && <>
        <div className="space-y-2"><label htmlFor={`${id}-confirm`} className="text-sm font-medium">Confirme o PIN</label>
          <input id={`${id}-confirm`} name="operator-pin-confirmation" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6}
            autoComplete="off" autoCorrect="off" spellCheck={false} required disabled={busy}
            value={confirmation} onChange={event => setConfirmation(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} />
        </div>
        <label className="flex items-start gap-3 text-xs leading-relaxed text-[#4a655c]" htmlFor={`${id}-ownership`}>
          <input id={`${id}-ownership`} type="checkbox" required checked={ownsAccount} disabled={busy} onChange={event => setOwnsAccount(event.target.checked)} />
          <span>Confirmo que a conta de <strong>{status?.user?.name || status?.user?.id || "operador identificado"}</strong> é minha. Vou manter meu PIN individual e não compartilhá-lo.</span>
        </label>
      </>}
      <p id={`${id}-help`} className="text-xs leading-relaxed text-[#597068]">{setupRequired
        ? "Use 6 números sem sequências simples ou padrões repetidos, como 123456 ou 111111. Crie o PIN logo após o login; se o prazo terminar, entre novamente. A identificação depende também do uso responsável da conta."
        : "Esqueceu seu PIN ou esta conta não é sua? Faça um novo login; não use a credencial de outro operador."}</p>
      {cooldown > 0 && <p id={`${id}-cooldown`} className="text-sm font-medium text-[#855520]" role="status">Nova tentativa em {cooldown}s.</p>}
      <button className="operator-access-primary" type="submit" disabled={busy || cooldown > 0 || !isValidOperatorPin(pin) || (setupRequired && (!ownsAccount || pin !== confirmation))}>
        {busy ? "Confirmando…" : setupRequired ? "Criar PIN e continuar" : "Confirmar e continuar"}<ArrowRight size={17} aria-hidden="true" />
      </button>
    </form>}
    {(state === "SIGNED_OUT" || state === "LOGIN_REQUIRED") && <button type="button" className="operator-access-primary mt-6" disabled={busy} onClick={() => { void freshLogin(true); }}>
      {connecting ? "Preparando novo login…" : "Entrar com minha conta"}<ArrowRight size={17} aria-hidden="true" />
    </button>}
    {state === "VERIFYING" && unavailable && <button type="button" className="operator-access-primary mt-6" onClick={() => { void onRecheck(); }}>Verificar conexão novamente</button>}
    {state === "VERIFYING" && unavailable && <button type="button" className="operator-access-secondary mt-4" disabled={busy} onClick={() => { void freshLogin(true); }}>Fazer novo login completo</button>}
    {pinRequired && <button type="button" className="operator-access-secondary mt-4" disabled={busy} onClick={() => { void freshLogin(true); }}>Trocar operador / fazer novo login</button>}
    {state !== "SIGNED_OUT" && (state !== "VERIFYING" || unavailable) && <button type="button" className="operator-access-secondary mt-2 flex items-center gap-2" disabled={busy} onClick={() => { void freshLogin(false); }}><LogOut size={14} />Sair desta conta</button>}
    {(productionStation || unpairedStation) && <p className="mt-6 border-t border-[#d6e0d4] pt-4 text-xs leading-relaxed text-[#597068]">{productionStation
      ? "Terminal de produção pareado: rotinas automáticas do KDS podem continuar sem acesso à interface. Ações humanas ainda exigem login válido e PIN."
      : "Para manter as rotinas automáticas do KDS durante o bloqueio, um administrador deve parear este navegador em Segurança antes do primeiro uso do terminal."}</p>}
    <p className="mt-6 text-[11px] leading-relaxed text-[#6b7e76]">Bloqueio por inatividade: {status?.idleMinutes ?? "—"} min · Login diário às 04h · America/Sao_Paulo</p>
  </div>;
}

export default OperatorSecurityGate;
