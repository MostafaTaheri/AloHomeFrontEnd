"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";
import { useI18n } from "@/i18n/provider";
import { arrearsApi } from "@/lib/api/finance/endpoints";
import { qk } from "@/lib/api/keys";

export function LotHistoryDialog({
  lot,
  onClose,
}: {
  lot: { id: number; name: string } | null;
  onClose: () => void;
}) {
  const { t, fmt } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const [plan, setPlan] = useState<boolean | null>(null);
  const [note, setNote] = useState("");

  const query = useQuery({
    queryKey: qk.arrearsHistory(schemeId, lot?.id ?? 0),
    queryFn: ({ signal }) => arrearsApi.history(schemeId, lot!.id, {}, { signal }),
    enabled: lot !== null,
  });

  const save = useSchemeMutation({
    mutationFn: (vars: { lotId: number; has: boolean; note: string }) =>
      arrearsApi.setPaymentPlan(schemeId, vars.lotId, vars.has, vars.note),
    invalidate: [qk.arrears(schemeId)],
    success: "arrears.paymentPlanSaved",
  });

  const history = query.data;
  const hasPlan = plan ?? history?.hasPaymentPlan ?? false;

  return (
    <Dialog
      open={lot !== null}
      onClose={() => {
        setPlan(null);
        setNote("");
        onClose();
      }}
      title={lot ? t("arrears.historyTitle", { lot: lot.name }) : ""}
      className="max-w-3xl"
    >
      {query.isPending && lot ? <ListSkeleton rows={4} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {history ? (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">{t("arrears.opening")}</dt>
              <dd className="font-semibold">
                <Money amount={history.openingBalance} currency={history.currency} tone="balance" />
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t("arrears.closing")}</dt>
              <dd className="font-semibold">
                <Money amount={history.closingBalance} currency={history.currency} tone="balance" />
              </dd>
            </div>
          </dl>

          {history.lines.length === 0 ? (
            <p className="text-sm text-muted">{t("arrears.historyEmpty")}</p>
          ) : (
            <div className="max-h-72 overflow-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>{t("arrears.colDate")}</TH>
                    <TH>{t("arrears.colType")}</TH>
                    <TH>{t("arrears.colEffect")}</TH>
                    <TH>{t("arrears.colRunning")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {history.lines.map((line) => (
                    <TR key={line.record.id}>
                      <TD>{fmt.date(line.record.transactionDate)}</TD>
                      <TD>
                        <EnumBadge group="recordType" value={line.record.recordType} />
                      </TD>
                      <TD>
                        <Money amount={line.effect} currency={history.currency} signed />
                      </TD>
                      <TD>
                        <Money
                          amount={line.runningBalance}
                          currency={history.currency}
                          tone="balance"
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}

          {canWrite && lot ? (
            <form
              className="space-y-3 border-t border-line pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!save.isPending)
                  save.mutate({ lotId: lot.id, has: hasPlan, note: note.trim() });
              }}
            >
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={hasPlan}
                  onChange={(e) => setPlan(e.target.checked)}
                />
                {t("arrears.paymentPlanOn")}
              </label>
              {history.paymentPlanNote ? (
                <p className="text-xs text-muted">{history.paymentPlanNote}</p>
              ) : null}
              <Field id="plan-note" label={t("arrears.paymentPlanNote")}>
                <textarea
                  id="plan-note"
                  rows={2}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
                />
              </Field>
              <Button type="submit" size="sm" loading={save.isPending}>
                {t("arrears.paymentPlanSave")}
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}
