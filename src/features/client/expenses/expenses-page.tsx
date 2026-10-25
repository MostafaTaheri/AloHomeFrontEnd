"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { useI18n } from "@/i18n/provider";
import { usePageView } from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";
import { useScheme } from "../workspace/scheme-provider";
import { FlagsTab } from "./flags-tab";
import { SpendTab } from "./spend-tab";

export function ExpensesPage() {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const tab = useSearchParams().get("tab") === "flags" ? "flags" : "spend";
  usePageView("expenses", tab);
  const base = `/schemes/${schemeId}/expenses`;

  const tabs = [
    { id: "spend", href: base, label: t("expenses.tabSpend") },
    { id: "flags", href: `${base}?tab=flags`, label: t("expenses.tabFlags") },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title={t("expenses.title")} description={t("expenses.subtitle")} />
      <nav aria-label={t("expenses.tabsLabel")} className="flex gap-1 border-b border-line">
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
      {tab === "flags" ? <FlagsTab /> : <SpendTab />}
    </div>
  );
}
