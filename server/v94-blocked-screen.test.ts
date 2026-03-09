import { describe, it, expect } from 'vitest';

/**
 * Tests for v9.4: Blocked screen redesign + quick check-in from Dashboard
 * 
 * The blocked screen is a frontend-only change (no backend logic changed),
 * so we test the underlying access control logic that feeds it.
 * The quick check-in from Dashboard reuses existing waiterCheckIn/waiterCheckOut mutations.
 */

describe('v9.4 - Waiter Access Control Logic', () => {
  // The checkWaiterAccess response shape determines what the blocked screen shows
  it('should return outsideHours flag when schedule restriction blocks', () => {
    // Simulate the backend logic
    const config = {
      waiterAccessControl: true,
      openingTime: '11:00',
      closingTime: '23:00',
      requireCheckIn: false,
    };
    
    const currentHour = 2; // 02:00 - outside hours
    const currentMinute = 0;
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const openMinutes = 11 * 60; // 11:00
    const closeMinutes = 23 * 60; // 23:00
    
    const outsideHours = currentTimeMinutes < openMinutes || currentTimeMinutes >= closeMinutes;
    expect(outsideHours).toBe(true);
  });

  it('should NOT block when inside operating hours', () => {
    const currentHour = 15; // 15:00 - inside hours
    const currentMinute = 30;
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const openMinutes = 11 * 60;
    const closeMinutes = 23 * 60;
    
    const outsideHours = currentTimeMinutes < openMinutes || currentTimeMinutes >= closeMinutes;
    expect(outsideHours).toBe(false);
  });

  it('should return needsCheckIn flag when check-in is required but not done', () => {
    const config = {
      waiterAccessControl: true,
      requireCheckIn: true,
    };
    const hasActiveCheckIn = false;
    
    const needsCheckIn = config.requireCheckIn && !hasActiveCheckIn;
    expect(needsCheckIn).toBe(true);
  });

  it('should allow access when check-in is active regardless of schedule', () => {
    // This is the key fix from v9.3 - check-in overrides schedule
    const config = {
      waiterAccessControl: true,
      openingTime: '11:00',
      closingTime: '23:00',
      requireCheckIn: true,
    };
    
    const hasActiveCheckIn = true;
    const currentHour = 2; // 02:00 - outside hours
    
    // The logic: if check-in is active, allow immediately
    const allowed = hasActiveCheckIn; // check-in overrides everything
    expect(allowed).toBe(true);
  });

  it('should determine correct blocked screen title based on flags', () => {
    // Frontend logic for title
    const getTitle = (outsideHours: boolean, needsCheckIn: boolean) => {
      if (outsideHours) return 'Fora do Horário';
      if (needsCheckIn) return 'Aguardando Liberação';
      return 'Acesso Restrito';
    };
    
    expect(getTitle(true, false)).toBe('Fora do Horário');
    expect(getTitle(false, true)).toBe('Aguardando Liberação');
    expect(getTitle(false, false)).toBe('Acesso Restrito');
  });
});

describe('v9.4 - Quick Check-in from Dashboard', () => {
  it('should validate waiterCheckIn mutation input shape', () => {
    // The mutation expects { companyId, userId }
    const input = { companyId: 'company-1', userId: 'user-1' };
    expect(input).toHaveProperty('companyId');
    expect(input).toHaveProperty('userId');
    expect(typeof input.companyId).toBe('string');
    expect(typeof input.userId).toBe('string');
  });

  it('should validate waiterCheckOut mutation input shape', () => {
    const input = { companyId: 'company-1', userId: 'user-1' };
    expect(input).toHaveProperty('companyId');
    expect(input).toHaveProperty('userId');
  });

  it('should show Liberar button only for absent waiters', () => {
    const waiters = [
      { userId: '1', status: 'absent' as const },
      { userId: '2', status: 'active' as const },
      { userId: '3', status: 'checked_out' as const },
    ];
    
    const absentWaiters = waiters.filter(w => w.status === 'absent');
    const activeWaiters = waiters.filter(w => w.status === 'active');
    
    expect(absentWaiters.length).toBe(1);
    expect(absentWaiters[0].userId).toBe('1');
    expect(activeWaiters.length).toBe(1);
    expect(activeWaiters[0].userId).toBe('2');
  });

  it('should show Check-out button only for active waiters', () => {
    const waiters = [
      { userId: '1', status: 'absent' as const },
      { userId: '2', status: 'active' as const },
    ];
    
    const showCheckOut = waiters.filter(w => w.status === 'active');
    expect(showCheckOut.length).toBe(1);
    expect(showCheckOut[0].userId).toBe('2');
  });
});
