import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  consumptionCurrency,
  consumptionDateTime,
  consumptionFingerprint,
  consumptionPermissions,
  currentConsumptionMonth,
  estimatedConsumptionCost,
  getConsumptionAttempt,
  positiveIntegerQuantity,
  validConsumptionPeriod,
  validateConsumptionDraft,
  type ConsumptionDraftItem,
  type ConsumptionPayload,
  type ConsumptionProduct,
} from "../client/src/components/consumo/consumptionUi";

const page = readFileSync(
  resolve(import.meta.dirname, "../client/src/pages/Consumo.tsx"),
  "utf8"
);
const helper = readFileSync(
  resolve(
    import.meta.dirname,
    "../client/src/components/consumo/consumptionUi.ts"
  ),
  "utf8"
);
const product: ConsumptionProduct = {
  id: 7,
  name: "Água",
  uom: "UN",
  currentStock: 8,
  avgCost: "2.25",
  isComposite: false,
  branchId: 4,
};
const draft = (
  overrides: Partial<ConsumptionProduct> = {},
  quantity = "2"
): ConsumptionDraftItem[] => [
  { product: { ...product, ...overrides }, quantity },
];
const payload: ConsumptionPayload = {
  companyId: 2,
  branchId: 4,
  employeeId: 12,
  reason: "Refeição da equipe",
  items: [{ productId: 7, quantity: 2 }],
};

describe("Consumo — período de Brasília", () => {
  it("inicia no mês brasileiro mesmo quando UTC já virou o mês", () => {
    expect(currentConsumptionMonth(new Date("2026-03-01T01:30:00Z"))).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
  });
  it("trata ano bissexto e dezembro sem deriva de fuso", () => {
    expect(currentConsumptionMonth(new Date("2024-02-15T15:00:00Z"))).toEqual({
      startDate: "2024-02-01",
      endDate: "2024-02-29",
    });
    expect(currentConsumptionMonth(new Date("2026-12-31T23:00:00Z"))).toEqual({
      startDate: "2026-12-01",
      endDate: "2026-12-31",
    });
  });
  it("permite filtros abertos e rejeita intervalo invertido e datas inexistentes", () => {
    expect(validConsumptionPeriod("", "")).toBe(true);
    expect(validConsumptionPeriod("2026-11-01", "")).toBe(true);
    expect(validConsumptionPeriod("2026-11-10", "2026-11-01")).toBe(false);
    expect(validConsumptionPeriod("2026-02-30", "2026-03-10")).toBe(false);
    expect(validConsumptionPeriod("2026-13-01", "")).toBe(false);
  });
  it("exibe registros no fuso brasileiro e não inventa data ausente", () => {
    expect(consumptionDateTime("2026-03-01T01:30:00Z")).toContain("28/02/2026");
    expect(consumptionDateTime(null)).toBe("—");
    expect(consumptionDateTime("invalid")).toBe("—");
  });
});

describe("Consumo — validações de rascunho e estimativas", () => {
  it.each([
    "0",
    "-1",
    "1.5",
    "1,5",
    "",
    "1e2",
    "NaN",
    "Infinity",
    "9007199254740992",
  ])("rejeita quantidade não inteira positiva: %s", value => {
    expect(positiveIntegerQuantity(value)).toBeNull();
  });
  it("aceita inteiro positivo sem arredondar silenciosamente", () => {
    expect(positiveIntegerQuantity("3")).toBe(3);
    expect(positiveIntegerQuantity("001")).toBe(1);
    expect(positiveIntegerQuantity("2147483647")).toBe(2147483647);
    expect(positiveIntegerQuantity("2147483648")).toBeNull();
  });
  it("exige funcionário ativo, motivo e produto", () => {
    expect(
      validateConsumptionDraft(null, false, "refeição", draft())
    ).toContain("funcionário ativo");
    expect(validateConsumptionDraft(12, false, "refeição", draft())).toContain(
      "funcionário ativo"
    );
    expect(validateConsumptionDraft(12, true, "  a  ", draft())).toContain(
      "3 caracteres"
    );
    expect(validateConsumptionDraft(12, true, "refeição", [])).toContain(
      "produto"
    );
    expect(
      validateConsumptionDraft(12, true, "refeição", [...draft(), ...draft()])
    ).toContain("repetidos");
  });
  it("não permite estoque negativo em produto simples", () => {
    expect(
      validateConsumptionDraft(12, true, "refeição", draft({}, "9"))
    ).toContain("Estoque insuficiente");
    expect(
      validateConsumptionDraft(12, true, "refeição", draft({ currentStock: 0 }))
    ).toContain("Estoque insuficiente");
    expect(validateConsumptionDraft(12, true, "refeição", draft())).toBeNull();
  });
  it("respeita o máximo de 100 produtos por lançamento", () => {
    const items = Array.from(
      { length: 101 },
      (_, id) => draft({ id: id + 1 })[0]
    );
    expect(validateConsumptionDraft(12, true, "refeição", items)).toContain(
      "100 produtos"
    );
    expect(
      validateConsumptionDraft(12, true, "refeição", items.slice(0, 100))
    ).toBeNull();
  });
  it("não usa saldo ou custo do pai para validar/custear um composto", () => {
    expect(
      validateConsumptionDraft(
        12,
        true,
        "refeição",
        draft({ isComposite: true, currentStock: 0 })
      )
    ).toBeNull();
    expect(
      estimatedConsumptionCost(draft({ isComposite: true, avgCost: "999999" }))
    ).toBeNull();
    expect(
      estimatedConsumptionCost([
        ...draft(),
        ...draft({ id: 8, isComposite: true }),
      ])
    ).toBeNull();
  });
  it("estima simples para exibição e preserva lacunas de custo", () => {
    expect(estimatedConsumptionCost(draft())).toBe(4.5);
    expect(estimatedConsumptionCost(draft({ avgCost: null }))).toBeNull();
    expect(estimatedConsumptionCost(draft({ avgCost: "invalid" }))).toBeNull();
    expect(estimatedConsumptionCost(draft({ avgCost: 0 }))).toBe(0);
    expect(consumptionCurrency(undefined)).toBe("—");
    expect(consumptionCurrency("4.50")).toMatch(/4,50/);
  });
});

