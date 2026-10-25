import type { CurrencyUnit } from "@/lib/region/config";

/** Persian/Arabic digits to ASCII, Arabic decimal and thousands separators to plain ones. */
export function normalizeNumeric(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/٫/g, ".")
    .replace(/[٬،,\s‌‎‏_]/g, "")
    .trim();
}

export type AmountParse = { ok: true; value: number } | { ok: false };

/**
 * Parses a typed money amount into the currency's major unit as the API stores it.
 *
 *   IRR shown in rial   "1,250,000"  -> 1250000
 *   IRR shown in toman  "125,000"    -> 1250000   (1 toman = 10 rial)
 *   AUD                 "1,234.56"   -> 1234.56
 *
 * Amounts are rounded to the currency's minor unit only by rejection: a rial amount with a
 * fraction, or an AUD amount with more than two decimals, is invalid rather than silently cut.
 */
export function parseAmountInput(
  raw: string,
  options: {
    currency: string;
    unit?: CurrencyUnit;
    allowNegative?: boolean;
    allowZero?: boolean;
  },
): AmountParse {
  const text = normalizeNumeric(raw);
  const pattern = options.allowNegative ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/;
  if (!pattern.test(text)) return { ok: false };

  const decimals = text.includes(".") ? text.split(".")[1]!.length : 0;
  const toman = options.currency === "IRR" && options.unit === "toman";

  let value = Number(text);
  if (toman) {
    // A toman amount may carry one decimal (half a toman = 5 rial).
    if (decimals > 1) return { ok: false };
    value = Math.round(value * 10);
  } else if (options.currency === "IRR") {
    if (decimals > 0) return { ok: false };
  } else if (decimals > 2) {
    return { ok: false };
  }

  if (!Number.isFinite(value) || Math.abs(value) > 1e13) return { ok: false };
  if (value === 0 && !options.allowZero) return { ok: false };
  return { ok: true, value };
}

/** The amount in the unit the person is typing, for pre-filling an edit form. */
export function amountToInput(value: number, currency: string, unit?: CurrencyUnit): string {
  if (currency === "IRR" && unit === "toman") return String(value / 10);
  return String(value);
}
