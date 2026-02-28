import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Package, TrendingUp, TrendingDown, ArrowUpDown, BarChart3, Clock, AlertTriangle, ArrowUp, ArrowDown, ShoppingCart, Truck, PauseCircle, LayoutGrid, X, LineChart, PackageX, DollarSign, AlertCircle } from "lucide-react";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

type SortField = 'stockValue' | 'turnover' | 'daysOfStock' | 'costVariation' | 'productName' | 'qtdSold' | 'qtdSoldBalcao' | 'qtdSoldDelivery' | 'daysSinceLastSale' | 'abcClass' | 'currentStock' | 'avgCost' | 'cmv' | 'cmvAccPct' | 'entriesInPeriod' | 'daysOutOfStock' | 'avgDailySales' | 'estimatedLostRevenue' | 'totalSales90d';
type SortDir = 'asc' | 'desc';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function getDaysOfStockBadge(days: number) {
  if (days >= 999) return <Badge variant="outline" className="text-muted-foreground">Sem vendas</Badge>;
  if (days > 90) return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">{days}d</Badge>;
  if (days > 45) return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{days}d</Badge>;
  if (days < 7) return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{days}d</Badge>;
  return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{days}d</Badge>;
}

function getTurnoverColor(turnover: number): string {
  if (turnover >= 1.0) return 'text-green-600 font-bold';
  if (turnover >= 0.5) return 'text-emerald-600';
  if (turnover >= 0.3) return 'text-amber-600';
  return 'text-red-600';
}

function getAbcBadge(abc: string) {
  if (abc === 'A') return <Badge className="bg-green-100 text-green-800 border-green-200">A</Badge>;
  if (abc === 'B') return <Badge className="bg-amber-100 text-amber-800 border-amber-200">B</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200">C</Badge>;
}

function getDaysSinceLastSaleBadge(days: number | undefined) {
  if (days === undefined) return <Badge variant="outline" className="text-muted-foreground">Nunca vendido</Badge>;
  if (days > 120) return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">{days}d</Badge>;
  if (days > 90) return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">{days}d</Badge>;
  if (days > 60) return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{days}d</Badge>;
  if (days > 30) return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{days}d</Badge>;
  return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{days}d</Badge>;
}

// ===== COMPONENTE MULTI-SELECT AUTOCOMPLETE =====
interface MultiSelectOption {
  value: string;
  label: string;
}

