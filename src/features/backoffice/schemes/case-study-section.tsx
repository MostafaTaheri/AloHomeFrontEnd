"use client";

import { useQuery } from "@tanstack/react-query";
import { Money } from "@/components/finance/money";
import { EnumBadge } from "@/components/finance/enum-badge";
import { StatBox, StatGrid } from "@/components/finance/stat";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { qk } from "@/lib/api/keys";
import { boReadinessApi } from "@/lib/api/readiness";

/**
 * Outcome-based case study (GTM-08), built from measured pilot metrics. Without the customer's
 * consent the scheme is described, never named.
 */
export function CaseStudySection({ schemeId }: { schemeId: number }) {
  const { t, fmt } = useI18n();
  const query = useQuery({
    queryKey: qk.bo.caseStudy(schemeId),
    queryFn: ({ signal }) => boReadinessApi.caseStudy(schemeId, signal),
  });
  if (query.isPending) return <ListSkeleton rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const c = query.data;

  return (
    <Card>
      <CardHeader
        title={c.displayName}
        description={t("caseStudy.subtitle")}
        actions={
          <>
            <Badge tone={c.publishable ? "ok" : "warn"}>
              {c.publishable ? t("caseStudy.publishable") : t("caseStudy.anonymous")}
            </Badge>
            {c.pilotStatus ? <EnumBadge group="pilotStatus" value={c.pilotStatus} /> : null}
          </>
        }
      />
      <CardBody className="space-y-4">
        {!c.publishable ? <InlineAlert tone="warn">{t("caseStudy.noConsent")}</InlineAlert> : null}
        <StatGrid>
          <StatBox
            label={t("caseStudy.firstDashboard")}
            value={
              c.hoursToFirstVerifiedDashboard === null
                ? t("common.none")
                : t("caseStudy.hours", { hours: c.hoursToFirstVerifiedDashboard })
            }
          />
          <StatBox
            label={t("caseStudy.anomalies")}
            value={t("caseStudy.anomalyValue", {
              found: c.anomaliesFound,
              confirmed: c.anomaliesConfirmed,
            })}
          />
          <StatBox
            label={t("caseStudy.moneyConfirmed")}
            value={<Money amount={c.moneyFlaggedConfirmed} currency={c.currency} whole />}
          />
          <StatBox
            label={t("caseStudy.hoursSaved")}
            value={t("caseStudy.hours", { hours: fmt.number(c.hoursSavedReported) })}
            hint={
              c.baselineHoursPerMonth === null
                ? undefined
                : t("caseStudy.baseline", { hours: fmt.number(c.baselineHoursPerMonth) })
            }
          />
        </StatGrid>
        <p className="text-sm text-muted">
          {t("caseStudy.facts", {
            count: c.lots,
            reports: c.reportsGenerated,
            code: c.jurisdictionCode,
          })}
          {c.paidPilot ? ` · ${t("caseStudy.paid")}` : ""}
        </p>
        <div>
          <h3 className="text-sm font-semibold">{t("caseStudy.statements")}</h3>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm">
            {c.statements.map((s) => (
              <li key={s} dir="auto">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}
