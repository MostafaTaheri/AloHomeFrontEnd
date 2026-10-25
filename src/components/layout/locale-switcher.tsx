"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/i18n/actions";
import { LOCALES, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const LABELS: Record<Locale, string> = { fa: "فارسی", en: "English" };

export function LocaleSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className="flex rounded-md border border-line p-0.5"
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          disabled={pending}
          aria-pressed={code === locale}
          onClick={() => {
            if (code === locale) return;
            startTransition(async () => {
              await setLocaleAction(code);
              router.refresh();
            });
          }}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            code === locale ? "bg-brand text-brand-fg" : "text-muted hover:text-fg",
          )}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
