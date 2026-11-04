import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToPipeableStream, renderToString } from "react-dom/server";
import * as wouter from "wouter";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const source = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const app = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// Baseline captured from the original App: order, aliases, params and final fallback.
const originalRoutes: ReadonlyArray<readonly [string | null, string]> = [
  ["/", "Home"],
  ["/produtos", "Produtos"],
  ["/compras", "Compras"],
  ["/venda-interna", "VendaInterna"],
  ["/vendas", "Vendas"],
  ["/parceiros", "Parceiros"],
  ["/despesas", "Despesas"],
  ["/contas-receber", "ContasReceberNovo"],
  ["/contas-pagar", "ContasPagar"],
  ["/usuarios", "Usuarios"],
  ["/relatorios", "AnaliseFaturamento"],
  ["/analise-vendas", "AnáliseVendas"],
  ["/analise-delivery", "AnaliseDelivery"],
  ["/analise-canal", "AnaliseCanal"],
  ["/analise-despesas", "AnaliseDespesas"],
  ["/metas", "Metas"],
  ["/fechamento", "FechamentoMensalNovo"],
  ["/analise-estoque", "AnaliseEstoque"],
  ["/plano-contas", "PlanoContas"],
  ["/relatorios-contabeis", "RelatoriosContabeis"],
  ["/outras-receitas", "OutrasReceitas"],
  ["/contas-gerenciais", "ContasGerenciais"],
  ["/governanca-contabil", "GovernancaContabil"],
  ["/importar-vendas/ifood", "ImportadorIfood"],
  ["/importar-vendas", "ImportarVendas"],
  ["/importar-ifood", "ImportadorIfood"],
  ["/minha-conta", "MinhaConta"],
  ["/seguranca", "Seguranca"],
  ["/gerenciar-acessos", "GerenciarAcessos"],
  ["/categorias", "Categorias"],
  ["/canais-venda", "CanaisVenda"],
  ["/historico-precos", "HistoricoPrecos"],
  ["/log-alteracoes", "LogAlteracoes"],
  ["/auditoria-movimentacoes", "AuditoriaMovimentacoes"],
  ["/salao/mesas", "SalaoMesas"],
  ["/salao/comanda/:orderId", "SalaoComanda"],
  ["/salao/kds-cozinha", "SalaoKDSCozinha"],
  ["/salao/kds-bar", "SalaoKDSBar"],
  ["/salao/gorjeta", "SalaoGorjeta"],
  ["/salao/garcons", "SalaoGarcons"],
  ["/salao/fechamento-garcom", "SalaoFechamentoGarcom"],
  ["/salao/transferencia", "SalaoTransferencia"],
  ["/salao/impressoras", "Impressoras"],
  ["/salao/caixa", "SalaoCaixa"],
  ["/cardapio", "Cardapio"],
  ["/cardapio/stories", "CardapioStories"],
  ["/aviso-inauguracao", "AvisoInauguracao"],
  ["/analise-kds", "AnaliseKDS"],
  ["/fechamento-anual", "FechamentoAnual"],
  ["/ajustes-faturamento-historico", "AjustesFaturamentoHistorico"],
  ["/acesso-negado", "AccessDenied"],
  ["/404", "NotFound"],
  [null, "NotFound"],
];

