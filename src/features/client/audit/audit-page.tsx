"use client";

import { useQuery } from "@tanstack/react-query";
import { AuditFilters } from "@/components/audit/audit-filters";
import { AuditList } from "@/components/audit/audit-list";
import { Card, PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { auditApi, type AuditCategoryName } from "@/lib/api/audit";
import { qk } from "@/lib/api/keys";
import { usePageView } from "@/lib/telemetry/client";
import { useUrlState } from "@/lib/use-url-state";
import { useScheme } from "../workspace/scheme-provider";

/** The scheme's audit log (SEC-02), for roles with ViewAudit. */
export function AuditPage() {
  const { t } = useI18n();
  const { schemeId, can } = useScheme();
  const { params, update } = useUrlState();
  usePageView("audit", "scheme");

  const category = (params.get("category") ?? "") as AuditCategoryName | "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const rangeError = Boolean(from && to && from > to);
  const filter = { category, fromUtc: from, toUtc: to, page, pageSize: 25 };
  const allowed = can("ViewAudit");

  const query = useQuery({
    queryKey: qk.audit(schemeId, filter),
    queryFn: ({ signal }) => auditApi.scheme(schemeId, filter, { signal }),
    enabled: allowed && !rangeError,
    placeholderData: (previous) => previous,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("audit.title")} description={t("audit.subtitle")} />
      {!allowed ? (
        <EmptyState title={t("audit.forbiddenTitle")} body={t("audit.forbiddenBody")} />
      ) : (
        <>
          <AuditFilters
            category={category}
            from={from}
            to={to}
            rangeError={rangeError}
            onChange={update}
            onClear={() => update({ category: null, from: null, to: null, page: null })}
          />
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
        </>
      )}
    </div>
  );
}
