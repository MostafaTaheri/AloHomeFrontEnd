import type { Locale } from "@/i18n/config";
import {
  profileFor,
  type CalendarSystem,
  type CurrencyUnit,
  type Region,
} from "@/lib/region/config";
import { parseIsoDate, toGregorian } from "@/lib/region/jalali";

/**
 * Every number and date a user sees goes through this module, so currency, decimals, sign, date
 * order, calendar and time zone are consistent across screens and across the Iran/Australia
 * split. The inputs are API values: decimals as numbers, dates as "yyyy-MM-dd", instants as ISO
 * 8601 with an offset or Z.
 */

export interface FormatContext {
  locale: Locale;
  calendar: CalendarSystem;
  timeZone: string;
  /** Display unit for IRR amounts. Has no effect on other currencies. */
  currencyUnit: CurrencyUnit;
}

export function formatContextFor(
  locale: Locale,
  region: Region,
  currencyUnit: CurrencyUnit = "rial",
): FormatContext {
  const profile = profileFor(region);
  return { locale, calendar: profile.calendar, timeZone: profile.timeZone, currencyUnit };
}

/** Intl locale tag with explicit calendar and numbering system. */
export function intlTagFor(locale: Locale, calendar: CalendarSystem): string {
  if (locale === "fa") return `fa-IR-u-ca-${calendar}-nu-arabext`;
  return calendar === "persian" ? "en-GB-u-ca-persian-nu-latn" : "en-AU-u-ca-gregory-nu-latn";
}

const FA_CURRENCY_LABEL: Record<string, string> = {
  IRR: "ریال",
  AUD: "دلار استرالیا",
};

export interface MoneyOptions {
  /** Always show a + or − sign (for changes). Zero stays unsigned. */
  signed?: boolean;
  /** Omit the currency name or symbol; the caller shows it elsewhere (a column header). */
  hideCurrency?: boolean;
  /** Round to whole units, for large dashboard figures. */
  whole?: boolean;
}

function minorUnits(currency: string): number {
  return currency === "IRR" ? 0 : 2;
}

