"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import {
  backofficeApi,
  type BoLot,
  type BoSchemeDetail,
  type LotResident,
} from "@/lib/api/backoffice";
import { boMembersApi, memberLabel } from "@/lib/api/members";
import { MemberSelect } from "@/components/forms/member-select";
import { activeName, LotRole } from "@/lib/api/finance/enums";
import { OCCUPANT_ROLES, type LotRoleName } from "@/lib/api/property";
import { qk } from "@/lib/api/keys";
import { profileFor, regionForJurisdiction } from "@/lib/region/config";
import { useBoMutation } from "../use-bo-mutation";
import { parsePositive, parsePostal, parseWhole } from "./parse";

export function LotsSection({ scheme }: { scheme: BoSchemeDetail }) {
  const { t, fmt } = useI18n();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BoLot | "new" | null>(null);
  const [residentsOf, setResidentsOf] = useState<BoLot | null>(null);
  const [vacating, setVacating] = useState<BoLot | null>(null);

  const params = { page, pageSize: 20 };
  const query = useQuery({
    queryKey: qk.bo.lots(scheme.id, params),
    queryFn: ({ signal }) => backofficeApi.lots(scheme.id, params, signal),
    placeholderData: (previous) => previous,
  });

  const vacate = useBoMutation({
    mutationFn: (lot: BoLot) => backofficeApi.vacateLot(scheme.id, lot.id),
    invalidate: [["bo", "scheme", scheme.id]],
    success: "backoffice.lotVacated",
    silentError: true,
    onSuccess: () => setVacating(null),
  });
  const toggle = useBoMutation({
    mutationFn: (lot: BoLot) =>
      backofficeApi.changeLotStatus(
        scheme.id,
        lot.id,
        activeName(lot.status) === "Active" ? "Disabled" : "Active",
      ),
    invalidate: [["bo", "scheme", scheme.id]],
    success: "backoffice.statusChanged",
  });

  return (
    <Card>
      <CardHeader
        title={t("backoffice.lotsTitle")}
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            {t("backoffice.newLot")}
          </Button>
        }
      />
      {query.isPending ? (
        <div className="p-5">
          <ListSkeleton rows={4} />
        </div>
      ) : null}
      {query.isError ? (
        <div className="p-5">
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : null}
      {query.data && query.data.items.length === 0 ? (
        <div className="p-5">
          <EmptyState title={t("backoffice.lotsEmpty")} />
        </div>
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t("backoffice.colLot")}</TH>
                  <TH>{t("backoffice.colArea")}</TH>
                  <TH>{t("backoffice.colRooms")}</TH>
                  <TH>{t("backoffice.colFloor")}</TH>
                  <TH>{t("backoffice.colPostal")}</TH>
                  <TH>{t("backoffice.colStatus")}</TH>
                  <TH>
                    <span className="sr-only">{t("common.actions")}</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {query.data.items.map((lot) => (
                  <TR key={lot.id}>
                    <TD className="font-medium">{lot.lotNumber}</TD>
                    <TD>{fmt.number(lot.area, { maximumFractionDigits: 1 })}</TD>
                    <TD>{fmt.integer(lot.rooms)}</TD>
                    <TD>{fmt.integer(lot.floor)}</TD>
                    <TD dir="ltr">{lot.postalCode}</TD>
                    <TD>
                      <EnumBadge group="active" value={activeName(lot.status)} />
                      {lot.vacateAt ? (
                        <span className="ms-2 text-xs text-muted">
                          {t("backoffice.colVacated")}: {fmt.date(lot.vacateAt)}
                        </span>
                      ) : null}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(lot)}>
                          {t("common.edit")}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setResidentsOf(lot)}>
                          {t("backoffice.residents")}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate(lot)}
                        >
                          {activeName(lot.status) === "Active"
                            ? t("backoffice.disable")
                            : t("backoffice.enable")}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setVacating(lot)}>
                          {t("backoffice.vacate")}
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalCount={query.data.totalCount}
            onPageChange={setPage}
            disabled={query.isFetching}
          />
        </>
      ) : null}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("backoffice.newLot") : t("common.edit")}
      >
        {editing !== null ? (
          <LotForm
            key={editing === "new" ? "new" : editing.id}
            scheme={scheme}
            lot={editing === "new" ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={residentsOf !== null}
        onClose={() => setResidentsOf(null)}
        title={residentsOf ? t("backoffice.residentsTitle", { lot: residentsOf.lotNumber }) : ""}
      >
        {residentsOf ? <ResidentsPanel schemeId={scheme.id} lot={residentsOf} /> : null}
      </Dialog>
      <ConfirmDialog
        open={vacating !== null}
        title={t("backoffice.vacateTitle")}
        body={vacating ? t("backoffice.vacateBody", { lot: vacating.lotNumber }) : ""}
        confirmLabel={t("backoffice.vacate")}
        destructive
        busy={vacate.isPending}
        onConfirm={() => {
          if (vacating && !vacate.isPending) vacate.mutate(vacating);
        }}
        onClose={() => setVacating(null)}
      />
    </Card>
  );
}

function LotForm({
  scheme,
  lot,
  onDone,
}: {
  scheme: BoSchemeDetail;
  lot?: BoLot;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const region = regionForJurisdiction(scheme.jurisdictionCode) ?? "au";
  const digits = profileFor(region).postalCodeDigits;

  const [number, setNumber] = useState(lot?.lotNumber ?? "");
  const [area, setArea] = useState(lot ? String(lot.area) : "");
  const [rooms, setRooms] = useState(lot ? String(lot.rooms) : "");
  const [floor, setFloor] = useState(lot ? String(lot.floor) : "");
  const [postal, setPostal] = useState(lot?.postalCode ?? "");
  const [entitlement, setEntitlement] = useState("");
  const [touched, setTouched] = useState(false);

  const areaV = parsePositive(area);
  const roomsV = parseWhole(rooms, 100);
  const floorV = parseWhole(floor, 200);
  const postalV = parsePostal(postal, digits);
  const entV = parsePositive(entitlement);
  const valid =
    number.trim() &&
    areaV !== null &&
    roomsV !== null &&
    floorV !== null &&
    postalV !== null &&
    entV !== null;

  const save = useBoMutation({
    mutationFn: async () => {
      const input = {
        lotNumber: number.trim(),
        area: areaV!,
        rooms: roomsV!,
        floor: floorV!,
        postalCode: postalV!,
        entitlement: entV!,
      };
      return lot
        ? backofficeApi.updateLot(scheme.id, lot.id, input)
        : backofficeApi.createLot(scheme.id, { ...input, status: "Active" });
    },
    invalidate: [["bo", "scheme", scheme.id]],
    success: lot ? "backoffice.lotUpdated" : "backoffice.lotCreated",
    silentError: true,
    onSuccess: onDone,
  });

  const bad = (b: boolean, m: string) => (touched && b ? m : undefined);
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="lot-number"
          label={t("backoffice.fieldLotNumber")}
          error={bad(!number.trim(), t("backoffice.requiredField"))}
        >
          <Input
            id="lot-number"
            maxLength={50}
            value={number}
            invalid={touched && !number.trim()}
            onChange={(e) => setNumber(e.target.value)}
          />
        </Field>
        <Field
          id="lot-postal"
          label={t("backoffice.fieldPostal")}
          error={bad(postalV === null, t("backoffice.postalInvalid", { digits }))}
        >
          <Input
            id="lot-postal"
            dir="ltr"
            inputMode="numeric"
            value={postal}
            invalid={touched && postalV === null}
            onChange={(e) => setPostal(e.target.value)}
          />
        </Field>
        <Field
          id="lot-area"
          label={t("backoffice.fieldArea")}
          error={bad(areaV === null, t("backoffice.numberInvalid"))}
        >
          <Input
            id="lot-area"
            dir="ltr"
            inputMode="decimal"
            value={area}
            invalid={touched && areaV === null}
            onChange={(e) => setArea(e.target.value)}
          />
        </Field>
        <Field
          id="lot-rooms"
          label={t("backoffice.fieldRooms")}
          error={bad(roomsV === null, t("backoffice.wholeInvalid"))}
        >
          <Input
            id="lot-rooms"
            dir="ltr"
            inputMode="numeric"
            value={rooms}
            invalid={touched && roomsV === null}
            onChange={(e) => setRooms(e.target.value)}
          />
        </Field>
        <Field
          id="lot-floor"
          label={t("backoffice.fieldLotFloor")}
          error={bad(floorV === null, t("backoffice.wholeInvalid"))}
        >
          <Input
            id="lot-floor"
            dir="ltr"
            inputMode="numeric"
            value={floor}
            invalid={touched && floorV === null}
            onChange={(e) => setFloor(e.target.value)}
          />
        </Field>
        <Field
          id="lot-entitlement"
          label={t("backoffice.fieldEntitlement")}
          hint={t("backoffice.entitlementHint")}
          error={bad(entV === null, t("backoffice.numberInvalid"))}
        >
          <Input
            id="lot-entitlement"
            hasHint
            dir="ltr"
            inputMode="decimal"
            value={entitlement}
            invalid={touched && entV === null}
            onChange={(e) => setEntitlement(e.target.value)}
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
          {t("backoffice.lotSave")}
        </Button>
      </div>
    </form>
  );
}

/** The resident's actual role; lists may serialise it as a name or a number. */
function residentRole(r: LotResident): LotRoleName {
  if (LotRole.isName(r.role)) return r.role;
  return LotRole.fromNumber(Number(r.role)) ?? "Occupant";
}

/**
 * Residents of one lot. People are picked from the building's active members, so a member added
 * on either the back office or the building panel can be assigned here.
 */
function ResidentsPanel({ schemeId, lot }: { schemeId: number; lot: BoLot }) {
  const { t } = useI18n();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<LotRoleName>("Tenant");
  const [touched, setTouched] = useState(false);
  const invalidate = [["bo", "scheme", schemeId]];

  const residents = useQuery({
    queryKey: qk.bo.residents(schemeId, lot.id),
    queryFn: ({ signal }) => backofficeApi.residents(schemeId, lot.id, signal),
  });
  const options = useQuery({
    queryKey: qk.bo.memberOptions(schemeId),
    queryFn: ({ signal }) => boMembersApi.options(schemeId, signal),
  });
  const lotsParams = { page: 1, pageSize: 200 };
  const lots = useQuery({
    queryKey: qk.bo.lots(schemeId, lotsParams),
    queryFn: ({ signal }) => backofficeApi.lots(schemeId, lotsParams, signal),
  });

  const assign = useBoMutation({
    mutationFn: () => backofficeApi.assignResident(schemeId, lot.id, { userId, role }),
    invalidate,
    success: "backoffice.assigned",
    onSuccess: () => {
      setUserId("");
      setTouched(false);
    },
  });
  const change = useBoMutation({
    mutationFn: (vars: { userId: string; role: LotRoleName }) =>
      backofficeApi.changeResidentRole(schemeId, lot.id, vars.userId, vars.role),
    invalidate,
    success: "backoffice.roleChanged",
  });
  const remove = useBoMutation({
    mutationFn: (resident: LotResident) =>
      backofficeApi.removeResident(schemeId, lot.id, resident.userId),
    invalidate,
    success: "backoffice.removed",
  });
  const move = useBoMutation({
    mutationFn: (vars: { userId: string; toLotId: number; role: LotRoleName }) =>
      backofficeApi.moveResident(schemeId, lot.id, vars.userId, {
        toLotId: vars.toLotId,
        role: vars.role,
      }),
    invalidate,
    success: "backoffice.moved",
  });
  const busy = assign.isPending || change.isPending || remove.isPending || move.isPending;
  const assigned = (residents.data ?? []).map((r) => r.userId);
  const otherLots = (lots.data?.items ?? []).filter((l) => l.id !== lot.id);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t("backoffice.residentsBody")}</p>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("backoffice.currentResidents")}</h3>
        {residents.isPending ? <ListSkeleton rows={2} /> : null}
        {residents.isError ? (
          <ErrorState error={residents.error} onRetry={() => void residents.refetch()} />
        ) : null}
        {residents.data && residents.data.length === 0 ? (
          <p className="text-sm text-muted">{t("backoffice.noResidents")}</p>
        ) : null}
        {residents.data && residents.data.length > 0 ? (
          <ul className="divide-y divide-line rounded-md border border-line">
            {residents.data.map((r) => (
              <li key={r.userId} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-medium">{memberLabel(r)}</p>
                  {r.phoneNumber ? (
                    <p dir="ltr" className="text-start text-xs text-muted tabular-nums">
                      {r.phoneNumber}
                    </p>
                  ) : null}
                </div>
                <Select
                  id={`res-role-${r.userId}`}
                  aria-label={t("backoffice.changeRole")}
                  className="h-8 w-36"
                  value={residentRole(r)}
                  disabled={busy}
                  onChange={(e) => {
                    const next = e.target.value as LotRoleName;
                    if (next !== residentRole(r)) change.mutate({ userId: r.userId, role: next });
                  }}
                >
                  {OCCUPANT_ROLES.map((lr) => (
                    <option key={lr} value={lr}>
                      {t(`enums.lotRole.${lr}`)}
                    </option>
                  ))}
                </Select>
                <Select
                  id={`res-move-${r.userId}`}
                  aria-label={t("backoffice.moveResident")}
                  className="h-8 w-40"
                  value=""
                  disabled={busy || otherLots.length === 0}
                  onChange={(e) => {
                    const toLotId = Number(e.target.value);
                    if (toLotId > 0)
                      move.mutate({ userId: r.userId, toLotId, role: residentRole(r) });
                  }}
                >
                  <option value="">{t("backoffice.moveResident")}</option>
                  {otherLots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lotNumber}
                    </option>
                  ))}
                </Select>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => remove.mutate(r)}>
                  {t("backoffice.removeResident")}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <form
        noValidate
        className="space-y-3 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!userId || busy) return;
          assign.mutate(undefined);
        }}
      >
        <Field
          id="res-user"
          label={t("members.pick")}
          error={touched && !userId ? t("members.pickRequired") : undefined}
        >
          <MemberSelect
            id="res-user"
            options={options.data}
            loading={options.isPending}
            value={userId}
            exclude={assigned}
            invalid={touched && !userId}
            onChange={setUserId}
          />
        </Field>
        {options.isError ? (
          <InlineAlert tone="danger">{describeError(options.error, t)}</InlineAlert>
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Field id="res-role" label={t("backoffice.lotRole")}>
              <Select
                id="res-role"
                value={role}
                onChange={(e) => setRole(e.target.value as LotRoleName)}
              >
                {OCCUPANT_ROLES.map((lr) => (
                  <option key={lr} value={lr}>
                    {t(`enums.lotRole.${lr}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" size="sm" loading={assign.isPending}>
            {t("backoffice.assign")}
          </Button>
        </div>
      </form>
    </div>
  );
}
