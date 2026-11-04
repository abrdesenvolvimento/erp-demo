import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as runtime from "../client/src/hooks/operatorSecurityRuntime";
import type { OperatorSessionStatus } from "../shared/sessionSecurity";

const now = Date.parse("2026-11-15T12:00:00-03:00");
const session = (overrides: Partial<OperatorSessionStatus> = {}): OperatorSessionStatus => ({
  state: "ACTIVE", user: { id: "a", name: "A", avatarUrl: null }, company: null,
  sessionRef: "session-a", idleMinutes: 1, serverNow: now, lastActivityAt: now,
  expiresAt: Date.parse("2026-11-16T04:00:00-03:00"), retryAfterSeconds: 0, hasPin: true, ...overrides,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** Executes the production component with a deterministic hook/effect scheduler.
 * React elements and SSR are real; hooks, clocks, query cache and transport are
 * explicit mocks (no claim of a browser/React DOM lifecycle integration test).
 */
class HookScheduler {
  slots: any[] = [];
  cursor = 0;
  dirty = true;
  effects: Array<() => void> = [];
  result: any;
  component!: (...args: any[]) => any;
  props: any = {};
  hooks = {
    useState: (initial: any) => {
      const index = this.cursor++;
      if (!(index in this.slots)) this.slots[index] = { value: typeof initial === "function" ? initial() : initial };
      const slot = this.slots[index];
      return [slot.value, (next: any) => {
        const value = typeof next === "function" ? next(slot.value) : next;
        if (!Object.is(value, slot.value)) { slot.value = value; this.dirty = true; }
      }];
    },
    useRef: (value: any) => {
      const index = this.cursor++;
      return this.slots[index] ??= { current: value };
    },
    useId: () => { this.cursor++; return "test-pin"; },
    useCallback: (fn: any, deps: any[]) => {
      const index = this.cursor++;
      const old = this.slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) this.slots[index] = { fn, deps };
      return this.slots[index].fn;
    },
    useEffect: (effect: any, deps: any[]) => {
      const index = this.cursor++;
      const old = this.slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        this.slots[index] = { deps, cleanup: old?.cleanup };
        this.effects.push(() => {
          this.slots[index].cleanup?.();
          this.slots[index].cleanup = effect();
        });
      }
    },
  };
  render() {
    this.cursor = 0;
    this.dirty = false;
    this.result = this.component(this.props);
    const effects = this.effects.splice(0);
    effects.forEach(run => run());
  }
  async settle() {
    for (let i = 0; i < 30; i++) {
      if (this.dirty) this.render();
      await Promise.resolve();
    }
    if (this.dirty) this.render();
  }
  dispose() { this.slots.forEach(slot => slot?.cleanup?.()); }
}

