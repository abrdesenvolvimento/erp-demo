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
      <Route path="/acesso-negado" component={AccessDenied} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function CompanyGate() {
  const { needsSelection, loading: companyLoading } = useCompany();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Se ainda está carregando auth ou empresas, mostrar o router normalmente (cada página tem seu loading)
  if (authLoading || companyLoading) {
    return <Router />;
  }

  // Se autenticado e precisa selecionar empresa, mostrar tela de seleção
  if (isAuthenticated && needsSelection) {
    return <SelectCompany />;
  }

  return <Router />;
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
