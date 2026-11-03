import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getTableName, type SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { nextDailyLoginCutoff } from "../shared/sessionSecurity";
import {
  assertOperatorActive, checkPin, createOperatorSession, evaluateStatus,
  getSecurityPolicy, hashPin, isValidOperatorPin, listOperatorSessions,
  listSecurityEvents, loadOperatorSession, lockOperatorSession, resolveOperatorStatus,
  revokeOperatorSession, revokeSessionsForUser, setSecurityPolicy, setupOperatorPin,
  touchOperatorSession, verifyOperatorPin,
} from "./operatorSecurity";

const connection = vi.hoisted(() => ({ db: null as any }));
vi.mock("./db", () => ({ getDb: vi.fn(async () => connection.db) }));

// O mock avalia o SQL produzido pelo próprio Drizzle (eq/and/inArray/isNull),
// aplica WHERE de verdade e serializa transações. Rollback restaura os dados.
// Não é um teste de integração MySQL: locks explícitos são também inspecionados.
class MemoryDb {
  data: Record<string, any[]> = { users: [], companies: [], userCompanies: [], operatorSessions: [], operatorPins: [], securityPolicies: [], securityEvents: [] };
  locks: string[] = [];
  writes: { table: string; values: any }[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private dialect = new MySqlDialect();
  matches(condition: SQL | undefined, row: any) {
    if (!condition) return true;
    const { sql, params } = this.dialect.sqlToQuery(condition);
    let index = 0;
    return sql.replace(/[()]/g, "").split(/\s+and\s+/i).map(part => {
      const column = part.match(/`[^`]+`\.`([^`]+)`/)?.[1];
      if (!column) throw new Error(`SQL não suportado no mock: ${part}`);
      if (/is null/i.test(part)) return row[column] == null;
      if (/\s+in\s+/i.test(part)) {
        const count = (part.match(/\?/g) ?? []).length;
        const options = params.slice(index, index += count);
        return options.includes(row[column]);
      }
      if (/=\s*\?/.test(part)) return row[column] === params[index++];
      throw new Error(`SQL não suportado no mock: ${part}`);
    }).every(Boolean);
  }
  select(selection?: Record<string, any>) {
    const db = this;
    let table = "", condition: SQL | undefined, limit = Infinity;
    const query: any = {
      from(value: any) { table = getTableName(value); return query; },
      where(value: SQL) { condition = value; return query; },
      limit(value: number) { limit = value; return query; },
      orderBy() { return query; },
      for(mode: string) { expect(mode).toBe("update"); db.locks.push(table); return query; },
      then(resolve: any, reject: any) {
        try {
          const rows = db.data[table].filter(row => db.matches(condition, row)).slice(0, limit).map(row => selection ? Object.fromEntries(Object.entries(selection).map(([key, column]) => [key, row[column.name]])) : { ...row });
          return Promise.resolve(rows).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    };
    return query;
  }
  update(value: any) {
    const db = this, table = getTableName(value);
    return { set(values: any) { return { async where(condition: SQL) {
      db.writes.push({ table, values: { ...values } });
      for (const row of db.data[table]) if (db.matches(condition, row)) Object.assign(row, values);
    } }; } };
  }
  insert(value: any) {
    const db = this, table = getTableName(value);
    return { values(values: any) {
      const apply = (update?: any) => {
        db.writes.push({ table, values: { ...values } });
        const key = table === "operatorPins" ? "userId" : table === "securityPolicies" ? "companyId" : "id";
        const existing = values[key] === undefined ? undefined : db.data[table].find(row => row[key] === values[key]);
        if (existing) {
          if (!update) throw new Error("Duplicate primary key");
          Object.assign(existing, update.set);
        } else db.data[table].push({ ...(table === "securityEvents" ? { id: db.data[table].length + 1 } : {}), ...values });
      };
      return {
        then(resolve: any, reject: any) { return Promise.resolve().then(() => apply()).then(resolve, reject); },
        async onDuplicateKeyUpdate(update: any) { apply(update); },
      };
    } };
  }
  transaction<T>(callback: (db: any) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const snapshot = structuredClone(this.data);
      try { return await callback(this); }
      catch (error) { this.data = snapshot; throw error; }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}

const NOW = Date.parse("2026-11-03T12:00:00Z");
const actor = { id: "operator-a" };
const PIN = "582947";
let db: MemoryDb;
let storedHash: string;
function session(id = "sid-a", overrides: Record<string, any> = {}) {
  const row = { id, userId: actor.id, userAgent: "Teste", authenticatedAt: new Date(NOW - 60_000), expiresAt: new Date(nextDailyLoginCutoff(NOW)), lastActivityAt: new Date(NOW - 60_000), confirmedAt: new Date(NOW - 60_000), lockedAt: null, revokedAt: null, ...overrides };
  db.data.operatorSessions.push(row);
  return row;
}
function withPin() { db.data.operatorPins.push({ userId: actor.id, pinHash: storedHash, failedAttempts: 0, blockedUntil: null, updatedAt: new Date(NOW) }); }
function addCompany(id: number, idleMinutes?: number, member = true, active = true) {
  db.data.companies.push({ id, name: `Empresa ${id}`, logoUrl: null, active });
  if (member) db.data.userCompanies.push({ userId: actor.id, companyId: id, role: "operacional" });
  if (idleMinutes !== undefined) db.data.securityPolicies.push({ companyId: id, idleMinutes });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  db = new MemoryDb();
  connection.db = db;
  db.data.users.push({ ...actor, name: "Operador", avatarUrl: null, role: "operacional", blocked: false, loginMethod: "google", lastSignedIn: new Date(NOW) });
  storedHash ??= await hashPin(PIN);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("PIN criptográfico", () => {
  it("valida tamanho, repetição, sequência e padrões cíclicos", () => {
    for (const bad of ["000000", "111111", "123456", "654321", "789012", "098765", "121212", "123123", "12345", "1234567", "abcdef", "582947\n"]) expect(isValidOperatorPin(bad)).toBe(false);
    expect(isValidOperatorPin(PIN)).toBe(true);
  });
  it("usa sal aleatório de 16 bytes e hash seguro sem armazenar PIN", async () => {
    const other = await hashPin(PIN);
    expect(other).toMatch(/^[a-f0-9]{32}:[a-f0-9]{64}$/);
    expect(other).not.toBe(storedHash);
    expect(await checkPin(PIN, other)).toBe(true);
    expect(await checkPin("582948", other)).toBe(false);
    expect(await checkPin(PIN, "corrompido")).toBe(false);
    expect(await checkPin("abc", other)).toBe(false);
    await expect(hashPin("123456")).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("sessões e relógio do servidor", () => {
  it("cria sid UUID gerenciado, prazo fixo 04h e nenhuma confirmação implícita", async () => {
    const sid = await createOperatorSession(actor.id, "a".repeat(400));
    expect(sid).toMatch(/^[0-9a-f-]{36}$/);
    const row = await loadOperatorSession(sid, actor.id);
    expect(row?.expiresAt.getTime()).toBe(nextDailyLoginCutoff(NOW));
    expect(row?.confirmedAt).toBeNull();
    expect(row?.userAgent.length).toBe(255);
    expect(await loadOperatorSession(sid, "outro-usuario")).toBeNull();
    expect(db.data.securityEvents[0].event).toBe("login");
  });
  it("falha fechado sem sid mesmo com lastSignedIn recente", async () => {
    withPin(); session();
    expect((await resolveOperatorStatus(null, undefined)).state).toBe("SIGNED_OUT");
    expect((await resolveOperatorStatus(actor, undefined)).state).toBe("LOGIN_REQUIRED");
    await expect(assertOperatorActive(actor, undefined)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("distingue cadastro recente, cadastro tardio, confirmação e revogação", async () => {
    const row = session("sid-a", { confirmedAt: null });
    expect((await resolveOperatorStatus(actor, row.id)).state).toBe("PIN_SETUP_REQUIRED");
    row.authenticatedAt = new Date(NOW - 5 * 60_000);
    expect((await resolveOperatorStatus(actor, row.id)).state).toBe("LOGIN_REQUIRED");
    withPin();
    expect((await resolveOperatorStatus(actor, row.id)).state).toBe("PIN_CONFIRM_REQUIRED");
    row.revokedAt = new Date(NOW);
    expect((await resolveOperatorStatus(actor, row.id)).state).toBe("LOGIN_REQUIRED");
  });
  it("heartbeat no limite de inatividade não revive e persiste bloqueio/auditoria", async () => {
    withPin(); const row = session("sid-a", { lastActivityAt: new Date(NOW - 5 * 60_000) });
    const previous = row.lastActivityAt.getTime();
    await expect(touchOperatorSession(actor, row.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(row.lastActivityAt.getTime()).toBe(previous);
    expect(row.lockedAt?.getTime()).toBe(NOW);
    expect(db.data.securityEvents.filter(event => event.event === "idle_lock")).toHaveLength(1);
    await expect(assertOperatorActive(actor, row.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.data.securityEvents.filter(event => event.event === "idle_lock")).toHaveLength(1);
  });
  it("polling de status não toca atividade; touch só altera lastActivityAt", async () => {
    withPin(); const row = session();
    const original = { authenticatedAt: row.authenticatedAt.getTime(), expiresAt: row.expiresAt.getTime() };
    expect((await resolveOperatorStatus(actor, row.id)).state).toBe("ACTIVE");
    expect(row.lastActivityAt.getTime()).toBe(NOW - 60_000);
    expect(await touchOperatorSession(actor, row.id)).toEqual({ success: true });
    expect(row.lastActivityAt.getTime()).toBe(NOW);
    expect(row.authenticatedAt.getTime()).toBe(original.authenticatedAt);
    expect(row.expiresAt.getTime()).toBe(original.expiresAt);
    expect(db.locks).toContain("operatorSessions");
    expect(db.locks).toContain("operatorPins");
  });
  it("tempo na fila do lock conta como inatividade e não revive heartbeat", async () => {
    withPin(); session("sid-a", { lastActivityAt: new Date(NOW - 4 * 60_000) });
    let release!: () => void;
    let started!: () => void;
    const start = new Promise<void>(resolve => { started = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const blocker = db.transaction(async () => { started(); await gate; });
    await start;
    const touch = touchOperatorSession(actor, "sid-a");
    vi.setSystemTime(NOW + 60_000);
    release();
    await blocker;
    await expect(touch).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.data.operatorSessions[0].lastActivityAt.getTime()).toBe(NOW - 4 * 60_000);
    expect(db.data.operatorSessions[0].lockedAt.getTime()).toBe(NOW + 60_000);
  });
  it("recarrega bloqueio do usuário a cada assertion", async () => {
    withPin(); const row = session();
    await assertOperatorActive(actor, row.id);
    db.data.users[0].blocked = true;
    await expect(assertOperatorActive(actor, row.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("corte diário domina expiresAt adulterado e ignora fuso do servidor", () => {
    const before = Date.parse("2026-11-03T06:59:59Z");
    const at = Date.parse("2026-11-03T07:00:00Z");
    expect(nextDailyLoginCutoff(before)).toBe(at);
    expect(nextDailyLoginCutoff(at)).toBe(Date.parse("2026-11-04T07:00:00Z"));
    const row = session("sid-a", { authenticatedAt: new Date(before), expiresAt: new Date(at + 86_400_000), lastActivityAt: new Date(before) });
    expect(evaluateStatus({ user: actor, session: row, hasPin: true, now: at, idleMinutes: 5 })).toBe("LOGIN_REQUIRED");
  });
  it("bloqueio manual e heartbeat concorrentes não destravam", async () => {
    withPin(); const row = session();
    const result = await Promise.allSettled([lockOperatorSession(actor, row.id), touchOperatorSession(actor, row.id)]);
    expect(result[0].status).toBe("fulfilled");
    expect(result[1].status).toBe("rejected");
    expect((await resolveOperatorStatus(actor, row.id)).state).toBe("LOCKED");
  });
});

describe("cadastro e confirmação transacionais", () => {
  it("cadastro exige sid, login não manual, sessão recente e ausência de PIN", async () => {
    await expect(setupOperatorPin(actor, undefined, PIN)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    session("old", { authenticatedAt: new Date(NOW - 5 * 60_000), confirmedAt: null });
    await expect(setupOperatorPin(actor, "old", PIN)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    session("fresh", { confirmedAt: null });
    db.data.users[0].loginMethod = "manual";
    await expect(setupOperatorPin(actor, "fresh", PIN)).rejects.toMatchObject({ code: "FORBIDDEN" });
    db.data.users[0].loginMethod = "google";
    await setupOperatorPin(actor, "fresh", PIN);
    expect((await resolveOperatorStatus(actor, "fresh")).state).toBe("ACTIVE");
    expect(await checkPin(PIN, db.data.operatorPins[0].pinHash)).toBe(true);
    await expect(setupOperatorPin(actor, "fresh", PIN)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("dois cadastros concorrentes não sobrescrevem PIN nem confirmam ambos", async () => {
    const a = session("first", { confirmedAt: null }), b = session("second", { confirmedAt: null });
    const results = await Promise.allSettled([setupOperatorPin(actor, a.id, PIN), setupOperatorPin(actor, b.id, "384951")]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(db.data.operatorPins).toHaveLength(1);
    expect(db.data.operatorSessions.filter(row => row.confirmedAt)).toHaveLength(1);
    expect(db.locks).toContain("users");
    expect(db.locks).toContain("operatorPins");
  });
  it("tentativas concorrentes em sessões diferentes contam globalmente e commitam falhas", async () => {
    withPin(); session("a", { lockedAt: new Date(NOW) }); session("b", { confirmedAt: null });
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => verifyOperatorPin(actor, i % 2 ? "a" : "b", "582948")));
    expect(results.every(result => !result.success)).toBe(true);
    expect(results.filter(result => result.retryAfterSeconds === 900)).toHaveLength(2);
    expect(db.data.operatorPins[0].failedAttempts).toBe(5);
    expect(db.data.operatorPins[0].blockedUntil.getTime()).toBe(NOW + 15 * 60_000);
    expect(db.data.securityEvents.filter(event => event.event === "pin_failed")).toHaveLength(4);
    expect(db.data.securityEvents.filter(event => event.event === "pin_blocked")).toHaveLength(1);
    expect(await verifyOperatorPin(actor, "a", PIN)).toEqual({ success: false, retryAfterSeconds: 900 });
    expect(db.data.operatorPins[0].failedAttempts).toBe(5);
  });
  it("PIN direto após timeout registra idle_lock e unlock sem polling prévio", async () => {
    withPin(); const row = session("a", { lastActivityAt: new Date(NOW - 5 * 60_000) });
    expect(await verifyOperatorPin(actor, row.id, PIN)).toEqual({ success: true, retryAfterSeconds: 0 });
    expect(db.data.securityEvents.map(event => event.event)).toEqual(["idle_lock", "pin_unlock"]);
    expect((await resolveOperatorStatus(actor, row.id)).state).toBe("ACTIVE");
  });
  it("após bloqueio, sucesso limpa tentativas e lock sem estender autenticação nem prazo", async () => {
    withPin(); const row = session("a", { lockedAt: new Date(NOW) });
    db.data.operatorPins[0].failedAttempts = 5;
    db.data.operatorPins[0].blockedUntil = new Date(NOW + 15 * 60_000);
    const auth = row.authenticatedAt.getTime(), expiry = row.expiresAt.getTime();
    vi.setSystemTime(NOW + 15 * 60_000);
    expect(await verifyOperatorPin(actor, row.id, PIN)).toEqual({ success: true, retryAfterSeconds: 0 });
    expect(row.lockedAt).toBeNull();
    expect(row.confirmedAt.getTime()).toBe(NOW + 15 * 60_000);
    expect(row.lastActivityAt.getTime()).toBe(NOW + 15 * 60_000);
    expect(row.authenticatedAt.getTime()).toBe(auth);
    expect(row.expiresAt.getTime()).toBe(expiry);
    expect(db.data.operatorPins[0].failedAttempts).toBe(0);
    expect(db.data.operatorPins[0].blockedUntil).toBeNull();
  });
  it("PIN correto não salva sessão expirada durante a derivação scrypt", async () => {
    withPin(); const row = session("a", { lockedAt: new Date(NOW), expiresAt: new Date(NOW + 10) });
    vi.spyOn(Date, "now").mockReturnValueOnce(NOW).mockReturnValue(NOW + 10);
    await expect(verifyOperatorPin(actor, row.id, PIN)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(db.data.operatorSessions[0].lockedAt).not.toBeNull();
    expect(db.data.securityEvents).toHaveLength(0);
  });
  it("revogação vence confirmação posterior e revogação global impede todos os sids", async () => {
    withPin(); session("a", { lockedAt: new Date(NOW) }); session("b");
    const results = await Promise.allSettled([revokeOperatorSession(actor.id, "a"), verifyOperatorPin(actor, "a", PIN)]);
    expect(results[1].status).toBe("rejected");
    await revokeSessionsForUser(actor.id);
    expect(db.data.operatorSessions.every(row => row.revokedAt)).toBe(true);
    await expect(touchOperatorSession(actor, "b")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("recusa confirmação em sessão já ativa sem resetar contadores", async () => {
    withPin(); session(); db.data.operatorPins[0].failedAttempts = 3;
    await expect(verifyOperatorPin(actor, "sid-a", PIN)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.data.operatorPins[0].failedAttempts).toBe(3);
  });
});

describe("isolamento multiempresa e listagens seguras", () => {
  it("sem empresa selecionada usa menor política permitida, incluindo default ausente", async () => {
    withPin(); session(); addCompany(1, 30); addCompany(2, 3); addCompany(3, 1, false);
    expect((await resolveOperatorStatus(actor, "sid-a")).idleMinutes).toBe(3);
    expect((await resolveOperatorStatus(actor, "sid-a", 1)).idleMinutes).toBe(30);
    db.data.securityPolicies = db.data.securityPolicies.filter(row => row.companyId !== 2);
    expect((await resolveOperatorStatus(actor, "sid-a")).idleMinutes).toBe(5);
  });
  it("header de empresa sem vínculo ou inativa não dá rótulos nem tolerância", async () => {
    withPin(); session(); addCompany(1, 30, false); addCompany(2, 30, true, false);
    await expect(resolveOperatorStatus(actor, "sid-a", 1)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(resolveOperatorStatus(actor, "sid-a", 2)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(resolveOperatorStatus(actor, "sid-a", -1)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    db.data.users[0].role = "admin";
    await expect(resolveOperatorStatus(actor, "sid-a", 1)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("gestão é restrita a administrador e empresa ativa válida", async () => {
    addCompany(1, 5, false); addCompany(2, 5, false, false);
    db.data.userCompanies.push({ userId: actor.id, companyId: 2, role: "admin" });
    await expect(setSecurityPolicy(actor, 1, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
    db.data.users[0].role = "admin";
    await expect(setSecurityPolicy(actor, 1, 6)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(setSecurityPolicy(actor, 2, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setSecurityPolicy(actor, 999, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setSecurityPolicy(actor, 1, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getSecurityPolicy(actor, 1)).rejects.toMatchObject({ code: "FORBIDDEN" });
    db.data.userCompanies.push({ userId: actor.id, companyId: 1, role: "operacional" });
    expect((await getSecurityPolicy(actor, 1)).idleMinutes).toBe(5);
    await expect(setSecurityPolicy(actor, 1, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
    db.data.userCompanies.find(row => row.companyId === 1).role = "admin";
    db.data.users[0].role = "operacional";
    await expect(setSecurityPolicy(actor, 1, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
    db.data.users[0].role = "admin";
    await setSecurityPolicy(actor, 1, 10);
    expect(await getSecurityPolicy(actor, 1)).toEqual({ idleMinutes: 10, dailyLoginHour: 4, timeZone: "America/Sao_Paulo" });
    expect(db.data.securityEvents.at(-1).event).toBe("policy_changed");
  });
  it("lista apenas o usuário requerido, com fingerprint não reutilizável como token", async () => {
    withPin(); const row = session(); session("other", { userId: "outro" });
    await lockOperatorSession(actor, row.id);
    const listed = await listOperatorSessions(actor.id, row.id);
    const events = await listSecurityEvents(actor.id);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toMatch(/^[a-f0-9]{64}$/);
    expect(listed[0].id).not.toBe(row.id);
    expect(listed[0].current).toBe(true);
    expect((await listOperatorSessions(actor.id))[0].current).toBe(false);
    expect((await listOperatorSessions(actor.id, "other"))[0].current).toBe(false);
    expect((await resolveOperatorStatus(actor, row.id)).sessionRef).toBe(listed[0].id);
    expect((await resolveOperatorStatus(actor, undefined)).sessionRef).toBeNull();
    expect((await resolveOperatorStatus(null, undefined)).sessionRef).toBeNull();
    expect(events[0].sessionId).toBe(listed[0].id);
    expect(await loadOperatorSession(listed[0].id, actor.id)).toBeNull();
    expect(JSON.stringify({ listed, events })).not.toContain(storedHash);
    expect(JSON.stringify({ listed, events })).not.toContain(PIN);
    expect(JSON.stringify(events)).not.toContain(row.id);
    await revokeOperatorSession("outro", listed[0].id);
    expect(row.revokedAt).toBeNull();
    await revokeOperatorSession(actor.id, listed[0].id);
    expect(row.revokedAt).not.toBeNull();
  });
  it("banco indisponível nunca autoriza", async () => {
    connection.db = null;
    await expect(assertOperatorActive(actor, "sid-a")).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
