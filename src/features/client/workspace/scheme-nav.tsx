"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/translator";
import { cn } from "@/lib/utils";

interface Item {
  segment: string;
  label: MessageKey;
}

const ITEMS: Item[] = [
  { segment: "", label: "nav.health" },
  { segment: "imports", label: "nav.imports" },
  { segment: "expenses", label: "nav.expenses" },
  { segment: "arrears", label: "nav.arrears" },
  { segment: "capital-works", label: "nav.capitalWorks" },
  { segment: "ai-review", label: "nav.aiReview" },
  { segment: "reports", label: "nav.reports" },
  { segment: "feedback", label: "nav.feedback" },
];

export function SchemeNav({ schemeId }: { schemeId: number }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const base = `/schemes/${schemeId}`;

  return (
    <nav aria-label={t("workspace.navLabel")} className="overflow-x-auto border-b border-line">
      <ul className="flex min-w-max gap-1">
        {ITEMS.map((item) => {
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
