"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { describeError, hasErrorCode } from "@/lib/api/error";
import { budgetsApi, type Budget } from "@/lib/api/finance/budgets";
import { qk } from "@/lib/api/keys";
import { useUrlState } from "@/lib/use-url-state";
import { cn } from "@/lib/utils";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";
import { BudgetLines } from "./budget-lines";
import { budgetYearBounds, parseFiscalYear } from "./parse";

export function VersionsTab() {
  const { t, fmt } = useI18n();
  const { schemeId, canWrite } = useScheme();
  const { params, update } = useUrlState();
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: qk.budgetList(schemeId),
    queryFn: ({ signal }) => budgetsApi.list(schemeId, undefined, { signal }),
  });
  const selectedId = params.get("budget");
  const selected = query.data?.find((b) => b.id === selectedId) ?? query.data?.[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("budgets.versionsTitle")}</h2>
        {canWrite ? <Button onClick={() => setCreating(true)}>{t("budgets.create")}</Button> : null}
      </div>
      {query.isPending ? <ListSkeleton rows={3} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          title={t("budgets.emptyTitle")}
          body={t("budgets.emptyBody")}
          action={
            canWrite ? (
              <Button onClick={() => setCreating(true)}>{t("budgets.create")}</Button>
            ) : undefined
          }
        />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ul className="space-y-2" aria-label={t("budgets.versionsTitle")}>
            {query.data.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  aria-current={selected?.id === b.id ? "true" : undefined}
                  onClick={() => update({ budget: b.id })}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-start text-sm",
                    selected?.id === b.id
                      ? "border-brand bg-brand-soft"
                      : "border-line bg-surface hover:bg-surface-2",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium" dir="auto">
                      {b.name}
                    </span>
                    <EnumBadge group="budgetStatus" value={b.status} />
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {fmt.fiscalYear(b.fiscalYear)} · {t("budgets.versionN", { n: b.versionNumber })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {selected ? <BudgetDetail key={selected.id} budget={selected} all={query.data} /> : null}
        </div>
      ) : null}
      <Dialog open={creating} onClose={() => setCreating(false)} title={t("budgets.create")}>
        {creating ? (
          <CreateBudgetForm
            budgets={query.data ?? []}
            onDone={(b) => {
              setCreating(false);
              update({ budget: b.id });
            }}
            onCancel={() => setCreating(false)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function BudgetDetail({ budget, all }: { budget: Budget; all: Budget[] }) {
  const { t, fmt } = useI18n();
  const { can, canWrite } = useScheme();
  const [approving, setApproving] = useState(false);
  const draft = budget.status === "Draft";
  const based = budget.basedOnBudgetId ? all.find((b) => b.id === budget.basedOnBudgetId) : null;

  return (
    <Card>
      <CardHeader
        title={budget.name}
        description={`${fmt.fiscalYear(budget.fiscalYear)} · ${t("budgets.versionN", { n: budget.versionNumber })}`}
        actions={
          <>
            <EnumBadge group="budgetStatus" value={budget.status} />
            {draft && can("ApproveBudgets") ? (
              <Button
                size="sm"
                onClick={() => setApproving(true)}
                disabled={budget.lines.length === 0}
              >
                {t("budgets.approve")}
              </Button>
            ) : null}
          </>
        }
      />
      <CardBody className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">{t("budgets.totalAdmin")}</dt>
            <dd className="font-semibold">
              <Money amount={budget.totalAdmin} currency={budget.currency} whole />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("budgets.totalCapital")}</dt>
            <dd className="font-semibold">
              <Money amount={budget.totalCapitalWorks} currency={budget.currency} whole />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("budgets.total")}</dt>
            <dd className="font-semibold">
              <Money amount={budget.total} currency={budget.currency} whole />
            </dd>
          </div>
        </dl>
        {budget.status === "Approved" || budget.status === "Superseded" ? (
          <p className="text-xs text-muted">
            {t("budgets.approvedLine", {
              reference: budget.approvalReference ?? t("common.none"),
              when: budget.approvedAtUtc ? fmt.dateTime(budget.approvedAtUtc) : t("common.none"),
            })}
          </p>
        ) : null}
        {budget.status === "Superseded" ? (
          <InlineAlert tone="warn">{t("budgets.supersededNote")}</InlineAlert>
        ) : null}
        {based ? (
          <p className="text-xs text-muted">{t("budgets.basedOn", { name: based.name })}</p>
        ) : null}
        {budget.notes ? (
          <p className="text-sm" dir="auto">
            {budget.notes}
          </p>
        ) : null}
        {draft && !canWrite ? (
          <p className="text-xs text-muted">{t("budgets.draftReadOnly")}</p>
        ) : null}
        <BudgetLines budget={budget} editable={draft && canWrite} />
      </CardBody>
      <Dialog
        open={approving}
        onClose={() => setApproving(false)}
        title={t("budgets.approveTitle")}
      >
        {approving ? (
          <ApproveForm budget={budget} others={all} onClose={() => setApproving(false)} />
        ) : null}
      </Dialog>
    </Card>
  );
}

function CreateBudgetForm({
  budgets,
  onDone,
  onCancel,
}: {
  budgets: Budget[];
  onDone: (budget: Budget) => void;
  onCancel: () => void;
}) {
  const { t, fmt } = useI18n();
  const { schemeId, scheme } = useScheme();
  const bounds = budgetYearBounds(scheme.currentFiscalYear);
  const [year, setYear] = useState(String(scheme.currentFiscalYear));
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [touched, setTouched] = useState(false);
  const fiscalYear = parseFiscalYear(year, bounds);

  const save = useSchemeMutation({
    mutationFn: () =>
      budgetsApi.create(schemeId, {
        fiscalYear: fiscalYear!,
        name: name.trim(),
        notes: notes.trim(),
        copyFromBudgetId: copyFrom || undefined,
      }),
    invalidate: [qk.budgets(schemeId)],
    success: "budgets.created",
    silentError: true,
    onSuccess: onDone,
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (fiscalYear === null || !name.trim() || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      <Field
        id="budget-year"
        label={t("budgets.fiscalYear")}
        hint={t("budgets.fiscalYearHint", {
          min: fmt.integer(bounds.min),
          max: fmt.integer(bounds.max),
        })}
        error={
          touched && fiscalYear === null
            ? t("budgets.fiscalYearInvalid", {
                min: fmt.integer(bounds.min),
                max: fmt.integer(bounds.max),
              })
            : undefined
        }
      >
        <Input
          id="budget-year"
          dir="ltr"
          inputMode="numeric"
          value={year}
          invalid={touched && fiscalYear === null}
          onChange={(e) => setYear(e.target.value)}
        />
      </Field>
      <Field
        id="budget-name"
        label={t("budgets.name")}
        error={touched && !name.trim() ? t("budgets.nameRequired") : undefined}
      >
        <Input
          id="budget-name"
          maxLength={200}
          value={name}
          invalid={touched && !name.trim()}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field
        id="budget-copy"
        label={t("budgets.copyFrom")}
        hint={t("budgets.copyFromHint")}
        optional={t("common.optional")}
      >
        <Select id="budget-copy" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
          <option value="">{t("budgets.startEmpty")}</option>
          {budgets.map((b) => (
            <option key={b.id} value={b.id}>
              {`${b.name} · ${fmt.fiscalYear(b.fiscalYear)} · ${t("budgets.versionN", { n: b.versionNumber })}`}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="budget-notes" label={t("common.notes")} optional={t("common.optional")}>
        <Input
          id="budget-notes"
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      {save.isError ? (
        <InlineAlert tone="danger">{describeError(save.error, t)}</InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("budgets.create")}
        </Button>
      </div>
    </form>
  );
}

function ApproveForm({
  budget,
  others,
  onClose,
}: {
  budget: Budget;
  others: Budget[];
  onClose: () => void;
}) {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const [reference, setReference] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const replacing = others.find(
    (b) => b.fiscalYear === budget.fiscalYear && b.status === "Approved" && b.id !== budget.id,
  );

  const save = useSchemeMutation({
    mutationFn: () => budgetsApi.approve(schemeId, budget.id, reference.trim()),
    invalidate: [
      qk.budgets(schemeId),
      ["scheme", schemeId, "audit"],
      ["scheme", schemeId, "onboarding"],
    ],
    success: "budgets.approved",
    silentError: true,
    onSuccess: () => {
      setConfirming(false);
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
        if (!reference.trim()) return;
        setConfirming(true);
      }}
    >
      <p className="text-sm text-muted">{t("budgets.approveBody")}</p>
      {replacing ? (
        <InlineAlert tone="warn">
          {t("budgets.supersedes", {
            name: replacing.name,
            year: fmt.fiscalYear(replacing.fiscalYear),
          })}
        </InlineAlert>
      ) : null}
      <Field
        id="approve-ref"
        label={t("budgets.approvalReference")}
        hint={t("budgets.approvalReferenceHint")}
        error={touched && !reference.trim() ? t("budgets.approvalReferenceRequired") : undefined}
      >
        <Input
          id="approve-ref"
          maxLength={200}
          value={reference}
          invalid={touched && !reference.trim()}
          onChange={(e) => setReference(e.target.value)}
        />
      </Field>
      {save.isError ? (
        <InlineAlert tone="danger">
          {hasErrorCode(save.error, 430003) ? t("budgets.noLines") : describeError(save.error, t)}
        </InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("budgets.approve")}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={t("budgets.approveConfirmTitle", { name: budget.name })}
        body={t("budgets.approveConfirmBody", { name: budget.name, reference: reference.trim() })}
        confirmLabel={t("budgets.approve")}
        busy={save.isPending}
        onConfirm={() => {
          if (!save.isPending) save.mutate(undefined);
          setConfirming(false);
        }}
        onClose={() => setConfirming(false)}
      />
    </form>
  );
}
