import { createFormatter, formatContextFor } from "@/lib/format";
import { defaultRegionForLocale, type CurrencyUnit, type Region } from "@/lib/region/config";
import type { Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";
import { fa } from "./dictionaries/fa";
import { resolveTerm, termsFor } from "./terms";

type Paths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Paths<Dictionary>;
export type TranslateValues = Record<string, string | number>;

const dictionaries: Record<Locale, Dictionary> = { en, fa };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/**
 * Translator bound to a language and a region. `t` fills {placeholders} from the values passed in
 * and, for names it does not recognise, from the region's terminology ({scheme}, {Lots}, ...).
 * `fmt` formats money, dates and numbers for the same language and region.
 */
export function createTranslator(
  locale: Locale,
  region: Region = defaultRegionForLocale(locale),
  currencyUnit: CurrencyUnit = "rial",
) {
  const dictionary = dictionaries[locale];
  const fmt = createFormatter(formatContextFor(locale, region, currencyUnit));
  const terms = termsFor(region, locale);

  function t(key: MessageKey, values?: TranslateValues): string {
    let node: unknown = dictionary;
    for (const part of key.split(".")) {
      node = (node as Record<string, unknown> | undefined)?.[part];
    }
    const template = typeof node === "string" ? node : key;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = values?.[name];
      if (value !== undefined) return typeof value === "number" ? fmt.number(value) : value;
      return resolveTerm(name, terms) ?? match;
    });
  }

  function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return fmt.number(value, options);
  }

  function formatDate(value: string | Date | null | undefined): string {
    if (!value) return dictionary.common.none;
    const iso = typeof value === "string" ? value : value.toISOString();
    return iso.length > 10 ? fmt.dateTime(iso) : fmt.date(iso);
  }

  return { locale, region, currencyUnit, terms, fmt, t, formatNumber, formatDate };
}

export type Translator = ReturnType<typeof createTranslator>;
