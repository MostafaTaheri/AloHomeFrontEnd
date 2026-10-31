"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { usePageView } from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";
import { useScheme } from "../workspace/scheme-provider";
import { AnalysisTab } from "./analysis-tab";
import { VersionsTab } from "./versions-tab";

const TABS = ["versions", "actual", "variance"] as const;
type Tab = (typeof TABS)[number];

/** Budget versions, budget against actual, and variance findings (BUD-01..05). */
export function BudgetsPage() {
  const { t } = useI18n();
  const { schemeId, canWrite, can } = useScheme();
  const raw = useSearchParams().get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "versions";
  usePageView("budgets", tab);
  const base = `/schemes/${schemeId}/budgets`;
  const labels: Record<Tab, string> = {
    versions: t("budgets.tabVersions"),
    actual: t("budgets.tabActual"),
    variance: t("budgets.tabVariance"),
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("budgets.title")} description={t("budgets.subtitle")} />
      {!canWrite && !can("ApproveBudgets") ? (
        <InlineAlert tone="warn">{t("budgets.readOnly")}</InlineAlert>
      ) : null}
      <nav aria-label={t("budgets.tabsLabel")} className="flex gap-1 border-b border-line">
        {TABS.map((id) => (
          <Link
            key={id}
            href={id === "versions" ? base : `${base}?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              tab === id
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-fg",
            )}
          >
            {labels[id]}
          </Link>
        ))}
      </nav>
      {tab === "versions" ? <VersionsTab /> : <AnalysisTab mode={tab} />}
    </div>
  );
}
