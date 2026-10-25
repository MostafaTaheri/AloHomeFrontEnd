import { describe, expect, it } from "vitest";
import {
  isJalaliLeapYear,
  isValidJalali,
  jalaliMonthLength,
  parseIsoDate,
  toGregorian,
  toIsoDate,
  toJalali,
} from "./jalali";

describe("jalali conversion", () => {
  it.each([
    [2024, 3, 20, 1403, 1, 1],
    [2025, 3, 21, 1404, 1, 1],
    [2026, 3, 21, 1405, 1, 1],
    [2026, 10, 22, 1405, 7, 30],
    [2027, 3, 21, 1406, 1, 1],
  ])("converts %i-%i-%i to %i/%i/%i", (gy, gm, gd, jy, jm, jd) => {
    expect(toJalali(gy, gm, gd)).toEqual({ year: jy, month: jm, day: jd });
    expect(toGregorian(jy, jm, jd)).toEqual({ year: gy, month: gm, day: gd });
  });

  it("agrees with Intl's persian calendar for every day over several years", () => {
    const fmt = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
      timeZone: "UTC",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const start = Date.UTC(2019, 0, 1);
    for (let i = 0; i < 365 * 9; i += 1) {
      const d = new Date(start + i * 86_400_000);
      const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
      const expected = {
        year: Number(parts.relatedYear ?? parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
      };
      const actual = toJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      expect(actual).toEqual(expected);
    }
  });

  it("round-trips", () => {
    for (let jy = 1395; jy <= 1415; jy += 1) {
      for (let jm = 1; jm <= 12; jm += 1) {
        const last = jalaliMonthLength(jy, jm);
        for (const jd of [1, 15, last]) {
          const g = toGregorian(jy, jm, jd);
          expect(toJalali(g.year, g.month, g.day)).toEqual({ year: jy, month: jm, day: jd });
        }
      }
    }
  });
});

describe("jalali calendar facts", () => {
  it("knows leap years and month lengths", () => {
    expect(isJalaliLeapYear(1403)).toBe(true);
    expect(isJalaliLeapYear(1404)).toBe(false);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
    expect(jalaliMonthLength(1404, 1)).toBe(31);
    expect(jalaliMonthLength(1404, 7)).toBe(30);
  });

  it("validates dates", () => {
    expect(isValidJalali(1404, 12, 30)).toBe(false);
    expect(isValidJalali(1403, 12, 30)).toBe(true);
    expect(isValidJalali(1404, 13, 1)).toBe(false);
    expect(isValidJalali(1404, 0, 1)).toBe(false);
  });
});

describe("iso helpers", () => {
  it("formats and parses", () => {
    expect(toIsoDate({ year: 2026, month: 3, day: 5 })).toBe("2026-03-05");
    expect(parseIsoDate("2026-03-05")).toEqual({ year: 2026, month: 3, day: 5 });
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("nonsense")).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
  });
});
