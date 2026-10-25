import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One headline figure with a label and an optional hint line. */
export function StatBox({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger";
  className?: string;
}) {
  const border = {
    neutral: "border-line",
    ok: "border-ok/40",
    warn: "border-warn/50",
    danger: "border-danger/40",
  }[tone];
  return (
    <div className={cn("rounded-lg border bg-surface px-4 py-3", border, className)}>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight">{value}</dd>
      {hint ? <dd className="mt-0.5 text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {children}
    </dl>
  );
}
