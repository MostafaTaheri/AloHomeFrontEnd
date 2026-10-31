"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/forms/money-input";
import { Money } from "@/components/finance/money";
import { useEnumLabel } from "@/components/finance/enum-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { describeError, hasErrorCode } from "@/lib/api/error";
import { budgetsApi, type Budget, type BudgetLine } from "@/lib/api/finance/budgets";
import type { FundName } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { amountToInput, parseAmountInput } from "@/lib/format/amount";
import { useLookups } from "../expenses/lookups";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";
import { checkPhasing, evenPhasing } from "./parse";

export function BudgetLines({ budget, editable }: { budget: Budget; editable: boolean }) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const label = useEnumLabel();
  const [editing, setEditing] = useState<BudgetLine | "new" | null>(null);
  const [deleting, setDeleting] = useState<BudgetLine | null>(null);

  const remove = useSchemeMutation({
    mutationFn: (line: BudgetLine) => budgetsApi.deleteLine(schemeId, budget.id, line.id),
    invalidate: [qk.budgets(schemeId)],
    success: "budgets.lineDeleted",
    onSuccess: () => setDeleting(null),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("budgets.lines")}</h3>
        {editable ? (
          <Button size="sm" onClick={() => setEditing("new")}>
            {t("budgets.addLine")}
          </Button>
        ) : null}
      </div>
      {budget.lines.length === 0 ? (
        <p className="text-sm text-muted">{t("budgets.linesEmpty")}</p>
      ) : (
        <Table>
          <caption className="sr-only">{t("budgets.lines")}</caption>
          <THead>
            <TR>
              <TH>{t("common.category")}</TH>
              <TH>{t("common.fund")}</TH>
              <TH className="text-end">{t("budgets.annualAmount")}</TH>
              <TH>{t("budgets.phasing")}</TH>
              <TH>{t("common.note")}</TH>
              {editable ? (
                <TH>
                  <span className="sr-only">{t("common.actions")}</span>
                </TH>
              ) : null}
            </TR>
          </THead>
          <TBody>
            {budget.lines.map((line) => (
              <TR key={line.id}>
                <TD dir="auto">{line.category ?? t("expenses.uncategorised")}</TD>
                <TD>{label("fund", line.fund)}</TD>
                <TD className="text-end">
                  <Money amount={line.annualAmount} currency={budget.currency} whole />
                </TD>
                <TD className="text-xs text-muted">
                  {line.phasing ? t("budgets.phasingCustom") : t("budgets.phasingEven")}
                </TD>
                <TD dir="auto" className="text-muted">
                  {line.note ?? t("common.none")}
                </TD>
                {editable ? (
                  <TD className="whitespace-nowrap text-end">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(line)}>
                      {t("common.edit")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(line)}>
                      {t("common.delete")}
                    </Button>
                  </TD>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("budgets.addLine") : t("budgets.editLine")}
        className="max-w-2xl"
      >
        {editing !== null ? (
          <LineForm
            key={editing === "new" ? "new" : editing.id}
            budget={budget}
            line={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        title={t("budgets.deleteLineTitle")}
        body={t("budgets.deleteLineBody")}
        confirmLabel={t("common.delete")}
        destructive
        busy={remove.isPending}
        onConfirm={() => {
          if (deleting && !remove.isPending) remove.mutate(deleting);
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function LineForm({
  budget,
  line,
  onClose,
}: {
  budget: Budget;
  line: BudgetLine | null;
  onClose: () => void;
}) {
  const { t, fmt, currencyUnit } = useI18n();
  const { schemeId, adminFundLabel, capitalWorksFundLabel } = useScheme();
  const lookups = useLookups();
  const [categoryId, setCategoryId] = useState(line?.categoryId ?? "");
  const [fund, setFund] = useState<FundName>((line?.fund as FundName) ?? "Admin");
  const [amount, setAmount] = useState(
    line ? amountToInput(line.annualAmount, budget.currency, currencyUnit) : "",
  );
  const [custom, setCustom] = useState(Boolean(line?.phasing));
  const [phasing, setPhasing] = useState<string[]>(
    line?.phasing ? line.phasing.map(String) : evenPhasing(),
  );
  const [note, setNote] = useState(line?.note ?? "");
  const [touched, setTouched] = useState(false);

  const parsed = parseAmountInput(amount, {
    currency: budget.currency,
    unit: currencyUnit,
    allowZero: true,
  });
  const phase = checkPhasing(phasing);
  const phasingOk = !custom || phase.values !== null;

  const save = useSchemeMutation({
    mutationFn: () => {
      const input = {
        categoryId: categoryId || undefined,
        fund,
        annualAmount: parsed.ok ? parsed.value : 0,
        phasing: custom ? phase.values : null,
        note: note.trim(),
      };
      return line
        ? budgetsApi.updateLine(schemeId, budget.id, line.id, input)
        : budgetsApi.addLine(schemeId, budget.id, input);
    },
    invalidate: [qk.budgets(schemeId)],
    success: "budgets.lineSaved",
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
        if (!parsed.ok || !phasingOk || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="line-category"
          label={t("common.category")}
          hint={line ? t("budgets.lineFixed") : undefined}
        >
          <Select
            id="line-category"
            value={categoryId}
            disabled={Boolean(line)}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{t("expenses.uncategorised")}</option>
            {lookups.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {lookups.categoryName(c.id)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="line-fund" label={t("common.fund")}>
          <Select
            id="line-fund"
            value={fund}
            disabled={Boolean(line)}
            onChange={(e) => setFund(e.target.value as FundName)}
          >
            <option value="Admin">{adminFundLabel}</option>
            <option value="CapitalWorks">{capitalWorksFundLabel}</option>
          </Select>
        </Field>
        <Field
          id="line-amount"
          label={t("budgets.annualAmount")}
          error={touched && !parsed.ok ? t("budgets.amountInvalid") : undefined}
        >
          <MoneyInput
            id="line-amount"
            currency={budget.currency}
            value={amount}
            onChange={setAmount}
            invalid={touched && !parsed.ok}
          />
        </Field>
        <Field id="line-note" label={t("common.note")} optional={t("common.optional")}>
          <Input
            id="line-note"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t("budgets.phasing")}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
          {t("budgets.phasingCustomToggle")}
        </label>
        {custom ? (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {phasing.map((value, i) => (
                <Field key={i} id={`phase-${i}`} label={t("budgets.periodN", { n: i + 1 })}>
                  <Input
                    id={`phase-${i}`}
                    dir="ltr"
                    inputMode="decimal"
                    value={value}
                    invalid={touched && phase.invalid.includes(i)}
                    onChange={(e) =>
                      setPhasing((current) => current.map((v, j) => (j === i ? e.target.value : v)))
                    }
                  />
                </Field>
              ))}
            </div>
            <p
              aria-live="polite"
              className={phase.values ? "text-sm text-muted" : "text-sm font-medium text-danger"}
            >
              {t("budgets.phasingTotal", { total: fmt.percent(phase.total, { digits: 2 }) })}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted">{t("budgets.phasingEvenHint")}</p>
        )}
      </fieldset>
      {save.isError ? (
        <InlineAlert tone="danger">
          {hasErrorCode(save.error, 430009)
            ? t("budgets.duplicateLine")
            : describeError(save.error, t)}
        </InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("budgets.saveLine")}
        </Button>
      </div>
    </form>
  );
}
