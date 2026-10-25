"use client";

import { useI18n } from "@/i18n/provider";
import { ChartFrame } from "./chart-frame";
import { compact, labelIndices, niceDomain, project } from "./scale";

export interface ChartSeries {
  name: string;
  values: number[];
}

const W = 640;
const H = 260;
const M = { top: 12, right: 12, bottom: 30, left: 58 };
const DASH = [undefined, "6 4", "2 3"] as const;

/**
 * Line or column chart for a handful of series over shared labels (periods, fiscal years).
 * Plain SVG: no chart library, scales with its container, follows the colour tokens and keeps
 * the axis left-to-right in every language so time always reads the same way.
 */
export function SeriesChart({
  kind,
  title,
  description,
  labels,
  series,
  formatValue,
  formatLabel,
}: {
  kind: "line" | "column";
  title: string;
  description?: string;
  labels: string[];
  series: ChartSeries[];
  /** Full value for the table, e.g. a money string. */
  formatValue: (value: number) => string;
  formatLabel?: (label: string) => string;
}) {
  const { fmt, t } = useI18n();
  const label = formatLabel ?? ((l: string) => l);
  const all = series.flatMap((s) => s.values);
  const domain = niceDomain(all, 4);
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const n = labels.length;
  const x = (i: number) =>
    kind === "line"
      ? M.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
      : M.left + ((i + 0.5) / n) * innerW;
  const y = (v: number) => project(v, domain.min, domain.max, M.top + innerH, M.top);
  const zeroY = y(0);
  const shown = new Set(labelIndices(n, 7));

  const groupWidth = innerW / Math.max(1, n);
  const barWidth = Math.max(4, Math.min(36, (groupWidth * 0.7) / Math.max(1, series.length)));

  const summary =
    n > 0
      ? t("data.trendSummary", { count: n, from: label(labels[0]!), to: label(labels[n - 1]!) })
      : t("data.noData");

  return (
    <ChartFrame
      title={title}
      description={description}
      summary={summary}
      legend={series.map((s, i) => ({ label: s.name, seriesIndex: i }))}
      table={{
        columns: [t("common.period"), ...series.map((s) => s.name)],
        rows: labels.map((l, i) => [label(l), ...series.map((s) => formatValue(s.values[i] ?? 0))]),
      }}
    >
      <div dir="ltr" className="w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" focusable="false">
          {domain.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={M.left}
                x2={W - M.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--line)"
                strokeWidth={tick === 0 ? 1.5 : 1}
              />
              <text
                x={M.left - 6}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                fill="var(--muted)"
              >
                {compact(tick, fmt.number)}
              </text>
            </g>
          ))}

          {labels.map((l, i) =>
            shown.has(i) ? (
              <text
                key={`${l}-${i}`}
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize="10"
                fill="var(--muted)"
              >
                {label(l)}
              </text>
            ) : null,
          )}

          {series.map((s, si) => {
            const color = `var(--chart-${(si % 6) + 1})`;
            if (kind === "column") {
              return (
                <g key={s.name} fill={color}>
                  {s.values.map((v, i) => {
                    const offset = (si - (series.length - 1) / 2) * barWidth;
                    const top = Math.min(y(v), zeroY);
                    return (
                      <rect
                        key={i}
                        x={x(i) + offset - barWidth / 2}
                        y={top}
                        width={barWidth}
                        height={Math.max(1, Math.abs(y(v) - zeroY))}
                        rx={2}
                      />
                    );
                  })}
                </g>
              );
            }
            const path = s.values
              .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
              .join(" ");
            return (
              <g key={s.name}>
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeDasharray={DASH[si % DASH.length]}
                  strokeLinejoin="round"
                />
                {s.values.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={color} />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </ChartFrame>
  );
}
