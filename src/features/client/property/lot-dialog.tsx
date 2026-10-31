"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DateField } from "@/components/forms/date-field";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import type { LotSummary } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { propertyApi, type LotRoleName, type LotTenure } from "@/lib/api/property";
import { todayIso } from "@/lib/region/dates";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";
import { checkTransfer, datesInOrder, parseParty, type OwnerRow } from "./parse";

type Mode = "view" | "transfer" | "occupy";

export function LotDialog({ lot, onClose }: { lot: LotSummary | null; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog
      open={lot !== null}
      onClose={onClose}
      title={lot ? t("property.lotTitle", { number: lot.lotNumber }) : ""}
      className="max-w-3xl"
    >
      {lot ? <LotBody key={lot.id} lot={lot} /> : null}
    </Dialog>
  );
}

/** A tenure's holder: an AloHome account, or the name recorded for someone without one. */
export function usePartyLabel() {
  const { t } = useI18n();
  return (holder: {
    userId: string | null;
    partyName?: string | null;
    externalName?: string | null;
    organisationId?: number | null;
  }) => {
    if (holder.partyName) return holder.partyName;
    if (holder.externalName) return holder.externalName;
    if (holder.userId) return t("property.account", { id: holder.userId.slice(0, 8) });
    if (holder.organisationId) return t("property.organisation", { id: holder.organisationId });
    return t("common.none");
  };
}

