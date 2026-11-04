import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import OperatorSecurityGate from "./components/OperatorSecurityGate";
import { Route, Switch, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CompanyProvider, useCompany } from "./contexts/CompanyContext";
// A seleção permanece síncrona: é renderizada pelo CompanyGate, fora do Router.
import SelectCompany from "./pages/SelectCompany";
import { useAuth } from "./_core/hooks/useAuth";
import { lazy, Suspense, useState, useEffect } from "react";

// Identidades estáveis: nunca declarar lazy durante render (incluindo os KDS).
const NotFound = lazy(() => import("@/pages/NotFound"));
const Home = lazy(() => import("./pages/Home"));
const Produtos = lazy(() => import("./pages/Produtos"));
const Vendas = lazy(() => import("./pages/Vendas"));
const Parceiros = lazy(() => import("./pages/Parceiros"));
const Compras = lazy(() => import("./pages/Compras"));
const VendaInterna = lazy(() => import("./pages/VendaInterna"));
const Despesas = lazy(() => import("./pages/Despesas"));
const ContasReceberNovo = lazy(() => import("./pages/ContasReceberNovo"));
const ContasPagar = lazy(() => import("./pages/ContasPagar"));
const MinhaConta = lazy(() => import("./pages/MinhaConta"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const AnaliseFaturamento = lazy(() => import("./pages/Relatorios"));
const AnáliseVendas = lazy(() => import("./pages/AnáliseVendas"));
const AnaliseDelivery = lazy(() => import("./pages/AnaliseDelivery"));
const AnaliseCanal = lazy(() => import("./pages/AnaliseCanal"));
const AnaliseDespesas = lazy(() => import("./pages/AnaliseDespesas"));
const Metas = lazy(() => import("./pages/Metas"));
const FechamentoMensalNovo = lazy(() => import("./pages/FechamentoMensalNovo"));
const PlanoContas = lazy(() => import("./pages/PlanoContas"));
const RelatoriosContabeis = lazy(() => import("./pages/RelatoriosContabeis"));
const OutrasReceitas = lazy(() => import("./pages/OutrasReceitas"));
const ContasGerenciais = lazy(() => import("./pages/ContasGerenciais"));
const GovernancaContabil = lazy(() => import("./pages/GovernancaContabil"));
const ImportadorIfood = lazy(() => import("./pages/ImportadorIfood"));
const ImportarVendas = lazy(() => import("./pages/ImportarVendas"));
const AnaliseEstoque = lazy(() => import("./pages/AnaliseEstoque"));
const AccessDenied = lazy(() => import("./pages/AccessDenied"));
const GerenciarAcessos = lazy(() => import("./pages/GerenciarAcessos"));
const Categorias = lazy(() => import("./pages/Categorias"));
const CanaisVenda = lazy(() => import("./pages/CanaisVenda"));
const HistoricoPrecos = lazy(() => import("./pages/HistoricoPrecos"));
const LogAlteracoes = lazy(() => import("./pages/LogAlteracoes"));
const AuditoriaMovimentacoes = lazy(() => import("./pages/AuditoriaMovimentacoes"));
const SalaoMesas = lazy(() => import("./pages/SalaoMesas"));
const SalaoComanda = lazy(() => import("./pages/SalaoComanda"));
const SalaoKDSCozinha = lazy(() => import("./pages/SalaoKDSCozinha"));
const SalaoKDSBar = lazy(() => import("./pages/SalaoKDSBar"));
const SalaoGorjeta = lazy(() => import("./pages/SalaoGorjeta"));
const SalaoGarcons = lazy(() => import("./pages/SalaoGarcons"));
const SalaoFechamentoGarcom = lazy(() => import("./pages/SalaoFechamentoGarcom"));
const SalaoTransferencia = lazy(() => import("./pages/SalaoTransferencia"));
const Impressoras = lazy(() => import("./pages/Impressoras"));
const SalaoCaixa = lazy(() => import("./pages/SalaoCaixa"));
const Cardapio = lazy(() => import("./pages/Cardapio"));
const CardapioStories = lazy(() => import("./pages/CardapioStories"));
const AvisoInauguracao = lazy(() => import("./pages/AvisoInauguracao"));
const AnaliseKDS = lazy(() => import("./pages/AnaliseKDS"));
const FechamentoAnual = lazy(() => import("./pages/FechamentoAnual"));
const AjustesFaturamentoHistorico = lazy(() => import("./pages/AjustesFaturamentoHistorico"));
const Seguranca = lazy(() => import("./pages/Seguranca"));

function Router() {
  return (
    <Suspense fallback={
      <div role="status" aria-live="polite" aria-busy="true"
        className="min-h-[12rem] flex items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm">Carregando tela...</p>
      </div>
    }>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/produtos" component={Produtos} />
      <Route path="/compras" component={Compras} />
      <Route path="/venda-interna" component={VendaInterna} />
      <Route path="/vendas" component={Vendas} />
      <Route path="/parceiros" component={Parceiros} />
      <Route path="/despesas" component={Despesas} />
      <Route path="/contas-receber" component={ContasReceberNovo} />
      <Route path="/contas-pagar" component={ContasPagar} />
      <Route path="/usuarios" component={Usuarios} />
      <Route path="/relatorios" component={AnaliseFaturamento} />
      <Route path="/analise-vendas" component={AnáliseVendas} />
      <Route path="/analise-delivery" component={AnaliseDelivery} />
      <Route path="/analise-canal" component={AnaliseCanal} />
      <Route path="/analise-despesas" component={AnaliseDespesas} />
      <Route path="/metas" component={Metas} />
      <Route path="/fechamento" component={FechamentoMensalNovo} />
      <Route path="/analise-estoque" component={AnaliseEstoque} />
      <Route path="/plano-contas" component={PlanoContas} />
      <Route path="/relatorios-contabeis" component={RelatoriosContabeis} />
      <Route path="/outras-receitas" component={OutrasReceitas} />
      <Route path="/contas-gerenciais" component={ContasGerenciais} />
      <Route path="/governanca-contabil" component={GovernancaContabil} />
      <Route path="/importar-vendas/ifood" component={ImportadorIfood} />
      <Route path="/importar-vendas" component={ImportarVendas} />
      <Route path="/importar-ifood" component={ImportadorIfood} />
      <Route path="/minha-conta" component={MinhaConta} />
      <Route path="/seguranca" component={Seguranca} />
      <Route path="/gerenciar-acessos" component={GerenciarAcessos} />
      <Route path="/categorias" component={Categorias} />
      <Route path="/canais-venda" component={CanaisVenda} />
      <Route path="/historico-precos" component={HistoricoPrecos} />
      <Route path="/log-alteracoes" component={LogAlteracoes} />
      <Route path="/auditoria-movimentacoes" component={AuditoriaMovimentacoes} />
      <Route path="/salao/mesas" component={SalaoMesas} />
      <Route path="/salao/comanda/:orderId" component={SalaoComanda} />
      <Route path="/salao/kds-cozinha" component={SalaoKDSCozinha} />
      <Route path="/salao/kds-bar" component={SalaoKDSBar} />
      <Route path="/salao/gorjeta" component={SalaoGorjeta} />
      <Route path="/salao/garcons" component={SalaoGarcons} />
      <Route path="/salao/fechamento-garcom" component={SalaoFechamentoGarcom} />
      <Route path="/salao/transferencia" component={SalaoTransferencia} />
      <Route path="/salao/impressoras" component={Impressoras} />
      <Route path="/salao/caixa" component={SalaoCaixa} />
      <Route path="/cardapio" component={Cardapio} />
      <Route path="/cardapio/stories" component={CardapioStories} />
      <Route path="/aviso-inauguracao" component={AvisoInauguracao} />
      <Route path="/analise-kds" component={AnaliseKDS} />
      <Route path="/fechamento-anual" component={FechamentoAnual} />
      <Route path="/ajustes-faturamento-historico" component={AjustesFaturamentoHistorico} />
      <Route path="/acesso-negado" component={AccessDenied} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

// Mapa de cores para overlay de transição por empresa
const TRANSITION_THEMES: Record<number, {
  bgGradient: string;
  accentColor: string;
  textColor: string;
  textMuted: string;
  glowColor: string;
}> = {
  // Adega Beira Rio — Verde Lúpulo + Dourado
  1: {
    bgGradient: 'linear-gradient(135deg, #3d5a22 0%, #4a6b2a 30%, #5a7d35 60%, #3d5a22 100%)',
    accentColor: '#F0B840',
    textColor: '#F2F2F2',
    textMuted: 'rgba(242,242,242,0.7)',
    glowColor: 'rgba(240,184,64,0.3)',
  },
  // A Brasa Reúne — Grafite + Laranja
  2: {
    bgGradient: 'linear-gradient(135deg, #1f1f1f 0%, #2F2F2F 30%, #3a3a3a 60%, #1f1f1f 100%)',
    accentColor: '#F07A00',
    textColor: '#E5D3B3',
    textMuted: 'rgba(229,211,179,0.7)',
    glowColor: 'rgba(240,122,0,0.3)',
  },
};

const DEFAULT_TRANSITION_THEME = {
  bgGradient: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #f8f9fa 100%)',
  accentColor: '#F07A00',
  textColor: '#1C1C1C',
  textMuted: 'rgba(28,28,28,0.6)',
  glowColor: 'rgba(240,122,0,0.2)',
};

function CompanyGate() {
  const { needsSelection, loading: companyLoading, switching, activeCompany } = useCompany();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [progress, setProgress] = useState(0);

  // Animação da barra de progresso durante switching
  useEffect(() => {
    if (!switching) {
      setProgress(0);
      return;
    }
    // Progresso suave de 0 a 100 em 4s
    const startTime = Date.now();
    const duration = 4000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);
      // Ease-out para desacelerar no final
      const eased = 100 * (1 - Math.pow(1 - pct / 100, 3));
      setProgress(eased);
      if (pct >= 100) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [switching]);

  // Se não está autenticado ou ainda carregando auth, mostrar router normalmente
  if (!isAuthenticated || authLoading) {
    return <Router />;
  }

  // Se está autenticado mas ainda carregando empresas, mostrar loading em vez de flash da Home
  if (companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div>
          <p className="text-slate-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se autenticado, tem múltiplas empresas e nenhuma selecionada, mostrar tela de seleção
  if (needsSelection) {
    return <SelectCompany />;
  }

  const transTheme = activeCompany?.companyId
    ? (TRANSITION_THEMES[activeCompany.companyId] || DEFAULT_TRANSITION_THEME)
    : DEFAULT_TRANSITION_THEME;

  return (
    <>
      {/* Overlay premium de troca de empresa */}
      {switching && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            background: transTheme.bgGradient,
            animation: 'fadeIn 0.6s ease-out',
          }}
        >
          {/* Glow decorativo atrás do logo */}
          <div
            className="absolute rounded-full blur-3xl opacity-40"
            style={{
              width: '300px',
              height: '300px',
              background: `radial-gradient(circle, ${transTheme.glowColor} 0%, transparent 70%)`,
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />

          <div className="flex flex-col items-center gap-8 relative z-10">
            {/* Logo grande */}
            {activeCompany?.companyLogoUrl && (
              <div
                className="rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  animation: 'logoEntrance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                  border: `2px solid ${transTheme.accentColor}30`,
                }}
              >
                <img
                  src={activeCompany.companyLogoUrl}
                  alt=""
                  className="h-32 w-32 object-contain"
                  style={{ background: 'rgba(255,255,255,0.05)', filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.8)) drop-shadow(0 0 2px rgba(0,0,0,0.6)) drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }}
                />
              </div>
            )}

            {/* Nome da empresa */}
            <p
              className="text-lg font-semibold tracking-wide"
              style={{
                color: transTheme.textColor,
                animation: 'slideUp 0.6s ease-out 0.3s both',
              }}
            >
              {activeCompany?.companyName || 'Carregando...'}
            </p>

            {/* Barra de progresso temática */}
            <div className="w-64 flex flex-col items-center gap-3">
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{
                  background: `${transTheme.accentColor}20`,
                  animation: 'slideUp 0.6s ease-out 0.5s both',
                }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${transTheme.accentColor}80, ${transTheme.accentColor})`,
                    boxShadow: `0 0 12px ${transTheme.accentColor}60`,
                    transition: 'width 0.1s linear',
                  }}
                />
              </div>
              <p
                className="text-xs font-medium"
                style={{
                  color: transTheme.textMuted,
                  animation: 'slideUp 0.6s ease-out 0.7s both',
                }}
              >
                Preparando ambiente...
              </p>
            </div>
          </div>
        </div>
      )}
      <Router />

      {/* CSS animations para o overlay de transição */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes logoEntrance {
          0% { opacity: 0; transform: scale(0.5) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes slideUp {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
      `}</style>
    </>
  );
}

function ProductionAwareCompanyGate() {
  const [path] = useLocation();
  const kds = path === '/salao/kds-cozinha' || path === '/salao/kds-bar';
  const status = trpc.operatorSecurity.status.useQuery(undefined, { enabled: kds, staleTime: 0 });
  // Montagem estável para conservar os IDs já impressos e a opção autoPrint.
  // As queries têm credencial própria validada; mutações continuam exigindo operador ativo.
  if (kds && status.data?.productionTerminal) return <Router />;
  return <CompanyGate />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <CompanyProvider>
          <TooltipProvider>
            <Toaster />
            <OperatorSecurityGate><ProductionAwareCompanyGate /></OperatorSecurityGate>
          </TooltipProvider>
        </CompanyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
