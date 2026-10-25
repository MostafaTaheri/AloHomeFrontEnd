import { normalizeNumeric } from "@/lib/format/amount";

export function parseLatitude(text: string): number | null {
  return parseBounded(text, -90, 90);
}

export function parseLongitude(text: string): number | null {
  return parseBounded(text, -180, 180);
}

function parseBounded(text: string, min: number, max: number): number | null {
  const n = normalizeNumeric(text).trim();
  if (!/^-?\d+(\.\d+)?$/.test(n)) return null;
  const v = Number(n);
  return v >= min && v <= max ? v : null;
}

/** Whole number, 0 or more (floors, parking spaces, rooms). */
export function parseWhole(text: string, max = 1000): number | null {
  const n = normalizeNumeric(text).trim();
  if (!/^\d{1,4}$/.test(n)) return null;
  const v = Number(n);
  return v <= max ? v : null;
}

/** Positive number with an optional decimal part (area, entitlement). */
export function parsePositive(text: string): number | null {
  const n = normalizeNumeric(text).trim();
  if (!/^\d+(\.\d+)?$/.test(n)) return null;
  const v = Number(n);
  return v > 0 ? v : null;
}

export function parsePostal(text: string, digits: 4 | 10): string | null {
  const n = normalizeNumeric(text).trim();
  return new RegExp(`^\\d{${digits}}$`).test(n) ? n : null;
}

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** User ids are GUIDs. Surrounding whitespace from a paste is ignored. */
export function parseUserId(text: string): string | null {
  const v = text.trim();
  return GUID.test(v) ? v.toLowerCase() : null;
}
