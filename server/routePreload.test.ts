import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToString } from "react-dom/server";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const source = readFileSync(resolve(root, "client/src/lib/routePreload.ts"), "utf8");
const compile = (text: string) => ts.transpileModule(text, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const compiled = compile(source);
type Registry = {
  memoizeRouteLoader: <T>(load: () => Promise<T>) => () => Promise<T>;
  routeLoaders: Record<string, () => Promise<{ default: React.ComponentType }>>;
  preloadRoute: (path: string) => Promise<void>;
  routePreloadIntent: (path: string) => Record<"onMouseEnter" | "onFocus" | "onPointerDown", () => void>;
};
function harness(onImport?: (specifier: string) => unknown) {
  const imports: string[] = [];
  const mounted = vi.fn();
  const requireMock = (specifier: string) => {
    if (!specifier.startsWith("../pages/")) throw new Error(`Unexpected dependency ${specifier}`);
    imports.push(specifier);
    return onImport ? onImport(specifier) : { default: () => { mounted(); return null; } };
  };
  const registry: Registry = new Function("require", "exports", `${compiled}\nreturn exports;`)(requireMock, {});
  return { registry, imports, mounted };
}
function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolvePromise = yes; reject = no; });
  return { promise, resolve: resolvePromise, reject };
}
afterEach(() => vi.unstubAllGlobals());

