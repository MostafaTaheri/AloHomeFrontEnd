import { describe, expect, it } from "vitest";
import {
  addMonths,
  calendarParts,
  firstOfMonth,
  fromCalendarParts,
  lastMonthsRange,
  lastOfMonth,
  monthKey,
  todayIso,
} from "./dates";

describe("Gregorian month arithmetic", () => {
  it("finds month boundaries", () => {
    expect(firstOfMonth("2026-03-17", "gregory")).toBe("2026-03-01");
    expect(lastOfMonth("2026-02-10", "gregory")).toBe("2026-02-28");
    expect(lastOfMonth("2028-02-10", "gregory")).toBe("2028-02-29");
  });

  it("adds months and clamps the day", () => {
    expect(addMonths("2026-01-31", 1, "gregory")).toBe("2026-02-28");
    expect(addMonths("2026-01-15", -2, "gregory")).toBe("2025-11-15");
    expect(addMonths("2026-12-05", 1, "gregory")).toBe("2027-01-05");
  });

  it("builds a trailing range of whole months", () => {
    expect(lastMonthsRange("2026-03-17", 12, "gregory")).toEqual({
      from: "2025-04-01",
      to: "2026-03-31",
    });
  });

  it("builds a month key", () => {
    expect(monthKey("2026-03-17", "gregory")).toBe("2026-03");
  });
});

describe("Solar Hijri month arithmetic", () => {
  // 1405-01-01 = 2026-03-21 (Nowruz)
  it("finds month boundaries in the Persian calendar", () => {
    expect(firstOfMonth("2026-03-25", "persian")).toBe("2026-03-21");
    expect(lastOfMonth("2026-03-25", "persian")).toBe("2026-04-20");
  });

  it("keys by Jalali year and month", () => {
    expect(monthKey("2026-05-01", "persian")).toBe("1405-02");
  });

  it("treats Esfand length correctly in a non-leap year", () => {
    // 1405 is not a leap year, so Esfand has 29 days and ends on 2027-03-20.
    expect(lastOfMonth("2027-03-01", "persian")).toBe("2027-03-20");
  });

  it("adds months across a year boundary", () => {
    const next = addMonths("2026-03-21", 12, "persian");
    expect(monthKey(next!, "persian")).toBe("1406-01");
  });
});

describe("calendar parts", () => {
  it("round-trips through the calendar", () => {
    for (const calendar of ["gregory", "persian"] as const) {
      const parts = calendarParts("2026-08-09", calendar)!;
      expect(fromCalendarParts(parts, calendar)).toBe("2026-08-09");
    }
  });

  it("clamps an impossible day when rebuilding", () => {
    expect(fromCalendarParts({ year: 2026, month: 2, day: 31 }, "gregory")).toBe("2026-02-28");
  });
});

describe("todayIso", () => {
  it("uses the time zone, not the machine's", () => {
    // 2026-03-31 20:00 UTC is already 1 April in Sydney (UTC+11 in DST) and still 31 March in Tehran.
    const instant = new Date("2026-03-31T20:00:00Z");
    expect(todayIso("Australia/Sydney", instant)).toBe("2026-04-01");
    expect(todayIso("Asia/Tehran", instant)).toBe("2026-03-31");
  });
});
