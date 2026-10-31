import { normalizeNumeric } from "@/lib/format/amount";

/** The API accepts budgets from five years back to two years ahead of the current fiscal year. */
export function budgetYearBounds(currentFiscalYear: number) {
  return { min: currentFiscalYear - 5, max: currentFiscalYear + 2 };
}

export function parseFiscalYear(text: string, bounds: { min: number; max: number }): number | null {
  const v = normalizeNumeric(text);
  if (!/^\d{4}$/.test(v)) return null;
  const n = Number(v);
  return n >= bounds.min && n <= bounds.max ? n : null;
}

/** A tolerance in percent, above 0 and at most 100. Empty means the API default (10%). */
export function parseTolerance(text: string): number | null | undefined {
  const v = normalizeNumeric(text);
  if (v === "") return undefined;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && n <= 100 ? n : null;
}

export interface PhasingCheck {
  values: number[] | null;
  total: number;
  /** Indexes of entries that are not a valid percentage. */
  invalid: number[];
}

/**
 * Twelve monthly percentages that must add up to 100 (after rounding to two decimals, as the
 * API does). Empty entries count as 0.
 */
export function checkPhasing(entries: string[]): PhasingCheck {
  const invalid: number[] = [];
  const values = entries.map((entry, i) => {
    const v = normalizeNumeric(entry);
    if (v === "") return 0;
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(v) || Number(v) > 100) {
      invalid.push(i);
      return 0;
    }
    return Number(v);
  });
  const total = Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
  const ok = entries.length === 12 && invalid.length === 0 && total === 100;
  return { values: ok ? values : null, total, invalid };
}

/** An even split shown as editable text: eleven equal shares and a remainder in the last month. */
export function evenPhasing(): string[] {
  const share = Math.floor((100 / 12) * 100) / 100;
  const last = Math.round((100 - share * 11) * 100) / 100;
  return [...Array.from({ length: 11 }, () => String(share)), String(last)];
}
