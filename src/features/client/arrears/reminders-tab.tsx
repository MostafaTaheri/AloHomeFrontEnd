"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DateField } from "@/components/forms/date-field";
import { MoneyInput } from "@/components/forms/money-input";
import { Definition } from "@/components/finance/freshness";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { describeError, hasErrorCode } from "@/lib/api/error";
import { remindersApi, type ReminderBatch } from "@/lib/api/finance/reminders";
import { qk } from "@/lib/api/keys";
import { normalizeNumeric, parseAmountInput } from "@/lib/format/amount";
import { track } from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";

/**
 * Reminder batches (ARR-08). Someone drafts a batch from the arrears snapshot; a second person
 * with ApproveReminders approves it before anything is sent. The API refuses self-approval.
 */
export function RemindersTab() {
  const { t, fmt } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: qk.reminders(schemeId),
    queryFn: ({ signal }) => remindersApi.list(schemeId, undefined, { signal }),
  });
  const selected = query.data?.find((b) => b.id === selectedId) ?? query.data?.[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("reminders.title")}</h2>
          <p className="text-sm text-muted">{t("reminders.subtitle")}</p>
        </div>
        {canWrite ? (
          <Button onClick={() => setCreating(true)}>{t("reminders.draft")}</Button>
        ) : null}
      </div>
      {query.isPending ? <ListSkeleton rows={3} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState title={t("reminders.emptyTitle")} body={t("reminders.emptyBody")} />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ul className="space-y-2" aria-label={t("reminders.title")}>
            {query.data.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  aria-current={selected?.id === b.id ? "true" : undefined}
                  onClick={() => setSelectedId(b.id)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-start text-sm",
                    selected?.id === b.id
                      ? "border-brand bg-brand-soft"
                      : "border-line bg-surface hover:bg-surface-2",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{fmt.date(b.asOf)}</span>
                    <EnumBadge group="reminderStatus" value={b.status} />
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {t("reminders.listLine", { count: b.items.length, sendable: b.sendableCount })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {selected ? <BatchDetail key={selected.id} batch={selected} /> : null}
        </div>
      ) : null}
      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title={t("reminders.draft")}
        className="max-w-xl"
      >
        {creating ? (
          <DraftForm
            onDone={(b) => {
              setCreating(false);
              setSelectedId(b.id);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function BatchDetail({ batch }: { batch: ReminderBatch }) {
  const { t, fmt } = useI18n();
  const { schemeId, can, canWrite } = useScheme();
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const draft = batch.status === "Draft";
  const invalidate = [qk.reminders(schemeId), ["scheme", schemeId, "audit"]];

  const exclude = useSchemeMutation({
    mutationFn: (lotId: number) => remindersApi.excludeLot(schemeId, batch.id, lotId),
    invalidate,
    success: "reminders.excluded",
  });
  const approve = useSchemeMutation({
    mutationFn: () => remindersApi.approve(schemeId, batch.id),
    invalidate,
    success: "reminders.approved",
    silentError: true,
    onSuccess: (result) => {
      track("reminders_reviewed", { status: "approved", count: result.sendableCount });
      setApproving(false);
    },
  });

  return (
    <Card>
      <CardHeader
        title={t("reminders.batchTitle", { date: fmt.date(batch.asOf) })}
        description={t("reminders.criteria", {
          amount: fmt.money(batch.minimumOverdue, batch.currency, { whole: true }),
          days: batch.minimumDaysOverdue,
        })}
        actions={
          <>
            <EnumBadge group="reminderStatus" value={batch.status} />
            {draft && can("ApproveReminders") ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setRejecting(true)}>
                  {t("reminders.reject")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setApproving(true)}
                  loading={approve.isPending}
                  disabled={batch.sendableCount === 0}
                >
                  {t("reminders.approve")}
                </Button>
              </>
            ) : null}
          </>
        }
      />
      <CardBody className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">{t("reminders.sendable")}</dt>
            <dd className="font-semibold">{fmt.integer(batch.sendableCount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("reminders.totalOverdue")}</dt>
            <dd className="font-semibold">
              <Money amount={batch.totalOverdue} currency={batch.currency} whole />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("reminders.author")}</dt>
            <dd className="font-mono text-xs" dir="ltr">
              {batch.createdBy}
            </dd>
          </div>
        </dl>
        {batch.includePaymentPlans ? (
          <Badge tone="warn">{t("reminders.includesPlans")}</Badge>
        ) : null}
        {batch.note ? (
          <p className="text-sm" dir="auto">
            {batch.note}
          </p>
        ) : null}
        {batch.status === "Rejected" && batch.rejectionReason ? (
          <InlineAlert tone="warn">
            {t("reminders.rejectedBecause", { reason: batch.rejectionReason })}
          </InlineAlert>
        ) : null}
        {batch.reviewedAtUtc ? (
          <p className="text-xs text-muted">
            {t("reminders.reviewedBy", {
              user: batch.reviewedBy ?? "",
              when: fmt.dateTime(batch.reviewedAtUtc),
            })}
          </p>
        ) : null}
        <div>
          <h3 className="text-xs font-medium text-muted">{t("reminders.preview")}</h3>
          <blockquote
            className="mt-1 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm"
            dir="auto"
          >
            {batch.messagePreview}
          </blockquote>
        </div>
        <Table>
          <caption className="sr-only">{t("reminders.itemsCaption")}</caption>
          <THead>
            <TR>
              <TH>{t("reminders.lot")}</TH>
              <TH className="text-end">{t("reminders.overdue")}</TH>
              <TH className="text-end">{t("reminders.days")}</TH>
              <TH>{t("common.status")}</TH>
              {draft && canWrite ? (
                <TH>
                  <span className="sr-only">{t("common.actions")}</span>
                </TH>
              ) : null}
            </TR>
          </THead>
          <TBody>
            {batch.items.map((item) => (
              <TR key={item.id}>
                <TD dir="ltr">
                  {item.lotNumber}
                  {item.hasPaymentPlan ? (
                    <Badge tone="neutral" className="ms-2">
                      {t("reminders.plan")}
                    </Badge>
                  ) : null}
                </TD>
                <TD className="text-end">
                  <Money amount={item.overdue} currency={batch.currency} whole />
                </TD>
                <TD className="text-end">{fmt.integer(item.daysOverdue)}</TD>
                <TD>
                  <EnumBadge group="reminderItemStatus" value={item.status} />
                  {item.skipReason ? (
                    <span className="block text-xs text-muted" dir="auto">
                      {item.skipReason}
                    </span>
                  ) : null}
                  {item.error ? (
                    <span className="block text-xs text-danger">{item.error}</span>
                  ) : null}
                </TD>
                {draft && canWrite ? (
                  <TD className="text-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={exclude.isPending}
                      onClick={() => exclude.mutate(item.lotId)}
                    >
                      {t("reminders.exclude")}
                    </Button>
                  </TD>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
        <Definition text={batch.definition} />
        {batch.disclaimer ? <p className="text-xs text-muted">{batch.disclaimer}</p> : null}
        {approve.isError ? (
          <InlineAlert tone="danger">
            {hasErrorCode(approve.error, 440003)
              ? t("reminders.selfApproval")
              : describeError(approve.error, t)}
          </InlineAlert>
        ) : null}
      </CardBody>
      <ConfirmDialog
        open={approving}
        title={t("reminders.approveTitle")}
        body={t("reminders.approveBody", { count: batch.sendableCount })}
        confirmLabel={t("reminders.approve")}
        busy={approve.isPending}
        onConfirm={() => {
          if (!approve.isPending) approve.mutate(undefined);
          setApproving(false);
        }}
        onClose={() => setApproving(false)}
      />
      <Dialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={t("reminders.rejectTitle")}
        className="max-w-md"
      >
        {rejecting ? <RejectForm batch={batch} onClose={() => setRejecting(false)} /> : null}
      </Dialog>
    </Card>
  );
}

function RejectForm({ batch, onClose }: { batch: ReminderBatch; onClose: () => void }) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const save = useSchemeMutation({
    mutationFn: () => remindersApi.reject(schemeId, batch.id, reason.trim()),
    invalidate: [qk.reminders(schemeId), ["scheme", schemeId, "audit"]],
    success: "reminders.rejected",
    silentError: true,
    onSuccess: () => {
      track("reminders_reviewed", { status: "rejected" });
      onClose();
    },
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!reason.trim() || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      <Field
        id="reject-reason"
        label={t("reminders.rejectReason")}
        error={touched && !reason.trim() ? t("reminders.rejectReasonRequired") : undefined}
      >
        <Input
          id="reject-reason"
          maxLength={500}
          value={reason}
          invalid={touched && !reason.trim()}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      {save.isError ? (
        <InlineAlert tone="danger">{describeError(save.error, t)}</InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="danger" loading={save.isPending}>
          {t("reminders.reject")}
        </Button>
      </div>
    </form>
  );
}

function DraftForm({
  onDone,
  onCancel,
}: {
  onDone: (batch: ReminderBatch) => void;
  onCancel: () => void;
}) {
  const { t, currencyUnit } = useI18n();
  const { schemeId, currency } = useScheme();
  const [asOf, setAsOf] = useState("");
  const [minimum, setMinimum] = useState("");
  const [days, setDays] = useState("30");
  const [plans, setPlans] = useState(false);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const amount = minimum.trim()
    ? parseAmountInput(minimum, { currency, unit: currencyUnit, allowZero: true })
    : ({ ok: true, value: 0 } as const);
  const dayText = normalizeNumeric(days);
  const dayValue = /^\d{1,4}$/.test(dayText) && Number(dayText) <= 3650 ? Number(dayText) : null;

  const save = useSchemeMutation({
    mutationFn: () =>
      remindersApi.create(schemeId, {
        asOf: asOf || undefined,
        minimumOverdue: amount.ok ? amount.value : 0,
        minimumDaysOverdue: dayValue ?? 30,
        includePaymentPlans: plans,
        note: note.trim(),
      }),
    invalidate: [qk.reminders(schemeId), ["scheme", schemeId, "audit"]],
    success: "reminders.drafted",
    silentError: true,
    onSuccess: (batch) => {
      track("reminders_drafted", { count: batch.items.length });
      onDone(batch);
    },
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!amount.ok || dayValue === null || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      <p className="text-sm text-muted">{t("reminders.draftBody")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rem-asof" label={t("reminders.asOf")} optional={t("common.optional")}>
          <DateField id="rem-asof" value={asOf} onChange={setAsOf} />
        </Field>
        <Field
          id="rem-days"
          label={t("reminders.minimumDays")}
          error={touched && dayValue === null ? t("reminders.daysInvalid") : undefined}
        >
          <Input
            id="rem-days"
            dir="ltr"
            inputMode="numeric"
            value={days}
            invalid={touched && dayValue === null}
            onChange={(e) => setDays(e.target.value)}
          />
        </Field>
        <Field
          id="rem-min"
          label={t("reminders.minimumOverdue")}
          optional={t("common.optional")}
          error={touched && !amount.ok ? t("reminders.amountInvalid") : undefined}
        >
          <MoneyInput
            id="rem-min"
            currency={currency}
            value={minimum}
            onChange={setMinimum}
            invalid={touched && !amount.ok}
          />
        </Field>
        <Field id="rem-note" label={t("common.note")} optional={t("common.optional")}>
          <Input
            id="rem-note"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={plans} onChange={(e) => setPlans(e.target.checked)} />
        {t("reminders.includePlans")}
      </label>
      {save.isError ? (
        <InlineAlert tone={hasErrorCode(save.error, 440004) ? "warn" : "danger"}>
          {hasErrorCode(save.error, 440004)
            ? t("reminders.noneQualify")
            : describeError(save.error, t)}
        </InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("reminders.draftSubmit")}
        </Button>
      </div>
    </form>
  );
}
