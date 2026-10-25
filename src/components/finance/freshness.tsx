"use client";

import { useI18n } from "@/i18n/provider";
import type { DataFreshness } from "@/lib/api/finance/types";
import { InlineAlert } from "@/components/ui/states";

const STALE_AFTER_DAYS = 45;

/**
 * Tells the reader how far to trust the figures on a screen: nothing verified yet, some data
 * still unverified, or verified data that has gone stale. Renders nothing when the data is fresh.
 */
export function FreshnessBanner({
  freshness,
  incomplete,
}: {
  freshness: DataFreshness | null | undefined;
  incomplete?: boolean;
}) {
  const { t, fmt } = useI18n();
  if (!freshness) return null;

  const messages: { tone: "warn" | "ok"; text: string }[] = [];
  if (freshness.noVerifiedData) {
    messages.push({ tone: "warn", text: t("data.noVerified") });
  } else {
    if (freshness.dataAgeDays !== null && freshness.dataAgeDays > STALE_AFTER_DAYS) {
      messages.push({ tone: "warn", text: t("data.stale", { days: freshness.dataAgeDays }) });
    }
    if (freshness.hasUnverifiedData) {
      messages.push({ tone: "warn", text: t("data.unverified") });
    }
  }
  if (incomplete) messages.push({ tone: "warn", text: t("data.estimated") });
  if (messages.length === 0) return null;

  return (
    <div className="space-y-2">
      {messages.map((m) => (
        <InlineAlert key={m.text} tone={m.tone}>
          {m.text}
          {!freshness.noVerifiedData && freshness.latestVerifiedTransactionDate ? (
            <span className="ms-1 opacity-80">
              {t("data.latest", { date: fmt.date(freshness.latestVerifiedTransactionDate) })}
            </span>
          ) : null}
        </InlineAlert>
      ))}
    </div>
  );
}

/** Collapsible definition shown under a figure ("how this is calculated"). */
export function Definition({ text }: { text: string | null | undefined }) {
  const { t } = useI18n();
  if (!text) return null;
  return (
    <details className="mt-2 text-xs text-muted">
      <summary className="cursor-pointer select-none underline-offset-2 hover:underline">
        {t("data.definition")}
      </summary>
      <p className="mt-1 max-w-prose">{text}</p>
    </details>
  );
}
