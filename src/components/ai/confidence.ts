/** Confidence arrives as a 0 to 1 fraction; tolerate a 0 to 100 value too. Returns percent points. */
export function confidencePercent(value: number): number {
  const points = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, points));
}
