"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { PreferenceBar } from "./preferences";
import { SignOutButton } from "./sign-out-button";

const ITEMS = [
  { href: "/backoffice", label: "nav.overview", exact: true },
  { href: "/backoffice/schemes", label: "backoffice.schemes", exact: false },
  { href: "/backoffice/organisations", label: "nav.organisations", exact: false },
  { href: "/backoffice/users", label: "nav.users", exact: false },
  { href: "/backoffice/audit-log", label: "nav.auditLog", exact: false },
  { href: "/backoffice/access-log", label: "nav.audit", exact: false },
  { href: "/backoffice/pilot", label: "nav.pilot", exact: false },
  { href: "/backoffice/evidence", label: "nav.evidence", exact: false },
  { href: "/backoffice/product", label: "nav.product", exact: false },
] as const;

/** Chrome for staff. Separate from the client shell: different navigation, different sign-out. */
export function BackofficeShell({
  user,
  children,
}: {
  user: { phoneNumber: string | null };
  children: ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t("common.skipToContent")}
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
          <Link
            href="/backoffice"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-brand"
          >
            {t("common.appName")}
            <span className="rounded bg-brand px-2 py-0.5 text-xs font-semibold text-brand-fg">
              {t("nav.backoffice")}
            </span>
          </Link>
          <nav aria-label={t("backoffice.navLabel")} className="flex flex-wrap gap-1">
            {ITEMS.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium",
                    active ? "bg-brand-soft text-brand" : "text-muted hover:text-fg",
                  )}
                >
                  {t(item.label)}
                </Link>
              );
            })}
          </nav>
          <div className="ms-auto flex flex-wrap items-center gap-3">
            <PreferenceBar />
            {user.phoneNumber ? (
              <span className="hidden text-sm text-muted sm:inline" dir="ltr">
                {user.phoneNumber}
              </span>
            ) : null}
            <SignOutButton surface="backoffice" />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
