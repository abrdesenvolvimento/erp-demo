import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "./pages/Home";
import Produtos from "./pages/Produtos";
import Vendas from "./pages/Vendas";
import Parceiros from "./pages/Parceiros";
import Compras from "./pages/Compras";
import Despesas from "./pages/Despesas";
import ContasReceber from "./pages/ContasReceber";
import ContasPagar from "./pages/ContasPagar";
import MinhaConta from "./pages/MinhaConta";
import Usuarios from "./pages/Usuarios";
import AccessDenied from "./pages/AccessDenied";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/produtos" component={Produtos} />
      <Route path="/compras" component={Compras} />
      <Route path="/vendas" component={Vendas} />
      <Route path="/parceiros" component={Parceiros} />
      <Route path="/despesas" component={Despesas} />
      <Route path="/contas-receber" component={ContasReceber} />
      <Route path="/contas-pagar" component={ContasPagar} />
      <Route path="/usuarios" component={Usuarios} />
      <Route path="/minha-conta" component={MinhaConta} />
      <Route path="/acesso-negado" component={AccessDenied} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

