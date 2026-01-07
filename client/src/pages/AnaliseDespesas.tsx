import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const MONTH_NAMES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

type ExpenseItem = {
  expenseId: number;
  description: string;
  amount: number;
  notes: string | null;
  docNumber: string | null;
  expenseDate: string;
  year: number;
  month: number;
  categoryId: number;
  categoryName: string;
  supplierId: number;
  supplierName: string;
};

type MonthKey = string; // formato: "2025-01"

type SupplierData = {
  name: string;
  total: number;
  monthTotals: Map<MonthKey, number>;
  expenses: ExpenseItem[];
};

type CategoryData = {
  name: string;
  total: number;
  monthTotals: Map<MonthKey, number>;
  suppliers: Map<number, SupplierData>;
};

export default function AnaliseDespesas() {
  // Filtros de ano e mês
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const [selectedYears, setSelectedYears] = useState<number[]>([currentYear]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]); // vazio = todos os meses
  
  // Estados de expansão
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set()); // "catId-suppId"

  // Calcular datas baseado nos anos selecionados
  const { startDate, endDate } = useMemo(() => {
    if (selectedYears.length === 0) {
      return { startDate: undefined, endDate: undefined };
    }
    
    const minYear = Math.min(...selectedYears);
    const maxYear = Math.max(...selectedYears);
    
    return {
      startDate: `${minYear}-01-01`,
      endDate: `${maxYear}-12-31`,
    };
  }, [selectedYears]);

  // Query de dados hierárquicos
  const { data: rawData, isLoading } = trpc.expenseAnalysis.hierarchical.useQuery({
    startDate,
    endDate,
  });

  // Processar dados em estrutura hierárquica
  const { hierarchicalData, allMonths, grandTotal } = useMemo(() => {
    if (!rawData || rawData.length === 0) {
      return { hierarchicalData: new Map(), allMonths: [], grandTotal: 0 };
    }

    // Filtrar por anos selecionados
    let filteredData = rawData.filter((item: ExpenseItem) => selectedYears.includes(item.year));

    // Filtrar por meses selecionados (se houver)
    if (selectedMonths.length > 0) {
      filteredData = filteredData.filter((item: ExpenseItem) => selectedMonths.includes(item.month));
    }

    // Coletar todos os meses únicos
    const monthsSet = new Set<MonthKey>();
    filteredData.forEach((item: ExpenseItem) => {
      monthsSet.add(`${item.year}-${String(item.month).padStart(2, '0')}`);
    });
    const allMonths = Array.from(monthsSet).sort();

    // Estrutura: Map<categoryId, CategoryData>
    const categories = new Map<number, CategoryData>();

    let grandTotal = 0;

    filteredData.forEach((item: ExpenseItem) => {
      const monthKey: MonthKey = `${item.year}-${String(item.month).padStart(2, '0')}`;
      
      // Inicializar categoria se não existe
      if (!categories.has(item.categoryId)) {
        categories.set(item.categoryId, {
          name: item.categoryName,
          total: 0,
          monthTotals: new Map(),
          suppliers: new Map(),
        });
      }
      
      const category = categories.get(item.categoryId)!;
      category.total += item.amount;
      category.monthTotals.set(monthKey, (category.monthTotals.get(monthKey) || 0) + item.amount);
      
      // Inicializar fornecedor se não existe
      if (!category.suppliers.has(item.supplierId)) {
        category.suppliers.set(item.supplierId, {
          name: item.supplierName,
          total: 0,
          monthTotals: new Map(),
          expenses: [],
        });
      }
      
      const supplier = category.suppliers.get(item.supplierId)!;
      supplier.total += item.amount;
      supplier.monthTotals.set(monthKey, (supplier.monthTotals.get(monthKey) || 0) + item.amount);
      supplier.expenses.push(item);
      
      grandTotal += item.amount;
    });

    return { hierarchicalData: categories, allMonths, grandTotal };
  }, [rawData, selectedYears, selectedMonths]);

  // Toggle ano
  const toggleYear = (year: number) => {
    setSelectedYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year].sort()
    );
  };

  // Toggle mês
  const toggleMonth = (month: number) => {
    setSelectedMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month].sort((a, b) => a - b)
    );
  };

  // Selecionar todos os meses
  const selectAllMonths = () => {
    setSelectedMonths([]);
  };

  // Toggle expansão de categoria
  const toggleCategory = (categoryId: number) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Toggle expansão de fornecedor
  const toggleSupplier = (categoryId: number, supplierId: number) => {
    const key = `${categoryId}-${supplierId}`;
    setExpandedSuppliers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Limpar filtros
  const clearFilters = () => {
    setSelectedYears([currentYear]);
    setSelectedMonths([]);
    setExpandedCategories(new Set());
    setExpandedSuppliers(new Set());
  };

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Formatar mês para exibição
  const formatMonth = (monthKey: MonthKey) => {
    const [year, month] = monthKey.split('-');
    return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
  };

  // Calcular totais por mês (linha de total geral)
  const monthTotals = useMemo(() => {
    const totals = new Map<MonthKey, number>();
    hierarchicalData.forEach(category => {
      category.monthTotals.forEach((value: number, month: MonthKey) => {
        totals.set(month, (totals.get(month) || 0) + value);
      });
    });
    return totals;
  }, [hierarchicalData]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Análise de Despesas</h1>
          <p className="text-muted-foreground">Acompanhe a evolução das despesas por categoria e fornecedor</p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtro de Anos */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Ano</label>
              <div className="flex gap-2 flex-wrap">
                {[2024, 2025, 2026].map(year => (
                  <Button
                    key={year}
                    variant={selectedYears.includes(year) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleYear(year)}
                  >
                    {year}
                  </Button>
                ))}
              </div>
            </div>

            {/* Filtro de Meses */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Mês</label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedMonths.length === 0 ? "default" : "outline"}
                  size="sm"
                  onClick={selectAllMonths}
                >
                  Todos
                </Button>
                {MONTH_NAMES_FULL.map((monthName, index) => (
                  <Button
                    key={index}
                    variant={selectedMonths.includes(index + 1) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleMonth(index + 1)}
                  >
                    {MONTH_NAMES[index]}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela Hierárquica */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Despesas por Categoria / Fornecedor</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSpinner />
            ) : hierarchicalData.size > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2 font-medium sticky left-0 bg-muted/50 min-w-[250px] border-b">
                        Tipo Despesa
                      </th>
                      {allMonths.map(month => (
                        <th key={month} className="text-right p-2 font-medium min-w-[100px] border-b">
                          {formatMonth(month)}
                        </th>
                      ))}
                      <th className="text-right p-2 font-medium min-w-[120px] bg-muted/30 border-b">
                        Total Geral
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Categorias */}
                    {Array.from(hierarchicalData.entries()).map(([categoryId, category]) => {
                      const isCategoryExpanded = expandedCategories.has(categoryId);
                      
                      return (
                        <>
                          {/* Linha da Categoria */}
                          <tr 
                            key={`cat-${categoryId}`}
                            className="bg-blue-50 hover:bg-blue-100 cursor-pointer border-b"
                            onClick={() => toggleCategory(categoryId)}
                          >
                            <td className="p-2 font-medium sticky left-0 bg-blue-50 hover:bg-blue-100">
                              <div className="flex items-center gap-1">
                                {isCategoryExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-blue-600" />
                                )}
                                <span className="text-blue-800">{category.name}</span>
                              </div>
                            </td>
                            {allMonths.map(month => (
                              <td key={month} className="p-2 text-right text-blue-700 font-medium">
                                {formatCurrency(category.monthTotals.get(month) || 0)}
                              </td>
                            ))}
                            <td className="p-2 text-right font-bold text-blue-800 bg-blue-100">
                              {formatCurrency(category.total)}
                            </td>
                          </tr>

                          {/* Fornecedores (quando categoria expandida) */}
                          {isCategoryExpanded && Array.from(category.suppliers.entries() as IterableIterator<[number, SupplierData]>).map(([supplierId, supplier]) => {
                            const supplierKey = `${categoryId}-${supplierId}`;
                            const isSupplierExpanded = expandedSuppliers.has(supplierKey);
                            
                            return (
                              <>
                                {/* Linha do Fornecedor */}
                                <tr 
                                  key={`sup-${supplierKey}`}
                                  className="bg-green-50 hover:bg-green-100 cursor-pointer border-b"
                                  onClick={() => toggleSupplier(categoryId, supplierId)}
                                >
                                  <td className="p-2 pl-8 font-medium sticky left-0 bg-green-50 hover:bg-green-100">
                                    <div className="flex items-center gap-1">
                                      {isSupplierExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-green-600" />
                                      )}
                                      <span className="text-green-800">{supplier.name}</span>
                                    </div>
                                  </td>
                                  {allMonths.map(month => (
                                    <td key={month} className="p-2 text-right text-green-700">
                                      {formatCurrency(supplier.monthTotals.get(month) || 0)}
                                    </td>
                                  ))}
                                  <td className="p-2 text-right font-medium text-green-800 bg-green-100">
                                    {formatCurrency(supplier.total)}
                                  </td>
                                </tr>

                                {/* Lançamentos individuais (quando fornecedor expandido) */}
                                {isSupplierExpanded && supplier.expenses.map((expense: ExpenseItem) => {
                                  const expenseMonthKey: MonthKey = `${expense.year}-${String(expense.month).padStart(2, '0')}`;
                                  
                                  return (
                                    <tr 
                                      key={`exp-${expense.expenseId}`}
                                      className="bg-gray-50 hover:bg-gray-100 border-b text-xs"
                                    >
                                      <td className="p-2 pl-14 sticky left-0 bg-gray-50 hover:bg-gray-100">
                                        <div className="text-gray-700">
                                          {expense.description}
                                          {expense.docNumber && (
                                            <span className="text-gray-400 ml-2">({expense.docNumber})</span>
                                          )}
                                        </div>
                                        {expense.notes && (
                                          <div className="text-gray-400 text-xs truncate max-w-[200px]" title={expense.notes}>
                                            {expense.notes}
                                          </div>
                                        )}
                                      </td>
                                      {allMonths.map(month => (
                                        <td key={month} className="p-2 text-right text-gray-600">
                                          {month === expenseMonthKey ? formatCurrency(expense.amount) : '-'}
                                        </td>
                                      ))}
                                      <td className="p-2 text-right text-gray-700 bg-gray-100">
                                        {formatCurrency(expense.amount)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </>
                            );
                          })}
                        </>
                      );
                    })}

                    {/* Linha de Total Geral */}
                    <tr className="bg-gray-200 font-bold border-t-2">
                      <td className="p-2 sticky left-0 bg-gray-200">Total Geral</td>
                      {allMonths.map(month => (
                        <td key={month} className="p-2 text-right">
                          {formatCurrency(monthTotals.get(month) || 0)}
                        </td>
                      ))}
                      <td className="p-2 text-right bg-gray-300">
                        {formatCurrency(grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma despesa encontrada no período selecionado
              </p>
            )}
          </CardContent>
        </Card>

        {/* Legenda */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 rounded"></div>
            <span>Categoria (clique para expandir fornecedores)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 rounded"></div>
            <span>Fornecedor (clique para expandir lançamentos)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 rounded"></div>
            <span>Lançamento individual</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
