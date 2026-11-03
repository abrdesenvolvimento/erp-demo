import { describe, expect, it } from "vitest";
import { nextDailyLoginCutoff, isAnniversaryMonth } from "../shared/sessionSecurity";
import { productionRequestAllowed, matchesProductionSecret } from "./productionTerminalSecurity";
import { createHash } from "node:crypto";

describe("política diária e campanha", () => {
  it("expira exatamente às 04h Brasília, não à meia-noite UTC", () => {
    expect(nextDailyLoginCutoff(Date.parse("2026-11-03T06:59:59Z"))).toBe(Date.parse("2026-11-03T07:00:00Z"));
  });
  it("novo login no corte vale até 04h do dia seguinte", () => {
    expect(nextDailyLoginCutoff(Date.parse("2026-11-03T07:00:00Z"))).toBe(Date.parse("2026-11-04T07:00:00Z"));
  });
  it("mantém o login que atravessa a meia-noite de Brasília", () => {
    expect(nextDailyLoginCutoff(Date.parse("2026-11-03T03:00:00Z"))).toBe(Date.parse("2026-11-03T07:00:00Z"));
  });
  it("trata virada de ano", () => {
    expect(nextDailyLoginCutoff(Date.parse("2026-12-31T22:00:00Z"))).toBe(Date.parse("2027-01-01T07:00:00Z"));
  });
  it("comemoração só em novembro de 2026 no fuso brasileiro", () => {
    expect(isAnniversaryMonth(Date.parse("2026-11-01T02:59:59Z"))).toBe(false);
    expect(isAnniversaryMonth(Date.parse("2026-11-01T03:00:00Z"))).toBe(true);
    expect(isAnniversaryMonth(Date.parse("2026-12-01T02:59:59Z"))).toBe(true);
    expect(isAnniversaryMonth(Date.parse("2026-12-01T03:00:00Z"))).toBe(false);
    expect(isAnniversaryMonth(Date.parse("2027-11-15T12:00:00Z"))).toBe(false);
  });
});

describe("credencial limitada de terminal", () => {
  it("permite somente as duas consultas de produção da empresa vinculada", () => {
    expect(productionRequestAllowed("salon.getKDSItems", "query", 2, 2)).toBe(true);
    expect(productionRequestAllowed("salon.getKDSStats", "query", 2, 2)).toBe(true);
    expect(productionRequestAllowed("salon.getKDSItems", "query", 1, 2)).toBe(false);
    expect(productionRequestAllowed("sales.list", "query", 2, 2)).toBe(false);
    expect(productionRequestAllowed("salon.updateItemStatus", "mutation", 2, 2)).toBe(false);
    expect(productionRequestAllowed("salon.getKDSItems", "mutation", 2, 2)).toBe(false);
  });
  it("companyId não é autenticação, token incorreto ou hash inválido não passa", () => {
    const hash = createHash("sha256").update("segredo-aleatorio-do-terminal").digest("hex");
    expect(matchesProductionSecret("segredo-aleatorio-do-terminal", hash)).toBe(true);
    expect(matchesProductionSecret("2", hash)).toBe(false);
    expect(matchesProductionSecret("segredo-aleatorio-do-terminal", "xxx")).toBe(false);
  });
});
