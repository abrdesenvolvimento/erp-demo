import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./db", () => ({
  getDb: vi.fn(() => {
    throw new Error("Real DB access forbidden in consumption tests");
  }),
}));
import {
  authorizeConsumption,
  assertConsumptionContext,
  buildConsumptionPlan,
  cancelConsumption,
  centsToMoney,
  consumptionDateBoundary,
  consumptionPayloadHash,
  createConsumption,
  moneyToCents,
  normalizeConsumptionItems,
  type ConsumptionAccessRepository,
  type ConsumptionActor,
  type ConsumptionContext,
  type ConsumptionCreateInput,
  type ConsumptionGraph,
  type ConsumptionPlan,
  type ConsumptionRepository,
  type ConsumptionTransaction,
  type SnapshotItem,
} from "./consumption";
import type {
  ConsumptionEmployee,
  ConsumptionRecord,
  ConsumptionStockItem,
  Product,
  ProductComposition,
} from "../drizzle/schema";

const actor: ConsumptionActor = {
  companyId: 1,
  branchId: 2,
  userId: "operator",
  userName: "Maria",
  role: "admin",
};
const now = new Date("2026-11-08T15:00:00.000Z");
const input = (
  overrides: Partial<ConsumptionCreateInput> = {}
): ConsumptionCreateInput => ({
  companyId: 1,
  branchId: 2,
  employeeId: 1,
  reason: "Refeição da equipe",
  requestKey: "a104886b-7cc7-421c-875a-54e49f59ac25",
  items: [{ productId: 1, quantity: 2 }],
  ...overrides,
});
const product = (id: number, overrides: Partial<Product> = {}): Product =>
  ({
    id,
    companyId: 1,
    branchId: 2,
    name: `Produto ${id}`,
    uom: "UN",
    currentStock: 10,
    avgCost: "0.10",
    active: true,
    isComposite: false,
    ...overrides,
  }) as Product;
const edge = (
  parentProductId: number,
  childProductId: number,
  quantity = "1.000",
  overrides: Partial<ProductComposition> = {}
): ProductComposition => ({
  id: parentProductId * 100 + childProductId,
  companyId: 1,
  branchId: 2,
  parentProductId,
  childProductId,
  quantity,
  createdAt: now,
  ...overrides,
});
const graph = (
  products = [product(1)],
  compositions: ProductComposition[] = []
): ConsumptionGraph => ({ products, compositions });