function MultiSelectAutocomplete({
  options,
  selected,
  onChange,
  placeholder,
  className = "",
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    return options.filter(o =>
      !selected.includes(o.value) &&
      o.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, selected, search]);

  const handleSelect = useCallback((value: string) => {
    onChange([...selected, value]);
    setSearch("");
    inputRef.current?.focus();
  }, [selected, onChange]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Campo de input compacto */}
      <div
        className="flex items-center gap-1.5 min-h-[36px] px-2.5 py-1 border rounded-md bg-background cursor-text"
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        {selected.length === 0 && !search && (
          <span className="text-muted-foreground text-sm whitespace-nowrap">{placeholder}</span>
        )}
        {selected.length > 0 && !search && (
          <span className="text-sm text-foreground whitespace-nowrap">
            {selected.length} {selected.length === 1 ? 'selecionado' : 'selecionados'}
          </span>
        )}
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="border-0 shadow-none p-0 h-6 min-w-[60px] flex-1 focus-visible:ring-0"
          placeholder={selected.length > 0 ? "Buscar..." : ""}
        />
      </div>

      {/* Dropdown de opções */}
      {open && filteredOptions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto bg-popover border rounded-md shadow-md">
          {filteredOptions.slice(0, 50).map(opt => (
            <div
              key={opt.value}
              className="px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== COMPONENTE PRINCIPAL =====
export default function AnaliseEstoque() {
  const now = new Date();
  const nowBrazil = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const [month, setMonth] = useState(nowBrazil.getMonth() + 1);
  const [year, setYear] = useState(nowBrazil.getFullYear());
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('stockValue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [activeTab, setActiveTab] = useState("giro");
  const [stoppedDaysFilter, setStoppedDaysFilter] = useState<string>("30");
  const [abcFilter, setAbcFilter] = useState<string>("all");

  // Sort state for Parados tab
  const [stoppedSortField, setStoppedSortField] = useState<SortField>('daysSinceLastSale');
  const [stoppedSortDir, setStoppedSortDir] = useState<SortDir>('desc');

  // Sort state for ABC tab
  const [abcSortField, setAbcSortField] = useState<SortField>('cmv');
  const [abcSortDir, setAbcSortDir] = useState<SortDir>('desc');

  // Sort state for Ruptura tab
  const [rupturaSortField, setRupturaSortField] = useState<SortField>('estimatedLostRevenue');
  const [rupturaSortDir, setRupturaSortDir] = useState<SortDir>('desc');

  const { data: categoryData, isLoading: loadingCategories } = trpc.stockAnalysis.byCategory.useQuery(
    { year, month }
  );

  // Use first selected category for backend filter, or undefined
  const categoryIdForQuery = selectedCategories.length === 1 ? parseInt(selectedCategories[0]) : undefined;
  const subcategoryForQuery = selectedSubcategories.length === 1 ? selectedSubcategories[0] : undefined;

  const { data: productData, isLoading: loadingProducts } = trpc.stockAnalysis.byProduct.useQuery(
    {
      year, month,
      categoryId: categoryIdForQuery,
      subcategory: subcategoryForQuery,
    }
  );

  const { data: subcategories } = trpc.stockAnalysis.subcategories.useQuery(
    { categoryId: categoryIdForQuery }
  );

  // State para filtro de ano da evolução
  const [evolutionYear, setEvolutionYear] = useState(nowBrazil.getFullYear());
  const [evolutionCategoryId, setEvolutionCategoryId] = useState<number | undefined>(undefined);
  const [evolutionSubcategory, setEvolutionSubcategory] = useState<string | undefined>(undefined);

  // Evolução mensal do estoque
  const { data: monthlyEvolution, isLoading: loadingEvolution } = trpc.stockAnalysis.monthlyEvolution.useQuery(
    { year: evolutionYear, categoryId: evolutionCategoryId }
  );

  // Subcategorias para filtro da evolução
  const { data: evolutionSubcategories } = trpc.stockAnalysis.subcategories.useQuery(
    { categoryId: evolutionCategoryId }
  );

  // Produtos em ruptura (estoque zerado)
  const { data: stockOutData, isLoading: loadingStockOut } = trpc.stockAnalysis.stockOut.useQuery(
    { categoryId: categoryIdForQuery }
  );

  const years = useMemo(() => {
    const arr = [];
    for (let y = 2025; y <= nowBrazil.getFullYear(); y++) arr.push(y);
    return arr;
  }, []);

  // Category options for multi-select
  const categoryOptions = useMemo<MultiSelectOption[]>(() => {
    if (!categoryData) return [];
    return categoryData.map((cat: any) => ({ value: String(cat.categoryId), label: cat.categoryName }));
  }, [categoryData]);

  // Subcategory options for multi-select
  const subcategoryOptions = useMemo<MultiSelectOption[]>(() => {
    if (!subcategories) return [];
    return subcategories.map((sub: string) => ({ value: sub, label: sub }));
  }, [subcategories]);

  // Product options for multi-select (from all loaded products)
  const productOptions = useMemo<MultiSelectOption[]>(() => {
    if (!productData) return [];
    const seen = new Set<string>();
    return productData
      .filter((p: any) => {
        if (seen.has(String(p.productId))) return false;
        seen.add(String(p.productId));
        return true;
      })
      .map((p: any) => ({ value: String(p.productId), label: p.productName }));
  }, [productData]);

  // State for product multi-select
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // Client-side multi-filter
  const clientFilteredProducts = useMemo(() => {
    if (!productData) return [];
    let filtered = productData as any[];

    // Multi-category filter (client-side when > 1 selected)
    if (selectedCategories.length > 1) {
      const catIds = new Set(selectedCategories.map(Number));
      filtered = filtered.filter((p: any) => catIds.has(p.categoryId));
    }

    // Multi-subcategory filter
    if (selectedSubcategories.length > 1) {
      const subs = new Set(selectedSubcategories);
      filtered = filtered.filter((p: any) => subs.has(p.subcategory));
    }

    // Product filter
    if (selectedProducts.length > 0) {
      const prodIds = new Set(selectedProducts.map(Number));
      filtered = filtered.filter((p: any) => prodIds.has(p.productId));
    }

    return filtered;
  }, [productData, selectedCategories, selectedSubcategories, selectedProducts]);

  // Generic sort function
  const sortProducts = useCallback((products: any[], field: SortField, dir: SortDir) => {
    return [...products].sort((a: any, b: any) => {
      let aVal = a[field];
      let bVal = b[field];
      if (field === 'productName') {
        return dir === 'asc' ? (aVal || '').localeCompare(bVal || '') : (bVal || '').localeCompare(aVal || '');
      }
      if (field === 'abcClass') {
        const order: Record<string, number> = { A: 1, B: 2, C: 3 };
        return dir === 'asc' ? (order[aVal] || 4) - (order[bVal] || 4) : (order[bVal] || 4) - (order[aVal] || 4);
      }
      if (field === 'daysOfStock') {
        if (aVal >= 999 && bVal < 999) return 1;
        if (bVal >= 999 && aVal < 999) return -1;
      }
      if (field === 'daysSinceLastSale') {
        if (aVal === undefined && bVal !== undefined) return 1;
        if (bVal === undefined && aVal !== undefined) return -1;
      }
      return dir === 'asc' ? (aVal ?? 0) - (bVal ?? 0) : (bVal ?? 0) - (aVal ?? 0);
    });
  }, []);

  // Filtered + sorted products for Giro tab
  const filteredProducts = useMemo(() => {
    return sortProducts(clientFilteredProducts, sortField, sortDir);
  }, [clientFilteredProducts, sortField, sortDir, sortProducts]);

  // Produtos parados
  const stoppedProducts = useMemo(() => {
    const minDays = parseInt(stoppedDaysFilter);
    const stopped = clientFilteredProducts.filter((p: any) => {
      if (p.daysSinceLastSale === undefined) return true;
      return p.daysSinceLastSale >= minDays;
    });
    return sortProducts(stopped, stoppedSortField, stoppedSortDir);
  }, [clientFilteredProducts, stoppedDaysFilter, stoppedSortField, stoppedSortDir, sortProducts]);

  // Classificação ABC (with filter)
  const abcProducts = useMemo(() => {
    let products = [...clientFilteredProducts];
    if (abcFilter !== 'all') {
      products = products.filter((p: any) => p.abcClass === abcFilter);
    }
    return sortProducts(products, abcSortField, abcSortDir);
  }, [clientFilteredProducts, abcFilter, abcSortField, abcSortDir, sortProducts]);

  // Resumos ABC (always from all client-filtered, not abc-filtered)
  const abcSummary = useMemo(() => {
    const summary: Record<string, { count: number; value: number; cmv: number }> = {
      A: { count: 0, value: 0, cmv: 0 },
      B: { count: 0, value: 0, cmv: 0 },
      C: { count: 0, value: 0, cmv: 0 },
    };
    for (const p of clientFilteredProducts) {
      const cls = (p as any).abcClass || 'C';
      if (summary[cls]) {
        summary[cls].count++;
        summary[cls].value += (p as any).stockValue;
        summary[cls].cmv += (p as any).cmv;
      }
    }
    return summary;
  }, [clientFilteredProducts]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleStoppedSort = (field: SortField) => {
    if (stoppedSortField === field) {
      setStoppedSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setStoppedSortField(field);
      setStoppedSortDir('desc');
    }
  };

  const handleAbcSort = (field: SortField) => {
    if (abcSortField === field) {
      setAbcSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setAbcSortField(field);
      setAbcSortDir('desc');
    }
  };

  const handleRupturaSort = (field: SortField) => {
    if (rupturaSortField === field) {
      setRupturaSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setRupturaSortField(field);
      setRupturaSortDir('desc');
    }
  };

  // Sorted ruptura products
  const sortedStockOut = useMemo(() => {
    if (!stockOutData) return [];
    return sortProducts(stockOutData as any[], rupturaSortField, rupturaSortDir);
  }, [stockOutData, rupturaSortField, rupturaSortDir, sortProducts]);

  // Ruptura totals
  const rupturaTotals = useMemo(() => {
    if (!stockOutData || stockOutData.length === 0) return { count: 0, lostRevenue: 0, avgA: 0, avgB: 0, avgC: 0 };
    return {
      count: stockOutData.length,
      lostRevenue: stockOutData.reduce((s: number, p: any) => s + p.estimatedLostRevenue, 0),
      avgA: stockOutData.filter((p: any) => p.abcClass === 'A').length,
      avgB: stockOutData.filter((p: any) => p.abcClass === 'B').length,
      avgC: stockOutData.filter((p: any) => p.abcClass === 'C').length,
    };
  }, [stockOutData]);

  const SortIcon = ({ field, activeField, activeDir }: { field: SortField; activeField: SortField; activeDir: SortDir }) => {
    if (activeField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return activeDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Totais do resumo
  const categoryTotals = useMemo(() => {
    if (!categoryData) return { stockValue: 0, cmv: 0, productCount: 0 };
    return {
      stockValue: categoryData.reduce((s: number, c: any) => s + c.stockValue, 0),
      cmv: categoryData.reduce((s: number, c: any) => s + c.cmv, 0),
      productCount: categoryData.reduce((s: number, c: any) => s + c.productCount, 0),
    };
  }, [categoryData]);

  // Totais dos produtos filtrados
  const productTotals = useMemo(() => {
    if (!filteredProducts.length) return { stockValue: 0, cmv: 0, qtdSold: 0, qtdSoldBalcao: 0, qtdSoldDelivery: 0 };
    return {
      stockValue: filteredProducts.reduce((s: number, p: any) => s + p.stockValue, 0),
      cmv: filteredProducts.reduce((s: number, p: any) => s + p.cmv, 0),
      qtdSold: filteredProducts.reduce((s: number, p: any) => s + p.qtdSold, 0),
      qtdSoldBalcao: filteredProducts.reduce((s: number, p: any) => s + p.qtdSoldBalcao, 0),
      qtdSoldDelivery: filteredProducts.reduce((s: number, p: any) => s + p.qtdSoldDelivery, 0),
    };
  }, [filteredProducts]);

  // Totais de produtos parados
  const stoppedTotals = useMemo(() => {
    if (!stoppedProducts.length) return { stockValue: 0, count: 0 };
    return {
      stockValue: stoppedProducts.reduce((s: number, p: any) => s + p.stockValue, 0),
      count: stoppedProducts.length,
    };
  }, [stoppedProducts]);

  // Clear filters helper
  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setSelectedProducts([]);
  };

  const hasActiveFilters = selectedCategories.length > 0 || selectedSubcategories.length > 0 || selectedProducts.length > 0;

  // Coletar todos os itens selecionados para exibir abaixo dos filtros
  const allSelectedItems = useMemo(() => {
    const items: { label: string; value: string; type: 'category' | 'subcategory' | 'product' }[] = [];
    selectedCategories.forEach(v => {
      const opt = categoryOptions.find((o: MultiSelectOption) => o.value === v);
      if (opt) items.push({ label: opt.label, value: v, type: 'category' });
    });
    selectedSubcategories.forEach(v => {
      const opt = subcategoryOptions.find((o: MultiSelectOption) => o.value === v);
      if (opt) items.push({ label: opt.label, value: v, type: 'subcategory' });
    });
    selectedProducts.forEach(v => {
      const opt = productOptions.find((o: MultiSelectOption) => o.value === v);
      if (opt) items.push({ label: opt.label, value: v, type: 'product' });
    });
    return items;
  }, [selectedCategories, selectedSubcategories, selectedProducts, categoryOptions, subcategoryOptions, productOptions]);

  const handleRemoveSelectedItem = (value: string, type: 'category' | 'subcategory' | 'product') => {
    if (type === 'category') {
      setSelectedCategories(prev => prev.filter(v => v !== value));
    } else if (type === 'subcategory') {
      setSelectedSubcategories(prev => prev.filter(v => v !== value));
    } else {
      setSelectedProducts(prev => prev.filter(v => v !== value));
    }
  };

  // ===== FILTROS COMPARTILHADOS =====
  const filtersBarContent = (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <MultiSelectAutocomplete
          options={categoryOptions}
          selected={selectedCategories}
          onChange={(v) => { setSelectedCategories(v); setSelectedSubcategories([]); }}
          placeholder="Categorias"
          className="w-[200px]"
        />
        <MultiSelectAutocomplete
          options={subcategoryOptions}
          selected={selectedSubcategories}
          onChange={setSelectedSubcategories}
          placeholder="Subcategorias"
          className="w-[200px]"
        />
        <MultiSelectAutocomplete
          options={productOptions}
          selected={selectedProducts}
          onChange={setSelectedProducts}
          placeholder="Produtos"
          className="w-[220px]"
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>
      {/* Badges dos itens selecionados abaixo dos filtros */}
      {allSelectedItems.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {allSelectedItems.map(item => (
            <span
              key={`${item.type}-${item.value}`}
              className="inline-flex items-center gap-1 text-xs py-1 px-2.5 rounded-md bg-secondary text-secondary-foreground select-none"
            >
              {item.label}
              <button
                type="button"
                className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors ml-0.5 shrink-0"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveSelectedItem(item.value, item.type); }}
                aria-label={`Remover ${item.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Análise de Estoque</h1>
            <p className="text-muted-foreground">Giro, cobertura, classificação ABC e produtos parados</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Package className="h-4 w-4" /> Valor em Estoque
              </div>
              <div className="text-2xl font-bold text-primary">
                {loadingCategories ? "..." : formatCurrency(categoryTotals.stockValue)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {loadingCategories ? "" : `${categoryTotals.productCount} produtos com estoque`}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <BarChart3 className="h-4 w-4" /> CMV do Período
              </div>
              <div className="text-2xl font-bold">
                {loadingCategories ? "..." : formatCurrency(categoryTotals.cmv)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Custo das mercadorias vendidas</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4" /> Giro Médio
              </div>
              <div className={`text-2xl font-bold ${categoryTotals.stockValue > 0 ? getTurnoverColor(categoryTotals.cmv / categoryTotals.stockValue) : ''}`}>
                {loadingCategories ? "..." : categoryTotals.stockValue > 0 ? `${(categoryTotals.cmv / categoryTotals.stockValue).toFixed(2)}x` : "0.00x"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">CMV / Valor em Estoque</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Clock className="h-4 w-4" /> Cobertura Média
              </div>
              <div className="text-2xl font-bold">
                {loadingCategories ? "..." : (() => {
                  const dailyCmv = categoryTotals.cmv / (new Date(year, month, 0).getDate());
                  const days = dailyCmv > 0 ? Math.round(categoryTotals.stockValue / dailyCmv) : 999;
                  return days >= 999 ? "—" : `${days} dias`;
                })()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Dias de estoque disponível</div>
            </CardContent>
          </Card>
        </div>

        {/* RESUMO POR CATEGORIA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Resumo por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCategories ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor Estoque</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Produtos</TableHead>
                    <TableHead className="text-right">CMV</TableHead>
                    <TableHead className="text-right">Giro</TableHead>
                    <TableHead className="text-right">Cobertura</TableHead>
                    <TableHead className="text-right">Var. Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryData && categoryData.length > 0 ? categoryData.map((cat: any) => (
                    <TableRow
                      key={cat.categoryId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedCategories([String(cat.categoryId)]);
                        setSelectedSubcategories([]);
                        setSelectedProducts([]);
                        setActiveTab("giro");
                        document.getElementById('product-tabs')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      <TableCell className="font-medium">{cat.categoryName}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(cat.stockValue)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{cat.stockPercentage}%</TableCell>
                      <TableCell className="text-right">{cat.productCount}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(cat.cmv)}</TableCell>
                      <TableCell className={`text-right font-mono ${getTurnoverColor(cat.turnover)}`}>
                        {cat.turnover.toFixed(2)}x
                      </TableCell>
                      <TableCell className="text-right">{getDaysOfStockBadge(cat.daysOfStock)}</TableCell>
                      <TableCell className={`text-right font-mono ${
                        cat.costVariation > 0 ? 'text-red-600' :
                        cat.costVariation < 0 ? 'text-green-600' : 'text-muted-foreground'
                      }`}>
                        {cat.costVariation !== 0 ? (
                          <span className="flex items-center justify-end gap-1">
                            {cat.costVariation > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {cat.costVariation > 0 ? '+' : ''}{cat.costVariation.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">Sem dados</TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {categoryData && categoryData.length > 0 && (
                  <TableFooter>
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(categoryTotals.stockValue)}</TableCell>
                      <TableCell className="text-right font-mono">100%</TableCell>
                      <TableCell className="text-right">{categoryTotals.productCount}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(categoryTotals.cmv)}</TableCell>
                      <TableCell className={`text-right font-mono ${getTurnoverColor(categoryTotals.stockValue > 0 ? categoryTotals.cmv / categoryTotals.stockValue : 0)}`}>
                        {categoryTotals.stockValue > 0 ? (categoryTotals.cmv / categoryTotals.stockValue).toFixed(2) : '0.00'}x
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const dailyCmv = categoryTotals.cmv / (new Date(year, month, 0).getDate());
                          const days = dailyCmv > 0 ? Math.round(categoryTotals.stockValue / dailyCmv) : 999;
                          return getDaysOfStockBadge(days);
                        })()}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ABAS */}
        <div id="product-tabs">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="giro" className="flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Giro e Cobertura
              </TabsTrigger>
              <TabsTrigger value="parados" className="flex items-center gap-1.5">
                <PauseCircle className="h-4 w-4" /> Produtos Parados
              </TabsTrigger>
              <TabsTrigger value="abc" className="flex items-center gap-1.5">
                <LayoutGrid className="h-4 w-4" /> Classificação ABC
              </TabsTrigger>
              <TabsTrigger value="evolucao" className="flex items-center gap-1.5">
                <LineChart className="h-4 w-4" /> Evolução Mensal
              </TabsTrigger>
              <TabsTrigger value="ruptura" className="flex items-center gap-1.5">
                <PackageX className="h-4 w-4" /> Ruptura de Estoque
              </TabsTrigger>
            </TabsList>

            {/* ===== ABA 1: GIRO E COBERTURA ===== */}
            <TabsContent value="giro">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" /> Detalhe por Produto
                    </CardTitle>
                    {filtersBarContent}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingProducts ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : (
                    <>
                      <div className="text-sm text-muted-foreground mb-3">
                        {filteredProducts.length} produtos encontrados
                        {selectedCategories.length > 0 && categoryData ? ` em ${selectedCategories.map(c => categoryData.find((cat: any) => String(cat.categoryId) === c)?.categoryName).filter(Boolean).join(', ')}` : ''}
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('productName')}>
                                <span className="flex items-center">Produto<SortIcon field="productName" activeField={sortField} activeDir={sortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('currentStock')}>
                                <span className="flex items-center justify-end">Qtd<SortIcon field="currentStock" activeField={sortField} activeDir={sortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right">Custo Médio</TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('stockValue')}>
                                <span className="flex items-center justify-end">Valor Estoque<SortIcon field="stockValue" activeField={sortField} activeDir={sortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('qtdSoldBalcao')}>
                                <span className="flex items-center justify-end"><ShoppingCart className="h-3 w-3 mr-1" />Balcão<SortIcon field="qtdSoldBalcao" activeField={sortField} activeDir={sortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('qtdSoldDelivery')}>
                                <span className="flex items-center justify-end"><Truck className="h-3 w-3 mr-1" />Delivery<SortIcon field="qtdSoldDelivery" activeField={sortField} activeDir={sortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('qtdSold')}>
                                <span className="flex items-center justify-end">Total Vend.<SortIcon field="qtdSold" activeField={sortField} activeDir={sortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('turnover')}>
                                <span className="flex items-center justify-end">Giro<SortIcon field="turnover" activeField={sortField} activeDir={sortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('daysOfStock')}>
                                <span className="flex items-center justify-end">Cobertura<SortIcon field="daysOfStock" activeField={sortField} activeDir={sortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right">Última Compra</TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('costVariation')}>
                                <span className="flex items-center justify-end">Var. Custo<SortIcon field="costVariation" activeField={sortField} activeDir={sortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('entriesInPeriod')}>
                                <span className="flex items-center justify-end">Entradas<SortIcon field="entriesInPeriod" activeField={sortField} activeDir={sortDir} /></span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredProducts.length > 0 ? filteredProducts.map((prod: any) => (
                              <TableRow key={prod.productId}>
                                <TableCell className="font-medium max-w-[220px] truncate" title={prod.productName}>{prod.productName}</TableCell>
                                <TableCell className="text-right font-mono">{formatNumber(prod.currentStock)}</TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(prod.avgCost)}</TableCell>
                                <TableCell className="text-right font-mono font-medium">{formatCurrency(prod.stockValue)}</TableCell>
                                <TableCell className="text-right font-mono">{prod.qtdSoldBalcao > 0 ? formatNumber(prod.qtdSoldBalcao) : <span className="text-muted-foreground">0</span>}</TableCell>
                                <TableCell className="text-right font-mono">{prod.qtdSoldDelivery > 0 ? formatNumber(prod.qtdSoldDelivery) : <span className="text-muted-foreground">0</span>}</TableCell>
                                <TableCell className="text-right font-mono">{prod.qtdSold > 0 ? formatNumber(prod.qtdSold) : <span className="text-muted-foreground">0</span>}</TableCell>
                                <TableCell className={`text-right font-mono ${getTurnoverColor(prod.turnover)}`}>{prod.turnover.toFixed(2)}x</TableCell>
                                <TableCell className="text-right">{getDaysOfStockBadge(prod.daysOfStock)}</TableCell>
                                <TableCell className="text-right text-sm">
                                  {prod.lastPurchaseDate ? (
                                    <div>
                                      <div className="text-muted-foreground">{new Date(prod.lastPurchaseDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</div>
                                      {prod.lastPurchaseCost && <div className="text-xs text-muted-foreground">{formatCurrency(prod.lastPurchaseCost)}</div>}
                                    </div>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className={`text-right font-mono ${
                                  prod.costVariation !== null && prod.costVariation > 0 ? 'text-red-600' :
                                  prod.costVariation !== null && prod.costVariation < 0 ? 'text-green-600' : 'text-muted-foreground'
                                }`}>
                                  {prod.costVariation !== null ? (
                                    <span className="flex items-center justify-end gap-1">
                                      {prod.costVariation > 0 ? <TrendingUp className="h-3 w-3" /> : prod.costVariation < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                                      {prod.costVariation > 0 ? '+' : ''}{prod.costVariation.toFixed(1)}%
                                    </span>
                                  ) : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {prod.entriesInPeriod > 0 ? (
                                    <div><span className="font-mono">{prod.entriesInPeriod}</span><span className="text-xs text-muted-foreground ml-1">({formatNumber(prod.totalPurchased)} un)</span></div>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                              </TableRow>
                            )) : (
                              <TableRow>
                                <TableCell colSpan={12} className="text-center text-muted-foreground">Nenhum produto encontrado</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                          {filteredProducts.length > 0 && (
                            <TableFooter>
                              <TableRow className="font-bold bg-muted/50">
                                <TableCell>Total ({filteredProducts.length})</TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(productTotals.stockValue)}</TableCell>
                                <TableCell className="text-right font-mono">{formatNumber(productTotals.qtdSoldBalcao)}</TableCell>
                                <TableCell className="text-right font-mono">{formatNumber(productTotals.qtdSoldDelivery)}</TableCell>
                                <TableCell className="text-right font-mono">{formatNumber(productTotals.qtdSold)}</TableCell>
                                <TableCell className={`text-right font-mono ${getTurnoverColor(productTotals.stockValue > 0 ? productTotals.cmv / productTotals.stockValue : 0)}`}>
                                  {productTotals.stockValue > 0 ? (productTotals.cmv / productTotals.stockValue).toFixed(2) : '0.00'}x
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            </TableFooter>
                          )}
                        </Table>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-3">
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                          <span>Cobertura: </span>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1">7-45d</Badge> Ideal
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1">45-90d</Badge> Atenção
                          <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1">&gt;90d</Badge> Excesso
                        </div>
                        <div className="flex items-center gap-1">
                          <ShoppingCart className="h-3 w-3" /> Balcão/A Prazo
                          <Truck className="h-3 w-3 ml-2" /> Delivery (iFood+99+Próprio)
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===== ABA 2: PRODUTOS PARADOS ===== */}
            <TabsContent value="parados">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <PauseCircle className="h-5 w-5 text-destructive" /> Produtos Parados
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Sem vendas há mais de:</span>
                        <Select value={stoppedDaysFilter} onValueChange={setStoppedDaysFilter}>
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 dias</SelectItem>
                            <SelectItem value="60">60 dias</SelectItem>
                            <SelectItem value="90">90 dias</SelectItem>
                            <SelectItem value="120">120 dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {filtersBarContent}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingProducts ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="border-red-200 bg-red-50/50">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-sm text-red-700 mb-1">Capital Parado</div>
                            <div className="text-xl font-bold text-red-800">{formatCurrency(stoppedTotals.stockValue)}</div>
                          </CardContent>
                        </Card>
                        <Card className="border-amber-200 bg-amber-50/50">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-sm text-amber-700 mb-1">Produtos Parados</div>
                            <div className="text-xl font-bold text-amber-800">{stoppedTotals.count} itens</div>
                          </CardContent>
                        </Card>
                        <Card className="border-muted">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-sm text-muted-foreground mb-1">% do Estoque Total</div>
                            <div className="text-xl font-bold">
                              {categoryTotals.stockValue > 0 ? ((stoppedTotals.stockValue / categoryTotals.stockValue) * 100).toFixed(1) : '0.0'}%
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleStoppedSort('productName')}>
                                <span className="flex items-center">Produto<SortIcon field="productName" activeField={stoppedSortField} activeDir={stoppedSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleStoppedSort('currentStock')}>
                                <span className="flex items-center justify-end">Qtd<SortIcon field="currentStock" activeField={stoppedSortField} activeDir={stoppedSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleStoppedSort('avgCost')}>
                                <span className="flex items-center justify-end">Custo Médio<SortIcon field="avgCost" activeField={stoppedSortField} activeDir={stoppedSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleStoppedSort('stockValue')}>
                                <span className="flex items-center justify-end">Valor Parado<SortIcon field="stockValue" activeField={stoppedSortField} activeDir={stoppedSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right">Última Venda</TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleStoppedSort('daysSinceLastSale')}>
                                <span className="flex items-center justify-end">Dias Sem Venda<SortIcon field="daysSinceLastSale" activeField={stoppedSortField} activeDir={stoppedSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right">Última Compra</TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleStoppedSort('entriesInPeriod')}>
                                <span className="flex items-center justify-end">Entradas<SortIcon field="entriesInPeriod" activeField={stoppedSortField} activeDir={stoppedSortDir} /></span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stoppedProducts.length > 0 ? stoppedProducts.map((prod: any) => (
                              <TableRow key={prod.productId}>
                                <TableCell className="font-medium max-w-[250px] truncate" title={prod.productName}>{prod.productName}</TableCell>
                                <TableCell className="text-right font-mono">{formatNumber(prod.currentStock)}</TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(prod.avgCost)}</TableCell>
                                <TableCell className="text-right font-mono font-medium text-red-600">{formatCurrency(prod.stockValue)}</TableCell>
                                <TableCell className="text-right text-sm">
                                  {prod.lastSaleDate ? new Date(prod.lastSaleDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : <span className="text-muted-foreground">Nunca</span>}
                                </TableCell>
                                <TableCell className="text-right">{getDaysSinceLastSaleBadge(prod.daysSinceLastSale)}</TableCell>
                                <TableCell className="text-right text-sm">
                                  {prod.lastPurchaseDate ? new Date(prod.lastPurchaseDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {prod.entriesInPeriod > 0 ? <span className="font-mono">{prod.entriesInPeriod} ({formatNumber(prod.totalPurchased)} un)</span> : '—'}
                                </TableCell>
                              </TableRow>
                            )) : (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum produto parado encontrado com o filtro atual</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                          {stoppedProducts.length > 0 && (
                            <TableFooter>
                              <TableRow className="font-bold bg-muted/50">
                                <TableCell>Total ({stoppedProducts.length} produtos)</TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-right font-mono text-red-600">{formatCurrency(stoppedTotals.stockValue)}</TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            </TableFooter>
                          )}
                        </Table>
                      </div>
                      <div className="mt-4 text-xs text-muted-foreground border-t pt-3">
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                          <span>Produtos com estoque mas sem vendas no período selecionado. Considere promoções ou remoção do catálogo.</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===== ABA 3: CLASSIFICAÇÃO ABC ===== */}
            <TabsContent value="abc">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <LayoutGrid className="h-5 w-5 text-primary" /> Classificação ABC
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Classificação:</span>
                        <Select value={abcFilter} onValueChange={setAbcFilter}>
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="A">Classe A</SelectItem>
                            <SelectItem value="B">Classe B</SelectItem>
                            <SelectItem value="C">Classe C</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {filtersBarContent}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingProducts ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className={`border-green-200 bg-green-50/50 cursor-pointer transition-shadow ${abcFilter === 'A' ? 'ring-2 ring-green-400' : 'hover:shadow-md'}`}
                          onClick={() => setAbcFilter(abcFilter === 'A' ? 'all' : 'A')}>
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-lg px-3">A</Badge>
                              <span className="text-sm text-green-700">80% do faturamento</span>
                            </div>
                            <div className="text-lg font-bold text-green-800">{abcSummary.A.count} produtos</div>
                            <div className="text-sm text-green-700">CMV: {formatCurrency(abcSummary.A.cmv)}</div>
                            <div className="text-sm text-green-600">Estoque: {formatCurrency(abcSummary.A.value)}</div>
                          </CardContent>
                        </Card>
                        <Card className={`border-amber-200 bg-amber-50/50 cursor-pointer transition-shadow ${abcFilter === 'B' ? 'ring-2 ring-amber-400' : 'hover:shadow-md'}`}
                          onClick={() => setAbcFilter(abcFilter === 'B' ? 'all' : 'B')}>
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-lg px-3">B</Badge>
                              <span className="text-sm text-amber-700">15% do faturamento</span>
                            </div>
                            <div className="text-lg font-bold text-amber-800">{abcSummary.B.count} produtos</div>
                            <div className="text-sm text-amber-700">CMV: {formatCurrency(abcSummary.B.cmv)}</div>
                            <div className="text-sm text-amber-600">Estoque: {formatCurrency(abcSummary.B.value)}</div>
                          </CardContent>
                        </Card>
                        <Card className={`border-red-200 bg-red-50/50 cursor-pointer transition-shadow ${abcFilter === 'C' ? 'ring-2 ring-red-400' : 'hover:shadow-md'}`}
                          onClick={() => setAbcFilter(abcFilter === 'C' ? 'all' : 'C')}>
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-red-100 text-red-800 border-red-200 text-lg px-3">C</Badge>
                              <span className="text-sm text-red-700">5% do faturamento</span>
                            </div>
                            <div className="text-lg font-bold text-red-800">{abcSummary.C.count} produtos</div>
                            <div className="text-sm text-red-700">CMV: {formatCurrency(abcSummary.C.cmv)}</div>
                            <div className="text-sm text-red-600">Estoque: {formatCurrency(abcSummary.C.value)}</div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px] cursor-pointer hover:text-foreground" onClick={() => handleAbcSort('abcClass')}>
                                <span className="flex items-center">ABC<SortIcon field="abcClass" activeField={abcSortField} activeDir={abcSortDir} /></span>
                              </TableHead>
                              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleAbcSort('productName')}>
                                <span className="flex items-center">Produto<SortIcon field="productName" activeField={abcSortField} activeDir={abcSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleAbcSort('currentStock')}>
                                <span className="flex items-center justify-end">Qtd<SortIcon field="currentStock" activeField={abcSortField} activeDir={abcSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleAbcSort('stockValue')}>
                                <span className="flex items-center justify-end">Valor Estoque<SortIcon field="stockValue" activeField={abcSortField} activeDir={abcSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleAbcSort('cmv')}>
                                <span className="flex items-center justify-end">CMV<SortIcon field="cmv" activeField={abcSortField} activeDir={abcSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right">% CMV Acum.</TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleAbcSort('qtdSold')}>
                                <span className="flex items-center justify-end">Vendido<SortIcon field="qtdSold" activeField={abcSortField} activeDir={abcSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleAbcSort('turnover')}>
                                <span className="flex items-center justify-end">Giro<SortIcon field="turnover" activeField={abcSortField} activeDir={abcSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleAbcSort('daysOfStock')}>
                                <span className="flex items-center justify-end">Cobertura<SortIcon field="daysOfStock" activeField={abcSortField} activeDir={abcSortDir} /></span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const totalCmv = clientFilteredProducts.reduce((s: number, p: any) => s + p.cmv, 0);
                              // For % CMV Acum, we need to sort by CMV desc to accumulate correctly
                              const sortedByCmv = [...clientFilteredProducts].sort((a: any, b: any) => b.cmv - a.cmv);
                              const accMap = new Map<number, number>();
                              let acc = 0;
                              for (const p of sortedByCmv) {
                                acc += (p as any).cmv;
                                accMap.set((p as any).productId, totalCmv > 0 ? (acc / totalCmv) * 100 : 0);
                              }

                              return abcProducts.length > 0 ? abcProducts.map((prod: any) => {
                                const accPct = accMap.get(prod.productId) || 0;
                                return (
                                  <TableRow key={prod.productId} className={
                                    prod.abcClass === 'A' ? 'bg-green-50/30' :
                                    prod.abcClass === 'B' ? 'bg-amber-50/30' : 'bg-red-50/20'
                                  }>
                                    <TableCell>{getAbcBadge(prod.abcClass)}</TableCell>
                                    <TableCell className="font-medium max-w-[250px] truncate" title={prod.productName}>{prod.productName}</TableCell>
                                    <TableCell className="text-right font-mono">{formatNumber(prod.currentStock)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(prod.stockValue)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(prod.cmv)}</TableCell>
                                    <TableCell className="text-right font-mono text-muted-foreground">{accPct.toFixed(1)}%</TableCell>
                                    <TableCell className="text-right font-mono">{formatNumber(prod.qtdSold)}</TableCell>
                                    <TableCell className={`text-right font-mono ${getTurnoverColor(prod.turnover)}`}>{prod.turnover.toFixed(2)}x</TableCell>
                                    <TableCell className="text-right">{getDaysOfStockBadge(prod.daysOfStock)}</TableCell>
                                  </TableRow>
                                );
                              }) : (
                                <TableRow>
                                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum produto encontrado</TableCell>
                                </TableRow>
                              );
                            })()}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="mt-4 text-xs text-muted-foreground border-t pt-3 space-y-1">
                        <p><strong>Classe A</strong>: Produtos que representam 80% do CMV. Alta prioridade de reposição e controle.</p>
                        <p><strong>Classe B</strong>: Próximos 15% do CMV. Prioridade intermediária.</p>
                        <p><strong>Classe C</strong>: Últimos 5% do CMV. Menor giro, avaliar necessidade de manter em estoque.</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            {/* ===== ABA 4: EVOLUÇÃO MENSAL ===== */}
            <TabsContent value="evolucao">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <LineChart className="h-5 w-5 text-primary" /> Evolução Mensal do Estoque
                    </CardTitle>
                    {/* Filtros: Ano, Categoria, Subcategoria */}
                    <div className="flex flex-wrap items-center gap-3">
                      <Select value={String(evolutionYear)} onValueChange={(v) => setEvolutionYear(Number(v))}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Ano" />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map(y => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={evolutionCategoryId ? String(evolutionCategoryId) : "all"}
                        onValueChange={(v) => {
                          setEvolutionCategoryId(v === "all" ? undefined : Number(v));
                          setEvolutionSubcategory(undefined);
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas Categorias</SelectItem>
                          {categoryOptions.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {evolutionCategoryId && evolutionSubcategories && evolutionSubcategories.length > 0 && (
                        <Select
                          value={evolutionSubcategory || "all"}
                          onValueChange={(v) => setEvolutionSubcategory(v === "all" ? undefined : v)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Subcategoria" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas Subcategorias</SelectItem>
                            {evolutionSubcategories.map((sub: string) => (
                              <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingEvolution ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : monthlyEvolution && monthlyEvolution.length > 0 ? (
                    <>
                      {/* Gráfico de barras com escala proporcional */}
                      <div className="mb-6">
                        <div className="text-sm font-medium text-muted-foreground mb-3">Valor do Estoque (R$)</div>
                        <div className="flex items-end gap-1" style={{ height: '220px' }}>
                          {(() => {
                            const values = monthlyEvolution.map((m: any) => m.totalValue);
                            const maxVal = Math.max(...values);
                            const minVal = Math.min(...values);
                            // Usar escala relativa para que diferenças fiquem visíveis
                            const range = maxVal - minVal;
                            const chartBase = range > 0 ? minVal * 0.95 : maxVal * 0.5;
                            const chartRange = maxVal - chartBase;
                            return monthlyEvolution.map((m: any, i: number) => {
                              const barHeight = chartRange > 0 
                                ? Math.max(((m.totalValue - chartBase) / chartRange) * 170, 4)
                                : 85;
                              return (
                                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                                  <div className="text-[10px] text-muted-foreground font-mono truncate w-full text-center">
                                    {formatCurrency(m.totalValue).replace('R$\u00a0', 'R$')}
                                  </div>
                                  <div
                                    className={`w-full rounded-t transition-all ${
                                      i === monthlyEvolution.length - 1 ? 'bg-primary' : 'bg-primary/40'
                                    }`}
                                    style={{ height: `${barHeight}px` }}
                                    title={`${m.monthLabel}: ${formatCurrency(m.totalValue)}`}
                                  />
                                  <div className="text-[10px] text-muted-foreground">{m.monthLabel}</div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Tabela detalhada */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Mês</TableHead>
                              <TableHead className="text-right">Valor Estoque</TableHead>
                              <TableHead className="text-right">Variação</TableHead>
                              <TableHead className="text-right">CMV</TableHead>
                              <TableHead className="text-right">Giro</TableHead>
                              <TableHead className="text-right">Qtd Itens</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthlyEvolution.map((m: any, i: number) => {
                              const prev = i > 0 ? monthlyEvolution[i - 1] : null;
                              const variation = prev && prev.totalValue > 0
                                ? ((m.totalValue - prev.totalValue) / prev.totalValue) * 100
                                : null;
                              return (
                                <TableRow key={m.month} className={i === monthlyEvolution.length - 1 ? 'bg-primary/5 font-medium' : ''}>
                                  <TableCell className="font-medium">{m.monthLabel}</TableCell>
                                  <TableCell className="text-right font-mono">{formatCurrency(m.totalValue)}</TableCell>
                                  <TableCell className={`text-right font-mono ${
                                    variation !== null && variation > 0 ? 'text-red-600' :
                                    variation !== null && variation < 0 ? 'text-green-600' : 'text-muted-foreground'
                                  }`}>
                                    {variation !== null ? (
                                      <span className="flex items-center justify-end gap-1">
                                        {variation > 0 ? <TrendingUp className="h-3 w-3" /> : variation < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                                        {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                                      </span>
                                    ) : '—'}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">{formatCurrency(m.cmv)}</TableCell>
                                  <TableCell className={`text-right font-mono ${getTurnoverColor(m.turnover)}`}>{m.turnover.toFixed(2)}x</TableCell>
                                  <TableCell className="text-right font-mono">{formatNumber(m.totalQuantity)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="mt-4 text-xs text-muted-foreground border-t pt-3">
                        <p>A evolução é calculada retroativamente a partir do estoque atual, descontando compras, vendas e movimentações de cada mês. O mês atual (destacado) reflete o estoque em tempo real.</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">Sem dados de evolução disponíveis para {evolutionYear}</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===== ABA 5: RUPTURA DE ESTOQUE ===== */}
            <TabsContent value="ruptura">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PackageX className="h-5 w-5 text-destructive" /> Ruptura de Estoque
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Produtos com estoque zerado e estimativa de impacto nas vendas</p>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingStockOut ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : (
                    <>
                      {/* Cards resumo */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <Card className="border-red-200 bg-red-50/50">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-sm text-red-700">Produtos sem Estoque</div>
                            <div className="text-2xl font-bold text-red-800">{rupturaTotals.count}</div>
                          </CardContent>
                        </Card>
                        <Card className="border-amber-200 bg-amber-50/50">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-sm text-amber-700">Receita Perdida Estimada</div>
                            <div className="text-2xl font-bold text-amber-800">{formatCurrency(rupturaTotals.lostRevenue)}</div>
                          </CardContent>
                        </Card>
                        <Card className="border-green-200 bg-green-50/50">
                          <CardContent className="pt-4 pb-4">
                            <div className="text-sm text-green-700">Classe A sem Estoque</div>
                            <div className="text-2xl font-bold text-green-800">{rupturaTotals.avgA} <span className="text-sm font-normal">produtos</span></div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 pb-4">
                            <div className="text-sm text-muted-foreground">Classe B / C sem Estoque</div>
                            <div className="text-2xl font-bold">{rupturaTotals.avgB} / {rupturaTotals.avgC}</div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Tabela */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">ABC</TableHead>
                              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleRupturaSort('productName')}>
                                <span className="flex items-center">Produto<SortIcon field="productName" activeField={rupturaSortField} activeDir={rupturaSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleRupturaSort('daysOutOfStock')}>
                                <span className="flex items-center justify-end">Dias sem Estoque<SortIcon field="daysOutOfStock" activeField={rupturaSortField} activeDir={rupturaSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleRupturaSort('avgDailySales')}>
                                <span className="flex items-center justify-end">Média Diária<SortIcon field="avgDailySales" activeField={rupturaSortField} activeDir={rupturaSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleRupturaSort('totalSales90d')}>
                                <span className="flex items-center justify-end">Vendas 90d<SortIcon field="totalSales90d" activeField={rupturaSortField} activeDir={rupturaSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleRupturaSort('estimatedLostRevenue')}>
                                <span className="flex items-center justify-end">Receita Perdida Est.<SortIcon field="estimatedLostRevenue" activeField={rupturaSortField} activeDir={rupturaSortDir} /></span>
                              </TableHead>
                              <TableHead className="text-right">Última Compra</TableHead>
                              <TableHead className="text-right">Categoria</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedStockOut.length > 0 ? sortedStockOut.map((prod: any) => (
                              <TableRow key={prod.productId} className={
                                prod.abcClass === 'A' ? 'bg-red-50/30' :
                                prod.abcClass === 'B' ? 'bg-amber-50/20' : ''
                              }>
                                <TableCell>{getAbcBadge(prod.abcClass)}</TableCell>
                                <TableCell className="font-medium max-w-[250px] truncate" title={prod.productName}>{prod.productName}</TableCell>
                                <TableCell className="text-right">
                                  {prod.daysOutOfStock > 0 ? (
                                    <Badge variant={prod.daysOutOfStock > 30 ? 'destructive' : 'outline'}
                                      className={prod.daysOutOfStock > 30 ? 'bg-red-100 text-red-700 border-red-200' : prod.daysOutOfStock > 14 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}>
                                      {prod.daysOutOfStock}d
                                    </Badge>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {prod.avgDailySales > 0 ? formatNumber(prod.avgDailySales, 1) + '/dia' : <span className="text-muted-foreground">0</span>}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {prod.totalSales90d > 0 ? formatNumber(prod.totalSales90d) + ' un' : <span className="text-muted-foreground">0</span>}
                                </TableCell>
                                <TableCell className={`text-right font-mono ${prod.estimatedLostRevenue > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                  {prod.estimatedLostRevenue > 0 ? formatCurrency(prod.estimatedLostRevenue) : '—'}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {prod.lastPurchaseDate ? (
                                    new Date(prod.lastPurchaseDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                                  ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">{prod.categoryName}</TableCell>
                              </TableRow>
                            )) : (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                  <div className="flex flex-col items-center gap-2">
                                    <Package className="h-8 w-8 text-green-500" />
                                    <span>Nenhum produto em ruptura de estoque</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="mt-4 text-xs text-muted-foreground border-t pt-3 space-y-1">
                        <p><strong>Dias sem Estoque</strong>: Dias desde a última movimentação do produto (quando o estoque zerou).</p>
                        <p><strong>Média Diária</strong>: Média de vendas por dia nos últimos 90 dias. Quanto maior, mais crítica a ruptura.</p>
                        <p><strong>Receita Perdida Est.</strong>: Estimativa de receita perdida = dias sem estoque × média diária × preço médio de venda.</p>
                        <p>Produtos <strong>Classe A</strong> em ruptura devem ser priorizados para reposição imediata.</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
