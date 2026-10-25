import type { Region } from "@/lib/region/config";
import type { Locale } from "./config";

/**
 * Market terminology. Dictionary strings reference these as {scheme}, {Lots}, {levy} and so on;
 * the translator fills them in from the active region and language, so one sentence reads
 * correctly for a NSW strata scheme ("lot", "levy", "strata manager") and for an Iranian
 * building ("واحد", "شارژ", "مدیر ساختمان").
 *
 * An upper-case first letter in the placeholder capitalises the term ({Scheme} -> "Scheme").
 */
export const TERM_KEYS = [
  "scheme",
  "schemes",
  "lot",
  "lots",
  "levy",
  "levies",
  "manager",
  "committee",
  "owner",
  "capitalWorks",
  "arrears",
] as const;

export type TermKey = (typeof TERM_KEYS)[number];
export type Terms = Readonly<Record<TermKey, string>>;

const TERMS: Record<Region, Record<Locale, Terms>> = {
  au: {
    en: {
      scheme: "scheme",
      schemes: "schemes",
      lot: "lot",
      lots: "lots",
      levy: "levy",
      levies: "levies",
      manager: "strata manager",
      committee: "strata committee",
      owner: "owner",
      capitalWorks: "capital works",
      arrears: "arrears",
    },
    fa: {
      scheme: "اسکیم استراتا",
      schemes: "اسکیم‌های استراتا",
      lot: "لات",
      lots: "لات‌ها",
      levy: "لوی (شارژ)",
      levies: "لوی‌ها (شارژها)",
      manager: "مدیر استراتا",
      committee: "کمیته استراتا",
      owner: "مالک",
      capitalWorks: "کارهای عمرانی",
      arrears: "بدهی معوق",
    },
  },
  ir: {
    en: {
      scheme: "building",
      schemes: "buildings",
      lot: "unit",
      lots: "units",
      levy: "service charge",
      levies: "service charges",
      manager: "building manager",
      committee: "owners' board",
      owner: "owner",
      capitalWorks: "major works",
      arrears: "overdue charges",
    },
    fa: {
      scheme: "ساختمان",
      schemes: "ساختمان‌ها",
      lot: "واحد",
      lots: "واحدها",
      levy: "شارژ",
      levies: "شارژها",
      manager: "مدیر ساختمان",
      committee: "هیئت مدیره",
      owner: "مالک",
      capitalWorks: "عمرانی و نوسازی",
      arrears: "معوقات",
    },
  },
};

export function termsFor(region: Region, locale: Locale): Terms {
  return TERMS[region][locale];
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Resolves a placeholder name such as "lots" or "Lots"; null when it is not a term. */
export function resolveTerm(name: string, terms: Terms): string | null {
  if ((TERM_KEYS as readonly string[]).includes(name)) return terms[name as TermKey];
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  if (lower !== name && (TERM_KEYS as readonly string[]).includes(lower)) {
    return capitalise(terms[lower as TermKey]);
  }
  return null;
}