export function createFormatter(ctx: FormatContext) {
  const tag = intlTagFor(ctx.locale, ctx.calendar);
  const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

  function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
    const key = `n:${JSON.stringify(options)}`;
    let format = cache.get(key) as Intl.NumberFormat | undefined;
    if (!format) {
      format = new Intl.NumberFormat(tag, options);
      cache.set(key, format);
    }
    return format;
  }

  function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = `d:${JSON.stringify(options)}`;
    let format = cache.get(key) as Intl.DateTimeFormat | undefined;
    if (!format) {
      format = new Intl.DateTimeFormat(tag, options);
      cache.set(key, format);
    }
    return format;
  }

  function number(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return numberFormat(options ?? {}).format(value);
  }

  function integer(value: number | null | undefined): string {
    return number(value, { maximumFractionDigits: 0 });
  }

  /** `value` is already in percent units: 12.5 means 12.5%. */
  function percent(
    value: number | null | undefined,
    options: { digits?: number; signed?: boolean } = {},
  ): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return numberFormat({
      style: "percent",
      minimumFractionDigits: 0,
      maximumFractionDigits: options.digits ?? 1,
      signDisplay: options.signed ? "exceptZero" : "auto",
    }).format(value / 100);
  }

  function money(
    amount: number | null | undefined,
    currency: string,
    options: MoneyOptions = {},
  ): string {
    if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
    const signDisplay = options.signed ? "exceptZero" : "auto";
    const digits = options.whole ? 0 : minorUnits(currency);

    // Toman is a display unit for rial amounts: 1 toman = 10 rial.
    if (currency === "IRR" && ctx.currencyUnit === "toman") {
      const text = numberFormat({
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
        signDisplay,
      }).format(amount / 10);
      if (options.hideCurrency) return text;
      return `${text} ${ctx.locale === "fa" ? "تومان" : "Toman"}`;
    }

    if (ctx.locale === "fa") {
      // Persian reads "amount unit"; Intl's fa currency style puts the symbol first.
      const text = numberFormat({
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        signDisplay,
      }).format(amount);
      if (options.hideCurrency) return text;
      return `${text} ${FA_CURRENCY_LABEL[currency] ?? currency}`;
    }

    if (options.hideCurrency) {
      return numberFormat({
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        signDisplay,
      }).format(amount);
    }
    return numberFormat({
      style: "currency",
      currency,
      currencyDisplay: currency === "AUD" ? "narrowSymbol" : "code",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay,
    }).format(amount);
  }

  /** Unit label shown next to money in headers, e.g. "AUD" or "ریال". */
  function currencyLabel(currency: string): string {
    if (currency === "IRR" && ctx.currencyUnit === "toman") {
      return ctx.locale === "fa" ? "تومان" : "Toman";
    }
    return ctx.locale === "fa" ? (FA_CURRENCY_LABEL[currency] ?? currency) : currency;
  }

  function utcDate(value: string | null | undefined): Date | null {
    const parsed = parseIsoDate(value);
    return parsed ? new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)) : null;
  }

  /** A calendar date without a time ("yyyy-MM-dd"). Never shifted by a time zone. */
  function date(value: string | null | undefined, style: "numeric" | "long" = "numeric"): string {
    const d = utcDate(value);
    if (!d) return "—";
    return dateFormat(
      style === "numeric"
        ? { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }
        : { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" },
    ).format(d);
  }

  /** An instant in time, shown in the region's time zone. */
  function dateTime(value: string | null | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return dateFormat({
      timeZone: ctx.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(d);
  }

  /** "Month Year" in every locale; Intl's own year-first Persian pattern reads unnaturally. */
  function monthYearText(d: Date): string {
    const month = dateFormat({ timeZone: "UTC", month: "long" }).format(d);
    const year = dateFormat({ timeZone: "UTC", year: "numeric" }).format(d);
    return `${month} ${year}`;
  }

  function monthYearOfDate(value: string | null | undefined): string {
    const d = utcDate(value);
    return d ? monthYearText(d) : "—";
  }

  /**
   * API period labels are "yyyy-MM" in the scheme's calendar ("2026-03" for NSW, "1405-02" for
   * Iran). Renders them as "March 2026" / "اردیبهشت ۱۴۰۵" in the active calendar.
   */
  function periodLabel(label: string | null | undefined): string {
    const m = label ? /^(-?\d{1,4})-(\d{2})$/.exec(label) : null;
    if (!m) return label ?? "—";
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12) return label ?? "—";
    try {
      const g =
        ctx.calendar === "persian" ? toGregorian(year, month, 15) : { year, month, day: 15 };
      return monthYearText(new Date(Date.UTC(g.year, g.month - 1, g.day)));
    } catch {
      return label ?? "—";
    }
  }

  /** Short month for chart axes. */
  function periodShort(label: string | null | undefined): string {
    const m = label ? /^(-?\d{1,4})-(\d{2})$/.exec(label) : null;
    if (!m) return label ?? "—";
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12) return label ?? "—";
    try {
      const g =
        ctx.calendar === "persian" ? toGregorian(year, month, 15) : { year, month, day: 15 };
      const d = new Date(Date.UTC(g.year, g.month - 1, g.day));
      return dateFormat({ timeZone: "UTC", month: "short", year: "2-digit" }).format(d);
    } catch {
      return label ?? "—";
    }
  }

  /**
   * Fiscal year label. NSW years are named by the year they end in (2027 = Jul 2026 to Jun
   * 2027); Iranian years are the Solar Hijri year.
   */
  function fiscalYear(year: number | null | undefined): string {
    if (year === null || year === undefined) return "—";
    if (ctx.calendar === "persian") {
      return ctx.locale === "fa" ? `سال ${number(year, { useGrouping: false })}` : `FY ${year}`;
    }
    const start = year - 1;
    const end = String(year).slice(-2);
    const range = `${number(start, { useGrouping: false })}–${number(Number(end), {
      minimumIntegerDigits: 2,
      useGrouping: false,
    })}`;
    return ctx.locale === "fa" ? `سال مالی ${range}` : `FY${range}`;
  }

  function fileSize(bytes: number): string {
    if (bytes < 1024) return `${integer(bytes)} B`;
    if (bytes < 1024 * 1024) return `${number(bytes / 1024, { maximumFractionDigits: 1 })} KB`;
    return `${number(bytes / (1024 * 1024), { maximumFractionDigits: 1 })} MB`;
  }

  return {
    context: ctx,
    tag,
    number,
    integer,
    percent,
    money,
    currencyLabel,
    date,
    dateTime,
    monthYearOfDate,
    periodLabel,
    periodShort,
    fiscalYear,
    fileSize,
  };
}

export type Formatter = ReturnType<typeof createFormatter>;
