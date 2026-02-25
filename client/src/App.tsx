import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "./pages/Home";
import Produtos from "./pages/Produtos";
import Vendas from "./pages/Vendas";
import Parceiros from "./pages/Parceiros";
import Compras from "./pages/Compras";
import Despesas from "./pages/Despesas";
import ContasReceberNovo from "./pages/ContasReceberNovo";
import ContasPagar from "./pages/ContasPagar";
import MinhaConta from "./pages/MinhaConta";
import Usuarios from "./pages/Usuarios";
import AnaliseFaturamento from "./pages/Relatorios";
import AnáliseVendas from "./pages/AnáliseVendas";
import AnaliseDelivery from "./pages/AnaliseDelivery";
import AnaliseCanal from "./pages/AnaliseCanal";
import AnaliseDespesas from "./pages/AnaliseDespesas";
import Metas from "./pages/Metas";
import FechamentoMensal from "./pages/FechamentoMensal";
import FechamentoMensalNovo from "./pages/FechamentoMensalNovo";
import PlanoContas from "./pages/PlanoContas";
import RelatoriosContabeis from "./pages/RelatoriosContabeis";
import OutrasReceitas from "./pages/OutrasReceitas";
import ContasGerenciais from "./pages/ContasGerenciais";
import GovernancaContabil from "./pages/GovernancaContabil";
import ImportadorIfood from "./pages/ImportadorIfood";
import AnaliseEstoque from "./pages/AnaliseEstoque";
import AccessDenied from "./pages/AccessDenied";
import GerenciarAcessos from "./pages/GerenciarAcessos";
import Categorias from "./pages/Categorias";
import CanaisVenda from "./pages/CanaisVenda";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CompanyProvider, useCompany } from "./contexts/CompanyContext";
import SelectCompany from "./pages/SelectCompany";
import { useAuth } from "./_core/hooks/useAuth";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/produtos" component={Produtos} />
      <Route path="/compras" component={Compras} />
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
      <Route path="/importar-ifood" component={ImportadorIfood} />
      <Route path="/minha-conta" component={MinhaConta} />
      <Route path="/gerenciar-acessos" component={GerenciarAcessos} />
      <Route path="/categorias" component={Categorias} />
      <Route path="/canais-venda" component={CanaisVenda} />
      <Route path="/acesso-negado" component={AccessDenied} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function CompanyGate() {
  const { needsSelection, loading: companyLoading, switching, activeCompany } = useCompany();
  const { isAuthenticated, loading: authLoading } = useAuth();

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

  return (
    <>
      {/* Overlay de troca de empresa — bloqueia interação e esconde dados antigos */}
      {switching && (
        <div className="fixed inset-0 z-[9999] bg-white/95 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-500">
          <div className="flex flex-col items-center gap-6">
            {activeCompany?.companyLogoUrl && (
              <img 
                src={activeCompany.companyLogoUrl} 
                alt="" 
                className="h-24 w-24 rounded-2xl object-contain shadow-lg animate-in zoom-in-75 duration-700" 
              />
            )}
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            <p className="text-slate-600 text-sm font-medium">
              Carregando {activeCompany?.companyName || 'empresa'}...
            </p>
          </div>
        </div>
      )}
      <Router />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <CompanyProvider>
          <TooltipProvider>
            <Toaster />
            <CompanyGate />
          </TooltipProvider>
        </CompanyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
