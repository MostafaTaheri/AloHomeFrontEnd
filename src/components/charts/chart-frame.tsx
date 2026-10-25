"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";

export interface ChartTable {
  columns: string[];
  rows: ReactNode[][];
}

/**
 * Wraps a chart with a title, a text summary for assistive tech and a switch to the same data as
 * a table. The chart itself is decorative to a screen reader; the summary and the table carry
 * the information.
 */
export function ChartFrame({
  title,
  description,
  summary,
  legend,
  table,
  children,
}: {
  title: string;
  description?: string;
  summary: string;
  legend?: { label: string; seriesIndex: number }[];
  table: ChartTable;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [asTable, setAsTable] = useState(false);
  const tableId = useId();

  return (
    <figure className="space-y-3" aria-label={t("data.chartLabel", { title, summary })}>
      <figcaption className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {description ? <p className="text-xs text-muted">{description}</p> : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={asTable}
          aria-controls={tableId}
          onClick={() => setAsTable((v) => !v)}
        >
          {asTable ? t("data.chartView") : t("data.tableView")}
        </Button>
      </figcaption>

      {legend && legend.length > 1 && !asTable ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden="true">
          {legend.map((entry) => (
            <li key={entry.label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-5"
                style={{
                  background: `var(--chart-${(entry.seriesIndex % 6) + 1})`,
                  height: 3,
                }}
              />
              {entry.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div id={tableId}>
        {asTable ? (
          <Table>
            <THead>
              <TR>
                {table.columns.map((c) => (
                  <TH key={c}>{c}</TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {table.rows.map((row, i) => (
                <TR key={i}>
                  {row.map((cell, j) => (
                    <TD key={j} className={j === 0 ? "" : "tabular-nums"}>
                      {cell}
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <div aria-hidden="true">{children}</div>
        )}
      </div>

      {/* The same numbers for screen readers while the visual chart is showing. */}
      {!asTable ? (
        <div className="sr-only">
          <Table>
            <THead>
              <TR>
                {table.columns.map((c) => (
                  <TH key={c}>{c}</TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {table.rows.map((row, i) => (
                <TR key={i}>
                  {row.map((cell, j) => (
                    <TD key={j}>{cell}</TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      ) : null}
    </figure>
  );
}