class MemoryRepository implements ConsumptionRepository {
  state = {
    graph: graph(),
    employees: [
      {
        id: 1,
        companyId: 1,
        name: "João",
        active: true,
      } as ConsumptionEmployee,
    ],
    records: [] as ConsumptionRecord[],
    items: [] as (SnapshotItem & { consumptionId: number })[],
    stockItems: [] as ConsumptionStockItem[],
    movements: [] as {
      id: number;
      productId: number;
      quantity: number;
      doc: string;
      responsible: string;
      reason: string;
    }[],
  };
  rollbackCount = 0;
  transactions = 0;
  failAt:
    | "items"
    | "movement"
    | "stock"
    | "link"
    | "cancel"
    | "duplicate"
    | undefined;
  mutateOnLock?: (g: ConsumptionGraph) => void;
  locks: number[][] = [];
  winner?: ConsumptionRecord;
  concurrentOnFind?: ConsumptionRecord;
  private gate: Promise<void> = Promise.resolve();
  async graph() {
    return structuredClone(this.state.graph);
  }
  async findRequest(a: ConsumptionActor, key: string) {
    return this.state.records.find(
      r => r.companyId === a.companyId && r.requestKey === key
    );
  }
  async transaction<T>(
    fn: (tx: ConsumptionTransaction) => Promise<T>
  ): Promise<T> {
    const previous = this.gate;
    let release!: () => void;
    this.gate = new Promise(resolve => {
      release = resolve;
    });
    await previous;
    this.transactions++;
    const original = structuredClone(this.state);
    const fail = (point: MemoryRepository["failAt"]) => {
      if (this.failAt === point) throw new Error(`Simulated failure: ${point}`);
    };
    const tx: ConsumptionTransaction = {
      employee: async (a, id) =>
        this.state.employees.find(
          e => e.companyId === a.companyId && e.id === id
        ),
      lockGraph: async (_a, ids) => {
        this.locks.push(ids);
        this.mutateOnLock?.(this.state.graph);
        return structuredClone(this.state.graph);
      },
      findRequest: async (a, key) =>
        this.concurrentOnFind ?? this.findRequest(a, key),
      insertRecord: async (a, i, plan, hash, consumedAt, employeeName) => {
        if (this.failAt === "duplicate")
          throw { code: "ER_DUP_ENTRY", errno: 1062 };
        const id = this.state.records.length + 1;
        this.state.records.push({
          id,
          companyId: a.companyId,
          branchId: a.branchId,
          employeeId: i.employeeId,
          employeeName,
          consumedAt,
          totalCost: plan.totalCost,
          totalUnits: plan.totalUnits,
          reason: i.reason.trim(),
          requestKey: i.requestKey,
          payloadHash: hash,
          status: "ACTIVE",
          createdBy: a.userId,
          createdByName: a.userName,
          createdAt: now,
          cancelledAt: null,
          cancelledBy: null,
          cancelledByName: null,
          cancellationReason: null,
        });
        return id;
      },
      insertItems: async (_a, consumptionId, items) => {
        fail("items");
        this.state.items.push(...items.map(i => ({ ...i, consumptionId })));
      },
      insertMovement: async (a, id, item, reverse, _date, reason) => {
        fail("movement");
        const movementId = this.state.movements.length + 1;
        this.state.movements.push({
          id: movementId,
          productId: item.productId,
          quantity: reverse ? item.quantity : -item.quantity,
          doc: reverse ? `ESTORNO:CONSUMO:${id}` : `CONSUMO:${id}`,
          responsible: a.userId,
          reason,
        });
        return movementId;
      },
      changeStock: async (a, id, delta) => {
        fail("stock");
        const p = this.state.graph.products.find(
          p =>
            p.companyId === a.companyId &&
            p.branchId === a.branchId &&
            p.id === id
        );
        if (!p || (p.currentStock ?? 0) + delta < 0)
          throw new Error("Insufficient stock");
        p.currentStock = (p.currentStock ?? 0) + delta;
      },
      insertStockItem: async (a, consumptionId, item, movementId) => {
        this.state.stockItems.push({
          ...item,
          companyId: a.companyId,
          branchId: a.branchId,
          consumptionId,
          id: this.state.stockItems.length + 1,
          movementId,
          reversalMovementId: null,
        });
      },
      lockRecord: async (a, id) =>
        this.state.records.find(
          r =>
            r.companyId === a.companyId &&
            r.branchId === a.branchId &&
            r.id === id
        ),
      stockItems: async (a, id) =>
        this.state.stockItems.filter(
          s =>
            s.companyId === a.companyId &&
            s.branchId === a.branchId &&
            s.consumptionId === id
        ),
      lockRestoreProducts: async (a, ids) => {
        this.locks.push(ids);
        if (
          ids.some(
            id =>
              !this.state.graph.products.some(
                p =>
                  p.id === id &&
                  p.companyId === a.companyId &&
                  p.branchId === a.branchId
              )
          )
        )
          throw new Error("Original product missing/foreign");
      },
      linkReversal: async (_a, id, movementId) => {
        fail("link");
        const leaf = this.state.stockItems.find(s => s.id === id)!;
        if (leaf.reversalMovementId !== null) throw new Error("Double restore");
        leaf.reversalMovementId = movementId;
      },
      markCancelled: async (a, id, reason, date) => {
        fail("cancel");
        const record = this.state.records.find(r => r.id === id)!;
        record.status = "CANCELLED";
        record.cancelledAt = date;
        record.cancelledBy = a.userId;
        record.cancelledByName = a.userName;
        record.cancellationReason = reason;
      },
    };
    try {
      return await fn(tx);
    } catch (error) {
      this.rollbackCount++;
      this.state = original;
      if (this.failAt === "duplicate" && this.winner)
        this.state.records.push(this.winner);
      throw error;
    } finally {
      release();
    }
  }
}

function access(role = "operacional"): ConsumptionAccessRepository {
  return {
    companyActive: vi.fn(async () => true),
    branchActive: vi.fn(async () => true),
    memberships: vi.fn(async () => [{ role }]),
  };
}
const context = (
  role = "operacional",
  overrides: Partial<ConsumptionContext> = {}
): ConsumptionContext => ({
  activeCompanyId: 1,
  activeBranchId: 2,
  user: { id: "operator", name: "Maria", role },
  ...overrides,
});

