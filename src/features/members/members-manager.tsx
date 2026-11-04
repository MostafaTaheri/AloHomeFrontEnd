"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Badge } from "@/components/ui/badge";
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
import { SchemeRole } from "@/lib/api/finance/enums";
import type { SchemeRoleName } from "@/lib/api/finance/types";
import { memberLabel, type MembersApi, type SchemeMember } from "@/lib/api/members";
import { useApiMutation } from "@/lib/query/use-api-mutation";
import { profileFor, type Region } from "@/lib/region/config";
import { phoneSchemaFor } from "@/lib/validation/auth";

const ROLES = SchemeRole.names;

/** Lists may serialise the role as a number; normalise to the name. */
function roleName(value: string | number): SchemeRoleName | null {
  if (SchemeRole.isName(value)) return value;
  return SchemeRole.fromNumber(Number(value)) ?? null;
}

export interface MembersSurface {
  api: MembersApi;
  /** Key of one list page. */
  listKey: (params: object) => QueryKey;
  /** Everything that depends on the member list (pages, dropdown options, residents...). */
  invalidate: QueryKey[];
}

/**
 * Members of one building: list, search, add (by mobile and name), edit role and name, remove.
 * Used by the back office and by the building panel with their own API surface; both write the
 * same memberships.
 */
