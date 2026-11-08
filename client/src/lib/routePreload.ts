/** Share one module request between navigation intent and React.lazy.
 * A failed speculative request is evicted so opening the route can retry.
 * Importing this registry does not fetch or mount any page.
 */
export function memoizeRouteLoader<T>(load: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | undefined;
  return () => {
    if (!cached) {
      const request = Promise.resolve().then(load);
      cached = request;
      // Observe rejection without changing what React.lazy receives.
      void request.catch(() => {
        if (cached === request) cached = undefined;
      });
    }
    return cached;
  };
}

// Literal imports retain Vite's existing per-page code splitting.
export const routeLoaders = {
  NotFound: memoizeRouteLoader(() => import("../pages/NotFound")),
  Home: memoizeRouteLoader(() => import("../pages/Home")),
  Produtos: memoizeRouteLoader(() => import("../pages/Produtos")),
  Vendas: memoizeRouteLoader(() => import("../pages/Vendas")),
  Consumo: memoizeRouteLoader(() => import("../pages/Consumo")),
  Parceiros: memoizeRouteLoader(() => import("../pages/Parceiros")),
  Compras: memoizeRouteLoader(() => import("../pages/Compras")),
  VendaInterna: memoizeRouteLoader(() => import("../pages/VendaInterna")),
  Despesas: memoizeRouteLoader(() => import("../pages/Despesas")),
  ContasReceberNovo: memoizeRouteLoader(() => import("../pages/ContasReceberNovo")),
  ContasPagar: memoizeRouteLoader(() => import("../pages/ContasPagar")),
  MinhaConta: memoizeRouteLoader(() => import("../pages/MinhaConta")),
  Usuarios: memoizeRouteLoader(() => import("../pages/Usuarios")),
  AnaliseFaturamento: memoizeRouteLoader(() => import("../pages/Relatorios")),
  AnáliseVendas: memoizeRouteLoader(() => import("../pages/AnáliseVendas")),
  AnaliseDelivery: memoizeRouteLoader(() => import("../pages/AnaliseDelivery")),
  AnaliseCanal: memoizeRouteLoader(() => import("../pages/AnaliseCanal")),
  AnaliseDespesas: memoizeRouteLoader(() => import("../pages/AnaliseDespesas")),
  Metas: memoizeRouteLoader(() => import("../pages/Metas")),
  FechamentoMensalNovo: memoizeRouteLoader(() => import("../pages/FechamentoMensalNovo")),
  PlanoContas: memoizeRouteLoader(() => import("../pages/PlanoContas")),
  RelatoriosContabeis: memoizeRouteLoader(() => import("../pages/RelatoriosContabeis")),
  OutrasReceitas: memoizeRouteLoader(() => import("../pages/OutrasReceitas")),
  ContasGerenciais: memoizeRouteLoader(() => import("../pages/ContasGerenciais")),
  GovernancaContabil: memoizeRouteLoader(() => import("../pages/GovernancaContabil")),
  ImportadorIfood: memoizeRouteLoader(() => import("../pages/ImportadorIfood")),
  ImportarVendas: memoizeRouteLoader(() => import("../pages/ImportarVendas")),
  AnaliseEstoque: memoizeRouteLoader(() => import("../pages/AnaliseEstoque")),
  AccessDenied: memoizeRouteLoader(() => import("../pages/AccessDenied")),
  GerenciarAcessos: memoizeRouteLoader(() => import("../pages/GerenciarAcessos")),
  Categorias: memoizeRouteLoader(() => import("../pages/Categorias")),
  CanaisVenda: memoizeRouteLoader(() => import("../pages/CanaisVenda")),
  HistoricoPrecos: memoizeRouteLoader(() => import("../pages/HistoricoPrecos")),
  LogAlteracoes: memoizeRouteLoader(() => import("../pages/LogAlteracoes")),
  AuditoriaMovimentacoes: memoizeRouteLoader(() => import("../pages/AuditoriaMovimentacoes")),
  SalaoMesas: memoizeRouteLoader(() => import("../pages/SalaoMesas")),
  SalaoComanda: memoizeRouteLoader(() => import("../pages/SalaoComanda")),
  SalaoKDSCozinha: memoizeRouteLoader(() => import("../pages/SalaoKDSCozinha")),
  SalaoKDSBar: memoizeRouteLoader(() => import("../pages/SalaoKDSBar")),
  SalaoGorjeta: memoizeRouteLoader(() => import("../pages/SalaoGorjeta")),
  SalaoGarcons: memoizeRouteLoader(() => import("../pages/SalaoGarcons")),
  SalaoFechamentoGarcom: memoizeRouteLoader(() => import("../pages/SalaoFechamentoGarcom")),
  SalaoTransferencia: memoizeRouteLoader(() => import("../pages/SalaoTransferencia")),
  Impressoras: memoizeRouteLoader(() => import("../pages/Impressoras")),
  SalaoCaixa: memoizeRouteLoader(() => import("../pages/SalaoCaixa")),
  Cardapio: memoizeRouteLoader(() => import("../pages/Cardapio")),
  CardapioStories: memoizeRouteLoader(() => import("../pages/CardapioStories")),
  AvisoInauguracao: memoizeRouteLoader(() => import("../pages/AvisoInauguracao")),
  AnaliseKDS: memoizeRouteLoader(() => import("../pages/AnaliseKDS")),
  FechamentoAnual: memoizeRouteLoader(() => import("../pages/FechamentoAnual")),
  AjustesFaturamentoHistorico: memoizeRouteLoader(() => import("../pages/AjustesFaturamentoHistorico")),
  Seguranca: memoizeRouteLoader(() => import("../pages/Seguranca")),
};

