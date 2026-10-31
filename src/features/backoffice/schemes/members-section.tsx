"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EnumBadge } from "@/components/finance/enum-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { backofficeApi, type SchemeMember } from "@/lib/api/backoffice";
import { SchemeRole } from "@/lib/api/finance/enums";
import type { SchemeRoleName } from "@/lib/api/finance/types";
import { qk } from "@/lib/api/keys";
import { useBoMutation } from "../use-bo-mutation";
import { parseUserId } from "./parse";

type Role = SchemeRoleName;
const ROLES = SchemeRole.names;

/** Members lists may serialise the role as a number; normalise to the name. */
function roleName(value: string | number): Role | null {
  if (SchemeRole.isName(value)) return value;
  return SchemeRole.fromNumber(Number(value)) ?? null;
}

export function MembersSection({ schemeId }: { schemeId: number }) {
  const { t, fmt } = useI18n();
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role>("ReadOnly");
  const [touched, setTouched] = useState(false);
  const [removing, setRemoving] = useState<SchemeMember | null>(null);

  const params = { page, pageSize: 20 };
  const query = useQuery({
    queryKey: qk.bo.members(schemeId, params),
    queryFn: ({ signal }) => backofficeApi.members(schemeId, params, signal),
    placeholderData: (previous) => previous,
  });

  const id = parseUserId(userId);
  const add = useBoMutation({
    mutationFn: () => backofficeApi.addMember(schemeId, { userId: id!, role }),
    invalidate: [["bo", "scheme", schemeId]],
    success: "backoffice.memberAdded",
    onSuccess: () => {
      setUserId("");
      setTouched(false);
    },
  });
  const change = useBoMutation({
    mutationFn: (vars: { userId: string; role: Role }) =>
      backofficeApi.changeMemberRole(schemeId, vars.userId, vars.role),
    invalidate: [["bo", "scheme", schemeId]],
    success: "backoffice.memberRoleChanged",
  });
  const remove = useBoMutation({
    mutationFn: (member: SchemeMember) => backofficeApi.removeMember(schemeId, member.userId),
    invalidate: [["bo", "scheme", schemeId]],
    success: "backoffice.memberRemoved",
    onSuccess: () => setRemoving(null),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={t("backoffice.membersTitle")}
          description={t("backoffice.membersBody")}
        />
        <CardBody>
          <form
            noValidate
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setTouched(true);
              if (!id || add.isPending) return;
              add.mutate(undefined);
            }}
          >
            <div className="min-w-72 flex-1">
              <Field
                id="member-user"
                label={t("backoffice.userId")}
                error={touched && !id ? t("backoffice.userIdInvalid") : undefined}
              >
                <Input
                  id="member-user"
                  dir="ltr"
                  value={userId}
                  invalid={touched && !id}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </Field>
            </div>
            <div className="w-44">
              <Field id="member-role" label={t("backoffice.memberRole")}>
                <Select
                  id="member-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`enums.schemeRole.${r}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="submit" loading={add.isPending}>
              {t("backoffice.addMember")}
            </Button>
          </form>
        </CardBody>
      </Card>

      {query.isPending ? <ListSkeleton rows={3} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && query.data.items.length === 0 ? (
        <EmptyState title={t("backoffice.membersEmpty")} />
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t("backoffice.colUser")}</TH>
                  <TH>{t("backoffice.colRole")}</TH>
                  <TH>{t("backoffice.colSince")}</TH>
                  <TH>
                    <span className="sr-only">{t("common.actions")}</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {query.data.items.map((m) => (
                  <TR key={m.id}>
                    <TD dir="ltr" className="font-mono text-xs">
                      {m.userId}
                    </TD>
                    <TD>
                      <EnumBadge group="schemeRole" value={roleName(m.role) ?? m.role} />
                    </TD>
                    <TD>{fmt.date(m.createdAt)}</TD>
                    <TD>
                      <div className="flex gap-2">
                        <Select
                          id={`member-role-${m.id}`}
                          aria-label={t("backoffice.changeRole")}
                          className="h-8 w-44"
                          value={roleName(m.role) ?? ""}
                          disabled={change.isPending}
                          onChange={(e) => {
                            const next = e.target.value as Role;
                            if (next !== roleName(m.role))
                              change.mutate({ userId: m.userId, role: next });
                          }}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {t(`enums.schemeRole.${r}`)}
                            </option>
                          ))}
                        </Select>
                        <Button size="sm" variant="danger" onClick={() => setRemoving(m)}>
                          {t("common.remove")}
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
        </Card>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title={t("backoffice.removeMemberTitle")}
        body={t("backoffice.removeMemberBody")}
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
