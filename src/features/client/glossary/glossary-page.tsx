"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { productApi } from "@/lib/api/governance";
import { qk } from "@/lib/api/keys";
import { usePageView } from "@/lib/telemetry/client";
import { useScheme } from "../workspace/scheme-provider";

/** The market's data dictionary (GOV-02): what each AloHome term means in this jurisdiction. */
export function GlossaryPage() {
  const { t, locale } = useI18n();
  const { scheme } = useScheme();
  const [search, setSearch] = useState("");
  usePageView("glossary", "list");

  const query = useQuery({
    queryKey: qk.dictionary(scheme.jurisdictionCode, locale),
    queryFn: ({ signal }) => productApi.dataDictionary(scheme.jurisdictionCode, { signal }),
    staleTime: Infinity,
  });

  const needle = search.trim().toLowerCase();
  const terms = (query.data?.terms ?? []).filter(
    (term) =>
      !needle ||
      [term.canonical, term.local, term.definition].some((v) => v.toLowerCase().includes(needle)),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("glossary.title")} description={t("glossary.subtitle")} />
      <div className="max-w-sm">
        <Field id="glossary-search" label={t("common.search")}>
          <Input
            id="glossary-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
      </div>
      {query.isPending ? <ListSkeleton rows={5} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && terms.length === 0 ? <EmptyState title={t("glossary.empty")} /> : null}
      {query.data && terms.length > 0 ? (
        <Card>
          <Table>
            <caption className="sr-only">
              {t("glossary.caption", { code: query.data.jurisdictionCode })}
            </caption>
            <THead>
              <TR>
                <TH>{t("glossary.local")}</TH>
                <TH>{t("glossary.canonical")}</TH>
                <TH>{t("glossary.definition")}</TH>
              </TR>
            </THead>
            <TBody>
              {terms.map((term) => (
                <TR key={term.key}>
                  <TD className="font-medium" dir="auto">
                    {term.local}
                  </TD>
                  <TD dir="ltr" className="text-muted">
                    {term.canonical}
                  </TD>
                  <TD dir="auto">{term.definition}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            {t("glossary.version", { version: query.data.version })}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
