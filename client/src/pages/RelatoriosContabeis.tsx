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
import { FileText, Download, Loader2, TrendingUp, TrendingDown, DollarSign, Calculator } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

// Formatação de valores monetários
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value / 100);
};

// Formatação de data
const formatDate = (date: Date | string) => {
  return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
};

export default function RelatoriosContabeis() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("razao");
  
  // Filtros do Razão
  const [razaoAccountCode, setRazaoAccountCode] = useState("");
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

  // Queries
  const { data: chartOfAccounts } = trpc.accounting.listChartOfAccounts.useQuery();
  const { data: periods } = trpc.accounting.listPeriods.useQuery();
  
  const { data: razaoData, isLoading: razaoLoading, refetch: refetchRazao } = trpc.accounting.getRazao.useQuery(
    { 
      accountCode: razaoAccountCode, 
      startDate: razaoStartDate, 
      endDate: razaoEndDate 
    },
    { enabled: !!razaoAccountCode }
  );
  
  const { data: balanceteData, isLoading: balanceteLoading } = trpc.accounting.getBalancete.useQuery(
    { periodId: selectedPeriod },
    { enabled: !!selectedPeriod }
  );
  
  const { data: dreData, isLoading: dreLoading } = trpc.accounting.getDRE.useQuery(
    { periodId: selectedPeriod },
    { enabled: !!selectedPeriod }
  );

  // Contas analíticas para o select do Razão
  const analyticalAccounts = useMemo(() => {
    if (!chartOfAccounts) return [];
    return chartOfAccounts.filter(acc => acc.isAnalytical).sort((a, b) => a.code.localeCompare(b.code));
  }, [chartOfAccounts]);

  // Calcular totais do Balancete
  const balanceteTotals = useMemo(() => {
    if (!balanceteData) return { totalDebits: 0, totalCredits: 0, totalBalance: 0 };
    return balanceteData.reduce((acc, item) => ({
      totalDebits: acc.totalDebits + item.totalDebits,
      totalCredits: acc.totalCredits + item.totalCredits,
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
                    <Select value={razaoAccountCode} onValueChange={setRazaoAccountCode}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {analyticalAccounts.map(acc => (
                          <SelectItem key={acc.code} value={acc.code}>
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
                ) : razaoData && razaoData.entries.length > 0 ? (
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
                            <TableHead>Histórico</TableHead>
                            <TableHead className="text-right">Débito</TableHead>
                            <TableHead className="text-right">Crédito</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {razaoData.entries.map((entry, idx) => (
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
                ) : razaoAccountCode ? (
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
                        {periods?.map(period => (
                          <SelectItem key={period.id} value={period.id}>
                            {format(new Date(period.startDate), 'MMMM/yyyy', { locale: ptBR })}
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
                ) : balanceteData && balanceteData.length > 0 ? (
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
                            {balanceteTotals.totalDebits === balanceteTotals.totalCredits ? '✓ Equilibrado' : formatCurrency(Math.abs(balanceteTotals.totalDebits - balanceteTotals.totalCredits))}
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
                          {balanceteData.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono">{item.accountCode}</TableCell>
                              <TableCell>{item.accountName}</TableCell>
                              <TableCell className="text-right text-red-600">
                                {item.totalDebits > 0 ? formatCurrency(item.totalDebits) : '-'}
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                {item.totalCredits > 0 ? formatCurrency(item.totalCredits) : '-'}
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
                    Nenhum lançamento encontrado para o período selecionado
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
                  Resultado econômico do período
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
                        {periods?.map(period => (
                          <SelectItem key={period.id} value={period.id}>
                            {format(new Date(period.startDate), 'MMMM/yyyy', { locale: ptBR })}
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
                ) : dreData ? (
                  <div className="space-y-4">
                    {/* Card de Resultado */}
                    <Card className={dreData.netResult >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-muted-foreground">Resultado Líquido</div>
                            <div className={`text-3xl font-bold ${dreData.netResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(dreData.netResult)}
                            </div>
                          </div>
                          {dreData.netResult >= 0 ? (
                            <TrendingUp className="h-12 w-12 text-green-600" />
                          ) : (
                            <TrendingDown className="h-12 w-12 text-red-600" />
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Estrutura do DRE */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableBody>
                          {/* Receitas */}
                          <TableRow className="bg-green-50">
                            <TableCell colSpan={2} className="font-bold text-green-700">
                              RECEITAS OPERACIONAIS
                            </TableCell>
                            <TableCell className="text-right font-bold text-green-700">
                              {formatCurrency(dreData.totalRevenue)}
                            </TableCell>
                          </TableRow>
                          {dreData.revenues?.map((item, idx) => (
                            <TableRow key={`rev-${idx}`}>
                              <TableCell className="pl-8">{item.accountCode}</TableCell>
                              <TableCell>{item.accountName}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.value)}</TableCell>
                            </TableRow>
                          ))}

                          {/* Custos */}
                          <TableRow className="bg-orange-50">
                            <TableCell colSpan={2} className="font-bold text-orange-700">
                              (-) CUSTOS OPERACIONAIS
                            </TableCell>
                            <TableCell className="text-right font-bold text-orange-700">
                              ({formatCurrency(dreData.totalCosts)})
                            </TableCell>
                          </TableRow>
                          {dreData.costs?.map((item, idx) => (
                            <TableRow key={`cost-${idx}`}>
                              <TableCell className="pl-8">{item.accountCode}</TableCell>
                              <TableCell>{item.accountName}</TableCell>
                              <TableCell className="text-right">({formatCurrency(item.value)})</TableCell>
                            </TableRow>
                          ))}

                          {/* Lucro Bruto */}
                          <TableRow className="bg-blue-50 font-bold">
                            <TableCell colSpan={2} className="text-blue-700">
                              = LUCRO BRUTO
                            </TableCell>
                            <TableCell className={`text-right ${dreData.grossProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                              {formatCurrency(dreData.grossProfit)}
                            </TableCell>
                          </TableRow>

                          {/* Despesas */}
                          <TableRow className="bg-red-50">
                            <TableCell colSpan={2} className="font-bold text-red-700">
                              (-) DESPESAS OPERACIONAIS
                            </TableCell>
                            <TableCell className="text-right font-bold text-red-700">
                              ({formatCurrency(dreData.totalExpenses)})
                            </TableCell>
                          </TableRow>
                          {dreData.expenses?.map((item, idx) => (
                            <TableRow key={`exp-${idx}`}>
                              <TableCell className="pl-8">{item.accountCode}</TableCell>
                              <TableCell>{item.accountName}</TableCell>
                              <TableCell className="text-right">({formatCurrency(item.value)})</TableCell>
                            </TableRow>
                          ))}

                          {/* Resultado Líquido */}
                          <TableRow className={`font-bold text-lg ${dreData.netResult >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                            <TableCell colSpan={2} className={dreData.netResult >= 0 ? 'text-green-700' : 'text-red-700'}>
                              = RESULTADO LÍQUIDO DO PERÍODO
                            </TableCell>
                            <TableCell className={`text-right ${dreData.netResult >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {formatCurrency(dreData.netResult)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Selecione um período para visualizar o DRE
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
