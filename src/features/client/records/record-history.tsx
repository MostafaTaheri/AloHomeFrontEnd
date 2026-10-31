"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { EnumBadge, useEnumLabel } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import {
  recordHistoryApi,
  versionsNewestFirst,
  type FinancialRecordSnapshot,
  type SnapshotField,
} from "@/lib/api/finance/history";
import { qk } from "@/lib/api/keys";
import { useLookups } from "../expenses/lookups";
import { useScheme } from "../workspace/scheme-provider";

/** Small button that opens a record's version history. */
export function RecordHistoryButton({ recordId, label }: { recordId: string; label?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {label ?? t("history.open")}
      </Button>
      <RecordHistoryDialog recordId={open ? recordId : null} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * Every version of a financial record (FIN-08) with what changed and who changed it, plus where
 * the record came from (FIN-06). Records are never edited in place, so this is the full story.
 */
export function RecordHistoryDialog({
  recordId,
  onClose,
}: {
  recordId: string | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={recordId !== null}
      onClose={onClose}
      title={t("history.title")}
      className="max-w-3xl"
    >
      {recordId ? <HistoryBody recordId={recordId} /> : null}
    </Dialog>
  );
}

function HistoryBody({ recordId }: { recordId: string }) {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const query = useQuery({
    queryKey: qk.recordHistory(schemeId, recordId),
    queryFn: ({ signal }) => recordHistoryApi.history(schemeId, recordId, { signal }),
  });
  const show = useSnapshotValue();

  if (query.isPending) return <ListSkeleton rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const versions = versionsNewestFirst(query.data);
  const current = versions[0]?.snapshot;
  const previousOf = (n: number) => query.data.versions.find((v) => v.version === n - 1)?.snapshot;

  return (
    <div className="space-y-6">
      {current ? (
        <section aria-labelledby="provenance-heading" className="space-y-2">
          <h3 id="provenance-heading" className="text-sm font-semibold">
            {t("history.provenance")}
          </h3>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {(
              [
                "recordType",
                "status",
                "amount",
                "transactionDate",
                "supplierId",
                "categoryId",
                "fund",
              ] as const
            ).map((field) => (
              <div key={field}>
                <dt className="text-xs text-muted">{t(`history.fields.${field}`)}</dt>
                <dd>{show(field, current)}</dd>
              </div>
            ))}
            <div>
              <dt className="text-xs text-muted">{t("history.fields.sourceDocumentId")}</dt>
              <dd className="font-mono text-xs" dir="ltr">
                {current.sourceDocumentId}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("history.fields.importBatchId")}</dt>
              <dd>
                {current.importBatchId ? (
                  <Link
                    href={`/schemes/${schemeId}/imports/${current.importBatchId}`}
                    className="text-brand hover:underline"
                  >
                    {t("history.openImport")}
                  </Link>
                ) : (
                  t("history.enteredManually")
                )}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="versions-heading" className="space-y-3">
        <h3 id="versions-heading" className="text-sm font-semibold">
          {t("history.versions", { count: query.data.currentVersion })}
        </h3>
        <ol className="space-y-3">
          {versions.map((v) => {
            const previous = previousOf(v.version);
            return (
              <li key={v.version} className="rounded-md border border-line p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{t("history.version", { n: v.version })}</span>
                  <EnumBadge group="changeType" value={v.changeType} />
                  <span className="ms-auto text-xs text-muted">
                    {t("history.by", { user: v.changedBy, when: fmt.dateTime(v.changedAtUtc) })}
                  </span>
                </div>
                {v.reason ? (
                  <p className="mt-1 text-sm" dir="auto">
                    {v.reason}
                  </p>
                ) : null}
                {v.changed.length > 0 && previous ? (
                  <table className="mt-2 w-full text-xs">
                    <caption className="sr-only">
                      {t("history.changesCaption", { n: v.version })}
                    </caption>
                    <thead className="text-muted">
                      <tr>
                        <th scope="col" className="py-1 text-start font-medium">
                          {t("audit.field")}
                        </th>
                        <th scope="col" className="py-1 text-start font-medium">
                          {t("audit.before")}
                        </th>
                        <th scope="col" className="py-1 text-start font-medium">
                          {t("audit.after")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.changed.map((field) => (
                        <tr key={field} className="border-t border-line">
                          <th scope="row" className="py-1 pe-3 text-start font-medium">
                            {t(`history.fields.${field}`)}
                          </th>
                          <td className="py-1 pe-3 text-muted line-through">
                            {show(field, previous)}
                          </td>
                          <td className="py-1">{show(field, v.snapshot)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : v.version === 1 ? (
                  <p className="mt-1 text-xs text-muted">{t("history.created")}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/** Formats one snapshot field the way the rest of the app shows it. */
function useSnapshotValue() {
  const { t, fmt } = useI18n();
  const label = useEnumLabel();
  const lookups = useLookups();
  return function show(field: SnapshotField, snapshot: FinancialRecordSnapshot): ReactNode {
    const value = snapshot[field];
    if (value === null || value === undefined || value === "") return t("common.none");
    switch (field) {
      case "amount":
        return <Money amount={snapshot.amount} currency={snapshot.currency} />;
      case "transactionDate":
      case "dueDate":
        return fmt.date(String(value));
      case "supplierId":
        return lookups.supplierName(snapshot.supplierId) ?? t("expenses.unknownSupplier");
      case "categoryId":
        return lookups.categoryName(snapshot.categoryId) ?? t("expenses.uncategorised");
      case "fund":
        return label("fund", snapshot.fund);
      case "status":
        return label("recordStatus", snapshot.status);
      case "recordType":
        return label("recordType", snapshot.recordType);
      default:
        return <span dir="auto">{String(value)}</span>;
    }
  };
}
