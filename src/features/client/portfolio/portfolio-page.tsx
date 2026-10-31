"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { StatBox, StatGrid } from "@/components/finance/stat";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { qk } from "@/lib/api/keys";
import { organisationsApi } from "@/lib/api/organisations";
import { portfolioApi, type PortfolioSchemeRow } from "@/lib/api/readiness";
import { usePageView } from "@/lib/telemetry/client";
import { useUrlState } from "@/lib/use-url-state";

/**
 * Every scheme the person can see, ranked by how much attention it needs (GTM-04). Totals are
 * kept per currency: AUD and IRR figures are never added together.
 */
export function PortfolioPage() {
  const { t, fmt } = useI18n();
  const { params, update } = useUrlState();
  usePageView("portfolio", "list");
  const organisationId = Number(params.get("organisation")) || null;

  const orgs = useQuery({
    queryKey: qk.myOrganisations,
    queryFn: ({ signal }) => organisationsApi.mine({ signal }),
  });
  const query = useQuery({
    queryKey: qk.portfolio(organisationId),
    queryFn: ({ signal }) => portfolioApi.get(organisationId ?? undefined, { signal }),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("portfolio.title")}
        description={t("portfolio.subtitle")}
        backHref="/schemes"
        backLabel={t("workspace.allSchemes")}
      />
      {orgs.data && orgs.data.length > 0 ? (
        <div className="w-72">
          <Field id="portfolio-org" label={t("portfolio.organisation")}>
            <Select
              id="portfolio-org"
              value={organisationId ?? ""}
              onChange={(e) => update({ organisation: e.target.value || null })}
            >
              <option value="">{t("portfolio.allOrganisations")}</option>
              {orgs.data.map((o) => (
                <option key={o.organisationId} value={o.organisationId}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}
      {query.isPending ? <ListSkeleton rows={4} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.schemes.length === 0 ? (
        <EmptyState title={t("portfolio.emptyTitle")} body={t("portfolio.emptyBody")} />
      ) : null}
      {query.data && query.data.schemes.length > 0 ? (
        <>
          {query.data.totals.map((total) => (
            <section
              key={total.currency}
              aria-label={t("portfolio.totalsFor", { currency: fmt.currencyLabel(total.currency) })}
            >
              <h2 className="mb-2 text-sm font-semibold">
                {t("portfolio.totalsFor", { currency: fmt.currencyLabel(total.currency) })} ·{" "}
                {t("portfolio.schemeCount", { count: total.schemes })}
              </h2>
              <StatGrid className="xl:grid-cols-5">
                <StatBox
                  label={t("portfolio.adminFund")}
                  value={<Money amount={total.adminFund} currency={total.currency} whole />}
                />
                <StatBox
                  label={t("portfolio.capitalFund")}
                  value={<Money amount={total.capitalWorksFund} currency={total.currency} whole />}
                />
                <StatBox
                  label={t("portfolio.outstanding")}
                  value={<Money amount={total.totalOutstanding} currency={total.currency} whole />}
                />
                <StatBox
                  label={t("portfolio.overdue")}
                  tone={total.totalOverdue > 0 ? "warn" : "ok"}
                  value={<Money amount={total.totalOverdue} currency={total.currency} whole />}
                />
                <StatBox
                  label={t("portfolio.shortfall")}
                  tone={total.maximumShortfall > 0 ? "danger" : "ok"}
                  value={<Money amount={total.maximumShortfall} currency={total.currency} whole />}
                />
              </StatGrid>
            </section>
          ))}
          <Card>
            <CardHeader title={t("portfolio.rankTitle")} description={t("portfolio.rankBody")} />
            <Table>
              <caption className="sr-only">{t("portfolio.rankTitle")}</caption>
              <THead>
                <TR>
                  <TH>{t("portfolio.scheme")}</TH>
                  <TH>{t("portfolio.attention")}</TH>
                  <TH className="text-end">{t("portfolio.overdue")}</TH>
                  <TH className="text-end">{t("portfolio.lotsInArrears")}</TH>
                  <TH className="text-end">{t("portfolio.flags")}</TH>
                  <TH>{t("portfolio.shortfallFrom")}</TH>
                  <TH>{t("portfolio.data")}</TH>
                </TR>
              </THead>
              <TBody>
                {query.data.schemes.map((row) => (
                  <Row key={row.schemeId} row={row} />
                ))}
              </TBody>
            </Table>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs text-muted">{t("portfolio.attentionDefinition")}</p>
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Row({ row }: { row: PortfolioSchemeRow }) {
  const { t, fmt } = useI18n();
  const tone = row.attentionScore >= 4 ? "danger" : row.attentionScore >= 2 ? "warn" : "ok";
  return (
    <TR>
      <TD>
        <Link
          href={`/schemes/${row.schemeId}`}
          className="font-medium text-brand hover:underline"
          dir="auto"
        >
          {row.title}
        </Link>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          <span dir="ltr">{row.jurisdictionCode}</span>
          <EnumBadge group="schemeRole" value={row.role} />
        </span>
      </TD>
      <TD>
        <Badge tone={tone}>{t("portfolio.score", { score: row.attentionScore })}</Badge>
      </TD>
      <TD className="text-end">
        <Money amount={row.totalOverdue} currency={row.currency} whole />
      </TD>
      <TD className="text-end">{fmt.integer(row.lotsInArrears)}</TD>
      <TD className="text-end">{fmt.integer(row.openExpenseFlags)}</TD>
      <TD>
        {row.firstShortfallYear
          ? fmt.fiscalYear(row.firstShortfallYear)
          : t("portfolio.noShortfall")}
      </TD>
      <TD className="text-xs">
        {row.latestVerifiedDate ? fmt.date(row.latestVerifiedDate) : t("portfolio.noData")}
        {row.hasUnverifiedData ? (
          <Badge tone="warn" className="ms-1">
            {t("portfolio.unverified")}
          </Badge>
        ) : null}
      </TD>
    </TR>
  );
}