describe("consumption: integer cents and recursive recipes", () => {
  it("keeps decimal costs exact, including large decimal(15,2) values", () => {
    expect(moneyToCents("0.10") + moneyToCents("0.20")).toBe(30n);
    expect(centsToMoney(999999999999999n)).toBe("9999999999999.99");
    expect(() => moneyToCents("0.001")).toThrow("centavos");
    expect(() => centsToMoney(1000000000000000n)).toThrow("limite");
  });
  it("aggregates duplicate requested product rows in ascending order", () => {
    expect(
      normalizeConsumptionItems([
        { productId: 3, quantity: 1 },
        { productId: 1, quantity: 2 },
        { productId: 3, quantity: 4 },
      ])
    ).toEqual([
      { productId: 1, quantity: 2 },
      { productId: 3, quantity: 5 },
    ]);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 2147483648])(
    "rejects invalid requested quantity %s",
    quantity => {
      expect(() =>
        buildConsumptionPlan(actor, [{ productId: 1, quantity }], graph())
      ).toThrow("inteiras");
    }
  );
  it("uses leaf avgCost, names and uom snapshots", () => {
    const plan = buildConsumptionPlan(
      actor,
      input().items,
      graph([product(1, { avgCost: "0.29", uom: "CX" })])
    );
    expect(plan.items[0]).toEqual({
      productId: 1,
      productName: "Produto 1",
      uom: "CX",
      quantity: 2,
      unitCost: "0.29",
      totalCost: "0.58",
    });
    expect(plan.totalCost).toBe("0.58");
    expect(plan.totalUnits).toBe(2);
  });
  it("uses recursive components instead of composite avgCost", () => {
    const g = graph(
      [
        product(1, { avgCost: "0.10" }),
        product(2, { avgCost: "0.20" }),
        product(3, { isComposite: true, avgCost: "999.00" }),
        product(4, { isComposite: true }),
      ],
      [edge(3, 1, "2.000"), edge(3, 2), edge(4, 3, "2.000")]
    );
    const plan = buildConsumptionPlan(
      actor,
      [{ productId: 4, quantity: 1 }],
      g
    );
    expect(plan.totalCost).toBe("0.80");
    expect(plan.items[0].unitCost).toBe("0.80");
    expect(plan.stockItems.map(s => [s.productId, s.quantity])).toEqual([
      [1, 4],
      [2, 2],
    ]);
    expect(plan.productIds).toEqual([1, 2, 3, 4]);
  });
  it("aggregates a shared leaf before stock validation and blocks combined overdraft", () => {
    const g = graph(
      [
        product(1, { currentStock: 3 }),
        product(2, { isComposite: true }),
        product(3, { isComposite: true }),
      ],
      [edge(2, 1, "2.000"), edge(3, 1, "2.000")]
    );
    expect(() =>
      buildConsumptionPlan(
        actor,
        [
          { productId: 2, quantity: 1 },
          { productId: 3, quantity: 1 },
        ],
        g
      )
    ).toThrow("Estoque insuficiente");
  });
  it("permits exact integral leaf quantities from decimal compositions", () => {
    const g = graph(
      [product(1), product(2, { isComposite: true })],
      [edge(2, 1, "0.500")]
    );
    const plan = buildConsumptionPlan(
      actor,
      [{ productId: 2, quantity: 2 }],
      g
    );
    expect(plan.stockItems[0].quantity).toBe(1);
    expect(plan.totalCost).toBe("0.10");
  });
  it("rejects fractional leaf deductions rather than rounding", () => {
    const g = graph(
      [product(1), product(2, { isComposite: true })],
      [edge(2, 1, "0.333")]
    );
    expect(() =>
      buildConsumptionPlan(actor, [{ productId: 2, quantity: 3 }], g)
    ).toThrow("baixa fracionária");
  });
  it("aggregates fractional shared leaves EXACTLY and allocates cents without losing value", () => {
    const g = graph(
      [
        product(1, { avgCost: "0.01" }),
        product(2, { isComposite: true }),
        product(3, { isComposite: true }),
      ],
      [edge(2, 1, "0.500"), edge(3, 1, "0.500")]
    );
    const plan = buildConsumptionPlan(
      actor,
      [
        { productId: 2, quantity: 1 },
        { productId: 3, quantity: 1 },
      ],
      g
    );
    expect(plan.stockItems[0].quantity).toBe(1);
    expect(plan.totalCost).toBe("0.01");
    expect(plan.items.map(i => i.totalCost)).toEqual(["0.01", "0.00"]);
    expect(
      plan.items.reduce((sum, i) => sum + moneyToCents(i.totalCost), 0n)
    ).toBe(moneyToCents(plan.totalCost));
  });
  it("detects a recursive cycle", () => {
    expect(() =>
      buildConsumptionPlan(
        actor,
        [{ productId: 1, quantity: 1 }],
        graph(
          [
            product(1, { isComposite: true }),
            product(2, { isComposite: true }),
          ],
          [edge(1, 2), edge(2, 1)]
        )
      )
    ).toThrow("ciclo");
  });
  it("rejects a composite with no recipe", () => {
    expect(() =>
      buildConsumptionPlan(
        actor,
        input().items,
        graph([product(1, { isComposite: true })])
      )
    ).toThrow("não possui composição");
  });
  it.each([{ active: false }, { companyId: 3 }, { branchId: 3 }])(
    "rejects inactive or foreign leaves %j",
    override => {
      expect(() =>
        buildConsumptionPlan(
          actor,
          [{ productId: 2, quantity: 1 }],
          graph(
            [product(1, override), product(2, { isComposite: true })],
            [edge(2, 1)]
          )
        )
      ).toThrow();
    }
  );
  it("rejects a foreign recipe edge and absent component", () => {
    expect(() =>
      buildConsumptionPlan(
        actor,
        input().items,
        graph(
          [product(1, { isComposite: true }), product(2)],
          [edge(1, 2, "1.000", { companyId: 9 })]
        )
      )
    ).toThrow("outra empresa");
    expect(() =>
      buildConsumptionPlan(
        actor,
        input().items,
        graph([product(1, { isComposite: true })], [edge(1, 2)])
      )
    ).toThrow("não pertence");
  });
  it.each(["0.000", "-1.000", "abc"])(
    "rejects malformed/zero component quantity %s",
    qty => {
      expect(() =>
        buildConsumptionPlan(
          actor,
          input().items,
          graph(
            [product(1, { isComposite: true }), product(2)],
            [edge(1, 2, qty)]
          )
        )
      ).toThrow();
    }
  );
  it("does not inherit historical negative-stock permissions", () => {
    expect(() =>
      buildConsumptionPlan(
        actor,
        input().items,
        graph([product(1, { currentStock: -5 })])
      )
    ).toThrow("Estoque insuficiente");
  });
});

