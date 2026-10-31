import { parseUserId } from "@/features/backoffice/schemes/parse";
import { normalizeNumeric } from "@/lib/format/amount";
import type { NewOwner, Party } from "@/lib/api/property";

/** A share in percent: above 0, at most 100, at most two decimals. Accepts Persian digits. */
export function parseShare(text: string): number | null {
  const v = normalizeNumeric(text);
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && n <= 100 ? n : null;
}

/**
 * Who holds a tenure or office: a user id when the text is one, otherwise a name. Names are
 * for people without an AloHome account (the API stores them as a party name).
 */
export function parseParty(text: string): Party | null {
  const v = text.trim();
  if (!v) return null;
  const userId = parseUserId(v);
  return userId ? { userId } : { partyName: v.slice(0, 200) };
}

export interface OwnerRow {
  party: string;
  share: string;
}

export interface TransferCheck {
  /** Per row: which field is wrong, if any. */
  rows: ("party" | "share" | null)[];
  total: number;
  /** Shares add up to exactly 100 (after rounding to two decimals, as the API does). */
  totalOk: boolean;
  owners: NewOwner[] | null;
}

export function checkTransfer(rows: OwnerRow[]): TransferCheck {
  const parsed = rows.map((row) => ({
    party: parseParty(row.party),
    share: parseShare(row.share),
  }));
  const total = Math.round(parsed.reduce((sum, r) => sum + (r.share ?? 0), 0) * 100) / 100;
  const errors = parsed.map((r) => (!r.party ? "party" : r.share === null ? "share" : null));
  const totalOk = total === 100;
  const valid = rows.length > 0 && errors.every((e) => e === null) && totalOk;
  return {
    rows: errors,
    total,
    totalOk,
    owners: valid ? parsed.map((r) => ({ ...r.party!, sharePercent: r.share! })) : null,
  };
}

/** An optional end date must not be before the start ("yyyy-MM-dd" strings compare in order). */
export function datesInOrder(start: string, end: string): boolean {
  return !start || !end || end >= start;
}
