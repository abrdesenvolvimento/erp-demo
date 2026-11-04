import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  getOptionalStorageItem,
  setOptionalStorageItem,
  removeOptionalStorageItem,
} from "../client/src/lib/optionalStorage";

function fakeStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  };
}

function installWindow(storage: Storage) {
  const fakeWindow = { localStorage: storage, dispatchEvent: vi.fn() };
  vi.stubGlobal("window", fakeWindow);
  return fakeWindow;
}

function installDeniedWindow() {
  const fakeWindow = { dispatchEvent: vi.fn() };
  Object.defineProperty(fakeWindow, "localStorage", {
    get() { throw new DOMException("Access is denied for this document", "SecurityError"); },
  });
  vi.stubGlobal("window", fakeWindow);
  return fakeWindow;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("optionalStorage", () => {
  it("reads, writes and removes with normal Storage", () => {
    const storage = fakeStorage();
    installWindow(storage);
    expect(getOptionalStorageItem("cache")).toBeNull();
    expect(setOptionalStorageItem("cache", "value")).toBe(true);
    expect(getOptionalStorageItem("cache")).toBe("value");
    expect(removeOptionalStorageItem("cache")).toBe(true);
    expect(getOptionalStorageItem("cache")).toBeNull();
  });

  it("is safe without a browser window", () => {
    vi.stubGlobal("window", undefined);
    expect(getOptionalStorageItem("cache")).toBeNull();
    expect(setOptionalStorageItem("cache", "value")).toBe(false);
    expect(removeOptionalStorageItem("cache")).toBe(false);
  });

  it("catches a SecurityError thrown by the window.localStorage getter", () => {
    installDeniedWindow();
    expect(getOptionalStorageItem("cache")).toBeNull();
    expect(setOptionalStorageItem("cache", "value")).toBe(false);
    expect(removeOptionalStorageItem("cache")).toBe(false);
  });

  for (const name of ["SecurityError", "QuotaExceededError"]) {
    it.each(["getItem", "setItem", "removeItem"] as const)(`catches ${name} from %s`, method => {
      const storage = fakeStorage();
      vi.mocked(storage[method]).mockImplementation(() => { throw new DOMException("Blocked storage", name); });
      installWindow(storage);
      if (method === "getItem") expect(getOptionalStorageItem("cache")).toBeNull();
      else if (method === "setItem") expect(setOptionalStorageItem("cache", "value")).toBe(false);
      else expect(removeOptionalStorageItem("cache")).toBe(false);
    });
  }

  it("does not retain identity in a fallback after denied storage becomes available", () => {
    installDeniedWindow();
    expect(setOptionalStorageItem("manus-runtime-user-info", '{"id":"previous-operator"}')).toBe(false);
    installWindow(fakeStorage());
    expect(getOptionalStorageItem("manus-runtime-user-info")).toBeNull();
  });
});

// Execute the real hook body with deterministic hook/tRPC adapters. No DOM,
// network or DB calls: effects are queued separately to test render purity.
const authModule = ts.transpileModule(
  readFileSync(resolve(import.meta.dirname, "../client/src/_core/hooks/useAuth.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText;

function authHarness(data: unknown, queryError: Error | null = null, loading = false) {
  const effects: Array<() => unknown> = [];
  const setData = vi.fn();
  const revoke = vi.fn(async () => {});
  const cancelQueries = vi.fn(async () => {});
  const clear = vi.fn();
  const signal = vi.fn();
  const document = { cookie: "" };
  const query = { data, error: queryError, isLoading: loading, isFetching: false, refetch: vi.fn() };
  class ClientError extends Error {}
  const modules: Record<string, unknown> = {
    "react": {
      useCallback: (fn: unknown) => fn,
      useEffect: (fn: () => unknown) => { effects.push(fn); },
      useMemo: (fn: () => unknown) => fn(),
      useRef: (value: unknown) => ({ current: value }),
      useState: (value: unknown) => [value, vi.fn()],
    },
    "@/const": { getLoginUrl: vi.fn(() => { throw new Error("Unexpected OAuth navigation"); }) },
    "@/lib/trpc": { trpc: {
      useUtils: () => ({ auth: { me: { setData } } }),
      auth: {
        me: { useQuery: () => query },
        logout: { useMutation: () => ({ mutateAsync: revoke, isPending: false, error: null }) },
      },
    } },
    "@trpc/client": { TRPCClientError: ClientError },
    "@tanstack/react-query": { useQueryClient: () => ({ cancelQueries, clear }) },
    "@/hooks/useOperatorSecuritySignal": { broadcastOperatorSecurity: signal },
    "@/lib/optionalStorage": { removeOptionalStorageItem, setOptionalStorageItem },
  };
  const exports: Record<string, any> = {};
  runInNewContext(authModule, {
    exports,
    require: (name: string) => {
      if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    },
    window: globalThis.window,
    document,
    Event,
    console,
    setTimeout,
    clearTimeout,
  });
  const state = exports.useAuth();
  return { state, effects, setData, revoke, cancelQueries, clear, signal, document };
}

describe("useAuth optional runtime metadata", () => {
  it("keeps render pure and only caches query identity in an effect", () => {
    const storage = fakeStorage();
    installWindow(storage);
    const user = { id: "operator-a", name: "A" };
    const harness = authHarness(user);
    expect(harness.state.user).toBe(user);
    expect(harness.state.isAuthenticated).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
    harness.effects.forEach(effect => effect());
    expect(storage.getItem("manus-runtime-user-info")).toBe(JSON.stringify(user));
  });

  it("preserves authenticated query state and effects with a denied storage getter", () => {
    installDeniedWindow();
    const user = { id: "operator-a" };
    const harness = authHarness(user);
    expect(harness.state.user).toBe(user);
    expect(harness.state.isAuthenticated).toBe(true);
    expect(harness.state.loading).toBe(false);
    expect(() => harness.effects.forEach(effect => effect())).not.toThrow();
  });

  it("does not authenticate a stale cached identity when the query returns null", () => {
    const storage = fakeStorage();
    installWindow(storage);
    storage.setItem("manus-runtime-user-info", '{"id":"previous-operator"}');
    const harness = authHarness(null);
    expect(harness.state.user).toBeNull();
    expect(harness.state.isAuthenticated).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled();
    harness.effects.forEach(effect => effect());
    expect(storage.getItem("manus-runtime-user-info")).toBeNull();
  });

  it("preserves loading and query error without storage", () => {
    installDeniedWindow();
    const error = new Error("Query unavailable");
    const harness = authHarness(undefined, error, true);
    expect(harness.state.user).toBeNull();
    expect(harness.state.isAuthenticated).toBe(false);
    expect(harness.state.loading).toBe(true);
    expect(harness.state.error).toBe(error);
    expect(() => harness.effects.forEach(effect => effect())).not.toThrow();
  });

  it("ignores metadata serialization failures without changing auth truth", () => {
    installWindow(fakeStorage());
    const user = { id: "operator-a", unsupportedMetadata: BigInt(1) };
    const harness = authHarness(user);
    expect(harness.state.user).toBe(user);
    expect(harness.state.isAuthenticated).toBe(true);
    expect(() => harness.effects.forEach(effect => effect())).not.toThrow();
  });

  it.each(["getter", "removeItem"] as const)("completes logout after revocation when %s throws", async failure => {
    const storage = fakeStorage();
    const fakeWindow = failure === "getter" ? installDeniedWindow() : installWindow(storage);
    if (failure === "removeItem") {
      vi.mocked(storage.removeItem).mockImplementation(() => {
        throw new DOMException("Removal denied", "SecurityError");
      });
    }
    const harness = authHarness({ id: "operator-a" });
    await expect(harness.state.logout()).resolves.toBeUndefined();
    expect(harness.revoke).toHaveBeenCalledTimes(1);
    expect(harness.cancelQueries).toHaveBeenCalledTimes(1);
    expect(harness.clear).toHaveBeenCalledTimes(1);
    expect(fakeWindow.dispatchEvent).toHaveBeenCalledTimes(1);
    expect(harness.signal).toHaveBeenCalledWith("logout");
    expect(harness.setData).toHaveBeenCalledWith(undefined, null);
    expect(harness.document.cookie).toBe("activeBranchId=;path=/;max-age=0");
    expect(harness.revoke.mock.invocationCallOrder[0]).toBeLessThan(harness.clear.mock.invocationCallOrder[0]);
    if (failure === "removeItem") {
      expect(harness.clear.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(storage.removeItem).mock.invocationCallOrder[0]);
    }
  });

  it("still rejects failed server revocation instead of hiding an auth error", async () => {
    installDeniedWindow();
    const harness = authHarness({ id: "operator-a" });
    harness.revoke.mockRejectedValueOnce(new Error("Server unavailable"));
    await expect(harness.state.logout()).rejects.toThrow("Server unavailable");
    expect(harness.clear).not.toHaveBeenCalled();
    expect(harness.signal).not.toHaveBeenCalled();
  });
});
