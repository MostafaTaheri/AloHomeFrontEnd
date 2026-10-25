"use client";

import type { ReactNode } from "react";
import { describeError, ApiError } from "@/lib/api/error";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className ?? "size-5")}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-surface-2", className)} aria-hidden="true" />
  );
}

/** Placeholder rows shown while a list loads. Announces loading to assistive tech once. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      {body ? <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const reference = error instanceof ApiError ? error.correlationId : null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/40 bg-danger-soft px-6 py-8 text-center"
    >
      <p className="text-sm font-medium text-danger">{describeError(error, t)}</p>
      {reference ? (
        <p className="mt-1 text-xs text-muted" dir="ltr">
          {t("errors.reference", { id: reference })}
        </p>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}

export function InlineAlert({
  tone,
  children,
}: {
  tone: "danger" | "ok" | "warn";
  children: ReactNode;
}) {
  const styles = {
    danger: "border-danger/40 bg-danger-soft text-danger",
    ok: "border-ok/40 bg-ok-soft text-ok",
    warn: "border-warn/40 bg-warn-soft text-warn",
  } as const;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-md border px-3 py-2 text-sm", styles[tone])}
    >
      {children}
    </div>
  );
}
