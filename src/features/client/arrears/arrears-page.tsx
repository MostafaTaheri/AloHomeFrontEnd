"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { useI18n } from "@/i18n/provider";
import { usePageView } from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";
import { useScheme } from "../workspace/scheme-provider";
import { ActionsTab } from "./actions-tab";
import { OverviewTab } from "./overview-tab";
import { RiskTab } from "./risk-tab";
import { SettingsTab } from "./settings-tab";

const TABS = ["overview", "risk", "actions", "settings"] as const;
type Tab = (typeof TABS)[number];

export function ArrearsPage() {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const raw = useSearchParams().get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "overview";
  usePageView("arrears", tab);
  const base = `/schemes/${schemeId}/arrears`;

  const labels: Record<Tab, string> = {
    overview: t("arrears.tabOverview"),
    risk: t("arrears.tabRisk"),
    actions: t("arrears.tabActions"),
    settings: t("arrears.tabSettings"),
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("arrears.title")} description={t("arrears.subtitle")} />
      <nav
        aria-label={t("arrears.tabsLabel")}
        className="flex flex-wrap gap-1 border-b border-line"
      >
        {TABS.map((id) => (
          <Link
            key={id}
            href={id === "overview" ? base : `${base}?tab=${id}`}
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
      {tab === "overview" ? <OverviewTab /> : null}
      {tab === "risk" ? <RiskTab /> : null}
      {tab === "actions" ? <ActionsTab /> : null}
      {tab === "settings" ? <SettingsTab /> : null}
    </div>
  );
}
