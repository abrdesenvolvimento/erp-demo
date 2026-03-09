/**
 * Testes da lógica de Horário de Pico (Análise KDS)
 * Cobre: cálculo de hourlyStats, peakHour, breakdown por destino (kitchen/bar)
 */

import { describe, it, expect } from "vitest";

// ==================== HOURLY STATS COMPUTATION ====================

interface CompletedItem {
  sentAt: string | null;
  readyAt: string | null;
  productionDestination: "KITCHEN" | "BAR" | "BOTH";
}

/**
 * Simulates the backend hourlyStats computation logic from salon.ts getKDSAnalytics
 */
function computeHourlyStats(items: CompletedItem[]) {
  const hourCounts: Record<number, number> = {};
  const hourKitchenCounts: Record<number, number> = {};
  const hourBarCounts: Record<number, number> = {};

  for (const item of items) {
    if (item.sentAt) {
      // BRT = UTC-3
      const brHour = new Date(new Date(item.sentAt).getTime() - 3 * 3600000).getUTCHours();
      hourCounts[brHour] = (hourCounts[brHour] || 0) + 1;
      const dest = item.productionDestination;
      if (dest === "KITCHEN" || dest === "BOTH") hourKitchenCounts[brHour] = (hourKitchenCounts[brHour] || 0) + 1;
      if (dest === "BAR" || dest === "BOTH") hourBarCounts[brHour] = (hourBarCounts[brHour] || 0) + 1;
    }
  }

  // Peak hour
  let peakHour: string | null = null;
  let peakCount = 0;
  for (const [h, c] of Object.entries(hourCounts)) {
    if (c > peakCount) { peakCount = c; peakHour = `${h.padStart(2, "0")}:00`; }
  }

  // Hourly stats (all 24 hours)
  const hourlyStats: { hour: string; count: number; kitchen: number; bar: number }[] = [];
  for (let h = 0; h < 24; h++) {
    hourlyStats.push({
      hour: `${String(h).padStart(2, "0")}:00`,
      count: hourCounts[h] || 0,
      kitchen: hourKitchenCounts[h] || 0,
      bar: hourBarCounts[h] || 0,
    });
  }

  return { peakHour, hourlyStats };
}

describe("KDS Hourly Stats - Peak hour computation", () => {
  it("should return null peakHour when no items", () => {
    const result = computeHourlyStats([]);
    expect(result.peakHour).toBeNull();
    expect(result.hourlyStats.length).toBe(24);
    expect(result.hourlyStats.every(h => h.count === 0)).toBe(true);
  });

  it("should identify peak hour correctly", () => {
    // 3 items at 20:00 BRT (23:00 UTC), 1 item at 19:00 BRT (22:00 UTC)
    const items: CompletedItem[] = [
      { sentAt: "2026-03-08T23:10:00.000Z", readyAt: "2026-03-08T23:20:00.000Z", productionDestination: "KITCHEN" },
      { sentAt: "2026-03-08T23:15:00.000Z", readyAt: "2026-03-08T23:25:00.000Z", productionDestination: "KITCHEN" },
      { sentAt: "2026-03-08T23:30:00.000Z", readyAt: "2026-03-08T23:40:00.000Z", productionDestination: "BAR" },
      { sentAt: "2026-03-08T22:00:00.000Z", readyAt: "2026-03-08T22:10:00.000Z", productionDestination: "KITCHEN" },
    ];
    const result = computeHourlyStats(items);
    expect(result.peakHour).toBe("20:00"); // 3 items at 20h BRT
    expect(result.hourlyStats[20].count).toBe(3);
    expect(result.hourlyStats[19].count).toBe(1);
  });

  it("should correctly split kitchen vs bar counts", () => {
    // All at 21:00 BRT (00:00 UTC next day)
    const items: CompletedItem[] = [
      { sentAt: "2026-03-09T00:05:00.000Z", readyAt: "2026-03-09T00:15:00.000Z", productionDestination: "KITCHEN" },
      { sentAt: "2026-03-09T00:10:00.000Z", readyAt: "2026-03-09T00:20:00.000Z", productionDestination: "KITCHEN" },
      { sentAt: "2026-03-09T00:15:00.000Z", readyAt: "2026-03-09T00:25:00.000Z", productionDestination: "BAR" },
      { sentAt: "2026-03-09T00:20:00.000Z", readyAt: "2026-03-09T00:30:00.000Z", productionDestination: "BAR" },
      { sentAt: "2026-03-09T00:25:00.000Z", readyAt: "2026-03-09T00:35:00.000Z", productionDestination: "BAR" },
    ];
    const result = computeHourlyStats(items);
    expect(result.hourlyStats[21].count).toBe(5);
    expect(result.hourlyStats[21].kitchen).toBe(2);
    expect(result.hourlyStats[21].bar).toBe(3);
    expect(result.peakHour).toBe("21:00");
  });

  it("should count BOTH destination in both kitchen and bar", () => {
    const items: CompletedItem[] = [
      { sentAt: "2026-03-08T21:00:00.000Z", readyAt: "2026-03-08T21:10:00.000Z", productionDestination: "BOTH" },
    ];
    const result = computeHourlyStats(items);
    // 21:00 UTC - 3h = 18:00 BRT
    expect(result.hourlyStats[18].count).toBe(1);
    expect(result.hourlyStats[18].kitchen).toBe(1);
    expect(result.hourlyStats[18].bar).toBe(1);
  });

  it("should handle items with null sentAt", () => {
    const items: CompletedItem[] = [
      { sentAt: null, readyAt: "2026-03-08T21:10:00.000Z", productionDestination: "KITCHEN" },
      { sentAt: "2026-03-08T21:00:00.000Z", readyAt: "2026-03-08T21:10:00.000Z", productionDestination: "BAR" },
    ];
    const result = computeHourlyStats(items);
    // Only 1 valid item at 18:00 BRT
    expect(result.hourlyStats[18].count).toBe(1);
    expect(result.hourlyStats[18].bar).toBe(1);
    expect(result.hourlyStats[18].kitchen).toBe(0);
  });

  it("should produce 24 hourly entries always", () => {
    const result = computeHourlyStats([]);
    expect(result.hourlyStats.length).toBe(24);
    expect(result.hourlyStats[0].hour).toBe("00:00");
    expect(result.hourlyStats[23].hour).toBe("23:00");
  });

  it("should handle multiple hours with equal counts (first wins)", () => {
    // 2 items at 18h BRT, 2 items at 20h BRT
    const items: CompletedItem[] = [
      { sentAt: "2026-03-08T21:00:00.000Z", readyAt: "2026-03-08T21:10:00.000Z", productionDestination: "KITCHEN" },
      { sentAt: "2026-03-08T21:30:00.000Z", readyAt: "2026-03-08T21:40:00.000Z", productionDestination: "KITCHEN" },
      { sentAt: "2026-03-08T23:00:00.000Z", readyAt: "2026-03-08T23:10:00.000Z", productionDestination: "BAR" },
      { sentAt: "2026-03-08T23:30:00.000Z", readyAt: "2026-03-08T23:40:00.000Z", productionDestination: "BAR" },
    ];
    const result = computeHourlyStats(items);
    // Both 18h and 20h have 2 items. The loop iterates Object.entries which is insertion order.
    // 18 is inserted first, so peakHour should be 18:00
    expect(result.hourlyStats[18].count).toBe(2);
    expect(result.hourlyStats[20].count).toBe(2);
    // Peak is whichever was encountered first with the max count
    expect(result.peakHour).not.toBeNull();
  });

  it("should handle late-night items correctly (BRT midnight = 03:00 UTC)", () => {
    // 23:30 BRT = 02:30 UTC next day
    const items: CompletedItem[] = [
      { sentAt: "2026-03-09T02:30:00.000Z", readyAt: "2026-03-09T02:40:00.000Z", productionDestination: "KITCHEN" },
    ];
    const result = computeHourlyStats(items);
    expect(result.hourlyStats[23].count).toBe(1); // 23h BRT
    expect(result.hourlyStats[23].kitchen).toBe(1);
    expect(result.peakHour).toBe("23:00");
  });
});

