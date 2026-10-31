"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { MonthField } from "@/components/forms/date-field";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import { healthApi } from "@/lib/api/finance/endpoints";
import type { HealthReport } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { track, usePageView } from "@/lib/telemetry/client";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";
import { MonthlySummaryView } from "../health/health-view";
import { CommitteePackCard } from "./committee-pack";

const PAGE_SIZE = 20;

export function ReportsPage() {
  const { t, fmt } = useI18n();
  const { schemeId, canWrite } = useScheme();
  usePageView("reports", "list");

  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: qk.reports(schemeId, { page }),
    queryFn: ({ signal }) => healthApi.reports(schemeId, { page, pageSize: PAGE_SIZE }, { signal }),
    placeholderData: (previous) => previous,
  });

  return (
    <div>
      <PageHeader
        title={t("reports.title")}
        description={t("reports.subtitle")}
        actions={
          canWrite ? <Button onClick={() => setOpen(true)}>{t("reports.generate")}</Button> : null
        }
      />

      <CommitteePackCard />

      {query.isPending ? <ListSkeleton /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.items.length === 0 ? (
        <EmptyState
          title={t("reports.emptyTitle")}
          body={t("reports.emptyBody")}
          action={
            canWrite ? (
              <Button onClick={() => setOpen(true)}>{t("reports.generate")}</Button>
            ) : undefined
          }
        />
      ) : null}

      {query.data && query.data.items.length > 0 ? (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>{t("reports.colPeriod")}</TH>
                <TH>{t("reports.colVersion")}</TH>
                <TH>{t("reports.colGenerated")}</TH>
                <TH>{t("reports.colBy")}</TH>
                <TH>
                  <span className="sr-only">{t("common.actions")}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {query.data.items.map((report: HealthReport) => (
                <TR key={report.id}>
                  <TD className="font-medium">{fmt.periodLabel(report.periodLabel)}</TD>
                  <TD>{fmt.integer(report.version)}</TD>
                  <TD>{fmt.dateTime(report.generatedAtUtc)}</TD>
                  <TD className="text-muted">{report.generatedBy}</TD>
                  <TD className="text-end">
                    <Link
                      href={`/schemes/${schemeId}/reports/${report.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {t("reports.open")}
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalCount={query.data.totalCount}
            onPageChange={setPage}
            disabled={query.isFetching}
          />
        </Card>
      ) : null}

      {open ? <GenerateDialog onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function GenerateDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const [period, setPeriod] = useState("");
  const [commentary, setCommentary] = useState("");

  const preview = useQuery({
    queryKey: qk.monthly(schemeId, period || undefined),
    queryFn: ({ signal }) => healthApi.monthly(schemeId, period || undefined, { signal }),
  });

  const generate = useSchemeMutation({
    mutationFn: () =>
      healthApi.generate(schemeId, {
        periodDate: period || undefined,
        commentary: commentary.trim(),
      }),
    invalidate: [["scheme", schemeId, "reports"]],
    success: "reports.generated",
    silentError: true,
    onSuccess: () => {
      track("report_generated", { area: "reports" });
      onClose();
    },
  });

  return (
    <Dialog
      open
      onClose={generate.isPending ? () => undefined : onClose}
      title={t("reports.generateTitle")}
      description={t("reports.generateHelp")}
      className="w-[min(94vw,40rem)]"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={generate.isPending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => generate.mutate(undefined)} loading={generate.isPending}>
            {generate.isPending ? t("reports.generating") : t("reports.generate")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="report-period" label={t("reports.periodLabel")}>
          <MonthField id="report-period" value={period} onChange={setPeriod} />
        </Field>
        <Field
          id="report-commentary"
          label={t("reports.commentary")}
          hint={t("reports.commentaryHint")}
        >
          <textarea
            id="report-commentary"
            rows={4}
            maxLength={4000}
            value={commentary}
            onChange={(e) => setCommentary(e.target.value)}
            aria-describedby="report-commentary-hint"
            className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
          />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium">{t("reports.previewTitle")}</p>
          <p className="mb-2 text-xs text-muted">{t("reports.previewHelp")}</p>
          {preview.isPending ? <ListSkeleton rows={2} /> : null}
          {preview.isError ? (
            <p className="text-sm text-muted">{describeError(preview.error, t)}</p>
          ) : null}
          {preview.data ? <MonthlySummaryView data={preview.data} /> : null}
        </div>

        {generate.isError ? (
          <InlineAlert tone="danger">{describeError(generate.error, t)}</InlineAlert>
        ) : null}
      </div>
    </Dialog>
  );
}
