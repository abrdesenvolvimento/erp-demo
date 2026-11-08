import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/useDebounce";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  Eye,
  Loader2,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  consumptionCurrency,
  consumptionDateTime,
  consumptionNumber,
  consumptionPermissions,
  currentConsumptionMonth,
  estimatedConsumptionCost,
  getConsumptionAttempt,
  positiveIntegerQuantity,
  validateConsumptionDraft,
  validConsumptionPeriod,
  type ConsumptionDraftItem,
  type ConsumptionPayload,
  type ConsumptionProduct,
  type ConsumptionScope,
  type RequestAttempt,
} from "@/components/consumo/consumptionUi";

const PAGE_SIZE = 20;
const ACCENT_BUTTON =
  "bg-sidebar-primary text-white hover:bg-sidebar-primary/90";
const MODAL_CLASS = "max-h-[90dvh] overflow-y-auto sm:max-w-2xl";
type Employee = { id: number; name: string; active: boolean };
type HistoryItem = {
  id?: number;
  productId?: number;
  productName?: string | null;
  name?: string;
  quantity: string | number;
  unitCost: string | number;
  totalCost: string | number;
  uom?: string | null;
};

function InlineError({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {retry && (
        <Button size="sm" variant="outline" onClick={retry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={
        status === "ACTIVE"
          ? "border-sidebar-primary/25 bg-sidebar-primary/10"
          : "bg-muted text-muted-foreground"
      }
    >
      {status === "ACTIVE" ? "Ativo" : "Cancelado"}
    </Badge>
  );
}

function HistoricalItems({
  items,
  stock = false,
}: {
  items: HistoryItem[];
  stock?: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={`${item.id ?? item.productId ?? index}-${index}`}
          className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-3 text-sm"
        >
          <div className="min-w-0">
            <p className="break-words font-medium">
              {item.productName || item.name || "Produto registrado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {consumptionNumber(item.quantity)} {item.uom || "un."} · Custo
              unitário {consumptionCurrency(item.unitCost)}
            </p>
          </div>
          <p className="self-center font-medium tabular-nums">
            {consumptionCurrency(item.totalCost)}
          </p>
        </div>
      ))}
      {!items.length && (
        <p className="text-sm text-muted-foreground">
          {stock ? "Nenhuma baixa registrada." : "Nenhum item registrado."}
        </p>
      )}
    </div>
  );
}

export default function Consumo() {
  const { user } = useAuth();
  const { activeCompanyId, activeBranchId, activeCompany, loading, switching } =
    useCompany();
  const role = activeCompany?.role || user?.role;
  const permissions = consumptionPermissions(role);
  const scopeReady =
    Boolean(user) &&
    !loading &&
    !switching &&
    activeCompanyId !== null &&
    activeBranchId !== null;

  return (
    <DashboardLayout>
      {!permissions.canView && !loading ? (
        <Card>
          <CardContent className="py-8">
            <ShieldCheck className="mb-3 h-6 w-6 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Consumo interno</h1>
            <p className="mt-2 text-muted-foreground">
              Seu perfil não tem acesso a esta consulta.
            </p>
          </CardContent>
        </Card>
      ) : !scopeReady ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm text-muted-foreground">
              {switching || loading
                ? "Preparando o contexto da empresa…"
                : "Selecione uma empresa e uma filial para consultar o consumo interno."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ConsumptionWorkspace
          key={`${activeCompanyId}:${activeBranchId}`}
          scope={{ companyId: activeCompanyId!, branchId: activeBranchId! }}
          role={role}
        />
      )}
    </DashboardLayout>
  );
}

function ConsumptionWorkspace({
  scope: initialScope,
  role,
}: {
  scope: ConsumptionScope;
  role: string | undefined;
}) {
  // A chave do workspace remonta e limpa filtros, seleções, detalhes e rascunho ao trocar o contexto.
  const scope = useMemo(
    () => initialScope,
    [initialScope.companyId, initialScope.branchId]
  );
  const { canCreate, isAdmin } = consumptionPermissions(role);
  const utils = trpc.useUtils();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [period, setPeriod] = useState(() => currentConsumptionMonth());
  const [employeeFilter, setEmployeeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "CANCELLED"
  >("ALL");
  const [page, setPage] = useState(1);
  const periodValid = validConsumptionPeriod(period.startDate, period.endDate);
  const listInput = useMemo(
    () => ({
      ...scope,
      startDate: period.startDate || undefined,
      endDate: period.endDate || undefined,
      employeeId: employeeFilter === "ALL" ? undefined : Number(employeeFilter),
      status: statusFilter === "ALL" ? undefined : statusFilter,
      page,
      pageSize: PAGE_SIZE,
    }),
    [
      scope,
      period.startDate,
      period.endDate,
      employeeFilter,
      statusFilter,
      page,
    ]
  );
  const employeeInput = useMemo(
    () => ({ ...scope, includeInactive: true }),
    [scope]
  );
  // TODOS os inputs contêm o escopo. Não reaproveitar cache com chave sem companyId/branchId.
  const listQuery = trpc.consumption.list.useQuery(listInput, {
    enabled: periodValid,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const employeeQuery = trpc.consumption.employees.useQuery(employeeInput, {
    staleTime: 0,
    refetchOnMount: "always",
  });
  const employees = employeeQuery.data ?? [];
  const activeEmployees = employees.filter(employee => employee.active);
  const records = periodValid ? listQuery.data : undefined;
  const pageCount = Math.max(1, Math.ceil((records?.total ?? 0) / PAGE_SIZE));
  useEffect(() => {
    if (records && page > pageCount) setPage(pageCount);
  }, [records, pageCount, page]);

  const [createOpen, setCreateOpen] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<ConsumptionDraftItem[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const debouncedSearch = useDebounce(productSearch.trim(), 300);
  const productInput = useMemo(
    () => ({ ...scope, search: debouncedSearch || undefined }),
    [scope, debouncedSearch]
  );
  const productsQuery = trpc.consumption.products.useQuery(productInput, {
    enabled: canCreate && createOpen && productOpen,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const searching = productSearch.trim() !== debouncedSearch;
  const [createError, setCreateError] = useState<string | null>(null);
  const requestAttempt = useRef<RequestAttempt | null>(null);
  const creating = useRef(false);
  const selectedEmployee = activeEmployees.find(
    employee => employee.id === employeeId
  );
  const draftError = validateConsumptionDraft(
    employeeId,
    Boolean(selectedEmployee),
    reason,
    items
  );
  const estimate = useMemo(() => estimatedConsumptionCost(items), [items]);
  const units = items.reduce(
    (sum, item) => sum + (positiveIntegerQuantity(item.quantity) ?? 0),
    0
  );
  const [detailId, setDetailId] = useState<number | null>(null);
  const detailInput = useMemo(
    () => ({ ...scope, id: detailId ?? 0 }),
    [scope, detailId]
  );
  const detailQuery = trpc.consumption.get.useQuery(detailInput, {
    enabled: detailId !== null,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const detail = detailQuery.data;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancelling = useRef(false);

  async function invalidateStockAndConsumption() {
    await Promise.all([
      utils.consumption.invalidate(),
      utils.products.invalidate(),
      utils.stockAnalysis.invalidate(),
      utils.stockMovements.invalidate(),
    ]);
  }

  const createMutation = trpc.consumption.create.useMutation({ retry: false });
  const cancelMutation = trpc.consumption.cancel.useMutation({ retry: false });
  const [staffOpen, setStaffOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [staffError, setStaffError] = useState<string | null>(null);
  const savingStaff = useRef(false);
  const employeeMutation = trpc.consumption.saveEmployee.useMutation({
    retry: false,
  });
  const busy =
    createMutation.isPending ||
    cancelMutation.isPending ||
    employeeMutation.isPending;

  function changePayload(change: () => void) {
    if (creating.current) return;
    // A comparação do payload normalizado na submissão troca a chave somente
    // quando ele muda de fato (ex.: espaços no motivo não podem duplicar a baixa).
    setCreateError(null);
    setConfirmCreate(false);
    change();
  }

  function resetDraft() {
    requestAttempt.current = null;
    setEmployeeId(null);
    setReason("");
    setItems([]);
    setProductSearch("");
    setProductOpen(false);
    setCreateError(null);
  }

  function addProduct(product: ConsumptionProduct) {
    if (items.some(item => item.product.id === product.id)) return;
    changePayload(() =>
      setItems(previous => [...previous, { product, quantity: "1" }])
    );
    setProductOpen(false);
    setProductSearch("");
  }

  async function submitConsumption() {
    if (creating.current || !canCreate) return;
    if (draftError) {
      setCreateError(draftError);
      return;
    }
    const payload: ConsumptionPayload = {
      ...scope,
      employeeId: employeeId!,
      reason: reason.trim(),
      items: items.map(item => ({
        productId: item.product.id,
        quantity: positiveIntegerQuantity(item.quantity)!,
      })),
    };
    requestAttempt.current = getConsumptionAttempt(
      requestAttempt.current,
      payload
    );
    creating.current = true;
    setCreateError(null);
    try {
      const result = await createMutation.mutateAsync({
        ...payload,
        requestKey: requestAttempt.current.requestKey,
      });
      if (alive.current) {
        resetDraft();
        setConfirmCreate(false);
        setCreateOpen(false);
        setDetailId(result.id);
        toast.success(
          result.replayed
            ? "Este consumo já estava registrado. Nenhuma nova baixa foi feita."
            : "Consumo registrado. Estoque atualizado."
        );
      }
      // Erro ao atualizar a consulta não transforma um lançamento confirmado em falha/reenvio.
      await invalidateStockAndConsumption().catch(() => {
        if (alive.current)
          toast.warning(
            "Consumo registrado. Atualize a consulta para ver os saldos."
          );
      });
    } catch (error) {
      if (alive.current) {
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível registrar o consumo.";
        setCreateError(message);
        setConfirmCreate(false);
        toast.error(message);
      }
      // Mantém requestAttempt no erro para repetir com a MESMA chave até sucesso ou mudança no payload.
    } finally {
      creating.current = false;
    }
  }

  async function submitCancellation() {
    if (
      cancelling.current ||
      !isAdmin ||
      !detail ||
      detail.status !== "ACTIVE" ||
      cancellationReason.trim().length < 3
    )
      return;
    cancelling.current = true;
    setCancelError(null);
    try {
      await cancelMutation.mutateAsync({
        ...scope,
        id: detail.id,
        reason: cancellationReason.trim(),
      });
      if (alive.current) {
        setCancelOpen(false);
        setCancellationReason("");
        toast.success(
          "Consumo cancelado. Baixa estornada e histórico preservado."
        );
      }
      await invalidateStockAndConsumption().catch(() => {
        if (alive.current)
          toast.warning(
            "Cancelamento concluído. Atualize a consulta para ver os saldos."
          );
      });
    } catch (error) {
      if (alive.current)
        setCancelError(
          error instanceof Error
            ? error.message
            : "Não foi possível cancelar o consumo."
        );
    } finally {
      cancelling.current = false;
    }
  }

  async function saveEmployee(employee?: Employee) {
    if (savingStaff.current || !isAdmin) return;
    const name = employee?.name ?? employeeName.trim();
    if (name.length < 2) {
      setStaffError(
        "Informe o nome do funcionário com pelo menos 2 caracteres."
      );
      return;
    }
    savingStaff.current = true;
    setStaffError(null);
    try {
      await employeeMutation.mutateAsync({
        ...scope,
        id: employee?.id ?? editingEmployee?.id,
        name,
        active: employee ? !employee.active : (editingEmployee?.active ?? true),
      });
      if (alive.current) {
        setEditingEmployee(null);
        setEmployeeName("");
        toast.success(
          employee
            ? "Situação do funcionário atualizada."
            : "Funcionário salvo."
        );
      }
      await utils.consumption.employees.invalidate().catch(() => {});
    } catch (error) {
      if (alive.current)
        setStaffError(
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o funcionário."
        );
    } finally {
      savingStaff.current = false;
    }
  }

  function setCreateVisibility(open: boolean) {
    if (creating.current) return;
    setCreateOpen(open);
    if (!open) {
      setProductOpen(false);
      setConfirmCreate(false);
    }
    // Fechar após erro não descarta a chave: o rascunho pode ser retomado sem duplicar a baixa.
  }

  return (
    <div className="min-w-0 space-y-5 overflow-hidden pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <PackageOpen className="h-4 w-4 text-sidebar-primary" />
            Controle de estoque
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Consumo interno</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Consumo por funcionário, com baixa de estoque pelo custo. Não gera
            venda, faturamento ou contas a receber.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {isAdmin && (
            <Button
              variant="outline"
              className="min-h-10"
              disabled={busy}
              onClick={() => setStaffOpen(true)}
            >
              <Users className="h-4 w-4" />
              Funcionários
            </Button>
          )}
          {canCreate && (
            <Button
              className={`${ACCENT_BUTTON} min-h-10`}
              disabled={busy}
              onClick={() => setCreateVisibility(true)}
            >
              <Plus className="h-4 w-4" />
              Registrar consumo
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Custo consumido",
            value: consumptionCurrency(records?.summary.totalCost),
            icon: Wallet,
            description: "Custo definitivo dos consumos ativos",
          },
          {
            label: "Lançamentos",
            value: consumptionNumber(records?.summary.records),
            icon: ClipboardList,
            description: "Consumos ativos no período filtrado",
          },
          {
            label: "Unidades",
            value: consumptionNumber(records?.summary.units),
            icon: PackageOpen,
            description: "Quantidades dos itens consumidos",
          },
        ].map(card => (
          <Card key={card.label} className="shadow-sm">
            <CardContent className="flex items-start gap-3 pt-5">
              <div className="rounded-lg bg-muted p-2 text-sidebar-primary">
                <card.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="mt-1 break-words text-2xl font-semibold tabular-nums">
                  {listQuery.isLoading && periodValid ? "…" : card.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {card.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de consumo</CardTitle>
          <CardDescription>
            Consulte o período em Brasília e acompanhe lançamentos e
            cancelamentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_1fr_auto]">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="consumption-start">De</Label>
              <Input
                id="consumption-start"
                className="min-w-0 w-full"
                type="date"
                value={period.startDate}
                onChange={event => {
                  setPeriod(previous => ({
                    ...previous,
                    startDate: event.target.value,
                  }));
                  setPage(1);
                }}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="consumption-end">Até</Label>
              <Input
                id="consumption-end"
                className="min-w-0 w-full"
                type="date"
                value={period.endDate}
                onChange={event => {
                  setPeriod(previous => ({
                    ...previous,
                    endDate: event.target.value,
                  }));
                  setPage(1);
                }}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="consumption-employee-filter">Funcionário</Label>
              <Select
                value={employeeFilter}
                onValueChange={value => {
                  setEmployeeFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  id="consumption-employee-filter"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os funcionários</SelectItem>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={String(employee.id)}>
                      {employee.name}
                      {!employee.active && " (inativo)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="consumption-status">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={value => {
                  setStatusFilter(value as typeof statusFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger id="consumption-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="ACTIVE">Ativos</SelectItem>
                  <SelectItem value="CANCELLED">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              className="self-end"
              onClick={() => {
                setPeriod(currentConsumptionMonth());
                setEmployeeFilter("ALL");
                setStatusFilter("ALL");
                setPage(1);
              }}
            >
              Mês atual
            </Button>
          </div>
          {!periodValid && (
            <InlineError message="Informe datas válidas; a data inicial não pode ser posterior à data final." />
          )}
          {employeeQuery.isError && (
            <InlineError
              message={`Não foi possível carregar os funcionários: ${employeeQuery.error.message}`}
              retry={() => void employeeQuery.refetch()}
            />
          )}
          {periodValid && listQuery.isError && (
            <InlineError
              message={listQuery.error.message}
              retry={() => void listQuery.refetch()}
            />
          )}
          {periodValid && listQuery.isLoading ? (
            <div
              role="status"
              className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando consumos…
            </div>
          ) : periodValid &&
            !listQuery.isError &&
            records?.items.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <PackageOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Nenhum consumo neste período</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajuste os filtros
                {canCreate
                  ? " ou registre o primeiro consumo interno."
                  : " para consultar outros lançamentos."}
              </p>
            </div>
          ) : (
            records &&
            !listQuery.isError && (
              <>
                <div className="hidden max-w-full overflow-x-auto rounded-lg border md:block">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-muted/40 text-left text-muted-foreground">
                      <tr>
                        <th className="p-3 font-medium">Data / registro</th>
                        <th className="p-3 font-medium">
                          Funcionário / motivo
                        </th>
                        <th className="p-3 font-medium">Registrado por</th>
                        <th className="p-3 text-right font-medium">Custo</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3">
                          <span className="sr-only">Detalhes</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.items.map(record => (
                        <tr
                          key={record.id}
                          className="border-t hover:bg-muted/25"
                        >
                          <td className="whitespace-nowrap p-3">
                            <p>{consumptionDateTime(record.consumedAt)}</p>
                            <p className="text-xs text-muted-foreground">
                              #{record.id}
                            </p>
                          </td>
                          <td className="max-w-xs p-3">
                            <p className="break-words font-medium">
                              {record.employeeName}
                            </p>
                            <p className="line-clamp-2 break-words text-xs text-muted-foreground">
                              {record.reason}
                            </p>
                          </td>
                          <td className="p-3">{record.createdByName || "—"}</td>
                          <td className="whitespace-nowrap p-3 text-right font-medium tabular-nums">
                            {consumptionCurrency(record.totalCost)}
                          </td>
                          <td className="p-3">
                            <StatusBadge status={record.status} />
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Ver consumo ${record.id}`}
                              onClick={() => setDetailId(record.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-3 md:hidden">
                  {records.items.map(record => (
                    <div key={record.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words font-medium">
                            {record.employeeName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {consumptionDateTime(record.consumedAt)} · #
                            {record.id}
                          </p>
                        </div>
                        <StatusBadge status={record.status} />
                      </div>
                      <p className="my-3 line-clamp-2 break-words text-sm text-muted-foreground">
                        {record.reason}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold tabular-nums">
                            {consumptionCurrency(record.totalCost)}
                          </p>
                          <p className="break-words text-xs text-muted-foreground">
                            Por {record.createdByName || "—"}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDetailId(record.id)}
                        >
                          <Eye className="h-4 w-4" />
                          Detalhes
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                  <p>
                    {consumptionNumber(records.total)} registros · Página {page}{" "}
                    de {pageCount}
                    {listQuery.isFetching && " · Atualizando…"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Página anterior"
                      disabled={page <= 1 || listQuery.isFetching}
                      onClick={() => setPage(previous => previous - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Próxima página"
                      disabled={page >= pageCount || listQuery.isFetching}
                      onClick={() => setPage(previous => previous + 1)}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )
          )}
        </CardContent>
      </Card>

      {records && !listQuery.isError && records.byEmployee.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-sidebar-primary" />
              Consumo por funcionário
            </CardTitle>
            <CardDescription>
              Consumos ativos no período filtrado, sem incluir cancelamentos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
              {records.byEmployee.map(employee => (
                <div
                  key={employee.employeeId}
                  className="flex items-start justify-between gap-3 border-b pb-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">
                      {employee.employeeName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {consumptionNumber(employee.records)} lançamento(s)
                    </p>
                  </div>
                  <p className="whitespace-nowrap font-semibold tabular-nums">
                    {consumptionCurrency(employee.totalCost)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {canCreate && (
        <Dialog open={createOpen} onOpenChange={setCreateVisibility}>
          <DialogContent
            className={MODAL_CLASS}
            showCloseButton={!createMutation.isPending}
            onEscapeKeyDown={event => {
              if (creating.current) event.preventDefault();
            }}
            onInteractOutside={event => {
              if (creating.current) event.preventDefault();
            }}
          >
            <DialogHeader>
              <DialogTitle>Registrar consumo</DialogTitle>
              <DialogDescription>
                Informe quem consumiu e os produtos. O custo definitivo será
                calculado no registro.
              </DialogDescription>
            </DialogHeader>
            <fieldset
              disabled={createMutation.isPending}
              className="min-w-0 space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="consumption-employee">Funcionário *</Label>
                <Select
                  value={employeeId ? String(employeeId) : ""}
                  onValueChange={value =>
                    changePayload(() => setEmployeeId(Number(value)))
                  }
                  disabled={
                    employeeQuery.isLoading ||
                    employeeQuery.isError ||
                    createMutation.isPending
                  }
                >
                  <SelectTrigger id="consumption-employee" className="w-full">
                    <SelectValue placeholder="Selecione um funcionário ativo" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeEmployees.map(employee => (
                      <SelectItem key={employee.id} value={String(employee.id)}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O funcionário não precisa ter uma conta de acesso ao sistema.
                </p>
                {employeeQuery.isError && (
                  <InlineError
                    message={employeeQuery.error.message}
                    retry={() => void employeeQuery.refetch()}
                  />
                )}
                {!employeeQuery.isLoading &&
                  !employeeQuery.isError &&
                  !activeEmployees.length && (
                    <p className="text-sm text-muted-foreground">
                      {isAdmin
                        ? "Cadastre um funcionário no botão Funcionários antes de registrar."
                        : "Peça ao administrador para cadastrar um funcionário."}
                    </p>
                  )}
              </div>
              <div className="space-y-1.5">
                <Label>Produtos *</Label>
                <Popover
                  open={productOpen}
                  onOpenChange={open => {
                    if (!creating.current) setProductOpen(open);
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={productOpen}
                      aria-label="Pesquisar produto para consumo"
                      className="min-h-10 w-full justify-between"
                      disabled={createMutation.isPending}
                    >
                      <span className="flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        Pesquisar e adicionar produto
                      </span>
                      <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-3rem)] p-0"
                  >
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Digite o nome do produto…"
                        value={productSearch}
                        onValueChange={setProductSearch}
                      />
                      <CommandList className="max-h-64">
                        {productsQuery.isLoading ||
                        productsQuery.isFetching ||
                        searching ? (
                          <div
                            role="status"
                            className="flex items-center gap-2 p-4 text-sm text-muted-foreground"
                          >
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Buscando produtos…
                          </div>
                        ) : productsQuery.isError ? (
                          <div className="p-2">
                            <InlineError
                              message={productsQuery.error.message}
                              retry={() => void productsQuery.refetch()}
                            />
                          </div>
                        ) : (
                          <>
                            <CommandEmpty>
                              Nenhum produto disponível. Tente outro nome.
                            </CommandEmpty>
                            <CommandGroup>
                              {productsQuery.data?.map(product => {
                                const selected = items.some(
                                  item => item.product.id === product.id
                                );
                                const unavailable =
                                  !product.isComposite &&
                                  Number(product.currentStock ?? 0) < 1;
                                return (
                                  <CommandItem
                                    key={product.id}
                                    value={String(product.id)}
                                    disabled={selected || unavailable}
                                    onSelect={() => addProduct(product)}
                                    className="items-start gap-2 py-3"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="break-words font-medium">
                                        {product.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {product.isComposite
                                          ? "Composto · baixa dos ingredientes"
                                          : `Estoque: ${consumptionNumber(product.currentStock)} ${product.uom}`}{" "}
                                        ·{" "}
                                        {product.isComposite
                                          ? "— será calculado"
                                          : consumptionCurrency(
                                              product.avgCost
                                            )}
                                      </p>
                                      {unavailable && (
                                        <p className="text-xs text-muted-foreground">
                                          Sem estoque disponível
                                        </p>
                                      )}
                                    </div>
                                    {selected && (
                                      <Check className="h-4 w-4 shrink-0" />
                                    )}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                      <div className="border-t p-2 text-xs text-muted-foreground">
                        Até 100 produtos por busca, da empresa e filial ativas.
                      </div>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                {items.map(item => {
                  const quantity = positiveIntegerQuantity(item.quantity);
                  const cost = estimatedConsumptionCost([item]);
                  const insufficient =
                    !item.product.isComposite &&
                    quantity !== null &&
                    quantity > Number(item.product.currentStock ?? 0);
                  return (
                    <div
                      key={item.product.id}
                      className="rounded-lg border p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium">
                            {item.product.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.product.isComposite
                              ? "Composto: disponibilidade validada nos ingredientes."
                              : `Estoque: ${consumptionNumber(item.product.currentStock)} ${item.product.uom}`}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          type="button"
                          aria-label={`Remover ${item.product.name}`}
                          disabled={createMutation.isPending}
                          onClick={() =>
                            changePayload(() =>
                              setItems(previous =>
                                previous.filter(
                                  row => row.product.id !== item.product.id
                                )
                              )
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                        <div className="space-y-1">
                          <Label
                            htmlFor={`quantity-${item.product.id}`}
                            className="text-xs"
                          >
                            Quantidade ({item.product.uom})
                          </Label>
                          <Input
                            id={`quantity-${item.product.id}`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={1}
                            value={item.quantity}
                            className="w-28"
                            aria-invalid={quantity === null || insufficient}
                            onChange={event =>
                              changePayload(() =>
                                setItems(previous =>
                                  previous.map(row =>
                                    row.product.id === item.product.id
                                      ? { ...row, quantity: event.target.value }
                                      : row
                                  )
                                )
                              )
                            }
                          />
                        </div>
                        <p className="text-right text-xs text-muted-foreground">
                          Custo estimado
                          <br />
                          <span className="text-sm font-medium text-foreground">
                            {cost === null
                              ? "— será calculado"
                              : consumptionCurrency(cost)}
                          </span>
                        </p>
                      </div>
                      {(quantity === null || insufficient) && (
                        <p className="mt-2 text-xs text-destructive">
                          {quantity === null
                            ? "Use uma quantidade inteira positiva."
                            : "Quantidade acima do estoque disponível."}
                        </p>
                      )}
                    </div>
                  );
                })}
                {!items.length && (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Adicione os produtos que foram consumidos.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <span>
                  {items.length} produto(s) · {consumptionNumber(units)}{" "}
                  unidade(s)
                </span>
                <span>
                  Custo estimado:{" "}
                  <strong>
                    {estimate === null
                      ? "— será calculado"
                      : consumptionCurrency(estimate)}
                  </strong>
                </span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="consumption-reason">Motivo do consumo *</Label>
                <Textarea
                  id="consumption-reason"
                  value={reason}
                  minLength={3}
                  maxLength={1000}
                  placeholder="Ex.: refeição da equipe durante o turno"
                  className="min-h-20 resize-y"
                  onChange={event =>
                    changePayload(() => setReason(event.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Obrigatório, com pelo menos 3 caracteres.
                </p>
              </div>
              <div className="flex gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                <ArrowDownToLine className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  A confirmação baixa o estoque disponível. Não é permitido
                  estoque negativo. Produtos compostos baixam seus ingredientes
                  e têm custo calculado pelo servidor. Apenas um administrador
                  pode cancelar com motivo e estorno auditado.
                </p>
              </div>
            </fieldset>
            {createError && <InlineError message={createError} />}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={createMutation.isPending}
                onClick={() => setCreateVisibility(false)}
              >
                Voltar
              </Button>
              <Button
                className={ACCENT_BUTTON}
                disabled={
                  createMutation.isPending ||
                  Boolean(draftError) ||
                  employeeQuery.isError
                }
                onClick={() => {
                  setCreateError(null);
                  setConfirmCreate(true);
                }}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="h-4 w-4" />
                )}
                Revisar e registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog
        open={confirmCreate && canCreate}
        onOpenChange={open => {
          if (!creating.current) setConfirmCreate(open);
        }}
      >
        <AlertDialogContent
          onEscapeKeyDown={event => {
            if (creating.current) event.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar baixa de estoque?</AlertDialogTitle>
            <AlertDialogDescription>
              Registrar consumo para {selectedEmployee?.name}, com{" "}
              {consumptionNumber(units)} unidade(s). O estoque será reduzido
              agora. Não haverá faturamento. Para reverter, um administrador
              deverá cancelar o registro com motivo; o histórico será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => setConfirmCreate(false)}
            >
              Revisar itens
            </Button>
            <Button
              className={ACCENT_BUTTON}
              disabled={createMutation.isPending || Boolean(draftError)}
              onClick={() => void submitConsumption()}
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {createMutation.isPending
                ? "Registrando…"
                : "Confirmar e baixar estoque"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={detailId !== null}
        onOpenChange={open => {
          if (!open && !cancelling.current) {
            setDetailId(null);
            setCancelOpen(false);
          }
        }}
      >
        <DialogContent
          className={MODAL_CLASS}
          showCloseButton={!cancelMutation.isPending}
          onEscapeKeyDown={event => {
            if (cancelling.current) event.preventDefault();
          }}
          onInteractOutside={event => {
            if (cancelling.current) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Consumo #{detailId}</DialogTitle>
            <DialogDescription>
              Itens, custos e responsáveis preservados no momento do lançamento.
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div role="status" className="flex items-center gap-2 py-8 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando detalhes…
            </div>
          ) : detailQuery.isError ? (
            <InlineError
              message={detailQuery.error.message}
              retry={() => void detailQuery.refetch()}
            />
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Funcionário</p>
                  <p className="break-words font-medium">
                    {detail.employeeName}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Status</p>
                  <StatusBadge status={detail.status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Consumido em (Brasília)
                  </p>
                  <p>{consumptionDateTime(detail.consumedAt)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Registrado por
                  </p>
                  <p className="break-words">{detail.createdByName || "—"}</p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">
                  Motivo do consumo
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {detail.reason}
                </p>
              </div>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Itens consumidos · custo definitivo
                </h3>
                <HistoricalItems items={detail.items} />
              </section>
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Baixas efetivas de estoque (ingredientes e produtos)
                </summary>
                <div className="mt-3">
                  <HistoricalItems items={detail.stockItems} stock />
                </div>
              </details>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                <span>Custo definitivo do registro</span>
                <strong className="text-lg tabular-nums">
                  {consumptionCurrency(detail.totalCost)}
                </strong>
              </div>
              {detail.status === "CANCELLED" && (
                <section className="space-y-2 rounded-lg border bg-muted/50 p-3 text-sm">
                  <h3 className="font-semibold">Cancelamento auditado</h3>
                  <p>
                    Cancelado por:{" "}
                    <strong>{detail.cancelledByName || "—"}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {consumptionDateTime(detail.cancelledAt)}
                  </p>
                  <p className="whitespace-pre-wrap break-words">
                    {detail.cancellationReason || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A baixa foi estornada. Este registro e os custos originais
                    permanecem no histórico, mas não compõem os totais de
                    consumo ativo.
                  </p>
                </section>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Registro não encontrado.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={cancelMutation.isPending}
              onClick={() => setDetailId(null)}
            >
              Fechar
            </Button>
            {isAdmin && detail?.status === "ACTIVE" && !detailQuery.isError && (
              <Button
                variant="outline"
                disabled={cancelMutation.isPending}
                onClick={() => {
                  setCancellationReason("");
                  setCancelError(null);
                  setCancelOpen(true);
                }}
              >
                Cancelar consumo
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={cancelOpen && isAdmin}
        onOpenChange={open => {
          if (!cancelling.current) setCancelOpen(open);
        }}
      >
        <AlertDialogContent
          onEscapeKeyDown={event => {
            if (cancelling.current) event.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar consumo #{detailId}?</AlertDialogTitle>
            <AlertDialogDescription>
              O estoque será devolvido pelos itens e custos originais. O
              cancelamento não apaga o histórico e ficará vinculado ao seu
              usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="consumption-cancellation-reason">
              Motivo do cancelamento *
            </Label>
            <Textarea
              id="consumption-cancellation-reason"
              value={cancellationReason}
              minLength={3}
              maxLength={1000}
              disabled={cancelMutation.isPending}
              onChange={event => {
                setCancellationReason(event.target.value);
                setCancelError(null);
              }}
              placeholder="Explique por que este lançamento deve ser estornado"
            />
            <p className="text-xs text-muted-foreground">
              Pelo menos 3 caracteres.
            </p>
          </div>
          {cancelError && <InlineError message={cancelError} />}
          <AlertDialogFooter>
            <Button
              variant="outline"
              disabled={cancelMutation.isPending}
              onClick={() => setCancelOpen(false)}
            >
              Manter consumo
            </Button>
            <Button
              className={ACCENT_BUTTON}
              disabled={
                cancelMutation.isPending ||
                cancellationReason.trim().length < 3 ||
                detail?.status !== "ACTIVE"
              }
              onClick={() => void submitCancellation()}
            >
              {cancelMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {cancelMutation.isPending
                ? "Cancelando…"
                : "Confirmar cancelamento e estorno"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isAdmin && (
        <Dialog
          open={staffOpen}
          onOpenChange={open => {
            if (!savingStaff.current) setStaffOpen(open);
          }}
        >
          <DialogContent
            className={MODAL_CLASS}
            showCloseButton={!employeeMutation.isPending}
            onEscapeKeyDown={event => {
              if (savingStaff.current) event.preventDefault();
            }}
            onInteractOutside={event => {
              if (savingStaff.current) event.preventDefault();
            }}
          >
            <DialogHeader>
              <DialogTitle>Gerenciar funcionários</DialogTitle>
              <DialogDescription>
                Cadastro independente de login. Renomeie ou desative sem excluir
                o histórico de consumo. Funcionários são compartilhados entre as
                filiais da empresa ativa.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-3 rounded-lg border bg-muted/30 p-3"
              onSubmit={event => {
                event.preventDefault();
                void saveEmployee();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="consumption-employee-name">
                  {editingEmployee
                    ? "Renomear funcionário"
                    : "Adicionar funcionário"}
                </Label>
                <Input
                  id="consumption-employee-name"
                  value={employeeName}
                  minLength={2}
                  maxLength={200}
                  disabled={employeeMutation.isPending}
                  onChange={event => {
                    setEmployeeName(event.target.value);
                    setStaffError(null);
                  }}
                  placeholder="Nome do funcionário"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  className={ACCENT_BUTTON}
                  disabled={
                    employeeMutation.isPending || employeeName.trim().length < 2
                  }
                >
                  {employeeMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {editingEmployee ? "Salvar nome" : "Adicionar"}
                </Button>
                {editingEmployee && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={employeeMutation.isPending}
                    onClick={() => {
                      setEditingEmployee(null);
                      setEmployeeName("");
                      setStaffError(null);
                    }}
                  >
                    Voltar ao cadastro
                  </Button>
                )}
              </div>
            </form>
            {staffError && <InlineError message={staffError} />}
            {employeeQuery.isError ? (
              <InlineError
                message={employeeQuery.error.message}
                retry={() => void employeeQuery.refetch()}
              />
            ) : employeeQuery.isLoading ? (
              <p role="status" className="text-sm text-muted-foreground">
                Carregando funcionários…
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {employees.map(employee => (
                  <div
                    key={employee.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">
                        {employee.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {employee.active
                          ? "Ativo"
                          : "Inativo · histórico preservado"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={employeeMutation.isPending}
                        aria-label={`Renomear ${employee.name}`}
                        onClick={() => {
                          setEditingEmployee(employee);
                          setEmployeeName(employee.name);
                          setStaffError(null);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Renomear
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={employeeMutation.isPending}
                        onClick={() => void saveEmployee(employee)}
                      >
                        {employee.active ? "Desativar" : "Reativar"}
                      </Button>
                    </div>
                  </div>
                ))}
                {!employees.length && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum funcionário cadastrado nesta empresa.
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={employeeMutation.isPending}
                onClick={() => setStaffOpen(false)}
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
