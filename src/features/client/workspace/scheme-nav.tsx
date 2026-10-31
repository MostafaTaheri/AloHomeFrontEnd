"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/translator";
import type { SchemePermissionName } from "@/lib/api/finance/types";
import { activeItems } from "@/lib/features";
import { useGovernance } from "@/lib/query/use-governance";
import { cn } from "@/lib/utils";
import { useScheme } from "./scheme-provider";

interface Item {
  segment: string;
  label: MessageKey;
  /** Catalogue feature; the item is hidden while the feature is out of pilot scope. */
  feature?: string;
  /** Hidden for roles without this permission. */
  permission?: SchemePermissionName;
}

const ITEMS: Item[] = [
  { segment: "", label: "nav.health" },
  { segment: "imports", label: "nav.imports", feature: "imports" },
  { segment: "expenses", label: "nav.expenses", feature: "expense-intelligence" },
  { segment: "budgets", label: "nav.budgets", feature: "budgets" },
  { segment: "arrears", label: "nav.arrears", feature: "arrears-intelligence" },
  { segment: "capital-works", label: "nav.capitalWorks", feature: "capital-works" },
  { segment: "ai-review", label: "nav.aiReview", feature: "controlled-ai" },
  { segment: "reports", label: "nav.reports" },
  { segment: "property", label: "nav.property", feature: "scheme-structure" },
  { segment: "audit", label: "nav.auditLog", feature: "security-audit", permission: "ViewAudit" },
  { segment: "glossary", label: "nav.glossary" },
  { segment: "feedback", label: "nav.feedback", feature: "pilot-evidence" },
];

export function SchemeNav({ schemeId }: { schemeId: number }) {
  const { t } = useI18n();
  const { can } = useScheme();
  const pathname = usePathname();
  const governance = useGovernance();
  const base = `/schemes/${schemeId}`;
  const items = activeItems(ITEMS, governance.data?.features).filter(
    (item) => !item.permission || can(item.permission),
  );

  return (
    <nav aria-label={t("workspace.navLabel")} className="overflow-x-auto border-b border-line">
      <ul className="flex min-w-max gap-1">
        {items.map((item) => {
          const href = item.segment ? `${base}/${item.segment}` : base;
          const active = item.segment
            ? pathname === href || pathname.startsWith(`${href}/`)
            : pathname === base;
          return (
            <li key={item.segment || "health"}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-brand text-brand"
                    : "border-transparent text-muted hover:border-line hover:text-fg",
                )}
              >
                {t(item.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