function descendants(node: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node[] {
  const result: ts.Node[] = [];
  function visit(current: ts.Node) {
    if (predicate(current)) result.push(current);
    ts.forEachChild(current, visit);
  }
  visit(node);
  return result;
}

function functionNode(name: string): ts.FunctionDeclaration {
  const node = app.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  if (!node || !ts.isFunctionDeclaration(node)) throw new Error(`Missing function ${name}`);
  return node;
}

const lazyDeclarations = descendants(app, node => ts.isVariableDeclaration(node) && Boolean(node.initializer &&
  ts.isCallExpression(node.initializer) && node.initializer.expression.getText(app) === "lazy")) as ts.VariableDeclaration[];
const lazyNames = lazyDeclarations.map(node => node.name.getText(app));
const routedNames = [...new Set(originalRoutes.map(([, name]) => name))];
const moduleFor = (name: string) => name === "NotFound" ? "@/pages/NotFound"
  : `./pages/${name === "AnaliseFaturamento" ? "Relatorios" : name}`;

const compiledApp = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

type HarnessOptions = { released?: boolean; needsSelection?: boolean; companyLoading?: boolean; productionTerminal?: boolean };

/** Real React.lazy/Suspense and wouter, with only API/providers/pages replaced.
 * No login, database, browser or real page effects are invoked by these tests.
 */
function harness(options: HarnessOptions = {}) {
  const state = { released: true, needsSelection: false, companyLoading: false, productionTerminal: false, ...options };
  const loaded: string[] = [];
  const queries: Array<{ input: unknown; options: unknown }> = [];
  const pass = ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  const page = (name: string) => ({ __esModule: true, default: (props: { params?: { orderId?: string } }) =>
    React.createElement("div", { "data-page": name, "data-order-id": props.params?.orderId }, name) });
  const injectedRequire = (specifier: string): unknown => {
    if (specifier === "react") return React;
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    if (specifier === "wouter") return wouter;
    if (/^(?:\.\/|@\/)pages\//.test(specifier)) {
      const name = specifier.split("/").at(-1)!;
      if (name !== "SelectCompany") loaded.push(specifier);
      return page(name);
    }
    switch (specifier) {
      case "@/components/ui/sonner": return { Toaster: () => null };
      case "@/components/ui/tooltip": return { TooltipProvider: pass };
      case "./components/ErrorBoundary": return { __esModule: true, default: pass };
      case "./contexts/ThemeContext": return { ThemeProvider: pass };
      case "./contexts/CompanyContext": return { CompanyProvider: pass, useCompany: () => ({
        needsSelection: state.needsSelection, loading: state.companyLoading, switching: false, activeCompany: null,
      }) };
      case "./_core/hooks/useAuth": return { useAuth: () => ({ isAuthenticated: true, loading: false }) };
      case "@/lib/trpc": return { trpc: { operatorSecurity: { status: { useQuery: (input: unknown, queryOptions: unknown) => {
        queries.push({ input, options: queryOptions });
        return { data: { productionTerminal: state.productionTerminal ? { companyId: 2 } : null } };
      } } } } };
      case "./components/OperatorSecurityGate": return { __esModule: true, default: ({ children }: { children: React.ReactNode }) => {
        if (state.productionTerminal) return React.createElement("div", {
          hidden: !state.released, inert: !state.released, "aria-hidden": !state.released,
        }, children);
        return state.released ? React.createElement(React.Fragment, null, children)
          : React.createElement("section", { "data-security-gate": "closed" }, "Acesse o ABRWF");
      } };
      default: throw new Error(`Unexpected dependency ${specifier}`);
    }
  };
  const exports: { default?: React.ComponentType } = {};
  const getModule = new Function("require", "exports", `${compiledApp}\nreturn { App: exports.default, Router, pages: { ${lazyNames.join(", ")} } };`);
  const module = getModule(injectedRequire, exports) as {
    App: React.ComponentType; Router: React.ComponentType; pages: Record<string, React.LazyExoticComponent<React.ComponentType>>;
  };
  const element = (path: string) => React.createElement(wouter.Router, { ssrPath: path }, React.createElement(module.App));
  return { state, loaded, queries, module, element };
}

function renderResolved(element: React.ReactElement): Promise<string> {
  return new Promise((resolveHtml, reject) => {
    const destination = new PassThrough();
    let html = "";
    destination.on("data", chunk => { html += chunk.toString(); });
    destination.on("end", () => resolveHtml(html));
    destination.on("error", reject);
    const stream = renderToPipeableStream(element, {
      onAllReady: () => stream.pipe(destination),
      onError: reject,
    });
  });
}

describe("route loading — structural safety invariants", () => {
  it("preserves all 53 original routes, names, order, aliases and orderId", () => {
    const routes = descendants(functionNode("Router"), node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(app) === "Route") as ts.JsxSelfClosingElement[];
    const actual = routes.map(route => {
      const path = route.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(app) === "path") as ts.JsxAttribute | undefined;
      const component = route.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(app) === "component") as ts.JsxAttribute;
      return [path?.initializer && ts.isStringLiteral(path.initializer) ? path.initializer.text : null,
        component.initializer && ts.isJsxExpression(component.initializer) ? component.initializer.expression?.getText(app) : undefined];
    });
    expect(actual).toEqual(originalRoutes);
  });

  it("makes every routed page lazy at module scope, with literal per-page imports and valid default exports", () => {
    expect([...lazyNames].sort()).toEqual([...routedNames].sort());
    for (const declaration of lazyDeclarations) {
      expect(ts.isVariableDeclarationList(declaration.parent) && ts.isVariableStatement(declaration.parent.parent) && declaration.parent.parent.parent === app).toBe(true);
      expect((declaration.parent as ts.VariableDeclarationList).flags & ts.NodeFlags.Const).toBeTruthy();
      const initializer = declaration.initializer as ts.CallExpression;
      expect(initializer.arguments).toHaveLength(1);
      const loader = initializer.arguments[0];
      expect(ts.isArrowFunction(loader)).toBe(true);
      const body = (loader as ts.ArrowFunction).body as ts.CallExpression;
      expect(ts.isCallExpression(body) && body.expression.kind === ts.SyntaxKind.ImportKeyword).toBe(true);
      expect(body.arguments).toHaveLength(1);
      expect(ts.isStringLiteral(body.arguments[0])).toBe(true);
      const specifier = (body.arguments[0] as ts.StringLiteral).text;
      expect(specifier).toBe(moduleFor(declaration.name.getText(app)));
      const pagePath = resolve(root, specifier.replace(/^@\//, "client/src/").replace(/^\.\//, "client/src/") + ".tsx");
      const pageSource = ts.createSourceFile(pagePath, readFileSync(pagePath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      expect(pageSource.statements.some(statement => ts.isExportAssignment(statement) ||
        ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword))).toBe(true);
    }
  });

  it("keeps only SelectCompany as an eager page; the unused FechamentoMensal has no route/reference", () => {
    const eager = app.statements.filter(ts.isImportDeclaration).map(statement => (statement.moduleSpecifier as ts.StringLiteral).text);
    expect(eager.filter(specifier => /(?:^|\/)pages\//.test(specifier))).toEqual(["./pages/SelectCompany"]);
    expect(descendants(app, node => ts.isIdentifier(node) && node.text === "FechamentoMensal")).toHaveLength(0);
    expect(eager.some(specifier => /(?:recharts|xlsx|pdf)/i.test(specifier))).toBe(false);
  });

  it("confines the only Suspense to Router, with a lightweight accessible Portuguese fallback", () => {
    const boundaries = descendants(app, node => ts.isJsxElement(node) && node.openingElement.tagName.getText(app) === "Suspense") as ts.JsxElement[];
    expect(boundaries).toHaveLength(1);
    let owner: ts.Node | undefined = boundaries[0];
    while (owner && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
    expect(owner).toBe(functionNode("Router"));
    expect(boundaries[0].getText(app)).toContain('<Switch>');
    const fallback = boundaries[0].openingElement.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(app) === "fallback")!;
    expect(fallback.getText(app)).toContain('role="status"');
    expect(fallback.getText(app)).toContain('aria-live="polite"');
    expect(fallback.getText(app)).toContain('aria-busy="true"');
    expect(fallback.getText(app)).toContain("min-h-[12rem]");
    expect(fallback.getText(app)).toContain("Carregando tela...");
    expect(descendants(fallback, node => ts.isJsxElement(node) && /^[A-Z]/.test(node.openingElement.tagName.getText(app)))).toHaveLength(0);
  });

  it("preserves provider/security gate nesting and never puts Router/Suspense above release", () => {
    const tags = descendants(functionNode("App"), node => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      .map(node => (node as ts.JsxOpeningElement | ts.JsxSelfClosingElement).tagName.getText(app));
    expect(tags).toEqual(["ErrorBoundary", "ThemeProvider", "CompanyProvider", "TooltipProvider", "Toaster", "OperatorSecurityGate", "ProductionAwareCompanyGate"]);
    const production = functionNode("ProductionAwareCompanyGate").getText(app);
    expect(production).toContain("path === '/salao/kds-cozinha' || path === '/salao/kds-bar'");
    expect(production).toContain("useQuery(undefined, { enabled: kds, staleTime: 0 })");
    expect(production).toContain("if (kds && status.data?.productionTerminal) return <Router />;");
    expect(production).toContain("return <CompanyGate />;");
    const company = functionNode("CompanyGate").getText(app);
    expect(company).toContain("if (!isAuthenticated || authLoading)");
    expect(company.indexOf("if (companyLoading)")).toBeLessThan(company.indexOf("if (needsSelection)"));
    expect(company).toContain("return <SelectCompany />;");
    expect(company).toContain("{switching && (");
    expect(company).toContain("<Router />");
  });

  it("retains the hidden/inert paired KDS branch and avoids new keys/remount boundaries", () => {
    const gate = readFileSync(resolve(root, "client/src/components/OperatorSecurityGate.tsx"), "utf8");
    expect(gate).toContain("Boolean(productionTerminal) && isProductionStationPath(path)");
    expect(gate).toContain("hidden={!active} inert={!active} aria-hidden={!active}");
    expect(gate).toContain(": active ? <>{children}</> : null}");
    expect(gate).toContain('identityReady && authReady && state === "ACTIVE"');
    const keyed = descendants(app, node => ts.isJsxAttribute(node) && node.name.getText(app) === "key");
    expect(keyed).toHaveLength(0);
  });
});

describe("route loading — executable React.lazy + wouter behavior", () => {
  it.each(originalRoutes)("loads only the selected page at %s (%s), and caches its stable lazy identity", async (route, name) => {
    const test = harness();
    const path = route?.replace(":orderId", "731") ?? "/rota-que-nao-existe";
    const expectedPage = name === "AnaliseFaturamento" ? "Relatorios" : name;
    const identity = test.module.pages[name];
    expect(test.loaded).toEqual([]);
    const html = await renderResolved(test.element(path));
    expect(html).toContain(`data-page="${expectedPage}"`);
    if (name === "SalaoComanda") expect(html).toContain('data-order-id="731"');
    expect(test.loaded).toEqual([moduleFor(name)]);
    expect(test.module.pages[name]).toBe(identity);
    expect(await renderResolved(test.element(path))).toContain(`data-page="${expectedPage}"`);
    expect(test.loaded).toEqual([moduleFor(name)]);
  });

  it("shows the route fallback during the first unresolved import after guard release", async () => {
    const test = harness();
    const html = renderToString(test.element("/produtos"));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Carregando tela...");
    expect(html).not.toContain('data-page="Produtos"');
    expect(await renderResolved(test.element("/produtos"))).toContain('data-page="Produtos"');
    expect(test.loaded).toEqual(["./pages/Produtos"]);
  });

  it("imports no business page and shows no route fallback while operator release is closed", async () => {
    const test = harness({ released: false });
    const html = await renderResolved(test.element("/relatorios"));
    expect(html).toContain('data-security-gate="closed"');
    expect(html).not.toContain("Carregando tela...");
    expect(html).not.toContain("data-page");
    expect(test.loaded).toEqual([]);
    expect(test.queries).toEqual([]);
  });

  it("does not suspend or load routes during company selection/loading", async () => {
    for (const options of [{ needsSelection: true }, { companyLoading: true }]) {
      const test = harness(options);
      const html = await renderResolved(test.element("/vendas"));
      expect(test.loaded).toEqual([]);
      expect(html).not.toContain("Carregando tela...");
      expect(html).not.toContain('data-page="Vendas"');
      if (options.needsSelection) expect(html).toContain('data-page="SelectCompany"');
      else expect(html).toContain("Carregando...");
    }
  });

  it.each(["/salao/kds-cozinha", "/salao/kds-bar"])("loads paired %s while hidden and does not reload its module on operator release", async path => {
    const test = harness({ released: false, productionTerminal: true, needsSelection: true });
    const name = path.endsWith("cozinha") ? "SalaoKDSCozinha" : "SalaoKDSBar";
    const identity = test.module.pages[name];
    const html = await renderResolved(test.element(path));
    expect(html).toContain('hidden=""');
    expect(html).toContain('inert=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`data-page="${name}"`);
    expect(html).not.toContain('data-page="SelectCompany"');
    expect(test.queries.at(-1)).toEqual({ input: undefined, options: { enabled: true, staleTime: 0 } });
    test.state.released = true;
    expect(await renderResolved(test.element(path))).toContain(`data-page="${name}"`);
    expect(test.module.pages[name]).toBe(identity);
    expect(test.loaded).toEqual([moduleFor(name)]);
  });

  it("does not let production credentials bypass company selection on non-KDS pages", async () => {
    const test = harness({ productionTerminal: true, needsSelection: true });
    expect(await renderResolved(test.element("/vendas"))).toContain('data-page="SelectCompany"');
    expect(test.loaded).toEqual([]);
    expect(test.queries.at(-1)).toEqual({ input: undefined, options: { enabled: false, staleTime: 0 } });
  });
});