const source = readFileSync(resolve(import.meta.dirname, "../client/src/components/OperatorSecurityGate.tsx"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;

function harness(initial = session(), path = "/seguranca", runner = new HookScheduler()) {
  let signal: (value: runtime.OperatorSignal) => void = () => {};
  let cacheListener: (value: any) => void = () => {};
  const listeners = new Map<string, Set<(event: any) => void>>();
  const windowMock = {
    addEventListener: (type: string, callback: any) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(callback); },
    removeEventListener: (type: string, callback: any) => listeners.get(type)?.delete(callback),
    location: { assign: vi.fn() },
  };
  vi.stubGlobal("window", windowMock);
  vi.stubGlobal("document", windowMock);
  const state = { company: null as number | null, status: initial };
  const pendingStatus: Array<Promise<any>> = [];
  const refetch = vi.fn(() => pendingStatus.shift() ?? Promise.resolve({ data: state.status, error: null }));
  const authFetch = vi.fn(() => Promise.resolve({ id: "a" } as { id: string } | null));
  const scopedCancel = vi.fn(() => Promise.resolve());
  const remove = vi.fn();
  const clearMutations = vi.fn();
  const queryClient = {
    cancelQueries: scopedCancel, removeQueries: remove, clear: vi.fn(),
    getMutationCache: () => ({ clear: clearMutations }),
    getQueryCache: () => ({ subscribe: (callback: any) => { cacheListener = callback; return () => {}; } }),
  };
  const utils = {
    auth: { me: { invalidate: vi.fn(() => Promise.resolve()), fetch: authFetch } },
    company: { myCompanies: { invalidate: vi.fn(() => Promise.resolve()) } },
    operatorSecurity: { status: { invalidate: vi.fn(() => Promise.resolve()) } },
  };
  let activityCallbacks: any;
  const activityMutate = vi.fn((_input, callbacks) => { activityCallbacks = callbacks; });
  const unlockAsync = vi.fn(() => Promise.resolve({ success: true, retryAfterSeconds: 0 }));
  const setupAsync = vi.fn(() => Promise.resolve());
  const mutation = { isPending: false, mutateAsync: unlockAsync };
  const toastError = vi.fn();
  const broadcast = vi.fn((type: runtime.OperatorSignalType) => signal({ type, nonce: String(Math.random()) }));
  const pass = ({ children }: any) => React.createElement("section", { "data-access": true }, children);
  const requireMock = (specifier: string): any => {
    switch (specifier) {
      case "react": return { ...React, ...runner.hooks };
      case "react/jsx-runtime": return jsxRuntime;
      case "react-dom": return { flushSync: (fn: any) => fn() };
      case "wouter": return { useLocation: () => [path] };
      case "@tanstack/react-query": return { useQueryClient: () => queryClient };
      case "@trpc/client": return { TRPCClientError: class extends Error {} };
      case "lucide-react": return Object.fromEntries(["ArrowRight", "LockKeyhole", "LogOut", "ShieldCheck", "UserRound"].map(name => [name, () => null]));
      case "sonner": return { toast: { error: toastError } };
      case "@/lib/trpc": return { trpc: {
        useUtils: () => utils,
        operatorSecurity: {
          status: { useQuery: () => ({ data: state.status, refetch }) },
          activity: { useMutation: () => ({ mutate: activityMutate, isPending: false }) },
          unlock: { useMutation: () => mutation },
          setupPin: { useMutation: () => ({ isPending: false, mutateAsync: setupAsync }) },
        },
      } };
      case "@/_core/hooks/useAuth": return { useAuth: () => ({ logout: vi.fn() }) };
      case "@/const": return { warmUpAndLogin: vi.fn(), isLoginInProgress: () => false };
      case "@/contexts/CompanyContext": return { useCompany: () => ({ activeCompanyId: state.company }) };
      case "./AnniversaryAccess": return { __esModule: true, default: pass, AccessPendingCard: () => React.createElement("button", { disabled: true }, "Acesse o ABRWF") };
      case "@/hooks/operatorSecurityRuntime": return runtime;
      case "@/hooks/useOperatorSecuritySignal": return {
        useOperatorSecuritySignal: (callback: any) => { signal = callback; }, broadcastOperatorSecurity: broadcast,
      };
      default: throw new Error(specifier);
    }
  };
  const module = new Function("require", "exports", `${compiled}\nreturn { ProtectedOperatorGate, OperatorAccessForm };`)(requireMock, {});
  runner.component = module.ProtectedOperatorGate;
  runner.props = { path, children: React.createElement("textarea", { "data-business": true, defaultValue: "rascunho" }) };
  const emit = (type: runtime.OperatorSignalType) => { signal({ type, nonce: String(Math.random()) }); };
  const walk = (node: any, type: any): any => {
    if (!node || typeof node !== "object") return null;
    if (node.type === type) return node;
    for (const child of React.Children.toArray(node.props?.children)) { const found = walk(child, type); if (found) return found; }
    return null;
  };
  // Replace the nested access form with a marker; it has its own scheduler test.
  const markupNode = (node: any): any => {
    if (!React.isValidElement(node)) return node;
    const el = node as React.ReactElement<any>;
    if (el.type === module.OperatorAccessForm) return React.createElement("div", { "data-security-state": el.props.state, "data-unavailable": el.props.unavailable });
    return React.cloneElement(el, {}, ...React.Children.toArray(el.props.children).map(markupNode));
  };
  const html = () => renderToStaticMarkup(markupNode(runner.result));
  return { runner, module, state, pendingStatus, refetch, authFetch, utils, remove, clearMutations,
    emit, html, walk, broadcast, unlockAsync, mutation, listeners, activityMutate, toastError,
    activityCallbacks: () => activityCallbacks,
    invalidate: () => cacheListener({ type: "updated", action: { type: "invalidate" }, query: { queryKey: [["operatorSecurity", "status"]] } }),
  };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("production security components — executable mocked hooks/transport + React elements", () => {
  it("ordinary status and policy/company invalidation preserve business/editor and do not hydrate again", async () => {
    const test = harness();
    await test.runner.settle();
    expect(test.html()).toContain("data-business");
    expect(test.authFetch).toHaveBeenCalledTimes(1);
    const pending = deferred<any>();
    test.pendingStatus.push(pending.promise);
    test.emit("status");
    await test.runner.settle();
    expect(test.html()).toContain("rascunho");
    expect(test.html()).not.toContain("data-security-state");
    pending.resolve({ data: session({ serverNow: now + 100 }), error: null });
    await test.runner.settle();
    test.state.company = 2;
    test.state.status = session({ company: { id: 2, name: "B", logoUrl: null }, serverNow: now + 200 });
    test.runner.dirty = true;
    await test.runner.settle();
    test.invalidate();
    await test.runner.settle();
    expect(test.authFetch).toHaveBeenCalledTimes(1);
    expect(test.utils.company.myCompanies.invalidate).toHaveBeenCalledTimes(1);
    expect(test.html()).toContain("data-business");
    test.runner.dispose();
  });
  it("lock hides immediately, old response cannot revive, fresh ACTIVE before mutation cannot clear latch", async () => {
    const test = harness();
    await test.runner.settle();
    const pending = deferred<any>();
    test.pendingStatus.push(pending.promise);
    test.emit("status");
    await test.runner.settle();
    test.emit("lock");
    await test.runner.settle();
    expect(test.html()).not.toContain("data-business");
    expect(test.html()).toContain('data-security-state="LOCKED"');
    pending.resolve({ data: session(), error: null });
    await test.runner.settle();
    expect(test.html()).not.toContain("data-business");
    test.runner.dispose();
  });
  it("PIN success awaits fresh ACTIVE then matching auth; repeated status does not trigger second PIN/hydration", async () => {
    const test = harness(session({ state: "LOCKED" }));
    await test.runner.settle();
    const pending = deferred<any>();
    test.pendingStatus.push(pending.promise);
    test.emit("unlocked");
    await test.runner.settle();
    expect(test.html()).toContain('data-security-state="VERIFYING"');
    expect(test.authFetch).not.toHaveBeenCalled();
    const auth = deferred<{ id: string }>();
    test.authFetch.mockReturnValueOnce(auth.promise);
    test.state.status = session();
    pending.resolve({ data: session(), error: null });
    await test.runner.settle();
    expect(test.html()).not.toContain("data-business");
    expect(test.authFetch).toHaveBeenCalledTimes(1);
    test.emit("status");
    await test.runner.settle();
    expect(test.authFetch).toHaveBeenCalledTimes(1);
    auth.resolve({ id: "a" });
    await test.runner.settle();
    expect(test.html()).toContain("data-business");
    test.runner.dispose();
  });
  it("identity change flushes scoped queries and cannot render before new matching auth", async () => {
    const test = harness();
    await test.runner.settle();
    test.state.status = session({ user: { id: "b", name: "B", avatarUrl: null }, sessionRef: "session-b" });
    const auth = deferred<{ id: string }>();
    test.authFetch.mockReturnValueOnce(auth.promise);
    test.emit("status");
    await test.runner.settle();
    expect(test.html()).not.toContain("data-business");
    expect(test.remove).toHaveBeenCalledTimes(2);
    expect(test.clearMutations).toHaveBeenCalledTimes(2);
    auth.resolve({ id: "b" });
    await test.runner.settle();
    expect(test.html()).toContain("data-business");
    test.runner.dispose();
  });
  it("paired production KDS stays in the same hidden/inert wrapper across lock/release", async () => {
    const test = harness(session({ productionTerminal: { companyId: 1, name: "Cozinha" } }), "/salao/kds-cozinha");
    await test.runner.settle();
    const child = test.runner.props.children;
    test.state.status = session({ state: "LOCKED", productionTerminal: { companyId: 1, name: "Cozinha" } });
    test.emit("lock");
    await test.runner.settle();
    const wrapper = test.walk(test.runner.result, "div");
    expect(wrapper.props.hidden).toBe(true);
    expect(wrapper.props.inert).toBe(true);
    expect(wrapper.props.children).toBe(child);
    expect(test.html()).toContain("data-business");
    test.state.status = session({ productionTerminal: { companyId: 1, name: "Cozinha" } });
    test.emit("unlocked");
    await test.runner.settle();
    expect(test.walk(test.runner.result, "div").props.children).toBe(child);
    expect(test.walk(test.runner.result, "div").props.hidden).toBe(false);
    test.runner.dispose();
  });
  it("wheel/input are wired, synthetic/movement/scroll events do not touch, receipts preserve terminal", async () => {
    const test = harness(session({ productionTerminal: { companyId: 1, name: "KDS" } }), "/salao/kds-cozinha");
    await test.runner.settle();
    expect(test.listeners.has("wheel")).toBe(true);
    expect(test.listeners.has("input")).toBe(true);
    expect(test.listeners.has("scroll")).toBe(false);
    expect(test.listeners.has("mousemove")).toBe(false);
    const wheel = [...test.listeners.get("wheel")!][0];
    wheel({ type: "wheel", isTrusted: false });
    expect(test.activityMutate).not.toHaveBeenCalled();
    wheel({ type: "wheel", isTrusted: true });
    expect(test.activityMutate).toHaveBeenCalledTimes(1);
    const callbacks = test.activityCallbacks();
    callbacks.onSuccess({ success: true, status: session({ serverNow: now + 5000, lastActivityAt: now + 5000 }) });
    await test.runner.settle();
    expect(test.walk(test.runner.result, "div")).not.toBe(null);
    expect(test.walk(test.runner.result, "div").props.hidden).toBe(false);
    test.runner.dispose();
  });
  it("network failure hides business and offers unavailable recheck rather than wrong-PIN form", async () => {
    const test = harness();
    await test.runner.settle();
    test.pendingStatus.push(Promise.resolve({ error: new Error("offline") }));
    test.emit("status");
    await test.runner.settle();
    expect(test.html()).not.toContain("data-business");
    expect(test.html()).toContain('data-security-state="VERIFYING"');
    expect(test.html()).toContain('data-unavailable="true"');
    test.runner.dispose();
  });
  it("a pre-lock activity acknowledgement cannot release the screen or reset its deadline", async () => {
    const test = harness();
    await test.runner.settle();
    const wheel = [...test.listeners.get("wheel")!][0];
    wheel({ type: "wheel", isTrusted: true });
    const old = test.activityCallbacks();
    test.emit("lock");
    await test.runner.settle();
    old.onSuccess({ success: true, status: session({ serverNow: now + 5000, lastActivityAt: now + 5000 }) });
    old.onSettled();
    await test.runner.settle();
    expect(test.html()).not.toContain("data-business");
    expect(test.html()).toContain('data-security-state="LOCKED"');
    test.runner.dispose();
  });
  it("trusted input arriving at the local idle deadline is stopped instead of touching", async () => {
    const test = harness();
    await test.runner.settle();
    vi.setSystemTime(now + 60_000);
    const event = { type: "input", isTrusted: true, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
    [...test.listeners.get("input")!][0](event);
    await test.runner.settle();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(test.activityMutate).not.toHaveBeenCalled();
    expect(test.html()).not.toContain("data-business");
    test.runner.dispose();
  });
  it("form keeps submission guard latched after successful PIN, despite stale LOCKED props", async () => {
    const runner = new HookScheduler();
    const test = harness(session({ state: "LOCKED" }), "/seguranca", runner);
    runner.component = test.module.OperatorAccessForm;
    runner.props = { status: test.state.status, state: "LOCKED", unavailable: false,
      onRecheck: async () => {}, productionStation: false, unpairedStation: false };
    await runner.settle();
    test.walk(runner.result, "input").props.onChange({ target: { value: "583907" } });
    await runner.settle();
    const form = test.walk(runner.result, "form");
    const first = form.props.onSubmit({ preventDefault() {} });
    const duplicate = form.props.onSubmit({ preventDefault() {} });
    await Promise.all([first, duplicate]);
    await runner.settle();
    expect(test.unlockAsync).toHaveBeenCalledTimes(1);
    expect(test.broadcast).toHaveBeenCalledWith("unlocked");
    expect(test.walk(runner.result, "input").props.disabled).toBe(true);
    test.walk(runner.result, "input").props.onChange({ target: { value: "583907" } });
    await runner.settle();
    await test.walk(runner.result, "form").props.onSubmit({ preventDefault() {} });
    expect(test.unlockAsync).toHaveBeenCalledTimes(1);
    runner.dispose();
  });
  it("post-PIN connection failure leaves retry/full login available, without another PIN submission", async () => {
    const runner = new HookScheduler();
    const test = harness(session({ state: "LOCKED" }), "/seguranca", runner);
    runner.component = test.module.OperatorAccessForm;
    runner.props = { status: test.state.status, state: "LOCKED", unavailable: false,
      onRecheck: async () => {}, productionStation: false, unpairedStation: false };
    await runner.settle();
    test.walk(runner.result, "input").props.onChange({ target: { value: "583907" } });
    await runner.settle();
    await test.walk(runner.result, "form").props.onSubmit({ preventDefault() {} });
    runner.props = { ...runner.props, state: "VERIFYING", unavailable: true };
    runner.dirty = true;
    await runner.settle();
    const html = renderToStaticMarkup(runner.result);
    expect(html).toContain("Conexão indisponível");
    expect(html).toContain("Verificar conexão novamente");
    expect(html).toContain("Fazer novo login completo");
    expect(html).not.toContain('disabled=""');
    expect(test.walk(runner.result, "form")).toBe(null);
    expect(test.unlockAsync).toHaveBeenCalledOnce();
    runner.dispose();
  });
});
