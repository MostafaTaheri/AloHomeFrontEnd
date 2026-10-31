"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { FeedbackWidget } from "@/components/ai/feedback-widget";
import { DateField } from "@/components/forms/date-field";
import { FreshnessBanner } from "@/components/finance/freshness";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { healthApi } from "@/lib/api/finance/endpoints";
import { qk } from "@/lib/api/keys";
import { usePageView } from "@/lib/telemetry/client";
import { useScheme } from "../workspace/scheme-provider";
import { FinancialHealthView, MonthlySummaryView } from "./health-view";
import { OnboardingCard } from "./onboarding-card";

export function HealthDashboard() {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  usePageView("health", "dashboard");

  const [asOfInput, setAsOfInput] = useState("");
  const [asOf, setAsOf] = useState<string | undefined>(undefined);

  const health = useQuery({
    queryKey: qk.health(schemeId, asOf),
    queryFn: ({ signal }) => healthApi.health(schemeId, asOf, { signal }),
  });
  // A failed monthly summary must not hide the dashboard: it renders as its own partial state.
  const monthly = useQuery({
    queryKey: qk.monthly(schemeId),
    queryFn: ({ signal }) => healthApi.monthly(schemeId, undefined, { signal }),
  });

  const data = health.data;
  const empty = data ? data.freshness?.noVerifiedData === true : false;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("health.title")}
        description={t("health.subtitle")}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Field id="health-asof" label={t("health.asOfLabel")} hint={t("health.asOfHint")}>
              <DateField id="health-asof" value={asOfInput} onChange={setAsOfInput} />
            </Field>
            <Button
              variant="secondary"
              onClick={() => setAsOf(asOfInput || undefined)}
              disabled={asOfInput === (asOf ?? "")}
            >
              {t("health.applyDate")}
            </Button>
          </div>
        }
      />

      <OnboardingCard />

      {health.isPending ? <ListSkeleton rows={5} /> : null}
      {health.isError ? (
        <ErrorState error={health.error} onRetry={() => void health.refetch()} />
      ) : null}

      {data ? (
        <>
          <FreshnessBanner freshness={data.freshness} />
          {empty ? (
            <EmptyState
              title={t("health.emptyTitle")}
              body={t("health.emptyBody")}
              action={
                <Link
                  href={`/schemes/${schemeId}/imports`}
                  className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand-hover"
                >
                  {t("health.goImports")}
                </Link>
              }
            />
          ) : (
            <>
              <p className="text-xs text-muted">
                {t("data.asOf", { date: fmt.date(data.asOf) })} · {t("health.origin")}
              </p>
              <FinancialHealthView data={data} schemeId={schemeId} />
            </>
          )}
          {data.disclaimer ? <p className="text-xs text-muted">{data.disclaimer}</p> : null}
        </>
      ) : null}

      <Card>
        <CardHeader title={t("health.monthlyTitle")} />
        <CardBody>
          {monthly.isPending ? <ListSkeleton rows={2} /> : null}
          {monthly.isError ? (
            <div className="space-y-2">
              <p className="text-sm text-muted">{t("health.monthlyFailed")}</p>
              <ErrorState error={monthly.error} onRetry={() => void monthly.refetch()} />
            </div>
          ) : null}
          {monthly.data ? <MonthlySummaryView data={monthly.data} /> : null}
        </CardBody>
      </Card>

      <FeedbackWidget
        subjectType="Dashboard"
        subjectId="financial-health"
        idPrefix="health-feedback"
      />
    </div>
  );
}
