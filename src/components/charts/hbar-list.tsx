"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export interface HBarItem {
  key: string;
  label: string;
  value: number;
  /** Secondary text under the label (share, count). */
  sub?: string;
  /** Formatted value; defaults to the plain number. */
  display?: ReactNode;
}

/**
 * Horizontal bars as plain HTML: labels stay readable in both directions, long names wrap, and
 * each row can be a button that drills into the data behind it.
 */
export function HBarList({
  items,
  onSelect,
  selectedKey,
  seriesIndex = 0,
  emptyLabel,
}: {
  items: HBarItem[];
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
  seriesIndex?: number;
  emptyLabel?: string;
}) {
  const { t } = useI18n();
  if (items.length === 0)
    return <p className="text-sm text-muted">{emptyLabel ?? t("data.noData")}</p>;
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  const color = `var(--chart-${(seriesIndex % 6) + 1})`;

  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const width = `${Math.max(2, (Math.abs(item.value) / max) * 100)}%`;
        const row = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{item.label}</span>
              <span className="shrink-0 tabular-nums">{item.display ?? item.value}</span>
            </span>
            <span className="mt-1 block h-2 rounded-full bg-surface-2" aria-hidden="true">
              <span className="block h-2 rounded-full" style={{ width, background: color }} />
            </span>
            {item.sub ? <span className="mt-0.5 block text-xs text-muted">{item.sub}</span> : null}
          </>
        );
        return (
          <li key={item.key}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(item.key)}
                aria-pressed={selectedKey === item.key}
                className={cn(
                  "block w-full rounded-md px-2 py-1.5 text-start transition-colors hover:bg-surface-2",
                  selectedKey === item.key && "bg-brand-soft",
                )}
              >
                {row}
              </button>
            ) : (
              <div className="px-2 py-1.5">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
