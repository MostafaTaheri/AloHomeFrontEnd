import type { Locale } from "@/i18n/config";

/**
 * A region is the market a screen is rendered for. It decides the calendar, currency display,
 * time zone, terminology and phone/postal conventions. It is separate from the language: a
 * Persian-speaking owner in Sydney reads Persian text with AUD amounts and Gregorian dates.
 *
 * Inside a scheme workspace the region always comes from the scheme's jurisdiction, so numbers
 * and dates match the data. Everywhere else it comes from the user's preference cookie.
 */
export const REGIONS = ["ir", "au"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_COOKIE = "alohome-region";
export const CURRENCY_UNIT_COOKIE = "alohome-currency-unit";

export type CalendarSystem = "persian" | "gregory";
export type CurrencyUnit = "rial" | "toman";

export interface RegionProfile {
  id: Region;
  countryCode: "IR" | "AU";
  /** Jurisdiction code used by the API for schemes in this market. */
  jurisdictionCode: string;
  currency: "IRR" | "AUD";
  currencyMinorUnits: 0 | 2;
  timeZone: string;
  calendar: CalendarSystem;
  defaultLocale: Locale;
  /** Dialling code without the plus sign. */
  phoneCountryCode: "98" | "61";
  phoneExample: string;
  postalCodeDigits: 4 | 10;
  /** 0 = Sunday ... 6 = Saturday. */
  weekStartsOn: number;
}

export const REGION_PROFILES: Record<Region, RegionProfile> = {
  ir: {
    id: "ir",
    countryCode: "IR",
    jurisdictionCode: "IR",
    currency: "IRR",
    currencyMinorUnits: 0,
    timeZone: "Asia/Tehran",
    calendar: "persian",
    defaultLocale: "fa",
    phoneCountryCode: "98",
    phoneExample: "+989121234567",
    postalCodeDigits: 10,
    weekStartsOn: 6,
  },
  au: {
    id: "au",
    countryCode: "AU",
    jurisdictionCode: "AU-NSW",
    currency: "AUD",
    currencyMinorUnits: 2,
    timeZone: "Australia/Sydney",
    calendar: "gregory",
    defaultLocale: "en",
    phoneCountryCode: "61",
    phoneExample: "+61412345678",
    postalCodeDigits: 4,
    weekStartsOn: 1,
  },
};

export const DEFAULT_REGION: Region = "ir";

export function isRegion(value: unknown): value is Region {
  return typeof value === "string" && (REGIONS as readonly string[]).includes(value);
}

export function isCurrencyUnit(value: unknown): value is CurrencyUnit {
  return value === "rial" || value === "toman";
}

export function defaultRegionForLocale(locale: Locale): Region {
  return locale === "fa" ? "ir" : "au";
}

/** Maps an API jurisdiction code ("IR", "AU-NSW", ...) to a region, or null when unsupported. */
export function regionForJurisdiction(code: string | null | undefined): Region | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  if (upper === "IR") return "ir";
  if (upper === "AU" || upper.startsWith("AU-")) return "au";
  return null;
}

export function profileFor(region: Region): RegionProfile {
  return REGION_PROFILES[region];
}
