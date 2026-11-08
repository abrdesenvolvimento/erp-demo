import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./operatorSecurity", () => ({
  assertOperatorActive: vi.fn(async () => undefined),
}));
vi.mock("./db", () => ({
  getDb: vi.fn(() => {
    throw new Error("No real database allowed");
  }),
}));
vi.mock("./consumption", async importOriginal => {
  const original = await importOriginal<typeof import("./consumption")>();
  return {
    ...original,
    consumptionDatabase: vi.fn(async () => ({ mocked: true })),
    makeConsumptionRepository: vi.fn(() => ({
      companyActive: async () => true,
      branchActive: async () => true,
      memberships: async () => [{ role: "operacional" }],
    })),
    getConsumptionEmployees: vi.fn(async () => [
      { id: 1, name: "Ana", active: true },
    ]),
    saveConsumptionEmployee: vi.fn(async () => ({
      id: 1,
      name: "Ana",
      active: true,
    })),
    getConsumptionProducts: vi.fn(async () => []),
    listConsumption: vi.fn(async () => ({
      items: [],
      total: 0,
      summary: { totalCost: "0.00", records: 0, units: 0 },
      byEmployee: [],
    })),
    getConsumption: vi.fn(async () => ({ id: 1, items: [], stockItems: [] })),
    createConsumption: vi.fn(async () => ({ id: 1 })),
    cancelConsumption: vi.fn(async () => ({ id: 1, success: true })),
  };
});
import { consumptionRouter } from "./routers/consumption";
import * as consumption from "./consumption";
import { assertOperatorActive } from "./operatorSecurity";
import type { TrpcContext } from "./_core/context";

function ctx(role = "admin", extra: Partial<TrpcContext> = {}): TrpcContext {
  return {
    activeCompanyId: 1,
    activeBranchId: 2,
    operatorSessionId: "test-session",
    user: {
      id: "operator",
      name: "Maria",
      role,
      blocked: false,
    } as TrpcContext["user"],
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    ...extra,
  };
}
const scope = { companyId: 1, branchId: 2 };
const createInput = {
  ...scope,
  employeeId: 1,
  reason: "Refeição equipe",
  requestKey: "a104886b-7cc7-421c-875a-54e49f59ac25",
  items: [{ productId: 1, quantity: 2 }],
};
const calls = {
  employees: { ...scope },
  products: { ...scope },
  list: { ...scope },
  get: { ...scope, id: 1 },
  saveEmployee: { ...scope, name: "Ana" },
  create: createInput,
  cancel: { ...scope, id: 1, reason: "Erro no consumo" },
};
const helpers = {
  employees: consumption.getConsumptionEmployees,
  products: consumption.getConsumptionProducts,
  list: consumption.listConsumption,
  get: consumption.getConsumption,
  saveEmployee: consumption.saveConsumptionEmployee,
  create: consumption.createConsumption,
  cancel: consumption.cancelConsumption,
};
// All runtime calls route through actual protectedProcedure and real membership authorization.
async function invoke(
  method: keyof typeof calls,
  input: unknown,
  context = ctx()
) {
  const caller = consumptionRouter.createCaller(context);
  return (caller[method] as (arg: unknown) => Promise<unknown>)(input);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("consumption router: fixed contracts and pre-DB guards", () => {
  it.each(Object.keys(calls) as (keyof typeof calls)[])(
    "%s requires companyId and branchId in every input",
    async method => {
      const { companyId: _c, branchId: _b, ...withoutScope } = calls[method];
      await expect(invoke(method, withoutScope)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(consumption.consumptionDatabase).not.toHaveBeenCalled();
    }
  );
  it.each(Object.keys(calls) as (keyof typeof calls)[])(
    "%s rejects forged branch IDs before obtaining database",
    async method => {
      await expect(
        invoke(method, { ...calls[method], branchId: 9 })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(consumption.consumptionDatabase).not.toHaveBeenCalled();
      expect(helpers[method]).not.toHaveBeenCalled();
    }
  );
  it.each(Object.keys(calls) as (keyof typeof calls)[])(
    "%s cannot use input IDs to authorize missing context",
    async method => {
      await expect(
        invoke(
          method,
          calls[method],
          ctx("admin", { activeCompanyId: undefined })
        )
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(consumption.consumptionDatabase).not.toHaveBeenCalled();
    }
  );
  it.each(Object.keys(calls) as (keyof typeof calls)[])(
    "%s retains protected procedure operator session guard",
    async method => {
      vi.mocked(assertOperatorActive).mockRejectedValueOnce(
        new Error("Bloqueio do operador")
      );
      await expect(invoke(method, calls[method])).rejects.toThrow(
        "Bloqueio do operador"
      );
      expect(consumption.consumptionDatabase).not.toHaveBeenCalled();
    }
  );
  it("rejects unauthenticated callers before helper execution", async () => {
    await expect(
      invoke("employees", scope, ctx("admin", { user: null }))
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(consumption.consumptionDatabase).not.toHaveBeenCalled();
  });
  it.each(Object.keys(calls) as (keyof typeof calls)[])(
    "%s delegates only after authorized scope",
    async method => {
      await invoke(method, calls[method]);
      expect(consumption.consumptionDatabase).toHaveBeenCalledOnce();
      expect(helpers[method]).toHaveBeenCalledOnce();
    }
  );
  it.each(["saveEmployee", "cancel"] as const)(
    "%s rejects operacional without admin membership",
    async method => {
      await expect(
        invoke(method, calls[method], ctx("operacional"))
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(helpers[method]).not.toHaveBeenCalled();
    }
  );
  it("consultor can read but cannot create", async () => {
    await invoke("employees", scope, ctx("consultor"));
    await expect(
      invoke("create", createInput, ctx("consultor"))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(consumption.createConsumption).not.toHaveBeenCalled();
  });
  it.each([0, -1, 0.5])(
    "create rejects nonpositive/noninteger quantity %s",
    async quantity => {
      await expect(
        invoke("create", {
          ...createInput,
          items: [{ productId: 1, quantity }],
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(consumption.createConsumption).not.toHaveBeenCalled();
    }
  );
  it("create rejects empty items, bad UUID and short trimmed reason", async () => {
    await expect(
      invoke("create", { ...createInput, items: [] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      invoke("create", { ...createInput, requestKey: "bad" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      invoke("create", { ...createInput, reason: " x " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("list defaults pagination to 1/20 and rejects impossible/reversed dates", async () => {
    await invoke("list", scope);
    expect(consumption.listConsumption).toHaveBeenCalledWith(
      expect.anything(),
      { ...scope, page: 1, pageSize: 20 }
    );
    await expect(
      invoke("list", { ...scope, startDate: "2026-02-30" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      invoke("list", {
        ...scope,
        startDate: "2026-11-09",
        endDate: "2026-11-08",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      invoke("list", { ...scope, pageSize: 101 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