describe("consumption: tenant, context and role guards", () => {
  it.each([
    { activeCompanyId: undefined },
    { activeBranchId: undefined },
    { activeCompanyId: -1 },
    { activeBranchId: 0 },
  ])("requires active company AND branch before DB %j", overrides => {
    expect(() =>
      assertConsumptionContext(context("admin", overrides), actor)
    ).toThrow("Selecione");
  });
  it("rejects unauthenticated callers", () => {
    expect(() =>
      assertConsumptionContext(context("admin", { user: null }), actor)
    ).toThrow("Autenticação");
  });
  it.each([
    { companyId: 9, branchId: 2 },
    { companyId: 1, branchId: 9 },
  ])(
    "rejects mismatched input IDs before repository queries %j",
    async scope => {
      const repo = access();
      await expect(
        authorizeConsumption(context(), scope, "read", repo)
      ).rejects.toThrow("diferem");
      expect(repo.companyActive).not.toHaveBeenCalled();
      expect(repo.memberships).not.toHaveBeenCalled();
    }
  );
  it.each(["user", "garcom"])("rejects default/waiter role %s", async role => {
    const repo = access("admin");
    await expect(
      authorizeConsumption(context(role), actor, "read", repo)
    ).rejects.toThrow("perfil");
    expect(repo.companyActive).not.toHaveBeenCalled();
  });
  it.each(["admin", "consultor", "operacional"])(
    "allows read for %s with authorized membership",
    async role => {
      await expect(
        authorizeConsumption(context(role), actor, "read", access(role))
      ).resolves.toMatchObject({ companyId: 1, branchId: 2 });
    }
  );
  it("allows global admin without company membership, still requires valid active branch/company", async () => {
    const repo = access();
    const authorized = await authorizeConsumption(
      context("admin"),
      actor,
      "admin",
      repo
    );
    expect(authorized.role).toBe("admin");
    expect(repo.memberships).not.toHaveBeenCalled();
    vi.mocked(repo.branchActive).mockResolvedValue(false);
    await expect(
      authorizeConsumption(context("admin"), actor, "read", repo)
    ).rejects.toThrow("inativa");
  });
  it("requires membership and cannot grant writes to consultor", async () => {
    const repo = access();
    vi.mocked(repo.memberships).mockResolvedValue([]);
    await expect(
      authorizeConsumption(context(), actor, "read", repo)
    ).rejects.toThrow("Acesso negado");
    await expect(
      authorizeConsumption(
        context("consultor"),
        actor,
        "write",
        access("admin")
      )
    ).rejects.toThrow("Acesso negado");
  });
  it("operacional cannot cancel or edit employees without admin membership", async () => {
    await expect(
      authorizeConsumption(context(), actor, "admin", access())
    ).rejects.toThrow("Acesso negado");
    await expect(
      authorizeConsumption(context(), actor, "write", access())
    ).resolves.toMatchObject({ role: "operacional" });
  });
  it("rejects inactive company", async () => {
    const repo = access();
    vi.mocked(repo.companyActive).mockResolvedValue(false);
    await expect(
      authorizeConsumption(context(), actor, "read", repo)
    ).rejects.toThrow("inativa");
  });
});

