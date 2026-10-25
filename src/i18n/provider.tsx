"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { CurrencyUnit, Region } from "@/lib/region/config";
import type { Locale } from "./config";
import { createTranslator, type Translator } from "./translator";

const I18nContext = createContext<Translator | null>(null);

export function I18nProvider({
  locale,
  region,
  currencyUnit = "rial",
  children,
}: {
  locale: Locale;
  region: Region;
  currencyUnit?: CurrencyUnit;
  children: ReactNode;
}) {
  const value = useMemo(
    () => createTranslator(locale, region, currencyUnit),
    [locale, region, currencyUnit],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Translator {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>.");
  return value;
}
