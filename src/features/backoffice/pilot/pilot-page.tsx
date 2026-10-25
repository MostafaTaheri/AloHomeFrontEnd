"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { EnumBadge, useEnumLabel } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { StatBox, StatGrid } from "@/components/finance/stat";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { backofficeApi } from "@/lib/api/backoffice";
import { qk } from "@/lib/api/keys";
import { parseSchemeId } from "@/lib/scheme-id";
import { usePageView } from "@/lib/telemetry/client";

export function PilotPage() {
  const { t } = useI18n();
  usePageView("backoffice", "pilot");
  const initial = parseSchemeId(useSearchParams().get("scheme") ?? "");
  const [schemeId, setSchemeId] = useState<number | null>(initial);

  const schemes = useQuery({
    queryKey: qk.bo.schemes({ page: 1, pageSize: 100 }),
    queryFn: ({ signal }) => backofficeApi.schemes({ page: 1, pageSize: 100 }, signal),
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("backoffice.pilotTitle")} description={t("backoffice.pilotSubtitle")} />
      <div className="w-72">
        <Field id="pilot-scheme" label={t("backoffice.chooseScheme")}>
          <Select
            id="pilot-scheme"
            value={schemeId === null ? "" : String(schemeId)}
            onChange={(e) => setSchemeId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t("backoffice.chooseScheme")}</option>
            {(schemes.data?.items ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {schemeId === null ? (
        <EmptyState title={t("backoffice.pilotEmpty")} />
      ) : (
        <Metrics schemeId={schemeId} />
      )}
      <FeedbackList schemeId={schemeId} />
    </div>
  );
}

function Metrics({ schemeId }: { schemeId: number }) {
  const { t, fmt } = useI18n();
  const query = useQuery({
    queryKey: qk.bo.pilotMetrics(schemeId),
    queryFn: ({ signal }) => backofficeApi.pilotMetrics(schemeId, signal),
  });
  if (query.isPending) return <ListSkeleton rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const m = query.data;
  const cur = m.currency;

  return (
    <div className="space-y-6">
      <StatGrid>
        <StatBox
          label={t("backoffice.mHoursToFirst")}
          value={
            m.hoursToFirstVerifiedDashboard === null
              ? t("backoffice.notYet")
              : fmt.number(m.hoursToFirstVerifiedDashboard, { maximumFractionDigits: 1 })
          }
        />
        <StatBox label={t("backoffice.mImportsUploaded")} value={fmt.integer(m.importsUploaded)} />
        <StatBox label={t("backoffice.mImportsVerified")} value={fmt.integer(m.importsVerified)} />
        <StatBox label={t("backoffice.mReports")} value={fmt.integer(m.reportsGenerated)} />
        <StatBox label={t("backoffice.mAnomalies")} value={fmt.integer(m.anomaliesFound)} />
        <StatBox label={t("backoffice.mConfirmed")} value={fmt.integer(m.anomaliesConfirmed)} />
        <StatBox label={t("backoffice.mDismissed")} value={fmt.integer(m.anomaliesDismissed)} />
        <StatBox
          label={t("backoffice.mHoursSaved")}
          value={fmt.number(m.hoursSavedReported, { maximumFractionDigits: 1 })}
        />
        <StatBox
          label={t("backoffice.mMoneyConfirmed")}
          value={<Money amount={m.moneyFlaggedConfirmed} currency={cur} whole />}
        />
        <StatBox
          label={t("backoffice.mMoneyOpen")}
          value={<Money amount={m.moneyFlaggedOpen} currency={cur} whole />}
        />
      </StatGrid>
      <div className="grid gap-6 lg:grid-cols-3">
        <CountsCard
          title={t("backoffice.mFeedback")}
          counts={m.feedbackByRating}
          group="feedbackRating"
        />
        <CountsCard
          title={t("backoffice.mAiReview")}
          counts={m.aiReviewByStatus}
          group="aiReview"
        />
        <Card>
          <CardHeader title={t("backoffice.mMilestones")} />
          <CardBody>
            {Object.keys(m.milestones).length === 0 ? (
              <p className="text-sm text-muted">{t("backoffice.notYet")}</p>
            ) : (
              <dl className="space-y-1 text-sm">
                {Object.entries(m.milestones).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-muted">{k}</dt>
                    <dd>{fmt.dateTime(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function CountsCard({
  title,
  counts,
  group,
}: {
  title: string;
  counts: Record<string, number>;
  group: "feedbackRating" | "aiReview";
}) {
  const { t, fmt } = useI18n();
  const label = useEnumLabel();
  const entries = Object.entries(counts);
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">{t("data.noData")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {entries.map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3">
                <span>{label(group, k)}</span>
                <span className="tabular-nums">{fmt.integer(v)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function FeedbackList({ schemeId }: { schemeId: number | null }) {
  const { t, fmt } = useI18n();
  const label = useEnumLabel();
  const [page, setPage] = useState(1);
  const params = { schemeId: schemeId ?? undefined, page, pageSize: 20 };
  const query = useQuery({
    queryKey: qk.bo.pilotFeedback(params),
    queryFn: ({ signal }) => backofficeApi.pilotFeedback(params, signal),
    placeholderData: (previous) => previous,
  });

  return (
    <Card>
      <CardHeader title={t("backoffice.feedbackTitle")} />
      {query.isPending ? (
        <CardBody>
          <ListSkeleton rows={3} />
        </CardBody>
      ) : null}
      {query.isError ? (
        <CardBody>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </CardBody>
      ) : null}
      {query.data && query.data.items.length === 0 ? (
        <CardBody>
          <p className="text-sm text-muted">{t("backoffice.feedbackEmpty")}</p>
        </CardBody>
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t("backoffice.colWhen")}</TH>
                  <TH>{t("backoffice.colScheme")}</TH>
                  <TH>{t("feedback.colSubject")}</TH>
                  <TH>{t("feedback.colRating")}</TH>
                  <TH>{t("feedback.colNote")}</TH>
                  <TH>{t("feedback.colHours")}</TH>
                </TR>
              </THead>
              <TBody>
                {query.data.items.map((f) => (
                  <TR key={f.id}>
                    <TD>{fmt.dateTime(f.createdAtUtc)}</TD>
                    <TD>{fmt.integer(f.schemeId)}</TD>
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
        </>
      ) : null}
    </Card>
  );
}
