import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { ArrowRight, LockKeyhole, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { warmUpAndLogin, isLoginInProgress } from "@/const";
import { useCompany } from "@/contexts/CompanyContext";
import AnniversaryAccess, { AccessPendingCard } from "./AnniversaryAccess";
import type { OperatorSessionState, OperatorSessionStatus } from "../../../shared/sessionSecurity";
import {
  beginOperatorStatusCheck,
  effectiveOperatorState,
  finishOperatorStatusCheck,
  initialOperatorUiSnapshot,
  isOperatorStatusQuery,
  isTrustedOperatorActivity,
  isValidOperatorPin,
  operatorDeadline,
  operatorIdentitySignature,
  operatorUiServerNow,
  OPERATOR_ACTIVITY_EVENTS,
  OPERATOR_ACTIVITY_THROTTLE_MS,
  OPERATOR_STATUS_POLL_MS,
  remainingCooldownSeconds,
  type OperatorSignalType,
  type OperatorUiSnapshot,
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

function ProtectedOperatorGate({ children, path }: { children: ReactNode; path: string }) {
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const { activeCompanyId } = useCompany();
  const companyRef = useRef(activeCompanyId);
  companyRef.current = activeCompanyId;
  // This gate owns when a response is accepted. Shared query cache (including a
  // LOCKED snapshot from before PIN) is never itself authority to release UI.
  const statusQuery = trpc.operatorSecurity.status.useQuery(undefined, {
    enabled: false,
    retry: 2,
    retryDelay: attempt => Math.min(1000 * (attempt + 1), 3000),
    staleTime: 0,
  });
  const activity = trpc.operatorSecurity.activity.useMutation();
  const [snapshot, setSnapshot] = useState(initialOperatorUiSnapshot);
  const snapshotRef = useRef(snapshot);
  const commit = useCallback((next: OperatorUiSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);
  const [clearedIdentity, setClearedIdentity] = useState<string | null>(null);
  const [authReadyIdentity, setAuthReadyIdentity] = useState<string | null>(null);
  const [authHydrationError, setAuthHydrationError] = useState(false);
  const [authRetry, setAuthRetry] = useState(0);
  const authHydrationEpoch = useRef(0);
  const [, setClockRevision] = useState(0);
  const identityEpoch = useRef(0);
  const lastInputSentAt = useRef(Number.NEGATIVE_INFINITY);
  const activityPending = useRef(false);
  const activityRequest = useRef(0);
  const mounted = useRef(true);
  const status = snapshot.status;
  const signature = status ? operatorIdentitySignature(status) : null;
  const identityReady = signature !== null && signature === clearedIdentity;
  const state = status ? effectiveOperatorState(status, operatorUiServerNow(snapshot, Date.now())) : null;
  const authReady = signature !== null && authReadyIdentity === signature;
  const localBlock = snapshot.block;
  const active = identityReady && authReady && state === "ACTIVE" && localBlock === null && !snapshot.unavailable;
  const statusRef = useRef(status);
  const activeRef = useRef(active);
  statusRef.current = status;
  activeRef.current = active;

  const validateStatus = useCallback(async (signal: OperatorSignalType = "status") => {
    const next = beginOperatorStatusCheck(snapshotRef.current, signal);
    if (signal !== "status") {
      activeRef.current = false;
      authHydrationEpoch.current++;
      // Blocking signals must hide the operational tree before another event can run.
      flushSync(() => { setAuthReadyIdentity(null); commit(next); });
    } else commit(next);
    const epoch = next.epoch;
    const company = companyRef.current;
    try {
      await queryClient.cancelQueries({ predicate: query => isOperatorStatusQuery(query.queryKey) });
      if (!mounted.current || snapshotRef.current.epoch !== epoch) return;
      const result = await statusQuery.refetch();
      if (!mounted.current || company !== companyRef.current) return;
      commit(finishOperatorStatusCheck(snapshotRef.current, epoch, result.data, Date.now(), Boolean(result.error)));
    } catch {
      if (mounted.current) commit(finishOperatorStatusCheck(snapshotRef.current, epoch, undefined, Date.now(), true));
    }
  }, [commit, queryClient, statusQuery.refetch]);

  // Poll/focus/reconnect validate only; none are activity or extend deadlines.
  useEffect(() => {
    mounted.current = true;
    void validateStatus();
    const poll = setInterval(() => { void validateStatus(); }, OPERATOR_STATUS_POLL_MS);
    const recheck = () => { void validateStatus(); };
    window.addEventListener("focus", recheck);
    window.addEventListener("online", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      mounted.current = false;
      snapshotRef.current = { ...snapshotRef.current, epoch: snapshotRef.current.epoch + 1 };
      clearInterval(poll);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("online", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [validateStatus]);

  useEffect(() => { void validateStatus(); }, [activeCompanyId, validateStatus]);
  useEffect(() => queryClient.getQueryCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "invalidate" && isOperatorStatusQuery(event.query.queryKey)) {
      void validateStatus();
    }
  }), [queryClient, validateStatus]);

  // Changed signatures block synchronously in render, then discard scoped caches.
  useEffect(() => {
    if (signature === null || signature === clearedIdentity) return;
    const epoch = ++identityEpoch.current;
    authHydrationEpoch.current++;
    setAuthReadyIdentity(null);
    const scoped = { predicate: (query: { queryKey: readonly unknown[] }) => !isOperatorStatusQuery(query.queryKey) };
    void (async () => {
      await queryClient.cancelQueries(scoped);
      if (epoch !== identityEpoch.current || !mounted.current) return;
      queryClient.removeQueries(scoped);
      queryClient.getMutationCache().clear();
      lastInputSentAt.current = Number.NEGATIVE_INFINITY;
      activityRequest.current++;
      activityPending.current = false;
      setClearedIdentity(signature);
    })();
    return () => { identityEpoch.current++; };
  }, [signature, clearedIdentity, queryClient]);

  // ACTIVE -> ACTIVE for this identity never invalidates auth/company or editors.
  // Initial/PIN/identity transitions still require fresh auth.me before release.
  useEffect(() => {
    if (!identityReady || state !== "ACTIVE" || localBlock !== null || !signature) {
      authHydrationEpoch.current++;
      setAuthReadyIdentity(null);
      return;
    }
    if (authReadyIdentity === signature) return;
    const epoch = ++authHydrationEpoch.current;
    setAuthHydrationError(false);
    void (async () => {
      try {
        await utils.auth.me.invalidate(undefined, { refetchType: "none" });
        const me = await utils.auth.me.fetch();
        if (!me || me.id !== statusRef.current?.user?.id) throw new Error("Operator identity not confirmed");
        if (epoch !== authHydrationEpoch.current || !mounted.current) return;
        await utils.company.myCompanies.invalidate();
        if (epoch === authHydrationEpoch.current && mounted.current) setAuthReadyIdentity(signature);
      } catch {
        if (epoch === authHydrationEpoch.current && mounted.current) {
          setAuthReadyIdentity(null);
          setAuthHydrationError(true);
        }
      }
    })();
    return () => { authHydrationEpoch.current++; };
  }, [identityReady, signature, state, localBlock, authReadyIdentity, authRetry, utils]);

  useOperatorSecuritySignal(signal => {
    void validateStatus(signal.type === "unlocked" && activeRef.current ? "status" : signal.type);
    if (signal.type === "logout") {
      setClearedIdentity(null);
      void queryClient.cancelQueries({ predicate: query => !isOperatorStatusQuery(query.queryKey) })
        .then(() => queryClient.removeQueries({ predicate: query => !isOperatorStatusQuery(query.queryKey) }));
    }
  });

  // Local idle and 04h deadlines stay fail-closed regardless of pending requests.
  useEffect(() => {
    if (!status || status.state !== "ACTIVE") return;
    const verifyDeadline = () => {
      if (operatorDeadline(status) > operatorUiServerNow(snapshotRef.current, Date.now())) return;
      activeRef.current = false;
      setClockRevision(value => value + 1);
      void validateStatus();
    };
    const timer = setTimeout(verifyDeadline, Math.max(0,
      operatorDeadline(status) - operatorUiServerNow(snapshotRef.current, Date.now())) + 1);
    document.addEventListener("visibilitychange", verifyDeadline);
    window.addEventListener("focus", verifyDeadline);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", verifyDeadline);
      window.removeEventListener("focus", verifyDeadline);
    };
  }, [status, validateStatus]);

  // No mousemove, programmatic scroll, timers or synthetic dispatch prolongs access.
  useEffect(() => {
    if (!active) return;
    const onTrustedInput = (event: Event) => {
      if (!isTrustedOperatorActivity(event) || !activeRef.current) return;
      const current = snapshotRef.current;
      if (!current.status || effectiveOperatorState(current.status, operatorUiServerNow(current, Date.now())) !== "ACTIVE") {
        event.preventDefault();
        event.stopImmediatePropagation();
        activeRef.current = false;
        flushSync(() => setClockRevision(value => value + 1));
        void validateStatus();
        return;
      }
      const now = performance.now();
      if (now - lastInputSentAt.current < OPERATOR_ACTIVITY_THROTTLE_MS || activityPending.current) return;
      lastInputSentAt.current = now;
      activityPending.current = true;
      const request = ++activityRequest.current;
      const epoch = current.epoch;
      const identity = operatorIdentitySignature(current.status);
      const company = companyRef.current;
      // Only the committed server response can move lastActivityAt, never client input time.
      activity.mutate(undefined, {
        onSuccess: result => {
          if (!mounted.current || activityRequest.current !== request || snapshotRef.current.epoch !== epoch || companyRef.current !== company ||
            !snapshotRef.current.status || operatorIdentitySignature(snapshotRef.current.status) !== identity) return;
          const acknowledged = (result as { status?: OperatorSessionStatus }).status;
          if (!acknowledged || operatorIdentitySignature(acknowledged) !== identity || acknowledged.company?.id !== current.status?.company?.id) return;
          const statusWithTerminal = { ...acknowledged,
            productionTerminal: snapshotRef.current.status.productionTerminal };
          commit(finishOperatorStatusCheck(snapshotRef.current, epoch, statusWithTerminal, Date.now()));
        },
        onError: () => {
          if (!mounted.current || activityRequest.current !== request) return;
          if (snapshotRef.current.epoch === epoch) {
            commit(finishOperatorStatusCheck(snapshotRef.current, epoch, undefined, Date.now(), true));
          }
          toast.error("Não foi possível confirmar a atividade no servidor. Verifique a conexão.");
        },
        onSettled: () => {
          if (activityRequest.current !== request) return;
          activityPending.current = false;
          if (mounted.current) void validateStatus();
        },
      });
    };
    for (const type of OPERATOR_ACTIVITY_EVENTS) window.addEventListener(type, onTrustedInput, { capture: true, passive: false });
    return () => {
      for (const type of OPERATOR_ACTIVITY_EVENTS) window.removeEventListener(type, onTrustedInput, true);
    };
  }, [active, activity.mutate, commit, validateStatus]);

  const renderedState: OperatorSessionState | "VERIFYING" = snapshot.unavailable || !status || !identityReady ||
    (state === "ACTIVE" && localBlock === null && !authReady)
    ? "VERIFYING" : localBlock ?? state ?? "VERIFYING";
  const productionTerminal = status?.productionTerminal;
  const productionStation = Boolean(productionTerminal) && isProductionStationPath(path);
  const recheck = async () => { setAuthHydrationError(false); setAuthRetry(value => value + 1); await validateStatus(); };

  return <>
    {productionStation ?
      // Server-paired KDS keep printing effects mounted even while hidden/inert.
      <div hidden={!active} inert={!active} aria-hidden={!active} style={active ? undefined : { display: "none" }}>{children}</div>
      : active ? <>{children}</> : null}
    {!active && <AnniversaryAccess serverNow={status?.serverNow} company={identityReady ? status?.company : null}>
      <OperatorAccessForm key={signature} status={status} state={renderedState}
        unavailable={snapshot.unavailable || authHydrationError} onRecheck={recheck}
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
  const [awaitingRelease, setAwaitingRelease] = useState(false);
  const releaseWasVerifying = useRef(false);
  const submissionPending = useRef(false);
  const [connecting, setConnecting] = useState(false);
  const [cooldownDeadline, setCooldownDeadline] = useState(0);
  const [cooldownNow, setCooldownNow] = useState(Date.now());
  const id = useId();
  const setupRequired = state === "PIN_SETUP_REQUIRED";
  const pinRequired = setupRequired || state === "PIN_CONFIRM_REQUIRED" || state === "LOCKED";
  const busy = connecting || isLoginInProgress() || unlock.isPending || setup.isPending;
  const pinBusy = busy || awaitingRelease;
  const cooldown = remainingCooldownSeconds(cooldownDeadline, cooldownNow);

  useEffect(() => {
    if (!awaitingRelease) return;
    if (state === "VERIFYING") releaseWasVerifying.current = true;
    else if (state === "LOGIN_REQUIRED" || state === "SIGNED_OUT" || (pinRequired && releaseWasVerifying.current && !unavailable)) {
      // Fresh ACTIVE was confirmed but a new genuine lock happened before release.
      submissionPending.current = false;
      releaseWasVerifying.current = false;
      setAwaitingRelease(false);
    }
  }, [awaitingRelease, state, pinRequired, unavailable]);

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
    if (isLoginInProgress()) return;
    setConnecting(true);
    setMessage("");
    try {
      // useAuth.logout awaits the existing trpc.auth.logout and removes company cookies.
      const prepareLogin = async () => {
        await logout();
        await queryClient.cancelQueries();
        queryClient.clear();
      };
      if (loginAfterLogout) await warmUpAndLogin(prepareLogin);
      else {
        await prepareLogin();
        window.location.assign("/");
      }
    } catch {
      setMessage("Não foi possível preparar o login. Verifique a conexão e os cookies ou abra o ABRWF diretamente no navegador.");
      setConnecting(false);
    }
  };

  const submitPin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pinBusy || submissionPending.current || cooldown > 0) return;
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
    submissionPending.current = true;
    let succeeded = false;
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
      succeeded = true;
      setAwaitingRelease(true);
      // A successful mutation is not permission to render. Await fresh ACTIVE + auth.me.
      broadcastOperatorSecurity("unlocked");
    } catch (error) {
      const safeSetupMessage = setupRequired && error instanceof TRPCClientError &&
        error.data?.code === "BAD_REQUEST" ? error.message : null;
      setMessage(safeSetupMessage ?? (setupRequired
        ? "Não foi possível confirmar o cadastro no servidor. Verifique a conexão; se o prazo expirou, faça um novo login completo."
        : "Não foi possível confirmar o acesso no servidor. Verifique a conexão; se a sessão expirou, faça um novo login completo."));
      // The server, not this form, decides whether OAuth must be performed again.
      if (error instanceof TRPCClientError &&
        ["UNAUTHORIZED", "FORBIDDEN"].includes(error.data?.code ?? "")) void onRecheck();
    } finally {
      if (!succeeded) submissionPending.current = false;
      setPin("");
      setConfirmation("");
    }
  };

  if (state === "VERIFYING" && !unavailable) return <AccessPendingCard />;

  const titles: Record<string, string> = {
    SIGNED_OUT: "Acesse o ABRWF",
    LOGIN_REQUIRED: "Acesse o ABRWF",
    PIN_SETUP_REQUIRED: "Cadastre seu PIN",
    PIN_CONFIRM_REQUIRED: "Confirme seu PIN",
    LOCKED: "Sessão bloqueada",
    VERIFYING: unavailable ? "Conexão indisponível" : "Acesse o ABRWF",
  };
  return <div>
    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7eee5] text-[#285847]">
      {pinRequired ? <LockKeyhole size={22} aria-hidden="true" /> : <ShieldCheck size={22} aria-hidden="true" />}
    </div>
    <h2 className="text-2xl font-semibold tracking-tight leading-tight">{titles[state]}</h2>
    <p className="mt-2 text-sm leading-relaxed text-[#597068]">
      {setupRequired ? "Crie um PIN de 6 números."
        : pinRequired ? "Digite seu PIN para continuar."
        : state === "LOGIN_REQUIRED" || state === "SIGNED_OUT" ? "Faça login para continuar."
        : unavailable ? "Verifique a conexão e tente novamente."
        : "Faça login para continuar."}
    </p>
    {pinRequired && status?.user && <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#d6e0d4] p-3">
      {status.user.avatarUrl ? <img src={status.user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <UserRound size={25} aria-hidden="true" />}
      <div className="min-w-0"><p className="truncate text-sm font-semibold">{status.user.name || "Operador identificado"}</p></div>
    </div>}
    <div aria-live="polite">{message && <p className="operator-access-message mt-4" role="alert">{message}</p>}</div>
    {pinRequired && <form className="mt-5 space-y-4" onSubmit={submitPin} autoComplete="off">
      <div className="space-y-2"><label htmlFor={`${id}-pin`} className="text-sm font-medium">{setupRequired ? "Novo PIN · 6 números" : "Seu PIN · 6 números"}</label>
        <input id={`${id}-pin`} name="operator-pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6}
          autoComplete="off" autoCorrect="off" spellCheck={false} required autoFocus disabled={pinBusy || cooldown > 0}
          value={pin} onChange={event => setPin(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          aria-describedby={cooldown > 0 ? `${id}-cooldown` : `${id}-help`} />
      </div>
      {setupRequired && <>
        <div className="space-y-2"><label htmlFor={`${id}-confirm`} className="text-sm font-medium">Confirme o PIN</label>
          <input id={`${id}-confirm`} name="operator-pin-confirmation" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6}
            autoComplete="off" autoCorrect="off" spellCheck={false} required disabled={pinBusy}
            value={confirmation} onChange={event => setConfirmation(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} />
        </div>
        <label className="flex items-start gap-3 text-xs leading-relaxed text-[#4a655c]" htmlFor={`${id}-ownership`}>
          <input id={`${id}-ownership`} type="checkbox" required checked={ownsAccount} disabled={pinBusy} onChange={event => setOwnsAccount(event.target.checked)} />
          <span>Esta conta é minha. Não compartilharei meu PIN.</span>
        </label>
      </>}
      <p id={`${id}-help`} className="text-xs leading-relaxed text-[#597068]">{setupRequired
        ? "Evite sequências e números repetidos."
        : "Esqueceu seu PIN? Solicite a redefinição a um administrador."}</p>
      {cooldown > 0 && <p id={`${id}-cooldown`} className="text-sm font-medium text-[#855520]" role="status">Nova tentativa em {cooldown}s.</p>}
      <button className="operator-access-primary" type="submit" disabled={pinBusy || cooldown > 0 || !isValidOperatorPin(pin) || (setupRequired && (!ownsAccount || pin !== confirmation))}>
        {pinBusy ? "Confirmando…" : setupRequired ? "Criar PIN e continuar" : "Confirmar e continuar"}<ArrowRight size={17} aria-hidden="true" />
      </button>
    </form>}
    {(state === "SIGNED_OUT" || state === "LOGIN_REQUIRED") && <button type="button" className="operator-access-primary mt-6" disabled={busy} onClick={() => { void freshLogin(true); }}>
      {connecting ? "Entrando…" : "Entrar"}<ArrowRight size={17} aria-hidden="true" />
    </button>}
    {state === "VERIFYING" && unavailable && <button type="button" className="operator-access-primary mt-6" onClick={() => { void onRecheck(); }}>Verificar conexão novamente</button>}
    {state === "VERIFYING" && unavailable && <button type="button" className="operator-access-secondary mt-4" disabled={busy} onClick={() => { void freshLogin(true); }}>Fazer novo login completo</button>}
    {pinRequired && <button type="button" className="operator-access-secondary mt-4" disabled={busy} onClick={() => { void freshLogin(true); }}>Trocar operador</button>}
    {state !== "SIGNED_OUT" && (state !== "VERIFYING" || unavailable) && <button type="button" className="operator-access-secondary mt-2 flex items-center gap-2" disabled={busy} onClick={() => { void freshLogin(false); }}><LogOut size={14} />Sair</button>}
    {(productionStation || unpairedStation) && <p className="mt-6 border-t border-[#d6e0d4] pt-4 text-xs leading-relaxed text-[#597068]">{productionStation
      ? "KDS em execução. Identifique-se para operar."
      : "KDS não pareado. Configure este terminal em Segurança."}</p>}
  </div>;
}

export default OperatorSecurityGate;
