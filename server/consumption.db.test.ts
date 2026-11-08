import { describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getTableName, type SQL } from "drizzle-orm";
vi.mock("./db", () => ({
  getDb: vi.fn(() => {
    throw new Error("Real DB forbidden");
  }),
}));
import {
  getConsumption,
  getConsumptionEmployees,
  getConsumptionProducts,
  listConsumption,
  makeConsumptionRepository,
  saveConsumptionEmployee,
  type ConsumptionActor,
} from "./consumption";

type Call = {
  kind: string;
  table?: string;
  where?: SQL;
  limit?: number;
  offset?: number;
  lock?: string;
  values?: unknown;
  order?: unknown[];
};
const dialect = new MySqlDialect();
const actor: ConsumptionActor = {
  companyId: 11,
  branchId: 22,
  userId: "operator",
  userName: "Maria",
  role: "admin",
};
function mockDatabase(responses: unknown[] = []) {
  const calls: Call[] = [];
  const db = {
    select: vi.fn(() => builder("select")),
    update: vi.fn((table: Parameters<typeof getTableName>[0]) =>
      builder("update", table)
    ),
    insert: vi.fn((table: Parameters<typeof getTableName>[0]) =>
      builder("insert", table)
    ),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
  };
  function builder(kind: string, table?: Parameters<typeof getTableName>[0]) {
    const call: Call = { kind, table: table ? getTableName(table) : undefined };
    calls.push(call);
    const query = {
      from(t: Parameters<typeof getTableName>[0]) {
        call.table = getTableName(t);
        return query;
      },
      where(condition: SQL) {
        call.where = condition;
        return query;
      },
      limit(value: number) {
        call.limit = value;
        return query;
      },
      offset(value: number) {
        call.offset = value;
        return query;
      },
      orderBy(...order: unknown[]) {
        call.order = order;
        return query;
      },
      groupBy() {
        return query;
      },
      for(lock: string) {
        call.lock = lock;
        return query;
      },
      set(values: unknown) {
        call.values = values;
        return query;
      },
      values(values: unknown) {
        call.values = values;
        return query;
      },
      then(
        resolve: (value: unknown) => unknown,
        reject: (e: unknown) => unknown
      ) {
        const value = responses.shift() ?? [];
        return value instanceof Error
          ? Promise.reject(value).then(resolve, reject)
          : Promise.resolve(value).then(resolve, reject);
      },
    };
    return query;
  }
  return {
    db: db as unknown as Parameters<typeof makeConsumptionRepository>[0],
    calls,
  };
}
function compiled(call: Call) {
  return dialect.sqlToQuery(call.where!);
}
function scoped(call: Call, branch = true) {
  const { sql, params } = compiled(call);
  expect(sql).toContain(`\`${call.table}\`.\`companyId\``);
  expect(params).toContain(actor.companyId);
  if (branch) {
    expect(sql).toContain(`\`${call.table}\`.\`branchId\``);
    expect(params).toContain(actor.branchId);
  }
}