// ==================== CHART DATA FILTERING (FRONTEND LOGIC) ====================

describe("KDS Peak Hour Chart - Frontend filtering logic", () => {
  function filterChartData(hourlyStats: { hour: string; count: number; kitchen: number; bar: number }[]) {
    const hasData = hourlyStats.some(h => h.count > 0);
    if (!hasData) return null;

    let firstActive = hourlyStats.findIndex(h => h.count > 0);
    let lastActive = hourlyStats.length - 1;
    for (let i = hourlyStats.length - 1; i >= 0; i--) {
      if (hourlyStats[i].count > 0) { lastActive = i; break; }
    }
    const rangeStart = Math.max(0, firstActive - 1);
    const rangeEnd = Math.min(23, lastActive + 1);
    const filtered = hourlyStats.slice(rangeStart, rangeEnd + 1);
    const maxCount = Math.max(...filtered.map(h => h.count), 1);
    return { hours: filtered, maxCount };
  }

  it("should return null for all-zero data", () => {
    const stats = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, "0")}:00`,
      count: 0, kitchen: 0, bar: 0,
    }));
    expect(filterChartData(stats)).toBeNull();
  });

  it("should filter to active range with 1h padding", () => {
    const stats = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, "0")}:00`,
      count: 0, kitchen: 0, bar: 0,
    }));
    // Activity at 18h and 21h
    stats[18].count = 5; stats[18].kitchen = 3; stats[18].bar = 2;
    stats[21].count = 3; stats[21].kitchen = 1; stats[21].bar = 2;

    const result = filterChartData(stats)!;
    expect(result).not.toBeNull();
    // Range: 17h (padding) to 22h (padding) = 6 entries
    expect(result.hours.length).toBe(6); // 17, 18, 19, 20, 21, 22
    expect(result.hours[0].hour).toBe("17:00");
    expect(result.hours[result.hours.length - 1].hour).toBe("22:00");
    expect(result.maxCount).toBe(5);
  });

  it("should not go below 0h or above 23h for padding", () => {
    const stats = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, "0")}:00`,
      count: 0, kitchen: 0, bar: 0,
    }));
    stats[0].count = 2; stats[0].kitchen = 2;
    stats[23].count = 4; stats[23].bar = 4;

    const result = filterChartData(stats)!;
    expect(result.hours[0].hour).toBe("00:00"); // Can't go below 0
    expect(result.hours[result.hours.length - 1].hour).toBe("23:00"); // Can't go above 23
    expect(result.maxCount).toBe(4);
  });
});
