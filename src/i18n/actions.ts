"use server";

import { cookies } from "next/headers";
import { CURRENCY_UNIT_COOKIE, isCurrencyUnit, isRegion, REGION_COOKIE } from "@/lib/region/config";
import { isLocale, LOCALE_COOKIE } from "./config";

const ONE_YEAR = 60 * 60 * 24 * 365;

async function setPreference(name: string, value: string): Promise<void> {
  (await cookies()).set({
    name,
    value,
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  await setPreference(LOCALE_COOKIE, locale);
}

export async function setRegionAction(region: string): Promise<void> {
  if (!isRegion(region)) return;
  await setPreference(REGION_COOKIE, region);
}

export async function setCurrencyUnitAction(unit: string): Promise<void> {
  if (!isCurrencyUnit(unit)) return;
  await setPreference(CURRENCY_UNIT_COOKIE, unit);
}