// Explicit target lookup: never preload every dashboard route or unknown URLs.
const routeTargets: Record<string, keyof typeof routeLoaders> = {
  "/": "Home",
  "/produtos": "Produtos",
  "/compras": "Compras",
  "/venda-interna": "VendaInterna",
  "/vendas": "Vendas",
  "/consumo": "Consumo",
  "/parceiros": "Parceiros",
  "/despesas": "Despesas",
  "/contas-receber": "ContasReceberNovo",
  "/contas-pagar": "ContasPagar",
  "/usuarios": "Usuarios",
  "/relatorios": "AnaliseFaturamento",
  "/analise-vendas": "AnáliseVendas",
  "/analise-delivery": "AnaliseDelivery",
  "/analise-canal": "AnaliseCanal",
  "/analise-despesas": "AnaliseDespesas",
  "/metas": "Metas",
  "/fechamento": "FechamentoMensalNovo",
  "/analise-estoque": "AnaliseEstoque",
  "/plano-contas": "PlanoContas",
  "/relatorios-contabeis": "RelatoriosContabeis",
  "/outras-receitas": "OutrasReceitas",
  "/contas-gerenciais": "ContasGerenciais",
  "/governanca-contabil": "GovernancaContabil",
  "/importar-vendas/ifood": "ImportadorIfood",
  "/importar-vendas": "ImportarVendas",
  "/importar-ifood": "ImportadorIfood",
  "/minha-conta": "MinhaConta",
  "/seguranca": "Seguranca",
  "/gerenciar-acessos": "GerenciarAcessos",
  "/categorias": "Categorias",
  "/canais-venda": "CanaisVenda",
  "/historico-precos": "HistoricoPrecos",
  "/log-alteracoes": "LogAlteracoes",
  "/auditoria-movimentacoes": "AuditoriaMovimentacoes",
  "/salao/mesas": "SalaoMesas",
  "/salao/kds-cozinha": "SalaoKDSCozinha",
  "/salao/kds-bar": "SalaoKDSBar",
  "/salao/gorjeta": "SalaoGorjeta",
  "/salao/garcons": "SalaoGarcons",
  "/salao/fechamento-garcom": "SalaoFechamentoGarcom",
  "/salao/transferencia": "SalaoTransferencia",
  "/salao/impressoras": "Impressoras",
  "/salao/caixa": "SalaoCaixa",
  "/cardapio": "Cardapio",
  "/cardapio/stories": "CardapioStories",
  "/aviso-inauguracao": "AvisoInauguracao",
  "/analise-kds": "AnaliseKDS",
  "/fechamento-anual": "FechamentoAnual",
  "/ajustes-faturamento-historico": "AjustesFaturamentoHistorico",
  "/acesso-negado": "AccessDenied",
  "/404": "NotFound",
};

export async function preloadRoute(href: string): Promise<void> {
  const path = href.split(/[?#]/, 1)[0];
  const target = Object.hasOwn(routeTargets, path) ? routeTargets[path]
    : /^\/salao\/comanda\/[^/]+$/.test(path) ? "SalaoComanda" : undefined;
  if (!target) return;
  try {
    await routeLoaders[target]();
  } catch {
    // Speculation must not interrupt navigation or cause unhandled rejections.
    // The shared loader already evicted this failure for the next attempt.
  }
}

/** Only attach to a visible navigation target, never to a menu-group trigger. */
export function routePreloadIntent(path: string) {
  const preload = () => { void preloadRoute(path); };
  return { onMouseEnter: preload, onFocus: preload, onPointerDown: preload };
}