describe("consumption: transactions, snapshots and request idempotency", () => {
  let repo: MemoryRepository;
  beforeEach(() => {
    repo = new MemoryRepository();
  });
  it("creates only record/items and negative stock movement with responsible/reason snapshots", async () => {
    await expect(createConsumption(actor, input(), repo, now)).resolves.toEqual(
      { id: 1 }
    );
    expect(repo.state.records[0]).toMatchObject({
      employeeName: "João",
      totalCost: "0.20",
      consumedAt: now,
      createdByName: "Maria",
    });
    expect(repo.state.graph.products[0].currentStock).toBe(8);
    expect(repo.state.movements).toEqual([
      {
        id: 1,
        productId: 1,
        quantity: -2,
        doc: "CONSUMO:1",
        responsible: "operator",
        reason: "Refeição da equipe",
      },
    ]);
    expect(repo.state.stockItems[0]).toMatchObject({
      movementId: 1,
      productName: "Produto 1",
      unitCost: "0.10",
    });
  });
  it.each(["items", "movement", "stock"] as const)(
    "rolls back EVERY write on failure at %s",
    async point => {
      repo.failAt = point;
      const before = structuredClone(repo.state);
      await expect(
        createConsumption(actor, input(), repo, now)
      ).rejects.toThrow("Simulated failure");
      expect(repo.state).toEqual(before);
      expect(repo.rollbackCount).toBe(1);
    }
  );
  it("revalidates cost and stock under ordered product locks", async () => {
    repo.mutateOnLock = g => {
      g.products[0].avgCost = "0.35";
    };
    await createConsumption(actor, input(), repo, now);
    expect(repo.state.records[0].totalCost).toBe("0.70");
    expect(repo.locks[0]).toEqual([1]);
  });
  it("blocks stock changed after prelock preview and writes nothing", async () => {
    repo.mutateOnLock = g => {
      g.products[0].currentStock = 1;
    };
    await expect(createConsumption(actor, input(), repo, now)).rejects.toThrow(
      "Estoque insuficiente"
    );
    expect(repo.state.records).toHaveLength(0);
    expect(repo.state.movements).toHaveLength(0);
  });
  it("rejects newly added composition leaves not included in lock set", async () => {
    repo.state.graph = graph(
      [product(1), product(2, { isComposite: true }), product(3)],
      [edge(2, 1)]
    );
    repo.mutateOnLock = g => {
      g.compositions = [edge(2, 3)];
    };
    await expect(
      createConsumption(
        actor,
        input({ items: [{ productId: 2, quantity: 1 }] }),
        repo,
        now
      )
    ).rejects.toThrow("composição foi alterada");
    expect(repo.locks[0]).toEqual([1, 2]);
    expect(repo.state.records).toHaveLength(0);
  });
  it("revalidates employee active status and tenant inside transaction", async () => {
    repo.state.employees[0].active = false;
    await expect(createConsumption(actor, input(), repo, now)).rejects.toThrow(
      "Funcionário"
    );
    repo.state.employees[0].active = true;
    repo.state.employees[0].companyId = 9;
    await expect(createConsumption(actor, input(), repo, now)).rejects.toThrow(
      "Funcionário"
    );
  });
  it("stable normalized payload supports reordered/aggregated items and trimmed reason", () => {
    expect(
      consumptionPayloadHash(
        actor,
        input({
          items: [
            { productId: 1, quantity: 1 },
            { productId: 1, quantity: 1 },
          ],
        })
      )
    ).toBe(
      consumptionPayloadHash(actor, input({ reason: " Refeição da equipe " }))
    );
  });
  it("replays same request after staff/product inactivity without new stock deductions", async () => {
    await createConsumption(actor, input(), repo, now);
    repo.state.employees[0].active = false;
    repo.state.graph.products[0].active = false;
    await expect(
      createConsumption(actor, input(), repo, new Date("2026-11-09"))
    ).resolves.toEqual({ id: 1, replayed: true });
    expect(repo.state.movements).toHaveLength(1);
    expect(repo.transactions).toBe(1);
  });
  it.each([
    { reason: "Outro motivo" },
    { employeeId: 2 },
    { items: [{ productId: 1, quantity: 3 }] },
    { consumedAt: new Date("2026-11-07T15:00:00Z") },
  ])("rejects conflicting payload reuse %j", async change => {
    await createConsumption(actor, input(), repo, now);
    await expect(
      createConsumption(actor, input(change), repo, now)
    ).rejects.toThrow("outro consumo");
    expect(repo.state.movements).toHaveLength(1);
  });
  it("rejects same request key in a different branch or by a different user", async () => {
    await createConsumption(actor, input(), repo, now);
    await expect(
      createConsumption(
        { ...actor, branchId: 3 },
        input({ branchId: 3 }),
        repo,
        now
      )
    ).rejects.toThrow("outro consumo");
    await expect(
      createConsumption({ ...actor, userId: "another" }, input(), repo, now)
    ).rejects.toThrow("outro consumo");
  });
  it("unique duplicate rolls back all work then fetches committed winner", async () => {
    repo.failAt = "duplicate";
    repo.winner = {
      id: 88,
      companyId: 1,
      branchId: 2,
      requestKey: input().requestKey,
      payloadHash: consumptionPayloadHash(actor, input()),
      createdBy: actor.userId,
    } as ConsumptionRecord;
    await expect(createConsumption(actor, input(), repo, now)).resolves.toEqual(
      { id: 88, replayed: true }
    );
    expect(repo.rollbackCount).toBe(1);
    expect(repo.state.movements).toHaveLength(0);
    expect(repo.state.graph.products[0].currentStock).toBe(10);
  });
  it("handles concurrent repeat before checking already depleted stock", async () => {
    repo.concurrentOnFind = {
      id: 88,
      companyId: 1,
      branchId: 2,
      requestKey: input().requestKey,
      payloadHash: consumptionPayloadHash(actor, input()),
      createdBy: actor.userId,
    } as ConsumptionRecord;
    repo.mutateOnLock = g => {
      g.products[0].currentStock = 0;
    };
    await expect(createConsumption(actor, input(), repo, now)).resolves.toEqual(
      { id: 88, replayed: true }
    );
    expect(repo.state.movements).toHaveLength(0);
  });
  it("simulates simultaneous duplicate requests: exactly one record and deduction", async () => {
    const results = await Promise.all([
      createConsumption(actor, input(), repo, now),
      createConsumption(actor, input(), repo, now),
    ]);
    expect(results.map(r => r.id)).toEqual([1, 1]);
    expect(results.filter(r => r.replayed)).toHaveLength(1);
    expect(repo.state.movements).toHaveLength(1);
    expect(repo.state.graph.products[0].currentStock).toBe(8);
  });
  it("rejects future timestamp, bad key, short reason and foreign input before DB", async () => {
    await expect(
      createConsumption(
        actor,
        input({ consumedAt: new Date("2026-11-09") }),
        repo,
        now
      )
    ).rejects.toThrow("futuro");
    await expect(
      createConsumption(actor, input({ requestKey: "bad" }), repo, now)
    ).rejects.toThrow("UUID");
    await expect(
      createConsumption(actor, input({ reason: " x " }), repo, now)
    ).rejects.toThrow("motivo");
    await expect(
      createConsumption(actor, input({ companyId: 9 }), repo, now)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repo.transactions).toBe(0);
  });
});

