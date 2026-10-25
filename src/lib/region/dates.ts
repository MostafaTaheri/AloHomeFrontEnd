import type { CalendarSystem } from "./config";
import {
  jalaliMonthLength,
  parseIsoDate,
  toGregorian,
  toIsoDate,
  toJalali,
  type GregorianDate,
} from "./jalali";

/**
 * Calendar arithmetic on date-only ISO strings ("2026-03-31") in the scheme's calendar. All
 * values stay date-only: no time zone is applied, so a date never shifts by a day.
 */

interface Ymd {
  year: number;
  month: number;
  day: number;
}

function gregorianMonthLength(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toCalendar(iso: string, calendar: CalendarSystem): Ymd | null {
  const g = parseIsoDate(iso);
  if (!g) return null;
  if (calendar === "gregory") return { year: g.year, month: g.month, day: g.day };
  const j = toJalali(g.year, g.month, g.day);
  return { year: j.year, month: j.month, day: j.day };
}

function fromCalendar(v: Ymd, calendar: CalendarSystem): string {
  const g: GregorianDate =
    calendar === "gregory"
      ? { year: v.year, month: v.month, day: v.day }
      : toGregorian(v.year, v.month, v.day);
  return toIsoDate(g);
}

function monthLength(year: number, month: number, calendar: CalendarSystem): number {
  return calendar === "gregory"
    ? gregorianMonthLength(year, month)
    : jalaliMonthLength(year, month);
}

/** Today's date in a time zone, as yyyy-MM-dd. */
export function todayIso(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function firstOfMonth(iso: string, calendar: CalendarSystem): string | null {
  const v = toCalendar(iso, calendar);
  return v ? fromCalendar({ ...v, day: 1 }, calendar) : null;
}

export function lastOfMonth(iso: string, calendar: CalendarSystem): string | null {
  const v = toCalendar(iso, calendar);
  return v ? fromCalendar({ ...v, day: monthLength(v.year, v.month, calendar) }, calendar) : null;
}

/** Moves a date by whole months in the calendar, clamping the day to the target month's length. */
export function addMonths(iso: string, months: number, calendar: CalendarSystem): string | null {
  const v = toCalendar(iso, calendar);
  if (!v) return null;
  const index = v.year * 12 + (v.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (((index % 12) + 12) % 12) + 1;
  const day = Math.min(v.day, monthLength(year, month, calendar));
  return fromCalendar({ year, month, day }, calendar);
}

/** The last `count` whole months ending with the month that contains `iso`. */
export function lastMonthsRange(
  iso: string,
  count: number,
  calendar: CalendarSystem,
): { from: string; to: string } | null {
  const start = addMonths(iso, -(count - 1), calendar);
  const from = start ? firstOfMonth(start, calendar) : null;
  const to = lastOfMonth(iso, calendar);
  return from && to ? { from, to } : null;
}

/** "yyyy-MM" key of the calendar month that contains `iso`. */
export function monthKey(iso: string, calendar: CalendarSystem): string | null {
  const v = toCalendar(iso, calendar);
  return v ? `${String(v.year).padStart(4, "0")}-${String(v.month).padStart(2, "0")}` : null;
}

/** Calendar components of a date, for date pickers. */
export function calendarParts(iso: string, calendar: CalendarSystem): Ymd | null {
  return toCalendar(iso, calendar);
}

export function fromCalendarParts(v: Ymd, calendar: CalendarSystem): string {
  const day = Math.min(v.day, monthLength(v.year, v.month, calendar));
  return fromCalendar({ ...v, day }, calendar);
}

export function daysInMonth(year: number, month: number, calendar: CalendarSystem): number {
  return monthLength(year, month, calendar);
}

/** True when `from` is not after `to` (both yyyy-MM-dd; lexical order is date order). */
export function isRangeOrdered(from: string, to: string): boolean {
  return from <= to;
}
