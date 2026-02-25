import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { LayoutDashboard, LogOut, PanelLeft, Users, Package, ShoppingCart, BarChart3, ShoppingBag, Receipt, DollarSign, CreditCard, UserCircle, Shield, TrendingUp, Bike, ChevronDown, ChevronRight, PieChart, GitCompare, Wallet, Target, FileText, BookOpen, Calculator, Upload, Building2, MapPin, Check, Tags, Store } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { useCompany } from "@/contexts/CompanyContext";

// Paleta de cores por empresa — sidebar muda conforme empresa ativa
const COMPANY_THEMES: Record<number, {
  sidebarBg: string;
  sidebarBgGradient: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  activeItemBg: string;
  borderColor: string;
  separatorColor: string;
}> = {
  // Adega Beira Rio — Verde Lúpulo + Dourado Trigo
  1: {
    sidebarBg: '#4a6b2a',
    sidebarBgGradient: 'linear-gradient(180deg, #5a7d35 0%, #3d5a22 100%)',
    textPrimary: '#F2F2F2',
    textMuted: 'rgba(242,242,242,0.65)',
    accent: '#F0B840',
    accentHover: 'rgba(240,184,64,0.15)',
    activeItemBg: 'rgba(240,184,64,0.20)',
    borderColor: 'rgba(240,184,64,0.25)',
    separatorColor: 'rgba(242,242,242,0.15)',
  },
  // A Brasa Reúne — Grafite + Laranja Brasa
  2: {
    sidebarBg: '#2F2F2F',
    sidebarBgGradient: 'linear-gradient(180deg, #3a3a3a 0%, #1f1f1f 100%)',
    textPrimary: '#E5D3B3',
    textMuted: 'rgba(229,211,179,0.60)',
    accent: '#F07A00',
    accentHover: 'rgba(240,122,0,0.15)',
    activeItemBg: 'rgba(240,122,0,0.20)',
    borderColor: 'rgba(240,122,0,0.25)',
    separatorColor: 'rgba(229,211,179,0.15)',
  },
};

// Tema padrão (teal original) quando nenhuma empresa está selecionada
const DEFAULT_THEME = {
  sidebarBg: '',
  sidebarBgGradient: '',
  textPrimary: '',
  textMuted: '',
  accent: '',
  accentHover: '',
  activeItemBg: '',
  borderColor: '',
  separatorColor: '',
};

// Menu items principais (sem submenu)
const mainMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", roles: ["admin", "operacional", "consultor"] },
  { icon: Package, label: "Produtos", path: "/produtos", roles: ["admin", "operacional", "consultor"] },
  { icon: Tags, label: "Categorias", path: "/categorias", roles: ["admin"] },
  { icon: ShoppingCart, label: "Vendas", path: "/vendas", roles: ["admin", "operacional", "consultor"] },
  { icon: Upload, label: "Importar iFood", path: "/importar-ifood", roles: ["admin"] },
  { icon: Users, label: "Parceiros", path: "/parceiros", roles: ["admin", "operacional", "consultor"] },
  { icon: Shield, label: "Gerenciar Usuários", path: "/usuarios", roles: ["admin"] },
  { icon: Building2, label: "Gerenciar Acessos", path: "/gerenciar-acessos", roles: ["admin"] },
  { icon: Store, label: "Canais de Venda", path: "/canais-venda", roles: ["admin"] },
];

// Submenu Financeiro
const financeMenuItems = [
  { icon: ShoppingBag, label: "Compras", path: "/compras", roles: ["admin", "consultor"] },
  { icon: Receipt, label: "Despesas", path: "/despesas", roles: ["admin", "consultor"] },
  { icon: Wallet, label: "Outras Receitas", path: "/outras-receitas", roles: ["admin", "consultor"] },
  { icon: DollarSign, label: "Contas a Receber", path: "/contas-receber", roles: ["admin", "operacional", "consultor"] },
  { icon: CreditCard, label: "Contas a Pagar", path: "/contas-pagar", roles: ["admin", "consultor"] },
];

