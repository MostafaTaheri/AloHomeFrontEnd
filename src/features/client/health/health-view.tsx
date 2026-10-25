"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { HBarList } from "@/components/charts/hbar-list";
import { SeriesChart } from "@/components/charts/series-chart";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money, PercentChange } from "@/components/finance/money";
import { StatBox, StatGrid } from "@/components/finance/stat";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/i18n/provider";
import type { FinancialHealth, MonthlySummary } from "@/lib/api/finance/types";

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-brand hover:underline">
      {children}
    </Link>
  );
}

/**
 * The financial health dashboard body. Purely presentational: it renders a FinancialHealth
 * object whether it came from the live endpoint or from a report snapshot, so a report always
 * looks like the dashboard it was taken from. `schemeId` null disables the drill-down links
 * (report snapshots).
 */
export function FinancialHealthView({
  data,
  schemeId,
}: {
  data: FinancialHealth;
  schemeId: number | null;
}) {
  const { t, fmt } = useI18n();
  const cur = data.currency;
  const link = (path: string) => (schemeId === null ? null : `/schemes/${schemeId}/${path}`);
  const arrearsLink = link("arrears");
  const expensesLink = link("expenses");
  const capitalLink = link("capital-works");

  const trend = data.expenseTrend;
  const actions = [...data.recommendedActions].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-6">
      <StatGrid>
        <StatBox
          label={data.adminFund.label}
          value={<Money amount={data.adminFund.balance} currency={cur} whole tone="balance" />}
          hint={t("health.balance")}
          tone={data.adminFund.balance < 0 ? "danger" : "neutral"}
        />
        <StatBox
          label={data.capitalWorksFund.label}
          value={
            <Money amount={data.capitalWorksFund.balance} currency={cur} whole tone="balance" />
          }
          hint={t("health.balance")}
          tone={data.capitalWorksFund.balance < 0 ? "danger" : "neutral"}
        />
        <StatBox
          label={t("health.totalOverdue")}
          value={<Money amount={data.arrears.totalOverdue} currency={cur} whole />}
          hint={`${t("health.lotsInArrears")}: ${fmt.integer(data.arrears.lotsInArrears)}`}
          tone={data.arrears.totalOverdue > 0 ? "warn" : "ok"}
        />
        <StatBox
          label={t("health.currentSpend")}
          value={<Money amount={data.currentPeriodSpend} currency={cur} whole />}
          hint={
            <span className="flex items-center gap-1">
              {t("health.spendChange")}:{" "}
              <PercentChange
                value={data.spendChangePercentMoM}
                notMeaningful={data.spendChangeNotMeaningful}
              />
            </span>
          }
        />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t("health.arrearsTitle")}
            actions={
              arrearsLink ? (
                <SectionLink href={arrearsLink}>{t("health.viewArrears")}</SectionLink>
              ) : null
            }
          />
          <CardBody className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">{t("health.totalOutstanding")}</dt>
                <dd className="font-semibold">
                  <Money amount={data.arrears.totalOutstanding} currency={cur} whole />
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t("health.projectedShortfall")}</dt>
                <dd className="font-semibold">
                  {data.arrears.projectedNextQuarterShortfall &&
                  data.arrears.projectedNextQuarterShortfall > 0 ? (
                    <Money
                      amount={data.arrears.projectedNextQuarterShortfall}
                      currency={cur}
                      whole
                    />
                  ) : (
                    <span className="text-ok">{t("health.noShortfall")}</span>
                  )}
                </dd>
              </div>
            </dl>
            <div>
              <p className="mb-1 text-xs font-medium text-muted">{t("health.ageing")}</p>
              <HBarList
                seriesIndex={1}
                items={data.arrears.buckets.map((b) => ({
                  key: b.label,
                  label: b.label,
                  value: b.amount,
                  display: <Money amount={b.amount} currency={cur} whole />,
                }))}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t("health.spendTitle")}
            actions={
              expensesLink ? (
                <SectionLink href={expensesLink}>{t("health.viewExpenses")}</SectionLink>
              ) : null
            }
          />
          <CardBody>
            {trend.length > 0 ? (
              <SeriesChart
                kind="column"
                title={t("health.spendTrend")}
                labels={trend.map((p) => p.periodLabel)}
                formatLabel={fmt.periodShort}
                series={[{ name: t("health.spendTrend"), values: trend.map((p) => p.amount) }]}
                formatValue={(v) => fmt.money(v, cur, { whole: true })}
              />
            ) : (
              <p className="text-sm text-muted">{t("data.noData")}</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={t("health.capitalTitle")}
          actions={
            capitalLink ? (
              <SectionLink href={capitalLink}>{t("health.viewCapital")}</SectionLink>
            ) : null
          }
        />
        <CardBody>
          {data.capitalWorks.hasBaselineScenario ? (
            <StatGrid>
              <StatBox
                label={t("health.baselineScenario")}
                value={data.capitalWorks.baselineScenario ?? t("common.none")}
              />
              <StatBox
                label={t("health.firstShortfall")}
                value={
                  data.capitalWorks.firstShortfallYear !== null
                    ? fmt.fiscalYear(data.capitalWorks.firstShortfallYear)
                    : t("health.noShortfallYear")
                }
                tone={data.capitalWorks.firstShortfallYear !== null ? "danger" : "ok"}
              />
              <StatBox
                label={t("health.maxShortfall")}
                value={<Money amount={data.capitalWorks.maximumShortfall} currency={cur} whole />}
                tone={data.capitalWorks.maximumShortfall > 0 ? "danger" : "neutral"}
              />
              <StatBox
                label={t("health.endingBalance")}
                value={
                  <Money
                    amount={data.capitalWorks.endingBalance}
                    currency={cur}
                    whole
                    tone="balance"
                  />
                }
                hint={`${t("health.plannedItems")}: ${fmt.integer(data.capitalWorks.plannedItems)} · ${t("health.plannedCost")}: ${fmt.money(
                  data.capitalWorks.plannedCostNextFiveYears,
                  cur,
                  { whole: true },
                )}`}
              />
            </StatGrid>
          ) : (
            <p className="text-sm text-muted">{t("health.noBaseline")}</p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t("health.abnormalTitle")}
            actions={
              expensesLink ? (
                <SectionLink href={`${expensesLink}?tab=flags`}>
                  {t("health.viewFlags")}
                </SectionLink>
              ) : null
            }
          />
          <CardBody>
            {data.abnormalExpenses.length === 0 ? (
              <p className="text-sm text-muted">{t("health.abnormalEmpty")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.abnormalExpenses.map((item) => (
                  <li
                    key={item.flagId}
                    className="flex flex-wrap items-start justify-between gap-2 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted">
                        <EnumBadge group="flagType" value={item.type} /> ·{" "}
                        {fmt.periodLabel(item.periodLabel)}
                      </p>
                    </div>
                    <div className="text-end text-sm">
                      <Money amount={item.observedAmount} currency={cur} whole />
                      <p className="text-xs text-muted">
                        {t("health.annualised", {
                          amount: fmt.money(item.estimatedAnnualisedImpact, cur, { whole: true }),
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t("health.risksTitle")}
            actions={
              arrearsLink ? (
                <SectionLink href={`${arrearsLink}?tab=risk`}>{t("health.viewRisks")}</SectionLink>
              ) : null
            }
          />
          <CardBody>
            {data.topRisks.length === 0 ? (
              <p className="text-sm text-muted">{t("health.risksEmpty")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.topRisks.map((risk) => (
                  <li
                    key={risk.lotId}
                    className="flex flex-wrap items-start justify-between gap-2 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium">{risk.lot}</p>
                      <p className="text-xs text-muted">
                        {t("health.riskLine", { score: risk.score, days: risk.daysOverdue })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <EnumBadge group="riskLevel" value={risk.level} />
                      <Money amount={risk.overdue} currency={cur} whole />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("health.actionsTitle")} />
        <CardBody>
          {actions.length === 0 ? (
            <p className="text-sm text-muted">{t("health.actionsEmpty")}</p>
          ) : (
            <ol className="space-y-2">
              {actions.map((a, i) => (
                <li key={a.code} className="flex gap-3 text-sm">
                  <Badge tone={i === 0 ? "warn" : "neutral"}>{fmt.integer(i + 1)}</Badge>
                  <span>{a.text}</span>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export function MonthlySummaryView({ data }: { data: MonthlySummary }) {
  const { t, fmt } = useI18n();
  const cur = data.currency;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {t("health.monthlyPeriod")}: {fmt.periodLabel(data.periodLabel)} (
        {fmt.date(data.periodStart)} – {fmt.date(data.periodEnd)})
      </p>
      <StatGrid>
        <StatBox
          label={t("health.levies")}
          value={<Money amount={data.leviesRaised} currency={cur} whole />}
        />
        <StatBox
          label={t("health.payments")}
          value={<Money amount={data.paymentsReceived} currency={cur} whole />}
        />
        <StatBox
          label={t("health.expenses")}
          value={<Money amount={data.expenses} currency={cur} whole />}
        />
        <StatBox
          label={t("health.netCash")}
          value={<Money amount={data.netCashFlow} currency={cur} whole signed tone="balance" />}
          tone={data.netCashFlow < 0 ? "danger" : "ok"}
        />
        <StatBox
          label={t("health.overdueEnd")}
          value={<Money amount={data.overdueAtPeriodEnd} currency={cur} whole />}
        />
        <StatBox
          label={t("health.overduePrev")}
          value={<Money amount={data.overdueAtPreviousPeriodEnd} currency={cur} whole />}
        />
        <StatBox label={t("health.flagsDetected")} value={fmt.integer(data.flagsDetected)} />
      </StatGrid>
      {data.topCategories.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted">{t("health.topCategories")}</p>
          <HBarList
            items={data.topCategories.map((c) => ({
              key: c.category,
              label: c.category,
              value: c.amount,
              display: <Money amount={c.amount} currency={cur} whole />,
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}