describe("consumption: exactly-once cancellation restores original leaves", () => {
  let repo: MemoryRepository;
  beforeEach(async () => {
    repo = new MemoryRepository();
    await createConsumption(actor, input(), repo, now);
  });
  it("restores original stock, snapshots cancel actor/reason and links reversal movement", async () => {
    await expect(
      cancelConsumption(
        { ...actor, userId: "admin", userName: "Ana" },
        1,
        "Registro incorreto",
        repo,
        now
      )
    ).resolves.toEqual({ id: 1, success: true });
    expect(repo.state.graph.products[0].currentStock).toBe(10);
    expect(repo.state.records[0]).toMatchObject({
      status: "CANCELLED",
      cancelledBy: "admin",
      cancelledByName: "Ana",
      cancellationReason: "Registro incorreto",
    });
    expect(repo.state.stockItems[0].reversalMovementId).toBe(2);
    expect(repo.state.movements[1]).toMatchObject({
      quantity: 2,
      doc: "ESTORNO:CONSUMO:1",
      responsible: "admin",
    });
  });
  it("concurrent cancellation restores exactly once", async () => {
    const results = await Promise.all([
      cancelConsumption(actor, 1, "Duplicado", repo, now),
      cancelConsumption(actor, 1, "Duplicado", repo, now),
    ]);
    expect(results.filter(r => r.replayed)).toHaveLength(1);
    expect(repo.state.movements).toHaveLength(2);
    expect(repo.state.graph.products[0].currentStock).toBe(10);
  });
  it("allows inactive employee/product and ignores modified composition, current cost/name", async () => {
    repo.state.employees[0].active = false;
    repo.state.employees[0].name = "Novo nome";
    const p = repo.state.graph.products[0];
    p.active = false;
    p.isComposite = true;
    p.avgCost = "99.00";
    p.name = "Alterado";
    repo.state.graph.compositions = [edge(1, 99, "88.000")];
    await cancelConsumption(actor, 1, "Corrigir registro", repo, now);
    expect(p.currentStock).toBe(10);
    expect(repo.state.records[0].employeeName).toBe("João");
    expect(repo.state.stockItems[0]).toMatchObject({
      productName: "Produto 1",
      quantity: 2,
      unitCost: "0.10",
    });
  });
  it.each(["movement", "stock", "link", "cancel"] as const)(
    "rolls back cancellation and stock on failure at %s",
    async point => {
      repo.failAt = point;
      const before = structuredClone(repo.state);
      await expect(
        cancelConsumption(actor, 1, "Cancelar erro", repo, now)
      ).rejects.toThrow("Simulated failure");
      expect(repo.state).toEqual(before);
      expect(repo.state.records[0].status).toBe("ACTIVE");
    }
  );
  it("refuses unknown/foreign-branch record and operacional cancellation", async () => {
    await expect(
      cancelConsumption(actor, 99, "Cancelar erro", repo, now)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      cancelConsumption(
        { ...actor, branchId: 9 },
        1,
        "Cancelar erro",
        repo,
        now
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      cancelConsumption(
        { ...actor, role: "operacional" },
        1,
        "Cancelar erro",
        repo,
        now
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repo.state.movements).toHaveLength(1);
  });
  it("refuses missing or foreign original products rather than crediting another tenant", async () => {
    repo.state.graph.products[0].companyId = 9;
    await expect(
      cancelConsumption(actor, 1, "Cancelar erro", repo, now)
    ).rejects.toThrow("foreign");
    expect(repo.state.records[0].status).toBe("ACTIVE");
    expect(repo.state.movements).toHaveLength(1);
  });
  it("rejects pre-reversed snapshot or missing stock snapshot", async () => {
    repo.state.stockItems[0].reversalMovementId = 99;
    await expect(
      cancelConsumption(actor, 1, "Cancelar erro", repo, now)
    ).rejects.toThrow("inconsistente");
    repo.state.stockItems = [];
    await expect(
      cancelConsumption(actor, 1, "Cancelar erro", repo, now)
    ).rejects.toThrow("sem snapshot");
  });
});

describe("consumption: business date filtering", () => {
  it("converts Brasília dates into UTC boundaries and rejects impossible dates", () => {
    expect(consumptionDateBoundary("2026-11-08").toISOString()).toBe(
      "2026-11-08T03:00:00.000Z"
    );
    expect(() => consumptionDateBoundary("2026-02-30")).toThrow("data válida");
    expect(() => consumptionDateBoundary("08/11/2026")).toThrow("data válida");
  });
});