describe("Consumo — idempotência executável", () => {
  it("gera uma chave por payload e a preserva para retry após erro", () => {
    const uuid = vi
      .fn()
      .mockReturnValueOnce("uuid-1")
      .mockReturnValueOnce("uuid-2");
    const first = getConsumptionAttempt(null, payload, uuid);
    expect(first.requestKey).toBe("uuid-1");
    expect(getConsumptionAttempt(first, { ...payload }, uuid)).toBe(first);
    expect(
      getConsumptionAttempt(
        first,
        { ...payload, reason: ` ${payload.reason} ` },
        uuid
      )
    ).toBe(first);
    expect(uuid).toHaveBeenCalledTimes(1);
    const changed = getConsumptionAttempt(
      first,
      { ...payload, items: [{ productId: 7, quantity: 3 }] },
      uuid
    );
    expect(changed.requestKey).toBe("uuid-2");
    expect(uuid).toHaveBeenCalledTimes(2);
  });
  it.each(["companyId", "branchId", "employeeId"] as const)(
    "nova chave se %s muda",
    field => {
      const first = getConsumptionAttempt(null, payload, () => "old");
      expect(
        getConsumptionAttempt(first, { ...payload, [field]: 99 }, () => "new")
          .requestKey
      ).toBe("new");
    }
  );
  it("mudança de motivo reinicia; ordenação de itens não duplica payload equivalente", () => {
    const first = getConsumptionAttempt(null, payload, () => "old");
    expect(
      getConsumptionAttempt(
        first,
        { ...payload, reason: "Outro motivo" },
        () => "new"
      ).requestKey
    ).toBe("new");
    const multi = {
      ...payload,
      items: [
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 2 },
      ],
    };
    expect(consumptionFingerprint(multi)).toBe(
      consumptionFingerprint({ ...multi, items: [...multi.items].reverse() })
    );
  });
});

describe("Consumo — permissões executáveis", () => {
  it("admin gerencia/cancela, operacional lança, consultor apenas consulta", () => {
    expect(consumptionPermissions("admin")).toEqual({
      canView: true,
      canCreate: true,
      isAdmin: true,
    });
    expect(consumptionPermissions("operacional")).toEqual({
      canView: true,
      canCreate: true,
      isAdmin: false,
    });
    expect(consumptionPermissions("consultor")).toEqual({
      canView: true,
      canCreate: false,
      isAdmin: false,
    });
    expect(consumptionPermissions("garcom")).toEqual({
      canView: false,
      canCreate: false,
      isAdmin: false,
    });
    expect(consumptionPermissions(undefined).canView).toBe(false);
  });
});

