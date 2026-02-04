import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Loader2, DollarSign, Calculator } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

// Tipos
type RazaoEntry = {
  date: Date | string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
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

type DREItem = {
  code: string;
  name: string;
  value: number;
  level: number;
};

// Formatação de valores monetários
const formatCurrency = (value: number, divideBy100: boolean = false) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(divideBy100 ? value / 100 : value);
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

export default function RelatoriosContabeis() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("razao");
  
  // Filtros do Razão
  const [razaoAccountId, setRazaoAccountId] = useState<number | null>(null);
  const [razaoStartDate, setRazaoStartDate] = useState(() => {
    const date = new Date();
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
  
  const { data: razaoData, isLoading: razaoLoading } = trpc.accounting.reports.razao.useQuery(
    { 
      accountId: razaoAccountId!, 
      startDate: razaoStartDate, 
      endDate: razaoEndDate 
    },
    { enabled: !!razaoAccountId }
  );
  
  const { data: balanceteData, isLoading: balanceteLoading } = trpc.accounting.reports.balancete.useQuery(
    { competenceMonth: selectedPeriod },
    { enabled: !!selectedPeriod }
  );
  
  const { data: dreData, isLoading: dreLoading } = trpc.accounting.reports.dre.useQuery(
    { competenceMonth: selectedPeriod },
    { enabled: !!selectedPeriod }
  );

  // Contas analíticas para o select do Razão
  const analyticalAccounts = useMemo(() => {
    if (!chartOfAccounts) return [];
    return chartOfAccounts
      .filter((acc) => acc.isAnalytical)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [chartOfAccounts]);

  // Calcular totais do Balancete
  const balanceteTotals = useMemo(() => {
    if (!balanceteData) return { totalDebits: 0, totalCredits: 0, totalBalance: 0 };
    return (balanceteData as BalanceteItem[]).reduce((acc: { totalDebits: number; totalCredits: number; totalBalance: number }, item: BalanceteItem) => ({
      totalDebits: acc.totalDebits + item.debit,
      totalCredits: acc.totalCredits + item.credit,
      totalBalance: acc.totalBalance + item.balance
    }), { totalDebits: 0, totalCredits: 0, totalBalance: 0 });
  }, [balanceteData]);

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
                    <Select 
                      value={razaoAccountId?.toString() || ""} 
                      onValueChange={(v) => setRazaoAccountId(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {analyticalAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id.toString()}>
                            {acc.code} - {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                ) : razaoData && (razaoData as any).entries?.length > 0 ? (
                  <>
                    {/* Resumo */}
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Total Débitos</div>
                          <div className="text-xl font-bold text-red-600">
                            {formatCurrency((razaoData as any).totalDebits || 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Total Créditos</div>
                          <div className="text-xl font-bold text-green-600">
                            {formatCurrency((razaoData as any).totalCredits || 0)}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Saldo Final</div>
                          <div className={`text-xl font-bold ${(razaoData as any).balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatCurrency(Math.abs((razaoData as any).balance || 0))} {(razaoData as any).balance >= 0 ? 'D' : 'C'}
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
                            <TableHead>Histórico</TableHead>
                            <TableHead className="text-right">Débito</TableHead>
                            <TableHead className="text-right">Crédito</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {((razaoData as any).entries as RazaoEntry[]).map((entry: RazaoEntry, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell>{formatDate(entry.date)}</TableCell>
                              <TableCell>{entry.description}</TableCell>
                              <TableCell className="text-right text-red-600">
                                {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(Math.abs(entry.runningBalance))} {entry.runningBalance >= 0 ? 'D' : 'C'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : razaoAccountId ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum lançamento encontrado para o período selecionado
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Selecione uma conta contábil para visualizar o razão
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
                    {/* Resumo */}
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
                          <div className={`text-xl font-bold ${balanceteTotals.totalDebits === balanceteTotals.totalCredits ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(Math.abs(balanceteTotals.totalDebits - balanceteTotals.totalCredits))}
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
                            <TableRow key={idx}>
                              <TableCell className="font-mono">{item.code}</TableCell>
                              <TableCell>{item.name}</TableCell>
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
