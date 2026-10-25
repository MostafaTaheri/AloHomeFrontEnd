"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { backofficeApi } from "@/lib/api/backoffice";
import { qk } from "@/lib/api/keys";
import { normalizeNumeric } from "@/lib/format/amount";
import { usePageView } from "@/lib/telemetry/client";
import { parseUserId } from "../schemes/parse";

export function AuditPage() {
  const { t, fmt } = useI18n();
  usePageView("backoffice", "access-log");
  const [schemeInput, setSchemeInput] = useState("");
  const [userInput, setUserInput] = useState("");
  const [filters, setFilters] = useState<{ schemeId?: number; userId?: string }>({});
  const [page, setPage] = useState(1);

  const schemeValid =
    schemeInput.trim() === "" || /^\d{1,9}$/.test(normalizeNumeric(schemeInput).trim());
  const userValid = userInput.trim() === "" || parseUserId(userInput) !== null;

  const params = { ...filters, page, pageSize: 25 };
  const query = useQuery({
    queryKey: qk.bo.audit(params),
    queryFn: ({ signal }) => backofficeApi.accessDeniedLogs(params, signal),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("backoffice.auditTitle")} description={t("backoffice.auditSubtitle")} />
      <form
        noValidate
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!schemeValid || !userValid) return;
          setFilters({
            schemeId: schemeInput.trim() ? Number(normalizeNumeric(schemeInput).trim()) : undefined,
            userId: userInput.trim() ? parseUserId(userInput)! : undefined,
          });
          setPage(1);
        }}
      >
        <div className="w-40">
          <Field
            id="audit-scheme"
            label={t("backoffice.filterScheme")}
            error={schemeValid ? undefined : t("backoffice.wholeInvalid")}
          >
            <Input
              id="audit-scheme"
              dir="ltr"
              inputMode="numeric"
              value={schemeInput}
              invalid={!schemeValid}
              onChange={(e) => setSchemeInput(e.target.value)}
            />
          </Field>
        </div>
        <div className="min-w-72 flex-1">
          <Field
            id="audit-user"
            label={t("backoffice.filterUser")}
            error={userValid ? undefined : t("backoffice.userIdInvalid")}
          >
            <Input
              id="audit-user"
              dir="ltr"
              value={userInput}
              invalid={!userValid}
              onChange={(e) => setUserInput(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={!schemeValid || !userValid}>
          {t("backoffice.applyFilters")}
        </Button>
      </form>

      {query.isPending ? <ListSkeleton rows={5} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.items.length === 0 ? (
        <EmptyState title={t("backoffice.auditEmpty")} />
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t("backoffice.colWhen")}</TH>
                  <TH>{t("backoffice.colUser")}</TH>
                  <TH>{t("backoffice.colScheme")}</TH>
                  <TH>{t("backoffice.colResource")}</TH>
                  <TH>{t("backoffice.colRequired")}</TH>
                </TR>
              </THead>
              <TBody>
                {query.data.items.map((l) => (
                  <TR key={l.id}>
                    <TD>{fmt.dateTime(l.occurredAt)}</TD>
                    <TD dir="ltr" className="font-mono text-xs">
                      {l.userId}
                    </TD>
                    <TD>{fmt.integer(l.schemeId)}</TD>
                    <TD dir="ltr" className="max-w-64 truncate">
                      {l.resource}
                    </TD>
                    <TD>{l.requiredAccess}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalCount={query.data.totalCount}
            onPageChange={setPage}
            disabled={query.isFetching}
          />
        </Card>
      ) : null}
    </div>
  );
}