describe("Consumo — regressões estáticas de contrato e segurança UI", () => {
  const code = page.replace(/\s+/g, "");
  it("usa hooks trpc padrão com empresa e filial em TODOS inputs", () => {
    for (const endpoint of ["list", "employees", "products", "get"])
      expect(page).toContain(`trpc.consumption.${endpoint}.useQuery`);
    for (const endpoint of ["create", "cancel", "saveEmployee"])
      expect(page).toContain(`trpc.consumption.${endpoint}.useMutation`);
    for (const input of [
      "listInput",
      "employeeInput",
      "productInput",
      "detailInput",
    ]) {
      expect(code).toContain(`const${input}=useMemo(()=>({...scope`);
    }
    expect(code).toContain(
      "createMutation.mutateAsync({...payload,requestKey:"
    );
    expect(code).toContain("cancelMutation.mutateAsync({...scope,id:");
    expect(code).toContain("employeeMutation.mutateAsync({...scope,id:");
    expect(page).not.toMatch(/\bfetch\(/);
    expect(page).not.toContain("axios");
  });
  it("só monta consultas com contexto definido, desativa durante troca e remonta por escopo", () => {
    expect(code).toContain("activeCompanyId!==null&&activeBranchId!==null");
    expect(code).toContain("!loading&&!switching");
    expect(page).toContain("key={`${activeCompanyId}:${activeBranchId}`}");
    expect(page).toContain("activeCompany?.role || user?.role");
    expect(page).not.toContain("activeCompanyId || 1");
    expect(page).not.toContain("activeBranchId || 0");
    expect(page).not.toContain("Hamburgueria");
  });
  it("confirma baixa, bloqueia fechamento e submits concorrentes, preserva chave no retry", () => {
    expect(page).toContain("Confirmar baixa de estoque?");
    expect(page).toContain("Confirmar e baixar estoque");
    expect(page).toContain("if (creating.current || !canCreate) return;");
    expect(page).toContain("if (creating.current) return;");
    expect(page).toContain("showCloseButton={!createMutation.isPending}");
    expect(page).toContain("if (creating.current) event.preventDefault()");
    expect(code).toContain(
      "requestAttempt.current=getConsumptionAttempt(requestAttempt.current,payload)"
    );
    expect(page).toContain("requestAttempt.current = null");
    expect(code).toContain(
      "disabled={createMutation.isPending||Boolean(draftError)"
    );
    expect(helper).toContain("globalThis.crypto.randomUUID()");
    expect(page).not.toContain("allowNegative");
    expect(page).toContain("retry: false");
  });
  it("não envia estimativas, snapshots ou custos como fonte monetária na criação", () => {
    const payloadBlock = page.slice(
      page.indexOf("const payload: ConsumptionPayload"),
      page.indexOf("requestAttempt.current = getConsumptionAttempt")
    );
    expect(payloadBlock).toContain("productId:");
    expect(payloadBlock).toContain("quantity:");
    expect(payloadBlock).not.toMatch(/unitCost|totalCost|avgCost|productName/);
    expect(page).toContain("— será calculado");
    expect(page).toContain("custo definitivo");
    expect(page).toContain("detail.stockItems");
  });
  it("mantém históricos de cancelados, cancelamento admin com motivo e cadastro sem exclusão", () => {
    expect(page).toContain('detail.status === "CANCELLED"');
    expect(page).toContain("detail.cancelledByName");
    expect(page).toContain("detail.cancellationReason");
    expect(page).toContain("detail.cancelledAt");
    expect(page).toContain('isAdmin && detail?.status === "ACTIVE"');
    expect(page).toContain("cancellationReason.trim().length < 3");
    expect(page).toContain("Confirmar cancelamento e estorno");
    expect(page).toContain("Desativar");
    expect(page).toContain("Renomear");
    expect(page).not.toContain("deleteEmployee");
    expect(page).toContain("não precisa ter uma conta");
  });
  it("invalida consumo e consultas de estoque depois de criação/cancelamento", () => {
    for (const scope of [
      "consumption",
      "products",
      "stockAnalysis",
      "stockMovements",
    ])
      expect(page).toContain(`utils.${scope}.invalidate()`);
    expect(page.match(/await invalidateStockAndConsumption\(\)/g)).toHaveLength(
      2
    );
  });
  it("limita tabela ao desktop, oferece cards mobile, busca server/debounce e estados de erro", () => {
    expect(page).toContain("md:hidden");
    expect(page).toContain("overflow-x-auto rounded-lg border md:block");
    expect(page).toContain("min-w-0 space-y-5 overflow-hidden");
    expect(page).toContain("useDebounce(productSearch.trim(), 300)");
    expect(page).toContain("shouldFilter={false}");
    expect(page).toContain("Até 100 produtos por busca");
    expect(page).toContain('role="combobox"');
    expect(page).toContain('role="alert"');
    expect(page).toContain("step={1}");
    expect(page).toContain("const PAGE_SIZE = 20");
    expect(page).toContain("enabled: periodValid");
    expect(page).toContain("bg-sidebar-primary");
    expect(page).not.toContain("toISOString().split");
  });
});
