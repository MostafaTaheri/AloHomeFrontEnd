"use client";

import { useQuery } from "@tanstack/react-query";
import { HBarList } from "@/components/charts/hbar-list";
import { DateField } from "@/components/forms/date-field";
import { useEnumLabel } from "@/components/finance/enum-badge";
import { StatBox, StatGrid } from "@/components/finance/stat";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { qk } from "@/lib/api/keys";
import { boReadinessApi } from "@/lib/api/readiness";
import { usePageView } from "@/lib/telemetry/client";
import { useUrlState } from "@/lib/use-url-state";

/** The security and privacy evidence pack (GTM-07): controls and the audit trail behind them. */
export function EvidencePage() {
  const { t, fmt } = useI18n();
  const label = useEnumLabel();
  const { params, update } = useUrlState();
  usePageView("backoffice", "evidence");
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const rangeError = Boolean(from && to && from > to);
  const range = { fromUtc: from || undefined, toUtc: to || undefined };

  const query = useQuery({
    queryKey: qk.bo.evidence(range),
    queryFn: ({ signal }) => boReadinessApi.evidence(range, signal),
    enabled: !rangeError,
  });
  const e = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("evidence.title")}
        description={t("evidence.subtitle")}
        actions={
          <Button variant="secondary" onClick={() => window.print()} disabled={!e}>
            {t("evidence.print")}
          </Button>
        }
      />
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="w-44">
          <Field id="ev-from" label={t("common.from")} hint={t("evidence.defaultWindow")}>
            <DateField id="ev-from" value={from} onChange={(v) => update({ from: v || null })} />
          </Field>
        </div>
        <div className="w-44">
          <Field
            id="ev-to"
            label={t("common.to")}
            error={rangeError ? t("audit.rangeInvalid") : undefined}
          >
            <DateField
              id="ev-to"
              value={to}
              invalid={rangeError}
              onChange={(v) => update({ to: v || null })}
            />
          </Field>
        </div>
      </div>
      {query.isPending && !rangeError ? <ListSkeleton rows={4} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {e ? (
        <>
          <p className="text-sm text-muted">
            {t("evidence.window", {
              from: fmt.dateTime(e.fromUtc),
              to: fmt.dateTime(e.toUtc),
              when: fmt.dateTime(e.generatedAtUtc),
            })}
          </p>
          <StatGrid>
            <StatBox
              label={t("evidence.version")}
              value={<span dir="ltr">{e.productVersion}</span>}
              hint={
                <code className="break-all" dir="ltr">
                  {e.governanceChecksum.slice(0, 16)}…
                </code>
              }
            />
            <StatBox label={t("evidence.organisations")} value={fmt.integer(e.organisations)} />
            <StatBox label={t("evidence.schemes")} value={fmt.integer(e.schemes)} />
            <StatBox
              label={t("evidence.denied")}
              value={fmt.integer(e.accessDeniedEventsAllTime)}
              hint={t("evidence.deniedHint")}
            />
          </StatGrid>
          <Card>
            <CardHeader title={t("evidence.auditTitle")} description={t("evidence.auditBody")} />
            <CardBody>
              <HBarList
                items={Object.entries(e.auditEntriesByCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, count]) => ({
                    key: category,
                    label: label("auditCategory", category),
                    value: count,
                    display: fmt.integer(count),
                  }))}
                emptyLabel={t("evidence.auditEmpty")}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("evidence.controlsTitle")} />
            <Table>
              <caption className="sr-only">{t("evidence.controlsTitle")}</caption>
              <THead>
                <TR>
                  <TH>{t("evidence.area")}</TH>
                  <TH>{t("evidence.control")}</TH>
                  <TH>{t("evidence.evidence")}</TH>
                </TR>
              </THead>
              <TBody>
                {e.controls.map((c) => (
                  <TR key={`${c.area}-${c.control}`}>
                    <TD className="font-medium" dir="auto">
                      {c.area}
                    </TD>
                    <TD dir="auto">{c.control}</TD>
                    <TD dir="auto" className="text-muted">
                      {c.evidence}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </>
      ) : null}
    </div>
  );
}
