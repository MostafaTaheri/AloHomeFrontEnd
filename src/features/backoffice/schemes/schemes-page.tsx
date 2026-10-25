"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { backofficeApi } from "@/lib/api/backoffice";
import { activeName } from "@/lib/api/finance/enums";
import { qk } from "@/lib/api/keys";
import { usePageView } from "@/lib/telemetry/client";
import { SchemeForm } from "./scheme-form";

export function SchemesPage() {
  const { t } = useI18n();
  usePageView("backoffice", "schemes");
  const [status, setStatus] = useState<"" | "Active" | "Disabled">("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const params = { status: status || undefined, page, pageSize: 20 };
  const query = useQuery({
    queryKey: qk.bo.schemes(params),
    queryFn: ({ signal }) => backofficeApi.schemes(params, signal),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("backoffice.schemesTitle")}
        description={t("backoffice.schemesSubtitle")}
        actions={<Button onClick={() => setCreating(true)}>{t("backoffice.newScheme")}</Button>}
      />
      <div className="w-48">
        <Field id="bo-status" label={t("backoffice.filterStatus")}>
          <Select
            id="bo-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "" | "Active" | "Disabled");
              setPage(1);
            }}
          >
            <option value="">{t("common.all")}</option>
            <option value="Active">{t("enums.active.Active")}</option>
            <option value="Disabled">{t("enums.active.Disabled")}</option>
          </Select>
        </Field>
      </div>

      {query.isPending ? <ListSkeleton rows={5} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.items.length === 0 ? (
        <EmptyState
          title={t("backoffice.schemesEmptyTitle")}
          body={t("backoffice.schemesEmptyBody")}
        />
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t("backoffice.colTitle")}</TH>
                  <TH>{t("backoffice.colAddress")}</TH>
                  <TH>{t("backoffice.colJurisdiction")}</TH>
                  <TH>{t("backoffice.colCurrency")}</TH>
                  <TH>{t("backoffice.colStatus")}</TH>
                </TR>
              </THead>
              <TBody>
                {query.data.items.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">
                      <Link
                        href={`/backoffice/schemes/${s.id}`}
                        className="text-brand hover:underline"
                      >
                        {s.title}
                      </Link>
                    </TD>
                    <TD className="max-w-72 truncate" dir="auto">
                      {s.address}
                    </TD>
                    <TD dir="ltr">{s.jurisdictionCode}</TD>
                    <TD dir="ltr">{s.currencyCode}</TD>
                    <TD>
                      <EnumBadge group="active" value={activeName(s.status)} />
                    </TD>
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

      <Dialog open={creating} onClose={() => setCreating(false)} title={t("backoffice.newScheme")}>
        {creating ? <SchemeForm onDone={() => setCreating(false)} /> : null}
      </Dialog>
    </div>
  );
}
