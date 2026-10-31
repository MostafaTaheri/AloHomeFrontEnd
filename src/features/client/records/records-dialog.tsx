"use client";

import { useQueries } from "@tanstack/react-query";
import { useState } from "react";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { recordHistoryApi } from "@/lib/api/finance/history";
import { qk } from "@/lib/api/keys";
import { useLookups } from "../expenses/lookups";
import { useScheme } from "../workspace/scheme-provider";
import { RecordHistoryButton } from "./record-history";

const LIMIT = 20;

/** Button that opens the source records behind a figure. Hidden when there are none. */
export function SourceRecordsButton({
  recordIds,
  title,
  label,
}: {
  recordIds: string[];
  title: string;
  label?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (recordIds.length === 0) return null;
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {label ?? t("history.sourceRecords", { count: recordIds.length })}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} className="max-w-3xl">
        {open ? <RecordsTable recordIds={recordIds} /> : null}
      </Dialog>
    </>
  );
}

/**
 * The records behind a figure, loaded by id. Each row reads its current version, so amounts and
 * names are the ones the books hold now. Long lists show the first {LIMIT} and say so.
 */
function RecordsTable({ recordIds }: { recordIds: string[] }) {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const lookups = useLookups();
  const ids = recordIds.slice(0, LIMIT);
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: qk.recordHistory(schemeId, id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        recordHistoryApi.history(schemeId, id, { signal }),
    })),
  });

  if (results.some((r) => r.isPending)) return <ListSkeleton rows={Math.min(ids.length, 5)} />;
  const failed = results.filter((r) => r.isError).length;

  return (
    <div className="space-y-3">
      {recordIds.length > LIMIT ? (
        <InlineAlert tone="warn">
          {t("history.limited", { shown: LIMIT, total: recordIds.length })}
        </InlineAlert>
      ) : null}
      {failed > 0 ? (
        <InlineAlert tone="warn">{t("history.someFailed", { count: failed })}</InlineAlert>
      ) : null}
      <Table>
        <THead>
          <TR>
            <TH>{t("history.fields.transactionDate")}</TH>
            <TH>{t("history.fields.description")}</TH>
            <TH>{t("history.fields.supplierId")}</TH>
            <TH>{t("history.fields.amount")}</TH>
            <TH>{t("history.fields.status")}</TH>
            <TH>
              <span className="sr-only">{t("history.open")}</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {results.map((r, i) => {
            const versions = r.data?.versions ?? [];
            const latest = versions.length
              ? versions.reduce((a, b) => (b.version > a.version ? b : a))
              : undefined;
            if (!latest) return null;
            const s = latest.snapshot;
            return (
              <TR key={ids[i]}>
                <TD>{fmt.date(s.transactionDate)}</TD>
                <TD dir="auto" className="max-w-64 truncate">
                  {s.description ?? s.externalReference ?? t("common.none")}
                </TD>
                <TD>{lookups.supplierName(s.supplierId) ?? t("expenses.unknownSupplier")}</TD>
                <TD>
                  <Money amount={s.amount} currency={s.currency} />
                </TD>
                <TD>
                  <EnumBadge group="recordStatus" value={s.status} />
                </TD>
                <TD className="text-end">
                  <RecordHistoryButton recordId={ids[i]!} />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
