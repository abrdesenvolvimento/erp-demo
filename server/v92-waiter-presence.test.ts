import { describe, it, expect } from "vitest";

// ==================== Waiter Presence Panel Tests ====================

describe("Waiter Presence - Status Classification", () => {
  type WaiterStatus = 'active' | 'checked_out' | 'absent';

  function classifyStatus(checkIn: { checkedInAt: Date | null; checkedOutAt: Date | null } | null): WaiterStatus {
    if (!checkIn) return 'absent';
    if (checkIn.checkedInAt && !checkIn.checkedOutAt) return 'active';
    if (checkIn.checkedOutAt) return 'checked_out';
    return 'absent';
  }

  it("should classify waiter with active check-in as 'active'", () => {
    expect(classifyStatus({ checkedInAt: new Date(), checkedOutAt: null })).toBe('active');
  });

  it("should classify waiter with check-out as 'checked_out'", () => {
    expect(classifyStatus({ checkedInAt: new Date(), checkedOutAt: new Date() })).toBe('checked_out');
  });

  it("should classify waiter without check-in as 'absent'", () => {
    expect(classifyStatus(null)).toBe('absent');
  });
});

describe("Waiter Presence - Sorting", () => {
  it("should sort active first, then checked_out, then absent", () => {
    const waiters = [
      { name: "Carlos", status: "absent" as const },
      { name: "Ana", status: "active" as const },
      { name: "Bruno", status: "checked_out" as const },
      { name: "Diana", status: "active" as const },
    ];

    const statusOrder = { active: 0, checked_out: 1, absent: 2 };
    const sorted = [...waiters].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    expect(sorted[0].name).toBe("Ana");
    expect(sorted[1].name).toBe("Diana");
    expect(sorted[2].name).toBe("Bruno");
    expect(sorted[3].name).toBe("Carlos");
  });
});

describe("Waiter Presence - Time Formatting", () => {
  it("should format check-in time in BRT", () => {
    // Create a date at 14:30 UTC = 11:30 BRT
    const date = new Date("2026-03-09T14:30:00Z");
    const formatted = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
    expect(formatted).toBe("11:30");
  });

  it("should handle null dates gracefully", () => {
    const formatTime = (dateVal: Date | null) => {
      if (!dateVal) return '--:--';
      return dateVal.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    };
    expect(formatTime(null)).toBe('--:--');
    expect(formatTime(new Date("2026-03-09T18:00:00Z"))).toBe("15:00");
  });
});

describe("Waiter Presence - Stats Aggregation", () => {
  it("should count active waiters correctly", () => {
    const waiters = [
      { status: "active" as const },
      { status: "active" as const },
      { status: "checked_out" as const },
      { status: "absent" as const },
    ];
    const activeCount = waiters.filter(w => w.status === 'active').length;
    expect(activeCount).toBe(2);
    expect(waiters.length).toBe(4);
  });

  it("should calculate revenue per waiter", () => {
    const orderCounts = [
      { waiterId: "w1", count: 5, revenue: "450.00" },
      { waiterId: "w2", count: 3, revenue: "280.50" },
    ];

    const w1 = orderCounts.find(o => o.waiterId === "w1");
    expect(w1?.count).toBe(5);
    expect(parseFloat(w1?.revenue || "0")).toBe(450);

    const w3 = orderCounts.find(o => o.waiterId === "w3");
    expect(w3).toBeUndefined();
  });
});

describe("Waiter Presence - Panel Visibility", () => {
  it("should only show for hamburgueria + admin", () => {
    const cases = [
      { isHamburgueria: true, isAdmin: true, expected: true },
      { isHamburgueria: true, isAdmin: false, expected: false },
      { isHamburgueria: false, isAdmin: true, expected: false },
      { isHamburgueria: false, isAdmin: false, expected: false },
    ];

    for (const c of cases) {
      const shouldShow = c.isHamburgueria && c.isAdmin;
      expect(shouldShow).toBe(c.expected);
    }
  });

  it("should not render when no waiters exist", () => {
    const data = { waiters: [], config: null };
    const shouldRender = data.waiters.length > 0;
    expect(shouldRender).toBe(false);
  });
});
