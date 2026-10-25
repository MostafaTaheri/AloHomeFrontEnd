"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { HBarList } from "@/components/charts/hbar-list";
import { SeriesChart } from "@/components/charts/series-chart";
import { DateField } from "@/components/forms/date-field";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Definition, FreshnessBanner } from "@/components/finance/freshness";
import { Money, PercentChange } from "@/components/finance/money";
import { StatBox, StatGrid } from "@/components/finance/stat";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { expensesApi, financeApi, type FundFilter } from "@/lib/api/finance/endpoints";
import type { Comparison, SpendBreakdownItem } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { isRangeOrdered, lastMonthsRange, todayIso } from "@/lib/region/dates";
import { isGuid } from "@/lib/scheme-id";
import { useScheme } from "../workspace/scheme-provider";
import { useLookups } from "./lookups";

type Group = "Month" | "Category" | "Supplier";
interface Range {
  from: string;
  to: string;
}
interface Drill {
  label: string;
  from: string;
  to: string;
  categoryId?: string;
  supplierId?: string;
}

const EXPENSE_RECORD_TYPE = 1;

export function SpendTab() {
  const { t, fmt } = useI18n();
  const { schemeId, adminFundLabel, capitalWorksFundLabel } = useScheme();
  const { calendar, timeZone } = fmt.context;

  const initial = useMemo<Range>(() => {
    const today = todayIso(timeZone);
    return lastMonthsRange(today, 12, calendar) ?? { from: today, to: today };
  }, [calendar, timeZone]);

  const [group, setGroup] = useState<Group>("Category");
  const [fund, setFund] = useState<FundFilter>(undefined);
  const [draft, setDraft] = useState<Range>(initial);
  const [range, setRange] = useState<Range>(initial);
  const [drill, setDrill] = useState<Drill | null>(null);

  const rangeValid = Boolean(draft.from && draft.to && isRangeOrdered(draft.from, draft.to));

  const spend = useQuery({
    queryKey: qk.spend(schemeId, { group, fund, ...range }),
    queryFn: ({ signal }) =>
      expensesApi.spend(schemeId, { groupBy: group, fund, ...range }, { signal }),
    placeholderData: (previous) => previous,
  });
  const monthly = useQuery({
    queryKey: qk.spend(schemeId, { group: "Month", fund, ...range }),
    queryFn: ({ signal }) =>
      expensesApi.spend(schemeId, { groupBy: "Month", fund, ...range }, { signal }),
    enabled: group !== "Month",
    placeholderData: (previous) => previous,
  });
  const comparison = useQuery({
    queryKey: qk.comparison(schemeId, { fund }),
    queryFn: ({ signal }) => expensesApi.comparison(schemeId, { fund }, { signal }),
  });

  const trend = group === "Month" ? spend.data : monthly.data;
  const cur = spend.data?.currency ?? "";

  function select(item: SpendBreakdownItem) {
    if (group === "Month") {
      if (item.periodStart && item.periodEnd)
        setDrill({ label: item.label, from: item.periodStart, to: item.periodEnd });
      return;
    }
    const base = { label: item.label, from: range.from, to: range.to };
    if (!isGuid(item.key)) return;
    setDrill(
      group === "Category" ? { ...base, categoryId: item.key } : { ...base, supplierId: item.key },
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (rangeValid) {
                setRange(draft);
                setDrill(null);
              }
            }}
          >
            <div className="w-44">
              <Field id="spend-group" label={t("expenses.groupBy")}>
                <Select
                  id="spend-group"
                  value={group}
                  onChange={(e) => {
                    setGroup(e.target.value as Group);
                    setDrill(null);
                  }}
                >
                  <option value="Month">{t("expenses.groupMonth")}</option>
                  <option value="Category">{t("expenses.groupCategory")}</option>
                  <option value="Supplier">{t("expenses.groupSupplier")}</option>
                </Select>
              </Field>
            </div>
            <div className="w-52">
              <Field id="spend-fund" label={t("expenses.fund")}>
                <Select
                  id="spend-fund"
                  value={fund ?? ""}
                  onChange={(e) => {
                    setFund((e.target.value || undefined) as FundFilter);
                    setDrill(null);
                  }}
                >
                  <option value="">{t("expenses.fundAll")}</option>
                  <option value="Admin">{adminFundLabel}</option>
                  <option value="CapitalWorks">{capitalWorksFundLabel}</option>
                </Select>
              </Field>
            </div>
            <Field id="spend-from" label={t("expenses.from")}>
              <DateField
                id="spend-from"
                value={draft.from}
                onChange={(v) => setDraft((d) => ({ ...d, from: v }))}
                invalid={!rangeValid}
              />
            </Field>
            <Field id="spend-to" label={t("expenses.to")}>
              <DateField
                id="spend-to"
                value={draft.to}
                onChange={(v) => setDraft((d) => ({ ...d, to: v }))}
                invalid={!rangeValid}
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={!rangeValid}>
              {t("expenses.apply")}
            </Button>
          </form>
          {!rangeValid ? (
            <p role="alert" className="mt-2 text-xs font-medium text-danger">
              {t("expenses.rangeInvalid")}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {spend.isPending ? <ListSkeleton rows={6} /> : null}
      {spend.isError ? (
        <ErrorState error={spend.error} onRetry={() => void spend.refetch()} />
      ) : null}

      {spend.data ? (
        <>
          <FreshnessBanner freshness={spend.data.freshness} />
          {spend.data.recordCount === 0 ? (
            <EmptyState title={t("data.noData")} />
          ) : (
            <>
              <StatGrid>
                <StatBox
                  label={t("expenses.total")}
                  value={<Money amount={spend.data.total} currency={cur} whole />}
                />
                <StatBox
                  label={t("expenses.recordCount", { count: fmt.integer(spend.data.recordCount) })}
                  value={fmt.integer(spend.data.recordCount)}
                />
              </StatGrid>

              {trend && trend.items.length > 0 ? (
                <Card>
                  <CardBody>
                    <SeriesChart
                      kind="column"
                      title={t("expenses.spendChartTitle")}
                      labels={trend.items.map((i) => i.key)}
                      formatLabel={fmt.periodShort}
                      series={[
                        {
                          name: t("expenses.spendChartTitle"),
                          values: trend.items.map((i) => i.amount),
                        },
                      ]}
                      formatValue={(v) => fmt.money(v, cur, { whole: true })}
                    />
                  </CardBody>
                </Card>
              ) : null}

              <Card>
                <CardHeader title={t("expenses.breakdownTitle")} />
                <CardBody>
                  <HBarList
                    seriesIndex={group === "Month" ? 0 : group === "Category" ? 2 : 3}
                    selectedKey={
                      drill?.label
                        ? spend.data.items.find((i) => i.label === drill.label)?.key
                        : null
                    }
                    onSelect={(key) => {
                      const item = spend.data.items.find((i) => i.key === key);
                      if (item) select(item);
                    }}
                    items={spend.data.items.map((i) => ({
                      key: i.key,
                      label: group === "Month" ? fmt.periodLabel(i.key) : i.label,
                      value: i.amount,
                      sub: `${t("expenses.share", { percent: fmt.percent(i.sharePercent) })} · ${t("expenses.recordCount", { count: fmt.integer(i.recordCount) })}`,
                      display: <Money amount={i.amount} currency={cur} whole />,
                    }))}
                  />
                  <p className="mt-2 text-xs text-muted">{t("expenses.drill")}</p>
                  <Definition text={spend.data.definition} />
                </CardBody>
              </Card>
            </>
          )}
        </>
      ) : null}

      {drill ? <RecordsCard drill={drill} fund={fund} onClose={() => setDrill(null)} /> : null}

      <ComparisonCard query={comparison} />
    </div>
  );
}

function RecordsCard({
  drill,
  fund,
  onClose,
}: {
  drill: Drill;
  fund: FundFilter;
  onClose: () => void;
}) {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const lookups = useLookups();
  const [page, setPage] = useState(1);

  const params = {
    recordType: EXPENSE_RECORD_TYPE,
    fund,
    from: drill.from,
    to: drill.to,
    categoryId: drill.categoryId,
    supplierId: drill.supplierId,
    page,
    pageSize: 20,
  };
  const query = useQuery({
    queryKey: qk.records(schemeId, params),
    queryFn: ({ signal }) => financeApi.records(schemeId, params, { signal }),
    placeholderData: (previous) => previous,
  });

  return (
    <Card>
      <CardHeader
        title={t("expenses.drillTitle", { label: drill.label })}
        actions={
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t("expenses.drillClear")}
          </Button>
        }
      />
      {query.isPending ? (
        <CardBody>
          <ListSkeleton rows={4} />
        </CardBody>
      ) : null}
      {query.isError ? (
        <CardBody>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </CardBody>
      ) : null}
      {query.data && query.data.records.items.length === 0 ? (
        <CardBody>
          <p className="text-sm text-muted">{t("expenses.recordsEmpty")}</p>
        </CardBody>
      ) : null}
      {query.data && query.data.records.items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t("expenses.colDate")}</TH>
                  <TH>{t("expenses.colDescription")}</TH>
                  <TH>{t("expenses.colSupplier")}</TH>
                  <TH>{t("expenses.colCategory")}</TH>
                  <TH>{t("expenses.colAmount")}</TH>
                  <TH>{t("expenses.colStatus")}</TH>
                </TR>
              </THead>
              <TBody>
                {query.data.records.items.map((r) => (
                  <TR key={r.id}>
                    <TD>{fmt.date(r.transactionDate)}</TD>
                    <TD dir="auto" className="max-w-64 truncate">
                      {r.description ?? r.externalReference ?? t("common.none")}
                    </TD>
                    <TD>{lookups.supplierName(r.supplierId) ?? t("expenses.unknownSupplier")}</TD>
                    <TD>{lookups.categoryName(r.categoryId) ?? t("expenses.uncategorised")}</TD>
                    <TD>
                      <Money amount={r.amount} currency={r.currency} />
                    </TD>
                    <TD>
                      <EnumBadge group="recordStatus" value={r.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <Pagination
            page={query.data.records.page}
            totalPages={query.data.records.totalPages}
            totalCount={query.data.records.totalCount}
            onPageChange={setPage}
            disabled={query.isFetching}
          />
        </>
      ) : null}
    </Card>
  );
}

function ComparisonCard({
  query,
}: {
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof expensesApi.comparison>>>>;
}) {
  const { t, fmt } = useI18n();
  return (
    <Card>
      <CardHeader
        title={t("expenses.comparisonTitle")}
        description={query.data ? fmt.periodLabel(query.data.periodLabel) : undefined}
      />
      <CardBody className="space-y-4">
        {query.isPending ? <ListSkeleton rows={3} /> : null}
        {query.isError ? (
          <InlineAlert tone="danger">{t("expenses.sectionFailed")}</InlineAlert>
        ) : null}
        {query.data ? (
          <>
            <FreshnessBanner freshness={query.data.freshness} />
            <div className="grid gap-4 sm:grid-cols-2">
              <ComparisonBox
                title={t("expenses.monthOverMonth", {
                  period: fmt.periodLabel(query.data.previousPeriodLabel),
                })}
                value={query.data.monthOverMonth}
                currency={query.data.currency}
                definition={query.data.monthOverMonthDefinition}
              />
              <ComparisonBox
                title={t("expenses.yearOverYear", {
                  period: fmt.periodLabel(query.data.samePeriodLastYearLabel),
                })}
                value={query.data.yearOverYear}
                currency={query.data.currency}
                definition={query.data.yearOverYearDefinition}
              />
            </div>
            {query.data.byCategory.length > 0 ? (
              <div className="overflow-x-auto">
                <h3 className="mb-2 text-sm font-semibold">{t("expenses.byCategoryTitle")}</h3>
                <Table>
                  <THead>
                    <TR>
                      <TH>{t("expenses.colCategory")}</TH>
                      <TH>{t("expenses.current")}</TH>
                      <TH>
                        {t("expenses.monthOverMonth", {
                          period: fmt.periodShort(query.data.previousPeriodLabel),
                        })}
                      </TH>
                      <TH>
                        {t("expenses.yearOverYear", {
                          period: fmt.periodShort(query.data.samePeriodLastYearLabel),
                        })}
                      </TH>
                    </TR>
                  </THead>
                  <TBody>
                    {query.data.byCategory.map((c) => (
                      <TR key={c.categoryId ?? c.category}>
                        <TD>{c.category}</TD>
                        <TD>
                          <Money
                            amount={c.monthOverMonth.current}
                            currency={query.data.currency}
                            whole
                          />
                        </TD>
                        <TD>
                          <PercentChange
                            value={c.monthOverMonth.changePercent}
                            notMeaningful={c.monthOverMonth.notMeaningful}
                            reason={c.monthOverMonth.notMeaningfulReason}
                          />
                        </TD>
                        <TD>
                          <PercentChange
                            value={c.yearOverYear.changePercent}
                            notMeaningful={c.yearOverYear.notMeaningful}
                            reason={c.yearOverYear.notMeaningfulReason}
                          />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            ) : null}
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}

function ComparisonBox({
  title,
  value,
  currency,
  definition,
}: {
  title: string;
  value: Comparison;
  currency: string;
  definition: string;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-md border border-line p-3">
      <p className="text-xs font-medium text-muted">{title}</p>
      <p className="mt-1 text-lg font-semibold">
        <Money amount={value.current} currency={currency} whole />
      </p>
      <p className="text-sm text-muted">
        {t("expenses.previous")}: <Money amount={value.previous} currency={currency} whole />
      </p>
      <p className="text-sm">
        {t("expenses.change")}:{" "}
        <PercentChange
          value={value.changePercent}
          notMeaningful={value.notMeaningful}
          reason={value.notMeaningfulReason}
        />
      </p>
      <Definition text={definition} />
    </div>
  );
}
