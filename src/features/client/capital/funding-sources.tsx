"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/forms/money-input";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { describeError, hasErrorCode } from "@/lib/api/error";
import {
  capitalFundingApi,
  FUNDING_SOURCE_TYPES,
  fundingHeadroom,
  type FundingSourceTypeName,
} from "@/lib/api/finance/capital-funding";
import type { CapitalWorkFundingSource, CapitalWorkItem } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { parseAmountInput } from "@/lib/format/amount";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";

const SOURCE_TYPES = Object.keys(FUNDING_SOURCE_TYPES) as FundingSourceTypeName[];

/**
 * Where an item's money comes from (CAP-04). External sources (grants, insurance, loans, special
 * levies) reduce what the capital works fund has to cover in the funding projection.
 */
export function FundingSources({ item }: { item: CapitalWorkItem }) {
  const { t } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<CapitalWorkFundingSource | null>(null);
  const sources = item.fundingSources ?? [];

  const remove = useSchemeMutation({
    mutationFn: (source: CapitalWorkFundingSource) =>
      capitalFundingApi.removeSource(schemeId, item.id, source.id),
    invalidate: [qk.capital(schemeId), ["scheme", schemeId, "health"]],
    success: "capitalFunding.removed",
    onSuccess: () => setRemoving(null),
  });

  return (
    <div className="space-y-2 rounded-md border border-line p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="font-medium">{t("capitalFunding.title")}</h4>
        {canWrite ? (
          <Button size="sm" variant="secondary" className="ms-auto" onClick={() => setAdding(true)}>
            {t("capitalFunding.add")}
          </Button>
        ) : null}
      </div>
      {item.externalFunding !== undefined ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div>
            <dt className="inline text-muted">{t("capitalFunding.external")}: </dt>
            <dd className="inline font-medium">
              <Money amount={item.externalFunding} currency={item.currency} whole />
            </dd>
          </div>
          <div>
            <dt className="inline text-muted">{t("capitalFunding.fromFund")}: </dt>
            <dd className="inline font-medium">
              <Money amount={item.fundedFromCapitalWorksFund} currency={item.currency} whole />
            </dd>
          </div>
        </dl>
      ) : null}
      {sources.length === 0 ? (
        <p className="text-xs text-muted">{t("capitalFunding.empty")}</p>
      ) : (
        <ul className="divide-y divide-line">
          {sources.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-1.5">
              <EnumBadge group="fundingSource" value={s.sourceType} />
              <Money amount={s.amount} currency={item.currency} whole />
              <Badge tone={s.isConfirmed ? "ok" : "warn"}>
                {s.isConfirmed ? t("capitalFunding.confirmed") : t("capitalFunding.expected")}
              </Badge>
              {s.note ? (
                <span className="text-xs text-muted" dir="auto">
                  {s.note}
                </span>
              ) : null}
              {canWrite ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto"
                  onClick={() => setRemoving(s)}
                >
                  {t("common.remove")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title={t("capitalFunding.addTitle", { title: item.title })}
        className="max-w-md"
      >
        {adding ? <SourceForm item={item} onClose={() => setAdding(false)} /> : null}
      </Dialog>
      <ConfirmDialog
        open={removing !== null}
        title={t("capitalFunding.removeTitle")}
        body={t("capitalFunding.removeBody")}
        confirmLabel={t("common.remove")}
        destructive
        busy={remove.isPending}
        onConfirm={() => {
          if (removing && !remove.isPending) remove.mutate(removing);
        }}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}

function SourceForm({ item, onClose }: { item: CapitalWorkItem; onClose: () => void }) {
  const { t, fmt, currencyUnit } = useI18n();
  const { schemeId } = useScheme();
  const [type, setType] = useState<FundingSourceTypeName>("Grant");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const parsed = parseAmountInput(amount, {
    currency: item.currency,
    unit: currencyUnit,
    allowZero: false,
  });
  const { remaining } = fundingHeadroom(item);
  const tooMuch = parsed.ok && parsed.value > remaining;

  const save = useSchemeMutation({
    mutationFn: () =>
      capitalFundingApi.addSource(schemeId, item.id, {
        sourceType: type,
        amount: parsed.ok ? parsed.value : 0,
        isConfirmed: confirmed,
        note: note.trim(),
      }),
    invalidate: [qk.capital(schemeId), ["scheme", schemeId, "health"]],
    success: "capitalFunding.added",
    silentError: true,
    onSuccess: onClose,
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!parsed.ok || tooMuch || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      <Field id="src-type" label={t("capitalFunding.type")}>
        <Select
          id="src-type"
          value={type}
          onChange={(e) => setType(e.target.value as FundingSourceTypeName)}
        >
          {SOURCE_TYPES.map((s) => (
            <option key={s} value={s}>
              {t(`enums.fundingSource.${s}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        id="src-amount"
        label={t("common.amount")}
        hint={t("capitalFunding.remaining", {
          amount: fmt.money(remaining, item.currency, { whole: true }),
        })}
        error={
          touched && !parsed.ok
            ? t("capitalFunding.amountInvalid")
            : touched && tooMuch
              ? t("capitalFunding.overEstimate")
              : undefined
        }
      >
        <MoneyInput
          id="src-amount"
          currency={item.currency}
          value={amount}
          onChange={setAmount}
          invalid={touched && (!parsed.ok || tooMuch)}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {t("capitalFunding.isConfirmed")}
      </label>
      <Field id="src-note" label={t("common.note")} optional={t("common.optional")}>
        <Input
          id="src-note"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      {save.isError ? (
        <InlineAlert tone="danger">
          {hasErrorCode(save.error, 360102)
            ? t("capitalFunding.overEstimate")
            : describeError(save.error, t)}
        </InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("capitalFunding.add")}
        </Button>
      </div>
    </form>
  );
}
