/** Parses "30, 60, 90" into strictly increasing whole numbers (1 to 6 of them), or null. */
export function parseBoundaries(text: string): number[] | null {
  const parts = text
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 1 || parts.length > 6) return null;
  const values: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,4}$/.test(part)) return null;
    const n = Number(part);
    if (n <= 0 || (values.length > 0 && n <= values[values.length - 1]!)) return null;
    values.push(n);
  }
  return values;
}

/** Whole number from 1 to 50, or null. */
export function parseTopN(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= 1 && n <= 50 ? n : null;
}
