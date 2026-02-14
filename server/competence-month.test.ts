import { describe, it, expect } from 'vitest';
import { getCompetenceMonthBrazil } from '../shared/dateUtils';

describe('getCompetenceMonthBrazil', () => {
  it('should return correct month for regular date', () => {
    // Jan 15 2026 12:00 UTC = Jan 15 2026 09:00 Brazil
    const date = new Date('2026-01-15T12:00:00Z');
    expect(getCompetenceMonthBrazil(date)).toBe('2026-01');
  });

  it('should handle midnight UTC correctly (still same day in Brazil)', () => {
    // Jan 15 2026 00:00 UTC = Jan 14 2026 21:00 Brazil
    const date = new Date('2026-01-15T00:00:00Z');
    expect(getCompetenceMonthBrazil(date)).toBe('2026-01');
  });

  it('should handle end of month boundary - Dec 31 21:00+ UTC is Jan 1 in Brazil', () => {
    // Dec 31 2025 22:00 UTC = Dec 31 2025 19:00 Brazil (still December)
    const date1 = new Date('2025-12-31T22:00:00Z');
    expect(getCompetenceMonthBrazil(date1)).toBe('2025-12');
  });

  it('should handle Jan 1 early UTC which is still Dec 31 in Brazil', () => {
    // Jan 1 2026 01:00 UTC = Dec 31 2025 22:00 Brazil (still December!)
    const date = new Date('2026-01-01T01:00:00Z');
    expect(getCompetenceMonthBrazil(date)).toBe('2025-12');
  });

  it('should handle Jan 1 03:00+ UTC which is Jan 1 in Brazil', () => {
    // Jan 1 2026 03:00 UTC = Jan 1 2026 00:00 Brazil (January!)
    const date = new Date('2026-01-01T03:00:00Z');
    expect(getCompetenceMonthBrazil(date)).toBe('2026-01');
  });

  it('should handle Jan 31 end of day UTC which is Feb 1 in Brazil', () => {
    // Jan 31 2026 23:30 UTC = Jan 31 2026 20:30 Brazil (still January)
    const date = new Date('2026-01-31T23:30:00Z');
    expect(getCompetenceMonthBrazil(date)).toBe('2026-01');
  });

  it('should handle Feb 1 early UTC which is still Jan 31 in Brazil', () => {
    // Feb 1 2026 01:00 UTC = Jan 31 2026 22:00 Brazil (still January!)
    const date = new Date('2026-02-01T01:00:00Z');
    expect(getCompetenceMonthBrazil(date)).toBe('2026-01');
  });

  it('should handle string dates', () => {
    expect(getCompetenceMonthBrazil('2026-06-15T12:00:00Z')).toBe('2026-06');
  });

  it('should return different result than toISOString for boundary dates', () => {
    // This is the key test - toISOString would give wrong result
    // Jan 1 2026 02:00 UTC = Dec 31 2025 23:00 Brazil
    const date = new Date('2026-01-01T02:00:00Z');
    const utcMonth = date.toISOString().slice(0, 7); // Would give 2026-01 (WRONG for Brazil)
    const brazilMonth = getCompetenceMonthBrazil(date); // Should give 2025-12 (CORRECT for Brazil)
    
    expect(utcMonth).toBe('2026-01'); // UTC says January
    expect(brazilMonth).toBe('2025-12'); // Brazil says December
    expect(utcMonth).not.toBe(brazilMonth); // They should differ!
  });
});
