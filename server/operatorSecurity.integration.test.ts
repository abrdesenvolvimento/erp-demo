import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { once } from "node:events";
import type { Server } from "node:http";
import { TRPCError } from "@trpc/server";
import { encodeBrowserOAuthState, isBrowserOAuthStateValid, OAUTH_BROWSER_NONCE_COOKIE } from "../shared/oauthState";

const mocks = vi.hoisted(() => ({ assert: vi.fn(), terminal: vi.fn(), create: vi.fn(), revoke: vi.fn(), exchange: vi.fn(), info: vi.fn(), sign: vi.fn(), verify: vi.fn(), upsert: vi.fn(), getUser: vi.fn() }));
vi.mock("./operatorSecurity", () => ({ assertOperatorActive: mocks.assert, createOperatorSession: mocks.create, revokeOperatorSession: mocks.revoke }));
vi.mock("./productionTerminalSecurity", async () => {
  const actual = await vi.importActual<typeof import("./productionTerminalSecurity")>("./productionTerminalSecurity");
  return { ...actual, readProductionTerminal: mocks.terminal };
});
vi.mock("./db", () => ({ getDb: vi.fn(), upsertUser: mocks.upsert, getUser: mocks.getUser }));
vi.mock("./_core/sdk", () => ({ sdk: { exchangeCodeForToken: mocks.exchange, getUserInfo: mocks.info, createSessionToken: mocks.sign, verifySession: mocks.verify } }));
import { router, protectedProcedure, productionReadProcedure } from "./_core/trpc";
import { registerOAuthRoutes } from "./_core/oauth";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { renderOAuthRecoveryPage } from "./oauthRecovery";

let server: Server | undefined;
afterEach(async () => {
  try { if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; } }
  finally { vi.restoreAllMocks(); }
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.terminal.mockResolvedValue(null);
  mocks.verify.mockResolvedValue(null);
  mocks.upsert.mockResolvedValue(undefined);
  mocks.getUser.mockResolvedValue({ id: "operador-A", name: "Operador A", blocked: false });
  mocks.exchange.mockResolvedValue({ accessToken: "token-provedor-teste" });
  mocks.info.mockResolvedValue({ openId: "operador-A", name: "Operador A", loginMethod: "google" });
  mocks.create.mockResolvedValue("sid-assinado-teste");
  mocks.sign.mockResolvedValue("identity-test-token");
});

function context(userId = "operador-A", sid: string | undefined = "sessao-A") {
  return { user: { id: userId, role: "admin", name: "Operador A" } as any, operatorSessionId: sid, activeCompanyId: 1, activeBranchId: 1, req: { headers: {} } as any, res: {} as any };
}

