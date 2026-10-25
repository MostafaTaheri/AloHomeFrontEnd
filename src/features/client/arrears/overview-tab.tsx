"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { HBarList } from "@/components/charts/hbar-list";
import { SeriesChart } from "@/components/charts/series-chart";
import { DateField } from "@/components/forms/date-field";
import { Definition, FreshnessBanner } from "@/components/finance/freshness";
import { Money } from "@/components/finance/money";
import { StatBox, StatGrid } from "@/components/finance/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { arrearsApi } from "@/lib/api/finance/endpoints";
import { qk } from "@/lib/api/keys";
import { useScheme } from "../workspace/scheme-provider";
import { LotHistoryDialog } from "./lot-history-dialog";

export function OverviewTab() {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const [asOfInput, setAsOfInput] = useState("");
  const [asOf, setAsOf] = useState<string | undefined>();
  const [onlyArrears, setOnlyArrears] = useState(true);
  const [historyLot, setHistoryLot] = useState<{ id: number; name: string } | null>(null);

  const summary = useQuery({
    queryKey: qk.arrearsSummary(schemeId, asOf),
    queryFn: ({ signal }) => arrearsApi.summary(schemeId, asOf, { signal }),
  });
  const trend = useQuery({
    queryKey: qk.arrearsTrend(schemeId),
    queryFn: ({ signal }) => arrearsApi.trend(schemeId, 12, { signal }),
  });
  const lotsParams = { asOf, onlyInArrears: onlyArrears };
  const lots = useQuery({
    queryKey: qk.arrearsLots(schemeId, lotsParams),
    queryFn: ({ signal }) => arrearsApi.lots(schemeId, lotsParams, { signal }),
  });

  const data = summary.data;
  const cur = data?.currency ?? "";

  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setAsOf(asOfInput || undefined);
        }}
      >
        <Field id="arrears-asof" label={t("arrears.asOf")}>
          <DateField id="arrears-asof" value={asOfInput} onChange={setAsOfInput} />
        </Field>
        <Button type="submit" variant="secondary" disabled={asOfInput === (asOf ?? "")}>
          {t("arrears.apply")}
        </Button>
      </form>

      {summary.isPending ? <ListSkeleton rows={5} /> : null}
      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : null}

      {data ? (
        <>
          <FreshnessBanner freshness={data.freshness} incomplete={data.incompleteOrEstimatedData} />
          <StatGrid>
            <StatBox
              label={t("arrears.totalOverdue")}
              value={<Money amount={data.totalOverdue} currency={cur} whole />}
              tone={data.totalOverdue > 0 ? "warn" : "neutral"}
            />
            <StatBox
              label={t("arrears.totalOutstanding")}
              value={<Money amount={data.totalOutstanding} currency={cur} whole />}
            />
            <StatBox
              label={t("arrears.notYetDue")}
              value={<Money amount={data.totalNotYetDue} currency={cur} whole />}
            />
            <StatBox
              label={t("arrears.lotsInArrears")}
              value={fmt.integer(data.lotsInArrears)}
              hint={t("arrears.lotsOf", {
                count: fmt.integer(data.lotsInArrears),
                total: fmt.integer(data.lotsTotal),
              })}
            />
          </StatGrid>
          {data.totalCredit > 0 ? (
            <p className="text-sm text-muted">
              {t("arrears.credit")}: <Money amount={data.totalCredit} currency={cur} whole />
            </p>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title={t("arrears.bucketsTitle")} />
              <CardBody>
                <HBarList
                  seriesIndex={1}
                  items={data.buckets.map((b) => ({
                    key: b.label,
                    label: b.label,
                    value: b.amount,
                    display: <Money amount={b.amount} currency={cur} whole />,
                  }))}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title={t("arrears.concentrationTitle")}
                description={t("arrears.concentrationHint")}
              />
              <CardBody>
                {data.concentration.length === 0 ? (
                  <p className="text-sm text-muted">{t("data.noData")}</p>
                ) : (
                  <Table>
                    <THead>
                      <TR>
                        <TH>{t("arrears.colLot")}</TH>
                        <TH>{t("arrears.colOverdue")}</TH>
                        <TH>{t("arrears.colShare")}</TH>
                        <TH>{t("arrears.colCumulative")}</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {data.concentration.map((c) => (
                        <TR key={c.lotId}>
                          <TD>{c.lot}</TD>
                          <TD>
                            <Money amount={c.overdue} currency={cur} whole />
                          </TD>
                          <TD>{fmt.percent(c.sharePercent)}</TD>
                          <TD>{fmt.percent(c.cumulativeSharePercent)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardBody>
            </Card>
          </div>

          {data.cashFlowImpact ? (
            <Card>
              <CardHeader
                title={t("arrears.cashTitle")}
                description={t("arrears.cashBasis", { periods: data.cashFlowImpact.basisPeriods })}
              />
              <CardBody className="space-y-3">
                {data.cashFlowImpact.notMeaningful ? (
                  <InlineAlert tone="warn">{t("arrears.cashNotMeaningful")}</InlineAlert>
                ) : (
                  <StatGrid>
                    <StatBox
                      label={t("arrears.collectionRate")}
                      value={
                        data.cashFlowImpact.collectionRatePercent === null
                          ? t("data.notMeaningful")
                          : fmt.percent(data.cashFlowImpact.collectionRatePercent)
                      }
                    />
                    <StatBox
                      label={t("arrears.leviesRaised")}
                      value={
                        <Money amount={data.cashFlowImpact.leviesRaised} currency={cur} whole />
                      }
                    />
                    <StatBox
                      label={t("arrears.paymentsReceived")}
                      value={
                        <Money amount={data.cashFlowImpact.paymentsReceived} currency={cur} whole />
                      }
                    />
                    <StatBox
                      label={t("arrears.projectedShortfall")}
                      tone={(data.cashFlowImpact.projectedShortfall ?? 0) > 0 ? "danger" : "ok"}
                      value={
                        <Money
                          amount={data.cashFlowImpact.projectedShortfall}
                          currency={cur}
                          whole
                        />
                      }
                    />
                  </StatGrid>
                )}
                <Definition text={data.cashFlowImpact.definition} />
              </CardBody>
            </Card>
          ) : null}
          <Definition text={data.definition} />
        </>
      ) : null}

      {trend.data && trend.data.points.length > 0 ? (
        <Card>
          <CardBody>
            <SeriesChart
              kind="line"
              title={t("arrears.trendTitle")}
              labels={trend.data.points.map((p) => p.periodLabel)}
              formatLabel={fmt.periodShort}
              series={[
                {
                  name: t("arrears.trendOverdue"),
                  values: trend.data.points.map((p) => p.totalOverdue),
                },
                {
                  name: t("arrears.trendOutstanding"),
                  values: trend.data.points.map((p) => p.totalOutstanding),
                },
              ]}
              formatValue={(v) => fmt.money(v, trend.data.currency, { whole: true })}
            />
          </CardBody>
        </Card>
      ) : null}
      {trend.isError ? <InlineAlert tone="warn">{t("data.sectionFailed")}</InlineAlert> : null}

      <Card>
        <CardHeader
          title={t("arrears.lotsTitle")}
          actions={
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyArrears}
                onChange={(e) => setOnlyArrears(e.target.checked)}
              />
              {t("arrears.onlyArrears")}
            </label>
          }
        />
        {lots.isPending ? (
          <CardBody>
            <ListSkeleton rows={4} />
          </CardBody>
        ) : null}
        {lots.isError ? (
          <CardBody>
            <ErrorState error={lots.error} onRetry={() => void lots.refetch()} />
          </CardBody>
        ) : null}
        {lots.data && lots.data.length === 0 ? (
          <CardBody>
            <EmptyState title={t("arrears.lotsEmpty")} />
          </CardBody>
        ) : null}
        {lots.data && lots.data.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t("arrears.colLot")}</TH>
                  <TH>{t("arrears.colBalance")}</TH>
                  <TH>{t("arrears.colOverdue")}</TH>
                  <TH>{t("arrears.colOldest")}</TH>
                  <TH>{t("arrears.colDays")}</TH>
                  <TH>{t("arrears.colPlan")}</TH>
                  <TH>
                    <span className="sr-only">{t("common.actions")}</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {lots.data.map((l) => (
                  <TR key={l.lotId}>
                    <TD className="font-medium">{l.lot}</TD>
                    <TD>
                      <Money amount={l.balance} currency={cur} tone="balance" />
                    </TD>
                    <TD>
                      <Money amount={l.overdue} currency={cur} />
                    </TD>
                    <TD>
                      {l.oldestUnpaidDueDate ? fmt.date(l.oldestUnpaidDueDate) : t("common.none")}
                    </TD>
                    <TD>{fmt.integer(l.daysOverdue)}</TD>
                    <TD>
                      {l.hasPaymentPlan ? (
                        <Badge tone="ok">{t("arrears.planYes")}</Badge>
                      ) : (
                        <Badge>{t("arrears.planNo")}</Badge>
                      )}
                    </TD>
                    <TD>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setHistoryLot({ id: l.lotId, name: l.lot })}
                      >
                        {t("arrears.history")}
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        ) : null}
      </Card>

      <LotHistoryDialog lot={historyLot} onClose={() => setHistoryLot(null)} />
    </div>
  );
}
