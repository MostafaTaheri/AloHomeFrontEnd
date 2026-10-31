"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { InsightPanel } from "@/components/ai/insight-panel";
import { confidencePercent } from "@/components/ai/confidence";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import { aiApi } from "@/lib/api/finance/endpoints";
import { qk } from "@/lib/api/keys";
import { track, usePageView } from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";
import { AskTab } from "./ask-tab";
import { DocumentsTab } from "./documents-tab";

const TABS = ["insights", "suggestions", "documents", "ask"] as const;
type Tab = (typeof TABS)[number];

export function AiReviewPage() {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const raw = useSearchParams().get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "insights";
  usePageView("ai-review", tab);
  const base = `/schemes/${schemeId}/ai-review`;
  const tabs = [
    { id: "insights", href: base, label: t("aiReview.tabInsights") },
    { id: "suggestions", href: `${base}?tab=suggestions`, label: t("aiReview.tabSuggestions") },
    { id: "documents", href: `${base}?tab=documents`, label: t("aiDocs.tab") },
    { id: "ask", href: `${base}?tab=ask`, label: t("ask.tab") },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title={t("aiReview.title")} description={t("aiReview.subtitle")} />
      <InlineAlert tone="warn">{t("ai.notice")}</InlineAlert>
      <nav
        aria-label={t("aiReview.tabsLabel")}
        className="flex flex-wrap gap-1 border-b border-line"
      >
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={tab === item.id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              tab === item.id
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-fg",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {tab === "insights" ? <InsightsTab /> : null}
      {tab === "suggestions" ? <SuggestionsTab /> : null}
      {tab === "documents" ? <DocumentsTab /> : null}
      {tab === "ask" ? <AskTab /> : null}
    </div>
  );
}

function InsightsTab() {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const query = useQuery({
    queryKey: qk.insights(schemeId, {}),
    queryFn: ({ signal }) => aiApi.insights(schemeId, {}, { signal }),
  });

  if (query.isPending) return <ListSkeleton rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <EmptyState
        title={t("aiReview.insightsEmptyTitle")}
        body={t("aiReview.insightsEmptyBody")}
        action={
          <Link
            href={`/schemes/${schemeId}/expenses?tab=flags`}
            className="text-brand hover:underline"
          >
            {t("aiReview.openFlags")}
          </Link>
        }
      />
    );
  }
  const items = [...query.data].sort((a, b) => b.generatedAtUtc.localeCompare(a.generatedAtUtc));
  return (
    <ul className="space-y-4">
      {items.map((insight) => (
        <li key={insight.id} className="space-y-2">
          <p className="text-xs text-muted">
            {t("aiReview.subjectFlag")} · {fmt.dateTime(insight.generatedAtUtc)}
          </p>
          <InsightPanel insight={insight} />
        </li>
      ))}
    </ul>
  );
}

type SuggestionStatus = "Pending" | "Accepted" | "Rejected";

function SuggestionsTab() {
  const { t, fmt } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const toast = useToast();
  const [status, setStatus] = useState<SuggestionStatus>("Pending");

  const query = useQuery({
    queryKey: qk.suggestions(schemeId, status),
    queryFn: ({ signal }) => aiApi.suggestions(schemeId, status, { signal }),
  });

  const run = useSchemeMutation({
    mutationFn: () => aiApi.suggestCategories(schemeId, { maxRecords: 50 }),
    invalidate: [qk.ai(schemeId)],
    onSuccess: (result) => {
      if (!result.aiAvailable) toast.error(t("aiReview.suggestUnavailable"));
      else if (result.suggestionsCreated > 0)
        toast.success(
          t("aiReview.suggestDone", {
            created: fmt.integer(result.suggestionsCreated),
            considered: fmt.integer(result.recordsConsidered),
          }),
        );
      else
        toast.success(
          t("aiReview.suggestNone", { considered: fmt.integer(result.recordsConsidered) }),
        );
    },
  });

  const review = useSchemeMutation({
    mutationFn: (vars: { id: string; accept: boolean }) =>
      aiApi.reviewSuggestion(schemeId, vars.id, vars.accept),
    invalidate: [qk.ai(schemeId), qk.expenses(schemeId), ["scheme", schemeId, "records"]],
    onSuccess: (_, vars) => {
      track("ai_suggestion_reviewed", {
        area: "ai",
        subject: "CategorySuggestion",
        rating: vars.accept ? "Accepted" : "Rejected",
      });
      toast.success(t(vars.accept ? "aiReview.accepted" : "aiReview.rejected"));
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t("aiReview.suggestionNote")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Field id="sug-status" label={t("aiReview.suggestStatus")}>
            <Select
              id="sug-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as SuggestionStatus)}
            >
              {(["Pending", "Accepted", "Rejected"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`enums.suggestion.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {canWrite ? (
          <Button variant="secondary" loading={run.isPending} onClick={() => run.mutate(undefined)}>
            {run.isPending ? t("aiReview.suggestRunning") : t("aiReview.suggestRun")}
          </Button>
        ) : null}
      </div>

      {query.isPending ? <ListSkeleton rows={4} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          title={t("aiReview.suggestionsEmptyTitle")}
          body={t("aiReview.suggestionsEmptyBody")}
        />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t("aiReview.colRecord")}</TH>
                  <TH>{t("aiReview.colSuggested")}</TH>
                  <TH>{t("aiReview.colConfidence")}</TH>
                  <TH>{t("aiReview.colWhy")}</TH>
                  <TH>{t("common.status")}</TH>
                  {canWrite ? <TH>{t("aiReview.colActions")}</TH> : null}
                </TR>
              </THead>
              <TBody>
                {query.data.map((s) => (
                  <TR key={s.id}>
                    <TD dir="ltr" className="font-mono text-xs">
                      {s.financialRecordId.slice(0, 8)}
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-2">
                        <Badge tone="ai">{t("ai.badge")}</Badge>
                        {s.suggestedCategory}
                      </span>
                    </TD>
                    <TD>{fmt.percent(confidencePercent(s.confidence))}</TD>
                    <TD className="max-w-72 text-sm" dir="auto">
                      {s.rationale ?? t("common.none")}
                    </TD>
                    <TD>
                      <EnumBadge group="suggestion" value={s.status} />
                    </TD>
                    {canWrite ? (
                      <TD>
                        {String(s.status) === "Pending" ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={review.isPending}
                              onClick={() => review.mutate({ id: s.id, accept: true })}
                            >
                              {t("aiReview.accept")}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={review.isPending}
                              onClick={() => review.mutate({ id: s.id, accept: false })}
                            >
                              {t("aiReview.reject")}
                            </Button>
                          </div>
                        ) : (
                          t("common.none")
                        )}
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
