"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { MoneyInput } from "@/components/forms/money-input";
import { DateField } from "@/components/forms/date-field";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import { capitalWorksApi } from "@/lib/api/finance/endpoints";
import type { CapitalWorkItem } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { parseAmountInput } from "@/lib/format/amount";
import { calendarParts, todayIso } from "@/lib/region/dates";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";
import { parseYear, yearBounds } from "./parse";

type Priority = "Low" | "Medium" | "High" | "Critical";
type ItemStatus = "Planned" | "InProgress" | "Completed" | "Deferred" | "Cancelled";
const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Critical"];
const STATUSES: ItemStatus[] = ["Planned", "InProgress", "Completed", "Deferred", "Cancelled"];

export function ItemsTab() {
  const { t, fmt } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const [includeClosed, setIncludeClosed] = useState(false);
  const [editing, setEditing] = useState<CapitalWorkItem | "new" | null>(null);
  const [estimating, setEstimating] = useState<CapitalWorkItem | null>(null);

  const query = useQuery({
    queryKey: qk.capitalItems(schemeId, includeClosed),
    queryFn: ({ signal }) => capitalWorksApi.items(schemeId, includeClosed, { signal }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("capital.itemsTitle")}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeClosed}
              onChange={(e) => setIncludeClosed(e.target.checked)}
            />
            {t("capital.includeClosed")}
          </label>
          {canWrite ? (
            <Button onClick={() => setEditing("new")}>{t("capital.newItem")}</Button>
          ) : null}
        </div>
      </div>

      {query.isPending ? <ListSkeleton rows={4} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          title={t("capital.itemsEmptyTitle")}
          body={t("capital.itemsEmptyBody")}
          action={
            <Link href={`/schemes/${schemeId}/imports`} className="text-brand hover:underline">
              {t("capital.importPlan")}
            </Link>
          }
        />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <ul className="space-y-3">
          {query.data.map((item) => (
            <li key={item.id}>
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium" dir="auto">
                          {item.title}
                        </h3>
                        <EnumBadge group="priority" value={item.priority} />
                        <EnumBadge group="capStatus" value={item.status} />
                      </div>
                      <p className="text-xs text-muted">
                        {t("capital.targetYear")}: {fmt.fiscalYear(item.targetFiscalYear)}
                        {item.component ? ` · ${item.component}` : ""}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-xs text-muted">{t("capital.currentEstimate")}</p>
                      <p className="text-lg font-semibold">
                        <Money amount={item.currentEstimate} currency={item.currency} whole />
                      </p>
                    </div>
                  </div>
                  {item.description ? (
                    <p className="text-sm" dir="auto">
                      {item.description}
                    </p>
                  ) : null}
                  {item.estimates.length > 0 ? (
                    <details className="text-sm">
                      <summary className="cursor-pointer select-none text-muted hover:underline">
                        {t("capital.estimateHistory", {
                          count: fmt.integer(item.estimates.length),
                        })}
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {item.estimates.map((e) => (
                          <li key={e.id}>
                            {t("capital.estimateBy", {
                              amount: fmt.money(e.amount, item.currency, { whole: true }),
                              date: fmt.date(e.estimateDate),
                              user: e.createdBy,
                            })}
                            {e.source
                              ? ` · ${t("capital.estimateSource", { source: e.source })}`
                              : ""}
                            {e.note ? ` — ${e.note}` : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(item)}>
                        {t("capital.editItem")}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEstimating(item)}>
                        {t("capital.addEstimate")}
                      </Button>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      <ItemDialog target={editing} onClose={() => setEditing(null)} />
      <EstimateDialog item={estimating} onClose={() => setEstimating(null)} />
    </div>
  );
}

function ItemDialog({
  target,
  onClose,
}: {
  target: CapitalWorkItem | "new" | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  // Keyed on the target so each open starts from fresh values.
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={target === "new" ? t("capital.newItem") : t("capital.editItem")}
      className="max-w-xl"
    >
      {target !== null ? (
        <ItemForm key={target === "new" ? "new" : target.id} target={target} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function ItemForm({ target, onClose }: { target: CapitalWorkItem | "new"; onClose: () => void }) {
  const { t, fmt, currencyUnit } = useI18n();
  const { schemeId, currency } = useScheme();
  const bounds = yearBounds(fmt.context.calendar);
  const creating = target === "new";
  const existing = creating ? null : target;

  const sampleYear =
    calendarParts(todayIso(fmt.context.timeZone), fmt.context.calendar)?.year ?? bounds.min;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [component, setComponent] = useState(existing?.component ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [year, setYear] = useState(existing ? String(existing.targetFiscalYear) : "");
  const [priority, setPriority] = useState<Priority>((existing?.priority as Priority) ?? "Medium");
  const [status, setStatus] = useState<ItemStatus>((existing?.status as ItemStatus) ?? "Planned");
  const [estimate, setEstimate] = useState("");
  const [estimateDate, setEstimateDate] = useState("");
  const [source, setSource] = useState("");
  const [touched, setTouched] = useState(false);

  const mutation = useSchemeMutation({
    mutationFn: async () => {
      const targetFiscalYear = parseYear(year, bounds)!;
      if (existing) {
        return capitalWorksApi.updateItem(schemeId, existing.id, {
          title: title.trim(),
          component: component.trim(),
          description: description.trim(),
          targetFiscalYear,
          priority,
          status,
        });
      }
      const amount = parseAmountInput(estimate, { currency, unit: currencyUnit, allowZero: false });
      return capitalWorksApi.createItem(schemeId, {
        title: title.trim(),
        component: component.trim(),
        description: description.trim(),
        targetFiscalYear,
        priority,
        estimate: amount.ok ? amount.value : 0,
        estimateDate: estimateDate || undefined,
        estimateSource: source.trim() || undefined,
      });
    },
    invalidate: [qk.capital(schemeId), ["scheme", schemeId, "health"]],
    success: existing ? "capital.itemUpdated" : "capital.itemCreated",
    silentError: true,
    onSuccess: onClose,
  });

  const parsedAmount = parseAmountInput(estimate, {
    currency,
    unit: currencyUnit,
    allowZero: false,
  });
  const errors = {
    title: touched && !title.trim() ? t("capital.titleRequired") : undefined,
    year:
      touched && parseYear(year, bounds) === null
        ? t("capital.itemYearInvalid", {
            min: fmt.integer(bounds.min),
            max: fmt.integer(bounds.max),
          })
        : undefined,
    estimate: touched && creating && !parsedAmount.ok ? t("capital.amountInvalid") : undefined,
  };

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (mutation.isPending) return;
        if (!title.trim() || parseYear(year, bounds) === null || (creating && !parsedAmount.ok))
          return;
        mutation.mutate(undefined);
      }}
    >
      <Field id="cw-title" label={t("capital.itemTitle")} error={errors.title}>
        <Input
          id="cw-title"
          maxLength={200}
          value={title}
          invalid={Boolean(errors.title)}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="cw-component"
          label={t("capital.itemComponent")}
          hint={t("capital.itemComponentHint")}
          optional={t("common.optional")}
        >
          <Input
            id="cw-component"
            maxLength={100}
            value={component}
            onChange={(e) => setComponent(e.target.value)}
          />
        </Field>
        <Field
          id="cw-year"
          label={t("capital.itemYear")}
          hint={t("capital.itemYearHint", { example: fmt.fiscalYear(sampleYear) })}
          error={errors.year}
        >
          <Input
            id="cw-year"
            dir="ltr"
            inputMode="numeric"
            value={year}
            invalid={Boolean(errors.year)}
            onChange={(e) => setYear(e.target.value)}
          />
        </Field>
        <Field id="cw-priority" label={t("capital.itemPriority")}>
          <Select
            id="cw-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`enums.priority.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        {existing ? (
          <Field id="cw-status" label={t("capital.itemStatus")}>
            <Select
              id="cw-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ItemStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`enums.capStatus.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>
      <Field
        id="cw-description"
        label={t("capital.itemDescription")}
        optional={t("common.optional")}
      >
        <textarea
          id="cw-description"
          rows={3}
          maxLength={1000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
        />
      </Field>
      {creating ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cw-estimate" label={t("capital.itemEstimate")} error={errors.estimate}>
            <MoneyInput
              id="cw-estimate"
              currency={currency}
              value={estimate}
              onChange={setEstimate}
              invalid={Boolean(errors.estimate)}
            />
          </Field>
          <Field
            id="cw-estimate-date"
            label={t("capital.itemEstimateDate")}
            optional={t("common.optional")}
          >
            <DateField id="cw-estimate-date" value={estimateDate} onChange={setEstimateDate} />
          </Field>
          <div className="sm:col-span-2">
            <Field
              id="cw-source"
              label={t("capital.itemEstimateSource")}
              hint={t("capital.itemEstimateSourceHint")}
              optional={t("common.optional")}
            >
              <Input
                id="cw-source"
                maxLength={200}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </Field>
          </div>
        </div>
      ) : null}
      {mutation.isError ? (
        <InlineAlert tone="danger">{describeError(mutation.error, t)}</InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {t("capital.itemSave")}
        </Button>
      </div>
    </form>
  );
}

function EstimateDialog({ item, onClose }: { item: CapitalWorkItem | null; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog
      open={item !== null}
      onClose={onClose}
      title={item ? t("capital.estimateTitle", { title: item.title }) : ""}
      className="max-w-md"
    >
      {item ? <EstimateForm key={item.id} item={item} onClose={onClose} /> : null}
    </Dialog>
  );
}

function EstimateForm({ item, onClose }: { item: CapitalWorkItem; onClose: () => void }) {
  const { t, currencyUnit } = useI18n();
  const { schemeId, currency } = useScheme();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const parsed = parseAmountInput(amount, { currency, unit: currencyUnit, allowZero: false });
  const save = useSchemeMutation({
    mutationFn: () =>
      capitalWorksApi.addEstimate(schemeId, item.id, {
        amount: parsed.ok ? parsed.value : 0,
        estimateDate: date || undefined,
        source: source.trim() || undefined,
        note: note.trim() || undefined,
      }),
    invalidate: [qk.capital(schemeId), ["scheme", schemeId, "health"]],
    success: "capital.estimateSaved",
    silentError: true,
    onSuccess: onClose,
  });

  const error = touched && !parsed.ok ? t("capital.amountInvalid") : undefined;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!parsed.ok || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      <Field id="est-amount" label={t("capital.estimateAmount")} error={error}>
        <MoneyInput
          id="est-amount"
          currency={currency}
          value={amount}
          onChange={setAmount}
          invalid={Boolean(error)}
        />
      </Field>
      <Field id="est-date" label={t("capital.itemEstimateDate")} optional={t("common.optional")}>
        <DateField id="est-date" value={date} onChange={setDate} />
      </Field>
      <Field
        id="est-source"
        label={t("capital.itemEstimateSource")}
        optional={t("common.optional")}
      >
        <Input
          id="est-source"
          maxLength={200}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      </Field>
      <Field id="est-note" label={t("capital.estimateNote")}>
        <Input
          id="est-note"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      {save.isError ? (
        <InlineAlert tone="danger">{describeError(save.error, t)}</InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("capital.estimateSave")}
        </Button>
      </div>
    </form>
  );
}
