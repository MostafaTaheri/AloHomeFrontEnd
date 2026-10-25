/** Chart scale helpers. Pure functions so the maths is unit-tested without rendering. */

export interface Domain {
  min: number;
  max: number;
  ticks: number[];
}

function niceStep(rawStep: number): number {
  if (rawStep <= 0 || !Number.isFinite(rawStep)) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const fraction = rawStep / 10 ** exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * 10 ** exponent;
}

/**
 * A value domain that always includes zero (bars and balances are read against zero) with round
 * tick values. `tickCount` is a target, not a guarantee.
 */
export function niceDomain(values: number[], tickCount = 4): Domain {
  const finite = values.filter((v) => Number.isFinite(v));
  const lo = Math.min(0, ...finite);
  const hi = Math.max(0, ...finite);
  if (lo === 0 && hi === 0) return { min: 0, max: 1, ticks: [0, 1] };

  const step = niceStep((hi - lo) / Math.max(1, tickCount));
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  // Round each tick to avoid 0.30000000000000004 style drift on fractional steps.
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { min, max, ticks };
}

/** Maps a value in [min, max] to a pixel position between `start` and `end`. */
export function project(
  value: number,
  min: number,
  max: number,
  start: number,
  end: number,
): number {
  if (max === min) return start;
  return start + ((value - min) / (max - min)) * (end - start);
}

/** Indices of labels to show so that at most `maxLabels` are drawn, always including the last. */
export function labelIndices(count: number, maxLabels: number): number[] {
  if (count <= 0) return [];
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil(count / maxLabels);
  const indices: number[] = [];
  for (let i = count - 1; i >= 0; i -= step) indices.unshift(i);
  return indices;
}

/** Compact axis number: 1.2K, 3.4M. Uses the caller's number formatter for the digits. */
export function compact(
  value: number,
  format: (n: number, options?: Intl.NumberFormatOptions) => string,
): string {
  return format(value, { notation: "compact", maximumFractionDigits: 1 });
}
