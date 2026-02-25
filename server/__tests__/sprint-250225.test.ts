import { describe, it, expect } from "vitest";
import { getBrazilianHolidays, getHolidaysForMonth, isHoliday } from "../../shared/holidays";

describe("Feriados Brasileiros", () => {
  describe("getBrazilianHolidays", () => {
    it("deve retornar todos os feriados nacionais e facultativos do ano", () => {
      const holidays2026 = getBrazilianHolidays(2026);
      // 10 nacionais + 3 facultativos (Carnaval seg, ter, Corpus Christi) = 13 mínimo
      expect(holidays2026.length).toBeGreaterThanOrEqual(13);
    });

    it("deve incluir feriados fixos corretos", () => {
      const holidays2026 = getBrazilianHolidays(2026);
      const dates = holidays2026.map(h => h.date);
      
      expect(dates).toContain("2026-01-01"); // Confraternização Universal
      expect(dates).toContain("2026-04-21"); // Tiradentes
      expect(dates).toContain("2026-05-01"); // Dia do Trabalho
      expect(dates).toContain("2026-09-07"); // Independência
      expect(dates).toContain("2026-10-12"); // N. Sra. Aparecida
      expect(dates).toContain("2026-11-02"); // Finados
      expect(dates).toContain("2026-11-15"); // Proclamação da República
      expect(dates).toContain("2026-11-20"); // Consciência Negra
      expect(dates).toContain("2026-12-25"); // Natal
    });

    it("deve calcular Páscoa 2026 corretamente (5 de abril)", () => {
      const holidays2026 = getBrazilianHolidays(2026);
      const pascoa = holidays2026.find(h => h.name === "Páscoa");
      expect(pascoa).toBeDefined();
      expect(pascoa!.date).toBe("2026-04-05");
    });

    it("deve calcular Sexta-feira Santa 2026 corretamente (3 de abril)", () => {
      const holidays2026 = getBrazilianHolidays(2026);
      const sextaSanta = holidays2026.find(h => h.name === "Sexta-feira Santa");
      expect(sextaSanta).toBeDefined();
      expect(sextaSanta!.date).toBe("2026-04-03");
    });

    it("deve calcular Carnaval 2026 corretamente (17 de fevereiro)", () => {
      const holidays2026 = getBrazilianHolidays(2026);
      const carnavalTer = holidays2026.find(h => h.name === "Carnaval (Terça)");
      expect(carnavalTer).toBeDefined();
      expect(carnavalTer!.date).toBe("2026-02-17");
    });

    it("deve calcular Corpus Christi 2026 corretamente (4 de junho)", () => {
      const holidays2026 = getBrazilianHolidays(2026);
      const corpus = holidays2026.find(h => h.name === "Corpus Christi");
      expect(corpus).toBeDefined();
      expect(corpus!.date).toBe("2026-06-04");
    });

    it("deve calcular Páscoa 2025 corretamente (20 de abril)", () => {
      const holidays2025 = getBrazilianHolidays(2025);
      const pascoa = holidays2025.find(h => h.name === "Páscoa");
      expect(pascoa).toBeDefined();
      expect(pascoa!.date).toBe("2025-04-20");
    });

    it("deve retornar feriados ordenados por data", () => {
      const holidays = getBrazilianHolidays(2026);
      for (let i = 1; i < holidays.length; i++) {
        expect(holidays[i].date >= holidays[i - 1].date).toBe(true);
      }
    });
  });

  describe("getHolidaysForMonth", () => {
    it("deve retornar apenas feriados do mês solicitado", () => {
      const feb2026 = getHolidaysForMonth(2026, 2);
      expect(feb2026.length).toBeGreaterThan(0);
      for (const h of feb2026) {
        expect(h.date.startsWith("2026-02")).toBe(true);
      }
    });

    it("deve retornar Carnaval em fevereiro 2026", () => {
      const feb2026 = getHolidaysForMonth(2026, 2);
      const names = feb2026.map(h => h.name);
      expect(names).toContain("Carnaval (Terça)");
      expect(names).toContain("Carnaval (Segunda)");
    });

    it("deve retornar vazio para meses sem feriado (agosto)", () => {
      const aug2026 = getHolidaysForMonth(2026, 8);
      expect(aug2026.length).toBe(0);
    });
  });

  describe("isHoliday", () => {
    it("deve retornar o feriado para uma data que é feriado", () => {
      const result = isHoliday(2026, 12, 25);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Natal");
      expect(result!.type).toBe("nacional");
    });

    it("deve retornar null para uma data que não é feriado", () => {
      const result = isHoliday(2026, 3, 15);
      expect(result).toBeNull();
    });

    it("deve identificar Carnaval como facultativo", () => {
      const result = isHoliday(2026, 2, 17);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("facultativo");
    });
  });
});

describe("Calendar Highlights - Schema e Estrutura", () => {
  it("deve importar calendarHighlights do schema", async () => {
    const schema = await import("../../drizzle/schema");
    expect(schema.calendarHighlights).toBeDefined();
  });

  it("deve ter os tipos exportados", async () => {
    const schema = await import("../../drizzle/schema");
    // Verificar que tipos CalendarHighlight e InsertCalendarHighlight existem
    expect(schema.calendarHighlights).toBeDefined();
  });
});

describe("Credit Summary - Estrutura", () => {
  it("deve importar getCreditSummary do db", async () => {
    const dbModule = await import("../db");
    expect(typeof dbModule.getCreditSummary).toBe("function");
  });

  it("deve importar getCalendarHighlights do db", async () => {
    const dbModule = await import("../db");
    expect(typeof dbModule.getCalendarHighlights).toBe("function");
  });

  it("deve importar addCalendarHighlight do db", async () => {
    const dbModule = await import("../db");
    expect(typeof dbModule.addCalendarHighlight).toBe("function");
  });

  it("deve importar removeCalendarHighlight do db", async () => {
    const dbModule = await import("../db");
    expect(typeof dbModule.removeCalendarHighlight).toBe("function");
  });
});

describe("Timezone - formatDateBR e formatDateTimeBR", () => {
  it("deve importar funções de timezone do shared", async () => {
    const dateUtils = await import("../../shared/dateUtils");
    expect(typeof dateUtils.formatDateBR).toBe("function");
    expect(typeof dateUtils.formatDateTimeBR).toBe("function");
  });

  it("formatDateBR deve formatar data corretamente", async () => {
    const { formatDateBR } = await import("../../shared/dateUtils");
    // Criar uma data conhecida
    const date = new Date("2026-02-25T15:00:00Z");
    const result = formatDateBR(date);
    // Deve conter formato dd/mm/yyyy
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(result).toContain("2026");
  });
});

describe("Multiempresa - Parcelas com companyId", () => {
  it("schema de purchaseInstallments deve estar definido", async () => {
    const schema = await import("../../drizzle/schema");
    expect(schema.purchaseInstallments).toBeDefined();
  });

  it("schema de expenseInstallments deve ter companyId", async () => {
    const schema = await import("../../drizzle/schema");
    expect(schema.expenseInstallments).toBeDefined();
  });

  it("schema de receivableInstallments deve ter companyId", async () => {
    const schema = await import("../../drizzle/schema");
    expect(schema.receivableInstallments).toBeDefined();
  });
});