describe("route preloading — no eager work, shared module cache and safe retry", () => {
  it("does not import or mount any page on registry/intent-handler creation", async () => {
    const test = harness();
    const handlers = test.registry.routePreloadIntent("/produtos");
    expect(Object.keys(handlers)).toEqual(["onMouseEnter", "onFocus", "onPointerDown"]);
    await Promise.resolve();
    expect(test.imports).toEqual([]);
    expect(test.mounted).not.toHaveBeenCalled();
  });

  it("hover/focus/pointerdown only load their exact target once, without rendering it", async () => {
    const test = harness();
    const handlers = test.registry.routePreloadIntent("/produtos");
    handlers.onMouseEnter();
    handlers.onFocus();
    handlers.onPointerDown();
    await test.registry.preloadRoute("/produtos");
    expect(test.imports).toEqual(["../pages/Produtos"]);
    expect(test.mounted).not.toHaveBeenCalled();
    await test.registry.preloadRoute("/produtos");
    expect(test.imports).toHaveLength(1);
  });

  it("shares one pending promise and successful result with the lazy loader", async () => {
    const pending = deferred<{ default: React.ComponentType }>();
    const test = harness(() => pending.promise);
    const preload = test.registry.preloadRoute("/produtos");
    const navigation = test.registry.routeLoaders.Produtos();
    expect(test.registry.routeLoaders.Produtos()).toBe(navigation);
    await Promise.resolve();
    await Promise.resolve();
    expect(test.imports).toEqual(["../pages/Produtos"]);
    const result = { default: () => null };
    pending.resolve(result);
    await preload;
    expect(await navigation).toBe(result);
    expect(test.registry.routeLoaders.Produtos()).toBe(navigation);
    expect(test.mounted).not.toHaveBeenCalled();
  });

  it("silences a failed speculative import and lets a later navigation retry", async () => {
    const pending = deferred<unknown>();
    let failed = true;
    const test = harness(() => failed ? pending.promise : { default: () => null });
    const first = test.registry.preloadRoute("/produtos");
    const duplicate = test.registry.preloadRoute("/produtos");
    await Promise.resolve();
    await Promise.resolve();
    expect(test.imports).toHaveLength(1);
    pending.reject(new Error("chunk unavailable"));
    await expect(first).resolves.toBeUndefined();
    await expect(duplicate).resolves.toBeUndefined();
    failed = false;
    expect(await test.registry.routeLoaders.Produtos()).toHaveProperty("default");
    expect(test.imports).toEqual(["../pages/Produtos", "../pages/Produtos"]);
  });

  it("evicts synchronous loader failures as well as rejected promises", async () => {
    const test = harness();
    let fail = true;
    const load = vi.fn(() => {
      if (fail) throw new Error("synchronous import wrapper error");
      return Promise.resolve("ok");
    });
    const memoized = test.registry.memoizeRouteLoader(load);
    await expect(memoized()).rejects.toThrow("synchronous import wrapper error");
    fail = false;
    await expect(memoized()).resolves.toBe("ok");
    await expect(memoized()).resolves.toBe("ok");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("ignores unknown/external/prototype paths rather than guessing or loading all pages", async () => {
    const test = harness();
    for (const href of ["", "/unknown", "/produtos-extra", "/salao", "/salao/comanda/", "/salao/comanda/1/extra", "https://erp.example/produtos", "//erp.example/produtos", "__proto__", "constructor", "toString"]) {
      await test.registry.preloadRoute(href);
    }
    expect(test.imports).toEqual([]);
  });

  it("maps query/hash, aliases and real comanda params to the existing shared loaders", async () => {
    const test = harness();
    await test.registry.preloadRoute("/importar-ifood?mode=1");
    await test.registry.preloadRoute("/importar-vendas/ifood#top");
    await test.registry.preloadRoute("/salao/comanda/731");
    await test.registry.preloadRoute("/salao/comanda/732?tab=items");
    expect(test.imports).toEqual(["../pages/ImportadorIfood", "../pages/SalaoComanda"]);
  });
});

describe("sidebar integration — only visible destination intent", () => {
  it("renders without preloading and wires actual destination buttons, never group/logout/company controls", async () => {
    const test = harness();
    const navigation = vi.fn();
    const captured: Array<Record<string, any>> = [];
    vi.stubGlobal("localStorage", { getItem: () => "true" });
    const pass = ({ children }: any) => React.createElement(React.Fragment, null, children);
    const button = (props: Record<string, any>) => { captured.push(props); return React.createElement("button", null, props.children); };
    const sidebar = Object.fromEntries(["Sidebar", "SidebarContent", "SidebarFooter", "SidebarHeader", "SidebarInset", "SidebarMenu", "SidebarMenuItem", "SidebarProvider"].map(name => [name, pass]));
    const layoutSource = readFileSync(resolve(root, "client/src/components/DashboardLayout.tsx"), "utf8");
    const Layout = new Function("require", "exports", `${compile(layoutSource)}\nreturn exports.default;`)((specifier: string) => {
      switch (specifier) {
        case "react": return React;
        case "react/jsx-runtime": return jsxRuntime;
        case "wouter": return { useLocation: () => ["/", navigation] };
        case "@/_core/hooks/useAuth": return { useAuth: () => ({ user: { role: "admin", name: "Operator" }, loading: false, logout: vi.fn() }) };
        case "@/components/ui/avatar": return { Avatar: pass, AvatarFallback: pass, AvatarImage: pass };
        case "@/components/ui/dropdown-menu": return { DropdownMenu: pass, DropdownMenuContent: pass, DropdownMenuItem: button, DropdownMenuTrigger: pass };
        case "@/components/ui/sidebar": return { ...sidebar, SidebarMenuButton: button, SidebarTrigger: pass, useSidebar: () => ({ state: "expanded", toggleSidebar: vi.fn() }) };
        case "@/const": return { APP_LOGO: "/logo.png", APP_TITLE: "ERP", warmUpAndLogin: vi.fn() };
        case "@/hooks/useMobile": return { useIsMobile: () => false };
        case "@/hooks/useKeyboardShortcuts": return { useKeyboardShortcuts: vi.fn() };
        case "lucide-react": return new Proxy({}, { get: () => () => null });
        case "./DashboardLayoutSkeleton": return { DashboardLayoutSkeleton: pass };
        case "./ui/button": return { Button: pass };
        case "@/contexts/CompanyContext": return { useCompany: () => ({ companies: [], activeCompanyId: 2, activeBranchId: 1, activeCompany: { role: "admin", segment: "Hamburgueria" }, setActiveCompany: vi.fn() }) };
        case "./OperatorSecurityGate": return { OperatorLockButton: pass };
        case "@/lib/routePreload": return test.registry;
        default: throw new Error(`Unexpected sidebar dependency ${specifier}`);
      }
    }, {});
    renderToString(React.createElement(Layout, null, React.createElement("p", null, "Current page")));
    expect(test.imports).toEqual([]);
    const destinations = captured.filter(props => props.onMouseEnter);
    expect(destinations.length).toBeGreaterThan(30);
    expect(destinations.every(props => props.onFocus && props.onPointerDown && props.onClick)).toBe(true);
    for (const label of ["Financeiro", "Contabilidade", "Análises", "Administração", "Salão", "Auditoria"]) {
      const group = captured.find(props => props.tooltip === label);
      expect(group).toBeDefined();
      expect(group?.onMouseEnter).toBeUndefined();
    }
    const produtos = captured.find(props => props.tooltip === "Produtos")!;
    produtos.onMouseEnter(); produtos.onFocus(); produtos.onPointerDown();
    await test.registry.preloadRoute("/produtos");
    expect(test.imports).toEqual(["../pages/Produtos"]);
    expect(navigation).not.toHaveBeenCalled();
    produtos.onClick();
    expect(navigation).toHaveBeenCalledWith("/produtos");
    expect(test.mounted).not.toHaveBeenCalled();
    const logout = captured.find(props => React.Children.toArray(props.children).some(child => React.isValidElement<{ children: string }>(child) && child.props.children === "Sair / trocar operador"));
    expect(logout).toBeDefined();
    expect(logout?.onMouseEnter).toBeUndefined();
  });
});

describe("KDS preloading — evaluate real pages/print service without running business effects", () => {
  it.each(["SalaoKDSCozinha", "SalaoKDSBar"])("%s import invokes no hooks, queries, timer, agent or printer", async name => {
    const forbidden = vi.fn(() => { throw new Error("Business effect during module import"); });
    const printSource = readFileSync(resolve(root, "client/src/lib/printService.ts"), "utf8");
    const printModule = new Function("exports", "fetch", "setTimeout", "setInterval", "window", `${compile(printSource)}\nreturn exports;`)({}, forbidden, forbidden, forbidden, { open: forbidden, print: forbidden });
    const pageSource = readFileSync(resolve(root, `client/src/pages/${name}.tsx`), "utf8");
    const evaluatePage = () => new Function("require", "exports", "setInterval", "window", `${compile(pageSource)}\nreturn exports;`)((specifier: string) => {
      if (specifier === "react") return { useState: forbidden, useEffect: forbidden, useRef: forbidden };
      if (specifier === "react/jsx-runtime") return jsxRuntime;
      if (specifier === "@/lib/printService") return printModule;
      if (specifier === "@/lib/trpc") return { trpc: new Proxy({}, { get: forbidden }) };
      if (specifier === "@/contexts/CompanyContext") return { useCompany: forbidden };
      if (specifier === "lucide-react") return new Proxy({}, { get: () => () => null });
      if (specifier === "sonner") return { toast: { error: forbidden } };
      return { default: forbidden, Button: forbidden, Badge: forbidden };
    }, {}, forbidden, { open: forbidden, print: forbidden });
    const test = harness(specifier => {
      expect(specifier).toBe(`../pages/${name}`);
      return evaluatePage();
    });
    await test.registry.preloadRoute(name.endsWith("Cozinha") ? "/salao/kds-cozinha" : "/salao/kds-bar");
    expect(test.imports).toEqual([`../pages/${name}`]);
    expect(forbidden).not.toHaveBeenCalled();
    expect(test.mounted).not.toHaveBeenCalled();
  });
});
