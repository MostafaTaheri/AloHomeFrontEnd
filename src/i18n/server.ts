import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  CURRENCY_UNIT_COOKIE,
  defaultRegionForLocale,
  isCurrencyUnit,
  isRegion,
  REGION_COOKIE,
  type CurrencyUnit,
  type Region,
} from "@/lib/region/config";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { createTranslator } from "./translator";

export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

/** The user's market preference; follows the language until they choose one explicitly. */
export const getRegion = cache(async (): Promise<Region> => {
  const value = (await cookies()).get(REGION_COOKIE)?.value;
  if (isRegion(value)) return value;
  return defaultRegionForLocale(await getLocale());
});

export const getCurrencyUnit = cache(async (): Promise<CurrencyUnit> => {
  const value = (await cookies()).get(CURRENCY_UNIT_COOKIE)?.value;
  return isCurrencyUnit(value) ? value : "rial";
});

export async function getI18n() {
  const [locale, region, unit] = await Promise.all([getLocale(), getRegion(), getCurrencyUnit()]);
  return createTranslator(locale, region, unit);
}
