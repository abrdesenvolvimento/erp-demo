import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const html = readFileSync(resolve(import.meta.dirname, "../client/index.html"), "utf8");
const script = html.match(/<script id="abrwf-boot-guard">([\s\S]*?)<\/script>/)?.[1];
function harness() {
  let shellMounted = true;
  const elements: Record<string, any> = {
    root: { contains: () => shellMounted },
    "abrwf-boot": {},
    "abrwf-boot-title": { textContent: "Carregando o sistema" },
    "abrwf-boot-copy": { textContent: "Aguarde um instante." },
    "abrwf-boot-retry": { hidden: true, addEventListener: vi.fn() },
  };
  const listeners = new Map<string, () => void>();
  const timeouts: (() => void)[] = [];
  let onMutation!: () => void;
  const disconnect = vi.fn();
  const reload = vi.fn();
  const clearTimeout = vi.fn();
  const window = {
    addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
    removeEventListener: (name: string) => listeners.delete(name),
    location: { reload },
  };
  runInNewContext(script!, {
    document: { getElementById: (id: string) => elements[id] }, window,
    setTimeout: (callback: () => void) => { timeouts.push(callback); return 7; }, clearTimeout,
    MutationObserver: class { constructor(callback: () => void) { onMutation = callback; } observe() {} disconnect = disconnect; },
  });
  return { elements, listeners, timeouts, reload, clearTimeout, disconnect,
    mountApp: () => { shellMounted = false; onMutation(); } };
}

describe("recuperação de inicialização da prévia", () => {
  it("entrega conteúdo visível antes de carregar o módulo do aplicativo", () => {
    expect(script).toBeTruthy();
    expect(html.indexOf('id="abrwf-boot"')).toBeLessThan(html.indexOf('src="/src/main.tsx"'));
    const ui = harness();
    expect(ui.elements["abrwf-boot-title"].textContent).toBe("Carregando o sistema");
    expect(ui.elements["abrwf-boot-retry"].hidden).toBe(true);
  });
  it.each(["error", "unhandledrejection"])("mostra recuperação em %s sem refletir URL ou dados de erro", event => {
    const ui = harness();
    ui.listeners.get(event)!();
    expect(ui.elements["abrwf-boot-title"].textContent).toBe("Não foi possível abrir o ABRWF");
    expect(ui.elements["abrwf-boot-copy"].textContent).toContain("nova aba");
    expect(ui.elements["abrwf-boot-retry"].hidden).toBe(false);
    expect(script).not.toMatch(/\.reason|\.stack|location\.href|document\.cookie|localStorage/);
  });
  it("oferece recuperação após timeout sem redirecionamento automático", () => {
    const ui = harness();
    ui.timeouts[0]();
    expect(ui.elements["abrwf-boot-retry"].hidden).toBe(false);
    expect(ui.reload).not.toHaveBeenCalled();
    const click = ui.elements["abrwf-boot-retry"].addEventListener.mock.calls[0][1];
    click();
    expect(ui.reload).toHaveBeenCalledOnce();
  });
  it("não substitui nem desbloqueia a interface depois que o React montou", () => {
    const ui = harness();
    const pendingError = ui.listeners.get("error")!;
    ui.mountApp();
    pendingError();
    ui.timeouts[0]();
    expect(ui.elements["abrwf-boot-retry"].hidden).toBe(true);
    expect(ui.listeners.size).toBe(0);
    expect(ui.clearTimeout).toHaveBeenCalledWith(7);
    expect(ui.disconnect).toHaveBeenCalledOnce();
  });
});
