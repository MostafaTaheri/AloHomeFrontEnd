import { describe, expect, it } from "vitest";
import { createFormatter, formatContextFor } from "./index";

// Intl output uses non-breaking and narrow spaces; compare with plain spaces.
const plain = (value: string) => value.replace(/[  ‎‏]/g, " ");

const au = createFormatter(formatContextFor("en", "au"));
const irFa = createFormatter(formatContextFor("fa", "ir"));
const irEn = createFormatter(formatContextFor("en", "ir"));
const auFa = createFormatter(formatContextFor("fa", "au"));
const irToman = createFormatter(formatContextFor("fa", "ir", "toman"));

describe("money", () => {
  it("formats AUD with two decimals and a symbol", () => {
    expect(plain(au.money(1234.5, "AUD"))).toBe("$1,234.50");
    expect(plain(au.money(-80, "AUD"))).toBe("-$80.00");
  });

  it("shows an explicit sign for changes and none for zero", () => {
    expect(plain(au.money(12, "AUD", { signed: true }))).toBe("+$12.00");
    expect(plain(au.money(-12, "AUD", { signed: true }))).toBe("-$12.00");
    expect(plain(au.money(0, "AUD", { signed: true }))).toBe("$0.00");
  });

  it("formats IRR without decimals", () => {
    expect(plain(irEn.money(35_000_000, "IRR"))).toBe("IRR 35,000,000");
    expect(irFa.money(35_000_000, "IRR")).toBe("۳۵٬۰۰۰٬۰۰۰ ریال");
  });

  it("shows toman as a display unit (1 toman = 10 rial)", () => {
    expect(irToman.money(35_000_000, "IRR")).toBe("۳٬۵۰۰٬۰۰۰ تومان");
    const en = createFormatter(formatContextFor("en", "ir", "toman"));
    expect(en.money(35_000_000, "IRR")).toBe("3,500,000 Toman");
  });

  it("does not apply the toman unit to other currencies", () => {
    expect(plain(irToman.money(1000, "AUD"))).toBe("۱٬۰۰۰٫۰۰ دلار استرالیا");
  });

  it("can hide the currency and renders a dash for missing values", () => {
    expect(au.money(5, "AUD", { hideCurrency: true })).toBe("5.00");
    expect(au.money(null, "AUD")).toBe("—");
    expect(au.money(Number.NaN, "AUD")).toBe("—");
  });
});

describe("percent and numbers", () => {
  it("takes percent units", () => {
    expect(au.percent(12.5)).toBe("12.5%");
    expect(au.percent(-3, { signed: true })).toBe("-3%");
    expect(au.percent(3, { signed: true })).toBe("+3%");
    expect(au.percent(null)).toBe("—");
  });

  it("uses Persian digits for Persian", () => {
    expect(irFa.integer(1234)).toBe("۱٬۲۳۴");
  });
});

describe("dates", () => {
  it("formats Australian dates as dd/MM/yyyy", () => {
    expect(au.date("2026-03-05")).toBe("05/03/2026");
  });

  it("formats Iranian dates in the Jalali calendar", () => {
    expect(irFa.date("2026-03-21")).toBe("۱۴۰۵/۰۱/۰۱");
    expect(irEn.date("2026-03-21")).toContain("1405");
  });

  it("does not shift a date-only value by the time zone", () => {
    expect(au.date("2026-01-01")).toBe("01/01/2026");
    expect(irFa.date("2026-01-01")).toBe("۱۴۰۴/۱۰/۱۱");
  });

  it("shows instants in the region's time zone", () => {
    // 2026-03-05T20:00Z is 07:00 on 6 March in Sydney (AEDT, +11) and 23:30 on the 5th in Tehran.
    expect(plain(au.dateTime("2026-03-05T20:00:00Z"))).toBe("06/03/2026, 07:00");
    expect(plain(irFa.dateTime("2026-03-05T20:00:00Z"))).toContain("۲۳:۳۰");
  });

  it("returns a dash for invalid input", () => {
    expect(au.date(null)).toBe("—");
    expect(au.date("2026-02-30")).toBe("—");
    expect(au.dateTime("not a date")).toBe("—");
  });

  it("supports a long form", () => {
    expect(plain(au.date("2026-03-05", "long"))).toBe("5 March 2026");
  });
});

describe("period and fiscal year labels", () => {
  it("renders Gregorian period labels", () => {
    expect(au.periodLabel("2026-03")).toBe("March 2026");
  });

  it("renders Jalali period labels", () => {
    expect(irFa.periodLabel("1405-02")).toBe("اردیبهشت ۱۴۰۵");
    expect(irEn.periodLabel("1405-02")).toContain("1405");
  });

  it("falls back to the raw label when it is not yyyy-MM", () => {
    expect(au.periodLabel("Q3")).toBe("Q3");
    expect(au.periodLabel(null)).toBe("—");
  });

  it("names NSW fiscal years by the end year", () => {
    expect(au.fiscalYear(2027)).toBe("FY2026–27");
    expect(auFa.fiscalYear(2027)).toBe("سال مالی ۲۰۲۶–۲۷");
  });

  it("names Iranian fiscal years by the Solar Hijri year", () => {
    expect(irFa.fiscalYear(1405)).toBe("سال ۱۴۰۵");
    expect(irEn.fiscalYear(1405)).toBe("FY 1405");
  });
});

describe("file size", () => {
  it("scales units", () => {
    expect(au.fileSize(512)).toBe("512 B");
    expect(au.fileSize(2048)).toBe("2 KB");
    expect(au.fileSize(5 * 1024 * 1024)).toBe("5 MB");
  });
});
