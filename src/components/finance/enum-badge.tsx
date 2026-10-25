"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/translator";

type Tone = "ok" | "warn" | "danger" | "neutral";

/** Tone per enum value. Anything not listed (including future server values) is neutral. */
const TONES: Record<string, Record<string, Tone>> = {
  flagStatus: { Open: "warn", Confirmed: "danger", Dismissed: "neutral", Investigating: "warn" },
  arrearsStatus: { Open: "warn", InReview: "warn", Resolved: "ok", Dismissed: "neutral" },
  importStatus: {
    Uploaded: "neutral",
    Mapped: "neutral",
    Validated: "ok",
    Committed: "ok",
    Failed: "danger",
    Superseded: "neutral",
  },
  verification: { Unverified: "warn", Verified: "ok", Mismatch: "danger" },
  rowStatus: {
    Pending: "neutral",
    Valid: "ok",
    Invalid: "danger",
    Duplicate: "warn",
    Imported: "ok",
  },
  severity: { Error: "danger", Warning: "warn" },
  priority: { Low: "neutral", Medium: "neutral", High: "warn", Critical: "danger" },
  capStatus: {
    Planned: "neutral",
    InProgress: "warn",
    Completed: "ok",
    Deferred: "warn",
    Cancelled: "neutral",
  },
  riskLevel: { Low: "ok", Medium: "warn", High: "danger", Critical: "danger" },
  aiReview: { Unreviewed: "neutral", Useful: "ok", Incorrect: "danger", NeedsReview: "warn" },
  suggestion: { Pending: "warn", Accepted: "ok", Rejected: "neutral" },
  recordStatus: { Unverified: "warn", Verified: "ok", Voided: "neutral" },
  active: { Active: "ok", Disabled: "warn" },
  schemeRole: { Manager: "ok", ReadOnly: "neutral" },
};

export type EnumGroup =
  | "flagStatus"
  | "flagType"
  | "arrearsStatus"
  | "importKind"
  | "importStatus"
  | "verification"
  | "rowStatus"
  | "severity"
  | "priority"
  | "capStatus"
  | "riskLevel"
  | "aiReview"
  | "suggestion"
  | "recordType"
  | "recordStatus"
  | "active"
  | "schemeRole"
  | "lotRole"
  | "feedbackRating"
  | "subjectType"
  | "fund"
  | "origin";

/** Label for an enum value, falling back to the raw value when the server sends a new one. */
export function useEnumLabel() {
  const { t } = useI18n();
  return (group: EnumGroup, value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === "") return t("common.none");
    const key = `enums.${group}.${value}` as MessageKey;
    const label = t(key);
    // The translator echoes the key for a missing entry; show the raw value instead.
    return label === key ? String(value) : label;
  };
}

export function EnumBadge({
  group,
  value,
}: {
  group: EnumGroup;
  value: string | number | null | undefined;
}) {
  const label = useEnumLabel();
  const tone =
    (value !== null && value !== undefined && TONES[group]?.[String(value)]) || "neutral";
  return <Badge tone={tone}>{label(group, value)}</Badge>;
}
