export interface ParsedSetCookie {
  name: string;
  value: string;
  expires?: Date;
  maxAge?: number;
}

/** Parses one `Set-Cookie` header value. Only the attributes this app needs are kept. */
export function parseSetCookie(header: string): ParsedSetCookie | null {
  const [pair, ...attrs] = header.split(";");
  if (!pair) return null;
  const eq = pair.indexOf("=");
  if (eq <= 0) return null;

  const name = pair.slice(0, eq).trim();
  let value = pair.slice(eq + 1).trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // keep the raw value
  }

  const result: ParsedSetCookie = { name, value };
  for (const attr of attrs) {
    const i = attr.indexOf("=");
    const key = (i === -1 ? attr : attr.slice(0, i)).trim().toLowerCase();
    const val = i === -1 ? "" : attr.slice(i + 1).trim();
    if (key === "expires") {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) result.expires = d;
    } else if (key === "max-age") {
      const n = Number(val);
      if (Number.isFinite(n)) result.maxAge = n;
    }
  }
  return result;
}

export function findSetCookie(headers: string[], name: string): ParsedSetCookie | null {
  for (const h of headers) {
    const parsed = parseSetCookie(h);
    if (parsed && parsed.name === name) return parsed;
  }
  return null;
}
