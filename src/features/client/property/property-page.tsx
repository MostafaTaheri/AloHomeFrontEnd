"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { usePageView } from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";
import { useScheme } from "../workspace/scheme-provider";
import { CommitteeTab } from "./committee-tab";
import { LotsTab } from "./lots-tab";

/** Lots, their owners and occupants over time, and the scheme's office holders (STR-03..05). */
export function PropertyPage() {
  const { t } = useI18n();
  const { schemeId, can } = useScheme();
  const tab = useSearchParams().get("tab") === "committee" ? "committee" : "lots";
  usePageView("property", tab);
  const base = `/schemes/${schemeId}/property`;
  const tabs = [
    { id: "lots", href: base, label: t("property.tabLots") },
    { id: "committee", href: `${base}?tab=committee`, label: t("property.tabCommittee") },
  ] as const;
  const readOnly = tab === "lots" ? !can("ManageProperty") : !can("ManageMembers");

  return (
    <div className="space-y-6">
      <PageHeader title={t("property.title")} description={t("property.subtitle")} />
      {readOnly ? <InlineAlert tone="warn">{t("property.readOnly")}</InlineAlert> : null}
      <nav aria-label={t("property.tabsLabel")} className="flex gap-1 border-b border-line">
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
      {tab === "committee" ? <CommitteeTab /> : <LotsTab />}
    </div>
  );
}
