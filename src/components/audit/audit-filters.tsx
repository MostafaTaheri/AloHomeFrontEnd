"use client";

import type { ReactNode } from "react";
import { DateField } from "@/components/forms/date-field";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { useI18n } from "@/i18n/provider";
import { AUDIT_CATEGORIES } from "@/lib/api/audit";

/** Category and date-range filters shared by the scheme and back-office audit screens. */
export function AuditFilters({
  category,
  from,
  to,
  onChange,
  onClear,
  rangeError,
  children,
}: {
  category: string;
  from: string;
  to: string;
  onChange: (patch: Record<string, string | null>) => void;
  onClear: () => void;
  rangeError?: boolean;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-48">
        <Field id="audit-category" label={t("audit.category")}>
          <Select
            id="audit-category"
            value={category}
            onChange={(e) => onChange({ category: e.target.value || null, page: null })}
          >
            <option value="">{t("common.all")}</option>
            {AUDIT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`enums.auditCategory.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="w-44">
        <Field id="audit-from" label={t("common.from")}>
          <DateField
            id="audit-from"
            value={from}
            onChange={(v) => onChange({ from: v, page: null })}
          />
        </Field>
      </div>
      <div className="w-44">
        <Field
          id="audit-to"
          label={t("common.to")}
          error={rangeError ? t("audit.rangeInvalid") : undefined}
        >
          <DateField
            id="audit-to"
            value={to}
            invalid={rangeError}
            onChange={(v) => onChange({ to: v, page: null })}
          />
        </Field>
      </div>
      {children}
      <Button variant="ghost" onClick={onClear}>
        {t("common.clearFilters")}
      </Button>
    </div>
  );
}
