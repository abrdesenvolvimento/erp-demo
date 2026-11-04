import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "./db";
import {
  companies, userCompanies, users, operatorSessions, operatorPins,
  securityPolicies, securityEvents, type User,
} from "../drizzle/schema";
import {
  ALLOWED_IDLE_MINUTES, DAILY_LOGIN_HOUR, DEFAULT_IDLE_MINUTES,
  SECURITY_TIME_ZONE, nextDailyLoginCutoff,
  type OperatorSessionState, type OperatorSessionStatus,
} from "../shared/sessionSecurity";

const ENROLLMENT_MS = 5 * 60_000;
const PIN_BLOCK_MS = 15 * 60_000;
const MAX_PIN_ATTEMPTS = 5;
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;
type Session = typeof operatorSessions.$inferSelect;
type Actor = Pick<User, "id"> | null | undefined;

/** TIMESTAMP(0) arredonda frações; nunca gravar um horário de segurança no futuro. */
export function securityTimestamp(now: number): Date {
  return new Date(Math.floor(now / 1000) * 1000);
}

async function database(): Promise<Database> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Serviço de segurança indisponível. Tente novamente." });
  return db;
}
function requireId(user: Actor): string {
  if (!user?.id) throw new TRPCError({ code: "UNAUTHORIZED", message: "Entre novamente para continuar." });
  return user.id;
}
async function currentUser(db: Executor, userId: string, lock = false): Promise<User> {
  const query = db.select().from(users).where(eq(users.id, userId)).limit(1);
  const [user] = await (lock ? query.for("update") : query);
  if (!user || user.blocked) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário indisponível ou bloqueado. Entre em contato com o administrador." });
  return user;
}
async function audit(db: Executor, userId: string, sessionId: string | null, companyId: number | undefined, event: string, details: string, now = Date.now()) {
  // Somente mensagens constantes. Nunca registrar PIN, hash, cookie ou user-agent.
  await db.insert(securityEvents).values({ userId, sessionId, companyId: companyId ?? null, event, details, createdAt: securityTimestamp(now) });
}
function idleValue(value: number | null | undefined): number {
  return ALLOWED_IDLE_MINUTES.includes(value as typeof ALLOWED_IDLE_MINUTES[number]) ? value! : DEFAULT_IDLE_MINUTES;
}
async function policyContext(db: Executor, user: User, companyId?: number) {
  if (companyId !== undefined && (!Number.isSafeInteger(companyId) || companyId <= 0)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa inválida." });
  }
  // Inclusive administradores precisam de vínculo explícito à empresa.
  const memberships = await db.select({ companyId: userCompanies.companyId, role: userCompanies.role }).from(userCompanies).where(eq(userCompanies.userId, user.id));
  const ids = [...new Set(memberships.map(row => row.companyId))];
  if (companyId !== undefined && !ids.includes(companyId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado a esta empresa." });
  }
  const targetIds = companyId === undefined ? ids : [companyId];
  const activeCompanies = targetIds.length ? await db.select({ id: companies.id, name: companies.name, logoUrl: companies.logoUrl }).from(companies).where(and(inArray(companies.id, targetIds), eq(companies.active, true))) : [];
  if (companyId !== undefined && !activeCompanies.length) throw new TRPCError({ code: "FORBIDDEN", message: "Empresa inexistente ou inativa." });
  const activeIds = activeCompanies.map(row => row.id);
  const policies = activeIds.length ? await db.select({ companyId: securityPolicies.companyId, idleMinutes: securityPolicies.idleMinutes }).from(securityPolicies).where(inArray(securityPolicies.companyId, activeIds)) : [];
  const values = activeIds.map(id => idleValue(policies.find(row => row.companyId === id)?.idleMinutes));
  return { idleMinutes: values.length ? Math.min(...values) : DEFAULT_IDLE_MINUTES, company: companyId === undefined ? null : activeCompanies[0], companyAdmin: memberships.some(row => row.companyId === companyId && row.role === "admin") };
}

/** Avaliação pura: nenhum cookie legado, lastSignedIn ou relógio do cliente autoriza acesso. */
export function evaluateStatus(input: { user: Actor; session: Session | null; hasPin: boolean; now: number; idleMinutes: number }): OperatorSessionState {
  const { user, session, hasPin, now, idleMinutes } = input;
  if (!user) return "SIGNED_OUT";
  if (!session || session.userId !== user.id || session.revokedAt) return "LOGIN_REQUIRED";
  const authenticated = session.authenticatedAt?.getTime();
  const expiry = session.expiresAt?.getTime();
  if (!Number.isFinite(authenticated) || authenticated > now || !Number.isFinite(expiry) || expiry <= now || nextDailyLoginCutoff(authenticated) <= now) return "LOGIN_REQUIRED";
  if (!hasPin) return now - authenticated < ENROLLMENT_MS ? "PIN_SETUP_REQUIRED" : "LOGIN_REQUIRED";
  if (!session.confirmedAt) return "PIN_CONFIRM_REQUIRED";
  const activity = session.lastActivityAt?.getTime();
  if (session.lockedAt || !Number.isFinite(activity) || activity > now || now - activity >= idleValue(idleMinutes) * 60_000) return "LOCKED";
  return "ACTIVE";
}
function denyState(state: OperatorSessionState): never {
  const messages: Record<OperatorSessionState, string> = {
    SIGNED_OUT: "Entre novamente para continuar.", LOGIN_REQUIRED: "Sua sessão expirou. Entre novamente para continuar.",
    PIN_SETUP_REQUIRED: "Cadastre seu PIN de segurança para continuar.", PIN_CONFIRM_REQUIRED: "Confirme seu PIN para continuar.",
    LOCKED: "Sessão bloqueada. Confirme seu PIN para continuar.", ACTIVE: "Operação não permitida para uma sessão ativa.",
  };
  throw new TRPCError({ code: state === "SIGNED_OUT" || state === "LOGIN_REQUIRED" ? "UNAUTHORIZED" : "FORBIDDEN", message: messages[state] });
}
async function lockedContext(tx: Transaction, userId: string, sid: string | undefined, companyId?: number) {
  // Ordem única de locks: usuário -> PIN -> sessão. O lock do usuário também
  // serializa o primeiro cadastro (quando ainda não existe uma linha de PIN).
  const user = await currentUser(tx, userId, true);
  const context = await policyContext(tx, user, companyId);
  const [pin] = await tx.select().from(operatorPins).where(eq(operatorPins.userId, userId)).limit(1).for("update");
  const [session] = sid ? await tx.select().from(operatorSessions).where(and(eq(operatorSessions.id, sid), eq(operatorSessions.userId, userId))).limit(1).for("update") : [];
  const now = Date.now(); // Ler após os locks: tempo aguardando no banco não renova a sessão.
  const state = evaluateStatus({ user, session: session ?? null, hasPin: !!pin, now, idleMinutes: context.idleMinutes });
  return { ...context, user, pin, session, now, state };
}
async function persistIdleLock(tx: Transaction, context: Awaited<ReturnType<typeof lockedContext>>, companyId?: number) {
  if (context.state === "LOCKED" && context.session && !context.session.lockedAt) {
    await tx.update(operatorSessions).set({ lockedAt: securityTimestamp(context.now) }).where(and(eq(operatorSessions.id, context.session.id), eq(operatorSessions.userId, context.user.id), isNull(operatorSessions.lockedAt), isNull(operatorSessions.revokedAt)));
    await audit(tx, context.user.id, context.session.id, companyId, "idle_lock", "Sessão bloqueada por inatividade.", context.now);
    context.session.lockedAt = securityTimestamp(context.now);
  }
}

/** PIN numérico, sem dígito único, padrões repetidos ou sequências crescentes/decrescentes. */
export function isValidOperatorPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return false;
  for (const size of [1, 2, 3]) if (pin === pin.slice(0, size).repeat(6 / size)) return false;
  const digits = [...pin].map(Number);
  for (const step of [1, -1]) if (digits.every((digit, i) => !i || digit === (digits[i - 1] + step + 10) % 10)) return false;
  return true;
}
function derivePin(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(pin, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, hash) => error ? reject(error) : resolve(hash)));
}
export async function hashPin(pin: string): Promise<string> {
  if (!isValidOperatorPin(pin)) throw new TRPCError({ code: "BAD_REQUEST", message: "Use um PIN de 6 dígitos sem repetições ou sequências simples." });
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await derivePin(pin, salt)).toString("hex")}`;
}
export async function checkPin(pin: string, encoded: string): Promise<boolean> {
  if (!/^\d{6}$/.test(pin) || !/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(encoded)) return false;
  const [salt, stored] = encoded.split(":");
  const candidate = await derivePin(pin, Buffer.from(salt, "hex"));
  return timingSafeEqual(candidate, Buffer.from(stored, "hex"));
}

export async function createOperatorSession(userId: string, userAgent: string): Promise<string> {
  const db = await database();
  return db.transaction(async tx => {
    const user = await currentUser(tx, userId, true);
    if (user.loginMethod === "manual") throw new TRPCError({ code: "FORBIDDEN", message: "Use um login autenticado para iniciar a sessão de segurança." });
    const now = Date.now();
    const id = randomUUID();
    await tx.insert(operatorSessions).values({ id, userId, userAgent: (userAgent ?? "").slice(0, 255), authenticatedAt: securityTimestamp(now), expiresAt: securityTimestamp(nextDailyLoginCutoff(now)), lastActivityAt: securityTimestamp(now), lockedAt: null, confirmedAt: null, revokedAt: null });
    await audit(tx, userId, id, undefined, "login", "Nova sessão autenticada.", now);
    return id;
  });
}
export async function loadOperatorSession(id: string, userId: string): Promise<Session | null> {
  const db = await database();
  const [session] = await db.select().from(operatorSessions).where(and(eq(operatorSessions.id, id), eq(operatorSessions.userId, userId))).limit(1);
  return session ?? null;
}
export async function resolveOperatorStatus(user: Actor, sid: string | undefined, companyId?: number): Promise<OperatorSessionStatus> {
  if (!user) return { state: "SIGNED_OUT", user: null, company: null, sessionRef: null, idleMinutes: DEFAULT_IDLE_MINUTES, serverNow: Date.now(), lastActivityAt: null, expiresAt: null, retryAfterSeconds: 0, hasPin: false };
  const db = await database();
  return db.transaction(async tx => {
    const context = await lockedContext(tx, user.id, sid, companyId);
    await persistIdleLock(tx, context, companyId);
    return {
      state: context.state, user: { id: context.user.id, name: context.user.name, avatarUrl: context.user.avatarUrl },
      company: context.company, idleMinutes: context.idleMinutes, serverNow: context.now,
      sessionRef: context.session ? publicSessionId(context.session.id) : null,
      lastActivityAt: context.session?.lastActivityAt?.getTime() ?? null, expiresAt: context.session?.expiresAt?.getTime() ?? null,
      retryAfterSeconds: Math.max(0, Math.ceil(((context.pin?.blockedUntil?.getTime() ?? 0) - context.now) / 1000)), hasPin: !!context.pin,
    };
  });
}
function activeContextStatus(context: Awaited<ReturnType<typeof lockedContext>>): OperatorSessionStatus {
  return {
    state: "ACTIVE", user: { id: context.user.id, name: context.user.name, avatarUrl: context.user.avatarUrl },
    company: context.company, idleMinutes: context.idleMinutes, serverNow: context.now,
    sessionRef: context.session ? publicSessionId(context.session.id) : null,
    lastActivityAt: context.session?.lastActivityAt?.getTime() ?? null,
    expiresAt: context.session?.expiresAt?.getTime() ?? null,
    retryAfterSeconds: Math.max(0, Math.ceil(((context.pin?.blockedUntil?.getTime() ?? 0) - context.now) / 1000)),
    hasPin: !!context.pin,
  };
}
export async function assertOperatorActive(user: Actor, sid: string | undefined, companyId?: number): Promise<void> {
  const id = requireId(user);
  const db = await database();
  const state = await db.transaction(async tx => {
    const context = await lockedContext(tx, id, sid, companyId);
    await persistIdleLock(tx, context, companyId);
    return context.state;
  });
  // Lançar após commit para não desfazer bloqueio/auditoria por inatividade.
  if (state !== "ACTIVE") denyState(state);
}
export async function lockOperatorSession(user: Actor, sid: string | undefined, companyId?: number): Promise<void> {
  const id = requireId(user);
  const db = await database();
  await db.transaction(async tx => {
    const context = await lockedContext(tx, id, sid, companyId);
    if (!context.session || context.state === "LOGIN_REQUIRED") denyState("LOGIN_REQUIRED");
    if (!context.session.lockedAt) {
      await tx.update(operatorSessions).set({ lockedAt: securityTimestamp(context.now) }).where(and(eq(operatorSessions.id, context.session.id), eq(operatorSessions.userId, id), isNull(operatorSessions.revokedAt)));
      await audit(tx, id, context.session.id, companyId, "manual_lock", "Sessão bloqueada pelo usuário.", context.now);
    }
  });
}
export async function touchOperatorSession(user: Actor, sid: string | undefined, companyId?: number): Promise<{ success: true; status: OperatorSessionStatus }> {
  const id = requireId(user);
  const db = await database();
  const result = await db.transaction(async tx => {
    const context = await lockedContext(tx, id, sid, companyId);
    await persistIdleLock(tx, context, companyId);
    if (context.state === "ACTIVE" && context.session) {
      const lastActivityAt = securityTimestamp(context.now);
      await tx.update(operatorSessions).set({ lastActivityAt }).where(and(eq(operatorSessions.id, context.session.id), eq(operatorSessions.userId, id), isNull(operatorSessions.lockedAt), isNull(operatorSessions.revokedAt)));
      context.session.lastActivityAt = lastActivityAt;
      return { state: context.state, status: activeContextStatus(context) };
    }
    return { state: context.state, status: null };
  });
  if (result.state !== "ACTIVE" || !result.status) denyState(result.state);
  return { success: true, status: result.status };
}
export async function verifyOperatorPin(user: Actor, sid: string | undefined, pin: string, companyId?: number): Promise<{ success: boolean; retryAfterSeconds: number }> {
  const id = requireId(user);
  const db = await database();
  return db.transaction(async tx => {
    const context = await lockedContext(tx, id, sid, companyId);
    if (!context.session || context.state === "LOGIN_REQUIRED") denyState("LOGIN_REQUIRED");
    if (!context.pin) denyState("PIN_SETUP_REQUIRED");
    if (context.state !== "LOCKED" && context.state !== "PIN_CONFIRM_REQUIRED") denyState(context.state);
    await persistIdleLock(tx, context, companyId);
    const blockedUntil = context.pin.blockedUntil?.getTime() ?? 0;
    if (blockedUntil > context.now) return { success: false, retryAfterSeconds: Math.ceil((blockedUntil - context.now) / 1000) };
    const matches = await checkPin(pin, context.pin.pinHash);
    const now = Date.now();
    // Revalidar após scrypt: não permitir sucesso cruzando as 04h ou expiresAt.
    if (evaluateStatus({ user: context.user, session: context.session, hasPin: true, now, idleMinutes: context.idleMinutes }) === "LOGIN_REQUIRED") denyState("LOGIN_REQUIRED");
    if (!matches) {
      const attempts = (blockedUntil && blockedUntil <= now ? 0 : context.pin.failedAttempts) + 1;
      const blocked = attempts >= MAX_PIN_ATTEMPTS;
      await tx.update(operatorPins).set({ failedAttempts: attempts, blockedUntil: blocked ? securityTimestamp(now + PIN_BLOCK_MS) : null, updatedAt: securityTimestamp(now) }).where(eq(operatorPins.userId, id));
      await audit(tx, id, context.session.id, companyId, blocked ? "pin_blocked" : "pin_failed", blocked ? "Limite de tentativas de PIN atingido; bloqueio temporário." : "Falha na confirmação do PIN.", now);
      // Retornar (não lançar): os contadores e a auditoria precisam de commit.
      return { success: false, retryAfterSeconds: blocked ? PIN_BLOCK_MS / 1000 : 0 };
    }
    await tx.update(operatorPins).set({ failedAttempts: 0, blockedUntil: null, updatedAt: securityTimestamp(now) }).where(eq(operatorPins.userId, id));
    await tx.update(operatorSessions).set({ confirmedAt: securityTimestamp(now), lastActivityAt: securityTimestamp(now), lockedAt: null }).where(and(eq(operatorSessions.id, context.session.id), eq(operatorSessions.userId, id), isNull(operatorSessions.revokedAt)));
    await audit(tx, id, context.session.id, companyId, "pin_unlock", "PIN confirmado; sessão desbloqueada.", now);
    return { success: true, retryAfterSeconds: 0 };
  });
}
export async function setupOperatorPin(user: Actor, sid: string | undefined, pin: string, companyId?: number): Promise<void> {
  const id = requireId(user);
  // Derivação fora da transação; a janela é validada novamente depois dos locks.
  const pinHash = await hashPin(pin);
  const db = await database();
  await db.transaction(async tx => {
    const context = await lockedContext(tx, id, sid, companyId);
    if (context.user.loginMethod === "manual") throw new TRPCError({ code: "FORBIDDEN", message: "Faça login autenticado antes de cadastrar seu PIN." });
    if (!context.session || context.state === "LOGIN_REQUIRED" || context.now - context.session.authenticatedAt.getTime() >= ENROLLMENT_MS) denyState("LOGIN_REQUIRED");
    if (context.pin) throw new TRPCError({ code: "CONFLICT", message: "O PIN já está cadastrado. Alteração ou recuperação exige fluxo específico." });
    await tx.insert(operatorPins).values({ userId: id, pinHash, failedAttempts: 0, blockedUntil: null, updatedAt: securityTimestamp(context.now) });
    await tx.update(operatorSessions).set({ confirmedAt: securityTimestamp(context.now), lastActivityAt: securityTimestamp(context.now), lockedAt: null }).where(and(eq(operatorSessions.id, context.session.id), eq(operatorSessions.userId, id), isNull(operatorSessions.revokedAt)));
    await audit(tx, id, context.session.id, companyId, "pin_setup", "PIN de segurança cadastrado.", context.now);
  });
}
export async function revokeOperatorSession(userId: string, sid: string): Promise<void> {
  const db = await database();
  await db.transaction(async tx => {
    // Revogar também deve funcionar para usuário bloqueado.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    let [session] = await tx.select().from(operatorSessions).where(and(eq(operatorSessions.id, sid), eq(operatorSessions.userId, userId))).limit(1).for("update");
    if (!session && /^[a-f0-9]{64}$/.test(sid)) {
      const owned = await tx.select().from(operatorSessions).where(eq(operatorSessions.userId, userId)).for("update");
      session = owned.find(row => publicSessionId(row.id) === sid)!;
    }
    if (session && !session.revokedAt) {
      const now = Date.now();
      await tx.update(operatorSessions).set({ revokedAt: securityTimestamp(now) }).where(and(eq(operatorSessions.id, session.id), eq(operatorSessions.userId, userId), isNull(operatorSessions.revokedAt)));
      await audit(tx, userId, session.id, undefined, "session_revoked", "Sessão revogada.", now);
    }
  });
}
export async function revokeSessionsForUser(userId: string): Promise<void> {
  const db = await database();
  await db.transaction(async tx => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    const sessions = await tx.select({ id: operatorSessions.id }).from(operatorSessions).where(and(eq(operatorSessions.userId, userId), isNull(operatorSessions.revokedAt))).for("update");
    if (!sessions.length) return;
    const now = Date.now();
    await tx.update(operatorSessions).set({ revokedAt: securityTimestamp(now) }).where(and(eq(operatorSessions.userId, userId), isNull(operatorSessions.revokedAt)));
    for (const session of sessions) await audit(tx, userId, session.id, undefined, "session_revoked", "Sessão revogada por revogação global do usuário.", now);
  });
}
export async function getSecurityPolicy(user: Actor, companyId: number): Promise<{ idleMinutes: number; dailyLoginHour: 4; timeZone: string }> {
  const db = await database();
  const latest = await currentUser(db, requireId(user));
  const context = await policyContext(db, latest, companyId);
  return { idleMinutes: context.idleMinutes, dailyLoginHour: DAILY_LOGIN_HOUR, timeZone: SECURITY_TIME_ZONE };
}
export async function setSecurityPolicy(user: Actor, companyId: number, idleMinutes: number): Promise<void> {
  const id = requireId(user);
  if (!ALLOWED_IDLE_MINUTES.includes(idleMinutes as typeof ALLOWED_IDLE_MINUTES[number])) throw new TRPCError({ code: "BAD_REQUEST", message: "Tempo de inatividade inválido. Escolha 1, 3, 5, 10, 15 ou 30 minutos." });
  const db = await database();
  await db.transaction(async tx => {
    const latest = await currentUser(tx, id, true);
    if (latest.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem alterar a política de segurança." });
    const context = await policyContext(tx, latest, companyId);
    if (!context.companyAdmin) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores vinculados como admin à empresa podem alterar sua política de segurança." });
    const now = Date.now();
    await tx.insert(securityPolicies).values({ companyId, idleMinutes, updatedBy: id, updatedAt: securityTimestamp(now) }).onDuplicateKeyUpdate({ set: { idleMinutes, updatedBy: id, updatedAt: securityTimestamp(now) } });
    await audit(tx, id, null, companyId, "policy_changed", "Política de inatividade atualizada.", now);
  });
}
// O id de sessão é uma credencial. Nas listagens públicas, usar fingerprint
// estável NÃO aceito por load/verify/touch em vez de vazar o cookie sid.
// Somente revogação aceita esse id público, sempre limitada ao userId autorizado.
function publicSessionId(id: string): string { return createHash("sha256").update(`operator-session:${id}`).digest("hex"); }
export async function listOperatorSessions(userId: string, currentSid?: string) {
  const db = await database();
  const sessions = await db.select({ id: operatorSessions.id, userAgent: operatorSessions.userAgent, authenticatedAt: operatorSessions.authenticatedAt, expiresAt: operatorSessions.expiresAt, revokedAt: operatorSessions.revokedAt, lockedAt: operatorSessions.lockedAt }).from(operatorSessions).where(eq(operatorSessions.userId, userId)).orderBy(desc(operatorSessions.authenticatedAt)).limit(100);
  const currentRef = currentSid ? publicSessionId(currentSid) : null;
  return sessions.map(row => { const id = publicSessionId(row.id); return { ...row, id, current: id === currentRef }; });
}
export async function listSecurityEvents(userId: string) {
  const db = await database();
  const events = await db.select({ id: securityEvents.id, userId: securityEvents.userId, sessionId: securityEvents.sessionId, companyId: securityEvents.companyId, event: securityEvents.event, details: securityEvents.details, createdAt: securityEvents.createdAt }).from(securityEvents).where(eq(securityEvents.userId, userId)).orderBy(desc(securityEvents.createdAt), desc(securityEvents.id)).limit(100);
  return events.map(row => ({ ...row, sessionId: row.sessionId ? publicSessionId(row.sessionId) : null }));
}
