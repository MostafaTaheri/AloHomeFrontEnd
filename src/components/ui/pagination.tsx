"use client";

import { useI18n } from "@/i18n/provider";
import { Button } from "./button";

export function Pagination({
  page,
  totalPages,
  totalCount,
  onPageChange,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  if (totalPages <= 1 && totalCount === 0) return null;

  return (
    <nav
      aria-label={t("common.pageOf", { page, total: totalPages })}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm"
    >
      <p className="text-muted" aria-live="polite">
        {t("common.totalItems", { count: totalCount })} ·{" "}
        {t("common.pageOf", { page, total: totalPages })}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t("common.previous")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("common.next")}
        </Button>
      </div>
    </nav>
  );
}