// Submenu de Contabilidade
const accountingMenuItems = [
  { icon: BookOpen, label: "Plano de Contas", path: "/plano-contas", roles: ["admin", "consultor"] },
  { icon: Calculator, label: "Contas Gerenciais", path: "/contas-gerenciais", roles: ["admin", "consultor"] },
  { icon: FileText, label: "Relatórios Contábeis", path: "/relatorios-contabeis", roles: ["admin", "consultor"] },
  { icon: Shield, label: "Governança Contábil", path: "/governanca-contabil", roles: ["admin"] },
];

// Submenu de Análises
const analysisMenuItems = [
  { icon: TrendingUp, label: "Análise de Vendas", path: "/analise-vendas", roles: ["admin"] },
  { icon: BarChart3, label: "Análise de Faturamento", path: "/relatorios", roles: ["admin", "consultor"] },
  { icon: Bike, label: "Análise Delivery", path: "/analise-delivery", roles: ["admin"] },
  { icon: GitCompare, label: "Análise por Canal", path: "/analise-canal", roles: ["admin"] },
  { icon: Receipt, label: "Análise de Despesas", path: "/analise-despesas", roles: ["admin"] },
  { icon: Package, label: "Análise de Estoque", path: "/analise-estoque", roles: ["admin"] },
  { icon: Target, label: "Metas", path: "/metas", roles: ["admin", "consultor"] },
  { icon: FileText, label: "Fechamento", path: "/fechamento", roles: ["admin", "consultor"] },
];

