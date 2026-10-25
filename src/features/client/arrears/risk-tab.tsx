"use client";

import { useQuery } from "@tanstack/react-query";
import { FeedbackWidget } from "@/components/ai/feedback-widget";
import { EnumBadge } from "@/components/finance/enum-badge";
import { FreshnessBanner } from "@/components/finance/freshness";
import { Money } from "@/components/finance/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { arrearsApi } from "@/lib/api/finance/endpoints";
import { qk } from "@/lib/api/keys";
import { useScheme } from "../workspace/scheme-provider";

export function RiskTab() {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const query = useQuery({
    queryKey: qk.riskSignals(schemeId),
    queryFn: ({ signal }) => arrearsApi.riskSignals(schemeId, undefined, { signal }),
  });

  if (query.isPending) return <ListSkeleton rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("arrears.riskTitle")}</h2>
        <p className="text-sm text-muted">{t("arrears.riskSubtitle")}</p>
        <p className="mt-1 text-xs text-muted" dir="ltr">
          {t("arrears.riskModel", { version: data.modelVersion })}
        </p>
      </div>
      <FreshnessBanner freshness={data.freshness} />

      {data.signals.length === 0 ? (
        <EmptyState title={t("arrears.riskEmpty")} />
      ) : (
        <ul className="space-y-3">
          {data.signals.map((s) => (
            <li key={s.lotId}>
              <Card>
                <CardBody className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{s.lot}</h3>
                      <EnumBadge group="riskLevel" value={s.level} />
                      {s.hasPaymentPlan ? <Badge tone="ok">{t("arrears.planYes")}</Badge> : null}
                      <Badge>{t("ai.deterministicBadge")}</Badge>
                    </div>
                    <p className="text-sm">
                      {t("arrears.colScore")}: <strong>{fmt.integer(s.score)}</strong> ·{" "}
                      <Money amount={s.overdue} currency={data.currency} whole /> ·{" "}
                      {t("arrears.colDays")}: {fmt.integer(s.daysOverdue)}
                    </p>
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer select-none text-muted hover:underline">
                      {t("arrears.colFactors")}
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {s.factors.map((f) => (
                        <li key={f.code} className="flex justify-between gap-3">
                          <span>{f.description}</span>
                          <span className="whitespace-nowrap text-muted">
                            {t("arrears.factorPoints", { points: fmt.integer(f.points) })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                  <FeedbackWidget
                    subjectType="RiskSignal"
                    subjectId={String(s.lotId)}
                    idPrefix={`risk-${s.lotId}`}
                  />
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {data.disclaimer ? <p className="text-xs text-muted">{data.disclaimer}</p> : null}
    </div>
  );
}
