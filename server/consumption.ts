import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "./db";
import {
  companies,
  branches,
  userCompanies,
  products,
  productCompositions,
  productMovements,
  consumptionEmployees,
  consumptionRecords,
  consumptionItems,
  consumptionStockItems,
  type Product,
  type ProductComposition,
  type ConsumptionEmployee,
  type ConsumptionRecord,
  type ConsumptionStockItem,
} from "../drizzle/schema";

export type ConsumptionScope = { companyId: number; branchId: number };
export type ConsumptionActor = ConsumptionScope & {
  userId: string;
  userName: string;
  role: string;
};
export type ConsumptionContext = {
  activeCompanyId?: number;
  activeBranchId?: number;
  user: { id: string; name: string | null; role: string } | null;
};
export type ConsumptionCreateInput = ConsumptionScope & {
  employeeId: number;
  reason: string;
  requestKey: string;
  items: { productId: number; quantity: number }[];
  consumedAt?: Date;
};
export type ConsumptionFilters = ConsumptionScope & {
  startDate?: string;
  endDate?: string;
  employeeId?: number;
  status?: "ACTIVE" | "CANCELLED";
  page?: number;
  pageSize?: number;
};
export type ConsumptionGraph = {
  products: Product[];
  compositions: ProductComposition[];
};
export type SnapshotItem = {
  productId: number;
  productName: string;
  uom: string;
  quantity: number;
  unitCost: string;
  totalCost: string;
};
export type ConsumptionPlan = {
  items: SnapshotItem[];
  stockItems: SnapshotItem[];
  totalCost: string;
  totalUnits: number;
  productIds: number[];
};
const bad = (message: string): never => {
  throw new TRPCError({ code: "BAD_REQUEST", message });
};
const conflict = (message: string): never => {
  throw new TRPCError({ code: "CONFLICT", message });
};
const MAX_INT = 2_147_483_647;
const MAX_MONEY_CENTS = 999_999_999_999_999n;

// All arithmetic is BigInt rational or integer cents; never binary floating-point money.
type Rational = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));
function rational(n: bigint, d = 1n): Rational {
  const g = gcd(n < 0n ? -n : n, d);
  return { n: n / g, d: d / g };
}
const add = (a: Rational, b: Rational) =>
  rational(a.n * b.d + b.n * a.d, a.d * b.d);
const mul = (a: Rational, b: Rational) => rational(a.n * b.n, a.d * b.d);
function decimalRational(value: string): Rational {
  if (!/^\d+(\.\d+)?$/.test(value))
    return bad("Quantidade/custo da composição inválido.");
  const [whole, fraction = ""] = value.split(".");
  return rational(BigInt(whole + fraction), 10n ** BigInt(fraction.length));
}
export function moneyToCents(value: string | null): bigint {
  const r = decimalRational(value ?? "0.00");
  const cents = mul(r, rational(100n));
  if (cents.d !== 1n) return bad("Custo deve ter precisão de centavos.");
  if (cents.n > MAX_MONEY_CENTS) return bad("Custo excede o limite permitido.");
  return cents.n;
}
export function centsToMoney(cents: bigint): string {
  if (cents < 0n || cents > MAX_MONEY_CENTS)
    return bad("Custo excede o limite permitido.");
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}
const roundHalfUp = (r: Rational) => (r.n * 2n + r.d) / (r.d * 2n);
function safeQuantity(q: number): number {
  if (!Number.isSafeInteger(q) || q < 1 || q > MAX_INT)
    return bad(
      "Informe quantidades inteiras, entre 1 e 2.147.483.647 unidades."
    );
  return q;
}
export function normalizeConsumptionItems(
  items: ConsumptionCreateInput["items"]
) {
  if (!items.length || items.length > 100)
    return bad("Informe entre 1 e 100 itens de consumo.");
  const quantities = new Map<number, number>();
  for (const item of items) {
    safeQuantity(item.productId);
    safeQuantity(item.quantity);
    quantities.set(
      item.productId,
      safeQuantity((quantities.get(item.productId) ?? 0) + item.quantity)
    );
  }
  return [...quantities]
    .sort(([a], [b]) => a - b)
    .map(([productId, quantity]) => ({ productId, quantity }));
}
export function consumptionPayloadHash(
  actor: ConsumptionActor,
  input: ConsumptionCreateInput
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        companyId: actor.companyId,
        branchId: actor.branchId,
        userId: actor.userId,
        employeeId: input.employeeId,
        reason: input.reason.trim(),
        // A missing timestamp is a stable default marker, not a newly generated timestamp per replay.
        consumedAt: input.consumedAt?.toISOString() ?? null,
        items: normalizeConsumptionItems(input.items),
      })
    )
    .digest("hex");
}