describe("consumption database helpers: offline SQL builders only", () => {
  it("employees are company-scoped and active by default", async () => {
    const { db, calls } = mockDatabase([
      [{ id: 1, name: "Ana", active: true }],
    ]);
    expect(await getConsumptionEmployees(db, actor)).toEqual([
      { id: 1, name: "Ana", active: true },
    ]);
    scoped(calls[0], false);
    expect(compiled(calls[0]).sql).toContain("`active`");
    expect(compiled(calls[0]).params).toContain(true);
  });
  it("includeInactive returns former employees without changing company scope", async () => {
    const { db, calls } = mockDatabase();
    await getConsumptionEmployees(db, actor, true);
    scoped(calls[0], false);
    expect(compiled(calls[0]).sql).not.toContain("`active`");
  });
  it("products cap results at 100 and require company+branch+active status", async () => {
    const { db, calls } = mockDatabase();
    await getConsumptionProducts(db, actor, "  PaO%  ");
    scoped(calls[0]);
    expect(calls[0].limit).toBe(100);
    expect(compiled(calls[0]).params).toContain("%pao\\%%");
    expect(compiled(calls[0]).params).toContain(true);
  });
  it("get scopes record, original items and stock leaves and removes internal request hash/key", async () => {
    const { db, calls } = mockDatabase([
      [
        {
          id: 77,
          companyId: 11,
          branchId: 22,
          employeeName: "João",
          payloadHash: "hidden",
          requestKey: "hidden",
        },
      ],
      [
        {
          productName: "Antigo",
          quantity: 2,
          unitCost: "0.29",
          totalCost: "0.58",
        },
      ],
      [{ movementId: 99 }],
    ]);
    const result = await getConsumption(db, actor, 77);
    expect(result.employeeName).toBe("João");
    expect(result.items[0].productName).toBe("Antigo");
    expect(result).not.toHaveProperty("payloadHash");
    expect(result).not.toHaveProperty("requestKey");
    expect(calls.map(c => c.table)).toEqual([
      "consumptionRecords",
      "consumptionItems",
      "consumptionStockItems",
    ]);
    calls.forEach(c => {
      scoped(c);
      expect(compiled(c).params).toContain(77);
    });
  });
  it("foreign/unknown get stops before looking up any child records", async () => {
    const { db, calls } = mockDatabase([[]]);
    await expect(getConsumption(db, actor, 77)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(calls).toHaveLength(1);
    scoped(calls[0]);
  });
  it("list uses filtered totals over all matching records, effective costs only and scoped pagination", async () => {
    const { db, calls } = mockDatabase([
      [
        {
          id: 77,
          employeeName: "João",
          payloadHash: "hidden",
          requestKey: "hidden",
          status: "ACTIVE",
        },
      ],
      [{ total: "42" }],
      [{ totalCost: "0.30", records: "40", units: "60" }],
      [
        {
          employeeId: 1,
          employeeName: "João",
          totalCost: "0.30",
          records: "40",
        },
      ],
    ]);
    const result = await listConsumption(db, {
      ...actor,
      startDate: "2026-11-01",
      endDate: "2026-11-08",
      employeeId: 1,
      page: 2,
      pageSize: 20,
    });
    expect(result.total).toBe(42);
    expect(result.summary).toEqual({
      totalCost: "0.30",
      records: 40,
      units: 60,
    });
    expect(result.byEmployee[0]).toEqual({
      employeeId: 1,
      employeeName: "João",
      totalCost: "0.30",
      records: 40,
    });
    expect(result.items[0]).not.toHaveProperty("payloadHash");
    expect(result.items[0]).not.toHaveProperty("requestKey");
    calls.forEach(c => scoped(c));
    expect(calls[0].limit).toBe(20);
    expect(calls[0].offset).toBe(20);
    const range = compiled(calls[0]);
    expect(range.params).toContain("2026-11-01 03:00:00.000");
    expect(range.params).toContain("2026-11-09 03:00:00.000");
    expect(compiled(calls[2]).params).toContain("ACTIVE");
    expect(compiled(calls[3]).params).toContain("ACTIVE");
  });
  it("CANCELLED list keeps audit rows but excludes cancelled cost from KPIs", async () => {
    const { db, calls } = mockDatabase([
      [{ id: 1, status: "CANCELLED" }],
      [{ total: "1" }],
      [{ totalCost: "0", records: "0", units: "0" }],
      [],
    ]);
    const result = await listConsumption(db, { ...actor, status: "CANCELLED" });
    expect(result.total).toBe(1);
    expect(result.summary.totalCost).toBe("0.00");
    expect(compiled(calls[2]).params).toContain("CANCELLED");
    expect(compiled(calls[2]).params).toContain("ACTIVE");
  });
  it("saveEmployee requires admin before any database call", async () => {
    const { db, calls } = mockDatabase();
    await expect(
      saveConsumptionEmployee(
        db,
        { ...actor, role: "operacional" },
        { name: "Ana" }
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls).toHaveLength(0);
  });
  it("new employee needs no account/login and always belongs to actor company", async () => {
    const { db, calls } = mockDatabase([[{ insertId: 8 }]]);
    expect(await saveConsumptionEmployee(db, actor, { name: " Ana " })).toEqual(
      { id: 8, name: "Ana", active: true }
    );
    expect(calls[0].values).toEqual({
      companyId: 11,
      name: "Ana",
      active: true,
      createdBy: "operator",
      updatedBy: "operator",
    });
  });
  it("renaming locks company employee and preserves current active status unless specified", async () => {
    const { db, calls } = mockDatabase([
      [{ id: 8, active: false }],
      [{ affectedRows: 1 }],
    ]);
    expect(
      await saveConsumptionEmployee(db, actor, { id: 8, name: "Ana Maria" })
    ).toEqual({ id: 8, name: "Ana Maria", active: false });
    expect(calls[0].lock).toBe("update");
    calls.forEach(c => scoped(c, false));
    expect(calls[1].values).toEqual({
      name: "Ana Maria",
      active: false,
      updatedBy: "operator",
    });
  });
  it("cannot rename a foreign employee", async () => {
    const { db, calls } = mockDatabase([[]]);
    await expect(
      saveConsumptionEmployee(db, actor, { id: 8, name: "Ana" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(calls).toHaveLength(1);
    scoped(calls[0], false);
  });
  it("membership requires company, user and exact branch or company-wide assignment", async () => {
    const { db, calls } = mockDatabase();
    await makeConsumptionRepository(db).memberships(actor.userId, actor);
    scoped(calls[0]);
    const query = compiled(calls[0]);
    expect(query.params).toContain("operator");
    expect(query.sql).toContain("is null");
  });
  it("branch validation requires branch company and active status", async () => {
    const { db, calls } = mockDatabase([[{ id: 22 }]]);
    expect(await makeConsumptionRepository(db).branchActive(actor)).toBe(true);
    const query = compiled(calls[0]);
    expect(query.params).toContain(11);
    expect(query.params).toContain(22);
    expect(query.params).toContain(true);
  });
  it("replay lookup is unique by company/requestKey and never unrestricted by company", async () => {
    const { db, calls } = mockDatabase();
    await makeConsumptionRepository(db).findRequest(actor, "request-key");
    scoped(calls[0], false);
    expect(compiled(calls[0]).params).toContain("request-key");
  });
  it("stock update is scoped and includes anti-overdraft predicate, even under locks", async () => {
    const { db, calls } = mockDatabase([[{ affectedRows: 1 }]]);
    await makeConsumptionRepository(db).transaction(tx =>
      tx.changeStock(actor, 77, -2)
    );
    scoped(calls[0]);
    expect(compiled(calls[0]).sql).toContain(">=");
    expect(compiled(calls[0]).params).toContain(2);
  });
  it("stock affectedRows=0 throws, preventing partial transaction commit", async () => {
    const { db } = mockDatabase([[{ affectedRows: 0 }]]);
    await expect(
      makeConsumptionRepository(db).transaction(tx =>
        tx.changeStock(actor, 77, -2)
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("locks products and compositions under scope with update locks and ascending product order", async () => {
    const { db, calls } = mockDatabase([[{ id: 1 }, { id: 2 }], []]);
    await makeConsumptionRepository(db).transaction(tx =>
      tx.lockGraph(actor, [1, 2])
    );
    calls.forEach(c => {
      scoped(c);
      expect(c.lock).toBe("update");
    });
    expect(calls[0].order?.length).toBe(1);
  });
  it("rejects recipe changed to a leaf outside the original lock set", async () => {
    const { db } = mockDatabase([
      [{ id: 1 }, { id: 2 }],
      [{ parentProductId: 2, childProductId: 3 }],
    ]);
    await expect(
      makeConsumptionRepository(db).transaction(tx =>
        tx.lockGraph(actor, [1, 2])
      )
    ).rejects.toThrow("composição foi alterada");
  });
  it("restoration does not require products active, but does require original company/branch", async () => {
    const { db, calls } = mockDatabase([[{ id: 1 }]]);
    await makeConsumptionRepository(db).transaction(tx =>
      tx.lockRestoreProducts(actor, [1])
    );
    scoped(calls[0]);
    expect(calls[0].lock).toBe("update");
    expect(compiled(calls[0]).sql).not.toContain("`active`");
  });
  it("cancellation updates are conditional to prevent a second stock restoration", async () => {
    const { db, calls } = mockDatabase([
      [{ affectedRows: 1 }],
      [{ affectedRows: 1 }],
    ]);
    await makeConsumptionRepository(db).transaction(async tx => {
      await tx.linkReversal(actor, 7, 99);
      await tx.markCancelled(actor, 77, "Erro corrigido", new Date());
    });
    calls.forEach(c => scoped(c));
    expect(compiled(calls[0]).sql).toContain("is null");
    expect(compiled(calls[1]).params).toContain("ACTIVE");
  });
});

describe("consumption database contention retry", () => {
  it("retries a rolled-back deadlock at most twice before success", async () => {
    const { retryConsumptionTransaction } = await import("./consumption");
    const run = vi
      .fn()
      .mockRejectedValueOnce({ code: "ER_LOCK_DEADLOCK", errno: 1213 })
      .mockRejectedValueOnce({
        cause: { code: "ER_LOCK_WAIT_TIMEOUT", errno: 1205 },
      })
      .mockResolvedValue({ id: 1 });
    await expect(retryConsumptionTransaction(run)).resolves.toEqual({ id: 1 });
    expect(run).toHaveBeenCalledTimes(3);
  });
  it("never retries application errors or duplicate-key errors inside the transaction", async () => {
    const { retryConsumptionTransaction } = await import("./consumption");
    for (const error of [
      new Error("Estoque insuficiente"),
      { code: "ER_DUP_ENTRY" },
    ]) {
      const run = vi.fn().mockRejectedValue(error);
      await expect(retryConsumptionTransaction(run)).rejects.toBe(error);
      expect(run).toHaveBeenCalledOnce();
    }
  });
  it("bounded retry returns repeated deadlock after three failed attempts", async () => {
    const { retryConsumptionTransaction } = await import("./consumption");
    const error = { code: "ER_LOCK_DEADLOCK" };
    const run = vi.fn().mockRejectedValue(error);
    await expect(retryConsumptionTransaction(run)).rejects.toBe(error);
    expect(run).toHaveBeenCalledTimes(3);
  });
});
