import type { ISODate } from '../model/types';

/**
 * Calendar-date helpers. Dates are plain `YYYY-MM-DD` strings (a local calendar day, no time zone).
 * Everything here is pure: "today" is never read from a clock, callers pass a `Date` or a string.
 * Arithmetic goes through UTC midnight so daylight-saving changes cannot skip or repeat a day.
 */

export interface YearMonth {
  year: number;
  /** 1–12 */
  month: number;
}

export interface MonthCell {
  date: ISODate;
  /** False for the leading and trailing days that belong to the neighbouring months. */
  inMonth: boolean;
}

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
const MIN_YEAR = 1000;

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

const utcMs = (year: number, month: number, day: number): number => {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  return d.getTime();
};

/** The local calendar date of `d`. */
export function toISODate(d: Date): ISODate {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
}

export function formatISODate(year: number, month: number, day: number): ISODate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

export interface YMD extends YearMonth {
  day: number;
}

/** Splits a real calendar date; `undefined` for anything else (`2026-02-30`, `hello`). */
export function parseISODate(value: string): YMD | undefined {
  const m = ISO_PATTERN.exec(value);
  if (!m) return undefined;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < MIN_YEAR) return undefined;
  const check = new Date(utcMs(year, month, day));
  const real =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() + 1 === month &&
    check.getUTCDate() === day;
  return real ? { year, month, day } : undefined;
}

export const isISODate = (value: string): boolean => parseISODate(value) !== undefined;

function ymd(date: ISODate): YMD {
  const parsed = parseISODate(date);
  if (!parsed) throw new RangeError(`Not a calendar date: ${date}`);
  return parsed;
}

const fromMs = (ms: number): ISODate => {
  const d = new Date(ms);
  return formatISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

export function addDays(date: ISODate, days: number): ISODate {
  const p = ymd(date);
  return fromMs(utcMs(p.year, p.month, p.day) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: ISODate, to: ISODate): number {
  const a = ymd(from);
  const b = ymd(to);
  return Math.round((utcMs(b.year, b.month, b.day) - utcMs(a.year, a.month, a.day)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: ISODate): number {
  const p = ymd(date);
  return (new Date(utcMs(p.year, p.month, p.day)).getUTCDay() + 6) % 7;
}

/** The Monday of the week containing `date`. */
export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -weekdayIndex(date));
}

/** The seven dates of the Monday-first week containing `date`. */
export function weekDates(date: ISODate): ISODate[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** `count` consecutive dates ending at `end`, oldest first. */
export function lastDates(end: ISODate, count: number): ISODate[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(end, i - count + 1));
}

export function monthOf(date: ISODate): YearMonth {
  const { year, month } = ymd(date);
  return { year, month };
}

export function addMonths(ym: YearMonth, months: number): YearMonth {
  const index = ym.year * 12 + (ym.month - 1) + months;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

export function daysInMonth(ym: YearMonth): number {
  return new Date(utcMs(ym.year, ym.month + 1, 0)).getUTCDate();
}

export const sameMonth = (a: YearMonth, b: YearMonth): boolean =>
  a.year === b.year && a.month === b.month;

/**
 * The weeks of a month, Monday first. Whole weeks only: days of the neighbouring months fill the
 * first and last row and are marked `inMonth: false`. Four to six rows.
 */
export function monthMatrix(ym: YearMonth): MonthCell[][] {
  const first = formatISODate(ym.year, ym.month, 1);
  const start = startOfWeek(first);
  const total = weekdayIndex(first) + daysInMonth(ym);
  const weeks = Math.ceil(total / 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      const m = monthOf(date);
      return { date, inMonth: sameMonth(m, ym) };
    }),
  );
}