/** Expand every path with exact rationals. Aggregate shared leaves BEFORE checking integer stock quantities. */
export function buildConsumptionPlan(
  scope: ConsumptionScope,
  requested: ConsumptionCreateInput["items"],
  graph: ConsumptionGraph,
  checkStock = true
): ConsumptionPlan {
  const input = normalizeConsumptionItems(requested);
  const productMap = new Map(graph.products.map(p => [p.id, p]));
  const compositions = new Map<number, ProductComposition[]>();
  for (const edge of graph.compositions) {
    const list = compositions.get(edge.parentProductId) ?? [];
    list.push(edge);
    compositions.set(edge.parentProductId, list);
  }
  const touched = new Set<number>();
  const leaves = new Map<number, Rational>();
  function expand(
    id: number,
    quantity: Rational,
    path: Set<number>,
    perItem: Map<number, Rational>
  ): Rational {
    if (path.has(id))
      return bad(
        "A composição contém um ciclo. Corrija a ficha técnica antes de consumir."
      );
    if (path.size >= 100 || touched.size >= 5000)
      return bad("Composição muito extensa para registrar o consumo.");
    const p = productMap.get(id);
    if (!p || p.companyId !== scope.companyId || p.branchId !== scope.branchId)
      return bad("Produto/componente não pertence à empresa e filial ativas.");
    if (!p.active) return bad(`Produto/componente inativo: ${p.name}.`);
    touched.add(id);
    if (!p.isComposite) {
      perItem.set(id, add(perItem.get(id) ?? rational(0n), quantity));
      return mul(quantity, rational(moneyToCents(p.avgCost)));
    }
    const edges = compositions.get(id) ?? [];
    if (!edges.length)
      return bad(
        `O produto composto ${p.name} não possui composição cadastrada.`
      );
    const nextPath = new Set(path).add(id);
    let cost = rational(0n);
    for (const edge of edges) {
      if (
        edge.companyId !== scope.companyId ||
        edge.branchId !== scope.branchId
      )
        return bad("Composição pertence a outra empresa ou filial.");
      const componentQty = decimalRational(edge.quantity);
      if (componentQty.n <= 0n)
        return bad(`Quantidade inválida na composição de ${p.name}.`);
      cost = add(
        cost,
        expand(
          edge.childProductId,
          mul(quantity, componentQty),
          nextPath,
          perItem
        )
      );
    }
    return cost;
  }
  const itemCosts = input.map(item => {
    const perItem = new Map<number, Rational>();
    const cost = expand(
      item.productId,
      rational(BigInt(item.quantity)),
      new Set(),
      perItem
    );
    for (const [id, qty] of perItem)
      leaves.set(id, add(leaves.get(id) ?? rational(0n), qty));
    return { ...item, cost };
  });
  let total = 0n;
  const stockItems = [...leaves]
    .sort(([a], [b]) => a - b)
    .map(([id, qty]) => {
      const p = productMap.get(id)!;
      if (qty.d !== 1n)
        return bad(
          `A composição gera baixa fracionária de ${p.name} (${p.uom}). O estoque aceita somente unidades inteiras; ajuste a quantidade ou a composição.`
        );
      if (qty.n < 1n || qty.n > BigInt(MAX_INT) || qty.n > 9_999_999n)
        return bad(`Quantidade de estoque inválida para ${p.name}.`);
      const quantity = Number(qty.n);
      if (checkStock && (p.currentStock ?? 0) < quantity)
        return bad(
          `Estoque insuficiente de ${p.name}: disponível ${p.currentStock ?? 0} ${p.uom}; necessário ${quantity} ${p.uom}.`
        );
      const cents = moneyToCents(p.avgCost);
      const totalCents = cents * qty.n;
      total += totalCents;
      return {
        productId: id,
        productName: p.name,
        uom: p.uom,
        quantity,
        unitCost: centsToMoney(cents),
        totalCost: centsToMoney(totalCents),
      };
    });
  // Largest remainder allocation preserves total cents when fractional recipes split a cent across requested items.
  const allocations = itemCosts.map(i => i.cost.n / i.cost.d);
  let remainder = total - allocations.reduce((a, b) => a + b, 0n);
  const order = itemCosts
    .map((i, index) => ({
      index,
      remainder: rational(i.cost.n % i.cost.d, i.cost.d),
    }))
    .sort((a, b) => {
      const delta =
        a.remainder.n * b.remainder.d - b.remainder.n * a.remainder.d;
      return delta === 0n ? a.index - b.index : delta > 0n ? -1 : 1;
    });
  for (const i of order) {
    if (remainder > 0n) {
      allocations[i.index] += 1n;
      remainder -= 1n;
    }
  }
  const items = itemCosts.map((i, index) => {
    const p = productMap.get(i.productId)!;
    return {
      productId: p.id,
      productName: p.name,
      uom: p.uom,
      quantity: i.quantity,
      unitCost: centsToMoney(
        roundHalfUp(rational(i.cost.n, i.cost.d * BigInt(i.quantity)))
      ),
      totalCost: centsToMoney(allocations[index]),
    };
  });
  const totalUnits = input.reduce((sum, i) => sum + i.quantity, 0);
  safeQuantity(totalUnits);
  return {
    items,
    stockItems,
    totalCost: centsToMoney(total),
    totalUnits,
    productIds: [...touched].sort((a, b) => a - b),
  };
}

