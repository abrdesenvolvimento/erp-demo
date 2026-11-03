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

let server: Server | undefined;
afterEach(async () => { if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; } });
beforeEach(() => {
  vi.resetAllMocks();
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
  it("recusa callback sem prova do navegador antes de consultar o provedor", async () => {
    const base = await oauthServer();
    const response = await fetch(`${base}/api/oauth/callback?code=test&state=${encodeURIComponent(validState())}`);
    expect(response.status).toBe(403); expect(mocks.exchange).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("recusa estado plantado em outro navegador", async () => {
    const base = await oauthServer();
    const response = await fetch(`${base}/api/oauth/callback?code=test&state=${encodeURIComponent(validState())}`, { headers: { cookie: `${OAUTH_BROWSER_NONCE_COOKIE}=87654321-4321-4321-9321-210987654321` } });
    expect(response.status).toBe(403); expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("cria sessão gerenciada, consome nonce e limpa a empresa anterior", async () => {
    const base = await oauthServer();
    const response = await fetch(`${base}/api/oauth/callback?code=test&state=${encodeURIComponent(validState())}`, { headers: { cookie: `${OAUTH_BROWSER_NONCE_COOKIE}=${nonce}` } });
    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toContain(`${OAUTH_BROWSER_NONCE_COOKIE}=;`);
    expect(cookies).toContain("HttpOnly"); expect(cookies).toContain("activeCompanyId=;"); expect(cookies).toContain("activeBranchId=;");
    expect(mocks.sign).toHaveBeenCalledWith("operador-A", expect.objectContaining({ operatorSessionId: "sid-assinado-teste" }));
    expect(response.headers.get("cache-control")).toBe("no-store");
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
