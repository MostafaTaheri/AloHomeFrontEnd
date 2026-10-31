"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Definition } from "@/components/finance/freshness";
import { Money } from "@/components/finance/money";
import { StatBox, StatGrid } from "@/components/finance/stat";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { hasErrorCode } from "@/lib/api/error";
import { capitalFundingApi } from "@/lib/api/finance/capital-funding";
import { qk } from "@/lib/api/keys";
import { useScheme } from "../workspace/scheme-provider";

/**
 * What closing a scenario's shortfall would cost each lot (CAP-08): one special levy, or the
 * smallest lasting rise in contributions, apportioned by unit entitlement. A planning aid only.
 */
export function ContributionImpactCard({ scenarioId }: { scenarioId: string }) {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const query = useQuery({
    queryKey: qk.contributionImpact(schemeId, scenarioId),
    queryFn: ({ signal }) => capitalFundingApi.contributionImpact(schemeId, scenarioId, { signal }),
    retry: (count, error) => !hasErrorCode(error, 360104) && count < 2,
  });

  if (query.isPending) return <ListSkeleton rows={3} />;
  if (query.isError && hasErrorCode(query.error, 360104))
    return (
      <EmptyState
        title={t("impact.noEntitlementsTitle")}
        body={t("impact.noEntitlementsBody")}
        action={
          <Link href={`/schemes/${schemeId}/property`} className="text-brand hover:underline">
            {t("impact.goProperty")}
          </Link>
        }
      />
    );
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const r = query.data;

  return (
    <Card>
      <CardHeader
        title={t("impact.title", { name: r.scenario.name })}
        description={t("impact.subtitle")}
      />
      <CardBody className="space-y-4">
        {r.maximumShortfall <= 0 ? (
          <InlineAlert tone="ok">{t("impact.noShortfall")}</InlineAlert>
        ) : (
          <>
            <StatGrid>
              <StatBox
                label={t("impact.shortfall")}
                tone="danger"
                value={<Money amount={r.maximumShortfall} currency={r.currency} whole />}
                hint={
                  r.firstShortfallYear
                    ? t("impact.from", { year: fmt.fiscalYear(r.firstShortfallYear) })
                    : undefined
                }
              />
              <StatBox
                label={t("impact.specialLevy")}
                value={<Money amount={r.specialLevyTotal} currency={r.currency} whole />}
              />
              <StatBox
                label={t("impact.annualIncrease")}
                value={<Money amount={r.requiredAnnualIncrease} currency={r.currency} whole />}
                hint={t("impact.newContribution", {
                  amount: fmt.money(r.newAnnualContribution, r.currency, { whole: true }),
                })}
              />
              <StatBox
                label={t("impact.endingBalance")}
                value={<Money amount={r.endingBalanceWithIncrease} currency={r.currency} whole />}
              />
            </StatGrid>
            <Table>
              <caption className="sr-only">{t("impact.byLot")}</caption>
              <THead>
                <TR>
                  <TH>{t("impact.lot")}</TH>
                  <TH className="text-end">{t("impact.entitlement")}</TH>
                  <TH className="text-end">{t("impact.current")}</TH>
                  <TH className="text-end">{t("impact.specialLevy")}</TH>
                  <TH className="text-end">{t("impact.annualIncrease")}</TH>
                </TR>
              </THead>
              <TBody>
                {r.lots.map((lot) => (
                  <TR key={lot.lotId}>
                    <TD dir="ltr">{lot.lotNumber}</TD>
                    <TD className="text-end">
                      {fmt.integer(lot.entitlement)}
                      <span className="block text-xs text-muted">
                        {fmt.percent(lot.sharePercent, { digits: 2 })}
                      </span>
                    </TD>
                    <TD className="text-end">
                      <Money amount={lot.currentAnnualContribution} currency={r.currency} whole />
                    </TD>
                    <TD className="text-end">
                      <Money amount={lot.specialLevy} currency={r.currency} whole />
                    </TD>
                    <TD className="text-end">
                      <Money amount={lot.annualIncrease} currency={r.currency} whole />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </>
        )}
        <Definition text={r.definition} />
        {r.disclaimer ? <p className="text-xs text-muted">{r.disclaimer}</p> : null}
      </CardBody>
    </Card>
  );
}
