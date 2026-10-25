import type { MessageKey } from "@/i18n/translator";

/**
 * The API accepts enums as numbers in requests and returns them as strings in results. Each
 * table maps the result name to the request number and to a translation key, so a screen can
 * read a status, label it and send a change back without repeating magic numbers.
 */

function table<const N extends string>(entries: Record<N, number>) {
  const byName = entries;
  const byNumber = new Map<number, N>(
    (Object.entries(entries) as [N, number][]).map(([name, n]) => [n, name]),
  );
  return {
    names: Object.keys(entries) as N[],
    toNumber: (name: N): number => byName[name],
    fromNumber: (n: number): N | undefined => byNumber.get(n),
    isName: (value: unknown): value is N =>
      typeof value === "string" && Object.prototype.hasOwnProperty.call(byName, value),
  };
}

export const ImportKind = table({ Expenses: 1, Levies: 2, ArrearsReport: 3, CapitalWorksPlan: 4 });
export const ExpenseFlagStatus = table({ Open: 1, Confirmed: 2, Dismissed: 3, Investigating: 4 });
export const ExpenseFlagType = table({ Duplicate: 1, UnusualSpend: 2 });
export const ArrearsActionStatus = table({ Open: 1, InReview: 2, Resolved: 3, Dismissed: 4 });
export const AiReviewStatus = table({ Unreviewed: 1, Useful: 2, Incorrect: 3, NeedsReview: 4 });
export const SuggestionStatus = table({ Pending: 1, Accepted: 2, Rejected: 3 });
export const FeedbackRating = table({ Useful: 1, NotUseful: 2, Incorrect: 3, NeedsReview: 4 });
export const FeedbackSubjectType = table({
  ExpenseFlag: 1,
  AiInsight: 2,
  RiskSignal: 3,
  Report: 4,
  Dashboard: 5,
  Metric: 6,
});
export const CapitalWorkPriority = table({ Low: 1, Medium: 2, High: 3, Critical: 4 });
export const CapitalWorkStatus = table({
  Planned: 1,
  InProgress: 2,
  Completed: 3,
  Deferred: 4,
  Cancelled: 5,
});
export const FundType = table({ Admin: 1, CapitalWorks: 2 });
export const SchemeRole = table({ Manager: 1, ReadOnly: 2 });
export const LotRole = table({ Owner: 1, FamilyMember: 2 });
export const ActiveStatus = table({ Disabled: 0, Active: 1 });
export const SpendGrouping = table({ Month: 1, Category: 2, Supplier: 3 });
export const AiSubjectType = table({ ExpenseFlag: 1 });

/** Translation key for an enum value, or null when the server sent something unknown. */
export type EnumLabelKey = MessageKey;

/** Returns the raw value when it is not a known name, so unknown statuses still render. */
export function labelOf(
  prefix: string,
  value: string | number | null | undefined,
  t: (key: MessageKey) => string,
  known: { isName: (v: unknown) => boolean },
): string {
  if (value === null || value === undefined || value === "") return t("common.none" as MessageKey);
  const name = String(value);
  return known.isName(name) ? t(`${prefix}.${name}` as MessageKey) : name;
}

/** Normalises a numeric `status` from list endpoints that serialise enums as numbers. */
export function activeName(value: string | number | null | undefined): "Active" | "Disabled" {
  if (value === 1 || value === "1" || value === "Active") return "Active";
  return "Disabled";
}
