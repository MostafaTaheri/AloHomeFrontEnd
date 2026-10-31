"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { qk } from "@/lib/api/keys";
import { boOrganisationsApi } from "@/lib/api/organisations";
import { usePageView } from "@/lib/telemetry/client";
import { OrganisationForm } from "./organisation-form";

export function OrganisationsPage() {
  const { t } = useI18n();
  const router = useRouter();
  usePageView("backoffice", "organisations");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const params = { countryCode: country || undefined, page, pageSize: 20 };
  const query = useQuery({
    queryKey: qk.bo.organisations(params),
    queryFn: ({ signal }) => boOrganisationsApi.list(params, signal),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("organisations.title")}
        description={t("organisations.subtitle")}
        actions={<Button onClick={() => setCreating(true)}>{t("organisations.create")}</Button>}
      />
      <div className="w-48">
        <Field id="org-filter-country" label={t("organisations.country")}>
          <Select
            id="org-filter-country"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("common.all")}</option>
            <option value="AU">{t("organisations.countryAU")}</option>
            <option value="IR">{t("organisations.countryIR")}</option>
          </Select>
        </Field>
      </div>
      {query.isPending ? <ListSkeleton rows={4} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.items.length === 0 ? (
        <EmptyState title={t("organisations.emptyTitle")} body={t("organisations.emptyBody")} />
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <Card>
          <Table>
            <caption className="sr-only">{t("organisations.title")}</caption>
            <THead>
              <TR>
                <TH>{t("organisations.name")}</TH>
                <TH>{t("organisations.kind")}</TH>
                <TH>{t("organisations.country")}</TH>
                <TH>{t("common.status")}</TH>
              </TR>
            </THead>
            <TBody>
              {query.data.items.map((org) => (
                <TR key={org.id}>
                  <TD>
                    <Link
                      href={`/backoffice/organisations/${org.id}`}
                      className="font-medium text-brand hover:underline"
                      dir="auto"
                    >
                      {org.name}
                    </Link>
                  </TD>
                  <TD>
                    <EnumBadge group="orgKind" value={org.kind} />
                  </TD>
                  <TD dir="ltr">{org.countryCode}</TD>
                  <TD>
                    <EnumBadge group="orgStatus" value={org.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalCount={query.data.totalCount}
            onPageChange={setPage}
            disabled={query.isFetching}
          />
        </Card>
      ) : null}
      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title={t("organisations.create")}
        className="max-w-xl"
      >
        {creating ? (
          <OrganisationForm onDone={(org) => router.push(`/backoffice/organisations/${org.id}`)} />
        ) : null}
      </Dialog>
    </div>
  );
}
