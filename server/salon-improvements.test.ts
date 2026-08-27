import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectPath = resolve(import.meta.dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectPath, relativePath), "utf8");

describe("Salão — identificação e cancelamento auditável", () => {
  const schema = readProjectFile("drizzle/schema.ts");
  const salonRouter = readProjectFile("server/routers/salon.ts");
  const comandaPage = readProjectFile("client/src/pages/SalaoComanda.tsx");
  const mesasPage = readProjectFile("client/src/pages/SalaoMesas.tsx");

  it("mantém a identificação opcional de cliente na comanda", () => {
    expect(schema).toContain('customerLabel: varchar("customerLabel", { length: 100 })');
    expect(salonRouter).toContain("updateOrderCustomerLabel");
    expect(salonRouter).toContain("customerLabel: input.customerLabel || null");
    expect(mesasPage).toContain('Label htmlFor="customerLabel"');
    expect(comandaPage).toContain("Identificação da comanda");
  });

  it("não confia na empresa ou na mesa informada pelo navegador ao abrir a comanda", () => {
    expect(salonRouter).toContain("Empresa ativa inválida para abertura de comanda");
    expect(salonRouter).toContain("Mesa não encontrada na empresa ativa");
    expect(salonRouter).toContain("tableNumber: table.number");
    expect(salonRouter).toContain("eq(salonTables.companyId, ctx.activeCompanyId)");
  });

  it("cancela sem exclusão física e registra a trilha de auditoria", () => {
    expect(schema).toContain('cancelledAt: timestamp("cancelledAt")');
    expect(schema).toContain('cancelledBy: varchar("cancelledBy", { length: 64 })');
    expect(schema).toContain('cancellationReason: varchar("cancellationReason", { length: 500 })');
    expect(salonRouter).toContain('status: "CANCELLED"');
    expect(salonRouter).toContain("cancelledAt: new Date()");
    expect(salonRouter).toContain("cancelledBy: ctx.user?.id ?? null");
    expect(salonRouter).toContain("cancellationReason: input.reason || null");
  });

  it("exige motivo fora de rascunho, bloqueia comanda encerrada e avisa a produção", () => {
    expect(salonRouter).toContain('const requiresReason = item.status !== "DRAFT"');
    expect(salonRouter).toContain("Informe o motivo do cancelamento de item já encaminhado ao atendimento");
    expect(salonRouter).toContain("Item de comanda encerrada exige estorno da venda");
    expect(salonRouter).toContain('title: "Item cancelado na comanda"');
    expect(comandaPage).toContain("Confirmar cancelamento");
  });
});

describe("Salão — análise KDS contextual", () => {
  const kdsPage = readProjectFile("client/src/pages/AnaliseKDS.tsx");

  it("consulta a empresa ativa e usa a data brasileira nos atalhos", () => {
    expect(kdsPage).toContain("const { activeCompanyId, activeCompany } = useCompany()");
    expect(kdsPage).toContain("const companyId = activeCompanyId ?? 0");
    expect(kdsPage).toContain("formatDate(brazilToday.date)");
    expect(kdsPage).not.toContain("formatDate(today)");
    expect(kdsPage).not.toContain("new Date(today)");
  });

  it("diferencia falha de consulta de período sem produção", () => {
    expect(kdsPage).toContain("Não foi possível carregar a análise KDS");
    expect(kdsPage).toContain("Nenhum item foi enviado à produção neste período");
    expect(kdsPage).toContain("A análise considera somente itens efetivamente encaminhados à cozinha ou ao bar.");
  });
});

describe("Salão — ticket de produção e leitura de observações", () => {
  const salonRouter = readProjectFile("server/routers/salon.ts");
  const printAgent = readProjectFile("print-agent/print-agent.js");
  const kitchenKds = readProjectFile("client/src/pages/SalaoKDSCozinha.tsx");
  const barKds = readProjectFile("client/src/pages/SalaoKDSBar.tsx");

  it("propaga a identificação do cliente até o ticket de produção", () => {
    expect(salonRouter).toContain("customerLabel: salonOrders.customerLabel");
    expect(kitchenKds).toContain("customerLabel: first.customerLabel");
    expect(barKds).toContain("customerLabel: first.customerLabel");
    expect(printAgent).toContain("waiterName, customerLabel");
    expect(printAgent).toContain("Cliente: ${customerLabel}");
  });

  it("trata observações como instruções operacionais de alta visibilidade", () => {
    expect(printAgent).toContain(">>> OBS:");
    expect(printAgent).toContain("ESCPOS.DOUBLE_HEIGHT_ON");
    expect(kitchenKds).toContain("Atenção — observação");
    expect(barKds).toContain("Atenção — observação");
    expect(kitchenKds).toContain("text-base font-extrabold");
    expect(barKds).toContain("text-base font-extrabold");
  });
});
