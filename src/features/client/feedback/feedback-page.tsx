"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FeedbackWidget } from "@/components/ai/feedback-widget";
import { EnumBadge, useEnumLabel } from "@/components/finance/enum-badge";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { feedbackApi, type FeedbackInput } from "@/lib/api/finance/endpoints";
import { qk } from "@/lib/api/keys";
import { usePageView } from "@/lib/telemetry/client";
import { useScheme } from "../workspace/scheme-provider";

const SUBJECTS: FeedbackInput["subjectType"][] = [
  "ExpenseFlag",
  "AiInsight",
  "RiskSignal",
  "Report",
  "Dashboard",
  "Metric",
];

export function FeedbackPage() {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const label = useEnumLabel();
  usePageView("feedback", "list");
  const [subject, setSubject] = useState<FeedbackInput["subjectType"] | "">("");
  const [page, setPage] = useState(1);

  const params = { subjectType: subject || undefined, page, pageSize: 20 };
  const query = useQuery({
    queryKey: qk.feedback(schemeId, params),
    queryFn: ({ signal }) => feedbackApi.list(schemeId, params, { signal }),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("feedback.pageTitle")} description={t("feedback.pageSubtitle")} />

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("feedback.overallTitle")}</h2>
        <FeedbackWidget
          subjectType="Dashboard"
          subjectId={String(schemeId)}
          idPrefix="overall-feedback"
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-semibold">{t("feedback.listTitle")}</h2>
          <div className="w-52">
            <Field id="fb-subject" label={t("feedback.filterSubject")}>
              <Select
                id="fb-subject"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value as FeedbackInput["subjectType"] | "");
                  setPage(1);
                }}
              >
                <option value="">{t("common.all")}</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {label("subjectType", s)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        {query.isPending ? <ListSkeleton rows={4} /> : null}
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : null}
        {query.data && query.data.items.length === 0 ? (
          <EmptyState title={t("feedback.emptyTitle")} body={t("feedback.emptyBody")} />
        ) : null}
        {query.data && query.data.items.length > 0 ? (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>{t("feedback.colSubject")}</TH>
                    <TH>{t("feedback.colRating")}</TH>
                    <TH>{t("feedback.colNote")}</TH>
                    <TH>{t("feedback.colHours")}</TH>
                    <TH>{t("feedback.colWhen")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {query.data.items.map((f) => (
                    <TR key={f.id}>
                      <TD>{label("subjectType", f.subjectType)}</TD>
                      <TD>
                        <EnumBadge group="feedbackRating" value={f.rating} />
                      </TD>
                      <TD className="max-w-80 text-sm" dir="auto">
                        {f.note ?? t("common.none")}
                      </TD>
                      <TD>
                        {f.hoursSavedEstimate === null
                          ? t("common.none")
                          : fmt.number(f.hoursSavedEstimate, { maximumFractionDigits: 1 })}
                      </TD>
                      <TD>{fmt.dateTime(f.createdAtUtc)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <Pagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              totalCount={query.data.totalCount}
              onPageChange={setPage}
              disabled={query.isFetching}
            />
          </Card>
        ) : null}
      </section>
    </div>
  );
}