export function MembersManager({
  schemeId,
  surface,
  region,
  canManage = true,
}: {
  schemeId: number;
  surface: MembersSurface;
  region: Region;
  canManage?: boolean;
}) {
  const { t, fmt } = useI18n();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<SchemeRoleName | "">("");
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const [editing, setEditing] = useState<SchemeMember | "new" | null>(null);
  const [removing, setRemoving] = useState<SchemeMember | null>(null);
  const deferredSearch = useDeferredValue(search.trim());

  const params = {
    page,
    pageSize: 20,
    search: deferredSearch || undefined,
    role: role || undefined,
    includeRevoked,
  };
  const query = useQuery({
    queryKey: surface.listKey(params),
    queryFn: ({ signal }) => surface.api.list(schemeId, params, signal),
    placeholderData: (previous) => previous,
  });

  const remove = useApiMutation({
    mutationFn: (member: SchemeMember) => surface.api.remove(schemeId, member.userId),
    invalidate: surface.invalidate,
    success: "members.removed",
    onSuccess: () => setRemoving(null),
  });

  const filtered = Boolean(deferredSearch || role || includeRevoked);
  const resetPage = () => setPage(1);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t("members.title")}
          description={t("members.subtitle")}
          actions={
            canManage ? (
              <Button size="sm" onClick={() => setEditing("new")}>
                {t("members.add")}
              </Button>
            ) : null
          }
        />
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <div className="min-w-56 flex-1">
            <Field id="members-search" label={t("members.search")}>
              <Input
                id="members-search"
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
              />
            </Field>
          </div>
          <div className="w-44">
            <Field id="members-role" label={t("members.roleFilter")}>
              <Select
                id="members-role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as SchemeRoleName | "");
                  resetPage();
                }}
              >
                <option value="">{t("members.allRoles")}</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`enums.schemeRole.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeRevoked}
              onChange={(e) => {
                setIncludeRevoked(e.target.checked);
                resetPage();
              }}
            />
            {t("members.includeRevoked")}
          </label>
        </div>
      </Card>

      {query.isPending ? <ListSkeleton rows={4} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.items.length === 0 ? (
        filtered ? (
          <EmptyState title={t("members.emptyFiltered")} />
        ) : (
          <EmptyState
            title={t("members.empty")}
            body={t("members.emptyBody")}
            action={
              canManage ? (
                <Button size="sm" onClick={() => setEditing("new")}>
                  {t("members.add")}
                </Button>
              ) : undefined
            }
          />
        )
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t("members.colName")}</TH>
                  <TH>{t("members.colPhone")}</TH>
                  <TH>{t("members.colRole")}</TH>
                  <TH>{t("members.colStatus")}</TH>
                  <TH>{t("members.colSince")}</TH>
                  {canManage ? (
                    <TH>
                      <span className="sr-only">{t("common.actions")}</span>
                    </TH>
                  ) : null}
                </TR>
              </THead>
              <TBody>
                {query.data.items.map((m) => {
                  const active = m.status !== "Revoked";
                  return (
                    <TR key={m.id}>
                      <TD>
                        {m.fullName ? (
                          <span className="font-medium">{m.fullName}</span>
                        ) : (
                          <span className="text-muted">{t("members.noName")}</span>
                        )}
                      </TD>
                      <TD dir="ltr" className="text-start tabular-nums">
                        {m.phoneNumber ?? "—"}
                      </TD>
                      <TD>
                        <EnumBadge group="schemeRole" value={roleName(m.role) ?? m.role} />
                      </TD>
                      <TD>
                        <Badge tone={active ? "ok" : "neutral"}>
                          {active ? t("members.statusActive") : t("members.statusRevoked")}
                        </Badge>
                      </TD>
                      <TD>{fmt.date(m.createdAt)}</TD>
                      {canManage ? (
                        <TD>
                          {active ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="secondary" onClick={() => setEditing(m)}>
                                {t("common.edit")}
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => setRemoving(m)}>
                                {t("common.remove")}
                              </Button>
                            </div>
                          ) : null}
                        </TD>
                      ) : null}
                    </TR>
                  );
                })}
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
        </Card>
      ) : null}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("members.add") : t("members.edit")}
      >
        {editing !== null ? (
          <MemberForm
            key={editing === "new" ? "new" : editing.id}
            schemeId={schemeId}
            surface={surface}
            region={region}
            member={editing === "new" ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={removing !== null}
        title={t("members.removeTitle")}
        body={removing ? t("members.removeBody", { name: memberLabel(removing) }) : ""}
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

function MemberForm({
  schemeId,
  surface,
  region,
  member,
  onDone,
}: {
  schemeId: number;
  surface: MembersSurface;
  region: Region;
  member?: SchemeMember;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [phone, setPhone] = useState(member?.phoneNumber ?? "");
  const [firstName, setFirstName] = useState(member?.firstName ?? "");
  const [lastName, setLastName] = useState(member?.lastName ?? "");
  const [role, setRole] = useState<SchemeRoleName>((member && roleName(member.role)) || "ReadOnly");
  const [touched, setTouched] = useState(false);

  const parsedPhone = phoneSchemaFor(region).safeParse(phone);
  const phoneOk = Boolean(member) || parsedPhone.success;
  // A name is required for a new member; when editing, both or neither.
  const hasFirst = firstName.trim() !== "";
  const hasLast = lastName.trim() !== "";
  const nameOk = member ? hasFirst === hasLast : hasFirst && hasLast;

  const save = useApiMutation({
    mutationFn: () =>
      member
        ? surface.api.update(schemeId, member.userId, {
            role,
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
          })
        : surface.api.add(schemeId, {
            phoneNumber: parsedPhone.success ? parsedPhone.data : phone,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            role,
          }),
    invalidate: surface.invalidate,
    success: member ? "members.updated" : "members.added",
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
        if (!phoneOk || !nameOk || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      <Field
        id="member-phone"
        label={t("members.phone")}
        hint={
          member
            ? t("members.phoneLocked")
            : t("members.phoneHint", { example: profileFor(region).phoneExample })
        }
        error={
          touched && !phoneOk
            ? t("validation.phone", { example: profileFor(region).phoneExample })
            : undefined
        }
      >
        <Input
          id="member-phone"
          dir="ltr"
          type="tel"
          autoComplete="off"
          value={phone}
          hasHint
          readOnly={Boolean(member)}
          disabled={Boolean(member)}
          invalid={touched && !phoneOk}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="member-first"
          label={t("members.firstName")}
          error={touched && !nameOk ? t("members.nameRequired") : undefined}
        >
          <Input
            id="member-first"
            maxLength={100}
            value={firstName}
            invalid={touched && !nameOk}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </Field>
        <Field id="member-last" label={t("members.lastName")}>
          <Input
            id="member-last"
            maxLength={100}
            value={lastName}
            invalid={touched && !nameOk}
            onChange={(e) => setLastName(e.target.value)}
          />
        </Field>
      </div>
      <Field id="member-role" label={t("members.role")}>
        <Select
          id="member-role"
          value={role}
          onChange={(e) => setRole(e.target.value as SchemeRoleName)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`enums.schemeRole.${r}`)}
            </option>
          ))}
        </Select>
      </Field>
      {save.isError ? (
        <InlineAlert tone="danger">{describeError(save.error, t)}</InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("members.save")}
        </Button>
      </div>
    </form>
  );
}