export interface ConsumptionAccessRepository {
  companyActive(companyId: number): Promise<boolean>;
  branchActive(scope: ConsumptionScope): Promise<boolean>;
  memberships(
    userId: string,
    scope: ConsumptionScope
  ): Promise<{ role: string }[]>;
}
/** IDs are cache isolation only, not authorization. Reject missing/mismatched context before touching DB. */
export function assertConsumptionContext(
  ctx: ConsumptionContext,
  input: ConsumptionScope
): ConsumptionScope {
  if (!ctx.user)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Autenticação obrigatória.",
    });
  if (
    !Number.isInteger(ctx.activeCompanyId) ||
    !ctx.activeCompanyId ||
    ctx.activeCompanyId < 1 ||
    !Number.isInteger(ctx.activeBranchId) ||
    !ctx.activeBranchId ||
    ctx.activeBranchId < 1
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Selecione uma empresa e filial ativas para acessar o consumo.",
    });
  }
  if (
    input.companyId !== ctx.activeCompanyId ||
    input.branchId !== ctx.activeBranchId
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Empresa/filial informadas diferem do contexto ativo. Atualize a página.",
    });
  }
  return { companyId: ctx.activeCompanyId, branchId: ctx.activeBranchId };
}
export async function authorizeConsumption(
  ctx: ConsumptionContext,
  input: ConsumptionScope,
  action: "read" | "write" | "admin",
  repo: ConsumptionAccessRepository
): Promise<ConsumptionActor> {
  const scope = assertConsumptionContext(ctx, input);
  const user = ctx.user!;
  if (!["admin", "operacional", "consultor"].includes(user.role))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Seu perfil não tem acesso ao módulo Consumo.",
    });
  if (
    !(await repo.companyActive(scope.companyId)) ||
    !(await repo.branchActive(scope))
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Empresa ou filial inexistente/inativa.",
    });
  const memberships =
    user.role === "admin"
      ? [{ role: "admin" }]
      : await repo.memberships(user.id, scope);
  const allowed =
    action === "admin"
      ? ["admin"]
      : action === "write"
        ? ["admin", "operacional"]
        : ["admin", "operacional", "consultor"];
  const membership = memberships.find(m => allowed.includes(m.role));
  // A consultor global never receives write access from a less restrictive membership.
  if (!membership || (action !== "read" && user.role === "consultor"))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso negado para esta empresa/filial ou operação.",
    });
  return {
    ...scope,
    userId: user.id,
    userName: (user.name || "Usuário").slice(0, 200),
    role: membership.role,
  };
}

