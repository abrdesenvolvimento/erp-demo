import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createLoginSingleFlight } from "../client/src/lib/loginSingleFlight";

const source = (path: string) => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

describe("coordenador único de login", () => {
  it("adquire a trava antes de executar o logout e une chamadas concorrentes", async () => {
    const flight = createLoginSingleFlight();
    let release!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const first = vi.fn(async () => { expect(flight.isPending()).toBe(true); await blocked; });
    const duplicate = vi.fn(async () => {});
    const a = flight.run(first);
    const b = flight.run(duplicate);
    expect(a).toBe(b);
    expect(flight.isPending()).toBe(true);
    await Promise.resolve();
    expect(first).toHaveBeenCalledTimes(1);
    expect(duplicate).not.toHaveBeenCalled();
    release();
    await a;
    expect(flight.isPending()).toBe(true);
    expect(flight.run(duplicate)).toBe(a);
    expect(duplicate).not.toHaveBeenCalled();
  });
  it("libera uma falha de preparação para permitir tentativa nova", async () => {
    const flight = createLoginSingleFlight();
    await expect(flight.run(async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(flight.isPending()).toBe(false);
    const retry = vi.fn(async () => {});
    await flight.run(retry);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("navegação OAuth preservada", () => {
  it("gera nonce só após logout e aquecimento, imediatamente antes da navegação", () => {
    const client = source("client/src/const.ts");
    const start = client.indexOf("export const warmUpAndLogin");
    const flow = client.slice(start);
    expect(flow).toContain("loginFlight.run");
    expect(flow.indexOf("await beforeLogin?.()")).toBeLessThan(flow.indexOf('fetch("/api/ping"'));
    expect(flow.indexOf('fetch("/api/ping"')).toBeLessThan(flow.indexOf("const loginUrl = getLoginUrl()"));
    expect(flow.slice(flow.indexOf("const loginUrl = getLoginUrl()"))).not.toContain("await");
    expect(flow).toContain("window.location.assign(loginUrl)");
  });
  it("mantém host-only/Secure e valida a prova escrita em cookie compatível com retorno externo", () => {
    const client = source("client/src/const.ts");
    expect(client).toContain("SameSite=None; Secure");
    expect(client).toContain("proofWritten");
    expect(client).toContain("window.location.origin");
    expect(client).toContain("encodeBrowserOAuthState({ redirectUri, nonce })");
    const gate = source("client/src/components/OperatorSecurityGate.tsx");
    expect(gate).toContain("warmUpAndLogin(prepareLogin)");
    expect(gate).toContain("if (isLoginInProgress()) return");
  });
  it("não registra worker de replay nem repete código no worker legado", () => {
    const main = source("client/src/main.tsx");
    const legacy = source("client/public/sw-auth.js");
    expect(main).not.toContain("register('/sw-auth.js'");
    expect(legacy).not.toContain("fetchWithRetry");
    expect(legacy).not.toContain('addEventListener("fetch"');
    expect(legacy).toContain("unregister()");
    expect(source("client/index.html")).toContain("register('/sw.js'");
  });
});
