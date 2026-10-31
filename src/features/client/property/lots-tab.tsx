"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { schemesApi } from "@/lib/api/finance/endpoints";
import type { LotSummary } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { useScheme } from "../workspace/scheme-provider";
import { LotDialog } from "./lot-dialog";

export function LotsTab() {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<LotSummary | null>(null);

  const query = useQuery({
    queryKey: qk.lots(schemeId),
    queryFn: ({ signal }) => schemesApi.lots(schemeId, { signal }),
  });

  const needle = search.trim().toLowerCase();
  const lots = (query.data ?? []).filter(
    (lot) => !needle || lot.lotNumber.toLowerCase().includes(needle),
  );

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Field id="lot-search" label={t("property.searchLot")}>
          <Input
            id="lot-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
      </div>
      {query.isPending ? <ListSkeleton rows={4} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && lots.length === 0 ? (
        <EmptyState title={t("property.lotsEmptyTitle")} body={t("property.lotsEmptyBody")} />
      ) : null}
      {lots.length > 0 ? (
        <Card>
          <Table>
            <caption className="sr-only">{t("property.lotsCaption")}</caption>
            <THead>
              <TR>
                <TH>{t("property.lotNumber")}</TH>
                <TH>{t("property.floor")}</TH>
                <TH>{t("property.area")}</TH>
                <TH>
                  <span className="sr-only">{t("common.actions")}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {lots.map((lot) => (
                <TR key={lot.id}>
                  <TD className="font-medium" dir="ltr">
                    {lot.lotNumber}
                  </TD>
                  <TD>{fmt.integer(lot.floor)}</TD>
                  <TD>{t("property.areaValue", { area: fmt.number(lot.area) })}</TD>
                  <TD className="text-end">
                    <Button size="sm" variant="secondary" onClick={() => setOpen(lot)}>
                      {t("property.viewHolders")}
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : null}
      <LotDialog lot={open} onClose={() => setOpen(null)} />
    </div>
  );
}
