"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DateField } from "@/components/forms/date-field";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { StatBox, StatGrid } from "@/components/finance/stat";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import { committeePackApi } from "@/lib/api/finance/budgets";
import { qk } from "@/lib/api/keys";
import { safeFileName, saveBlob } from "@/lib/download";
import { track } from "@/lib/telemetry/client";
import { usePartyLabel } from "../property/lot-dialog";
import { useScheme } from "../workspace/scheme-provider";

/**
 * The committee meeting pack (RPT-03): health, budget against actual, the committee and the
 * decisions the meeting needs to make, as at a chosen date. Built live; the PDF is the record.
 */
export function CommitteePackCard() {
  const { t, fmt } = useI18n();
  const { schemeId, can } = useScheme();
  const toast = useToast();
  const party = usePartyLabel();
  const [asOf, setAsOf] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [shown, setShown] = useState(false);
  const [exporting, setExporting] = useState(false);
  const params = { asOf: asOf || undefined, meetingDate: meetingDate || undefined };

  const query = useQuery({
    queryKey: qk.committeePack(schemeId, params),
    queryFn: ({ signal }) => committeePackApi.get(schemeId, params, { signal }),
    enabled: shown,
  });

  async function exportPdf() {
    setExporting(true);
    try {
      const { blob, filename } = await committeePackApi.pdf(schemeId, params);
      saveBlob(blob, safeFileName(filename ?? "committee-pack.pdf", "committee-pack.pdf"));
      track("report_exported", { area: "reports", kind: "committee-pack" });
      toast.success(t("committee.exported"));
    } catch (error) {
      toast.error(`${t("reports.exportFailed")} ${describeError(error, t)}`);
    } finally {
      setExporting(false);
    }
  }

  const pack = query.data;
  return (
    <Card className="mb-6">
      <CardHeader title={t("committee.title")} description={t("committee.subtitle")} />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Field id="pack-asof" label={t("committee.asOf")} optional={t("common.optional")}>
              <DateField id="pack-asof" value={asOf} onChange={setAsOf} />
            </Field>
          </div>
          <div className="w-44">
            <Field
              id="pack-meeting"
              label={t("committee.meetingDate")}
              optional={t("common.optional")}
            >
              <DateField id="pack-meeting" value={meetingDate} onChange={setMeetingDate} />
            </Field>
          </div>
          <Button variant="secondary" onClick={() => setShown(true)}>
            {shown ? t("common.refresh") : t("committee.preview")}
          </Button>
          {can("ExportReports") ? (
            <Button onClick={() => void exportPdf()} loading={exporting}>
              {t("committee.pdf")}
            </Button>
          ) : null}
        </div>

        {shown && query.isPending ? <ListSkeleton rows={3} /> : null}
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : null}
        {pack ? (
          <div className="space-y-5" dir={pack.rightToLeft ? "rtl" : undefined}>
            <p className="text-xs text-muted">
              {t("committee.generated", {
                date: fmt.date(pack.asOf),
                when: fmt.dateTime(pack.generatedAtUtc),
              })}
            </p>
            <StatGrid>
              <StatBox
                label={pack.health.adminFund.label}
                value={
                  <Money amount={pack.health.adminFund.balance} currency={pack.currency} whole />
                }
              />
              <StatBox
                label={pack.health.capitalWorksFund.label}
                value={
                  <Money
                    amount={pack.health.capitalWorksFund.balance}
                    currency={pack.currency}
                    whole
                  />
                }
              />
              <StatBox
                label={t("committee.overdue")}
                tone={pack.health.arrears.totalOverdue > 0 ? "warn" : "ok"}
                value={
                  <Money amount={pack.health.arrears.totalOverdue} currency={pack.currency} whole />
                }
                hint={t("committee.lotsInArrears", { count: pack.health.arrears.lotsInArrears })}
              />
              <StatBox
                label={t("committee.budgetVariance")}
                value={
                  pack.budgetVsActual ? (
                    <Money
                      amount={pack.budgetVsActual.totalVariance}
                      currency={pack.currency}
                      signed
                      whole
                    />
                  ) : (
                    t("common.none")
                  )
                }
                hint={
                  pack.budgetVsActual ? pack.budgetVsActual.budgetName : t("committee.noBudget")
                }
              />
            </StatGrid>

            <section aria-labelledby="pack-decisions" className="space-y-2">
              <h3 id="pack-decisions" className="text-sm font-semibold">
                {t("committee.decisions")}
              </h3>
              {pack.decisionsRequired.length === 0 ? (
                <p className="text-sm text-muted">{t("committee.noDecisions")}</p>
              ) : (
                <ol className="list-decimal space-y-1 ps-5 text-sm">
                  {pack.decisionsRequired.map((d, i) => (
                    <li key={`${d.code}-${d.referenceId ?? i}`} dir="auto">
                      {d.text}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-labelledby="pack-committee" className="space-y-2">
              <h3 id="pack-committee" className="text-sm font-semibold">
                {t("committee.members")}
              </h3>
              {pack.committee.length === 0 ? (
                <InlineAlert tone="warn">{t("committee.noMembers")}</InlineAlert>
              ) : (
                <ul className="flex flex-wrap gap-2 text-sm">
                  {pack.committee.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-1 rounded-md border border-line px-2 py-1"
                    >
                      <EnumBadge group="office" value={m.office} />
                      <span dir="auto">{party(m)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {pack.disclaimer ? <p className="text-xs text-muted">{pack.disclaimer}</p> : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
