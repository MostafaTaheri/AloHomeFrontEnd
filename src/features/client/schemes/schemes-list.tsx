"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { schemesApi } from "@/lib/api/finance/endpoints";
import { qk } from "@/lib/api/keys";
import { organisationsApi } from "@/lib/api/organisations";
import { createTranslator } from "@/i18n/translator";
import { regionForJurisdiction } from "@/lib/region/config";

export function SchemesList() {
  const { t, locale, currencyUnit, region: outerRegion } = useI18n();
  const query = useQuery({
    queryKey: qk.schemes,
    queryFn: ({ signal }) => schemesApi.mine({ signal }),
  });

  return (
    <div>
      <PageHeader
        title={t("workspace.selectTitle")}
        description={t("workspace.selectSubtitle")}
        actions={
          query.isSuccess && query.data.length > 1 ? (
            <Link
              href="/schemes/portfolio"
              className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2"
            >
              {t("portfolio.open")}
            </Link>
          ) : null
        }
      />

      {query.isPending ? <ListSkeleton rows={3} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.isSuccess && query.data.length === 0 ? (
        <EmptyState title={t("workspace.emptyTitle")} body={t("workspace.emptyBody")} />
      ) : null}

      {query.isSuccess && query.data.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.map((scheme) => {
            // Each card describes the scheme in its own market (currency, wording).
            const region = regionForJurisdiction(scheme.jurisdictionCode) ?? outerRegion;
            const own = createTranslator(locale, region, currencyUnit);
            return (
              <li key={scheme.schemeId}>
                <Link
                  href={`/schemes/${scheme.schemeId}`}
                  className="block h-full rounded-lg focus-visible:outline-offset-4"
                >
                  <Card className="h-full transition-colors hover:border-brand">
                    <CardBody className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-base font-semibold">{scheme.title}</h2>
                        <EnumBadge group="schemeRole" value={scheme.role} />
                      </div>
                      <p className="text-sm text-muted">
                        {own.t(`preferences.${region}`)} ·{" "}
                        {own.fmt.currencyLabel(scheme.currencyCode)}
                      </p>
                      <p className="text-sm font-medium text-brand">{t("workspace.openScheme")}</p>
                    </CardBody>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      <MyOrganisations />
    </div>
  );
}

/** Organisations the person belongs to (IAM-01). Hidden when there are none. */
function MyOrganisations() {
  const { t, fmt } = useI18n();
  const query = useQuery({
    queryKey: qk.myOrganisations,
    queryFn: ({ signal }) => organisationsApi.mine({ signal }),
  });
  if (!query.data || query.data.length === 0) return null;

  return (
    <Card className="mt-8">
      <CardHeader title={t("organisations.mineTitle")} description={t("organisations.mineBody")} />
      <ul className="divide-y divide-line">
        {query.data.map((org) => (
          <li key={org.organisationId} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="font-medium" dir="auto">
              {org.name}
            </span>
            <EnumBadge group="orgRole" value={org.role} />
            {org.status !== "Active" ? <EnumBadge group="orgStatus" value={org.status} /> : null}
            <span className="ms-auto text-sm text-muted">
              {t("organisations.schemeCount", { count: fmt.integer(org.schemes.length) })}
            </span>
            {org.schemes.length > 1 ? (
              <Link
                href={`/schemes/portfolio?organisation=${org.organisationId}`}
                className="text-sm text-brand hover:underline"
              >
                {t("portfolio.open")}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
