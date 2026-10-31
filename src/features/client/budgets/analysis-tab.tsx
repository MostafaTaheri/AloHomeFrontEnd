"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { DateField } from "@/components/forms/date-field";
import { Definition, FreshnessBanner } from "@/components/finance/freshness";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { StatBox, StatGrid } from "@/components/finance/stat";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { hasErrorCode } from "@/lib/api/error";
import {
  budgetsApi,
  type BudgetVarianceLine,
  type BudgetVsActual,
} from "@/lib/api/finance/budgets";
import { qk } from "@/lib/api/keys";
import { useUrlState } from "@/lib/use-url-state";
import { SourceRecordsButton } from "../records/records-dialog";
import { useScheme } from "../workspace/scheme-provider";
import { parseTolerance } from "./parse";

/** Budget against actual (BUD-04) or the variance findings that explain it (BUD-05). */
export function AnalysisTab({ mode }: { mode: "actual" | "variance" }) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const { params, update } = useUrlState();
  const asOf = params.get("asOf") ?? "";
  const [tolerance, setTolerance] = useState(params.get("tolerance") ?? "");
  const parsedTolerance = parseTolerance(tolerance);
  const query = {
    asOf: asOf || undefined,
    tolerancePercent: parseTolerance(params.get("tolerance") ?? "") ?? undefined,
  };

  const actual = useQuery({
    queryKey: qk.budgetVsActual(schemeId, query),
    queryFn: ({ signal }) => budgetsApi.vsActual(schemeId, query, { signal }),
    enabled: mode === "actual",
    retry: (count, error) => !hasErrorCode(error, 430010) && count < 2,
  });
  const variance = useQuery({
    queryKey: qk.budgetVariance(schemeId, query),
    queryFn: ({ signal }) => budgetsApi.variance(schemeId, query, { signal }),
    enabled: mode === "variance",
    retry: (count, error) => !hasErrorCode(error, 430010) && count < 2,
  });
  const active = mode === "actual" ? actual : variance;
  const summary = mode === "actual" ? actual.data : variance.data?.summary;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Field id="bva-asof" label={t("budgets.asOf")}>
            <DateField id="bva-asof" value={asOf} onChange={(v) => update({ asOf: v || null })} />
          </Field>
        </div>
        <div className="w-36">
          <Field
            id="bva-tolerance"
            label={t("budgets.tolerance")}
            hint={t("budgets.toleranceHint")}
            error={parsedTolerance === null ? t("budgets.toleranceInvalid") : undefined}
          >
            <Input
              id="bva-tolerance"
              dir="ltr"
              inputMode="decimal"
              value={tolerance}
              invalid={parsedTolerance === null}
              onChange={(e) => setTolerance(e.target.value)}
              onBlur={() => {
                if (parsedTolerance !== null) update({ tolerance: tolerance.trim() || null });
              }}
            />
          </Field>
        </div>
      </div>

      {active.isPending ? <ListSkeleton rows={4} /> : null}
      {active.isError && hasErrorCode(active.error, 430010) ? (
        <EmptyState
          title={t("budgets.noApprovedTitle")}
          body={t("budgets.noApprovedBody")}
          action={
            <Link href={`/schemes/${schemeId}/budgets`} className="text-brand hover:underline">
              {t("budgets.goVersions")}
            </Link>
          }
        />
      ) : active.isError ? (
        <ErrorState error={active.error} onRetry={() => void active.refetch()} />
      ) : null}

      {summary ? <Summary summary={summary} /> : null}
      {mode === "actual" && actual.data ? <LinesTable summary={actual.data} /> : null}
      {mode === "variance" && variance.data ? (
        variance.data.findings.length === 0 ? (
          <EmptyState title={t("budgets.noFindingsTitle")} body={t("budgets.noFindingsBody")} />
        ) : (
          <ul className="space-y-3">
            {variance.data.findings.map((f, i) => (
              <li key={f.line.lineId ?? `${f.line.categoryId}-${i}`}>
                <Card>
                  <CardBody className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <EnumBadge group="varianceStatus" value={f.line.status} />
                      <span className="font-medium" dir="auto">
                        {f.line.category ?? t("expenses.uncategorised")}
                      </span>
                      <span className="text-xs text-muted" dir="auto">
                        {f.line.fund}
                      </span>
                      <span className="ms-auto font-semibold">
                        <Money amount={f.line.variance} currency={summary?.currency} signed />
                      </span>
                    </div>
                    <p className="text-sm" dir="auto">
                      {f.explanation}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{t("budgets.ruleBased")}</Badge>
                      <SourceRecordsButton
                        recordIds={f.topRecordIds}
                        title={t("budgets.recordsTitle", {
                          name: f.line.category ?? t("expenses.uncategorised"),
                        })}
                      />
                    </div>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

function Summary({ summary }: { summary: BudgetVsActual }) {
  const { t, fmt } = useI18n();
  const over = summary.totalVariance > 0;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {t("budgets.summaryLine", {
          name: summary.budgetName,
          n: summary.budgetVersion,
          year: fmt.fiscalYear(summary.fiscalYear),
          periods: summary.periodsElapsed,
          date: fmt.date(summary.asOf),
          tolerance: fmt.percent(summary.tolerancePercent),
        })}
      </p>
      <FreshnessBanner freshness={summary.freshness} />
      <StatGrid className="xl:grid-cols-5">
        <StatBox
          label={t("budgets.annualBudget")}
          value={<Money amount={summary.totalAnnualBudget} currency={summary.currency} whole />}
        />
        <StatBox
          label={t("budgets.budgetToDate")}
          value={<Money amount={summary.totalBudgetToDate} currency={summary.currency} whole />}
        />
        <StatBox
          label={t("budgets.actualToDate")}
          value={<Money amount={summary.totalActualToDate} currency={summary.currency} whole />}
        />
        <StatBox
          label={t("budgets.variance")}
          tone={over ? "danger" : "ok"}
          value={<Money amount={summary.totalVariance} currency={summary.currency} signed whole />}
          hint={over ? t("budgets.overHint") : t("budgets.underHint")}
        />
        <StatBox
          label={t("budgets.forecast")}
          value={<Money amount={summary.totalForecast} currency={summary.currency} whole />}
        />
      </StatGrid>
      <Definition text={summary.definition} />
      {summary.disclaimer ? <p className="text-xs text-muted">{summary.disclaimer}</p> : null}
    </div>
  );
}

function LinesTable({ summary }: { summary: BudgetVsActual }) {
  const { t, fmt } = useI18n();
  const name = (line: BudgetVarianceLine) => line.category ?? t("expenses.uncategorised");
  return (
    <Card>
      <CardHeader title={t("budgets.byLine")} />
      <Table>
        <caption className="sr-only">{t("budgets.byLine")}</caption>
        <THead>
          <TR>
            <TH>{t("common.category")}</TH>
            <TH>{t("common.fund")}</TH>
            <TH className="text-end">{t("budgets.budgetToDate")}</TH>
            <TH className="text-end">{t("budgets.actualToDate")}</TH>
            <TH className="text-end">{t("budgets.variance")}</TH>
            <TH>{t("common.status")}</TH>
            <TH className="text-end">{t("budgets.forecast")}</TH>
            <TH>
              <span className="sr-only">{t("history.open")}</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {summary.lines.map((line, i) => (
            <TR key={line.lineId ?? `u-${i}`}>
              <TD dir="auto">{name(line)}</TD>
              <TD dir="auto" className="text-muted">
                {line.fund}
              </TD>
              <TD className="text-end">
                <Money amount={line.budgetToDate} currency={summary.currency} whole />
              </TD>
              <TD className="text-end">
                <Money amount={line.actualToDate} currency={summary.currency} whole />
              </TD>
              <TD className="text-end">
                <Money amount={line.variance} currency={summary.currency} signed whole />
                {line.variancePercent !== null ? (
                  <span className="block text-xs text-muted">
                    {fmt.percent(line.variancePercent, { signed: true })}
                  </span>
                ) : null}
              </TD>
              <TD>
                <EnumBadge group="varianceStatus" value={line.status} />
              </TD>
              <TD className="text-end">
                <Money amount={line.forecastFullYear} currency={summary.currency} whole />
              </TD>
              <TD className="text-end">
                <SourceRecordsButton
                  recordIds={line.recordIds}
                  title={t("budgets.recordsTitle", { name: name(line) })}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
