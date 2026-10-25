"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/provider";
import { LocaleSwitcher } from "./locale-switcher";
import { PreferenceBar } from "./preferences";
import { SignOutButton } from "./sign-out-button";

/**
 * Chrome for the resident / owner / manager app. Inside a scheme the market follows the scheme's
 * jurisdiction, so the market switch only appears on pages that are not tied to a scheme.
 */
export function ClientShell({
  user,
  children,
}: {
  user: { phoneNumber: string | null };
  children: ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const inScheme = /^\/schemes\/\d+/.test(pathname);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t("common.skipToContent")}
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
          <Link href="/schemes" className="text-lg font-bold tracking-tight text-brand">
            {t("common.appName")}
          </Link>
          <Link href="/schemes" className="text-sm font-medium text-muted hover:text-fg">
            {t("nav.schemes")}
          </Link>

          <div className="ms-auto flex flex-wrap items-center gap-3">
            {inScheme ? <LocaleSwitcher /> : <PreferenceBar />}
            {user.phoneNumber ? (
              <span className="hidden text-sm text-muted sm:inline" dir="ltr">
                {user.phoneNumber}
              </span>
            ) : null}
            <SignOutButton surface="client" />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