describe("gate de API", () => {
  const secureRouter = router({ mutateBusiness: protectedProcedure.mutation(() => "gravado") });
  it("não deixa uma sessão bloqueada executar uma alteração", async () => {
    mocks.assert.mockRejectedValue(new TRPCError({ code: "FORBIDDEN", message: "Sessão bloqueada" }));
    await expect(secureRouter.createCaller(context()).mutateBusiness()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.assert).toHaveBeenCalledWith(expect.objectContaining({ id: "operador-A" }), "sessao-A", 1);
  });
  it("recusa o login antigo sem sessão individual", async () => {
    mocks.assert.mockImplementation(async (_user, sid) => { if (!sid) throw new TRPCError({ code: "UNAUTHORIZED" }); });
    const ctx = context(); ctx.operatorSessionId = undefined;
    await expect(secureRouter.createCaller(ctx).mutateBusiness()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("permite a operação somente após autorização no servidor", async () => {
    mocks.assert.mockResolvedValue(undefined);
    expect(await secureRouter.createCaller(context()).mutateBusiness()).toBe("gravado");
    expect(mocks.assert).toHaveBeenCalledTimes(1);
  });
  it("credencial de terminal só libera leitura KDS de sua empresa", async () => {
    const kds = router({ salon: router({ getKDSItems: productionReadProcedure.input(z.object({ companyId: z.number() })).query(() => ["produção"]) }) });
    mocks.terminal.mockResolvedValue({ id: "terminal", companyId: 2 });
    mocks.assert.mockRejectedValue(new TRPCError({ code: "UNAUTHORIZED" }));
    expect(await kds.createCaller(context()).salon.getKDSItems({ companyId: 2 })).toEqual(["produção"]);
    expect(mocks.assert).not.toHaveBeenCalled();
    await expect(kds.createCaller(context()).salon.getKDSItems({ companyId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

async function oauthServer() {
  const app = express(); registerOAuthRoutes(app); server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  return `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
}
const nonce = "12345678-1234-4234-9234-123456789012";
const validState = () => encodeBrowserOAuthState({ redirectUri: "https://abrwf.manus.space/api/oauth/callback", nonce });

describe("login OAuth vinculado ao navegador", () => {
  it("estado malformado nunca lança e não aceita URL de retorno externa fora do callback", () => {
    expect(isBrowserOAuthStateValid("não-e-base64", nonce)).toBe(false);
    expect(isBrowserOAuthStateValid(btoa(JSON.stringify({ redirectUri: "javascript:alert(1)", nonce })), nonce)).toBe(false);
    expect(isBrowserOAuthStateValid(validState(), nonce)).toBe(true);
  });
  it.each([
    { label: "sem nonce", code: "test", state: validState(), cookieNonce: undefined, reason: "missing-nonce" },
    { label: "nonce de outro navegador", code: "test", state: validState(), cookieNonce: "87654321-4321-4321-9321-210987654321", reason: "nonce-mismatch" },
    { label: "state malformado", code: "test", state: "<script>alert('state-private-marker')</script>", cookieNonce: nonce, reason: "malformed-state" },
    { label: "state ausente", code: "test", state: undefined, cookieNonce: nonce, reason: "malformed-state" },
    { label: "state legado sem nonce", code: "test", state: btoa("https://abrwf.manus.space/api/oauth/callback"), cookieNonce: nonce, reason: "malformed-state" },
    { label: "code ausente", code: undefined, state: validState(), cookieNonce: nonce, reason: "missing-code" },
    { label: "code vazio", code: "", state: validState(), cookieNonce: nonce, reason: "missing-code" },
    { label: "code ausente tem prioridade sobre state malformado", code: undefined, state: "bad-state", cookieNonce: undefined, reason: "missing-code" },
  ])("recusa $label sem consultar o provedor nem refletir parâmetros", async ({ code, state, cookieNonce, reason }) => {
    const base = await oauthServer();
    const params = new URLSearchParams({ returnTo: "https://attacker.invalid/<script>alert('return-private-marker')</script>" });
    const incomingCode = code ? "<script>alert('code-private-marker')</script>" : code;
    if (incomingCode !== undefined) params.set("code", incomingCode);
    if (state !== undefined) params.set("state", state);
    const cookie = [`unrelated=cookie-private-marker`, ...(cookieNonce ? [`${OAUTH_BROWSER_NONCE_COOKIE}=${cookieNonce}`] : [])].join("; ");
    const response = await fetch(`${base}/api/oauth/callback?${params}`, { headers: { cookie } });
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const body = await response.text();
    expect(body).toBe(renderOAuthRecoveryPage());
    expect(body).toContain('<a href="/">Voltar e tentar novamente</a>');
    for (const incoming of [incomingCode, state, cookieNonce, cookie, params.get("returnTo"), "private-marker", "attacker.invalid"].filter(Boolean)) {
      expect(body).not.toContain(incoming);
    }
    for (const action of [mocks.exchange, mocks.info, mocks.upsert, mocks.getUser, mocks.create, mocks.sign, mocks.verify, mocks.revoke]) expect(action).not.toHaveBeenCalled();
    expect(vi.mocked(console.warn).mock.calls).toEqual([["[OAuth] Login rejeitado:", reason]]);
    expect(console.error).not.toHaveBeenCalled();
    // Falha não deve apagar uma prova válida de outra tentativa em andamento.
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });
  it.each(["code", "state"])("recusa parâmetro %s duplicado em vez de escolher um valor", async key => {
    const base = await oauthServer();
    const params = new URLSearchParams({ code: "test", state: validState() });
    params.append(key, "extra-private-marker");
    const response = await fetch(`${base}/api/oauth/callback?${params}`, { headers: { cookie: `${OAUTH_BROWSER_NONCE_COOKIE}=${nonce}` } });
    expect(response.status).toBe(403);
    expect(await response.text()).toBe(renderOAuthRecoveryPage());
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(vi.mocked(console.warn).mock.calls).toEqual([["[OAuth] Login rejeitado:", key === "code" ? "missing-code" : "malformed-state"]]);
  });
  it("cria sessão gerenciada, consome nonce e limpa a empresa anterior", async () => {
    const base = await oauthServer();
    const state = validState();
    const response = await fetch(`${base}/api/oauth/callback?code=test&state=${encodeURIComponent(state)}`, { headers: { cookie: `${OAUTH_BROWSER_NONCE_COOKIE}=${nonce}`, "x-forwarded-proto": "https" } });
    expect(response.status).toBe(200);
    const setCookies = response.headers.getSetCookie();
    const cookies = setCookies.join("\n");
    const clearedNonce = setCookies.find(cookie => cookie.startsWith(`${OAUTH_BROWSER_NONCE_COOKIE}=`));
    expect(clearedNonce).toContain("Path=/");
    expect(clearedNonce).toContain("Secure");
    expect(clearedNonce).toContain("SameSite=None");
    expect(clearedNonce).not.toContain("Domain=");
    expect(clearedNonce).toContain("Expires=Thu, 01 Jan 1970");
    const identity = setCookies.find(cookie => cookie.startsWith(`${COOKIE_NAME}=`));
    expect(identity).toContain("HttpOnly");
    expect(identity).toContain("Secure");
    expect(identity).toContain("SameSite=Lax");
    expect(cookies).toContain(`${OAUTH_BROWSER_NONCE_COOKIE}=;`);
    expect(cookies).toContain("HttpOnly"); expect(cookies).toContain("activeCompanyId=;"); expect(cookies).toContain("activeBranchId=;");
    expect(mocks.exchange.mock.calls).toEqual([["test", state]]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.sign).toHaveBeenCalledWith("operador-A", expect.objectContaining({ operatorSessionId: "sid-assinado-teste", expiresInMs: 48 * 60 * 60 * 1000 }));
    expect(mocks.assert).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(await response.text()).toContain("Confirmando seu acesso individual...");
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
  it("revoga a sessão anterior antes de criar e assinar a nova identidade", async () => {
    mocks.verify.mockResolvedValue({ openId: "operador-anterior", operatorSessionId: "sessao-anterior" });
    const base = await oauthServer();
    const response = await fetch(`${base}/api/oauth/callback?code=test&state=${encodeURIComponent(validState())}`, { headers: { cookie: `${OAUTH_BROWSER_NONCE_COOKIE}=${nonce}; ${COOKIE_NAME}=old-identity-test` } });
    expect(response.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith("old-identity-test");
    expect(mocks.revoke.mock.calls).toEqual([["operador-anterior", "sessao-anterior"]]);
    expect(mocks.revoke.mock.invocationCallOrder[0]).toBeLessThan(mocks.create.mock.invocationCallOrder[0]);
    expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.sign.mock.invocationCallOrder[0]);
  });
  it("replay após a limpeza do nonce exige novo login sem nova troca de código", async () => {
    const base = await oauthServer();
    const callback = `${base}/api/oauth/callback?code=test&state=${encodeURIComponent(validState())}`;
    const first = await fetch(callback, { headers: { cookie: `${OAUTH_BROWSER_NONCE_COOKIE}=${nonce}` } });
    expect(first.status).toBe(200);
    expect(first.headers.getSetCookie().find(cookie => cookie.startsWith(`${OAUTH_BROWSER_NONCE_COOKIE}=`))).toContain(`${OAUTH_BROWSER_NONCE_COOKIE}=;`);
    const replay = await fetch(callback);
    expect(replay.status).toBe(403);
    expect(await replay.text()).toBe(renderOAuthRecoveryPage());
    expect(mocks.exchange).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls).toEqual([["[OAuth] Login rejeitado:", "missing-nonce"]]);
  });
  it("erro do SDK não expõe mensagem, URL ou segredos no log nem na resposta", async () => {
    mocks.exchange.mockRejectedValue(new Error("https://provider.invalid/callback?code=code-private-marker&state=state-private-marker cookie=cookie-private-marker"));
    const base = await oauthServer();
    const response = await fetch(`${base}/api/oauth/callback?code=test&state=${encodeURIComponent(validState())}`, { headers: { cookie: `${OAUTH_BROWSER_NONCE_COOKIE}=${nonce}` } });
    expect(response.status).toBe(500);
    expect(vi.mocked(console.error).mock.calls).toEqual([["[OAuth] Não foi possível concluir o login."]]);
    expect(await response.text()).not.toContain("private-marker");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("não deixa o provedor desbloquear um usuário bloqueado", async () => {
    mocks.getUser.mockResolvedValue({ id: "operador-A", blocked: true });
    const base = await oauthServer();
    const response = await fetch(`${base}/api/oauth/callback?code=test&state=${encodeURIComponent(validState())}`, { headers: { cookie: `${OAUTH_BROWSER_NONCE_COOKIE}=${nonce}` } });
    expect(response.status).toBe(403); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("endpoints antigos de depuração não expõem cookies", async () => {
    const base = await oauthServer();
    expect((await fetch(`${base}/api/oauth/debug`)).status).toBe(404);
    expect((await fetch(`${base}/api/oauth/test-cookies`)).status).toBe(404);
    expect((await fetch(`${base}/api/oauth/test-auth`)).status).toBe(404);
  });
});
