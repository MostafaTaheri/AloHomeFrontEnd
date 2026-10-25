"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { usePageView } from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";
import { useScheme } from "../workspace/scheme-provider";
import { ItemsTab } from "./items-tab";
import { ScenariosTab } from "./scenarios-tab";

export function CapitalPage() {
  const { t } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const tab = useSearchParams().get("tab") === "scenarios" ? "scenarios" : "items";
  usePageView("capital", tab);
  const base = `/schemes/${schemeId}/capital-works`;
  const tabs = [
    { id: "items", href: base, label: t("capital.tabItems") },
    { id: "scenarios", href: `${base}?tab=scenarios`, label: t("capital.tabScenarios") },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title={t("capital.title")} description={t("capital.subtitle")} />
      {!canWrite ? <InlineAlert tone="warn">{t("capital.readOnly")}</InlineAlert> : null}
      <nav aria-label={t("capital.tabsLabel")} className="flex gap-1 border-b border-line">
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
      {tab === "scenarios" ? <ScenariosTab /> : <ItemsTab />}
    </div>
  );
}
