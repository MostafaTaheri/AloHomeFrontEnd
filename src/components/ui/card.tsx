import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-line bg-surface", className)} {...rest} />;
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...rest} />;
}

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {backHref && backLabel ? (
          <a
            href={backHref}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
          >
            <span aria-hidden="true" className="rtl:rotate-180">
              ←
            </span>
            {backLabel}
          </a>
        ) : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