export interface ConsumptionTransaction {
  employee(
    actor: ConsumptionActor,
    id: number
  ): Promise<ConsumptionEmployee | undefined>;
  lockGraph(
    actor: ConsumptionActor,
    productIds: number[]
  ): Promise<ConsumptionGraph>;
  findRequest(
    actor: ConsumptionActor,
    key: string
  ): Promise<ConsumptionRecord | undefined>;
  insertRecord(
    actor: ConsumptionActor,
    input: ConsumptionCreateInput,
    plan: ConsumptionPlan,
    hash: string,
    consumedAt: Date,
    employeeName: string
  ): Promise<number>;
  insertItems(
    actor: ConsumptionActor,
    id: number,
    items: SnapshotItem[]
  ): Promise<void>;
  insertMovement(
    actor: ConsumptionActor,
    id: number,
    item: SnapshotItem,
    reverse: boolean,
    date: Date,
    reason: string
  ): Promise<number>;
  changeStock(
    actor: ConsumptionActor,
    productId: number,
    delta: number
  ): Promise<void>;
  insertStockItem(
    actor: ConsumptionActor,
    id: number,
    item: SnapshotItem,
    movementId: number
  ): Promise<void>;
  lockRecord(
    actor: ConsumptionActor,
    id: number
  ): Promise<ConsumptionRecord | undefined>;
  stockItems(
    actor: ConsumptionActor,
    id: number
  ): Promise<ConsumptionStockItem[]>;
  lockRestoreProducts(actor: ConsumptionActor, ids: number[]): Promise<void>;
  linkReversal(
    actor: ConsumptionActor,
    stockItemId: number,
    movementId: number
  ): Promise<void>;
  markCancelled(
    actor: ConsumptionActor,
    id: number,
    reason: string,
    date: Date
  ): Promise<void>;
}
export interface ConsumptionRepository {
  graph(actor: ConsumptionActor): Promise<ConsumptionGraph>;
  findRequest(
    actor: ConsumptionActor,
    key: string
  ): Promise<ConsumptionRecord | undefined>;
  transaction<T>(fn: (tx: ConsumptionTransaction) => Promise<T>): Promise<T>;
}
function replay(
  actor: ConsumptionActor,
  existing: ConsumptionRecord,
  hash: string
) {
  if (
    existing.branchId !== actor.branchId ||
    existing.createdBy !== actor.userId ||
    existing.payloadHash !== hash
  )
    return conflict(
      "Esta chave de solicitação já foi usada para outro consumo. Gere uma nova solicitação."
    );
  return { id: existing.id, replayed: true };
}
function isDuplicate(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; errno?: number; cause?: unknown };
  return (
    e.code === "ER_DUP_ENTRY" ||
    e.errno === 1062 ||
    (e.cause !== error && isDuplicate(e.cause))
  );
}
function isTransactionContention(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; errno?: number; cause?: unknown };
  return (
    e.code === "ER_LOCK_DEADLOCK" ||
    e.code === "ER_LOCK_WAIT_TIMEOUT" ||
    e.errno === 1213 ||
    e.errno === 1205 ||
    (e.cause !== error && isTransactionContention(e.cause))
  );
}
/** Drizzle has already rolled back the failed callback before retrying any lock contention. */
export async function retryConsumptionTransaction<T>(
  run: () => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= 2 || !isTransactionContention(error)) throw error;
    }
  }
}
export async function createConsumption(
  actor: ConsumptionActor,
  input: ConsumptionCreateInput,
  repo: ConsumptionRepository,
  now = new Date()
): Promise<{ id: number; replayed?: boolean }> {
  if (actor.role !== "admin" && actor.role !== "operacional")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas administrador/operacional pode registrar consumo.",
    });
  if (input.companyId !== actor.companyId || input.branchId !== actor.branchId)
    throw new TRPCError({ code: "FORBIDDEN" });
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.requestKey
    )
  )
    return bad("Chave da solicitação deve ser um UUID válido.");
  if (input.reason.trim().length < 3 || input.reason.trim().length > 2000)
    return bad("Informe um motivo de 3 a 2.000 caracteres.");
  safeQuantity(input.employeeId);
  if (
    input.consumedAt &&
    (!Number.isFinite(input.consumedAt.getTime()) || input.consumedAt > now)
  )
    return bad("A data do consumo não pode estar no futuro.");
  const hash = consumptionPayloadHash(actor, input);
  const existing = await repo.findRequest(
    actor,
    input.requestKey.toLowerCase()
  );
  if (existing) return replay(actor, existing, hash);
  // No stock decision from the unlocked preview: merely aggregate quantities and identify lock order.
  const preview = buildConsumptionPlan(
    actor,
    input.items,
    await repo.graph(actor),
    false
  );
  try {
    return await repo.transaction(async tx => {
      const employee = await tx.employee(actor, input.employeeId);
      if (
        !employee ||
        employee.companyId !== actor.companyId ||
        !employee.active
      )
        return bad("Funcionário inexistente/inativo na empresa ativa.");
      const graph = await tx.lockGraph(actor, preview.productIds);
      // Current locking read avoids stale repeatable-read snapshots after concurrent requests commit.
      const concurrent = await tx.findRequest(
        actor,
        input.requestKey.toLowerCase()
      );
      if (concurrent) return replay(actor, concurrent, hash);
      const plan = buildConsumptionPlan(actor, input.items, graph);
      if (plan.productIds.some(id => !preview.productIds.includes(id)))
        return conflict(
          "A composição foi alterada durante o registro. Tente novamente."
        );
      const id = await tx.insertRecord(
        actor,
        { ...input, requestKey: input.requestKey.toLowerCase() },
        plan,
        hash,
        input.consumedAt ?? now,
        employee.name
      );
      await tx.insertItems(actor, id, plan.items);
      for (const leaf of plan.stockItems) {
        const movementId = await tx.insertMovement(
          actor,
          id,
          leaf,
          false,
          input.consumedAt ?? now,
          input.reason.trim()
        );
        await tx.changeStock(actor, leaf.productId, -leaf.quantity);
        await tx.insertStockItem(actor, id, leaf, movementId);
      }
      return { id };
    });
  } catch (error) {
    // Duplicate unique company/request key aborts the entire transaction before fetching the winner.
    if (isDuplicate(error)) {
      const winner = await repo.findRequest(
        actor,
        input.requestKey.toLowerCase()
      );
      if (winner) return replay(actor, winner, hash);
    }
    throw error;
  }
}
export async function cancelConsumption(
  actor: ConsumptionActor,
  id: number,
  reason: string,
  repo: ConsumptionRepository,
  now = new Date()
) {
  if (actor.role !== "admin")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas administradores podem cancelar consumo.",
    });
  if (reason.trim().length < 3 || reason.trim().length > 2000)
    return bad("Informe um motivo de cancelamento de 3 a 2.000 caracteres.");
  return repo.transaction(async tx => {
    const record = await tx.lockRecord(actor, id);
    if (
      !record ||
      record.companyId !== actor.companyId ||
      record.branchId !== actor.branchId
    )
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Consumo não encontrado nesta empresa/filial.",
      });
    if (record.status === "CANCELLED")
      return { id, replayed: true, success: true };
    const leaves = await tx.stockItems(actor, id);
    if (!leaves.length)
      return conflict(
        "Consumo sem snapshot de estoque. Estorno automático bloqueado."
      );
    await tx.lockRestoreProducts(
      actor,
      [...new Set(leaves.map(i => i.productId))].sort((a, b) => a - b)
    );
    for (const leaf of leaves) {
      if (
        leaf.companyId !== actor.companyId ||
        leaf.branchId !== actor.branchId ||
        leaf.reversalMovementId !== null
      )
        return conflict(
          "Snapshot de estoque inconsistente; cancelamento bloqueado."
        );
      safeQuantity(leaf.quantity);
      const movementId = await tx.insertMovement(
        actor,
        id,
        leaf,
        true,
        now,
        reason.trim()
      );
      await tx.changeStock(actor, leaf.productId, leaf.quantity);
      await tx.linkReversal(actor, leaf.id, movementId);
    }
    await tx.markCancelled(actor, id, reason.trim(), now);
    return { id, success: true };
  });
}

