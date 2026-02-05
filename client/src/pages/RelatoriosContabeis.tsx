import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Loader2, DollarSign, Calculator, X, Search } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

// Tipos
type RazaoEntry = {
  date: Date | string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  accountCode?: string;
  accountName?: string;
};

type BalanceteItem = {
  accountId: number;
  code: string;
  name: string;
  level: number;
  accountType: string;
  nature: string;
  isAnalytical: boolean;
  debit: number;
  credit: number;
  balance: number;
};

type Account = {
  id: number;
  code: string;
  name: string;
  isAnalytical?: boolean;
};

// Formatação de valores monetários
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// Formatação de data
const formatDate = (date: Date | string) => {
  return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
};

// Gerar períodos disponíveis (últimos 24 meses)
const generatePeriods = () => {
  const periods = [];
  const today = new Date();
  for (let i = 0; i < 24; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = format(date, 'MMMM/yyyy', { locale: ptBR });
    periods.push({ value, label });
  }
  return periods;
};

// Componente de Autocomplete para Contas
function AccountAutocomplete({
  accounts,
  selectedIds,
  onSelect,
  onRemove,
  placeholder = "Buscar conta...",
  multiple = false
}: {
  accounts: Account[];
  selectedIds: number[];
  onSelect: (id: number) => void;
  onRemove: (id: number) => void;
  placeholder?: string;
  multiple?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredAccounts = useMemo(() => {
    if (!accounts || accounts.length === 0) return [];
    if (!search) return accounts.slice(0, 20);
    const searchLower = search.toLowerCase();
    return accounts.filter(acc => 
      acc.code.toLowerCase().includes(searchLower) ||
      acc.name.toLowerCase().includes(searchLower)
    ).slice(0, 20);
  }, [accounts, search]);

  const selectedAccounts = useMemo(() => {
    if (!accounts || accounts.length === 0) return [];
    return accounts.filter(acc => selectedIds.includes(acc.id));
  }, [accounts, selectedIds]);

  const handleSelect = (acc: Account) => {
    onSelect(acc.id);
    setSearch("");
    // Sempre fechar o dropdown após seleção para melhor UX
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Tags das contas selecionadas */}
      {selectedAccounts.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedAccounts.map(acc => (
            <Badge key={acc.id} variant="secondary" className="flex items-center gap-1">
              {acc.code} - {acc.name.substring(0, 20)}{acc.name.length > 20 ? '...' : ''}
              <button
                type="button"
                onClick={() => onRemove(acc.id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Campo de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-9"
        />
      </div>

      {/* Dropdown de sugestões */}
      {isOpen && filteredAccounts.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredAccounts.map(acc => (
            <button
              key={acc.id}
              type="button"
              onClick={() => handleSelect(acc)}
              disabled={selectedIds.includes(acc.id)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                selectedIds.includes(acc.id) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <span className="font-mono text-muted-foreground">{acc.code}</span>
              <span className="ml-2">{acc.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RelatoriosContabeis() {
  const [activeTab, setActiveTab] = useState("razao");
  
  // Filtros do Razão - agora suporta múltiplas contas
  const [razaoAccountIds, setRazaoAccountIds] = useState<number[]>([]);
  const [razaoStartDate, setRazaoStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(0); // Janeiro
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [razaoEndDate, setRazaoEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // Filtros do Balancete/DRE
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });

  // Períodos disponíveis
  const availablePeriods = useMemo(() => generatePeriods(), []);

  // Queries
  const { data: chartOfAccounts } = trpc.accounting.listChartOfAccounts.useQuery();
  
  // Query para múltiplas contas no Razão usando o novo endpoint
  const { data: razaoData, isLoading: razaoLoading } = trpc.accounting.reports.razaoMultiple.useQuery(
    { 
      accountIds: razaoAccountIds, 
      startDate: razaoStartDate, 
      endDate: razaoEndDate 
    },
    { enabled: razaoAccountIds.length > 0 }
  );
  
  const { data: balanceteData, isLoading: balanceteLoading } = trpc.accounting.reports.balancete.useQuery(
    { competenceMonth: selectedPeriod },
    { enabled: !!selectedPeriod }
  );
  
  const { data: dreData, isLoading: dreLoading } = trpc.accounting.reports.dre.useQuery(
    { competenceMonth: selectedPeriod },
    { enabled: !!selectedPeriod }
  );

  // Contas analíticas para o autocomplete do Razão
  const analyticalAccounts = useMemo(() => {
    if (!chartOfAccounts) return [];
    return (chartOfAccounts as Account[])
      .filter((acc) => acc.isAnalytical)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [chartOfAccounts]);

  // Calcular totais do Balancete - APENAS CONTAS ANALÍTICAS
  const balanceteTotals = useMemo(() => {
    if (!balanceteData) return { totalDebits: 0, totalCredits: 0, difference: 0 };
    
    // Somar apenas contas analíticas para evitar duplicação
    const analyticalOnly = (balanceteData as BalanceteItem[]).filter(item => item.isAnalytical);
    
    const totalDebits = analyticalOnly.reduce((sum, item) => sum + item.debit, 0);
    const totalCredits = analyticalOnly.reduce((sum, item) => sum + item.credit, 0);
    
    return {
      totalDebits,
      totalCredits,
      difference: Math.abs(totalDebits - totalCredits)
    };
  }, [balanceteData]);

  // Handlers para seleção de contas
  const handleSelectAccount = (id: number) => {
    if (!razaoAccountIds.includes(id)) {
      setRazaoAccountIds([...razaoAccountIds, id]);
    }
  };

  const handleRemoveAccount = (id: number) => {
    setRazaoAccountIds(razaoAccountIds.filter(accId => accId !== id));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Relatórios Contábeis</h1>
            <p className="text-muted-foreground">Razão, Balancete e DRE</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="razao" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Razão
            </TabsTrigger>
            <TabsTrigger value="balancete" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Balancete
            </TabsTrigger>
            <TabsTrigger value="dre" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              DRE
            </TabsTrigger>
          </TabsList>

          {/* Tab: Razão */}
          <TabsContent value="razao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Razão Contábil</CardTitle>
                <CardDescription>
                  Extrato detalhado de movimentações por conta contábil
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <Label>Conta Contábil</Label>
                    <AccountAutocomplete
                      accounts={analyticalAccounts}
                      selectedIds={razaoAccountIds}
                      onSelect={handleSelectAccount}
                      onRemove={handleRemoveAccount}
                      placeholder="Buscar conta..."
                      multiple={true}
                    />
                  </div>
                  <div>
                    <Label>Data Início</Label>
                    <Input 
                      type="date" 
                      value={razaoStartDate}
                      onChange={(e) => setRazaoStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Data Fim</Label>
                    <Input 
                      type="date" 
                      value={razaoEndDate}
                      onChange={(e) => setRazaoEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Resultado */}
                {razaoLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : razaoData && razaoData.entries && razaoData.entries.length > 0 ? (
                  <>
                    {/* Resumo */}
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Total Débitos</div>
                          <div className="text-xl font-bold text-red-600">
                            {formatCurrency(razaoData.totalDebits)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Total Créditos</div>
                          <div className="text-xl font-bold text-green-600">
                            {formatCurrency(razaoData.totalCredits)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Saldo Final</div>
                          <div className={`text-xl font-bold ${razaoData.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatCurrency(Math.abs(razaoData.balance))} {razaoData.balance >= 0 ? 'D' : 'C'}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Tabela de lançamentos */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            {razaoAccountIds.length > 1 && <TableHead>Conta</TableHead>}
                            <TableHead>Histórico</TableHead>
                            <TableHead className="text-right">Débito</TableHead>
                            <TableHead className="text-right">Crédito</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {razaoData.entries.map((entry: RazaoEntry, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell>{formatDate(entry.date)}</TableCell>
                              {razaoAccountIds.length > 1 && (
                                <TableCell className="font-mono text-xs">
                                  {entry.accountCode}
                                </TableCell>
                              )}
                              <TableCell>{entry.description}</TableCell>
                              <TableCell className="text-right text-red-600">
                                {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {typeof entry.balance === 'number' && !isNaN(entry.balance)
                                  ? `${formatCurrency(Math.abs(entry.balance))} ${entry.balance >= 0 ? 'D' : 'C'}`
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : razaoAccountIds.length > 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum lançamento encontrado para o período selecionado
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Selecione uma ou mais contas contábeis para visualizar o razão
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Balancete */}
          <TabsContent value="balancete" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Balancete de Verificação</CardTitle>
                <CardDescription>
                  Saldos de todas as contas em um período específico
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filtro de período */}
                <div className="flex items-center gap-4">
                  <div className="w-64">
                    <Label>Período</Label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o período" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePeriods.map((period: { value: string; label: string }) => (
                          <SelectItem key={period.value} value={period.value}>
                            {period.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Resultado */}
                {balanceteLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : balanceteData && (balanceteData as BalanceteItem[]).length > 0 ? (
                  <>
                    {/* Resumo - Agora soma apenas contas analíticas */}
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Total Débitos</div>
                          <div className="text-xl font-bold text-red-600">
                            {formatCurrency(balanceteTotals.totalDebits)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Total Créditos</div>
                          <div className="text-xl font-bold text-green-600">
                            {formatCurrency(balanceteTotals.totalCredits)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Diferença</div>
                          <div className={`text-xl font-bold ${balanceteTotals.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(balanceteTotals.difference)}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Tabela */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Conta</TableHead>
                            <TableHead className="text-right">Débitos</TableHead>
                            <TableHead className="text-right">Créditos</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(balanceteData as BalanceteItem[]).map((item: BalanceteItem, idx: number) => (
                            <TableRow key={idx} className={!item.isAnalytical ? 'bg-muted/30 font-medium' : ''}>
                              <TableCell className="font-mono">{item.code}</TableCell>
                              <TableCell style={{ paddingLeft: `${(item.level - 1) * 16 + 16}px` }}>
                                {item.name}
                              </TableCell>
                              <TableCell className="text-right text-red-600">
                                {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(Math.abs(item.balance))} {item.balance >= 0 ? 'D' : 'C'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum dado encontrado para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: DRE */}
          <TabsContent value="dre" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Demonstração do Resultado do Exercício</CardTitle>
                <CardDescription>
                  Receitas, custos e despesas do período
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filtro de período */}
                <div className="flex items-center gap-4">
                  <div className="w-64">
                    <Label>Período</Label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o período" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePeriods.map((period: { value: string; label: string }) => (
                          <SelectItem key={period.value} value={period.value}>
                            {period.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Resultado */}
                {dreLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : dreData && Array.isArray(dreData) && dreData.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(dreData as any[]).map((item: any, idx: number) => (
                          item.code !== '' || item.description !== '' ? (
                            <TableRow 
                              key={idx}
                              className={item.isTotal ? 'bg-primary/10 font-bold' : item.level === 1 ? 'bg-muted/50 font-bold' : item.level === 2 ? 'font-medium' : ''}
                            >
                              <TableCell style={{ paddingLeft: `${(item.level || 1) * 16}px` }}>
                                {item.code ? `${item.code} - ` : ''}{item.description}
                              </TableCell>
                              <TableCell className={`text-right ${item.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {item.value !== 0 ? formatCurrency(Math.abs(item.value)) : '-'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            <TableRow key={idx} className="h-4">
                              <TableCell colSpan={2}></TableCell>
                            </TableRow>
                          )
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum dado encontrado para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
