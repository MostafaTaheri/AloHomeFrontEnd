"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { FeedbackWidget } from "@/components/ai/feedback-widget";
import { FreshnessBanner } from "@/components/finance/freshness";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import { healthApi } from "@/lib/api/finance/endpoints";
import { qk } from "@/lib/api/keys";
import { safeFileName, saveBlob } from "@/lib/download";
import { track, usePageView } from "@/lib/telemetry/client";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";
import { FinancialHealthView, MonthlySummaryView } from "../health/health-view";

export function ReportDetail({ reportId }: { reportId: string }) {
  const { t, fmt } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const toast = useToast();
  usePageView("reports", "detail");

  const query = useQuery({
    queryKey: qk.report(schemeId, reportId),
    queryFn: ({ signal }) => healthApi.report(schemeId, reportId, { signal }),
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [exporting, setExporting] = useState(false);

  const save = useSchemeMutation({
    mutationFn: (commentary: string) => healthApi.saveCommentary(schemeId, reportId, commentary),
    invalidate: [qk.report(schemeId, reportId)],
    success: "reports.commentarySaved",
    onSuccess: () => setEditing(false),
  });

  async function exportPdf() {
    setExporting(true);
    try {
      const { blob, filename } = await healthApi.pdf(schemeId, reportId);
      const base = query.data
        ? `report-${query.data.periodLabel}-v${query.data.version}`
        : "report";
      saveBlob(blob, safeFileName(filename ?? `${base}.pdf`, "report.pdf"));
      track("report_exported", { area: "reports", kind: "pdf" });
      toast.success(t("reports.exported"));
    } catch (error) {
      toast.error(`${t("reports.exportFailed")} ${describeError(error, t)}`);
    } finally {
      setExporting(false);
    }
  }

  if (query.isPending) return <ListSkeleton rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const report = query.data;
  const snapshot = report.snapshot;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("reports.title")}: ${fmt.periodLabel(report.periodLabel)}`}
        description={`${t("reports.version", { version: fmt.integer(report.version) })} · ${t(
          "reports.generatedBy",
          {
            when: fmt.dateTime(report.generatedAtUtc),
          },
        )}`}
        backHref={`/schemes/${schemeId}/reports`}
        backLabel={t("reports.back")}
        actions={
          <Button variant="secondary" onClick={() => void exportPdf()} loading={exporting}>
            {exporting ? t("reports.exporting") : t("reports.exportPdf")}
          </Button>
        }
      />

      <InlineAlert tone="warn">{t("reports.snapshotNote")}</InlineAlert>

      <Card>
        <CardHeader
          title={t("reports.commentaryTitle")}
          actions={
            canWrite && !editing ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDraft(report.managerCommentary ?? "");
                  setEditing(true);
                }}
              >
                {t("reports.editCommentary")}
              </Button>
            ) : null
          }
        />
        <CardBody>
          {editing ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(draft.trim());
              }}
            >
              <Field
                id="commentary"
                label={t("reports.commentary")}
                hint={t("reports.commentaryHint")}
              >
                <textarea
                  id="commentary"
                  rows={5}
                  maxLength={4000}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
                />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" loading={save.isPending}>
                  {t("reports.saveCommentary")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setEditing(false)}
                  disabled={save.isPending}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          ) : report.managerCommentary ? (
            <div className="space-y-1">
              <p className="whitespace-pre-wrap text-sm">{report.managerCommentary}</p>
              {report.commentaryAtUtc ? (
                <p className="text-xs text-muted">
                  {t("reports.commentaryBy", { when: fmt.dateTime(report.commentaryAtUtc) })}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">{t("reports.commentaryEmpty")}</p>
          )}
        </CardBody>
      </Card>

      {snapshot ? (
        <>
          <FreshnessBanner freshness={snapshot.health.freshness} />
          <Card>
            <CardHeader title={t("health.monthlyTitle")} />
            <CardBody>
              <MonthlySummaryView data={snapshot.monthly} />
            </CardBody>
          </Card>
          <section aria-label={t("health.title")}>
            <FinancialHealthView data={snapshot.health} schemeId={null} />
          </section>
          {snapshot.health.disclaimer ? (
            <p className="text-xs text-muted">{snapshot.health.disclaimer}</p>
          ) : null}
        </>
      ) : (
        <EmptyState title={t("reports.noSnapshot")} />
      )}

      <FeedbackWidget subjectType="Report" subjectId={report.id} idPrefix="report-feedback" />
      <Link href={`/schemes/${schemeId}/reports`} className="text-sm text-brand hover:underline">
        {t("reports.back")}
      </Link>
    </div>
  );
}
