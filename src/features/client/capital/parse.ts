import { normalizeNumeric } from "@/lib/format/amount";

export type YearBounds = { min: number; max: number };

/** Plausible fiscal-year range per calendar. The server remains the authority. */
export function yearBounds(calendar: "persian" | "gregory"): YearBounds {
  return calendar === "persian" ? { min: 1380, max: 1500 } : { min: 2000, max: 2100 };
}

export function parseYear(text: string, bounds: YearBounds): number | null {
  const normalized = normalizeNumeric(text).trim();
  if (!/^\d{4}$/.test(normalized)) return null;
  const n = Number(normalized);
  return n >= bounds.min && n <= bounds.max ? n : null;
}

/** A percentage from -100 to 100 with an optional decimal part. Empty is not valid. */
export function parsePercent(text: string): number | null {
  const normalized = normalizeNumeric(text).trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return n >= -100 && n <= 100 ? n : null;
}

export function parseHorizon(text: string): number | null {
  const normalized = normalizeNumeric(text).trim();
  if (!/^\d{1,2}$/.test(normalized)) return null;
  const n = Number(normalized);
  return n >= 1 && n <= 30 ? n : null;
}
