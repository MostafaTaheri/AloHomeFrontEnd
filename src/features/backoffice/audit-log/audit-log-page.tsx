"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AuditFilters } from "@/components/audit/audit-filters";
import { AuditList } from "@/components/audit/audit-list";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { auditApi, type AuditCategoryName } from "@/lib/api/audit";
import { qk } from "@/lib/api/keys";
import { usePageView } from "@/lib/telemetry/client";
import { useUrlState } from "@/lib/use-url-state";

const positive = (v: string | null) => (v && /^\d{1,9}$/.test(v) ? Number(v) : undefined);

/** Audit entries across every scheme and organisation (SEC-02). */
export function AuditLogPage() {
  const { t } = useI18n();
  const { params, update } = useUrlState();
  usePageView("backoffice", "audit-log");

  const category = (params.get("category") ?? "") as AuditCategoryName | "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const rangeError = Boolean(from && to && from > to);
  const filter = {
    category,
    fromUtc: from,
    toUtc: to,
    schemeId: positive(params.get("scheme")),
    organisationId: positive(params.get("organisation")),
    actorId: params.get("actor") ?? undefined,
    entityType: params.get("entityType") ?? undefined,
    entityId: params.get("entityId") ?? undefined,
    page,
    pageSize: 25,
  };

  const query = useQuery({
    queryKey: qk.bo.auditLog(filter),
    queryFn: ({ signal }) => auditApi.backoffice(filter, signal),
    enabled: !rangeError,
    placeholderData: (previous) => previous,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.auditLog")} description={t("audit.boSubtitle")} />
      <AuditFilters
        category={category}
        from={from}
        to={to}
        rangeError={rangeError}
        onChange={update}
        onClear={() =>
          update({
            category: null,
            from: null,
            to: null,
            scheme: null,
            organisation: null,
            actor: null,
            entityType: null,
            entityId: null,
            page: null,
          })
        }
      >
        <TextFilter id="audit-scheme" label={t("audit.scheme")} name="scheme" numeric />
        <TextFilter id="audit-org" label={t("audit.organisation")} name="organisation" numeric />
        <TextFilter id="audit-actor" label={t("audit.actorFilter")} name="actor" />
        <TextFilter id="audit-entity-type" label={t("audit.entityType")} name="entityType" />
        <TextFilter id="audit-entity-id" label={t("audit.entityId")} name="entityId" />
      </AuditFilters>
      {query.isPending && !rangeError ? <ListSkeleton rows={4} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.items.length === 0 ? (
        <EmptyState title={t("audit.emptyTitle")} body={t("audit.emptyBody")} />
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <Card>
          <AuditList entries={query.data.items} />
          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalCount={query.data.totalCount}
            onPageChange={(p) => update({ page: String(p) })}
            disabled={query.isFetching}
          />
        </Card>
      ) : null}
    </div>
  );
}

/** A free-text filter that only updates the URL when the field loses focus or Enter is pressed. */
function TextFilter({
  id,
  label,
  name,
  numeric,
}: {
  id: string;
  label: string;
  name: string;
  numeric?: boolean;
}) {
  const { params, update } = useUrlState();
  const [value, setValue] = useState(params.get(name) ?? "");
  const commit = () => update({ [name]: value.trim() || null, page: null });
  return (
    <div className={numeric ? "w-32" : "w-48"}>
      <Field id={id} label={label}>
        <Input
          id={id}
          dir="ltr"
          inputMode={numeric ? "numeric" : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
        />
      </Field>
    </div>
  );
}
