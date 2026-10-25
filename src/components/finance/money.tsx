"use client";

import { useI18n } from "@/i18n/provider";
import { profileFor } from "@/lib/region/config";
import { cn } from "@/lib/utils";

/**
 * A money amount in the active language, region and currency unit. Pass the currency the API
 * returned with the figure; it falls back to the market's own currency only when a screen has
 * none (never guess a currency for data that came with one).
 */
export function Money({
  amount,
  currency,
  signed,
  whole,
  tone,
  className,
}: {
  amount: number | null | undefined;
  currency?: string;
  signed?: boolean;
  whole?: boolean;
  /** Colours positive as ok and negative as danger. Use for balances and changes, not for spend. */
  tone?: "balance" | "none";
  className?: string;
}) {
  const { fmt, region } = useI18n();
  const code = currency || profileFor(region).currency;
  const text = fmt.money(amount, code, { signed, whole });
  return (
    <span
      dir="auto"
      className={cn(
        "whitespace-nowrap tabular-nums",
        tone === "balance" &&
          amount !== null &&
          amount !== undefined &&
          amount < 0 &&
          "text-danger",
        className,
      )}
    >
      {text}
    </span>
  );
}

/** A signed percentage change with an arrow glyph that is not the only carrier of meaning. */
export function PercentChange({
  value,
  notMeaningful,
  reason,
  higherIsWorse = true,
}: {
  value: number | null | undefined;
  notMeaningful?: boolean;
  reason?: string | null;
  higherIsWorse?: boolean;
}) {
  const { fmt, t } = useI18n();
  if (notMeaningful || value === null || value === undefined) {
    return (
      <span className="text-muted" title={reason ?? undefined}>
        {t("data.notMeaningful")}
      </span>
    );
  }
  if (value === 0) return <span className="text-muted">{t("data.noChange")}</span>;
  const up = value > 0;
  const bad = higherIsWorse ? up : !up;
  return (
    <span className={cn("tabular-nums", bad ? "text-danger" : "text-ok")} dir="auto">
      <span aria-hidden="true">{up ? "▲" : "▼"} </span>
      {fmt.percent(value, { signed: true })}
    </span>
  );
}
