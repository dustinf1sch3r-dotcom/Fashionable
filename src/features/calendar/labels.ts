import { parseISODate, weekdayIndex, type YearMonth } from '@/core/dates';
import type { ISODate } from '@/core/model/types';

/** English for now and independent of the device locale, so the grid always reads the same. */
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/** One or two letters for the grid header (Monday first). */
export const WEEKDAY_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

export const monthTitle = (ym: YearMonth): string => `${MONTH_NAMES[ym.month - 1]} ${ym.year}`;

/** "Wednesday 18 November" (the year is added when it differs from `currentYear`). */
export function longDate(date: ISODate, currentYear?: number): string {
  const p = parseISODate(date);
  if (!p) return date;
  const base = `${WEEKDAY_NAMES[weekdayIndex(date)]} ${p.day} ${MONTH_NAMES[p.month - 1]}`;
  return currentYear !== undefined && p.year !== currentYear ? `${base} ${p.year}` : base;
}
