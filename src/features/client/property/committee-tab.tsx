"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DateField } from "@/components/forms/date-field";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { describeError, hasErrorCode } from "@/lib/api/error";
import { qk } from "@/lib/api/keys";
import {
  propertyApi,
  SCHEME_OFFICES,
  type OfficeHolder,
  type SchemeOfficeName,
} from "@/lib/api/property";
import { useSchemeMutation } from "../use-scheme-mutation";
import { useScheme } from "../workspace/scheme-provider";
import { usePartyLabel } from "./lot-dialog";
import { datesInOrder, parseParty } from "./parse";

const OFFICES = Object.keys(SCHEME_OFFICES) as SchemeOfficeName[];

export function CommitteeTab() {
  const { t, fmt } = useI18n();
  const { schemeId, can } = useScheme();
  const party = usePartyLabel();
  const canManage = can("ManageMembers");
  const [includeEnded, setIncludeEnded] = useState(false);
  const [appointing, setAppointing] = useState(false);
  const [ending, setEnding] = useState<OfficeHolder | null>(null);

  const query = useQuery({
    queryKey: qk.officeHolders(schemeId, includeEnded),
    queryFn: ({ signal }) => propertyApi.officeHolders(schemeId, includeEnded, { signal }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("property.committeeTitle")}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeEnded}
              onChange={(e) => setIncludeEnded(e.target.checked)}
            />
            {t("property.includeEnded")}
          </label>
          {canManage ? (
            <Button onClick={() => setAppointing(true)}>{t("property.appoint")}</Button>
          ) : null}
        </div>
      </div>
      {query.isPending ? <ListSkeleton rows={3} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          title={t("property.committeeEmptyTitle")}
          body={t("property.committeeEmptyBody")}
        />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <Card>
          <Table>
            <caption className="sr-only">{t("property.committeeTitle")}</caption>
            <THead>
              <TR>
                <TH>{t("property.office")}</TH>
                <TH>{t("property.holder")}</TH>
                <TH>{t("property.term")}</TH>
                <TH>{t("property.reference")}</TH>
                <TH>
                  <span className="sr-only">{t("common.actions")}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {query.data.map((h) => (
                <TR key={h.id}>
                  <TD>
                    <EnumBadge group="office" value={h.office} />
                  </TD>
                  <TD dir="auto">{party(h)}</TD>
                  <TD>
                    {h.termEnd
                      ? t("property.period", {
                          from: fmt.date(h.termStart),
                          to: fmt.date(h.termEnd),
                        })
                      : t("property.since", { from: fmt.date(h.termStart) })}{" "}
                    {h.isCurrent ? <Badge tone="ok">{t("property.current")}</Badge> : null}
                  </TD>
                  <TD dir="auto" className="text-muted">
                    {h.appointmentReference ?? t("common.none")}
                  </TD>
                  <TD className="text-end">
                    {canManage && !h.termEnd ? (
                      <Button size="sm" variant="ghost" onClick={() => setEnding(h)}>
                        {t("property.endTerm")}
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : null}

      <Dialog open={appointing} onClose={() => setAppointing(false)} title={t("property.appoint")}>
        {appointing ? <AppointForm onClose={() => setAppointing(false)} /> : null}
      </Dialog>
      <Dialog
        open={ending !== null}
        onClose={() => setEnding(null)}
        title={t("property.endTerm")}
        className="max-w-md"
      >
        {ending ? (
          <EndTermForm key={ending.id} holder={ending} onClose={() => setEnding(null)} />
        ) : null}
      </Dialog>
    </div>
  );
}

function AppointForm({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const [office, setOffice] = useState<SchemeOfficeName>("CommitteeMember");
  const [who, setWho] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reference, setReference] = useState("");
  const [touched, setTouched] = useState(false);
  const party = parseParty(who);
  const orderOk = datesInOrder(start, end);

  const save = useSchemeMutation({
    mutationFn: () =>
      propertyApi.appoint(schemeId, {
        office,
        userId: party?.userId,
        externalName: party?.partyName,
        termStart: start,
        termEnd: end || undefined,
        appointmentReference: reference.trim() || undefined,
      }),
    invalidate: [qk.property(schemeId), ["scheme", schemeId, "audit"]],
    success: "property.appointSaved",
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
        if (!party || !start || !orderOk || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      <Field id="appoint-office" label={t("property.office")}>
        <Select
          id="appoint-office"
          value={office}
          onChange={(e) => setOffice(e.target.value as SchemeOfficeName)}
        >
          {OFFICES.map((o) => (
            <option key={o} value={o}>
              {t(`enums.office.${o}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        id="appoint-who"
        label={t("property.holder")}
        hint={t("property.partyHint")}
        error={touched && !party ? t("property.partyRequired") : undefined}
      >
        <Input
          id="appoint-who"
          value={who}
          invalid={touched && !party}
          onChange={(e) => setWho(e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="appoint-start"
          label={t("property.termStart")}
          error={touched && !start ? t("property.dateRequired") : undefined}
        >
          <DateField
            id="appoint-start"
            value={start}
            onChange={setStart}
            invalid={touched && !start}
          />
        </Field>
        <Field
          id="appoint-end"
          label={t("property.termEnd")}
          optional={t("common.optional")}
          error={touched && !orderOk ? t("property.dateOrder") : undefined}
        >
          <DateField id="appoint-end" value={end} onChange={setEnd} invalid={touched && !orderOk} />
        </Field>
      </div>
      <Field
        id="appoint-ref"
        label={t("property.appointmentReference")}
        optional={t("common.optional")}
      >
        <Input
          id="appoint-ref"
          maxLength={200}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </Field>
      {save.isError ? (
        <InlineAlert tone="danger">
          {hasErrorCode(save.error, 420007)
            ? t("property.officeHeld")
            : describeError(save.error, t)}
        </InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("property.appoint")}
        </Button>
      </div>
    </form>
  );
}

function EndTermForm({ holder, onClose }: { holder: OfficeHolder; onClose: () => void }) {
  const { t } = useI18n();
  const { schemeId } = useScheme();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const orderOk = Boolean(date) && datesInOrder(holder.termStart, date);

  const save = useSchemeMutation({
    mutationFn: () => propertyApi.endTerm(schemeId, holder.id, date, reason.trim()),
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
      <Field
        id="term-end"
        label={t("property.termEnd")}
        error={touched && !orderOk ? t("property.dateOrder") : undefined}
      >
        <DateField id="term-end" value={date} onChange={setDate} invalid={touched && !orderOk} />
      </Field>
      <Field id="term-reason" label={t("property.endReason")} optional={t("common.optional")}>
        <Input
          id="term-reason"
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
          {t("property.endTerm")}
        </Button>
      </div>
    </form>
  );
}
