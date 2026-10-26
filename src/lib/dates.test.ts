import { describe, expect, it } from 'vitest';
import { addDays, dateRange, daysBetween, formatDate, isoWeekLabel, isoWeekday, parseUkDate, startOfIsoWeek, toDateKey } from './dates';

describe('dates', () => {
  it('uses Europe/London for date keys', () => {
    // 23:30 UTC on 1 July is 00:30 BST on 2 July.
    expect(toDateKey(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02');
    // In winter London is UTC.
    expect(toDateKey(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-01');
  });
  it('does day arithmetic across DST', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(daysBetween('2026-10-26', '2026-12-18')).toBe(53);
    expect(dateRange('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
  it('handles ISO weeks', () => {
    expect(isoWeekday('2026-10-26')).toBe(1);
    expect(isoWeekday('2026-11-01')).toBe(7);
    expect(startOfIsoWeek('2026-11-01')).toBe('2026-10-26');
    expect(isoWeekLabel('2026-10-26')).toBe('2026-W44');
    expect(isoWeekLabel('2027-01-01')).toBe('2026-W53');
  });
  it('formats and parses DD/MM/YYYY', () => {
    expect(formatDate('2026-12-18')).toBe('18/12/2026');
    expect(parseUkDate('18/12/2026')).toBe('2026-12-18');
    expect(parseUkDate('31/02/2026')).toBeNull();
  });
});
