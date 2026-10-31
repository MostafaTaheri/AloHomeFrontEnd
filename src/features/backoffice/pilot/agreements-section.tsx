"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DateField } from "@/components/forms/date-field";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Money } from "@/components/finance/money";
import { StatBox, StatGrid } from "@/components/finance/stat";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { describeError, hasErrorCode } from "@/lib/api/error";
import { qk } from "@/lib/api/keys";
import {
  boReadinessApi,
  type PilotAgreement,
  type PilotStatusName,
  type PilotTransitionName,
} from "@/lib/api/readiness";
import { normalizeNumeric } from "@/lib/format/amount";
import { useBoMutation } from "../use-bo-mutation";
import { allowedTransitions, checkTransition } from "./transition";

const STATUSES: PilotStatusName[] = ["Prospect", "Active", "Converted", "Lost"];

/** Pilot agreements and conversion metrics (GTM-09). Money is shown per currency. */
export function AgreementsSection({ schemes }: { schemes: { id: number; title: string }[] }) {
  const { t, fmt } = useI18n();
  const [status, setStatus] = useState<PilotStatusName | "">("");
  const [editing, setEditing] = useState<PilotAgreement | "new" | null>(null);
  const [moving, setMoving] = useState<PilotAgreement | null>(null);
  const title = (id: number) => schemes.find((s) => s.id === id)?.title ?? `#${id}`;

  const list = useQuery({
    queryKey: qk.bo.agreements(status),
    queryFn: ({ signal }) => boReadinessApi.agreements(status || undefined, signal),
  });
  const metrics = useQuery({
    queryKey: qk.bo.agreementMetrics,
    queryFn: ({ signal }) => boReadinessApi.metrics(signal),
  });
  const m = metrics.data;

  return (
    <Card>
      <CardHeader
        title={t("agreements.title")}
        description={t("agreements.subtitle")}
        actions={<Button onClick={() => setEditing("new")}>{t("agreements.create")}</Button>}
      />
      <CardBody className="space-y-5">
        {metrics.isError ? (
          <ErrorState error={metrics.error} onRetry={() => void metrics.refetch()} />
        ) : null}
        {m ? (
          <StatGrid>
            <StatBox
              label={t("agreements.byStatus")}
              value={STATUSES.map((s) => `${fmt.integer(m.byStatus[s] ?? 0)}`).join(" / ")}
              hint={STATUSES.map((s) => t(`enums.pilotStatus.${s}`)).join(" / ")}
            />
            <StatBox
              label={t("agreements.conversion")}
              value={
                m.conversionRatePercent === null
                  ? t("common.none")
                  : fmt.percent(m.conversionRatePercent)
              }
              hint={
                m.averageDaysToConvert === null
                  ? t("agreements.noConversions")
                  : t("agreements.avgDays", { days: m.averageDaysToConvert })
              }
            />
            <StatBox
              label={t("agreements.mrr")}
              value={<PerCurrency values={m.monthlyRecurringRevenue} />}
              hint={t("agreements.paidPilots", { count: m.paidPilots })}
            />
            <StatBox label={t("agreements.pipeline")} value={<PerCurrency values={m.pipeline} />} />
          </StatGrid>
        ) : null}
        <div className="w-48">
          <Field id="agreement-status" label={t("common.status")}>
            <Select
              id="agreement-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as PilotStatusName | "")}
            >
              <option value="">{t("common.all")}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`enums.pilotStatus.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {list.isPending ? <ListSkeleton rows={3} /> : null}
        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : null}
        {list.data && list.data.length === 0 ? <EmptyState title={t("agreements.empty")} /> : null}
        {list.data && list.data.length > 0 ? (
          <Table>
            <caption className="sr-only">{t("agreements.title")}</caption>
            <THead>
              <TR>
                <TH>{t("agreements.scheme")}</TH>
                <TH>{t("common.status")}</TH>
                <TH className="text-end">{t("agreements.monthly")}</TH>
                <TH>{t("agreements.dates")}</TH>
                <TH>{t("agreements.consent")}</TH>
                <TH>
                  <span className="sr-only">{t("common.actions")}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {list.data.map((a) => (
                <TR key={a.id}>
                  <TD dir="auto">{title(a.schemeId)}</TD>
                  <TD>
                    <EnumBadge group="pilotStatus" value={a.status} />
                    {a.isPaidPilot ? (
                      <span className="ms-1 text-xs text-muted">{t("agreements.paid")}</span>
                    ) : null}
                  </TD>
                  <TD className="text-end">
                    <Money amount={a.monthlyValue} currency={a.currency} />
                    <span className="block text-xs text-muted">
                      {t("agreements.perLot", {
                        price: fmt.money(a.pricePerLotMonthly, a.currency),
                        lots: a.lotCount,
                      })}
                    </span>
                  </TD>
                  <TD className="text-xs">
                    {a.startDate
                      ? t("agreements.started", { date: fmt.date(a.startDate) })
                      : t("common.none")}
                    {a.convertedOn
                      ? ` · ${t("agreements.convertedOn", { date: fmt.date(a.convertedOn) })}`
                      : ""}
                    {a.lostOn
                      ? ` · ${t("agreements.lostOn", { date: fmt.date(a.lostOn), reason: a.lostReason ?? "" })}`
                      : ""}
                  </TD>
                  <TD>{a.caseStudyConsent ? t("common.yes") : t("common.no")}</TD>
                  <TD className="whitespace-nowrap text-end">
                    {a.status !== "Lost" ? (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                        {t("common.edit")}
                      </Button>
                    ) : null}
                    {allowedTransitions(String(a.status)).length > 0 ? (
                      <Button size="sm" variant="secondary" onClick={() => setMoving(a)}>
                        {t("agreements.changeStatus")}
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : null}
      </CardBody>
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("agreements.create") : t("agreements.edit")}
        className="max-w-lg"
      >
        {editing !== null ? (
          <AgreementForm
            key={editing === "new" ? "new" : editing.id}
            existing={editing === "new" ? null : editing}
            schemes={schemes}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={moving !== null}
        onClose={() => setMoving(null)}
        title={t("agreements.changeStatus")}
        className="max-w-md"
      >
        {moving ? (
          <TransitionForm key={moving.id} agreement={moving} onClose={() => setMoving(null)} />
        ) : null}
      </Dialog>
    </Card>
  );
}

function PerCurrency({ values }: { values: Record<string, number> }) {
  const { t } = useI18n();
  const entries = Object.entries(values);
  if (entries.length === 0) return <>{t("common.none")}</>;
  return (
    <span className="flex flex-col">
      {entries.map(([currency, amount]) => (
        <Money key={currency} amount={amount} currency={currency} whole />
      ))}
    </span>
  );
}

const decimal = (text: string) => {
  const v = normalizeNumeric(text);
  return /^\d+(\.\d{1,2})?$/.test(v) ? Number(v) : null;
};

function AgreementForm({
  existing,
  schemes,
  onClose,
}: {
  existing: PilotAgreement | null;
  schemes: { id: number; title: string }[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [schemeId, setSchemeId] = useState(existing ? String(existing.schemeId) : "");
  const [price, setPrice] = useState(existing ? String(existing.pricePerLotMonthly) : "");
  const [lots, setLots] = useState(existing ? String(existing.lotCount) : "");
  const [paid, setPaid] = useState(existing?.isPaidPilot ?? false);
  const [baseline, setBaseline] = useState(existing?.baselineHoursPerMonth?.toString() ?? "");
  const [consent, setConsent] = useState(existing?.caseStudyConsent ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [touched, setTouched] = useState(false);
  const priceValue = decimal(price);
  const lotValue = lots.trim() ? decimal(lots) : undefined;
  const baselineValue = baseline.trim() ? decimal(baseline) : undefined;
  const valid =
    (existing || schemeId) && priceValue !== null && lotValue !== null && baselineValue !== null;

  const save = useBoMutation({
    mutationFn: () => {
      const input = {
        pricePerLotMonthly: priceValue!,
        lotCount: lotValue === undefined ? undefined : Math.round(lotValue!),
        isPaidPilot: paid,
        baselineHoursPerMonth: baselineValue ?? undefined,
        caseStudyConsent: consent,
        notes: notes.trim() || undefined,
      };
      return existing
        ? boReadinessApi.updateAgreement(existing.id, input)
        : boReadinessApi.createAgreement(Number(schemeId), input);
    },
    invalidate: [
      ["bo", "pilot-agreements"],
      ["bo", "scheme"],
    ],
    success: existing ? "agreements.updated" : "agreements.created",
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
        if (!valid || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      {!existing ? (
        <Field
          id="ag-scheme"
          label={t("agreements.scheme")}
          error={touched && !schemeId ? t("agreements.schemeRequired") : undefined}
        >
          <Select
            id="ag-scheme"
            value={schemeId}
            invalid={touched && !schemeId}
            onChange={(e) => setSchemeId(e.target.value)}
          >
            <option value="">{t("common.selectPlaceholder")}</option>
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="ag-price"
          label={t("agreements.price")}
          error={touched && priceValue === null ? t("agreements.numberInvalid") : undefined}
        >
          <Input
            id="ag-price"
            dir="ltr"
            inputMode="decimal"
            value={price}
            invalid={touched && priceValue === null}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <Field
          id="ag-lots"
          label={t("agreements.lotCount")}
          hint={t("agreements.lotCountHint")}
          optional={t("common.optional")}
          error={touched && lotValue === null ? t("agreements.numberInvalid") : undefined}
        >
          <Input
            id="ag-lots"
            dir="ltr"
            inputMode="numeric"
            value={lots}
            invalid={touched && lotValue === null}
            onChange={(e) => setLots(e.target.value)}
          />
        </Field>
        <Field
          id="ag-baseline"
          label={t("agreements.baseline")}
          optional={t("common.optional")}
          error={touched && baselineValue === null ? t("agreements.numberInvalid") : undefined}
        >
          <Input
            id="ag-baseline"
            dir="ltr"
            inputMode="decimal"
            value={baseline}
            invalid={touched && baselineValue === null}
            onChange={(e) => setBaseline(e.target.value)}
          />
        </Field>
        <Field id="ag-notes" label={t("common.notes")} optional={t("common.optional")}>
          <Input
            id="ag-notes"
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
        {t("agreements.isPaid")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        {t("agreements.consentLabel")}
      </label>
      {save.isError ? (
        <InlineAlert tone="danger">
          {hasErrorCode(save.error, 460003)
            ? t("agreements.alreadyOpen")
            : describeError(save.error, t)}
        </InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

function TransitionForm({
  agreement,
  onClose,
}: {
  agreement: PilotAgreement;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const options = allowedTransitions(String(agreement.status));
  const [transition, setTransition] = useState<PilotTransitionName>(options[0] ?? "Lose");
  const [date, setDate] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const problem = checkTransition(agreement, { transition, date, plannedEndDate: end, reason });

  const save = useBoMutation({
    mutationFn: () =>
      boReadinessApi.transition(agreement.id, {
        transition,
        date,
        plannedEndDate: transition === "Start" ? end : undefined,
        reason: transition === "Lose" ? reason.trim() : undefined,
      }),
    invalidate: [
      ["bo", "pilot-agreements"],
      ["bo", "scheme"],
    ],
    success: "agreements.statusChanged",
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
        if (problem || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      <Field id="tr-kind" label={t("agreements.transition")}>
        <Select
          id="tr-kind"
          value={transition}
          onChange={(e) => setTransition(e.target.value as PilotTransitionName)}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {t(`agreements.transition${o}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="tr-date" label={t("common.date")}>
        <DateField
          id="tr-date"
          value={date}
          onChange={setDate}
          invalid={touched && problem === "dateRequired"}
        />
      </Field>
      {transition === "Start" ? (
        <Field id="tr-end" label={t("agreements.plannedEnd")}>
          <DateField
            id="tr-end"
            value={end}
            onChange={setEnd}
            invalid={touched && problem === "endBeforeStart"}
          />
        </Field>
      ) : null}
      {transition === "Lose" ? (
        <Field id="tr-reason" label={t("agreements.lostReason")}>
          <Input
            id="tr-reason"
            maxLength={300}
            value={reason}
            invalid={touched && problem === "reasonRequired"}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      ) : null}
      {touched && problem ? (
        <InlineAlert tone="danger">{t(`agreements.problem_${problem}`)}</InlineAlert>
      ) : null}
      {save.isError ? (
        <InlineAlert tone="danger">{describeError(save.error, t)}</InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("common.confirm")}
        </Button>
      </div>
    </form>
  );
}
