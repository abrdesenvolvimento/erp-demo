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
import { LayoutDashboard, LogOut, PanelLeft, Users, Package, ShoppingCart, BarChart3, ShoppingBag, Receipt, DollarSign, CreditCard, UserCircle, Shield, TrendingUp, Bike, ChevronDown, ChevronRight, PieChart, GitCompare, Wallet, Target, FileText } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

// Menu items principais (sem submenu)
const mainMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", roles: ["admin", "operacional", "consultor"] },
  { icon: Package, label: "Produtos", path: "/produtos", roles: ["admin", "operacional", "consultor"] },
  { icon: ShoppingCart, label: "Vendas", path: "/vendas", roles: ["admin", "operacional", "consultor"] },
  { icon: Users, label: "Parceiros", path: "/parceiros", roles: ["admin", "operacional", "consultor"] },
  { icon: Shield, label: "Gerenciar Usuários", path: "/usuarios", roles: ["admin"] },
];

// Submenu Financeiro
const financeMenuItems = [
  { icon: ShoppingBag, label: "Compras", path: "/compras", roles: ["admin", "consultor"] },
  { icon: Receipt, label: "Despesas", path: "/despesas", roles: ["admin", "consultor"] },
  { icon: DollarSign, label: "Contas a Receber", path: "/contas-receber", roles: ["admin", "operacional", "consultor"] },
  { icon: CreditCard, label: "Contas a Pagar", path: "/contas-pagar", roles: ["admin", "consultor"] },
];

// Submenu de Análises
const analysisMenuItems = [
  { icon: TrendingUp, label: "Análise de Vendas", path: "/analise-vendas", roles: ["admin"] },
  { icon: BarChart3, label: "Análise de Faturamento", path: "/relatorios", roles: ["admin", "consultor"] },
  { icon: Bike, label: "Análise Delivery", path: "/analise-delivery", roles: ["admin"] },
  { icon: GitCompare, label: "Análise por Canal", path: "/analise-canal", roles: ["admin"] },
  { icon: Receipt, label: "Análise de Despesas", path: "/analise-despesas", roles: ["admin"] },
  { icon: Target, label: "Metas", path: "/metas", roles: ["admin"] },
  { icon: FileText, label: "Fechamento", path: "/fechamento", roles: ["admin"] },
];

const getMenuItemsForRole = (items: typeof mainMenuItems, role?: string) => {
  if (!role) return [];
  return items.filter(item => item.roles.includes(role));
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const ANALYSIS_SUBMENU_KEY = "analysis-submenu-expanded";
const FINANCE_SUBMENU_KEY = "finance-submenu-expanded";
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
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
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
  
  // Filtra itens por role
  const filteredMainItems = getMenuItemsForRole(mainMenuItems, user?.role);
  const filteredAnalysisItems = getMenuItemsForRole(analysisMenuItems, user?.role);
  const filteredFinanceItems = getMenuItemsForRole(financeMenuItems, user?.role);
  
  // Verifica se algum item de análise está ativo
  const isAnalysisActive = filteredAnalysisItems.some(item => item.path === location);
  
  // Verifica se algum item financeiro está ativo
  const isFinanceActive = filteredFinanceItems.some(item => item.path === location);
  
  // Encontra o item ativo atual
  const allItems = [...filteredMainItems, ...filteredAnalysisItems, ...filteredFinanceItems];
  const activeMenuItem = allItems.find(item => item.path === location);
  
  const isMobile = useIsMobile();

  // Salva estado do submenu no localStorage
  useEffect(() => {
    localStorage.setItem(ANALYSIS_SUBMENU_KEY, analysisExpanded.toString());
  }, [analysisExpanded]);
  
  useEffect(() => {
    localStorage.setItem(FINANCE_SUBMENU_KEY, financeExpanded.toString());
  }, [financeExpanded]);

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
      // Consultor só pode ver Análise de Faturamento (antigo Relatórios)
      return item.path === '/relatorios';
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
      // Consultor pode ver tudo exceto Compras e Despesas (só visualização)
      return true;
    }
    return true;
  });

  return (
    <>
      <div className="relative z-50" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 pl-2 group-data-[collapsible=icon]:px-0 transition-all w-full">
              {isCollapsed ? (
                <div className="relative h-10 w-10 shrink-0 group">
                  <img
                    src={APP_LOGO}
                    className="h-10 w-10 rounded-md object-contain ring-1 ring-border"
                    alt="Logo"
                  />
                  <button
                    onClick={toggleSidebar}
                    className="absolute inset-0 flex items-center justify-center bg-accent rounded-md ring-1 ring-border opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PanelLeft className="h-4 w-4 text-foreground" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={APP_LOGO}
                      className="h-12 w-auto max-w-[48px] rounded-md object-contain ring-1 ring-border shrink-0"
                      alt="Logo"
                    />
                    <span className="font-semibold tracking-tight truncate">
                      {APP_TITLE}
                    </span>
                  </div>
                  <button
                    onClick={toggleSidebar}
                    className="ml-auto h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  >
                    <PanelLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              )}
            </div>
          </SidebarHeader>

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
                  <div className="my-2 mx-2 border-t border-border/50" />
                  
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
                    <div className="ml-4 border-l border-border/50 pl-2">
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

              {/* Submenu de Análises */}
              {visibleAnalysisItems.length > 0 && (
                <>
                  {/* Separador visual */}
                  <div className="my-2 mx-2 border-t border-border/50" />
                  
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
                    <div className="ml-4 border-l border-border/50 pl-2">
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
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      {user?.role === 'admin' && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">Admin</span>
                      )}
                      {user?.role === 'operacional' && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">Operacional</span>
                      )}
                      {user?.role === 'consultor' && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">Consultor</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
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
