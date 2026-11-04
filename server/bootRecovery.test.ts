import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { injectAccessBoot } from "./accessBoot";

const html = readFileSync(resolve(import.meta.dirname, "../client/index.html"), "utf8");
const script = html.match(/<script id="abrwf-boot-guard">([\s\S]*?)<\/script>/)?.[1];
function harness(page = html) {
  let shellMounted = true;
  const elements: Record<string, any> = {
    root: { contains: () => shellMounted },
    "abrwf-boot": {},
    "abrwf-boot-title": { textContent: "Acesse o ABRWF" },
    "abrwf-boot-copy": { textContent: "Faça login para continuar" },
    "abrwf-boot-enter": { hidden: false, disabled: true },
    "abrwf-boot-retry": { hidden: true, addEventListener: vi.fn() },
  };
  const listeners = new Map<string, () => void>();
  const timeouts: (() => void)[] = [];
  const setTimeout = vi.fn((callback: () => void, _delay: number) => {
    timeouts.push(callback);
    return 7;
  });
  let onMutation!: () => void;
  const disconnect = vi.fn();
  const reload = vi.fn();
  const clearTimeout = vi.fn();
  const window = {
    addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
    removeEventListener: (name: string) => listeners.delete(name),
    location: { reload },
  };
  const pageScript = page.match(/<script id="abrwf-boot-guard">([\s\S]*?)<\/script>/)?.[1];
  runInNewContext(pageScript!, {
    document: { getElementById: (id: string) => elements[id] }, window,
    setTimeout, clearTimeout,
    MutationObserver: class { constructor(callback: () => void) { onMutation = callback; } observe() {} disconnect = disconnect; },
  });
  return { elements, listeners, timeouts, setTimeout, reload, clearTimeout, disconnect,
    mountApp: () => { shellMounted = false; onMutation(); } };
}

const novemberHtml = injectAccessBoot(html, Date.parse("2026-11-03T15:00:00Z"));

describe.each([
  ["fallback HTML", html],
  ["HTML anônimo injetado", novemberHtml],
])("recuperação de inicialização: %s", (_name, page) => {
  it("entrega acesso neutro e inerte antes do módulo do aplicativo", () => {
    expect(script).toBeTruthy();
    expect(page.indexOf('id="abrwf-boot"')).toBeLessThan(page.indexOf('src="/src/main.tsx"'));
    expect(page).toContain("Acesse o ABRWF");
    expect(page).toContain("Faça login para continuar");
    expect(page).not.toMatch(/Carregando o sistema|Aguarde um instante/);
    expect(page).toMatch(/<button\b[^>]*id="abrwf-boot-enter"[^>]*\bdisabled(?:="")?[^>]*>Entrar(?:<svg[\s\S]*?<\/svg>)?<\/button>/);
    expect(page).toContain("#abrwf-boot [hidden] { display: none !important; }");
    const ui = harness(page);
    expect(ui.elements["abrwf-boot-title"].textContent).toBe("Acesse o ABRWF");
    expect(ui.elements["abrwf-boot-copy"].textContent).toBe("Faça login para continuar");
    expect(ui.elements["abrwf-boot-enter"]).toMatchObject({ hidden: false, disabled: true });
    expect(ui.elements["abrwf-boot-retry"].hidden).toBe(true);
  });
  it.each(["error", "unhandledrejection"])("mostra recuperação em %s sem refletir URL ou dados de erro", event => {
    const ui = harness(page);
    ui.listeners.get(event)!();
    expect(ui.elements["abrwf-boot-title"].textContent).toBe("Não foi possível abrir o ABRWF");
    expect(ui.elements["abrwf-boot-copy"].textContent).toContain("nova aba");
    expect(ui.elements["abrwf-boot-enter"]).toMatchObject({ hidden: true, disabled: true });
    expect(ui.elements["abrwf-boot-retry"].hidden).toBe(false);
    expect(script).not.toMatch(/\.reason|\.stack|location\.href|document\.cookie|localStorage/);
  });
  it("oferece recuperação após 20s sem redirecionamento ou login automático", () => {
    const ui = harness(page);
    expect(ui.setTimeout).toHaveBeenCalledWith(expect.any(Function), 20000);
    ui.timeouts[0]();
    expect(ui.elements["abrwf-boot-enter"]).toMatchObject({ hidden: true, disabled: true });
    expect(ui.elements["abrwf-boot-retry"].hidden).toBe(false);
    expect(ui.reload).not.toHaveBeenCalled();
    const click = ui.elements["abrwf-boot-retry"].addEventListener.mock.calls[0][1];
    click();
    expect(ui.reload).toHaveBeenCalledOnce();
  });
  it("não substitui nem desbloqueia a interface depois que o React montou", () => {
    const ui = harness(page);
    const pendingError = ui.listeners.get("error")!;
    const pendingRejection = ui.listeners.get("unhandledrejection")!;
    ui.mountApp();
    pendingError();
    pendingRejection();
    ui.timeouts[0]();
    expect(ui.elements["abrwf-boot-title"].textContent).toBe("Acesse o ABRWF");
    expect(ui.elements["abrwf-boot-copy"].textContent).toBe("Faça login para continuar");
    expect(ui.elements["abrwf-boot-enter"]).toMatchObject({ hidden: false, disabled: true });
    expect(ui.elements["abrwf-boot-retry"].hidden).toBe(true);
    expect(ui.listeners.size).toBe(0);
    expect(ui.clearTimeout).toHaveBeenCalledWith(7);
    expect(ui.disconnect).toHaveBeenCalledOnce();
  });
});
