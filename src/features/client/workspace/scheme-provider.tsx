"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { CurrencyUnitSwitcher } from "@/components/layout/preferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { I18nProvider, useI18n } from "@/i18n/provider";
import { ApiError } from "@/lib/api/error";
import { schemesApi } from "@/lib/api/finance/endpoints";
import type { SchemeContext } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { profileFor, regionForJurisdiction } from "@/lib/region/config";
import { track } from "@/lib/telemetry/client";
import { SchemeNav } from "./scheme-nav";

interface SchemeValue {
  schemeId: number;
  scheme: SchemeContext;
  currency: string;
  /** Managers can change data; read-only members can only view. The API enforces this too. */
  canWrite: boolean;
  adminFundLabel: string;
  capitalWorksFundLabel: string;
}

const SchemeReactContext = createContext<SchemeValue | null>(null);

export function useScheme(): SchemeValue {
  const value = useContext(SchemeReactContext);
  if (!value) throw new Error("useScheme must be used inside <SchemeWorkspace>.");
  return value;
}

/**
 * Loads a scheme's context and renders everything under it in that scheme's market: the nested
 * I18nProvider switches currency, calendar, time zone and terminology to the scheme's
 * jurisdiction while keeping the person's chosen language.
 */
export function SchemeWorkspace({ schemeId, children }: { schemeId: number; children: ReactNode }) {
  const outer = useI18n();
  const query = useQuery({
    queryKey: qk.context(schemeId),
    queryFn: ({ signal }) => schemesApi.context(schemeId, { signal }),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    track("scheme_switched", { area: "workspace" });
  }, [schemeId]);

  if (query.isPending) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <span className="sr-only">{outer.t("common.loading")}</span>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError) {
    const status = query.error instanceof ApiError ? query.error.status : 0;
    if (status === 403 || status === 404) {
      return (
        <EmptyState
          title={outer.t(
            status === 403 ? "workspace.contextForbiddenTitle" : "workspace.contextNotFoundTitle",
          )}
          body={outer.t(
            status === 403 ? "workspace.contextForbiddenBody" : "workspace.contextNotFoundBody",
          )}
          action={
            <Link
              href="/schemes"
              className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand-hover"
            >
              {outer.t("pages.goSchemes")}
            </Link>
          }
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  return (
    <SchemeScope schemeId={schemeId} scheme={query.data}>
      {children}
    </SchemeScope>
  );
}

function SchemeScope({
  schemeId,
  scheme,
  children,
}: {
  schemeId: number;
  scheme: SchemeContext;
  children: ReactNode;
}) {
  const outer = useI18n();
  // Fall back to the person's own market for a jurisdiction this app does not know yet.
  const region = regionForJurisdiction(scheme.jurisdictionCode) ?? outer.region;

  const value = useMemo<SchemeValue>(
    () => ({
      schemeId,
      scheme,
      currency: scheme.currencyCode || profileFor(region).currency,
      canWrite: scheme.role === "Manager",
      adminFundLabel: scheme.adminFundLabel,
      capitalWorksFundLabel: scheme.capitalWorksFundLabel,
    }),
    [schemeId, scheme, region],
  );

  return (
    <I18nProvider locale={outer.locale} region={region} currencyUnit={outer.currencyUnit}>
      <SchemeReactContext.Provider value={value}>
        <WorkspaceChrome>{children}</WorkspaceChrome>
      </SchemeReactContext.Provider>
    </I18nProvider>
  );
}

function WorkspaceChrome({ children }: { children: ReactNode }) {
  const { t, fmt, region } = useI18n();
  const { scheme, schemeId, canWrite } = useScheme();

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/schemes" className="text-xs text-muted hover:text-fg hover:underline">
              {t("workspace.allSchemes")}
            </Link>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{scheme.title}</h1>
            {scheme.address ? <p className="text-sm text-muted">{scheme.address}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={canWrite ? "ok" : "neutral"}>
              {t("workspace.roleBadge", {
                role: t(
                  scheme.role === "Manager"
                    ? "enums.schemeRole.Manager"
                    : "enums.schemeRole.ReadOnly",
                ),
              })}
            </Badge>
            <CurrencyUnitSwitcher />
            <Link href="/schemes">
              <Button variant="secondary" size="sm">
                {t("workspace.switch")}
              </Button>
            </Link>
          </div>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <li>{t("workspace.fiscalYear", { year: fmt.fiscalYear(scheme.currentFiscalYear) })}</li>
          <li>
            {t("workspace.currentPeriod", { period: fmt.periodLabel(scheme.currentPeriodLabel) })}
          </li>
          <li>
            {t("workspace.currencyLine", { currency: fmt.currencyLabel(scheme.currencyCode) })}
          </li>
          <li dir="ltr">{t("workspace.timeZone", { zone: scheme.timeZoneId })}</li>
          <li dir="ltr">{t("workspace.jurisdiction", { code: scheme.jurisdictionCode })}</li>
        </ul>

        {!canWrite ? (
          <p className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
            {t("common.readOnlyHint")}
          </p>
        ) : null}
      </header>

      <SchemeNav schemeId={schemeId} />

      <div>{children}</div>

      {scheme.disclaimer ? (
        <aside
          aria-label={t("workspace.disclaimerTitle")}
          className="rounded-md border border-line bg-surface-2 px-4 py-3 text-xs text-muted"
        >
          <strong className="font-semibold text-fg">{t("workspace.disclaimerTitle")}: </strong>
          {scheme.disclaimer}
        </aside>
      ) : null}
      <span hidden data-region={region} />
    </div>
  );
}