function LotBody({ lot }: { lot: LotSummary }) {
  const { t, fmt } = useI18n();
  const { schemeId, can } = useScheme();
  const party = usePartyLabel();
  const canManage = can("ManageProperty");
  const [asOf, setAsOf] = useState(() => todayIso(fmt.context.timeZone));
  const [mode, setMode] = useState<Mode>("view");
  const [ending, setEnding] = useState<LotTenure | null>(null);

  const holders = useQuery({
    queryKey: qk.holders(schemeId, lot.id, asOf),
    queryFn: ({ signal }) => propertyApi.holders(schemeId, lot.id, asOf || undefined, { signal }),
  });
  const tenures = useQuery({
    queryKey: qk.tenures(schemeId, lot.id),
    queryFn: ({ signal }) => propertyApi.tenures(schemeId, lot.id, { signal }),
  });

  return (
    <div className="space-y-6">
      <section aria-labelledby="holders-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 id="holders-heading" className="text-sm font-semibold">
            {t("property.holdersOn")}
          </h3>
          <div className="w-44">
            <Field id="holders-asof" label={t("property.asOf")}>
              <DateField id="holders-asof" value={asOf} onChange={setAsOf} />
            </Field>
          </div>
        </div>
        {holders.isPending ? <ListSkeleton rows={2} /> : null}
        {holders.isError ? (
          <ErrorState error={holders.error} onRetry={() => void holders.refetch()} />
        ) : null}
        {holders.data ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-xs font-medium text-muted">{t("property.owners")}</h4>
              {holders.data.owners.length === 0 ? (
                <p className="text-sm text-muted">{t("property.noOwners")}</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {holders.data.owners.map((o) => (
                    <li key={o.id} className="flex justify-between gap-2">
                      <span dir="auto">{party(o)}</span>
                      <span className="tabular-nums">
                        {fmt.percent(o.sharePercent, { digits: 2 })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {!holders.data.ownershipComplete ? (
                <div className="mt-2">
                  <InlineAlert tone="warn">
                    {t("property.ownershipIncomplete", {
                      share: fmt.percent(holders.data.ownedSharePercent, { digits: 2 }),
                    })}
                  </InlineAlert>
                </div>
              ) : null}
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted">{t("property.occupants")}</h4>
              {holders.data.occupants.length === 0 ? (
                <p className="text-sm text-muted">{t("property.noOccupants")}</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {holders.data.occupants.map((o) => (
                    <li key={o.id} className="flex justify-between gap-2">
                      <span dir="auto">{party(o)}</span>
                      <EnumBadge group="lotRole" value={o.role} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {canManage && mode === "view" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setMode("transfer")}>
            {t("property.transfer")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setMode("occupy")}>
            {t("property.addOccupant")}
          </Button>
        </div>
      ) : null}
      {mode === "transfer" ? <TransferForm lotId={lot.id} onDone={() => setMode("view")} /> : null}
      {mode === "occupy" ? <OccupancyForm lotId={lot.id} onDone={() => setMode("view")} /> : null}

      <section aria-labelledby="history-heading" className="space-y-3">
        <h3 id="history-heading" className="text-sm font-semibold">
          {t("property.history")}
        </h3>
        <p className="text-xs text-muted">{t("property.historyHint")}</p>
        {tenures.isPending ? <ListSkeleton rows={3} /> : null}
        {tenures.isError ? (
          <ErrorState error={tenures.error} onRetry={() => void tenures.refetch()} />
        ) : null}
        {tenures.data && tenures.data.length === 0 ? (
          <p className="text-sm text-muted">{t("property.historyEmpty")}</p>
        ) : null}
        {tenures.data && tenures.data.length > 0 ? (
          <ol className="divide-y divide-line rounded-md border border-line">
            {tenures.data.map((tenure) => (
              <li key={tenure.id} className="flex flex-wrap items-start gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <EnumBadge group="tenureKind" value={tenure.kind} />
                    <EnumBadge group="lotRole" value={tenure.role} />
                    <EnumBadge group="tenureSource" value={tenure.source} />
                    <span className="font-medium" dir="auto">
                      {party(tenure)}
                    </span>
                    {tenure.sharePercent !== null ? (
                      <span className="tabular-nums text-muted">
                        {fmt.percent(tenure.sharePercent, { digits: 2 })}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted">
                    {tenure.endDate
                      ? t("property.period", {
                          from: fmt.date(tenure.startDate),
                          to: fmt.date(tenure.endDate),
                        })
                      : t("property.since", { from: fmt.date(tenure.startDate) })}
                    {tenure.reference ? ` · ${tenure.reference}` : ""}
                    {tenure.endReason ? ` · ${tenure.endReason}` : ""}
                  </p>
                </div>
                {canManage && !tenure.endDate ? (
                  <Button size="sm" variant="ghost" onClick={() => setEnding(tenure)}>
                    {t("property.end")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <EndTenureDialog tenure={ending} onClose={() => setEnding(null)} />
    </div>
  );
}

function TransferForm({ lotId, onDone }: { lotId: number; onDone: () => void }) {
  const { t, fmt } = useI18n();
  const { schemeId } = useScheme();
  const [date, setDate] = useState("");
  const [reference, setReference] = useState("");
  const [rows, setRows] = useState<OwnerRow[]>([{ party: "", share: "100" }]);
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const check = checkTransfer(rows);

  const save = useSchemeMutation({
    mutationFn: () =>
      propertyApi.transfer(schemeId, lotId, {
        effectiveDate: date,
        owners: check.owners!,
        reference: reference.trim() || undefined,
      }),
    invalidate: [qk.property(schemeId), ["scheme", schemeId, "audit"]],
    success: "property.transferSaved",
    silentError: true,
    onSuccess: () => {
      setConfirming(false);
      onDone();
    },
  });

  const update = (i: number, patch: Partial<OwnerRow>) =>
    setRows((current) => current.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <form
      noValidate
      className="space-y-4 rounded-md border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!date || !check.owners) return;
        setConfirming(true);
      }}
    >
      <h3 className="text-sm font-semibold">{t("property.transfer")}</h3>
      <p className="text-xs text-muted">{t("property.transferHint")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="transfer-date"
          label={t("property.effectiveDate")}
          error={touched && !date ? t("property.dateRequired") : undefined}
        >
          <DateField
            id="transfer-date"
            value={date}
            onChange={setDate}
            invalid={touched && !date}
          />
        </Field>
        <Field id="transfer-ref" label={t("property.reference")} optional={t("common.optional")}>
          <Input
            id="transfer-ref"
            maxLength={200}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t("property.newOwners")}</legend>
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Field
                id={`owner-${i}`}
                label={t("property.ownerParty")}
                hint={i === 0 ? t("property.partyHint") : undefined}
                error={
                  touched && check.rows[i] === "party" ? t("property.partyRequired") : undefined
                }
              >
                <Input
                  id={`owner-${i}`}
                  value={row.party}
                  invalid={touched && check.rows[i] === "party"}
                  onChange={(e) => update(i, { party: e.target.value })}
                />
              </Field>
            </div>
            <div className="w-28">
              <Field
                id={`share-${i}`}
                label={t("property.share")}
                error={
                  touched && check.rows[i] === "share" ? t("property.shareInvalid") : undefined
                }
              >
                <Input
                  id={`share-${i}`}
                  dir="ltr"
                  inputMode="decimal"
                  value={row.share}
                  invalid={touched && check.rows[i] === "share"}
                  onChange={(e) => update(i, { share: e.target.value })}
                />
              </Field>
            </div>
            {rows.length > 1 ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("property.removeOwner", { n: i + 1 })}
                onClick={() => setRows((current) => current.filter((_, j) => j !== i))}
              >
                {t("common.remove")}
              </Button>
            ) : null}
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={rows.length >= 10}
            onClick={() => setRows((current) => [...current, { party: "", share: "" }])}
          >
            {t("property.addOwner")}
          </Button>
          <p
            aria-live="polite"
            className={check.totalOk ? "text-sm text-muted" : "text-sm font-medium text-danger"}
          >
            {t("property.shareTotal", { total: fmt.percent(check.total, { digits: 2 }) })}
          </p>
        </div>
      </fieldset>
      {save.isError ? (
        <InlineAlert tone="danger">{describeError(save.error, t)}</InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("property.reviewTransfer")}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={t("property.confirmTransferTitle")}
        body={t("property.confirmTransferBody", {
          date: date ? fmt.date(date) : "",
          count: rows.length,
        })}
        confirmLabel={t("property.transfer")}
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

const OCCUPANT_ROLES: LotRoleName[] = ["Tenant", "Occupant", "FamilyMember", "Owner"];

function OccupancyForm({ lotId, onDone }: { lotId: number; onDone: () => void }) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const [role, setRole] = useState<LotRoleName>("Tenant");
  const [who, setWho] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reference, setReference] = useState("");
  const [touched, setTouched] = useState(false);
  const party = parseParty(who);
  const orderOk = datesInOrder(start, end);

  const save = useSchemeMutation({
    mutationFn: () =>
      propertyApi.startOccupancy(schemeId, lotId, {
        role,
        ...party!,
        startDate: start,
        endDate: end || undefined,
        reference: reference.trim() || undefined,
      }),
    invalidate: [qk.property(schemeId), ["scheme", schemeId, "audit"]],
    success: "property.occupancySaved",
    silentError: true,
    onSuccess: onDone,
  });

  return (
    <form
      noValidate
      className="space-y-4 rounded-md border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!party || !start || !orderOk || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      <h3 className="text-sm font-semibold">{t("property.addOccupant")}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="occ-role" label={t("property.role")}>
          <Select
            id="occ-role"
            value={role}
            onChange={(e) => setRole(e.target.value as LotRoleName)}
          >
            {OCCUPANT_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`enums.lotRole.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="occ-who"
          label={t("property.ownerParty")}
          hint={t("property.partyHint")}
          error={touched && !party ? t("property.partyRequired") : undefined}
        >
          <Input
            id="occ-who"
            value={who}
            invalid={touched && !party}
            onChange={(e) => setWho(e.target.value)}
          />
        </Field>
        <Field
          id="occ-start"
          label={t("property.startDate")}
          error={touched && !start ? t("property.dateRequired") : undefined}
        >
          <DateField id="occ-start" value={start} onChange={setStart} invalid={touched && !start} />
        </Field>
        <Field
          id="occ-end"
          label={t("property.endDate")}
          optional={t("common.optional")}
          error={touched && !orderOk ? t("property.dateOrder") : undefined}
        >
          <DateField id="occ-end" value={end} onChange={setEnd} invalid={touched && !orderOk} />
        </Field>
        <Field id="occ-ref" label={t("property.reference")} optional={t("common.optional")}>
          <Input
            id="occ-ref"
            maxLength={200}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
      </div>
      {save.isError ? (
        <InlineAlert tone="danger">{describeError(save.error, t)}</InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("property.saveOccupant")}
        </Button>
      </div>
    </form>
  );
}

function EndTenureDialog({ tenure, onClose }: { tenure: LotTenure | null; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog
      open={tenure !== null}
      onClose={onClose}
      title={t("property.endTitle")}
      className="max-w-md"
    >
      {tenure ? <EndTenureForm key={tenure.id} tenure={tenure} onClose={onClose} /> : null}
    </Dialog>
  );
}

function EndTenureForm({ tenure, onClose }: { tenure: LotTenure; onClose: () => void }) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const orderOk = Boolean(date) && datesInOrder(tenure.startDate, date);

  const save = useSchemeMutation({
    mutationFn: () => propertyApi.endTenure(schemeId, tenure.id, date, reason.trim()),
    invalidate: [qk.property(schemeId), ["scheme", schemeId, "audit"]],
    success: "property.endSaved",
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
        if (!orderOk || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      <p className="text-sm text-muted">{t("property.endBody")}</p>
      <Field
        id="end-date"
        label={t("property.endDate")}
        error={touched && !orderOk ? t("property.dateOrder") : undefined}
      >
        <DateField id="end-date" value={date} onChange={setDate} invalid={touched && !orderOk} />
      </Field>
      <Field id="end-reason" label={t("property.endReason")} optional={t("common.optional")}>
        <Input
          id="end-reason"
          maxLength={300}
          value={reason}
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
        <Button type="submit" loading={save.isPending}>
          {t("property.end")}
        </Button>
      </div>
    </form>
  );
}
