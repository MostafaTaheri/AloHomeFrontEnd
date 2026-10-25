/** Query/route parameter parsing. Plain module so server and client code can both import it. */

export function parsePage(value: string | null | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : 1;
}

/** Route params arrive as strings; accept only plain positive integers. */
export function parseId(value: string): number | null {
  if (!/^\d{1,10}$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 && n <= 2_147_483_647 ? n : null;
}
