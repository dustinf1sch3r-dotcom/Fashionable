import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  formatISODate,
  isISODate,
  lastDates,
  monthMatrix,
  monthOf,
  parseISODate,
  startOfWeek,
  toISODate,
  weekDates,
  weekdayIndex,
} from './index';

describe('dates', () => {
  it('formats a Date it is given using its local calendar day', () => {
    expect(toISODate(new Date(2026, 10, 8, 23, 59))).toBe('2026-11-08');
    expect(toISODate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
    expect(formatISODate(2026, 3, 9)).toBe('2026-03-09');
  });

  it('parses only real calendar dates', () => {
    expect(parseISODate('2026-02-28')).toEqual({ year: 2026, month: 2, day: 28 });
    expect(parseISODate('2024-02-29')).toBeDefined();
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('2026-1-1')).toBe(false);
    expect(isISODate('tomorrow')).toBe(false);
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-11-18', 0)).toBe('2026-11-18');
    expect(() => addDays('nope', 1)).toThrow(RangeError);
  });

  it('is not thrown by daylight-saving changes', () => {
    // US and EU clocks change in these windows; whole-day steps must stay one calendar day.
    for (const start of ['2026-03-07', '2026-03-28', '2026-10-24', '2026-11-01']) {
      expect(daysBetween(start, addDays(start, 3))).toBe(3);
    }
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-11-18', '2026-11-25')).toBe(7);
    expect(daysBetween('2026-11-18', '2026-11-11')).toBe(-7);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
  });

  it('numbers weekdays from Monday', () => {
    expect(weekdayIndex('2026-11-16')).toBe(0); // Monday
    expect(weekdayIndex('2026-11-18')).toBe(2);
    expect(weekdayIndex('2026-11-22')).toBe(6); // Sunday
  });

  it('finds the Monday-first week of a date', () => {
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16');
    expect(startOfWeek('2026-11-16')).toBe('2026-11-16');
    expect(weekDates('2026-11-18')).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
    expect(weekDates('2026-12-31')[0]).toBe('2026-12-28');
    expect(weekDates('2026-12-31')[6]).toBe('2027-01-03');
  });

  it('lists the last N dates, oldest first', () => {
    expect(lastDates('2026-03-02', 3)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
    expect(lastDates('2026-03-02', 0)).toEqual([]);
  });

  it('moves between months', () => {
    expect(monthOf('2026-11-18')).toEqual({ year: 2026, month: 11 });
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2026, month: 12 });
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 1 }, -13)).toEqual({ year: 2024, month: 12 });
    expect(addMonths({ year: 2026, month: 5 }, 0)).toEqual({ year: 2026, month: 5 });
  });

  it('knows month lengths', () => {
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2024, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 12 })).toBe(31);
    expect(daysInMonth({ year: 2026, month: 4 })).toBe(30);
  });

  it('builds a Monday-first month matrix of whole weeks', () => {
    // November 2026 starts on a Sunday: six leading days, and it needs six rows.
    const nov = monthMatrix({ year: 2026, month: 11 });
    expect(nov).toHaveLength(6);
    expect(nov.every((w) => w.length === 7)).toBe(true);
    expect(nov[0]?.[0]).toEqual({ date: '2026-10-26', inMonth: false });
    expect(nov[0]?.[6]).toEqual({ date: '2026-11-01', inMonth: true });
    expect(nov[5]?.[0]).toEqual({ date: '2026-11-30', inMonth: true });
    expect(nov[5]?.[1]).toEqual({ date: '2026-12-01', inMonth: false });
    expect(nov.flat().filter((c) => c.inMonth)).toHaveLength(30);
  });

  it('uses four rows for a February that starts on Monday', () => {
    // February 2027 starts on a Monday and has 28 days.
    const feb = monthMatrix({ year: 2027, month: 2 });
    expect(feb).toHaveLength(4);
    expect(feb[0]?.[0]).toEqual({ date: '2027-02-01', inMonth: true });
    expect(feb[3]?.[6]).toEqual({ date: '2027-02-28', inMonth: true });
  });

  it('covers every day of a year exactly once across its months', () => {
    const seen = new Set<string>();
    for (let month = 1; month <= 12; month++) {
      for (const cell of monthMatrix({ year: 2028, month }).flat()) {
        if (cell.inMonth) {
          expect(seen.has(cell.date)).toBe(false);
          seen.add(cell.date);
        }
      }
    }
    expect(seen.size).toBe(366);
  });
});
