export const LOCALES = ["fa", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** The API defaults to Persian (see RequestLocalizationOptions in Program.cs), so the UI does too. */
export const DEFAULT_LOCALE: Locale = "fa";
export const LOCALE_COOKIE = "alohome-locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "fa" ? "rtl" : "ltr";
}

/** BCP 47 tag used for Intl formatting. fa-IR renders Persian digits and the Jalali calendar. */
export function intlTag(locale: Locale): string {
  return locale === "fa" ? "fa-IR" : "en-GB";
}