const getMenuItemsForRole = (items: typeof mainMenuItems, role?: string) => {
  if (!role) return [];
  return items.filter(item => item.roles.includes(role));
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const ANALYSIS_SUBMENU_KEY = "analysis-submenu-expanded";
const FINANCE_SUBMENU_KEY = "finance-submenu-expanded";
const ACCOUNTING_SUBMENU_KEY = "accounting-submenu-expanded";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ativa atalhos de teclado globais
  useKeyboardShortcuts();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <div className="relative group">
              <div className="relative">
                <img
                  src={APP_LOGO}
                  alt={APP_TITLE}
                  className="h-20 w-20 rounded-xl object-cover shadow"
                />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">{APP_TITLE}</h1>
              <p className="text-sm text-muted-foreground">
                Please sign in to continue
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { companies: userCompanies, activeCompanyId, activeBranchId, activeCompany, setActiveCompany } = useCompany();
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const isCollapsed = state === "collapsed";
  
  // Tema dinâmico por empresa
  const companyTheme = activeCompanyId ? (COMPANY_THEMES[activeCompanyId] || DEFAULT_THEME) : DEFAULT_THEME;
  const hasCustomTheme = !!companyTheme.sidebarBg;
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Aplica CSS variables do tema no :root para que mobile sheet e todos bg-sidebar herdem
  useEffect(() => {
    const root = document.documentElement;
    if (hasCustomTheme) {
      root.style.setProperty('--sidebar', companyTheme.sidebarBg);
      root.style.setProperty('--sidebar-foreground', companyTheme.textPrimary);
      root.style.setProperty('--sidebar-accent', companyTheme.activeItemBg);
      root.style.setProperty('--sidebar-accent-foreground', companyTheme.textPrimary);
      root.style.setProperty('--sidebar-primary', companyTheme.accent);
      root.style.setProperty('--sidebar-primary-foreground', companyTheme.textPrimary);
      root.style.setProperty('--sidebar-border', companyTheme.separatorColor);
    } else {
      // Limpa para usar fallback do CSS
      root.style.removeProperty('--sidebar');
      root.style.removeProperty('--sidebar-foreground');
      root.style.removeProperty('--sidebar-accent');
      root.style.removeProperty('--sidebar-accent-foreground');
      root.style.removeProperty('--sidebar-primary');
      root.style.removeProperty('--sidebar-primary-foreground');
      root.style.removeProperty('--sidebar-border');
    }
    return () => {
      root.style.removeProperty('--sidebar');
      root.style.removeProperty('--sidebar-foreground');
      root.style.removeProperty('--sidebar-accent');
      root.style.removeProperty('--sidebar-accent-foreground');
      root.style.removeProperty('--sidebar-primary');
      root.style.removeProperty('--sidebar-primary-foreground');
      root.style.removeProperty('--sidebar-border');
    };
  }, [hasCustomTheme, companyTheme]);
  
  // Estado do submenu de análises
  const [analysisExpanded, setAnalysisExpanded] = useState(() => {
    const saved = localStorage.getItem(ANALYSIS_SUBMENU_KEY);
    return saved === 'true';
  });
  
  // Estado do submenu financeiro
  const [financeExpanded, setFinanceExpanded] = useState(() => {
    const saved = localStorage.getItem(FINANCE_SUBMENU_KEY);
    return saved === 'true';
  });
  
  // Estado do submenu de contabilidade
  const [accountingExpanded, setAccountingExpanded] = useState(() => {
    const saved = localStorage.getItem(ACCOUNTING_SUBMENU_KEY);
    return saved === 'true';
  });
  
  // Filtra itens por role
  const filteredMainItems = getMenuItemsForRole(mainMenuItems, user?.role);
  const filteredAnalysisItems = getMenuItemsForRole(analysisMenuItems, user?.role);
  const filteredFinanceItems = getMenuItemsForRole(financeMenuItems, user?.role);
  const filteredAccountingItems = getMenuItemsForRole(accountingMenuItems, user?.role);
  
  // Verifica se algum item de análise está ativo
  const isAnalysisActive = filteredAnalysisItems.some(item => item.path === location);
  
  // Verifica se algum item financeiro está ativo
  const isFinanceActive = filteredFinanceItems.some(item => item.path === location);
  
  // Verifica se algum item de contabilidade está ativo
  const isAccountingActive = filteredAccountingItems.some(item => item.path === location);
  
  // Encontra o item ativo atual
  const allItems = [...filteredMainItems, ...filteredAnalysisItems, ...filteredFinanceItems, ...filteredAccountingItems];
  const activeMenuItem = allItems.find(item => item.path === location);
  
  const isMobile = useIsMobile();

  // Salva estado do submenu no localStorage
  useEffect(() => {
    localStorage.setItem(ANALYSIS_SUBMENU_KEY, analysisExpanded.toString());
  }, [analysisExpanded]);
  
  useEffect(() => {
    localStorage.setItem(FINANCE_SUBMENU_KEY, financeExpanded.toString());
  }, [financeExpanded]);
  
  useEffect(() => {
    localStorage.setItem(ACCOUNTING_SUBMENU_KEY, accountingExpanded.toString());
  }, [accountingExpanded]);

  // Expande automaticamente o submenu se um item de análise estiver ativo
  useEffect(() => {
    if (isAnalysisActive && !analysisExpanded) {
      setAnalysisExpanded(true);
    }
  }, [isAnalysisActive]);
  
  // Expande automaticamente o submenu se um item financeiro estiver ativo
  useEffect(() => {
    if (isFinanceActive && !financeExpanded) {
      setFinanceExpanded(true);
    }
  }, [isFinanceActive]);
  
  // Expande automaticamente o submenu se um item de contabilidade estiver ativo
  useEffect(() => {
    if (isAccountingActive && !accountingExpanded) {
      setAccountingExpanded(true);
    }
  }, [isAccountingActive]);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  // Filtra itens restritos para não-admins
  const getFilteredItems = (items: typeof mainMenuItems) => {
    return items.filter(item => {
      if (user?.role !== 'admin') {
        const restrictedPaths = [
          '/compras',
          '/despesas', 
          '/contas-pagar',
          '/usuarios',
        ];
        return !restrictedPaths.includes(item.path);
      }
      return true;
    });
  };

  const visibleMainItems = getFilteredItems(filteredMainItems);
  const visibleAnalysisItems = filteredAnalysisItems.filter(item => {
    if (user?.role !== 'admin') {
      // Consultor pode ver Análise de Faturamento e Fechamento (sem Metas)
      return item.path === '/relatorios' || item.path === '/fechamento';
    }
    return true;
  });
  
  // Filtra itens financeiros por role
  const visibleFinanceItems = filteredFinanceItems.filter(item => {
    if (user?.role === 'operacional') {
      // Operacional só pode ver Contas a Receber
      return item.path === '/contas-receber';
    }
    if (user?.role === 'consultor') {
      // Consultor pode ver Compras e Despesas (somente visualização)
      // Ocultar Contas a Receber e Contas a Pagar
      return item.path === '/compras' || item.path === '/despesas';
    }
    return true;
  });
  
  // Filtra itens de contabilidade por role
  const visibleAccountingItems = filteredAccountingItems.filter(item => {
    // Admin e Consultor podem ver todos os itens de contabilidade
    if (user?.role === 'admin' || user?.role === 'consultor') {
      return true;
    }
    return false;
  });

  return (
    <>
      <div className="relative z-50" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
          style={hasCustomTheme ? {
            background: companyTheme.sidebarBgGradient,
            color: companyTheme.textPrimary,
            '--sidebar': 'transparent',
            '--sidebar-accent': companyTheme.activeItemBg,
            '--sidebar-accent-foreground': companyTheme.textPrimary,
            '--sidebar-primary': companyTheme.accent,
            '--sidebar-primary-foreground': companyTheme.textPrimary,
            '--sidebar-foreground': companyTheme.textPrimary,
            '--sidebar-muted-foreground': companyTheme.textMuted,
            '--sidebar-border': companyTheme.separatorColor,
            transition: 'background 5s ease, color 2.5s ease',
          } as CSSProperties : undefined}
        >
          <SidebarHeader className="justify-center">
            {/* Logo do Sistema ABRWF — identidade fixa */}
            <div className="flex items-center gap-3 pl-2 group-data-[collapsible=icon]:px-0 transition-all w-full h-14">
              {isCollapsed ? (
                <div className="relative h-10 w-10 shrink-0 group">
                  <img
                    src={APP_LOGO}
                    className="h-10 w-10 rounded-md object-contain"
                    alt={APP_TITLE}
                    style={hasCustomTheme ? { backgroundColor: 'rgba(255,255,255,0.9)', padding: '2px' } : undefined}
                  />
                  <button
                    onClick={toggleSidebar}
                    className="absolute inset-0 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={hasCustomTheme ? { backgroundColor: companyTheme.activeItemBg } : { backgroundColor: 'var(--accent)' }}
                  >
                    <PanelLeft className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={APP_LOGO}
                      className="h-10 w-auto max-w-[40px] rounded-md object-contain shrink-0"
                      alt={APP_TITLE}
                      style={hasCustomTheme ? { backgroundColor: 'rgba(255,255,255,0.9)', padding: '2px' } : undefined}
                    />
                    <span className="font-bold tracking-tight text-base">
                      {APP_TITLE}
                    </span>
                  </div>
                  <button
                    onClick={toggleSidebar}
                    className="ml-auto h-8 w-8 flex items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                    style={hasCustomTheme ? { color: companyTheme.textMuted } : undefined}
                  >
                    <PanelLeft className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </SidebarHeader>

          {/* Empresa Ativa — seletor com logo e dados */}
          {!isCollapsed && userCompanies.length > 0 && (
            <div className="px-3 pb-3">
              <p className="text-[10px] uppercase tracking-wider font-medium mb-1.5 px-1" style={hasCustomTheme ? { color: companyTheme.textMuted } : { color: 'var(--muted-foreground)' }}>Empresa Ativa</p>
              <DropdownMenu open={companyMenuOpen} onOpenChange={setCompanyMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 w-full rounded-lg border px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={hasCustomTheme ? { borderColor: companyTheme.borderColor, backgroundColor: companyTheme.accentHover } : { borderColor: 'var(--primary-20)', backgroundColor: 'var(--primary-5)' }}>
                    {activeCompany?.companyLogoUrl ? (
                      <img src={activeCompany.companyLogoUrl} alt="" className="h-14 w-14 rounded-lg object-contain shrink-0" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }} />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate leading-tight">
                        {activeCompany?.companyName || activeCompany?.companyLegalName || 'Selecionar Empresa'}
                      </p>
                      {activeCompany?.branchName && (
                        <p className="text-[10px] truncate mt-0.5 flex items-center gap-1" style={hasCustomTheme ? { color: companyTheme.textMuted } : { color: 'var(--muted-foreground)' }}>
                          <MapPin className="h-2.5 w-2.5" />
                          {activeCompany.branchName}
                        </p>
                      )}
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" style={hasCustomTheme ? { color: companyTheme.textMuted } : undefined} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {userCompanies.map((uc) => {
                    const isActive = uc.companyId === activeCompanyId && uc.branchId === activeBranchId;
                    return (
                      <DropdownMenuItem
                        key={`${uc.companyId}-${uc.branchId}`}
                        onClick={() => {
                          setActiveCompany(uc.companyId, uc.branchId || 0);
                          setCompanyMenuOpen(false);
                        }}
                        className={`cursor-pointer flex items-center gap-2 ${isActive ? 'bg-accent' : ''}`}
                      >
                        {uc.companyLogoUrl ? (
                          <img src={uc.companyLogoUrl} alt="" className="h-6 w-6 rounded-md object-cover shrink-0" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }} />
                        ) : (
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {uc.companyName || uc.companyLegalName}
                          </p>
                          {uc.branchName && (
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5" />
                              {uc.branchName}
                              {uc.segment && (
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full ml-1">{uc.segment}</span>
                              )}
                            </p>
                          )}
                        </div>
                        {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {/* Menu principal */}
              {visibleMainItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Submenu Financeiro */}
              {visibleFinanceItems.length > 0 && (
                <>
                  {/* Separador visual */}
                  <div className="my-2 mx-2 border-t" style={hasCustomTheme ? { borderColor: companyTheme.separatorColor } : { borderColor: 'var(--border)' }} />
                  
                  {/* Cabeçalho do submenu */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setFinanceExpanded(!financeExpanded)}
                      tooltip="Financeiro"
                      className={`h-10 transition-all font-medium ${isFinanceActive ? "bg-accent text-accent-foreground" : ""}`}
                    >
                      <Wallet className={`h-4 w-4 ${isFinanceActive ? "text-primary" : ""}`} />
                      <span className="flex-1">Financeiro</span>
                      {!isCollapsed && (
                        financeExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* Itens do submenu */}
                  {financeExpanded && !isCollapsed && (
                    <div className="ml-4 border-l pl-2" style={hasCustomTheme ? { borderColor: companyTheme.separatorColor } : { borderColor: 'var(--border)' }}>
                      {visibleFinanceItems.map(item => {
                        const isActive = location === item.path;
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => setLocation(item.path)}
                              tooltip={item.label}
                              className={`h-9 transition-all font-normal text-sm`}
                            >
                              <item.icon
                                className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                              />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </div>
                  )}

                  {/* Quando colapsado, mostra itens como tooltip */}
                  {isCollapsed && visibleFinanceItems.map(item => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-10 transition-all font-normal`}
                        >
                          <item.icon
                            className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                          />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </>
              )}

              {/* Submenu de Contabilidade */}
              {visibleAccountingItems.length > 0 && (
                <>
                  {/* Separador visual */}
                  <div className="my-2 mx-2 border-t" style={hasCustomTheme ? { borderColor: companyTheme.separatorColor } : { borderColor: 'var(--border)' }} />
                  
                  {/* Cabeçalho do submenu */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setAccountingExpanded(!accountingExpanded)}
                      tooltip="Contabilidade"
                      className={`h-10 transition-all font-medium ${isAccountingActive ? "bg-accent text-accent-foreground" : ""}`}
                    >
                      <Calculator className={`h-4 w-4 ${isAccountingActive ? "text-primary" : ""}`} />
                      <span className="flex-1">Contabilidade</span>
                      {!isCollapsed && (
                        accountingExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* Itens do submenu */}
                  {accountingExpanded && !isCollapsed && (
                    <div className="ml-4 border-l pl-2" style={hasCustomTheme ? { borderColor: companyTheme.separatorColor } : { borderColor: 'var(--border)' }}>
                      {visibleAccountingItems.map(item => {
                        const isActive = location === item.path;
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => setLocation(item.path)}
                              tooltip={item.label}
                              className={`h-9 transition-all font-normal text-sm`}
                            >
                              <item.icon
                                className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                              />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </div>
                  )}

                  {/* Quando colapsado, mostra itens como tooltip */}
                  {isCollapsed && visibleAccountingItems.map(item => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-10 transition-all font-normal`}
                        >
                          <item.icon
                            className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                          />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </>
              )}

              {/* Submenu de Análises */}
              {visibleAnalysisItems.length > 0 && (
                <>
                  {/* Separador visual */}
                  <div className="my-2 mx-2 border-t" style={hasCustomTheme ? { borderColor: companyTheme.separatorColor } : { borderColor: 'var(--border)' }} />
                  
                  {/* Cabeçalho do submenu */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setAnalysisExpanded(!analysisExpanded)}
                      tooltip="Análises"
                      className={`h-10 transition-all font-medium ${isAnalysisActive ? "bg-accent text-accent-foreground" : ""}`}
                    >
                      <PieChart className={`h-4 w-4 ${isAnalysisActive ? "text-primary" : ""}`} />
                      <span className="flex-1">Análises</span>
                      {!isCollapsed && (
                        analysisExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* Itens do submenu */}
                  {analysisExpanded && !isCollapsed && (
                    <div className="ml-4 border-l pl-2" style={hasCustomTheme ? { borderColor: companyTheme.separatorColor } : { borderColor: 'var(--border)' }}>
                      {visibleAnalysisItems.map(item => {
                        const isActive = location === item.path;
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => setLocation(item.path)}
                              tooltip={item.label}
                              className={`h-9 transition-all font-normal text-sm`}
                            >
                              <item.icon
                                className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                              />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </div>
                  )}

                  {/* Quando colapsado, mostra itens como tooltip */}
                  {isCollapsed && visibleAnalysisItems.map(item => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-10 transition-all font-normal`}
                        >
                          <item.icon
                            className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                          />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </>
              )}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-3 rounded-lg px-1 py-1 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={hasCustomTheme ? { color: companyTheme.textPrimary } : undefined}
                >
                  <Avatar className="h-9 w-9 shrink-0" style={hasCustomTheme ? { border: `1px solid ${companyTheme.separatorColor}` } : { border: '1px solid var(--border)' }}>
                    <AvatarFallback
                      className="text-xs font-medium"
                      style={hasCustomTheme ? { backgroundColor: companyTheme.accentHover, color: companyTheme.accent } : undefined}
                    >
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      {user?.role === 'admin' && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={hasCustomTheme ? { backgroundColor: `${companyTheme.accent}30`, color: companyTheme.accent } : undefined}>Admin</span>
                      )}
                      {user?.role === 'operacional' && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">Operacional</span>
                      )}
                      {user?.role === 'consultor' && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">Consultor</span>
                      )}
                    </div>
                    <p className="text-xs truncate mt-1.5" style={hasCustomTheme ? { color: companyTheme.textMuted } : { color: 'var(--muted-foreground)' }}>
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation("/minha-conta")}
                  className="cursor-pointer"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Minha Conta</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? APP_TITLE}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