// Drizzle adapter. Every business SELECT/UPDATE has mandatory company and branch scope.
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;
const productScope = (scope: ConsumptionScope) =>
  and(
    eq(products.companyId, scope.companyId),
    eq(products.branchId, scope.branchId)
  );
const recordScope = (scope: ConsumptionScope) =>
  and(
    eq(consumptionRecords.companyId, scope.companyId),
    eq(consumptionRecords.branchId, scope.branchId)
  );
function adapter(tx: Transaction): ConsumptionTransaction {
  return {
    async employee(actor, id) {
      const [employee] = await tx
        .select()
        .from(consumptionEmployees)
        .where(
          and(
            eq(consumptionEmployees.companyId, actor.companyId),
            eq(consumptionEmployees.id, id)
          )
        )
        .for("update");
      return employee;
    },
    async lockGraph(actor, ids) {
      const rows = await tx
        .select()
        .from(products)
        .where(and(productScope(actor), inArray(products.id, ids)))
        .orderBy(asc(products.id))
        .for("update");
      const edges = await tx
        .select()
        .from(productCompositions)
        .where(
          and(
            eq(productCompositions.companyId, actor.companyId),
            eq(productCompositions.branchId, actor.branchId),
            inArray(productCompositions.parentProductId, ids)
          )
        )
        .orderBy(asc(productCompositions.id))
        .for("update");
      const outside = edges.some(e => !ids.includes(e.childProductId));
      if (outside)
        return conflict(
          "A composição foi alterada durante o registro. Tente novamente."
        );
      return { products: rows, compositions: edges };
    },
    async findRequest(actor, key) {
      const [row] = await tx
        .select()
        .from(consumptionRecords)
        .where(
          and(
            eq(consumptionRecords.companyId, actor.companyId),
            eq(consumptionRecords.requestKey, key)
          )
        )
        .for("update");
      return row;
    },
    async insertRecord(actor, input, plan, hash, consumedAt, employeeName) {
      const [result] = await tx.insert(consumptionRecords).values({
        ...actorScope(actor),
        employeeId: input.employeeId,
        employeeName,
        consumedAt,
        reason: input.reason.trim(),
        totalCost: plan.totalCost,
        totalUnits: plan.totalUnits,
        requestKey: input.requestKey,
        payloadHash: hash,
        createdBy: actor.userId,
        createdByName: actor.userName,
      });
      return Number(result.insertId);
    },
    async insertItems(actor, id, items) {
      await tx
        .insert(consumptionItems)
        .values(
          items.map(i => ({ ...i, ...actorScope(actor), consumptionId: id }))
        );
    },
    async insertMovement(actor, id, item, reverse, date, reason) {
      const [result] = await tx.insert(productMovements).values({
        ...actorScope(actor),
        productId: item.productId,
        date,
        type: reverse ? "ESTORNO" : "SAIDA",
        quantity: String(reverse ? item.quantity : -item.quantity),
        documentNumber: reverse ? `ESTORNO:CONSUMO:${id}` : `CONSUMO:${id}`,
        userId: actor.userId,
        notes: `${reverse ? "Estorno de consumo" : "Consumo"} por ${actor.userName}: ${reason}`,
      });
      return Number(result.insertId);
    },
    async changeStock(actor, productId, delta) {
      const [result] = await tx
        .update(products)
        .set({ currentStock: sql`${products.currentStock} + ${delta}` })
        .where(
          and(
            productScope(actor),
            eq(products.id, productId),
            delta < 0
              ? gte(products.currentStock, -delta)
              : sql`${products.currentStock} <= ${MAX_INT - delta}`
          )
        );
      if (result.affectedRows !== 1)
        return conflict(
          "Estoque insuficiente, alterado ou fora do limite. Nenhuma movimentação foi gravada."
        );
    },
    async insertStockItem(actor, id, item, movementId) {
      await tx.insert(consumptionStockItems).values({
        ...actorScope(actor),
        ...item,
        consumptionId: id,
        movementId,
      });
    },
    async lockRecord(actor, id) {
      const [record] = await tx
        .select()
        .from(consumptionRecords)
        .where(and(recordScope(actor), eq(consumptionRecords.id, id)))
        .for("update");
      return record;
    },
    async stockItems(actor, id) {
      return tx
        .select()
        .from(consumptionStockItems)
        .where(
          and(
            eq(consumptionStockItems.companyId, actor.companyId),
            eq(consumptionStockItems.branchId, actor.branchId),
            eq(consumptionStockItems.consumptionId, id)
          )
        )
        .orderBy(asc(consumptionStockItems.productId));
    },
    async lockRestoreProducts(actor, ids) {
      const rows = await tx
        .select({ id: products.id })
        .from(products)
        .where(and(productScope(actor), inArray(products.id, ids)))
        .orderBy(asc(products.id))
        .for("update");
      // Inactive leaves are allowed, but removed/moved/foreign leaves must not credit a different tenant.
      if (rows.length !== ids.length)
        return conflict(
          "Produto original removido ou transferido. Estorno bloqueado para proteger o estoque."
        );
    },
    async linkReversal(actor, id, movementId) {
      const [result] = await tx
        .update(consumptionStockItems)
        .set({ reversalMovementId: movementId })
        .where(
          and(
            eq(consumptionStockItems.companyId, actor.companyId),
            eq(consumptionStockItems.branchId, actor.branchId),
            eq(consumptionStockItems.id, id),
            isNull(consumptionStockItems.reversalMovementId)
          )
        );
      if (result.affectedRows !== 1)
        return conflict("Este item já foi estornado.");
    },
    async markCancelled(actor, id, reason, date) {
      const [result] = await tx
        .update(consumptionRecords)
        .set({
          status: "CANCELLED",
          cancelledAt: date,
          cancelledBy: actor.userId,
          cancelledByName: actor.userName,
          cancellationReason: reason,
        })
        .where(
          and(
            recordScope(actor),
            eq(consumptionRecords.id, id),
            eq(consumptionRecords.status, "ACTIVE")
          )
        );
      if (result.affectedRows !== 1)
        return conflict("Este consumo já foi cancelado.");
    },
  };
}
const actorScope = (actor: ConsumptionScope): ConsumptionScope => ({
  companyId: actor.companyId,
  branchId: actor.branchId,
});
async function readGraph(
  db: Executor,
  actor: ConsumptionScope
): Promise<ConsumptionGraph> {
  const rows = await db.select().from(products).where(productScope(actor));
  const edges = await db
    .select()
    .from(productCompositions)
    .where(
      and(
        eq(productCompositions.companyId, actor.companyId),
        eq(productCompositions.branchId, actor.branchId)
      )
    );
  return { products: rows, compositions: edges };
}
export function makeConsumptionRepository(
  db: Database
): ConsumptionRepository & ConsumptionAccessRepository {
  return {
    graph: actor => readGraph(db, actor),
    async findRequest(actor, key) {
      // Company-only lookup intentionally detects the same unique key used in another branch (never returns its details).
      const [row] = await db
        .select()
        .from(consumptionRecords)
        .where(
          and(
            eq(consumptionRecords.companyId, actor.companyId),
            eq(consumptionRecords.requestKey, key)
          )
        )
        .limit(1);
      return row;
    },
    transaction: fn =>
      retryConsumptionTransaction(() => db.transaction(tx => fn(adapter(tx)))),
    async companyActive(companyId) {
      const [row] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.active, true)))
        .limit(1);
      return !!row;
    },
    async branchActive(scope) {
      const [row] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(
          and(
            eq(branches.companyId, scope.companyId),
            eq(branches.id, scope.branchId),
            eq(branches.active, true)
          )
        )
        .limit(1);
      return !!row;
    },
    async memberships(userId, scope) {
      return db
        .select({ role: userCompanies.role })
        .from(userCompanies)
        .where(
          and(
            eq(userCompanies.companyId, scope.companyId),
            eq(userCompanies.userId, userId),
            or(
              eq(userCompanies.branchId, scope.branchId),
              isNull(userCompanies.branchId)
            )
          )
        );
    },
  };
}
export async function consumptionDatabase() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Banco de dados indisponível.",
    });
  return db;
}
export async function getConsumptionEmployees(
  db: Database,
  scope: ConsumptionScope,
  includeInactive = false
) {
  return db
    .select({
      id: consumptionEmployees.id,
      name: consumptionEmployees.name,
      active: consumptionEmployees.active,
    })
    .from(consumptionEmployees)
    .where(
      and(
        eq(consumptionEmployees.companyId, scope.companyId),
        includeInactive ? undefined : eq(consumptionEmployees.active, true)
      )
    )
    .orderBy(asc(consumptionEmployees.name), asc(consumptionEmployees.id));
}
export async function saveConsumptionEmployee(
  db: Database,
  actor: ConsumptionActor,
  input: { id?: number; name: string; active?: boolean }
) {
  if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  const name = input.name.trim();
  if (name.length < 2 || name.length > 200)
    return bad("Informe um nome de 2 a 200 caracteres.");
  if (input.id) {
    return db.transaction(async tx => {
      const [employee] = await tx
        .select()
        .from(consumptionEmployees)
        .where(
          and(
            eq(consumptionEmployees.companyId, actor.companyId),
            eq(consumptionEmployees.id, input.id!)
          )
        )
        .for("update");
      if (!employee)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Funcionário não encontrado nesta empresa.",
        });
      await tx
        .update(consumptionEmployees)
        .set({
          name,
          active: input.active ?? employee.active,
          updatedBy: actor.userId,
        })
        .where(
          and(
            eq(consumptionEmployees.companyId, actor.companyId),
            eq(consumptionEmployees.id, employee.id)
          )
        );
      return { id: employee.id, name, active: input.active ?? employee.active };
    });
  }
  const [result] = await db.insert(consumptionEmployees).values({
    companyId: actor.companyId,
    name,
    active: input.active ?? true,
    createdBy: actor.userId,
    updatedBy: actor.userId,
  });
  return { id: Number(result.insertId), name, active: input.active ?? true };
}
export async function getConsumptionProducts(
  db: Database,
  scope: ConsumptionScope,
  search?: string
) {
  const term = search?.trim().toLowerCase();
  return db
    .select({
      id: products.id,
      name: products.name,
      uom: products.uom,
      currentStock: products.currentStock,
      avgCost: products.avgCost,
      isComposite: products.isComposite,
      branchId: products.branchId,
    })
    .from(products)
    .where(
      and(
        productScope(scope),
        eq(products.active, true),
        term
          ? sql`LOWER(${products.name}) LIKE ${`%${term.replace(/[\\%_]/g, "\\$&")}%`}`
          : undefined
      )
    )
    .orderBy(asc(products.name), asc(products.id))
    .limit(100);
}
export function consumptionDateBoundary(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return bad("Informe uma data válida no formato AAAA-MM-DD.");
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    return bad("Informe uma data válida no formato AAAA-MM-DD.");
  // ERP business dates use Brasília (UTC-3); timestamps remain UTC in storage and API.
  return new Date(parsed.getTime() + 3 * 60 * 60 * 1000);
}
export async function listConsumption(
  db: Database,
  filters: ConsumptionFilters
) {
  if (
    filters.startDate &&
    filters.endDate &&
    filters.startDate > filters.endDate
  )
    return bad("Data inicial deve ser anterior à data final.");
  const conditions: SQL[] = [recordScope(filters)!];
  if (filters.startDate)
    conditions.push(
      gte(
        consumptionRecords.consumedAt,
        consumptionDateBoundary(filters.startDate)
      )
    );
  if (filters.endDate)
    conditions.push(
      lt(
        consumptionRecords.consumedAt,
        new Date(consumptionDateBoundary(filters.endDate).getTime() + 86400000)
      )
    );
  if (filters.employeeId)
    conditions.push(eq(consumptionRecords.employeeId, filters.employeeId));
  if (filters.status)
    conditions.push(eq(consumptionRecords.status, filters.status));
  const where = and(...conditions);
  const page = filters.page ?? 1,
    pageSize = filters.pageSize ?? 20;
  // A read-only transaction provides a consistent page, count and filtered summary.
  return db.transaction(async tx => {
    const items = await tx
      .select()
      .from(consumptionRecords)
      .where(where)
      .orderBy(desc(consumptionRecords.consumedAt), desc(consumptionRecords.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const [counts] = await tx
      .select({ total: sql<string>`COUNT(*)` })
      .from(consumptionRecords)
      .where(where);
    // Cancelled rows remain visible, but cost/units KPIs count only effective consumption.
    const activeWhere = and(where, eq(consumptionRecords.status, "ACTIVE"));
    const [summary] = await tx
      .select({
        totalCost: sql<string>`COALESCE(SUM(${consumptionRecords.totalCost}), 0)`,
        records: sql<string>`COUNT(*)`,
        units: sql<string>`COALESCE(SUM(${consumptionRecords.totalUnits}), 0)`,
      })
      .from(consumptionRecords)
      .where(activeWhere);
    const byEmployee = await tx
      .select({
        employeeId: consumptionRecords.employeeId,
        employeeName: sql<string>`MAX(${consumptionRecords.employeeName})`,
        totalCost: sql<string>`COALESCE(SUM(${consumptionRecords.totalCost}), 0)`,
        records: sql<string>`COUNT(*)`,
      })
      .from(consumptionRecords)
      .where(activeWhere)
      .groupBy(consumptionRecords.employeeId)
      .orderBy(desc(sql`SUM(${consumptionRecords.totalCost})`));
    return {
      items: items.map(
        ({ payloadHash: _hash, requestKey: _key, ...record }) => record
      ),
      total: Number(counts?.total ?? 0),
      summary: {
        totalCost: centsToMoney(
          moneyToCents(String(summary?.totalCost ?? "0"))
        ),
        records: Number(summary?.records ?? 0),
        units: Number(summary?.units ?? 0),
      },
      byEmployee: byEmployee.map(e => ({
        ...e,
        totalCost: centsToMoney(moneyToCents(String(e.totalCost))),
        records: Number(e.records),
      })),
    };
  });
}
export async function getConsumption(
  db: Database,
  scope: ConsumptionScope,
  id: number
) {
  const [record] = await db
    .select()
    .from(consumptionRecords)
    .where(and(recordScope(scope), eq(consumptionRecords.id, id)))
    .limit(1);
  if (!record)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Consumo não encontrado nesta empresa/filial.",
    });
  const items = await db
    .select()
    .from(consumptionItems)
    .where(
      and(
        eq(consumptionItems.companyId, scope.companyId),
        eq(consumptionItems.branchId, scope.branchId),
        eq(consumptionItems.consumptionId, id)
      )
    )
    .orderBy(asc(consumptionItems.id));
  const stockItems = await db
    .select()
    .from(consumptionStockItems)
    .where(
      and(
        eq(consumptionStockItems.companyId, scope.companyId),
        eq(consumptionStockItems.branchId, scope.branchId),
        eq(consumptionStockItems.consumptionId, id)
      )
    )
    .orderBy(asc(consumptionStockItems.productId));
  const { payloadHash: _hash, requestKey: _key, ...publicRecord } = record;
  return { ...publicRecord, items, stockItems };
}
