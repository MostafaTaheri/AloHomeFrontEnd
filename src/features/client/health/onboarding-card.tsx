"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/i18n/provider";
import { qk } from "@/lib/api/keys";
import { ONBOARDING_LINKS, portfolioApi } from "@/lib/api/readiness";
import { useScheme } from "../workspace/scheme-provider";

/**
 * Onboarding progress (GTM-06), derived by the API from the scheme's own data. Hidden once every
 * step is done, and silent if it can't be loaded: it is a guide, not a gate.
 */
export function OnboardingCard() {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const query = useQuery({
    queryKey: qk.onboarding(schemeId),
    queryFn: ({ signal }) => portfolioApi.onboarding(schemeId, { signal }),
  });
  const data = query.data;
  if (!data || data.completedSteps >= data.totalSteps) return null;
  const href = (code: string) => {
    const path = ONBOARDING_LINKS[code];
    return path === undefined ? null : `/schemes/${schemeId}${path ? `/${path}` : ""}`;
  };

  return (
    <Card>
      <CardHeader
        title={t("onboarding.title")}
        description={t("onboarding.progress", {
          done: data.completedSteps,
          total: data.totalSteps,
        })}
      />
      <CardBody className="space-y-3">
        <div
          role="progressbar"
          aria-label={t("onboarding.title")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={data.percentComplete}
          className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full bg-brand" style={{ width: `${data.percentComplete}%` }} />
        </div>
        <ol className="grid gap-1 text-sm sm:grid-cols-2">
          {data.steps.map((step) => {
            const link = href(step.code);
            const next = step.code === data.nextStep;
            return (
              <li key={step.code} className="flex items-center gap-2">
                <span aria-hidden="true" className={step.done ? "text-ok" : "text-muted"}>
                  {step.done ? "✓" : "○"}
                </span>
                <span className="sr-only">
                  {step.done ? t("onboarding.done") : t("onboarding.todo")}
                </span>
                {!step.done && link ? (
                  <Link
                    href={link}
                    className={next ? "font-medium text-brand hover:underline" : "hover:underline"}
                  >
                    {step.title}
                  </Link>
                ) : (
                  <span className={step.done ? "text-muted" : undefined}>{step.title}</span>
                )}
                {next ? <span className="text-xs text-brand">{t("onboarding.next")}</span> : null}
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-muted">
          {t("onboarding.percent", { value: fmt.percent(data.percentComplete) })}
        </p>
      </CardBody>
    </Card>
  );
}
