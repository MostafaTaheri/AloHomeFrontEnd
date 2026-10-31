"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { EnumBadge, useEnumLabel } from "@/components/finance/enum-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineAlert, ListSkeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import type { Translator } from "@/i18n/translator";
import { describeError, hasErrorCode } from "@/lib/api/error";
import { qk } from "@/lib/api/keys";
import {
  boOrganisationsApi,
  ORGANISATION_ROLES,
  type Organisation,
  type OrganisationMember,
  type OrganisationRoleName,
  type OrganisationScheme,
} from "@/lib/api/organisations";
import { usePageView } from "@/lib/telemetry/client";
import { parseUserId } from "../schemes/parse";
import { useBoMutation } from "../use-bo-mutation";
import { OrganisationForm } from "./organisation-form";

const ROLES = Object.keys(ORGANISATION_ROLES) as OrganisationRoleName[];

/** Organisation errors the API reports by code, explained in plain words. */
function orgError(error: unknown, t: Translator["t"]): string {
  if (hasErrorCode(error, 400009)) return t("organisations.lastOwner");
  if (hasErrorCode(error, 400007)) return t("organisations.countryMismatch");
  if (hasErrorCode(error, 400004)) return t("organisations.alreadyMember");
  return describeError(error, t);
}

export function OrganisationDetail({ organisationId }: { organisationId: number }) {
  const { t } = useI18n();
  const enumLabel = useEnumLabel();
  usePageView("backoffice", "organisation");
  const [editing, setEditing] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);

  const query = useQuery({
    queryKey: qk.bo.organisation(organisationId),
    queryFn: ({ signal }) => boOrganisationsApi.get(organisationId, signal),
  });
  const active = query.data?.status === "Active";
  const status = useBoMutation({
    mutationFn: () => boOrganisationsApi.setStatus(organisationId, active ? "Suspended" : "Active"),
    invalidate: [
      ["bo", "organisation"],
      ["bo", "organisations"],
    ],
    success: "organisations.statusChanged",
    silentError: true,
    onSuccess: () => setConfirmStatus(false),
  });

  if (query.isPending) return <ListSkeleton rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const org = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={org.name}
        description={`${enumLabel("orgKind", org.kind)} · ${org.countryCode}`}
        backHref="/backoffice/organisations"
        backLabel={t("organisations.back")}
        actions={
          <>
            <EnumBadge group="orgStatus" value={org.status} />
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {t("common.edit")}
            </Button>
            <Button variant={active ? "danger" : "primary"} onClick={() => setConfirmStatus(true)}>
              {active ? t("organisations.suspend") : t("organisations.reactivate")}
            </Button>
          </>
        }
      />
      <Card>
        <CardBody>
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted">{t("organisations.registration")}</dt>
              <dd dir="ltr">{org.registrationNumber ?? t("common.none")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("organisations.email")}</dt>
              <dd dir="ltr">{org.contactEmail ?? t("common.none")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("organisations.access")}</dt>
              <dd>{t("organisations.accessBody")}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <MembersCard org={org} />
      <SchemesCard org={org} />

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title={t("common.edit")}
        className="max-w-xl"
      >
        {editing ? <OrganisationForm existing={org} onDone={() => setEditing(false)} /> : null}
      </Dialog>
      <ConfirmDialog
        open={confirmStatus}
        title={active ? t("organisations.suspendTitle") : t("organisations.reactivateTitle")}
        body={active ? t("organisations.suspendBody") : t("organisations.reactivateBody")}
        confirmLabel={active ? t("organisations.suspend") : t("organisations.reactivate")}
        destructive={active}
        busy={status.isPending}
        onConfirm={() => {
          if (!status.isPending) status.mutate(undefined);
        }}
        onClose={() => setConfirmStatus(false)}
      />
      {status.isError ? <InlineAlert tone="danger">{orgError(status.error, t)}</InlineAlert> : null}
    </div>
  );
}

function MembersCard({ org }: { org: Organisation }) {
  const { t } = useI18n();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<OrganisationRoleName>("Staff");
  const [touched, setTouched] = useState(false);
  const [removing, setRemoving] = useState<OrganisationMember | null>(null);
  const id = parseUserId(userId);
  const members = org.members.filter((m) => m.status === "Active");
  const invalidate = [["bo", "organisation"]];

  const add = useBoMutation({
    mutationFn: () => boOrganisationsApi.addMember(org.id, { userId: id!, role }),
    invalidate,
    success: "organisations.memberAdded",
    silentError: true,
    onSuccess: () => {
      setUserId("");
      setTouched(false);
    },
  });
  const change = useBoMutation({
    mutationFn: (vars: { userId: string; role: OrganisationRoleName }) =>
      boOrganisationsApi.changeMemberRole(org.id, vars.userId, vars.role),
    invalidate,
    success: "organisations.memberRoleChanged",
    silentError: true,
  });
  const remove = useBoMutation({
    mutationFn: (member: OrganisationMember) =>
      boOrganisationsApi.removeMember(org.id, member.userId),
    invalidate,
    success: "organisations.memberRemoved",
    silentError: true,
    onSuccess: () => setRemoving(null),
  });
  const error = add.error ?? change.error ?? remove.error;

  return (
    <Card>
      <CardHeader
        title={t("organisations.membersTitle")}
        description={t("organisations.membersBody")}
      />
      <CardBody className="space-y-4">
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
              id="org-member"
              label={t("backoffice.userId")}
              error={touched && !id ? t("backoffice.userIdInvalid") : undefined}
            >
              <Input
                id="org-member"
                dir="ltr"
                value={userId}
                invalid={touched && !id}
                onChange={(e) => setUserId(e.target.value)}
              />
            </Field>
          </div>
          <div className="w-40">
            <Field id="org-member-role" label={t("organisations.role")}>
              <Select
                id="org-member-role"
                value={role}
                onChange={(e) => setRole(e.target.value as OrganisationRoleName)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`enums.orgRole.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" loading={add.isPending}>
            {t("backoffice.addMember")}
          </Button>
        </form>
        {error ? <InlineAlert tone="danger">{orgError(error, t)}</InlineAlert> : null}
        {members.length === 0 ? (
          <p className="text-sm text-muted">{t("organisations.membersEmpty")}</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("backoffice.colUser")}</TH>
                <TH>{t("organisations.role")}</TH>
                <TH>
                  <span className="sr-only">{t("common.actions")}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {members.map((m) => (
                <TR key={m.id}>
                  <TD dir="ltr" className="font-mono text-xs">
                    {m.userId}
                  </TD>
                  <TD>
                    <Select
                      id={`org-role-${m.id}`}
                      aria-label={t("organisations.changeRole")}
                      className="h-8 w-36"
                      value={m.role}
                      disabled={change.isPending}
                      onChange={(e) =>
                        change.mutate({
                          userId: m.userId,
                          role: e.target.value as OrganisationRoleName,
                        })
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`enums.orgRole.${r}`)}
                        </option>
                      ))}
                    </Select>
                  </TD>
                  <TD className="text-end">
                    <Button size="sm" variant="danger" onClick={() => setRemoving(m)}>
                      {t("common.remove")}
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
      <ConfirmDialog
        open={removing !== null}
        title={t("organisations.removeMemberTitle")}
        body={t("organisations.removeMemberBody")}
        confirmLabel={t("common.remove")}
        destructive
        busy={remove.isPending}
        onConfirm={() => {
          if (removing && !remove.isPending) remove.mutate(removing);
        }}
        onClose={() => setRemoving(null)}
      />
    </Card>
  );
}

function SchemesCard({ org }: { org: Organisation }) {
  const { t } = useI18n();
  const [schemeId, setSchemeId] = useState("");
  const [detaching, setDetaching] = useState<OrganisationScheme | null>(null);
  const parsed = /^\d{1,9}$/.test(schemeId.trim()) ? Number(schemeId.trim()) : null;
  const [touched, setTouched] = useState(false);
  const invalidate = [["bo", "organisation"]];

  const attach = useBoMutation({
    mutationFn: () => boOrganisationsApi.attachScheme(org.id, parsed!),
    invalidate,
    success: "organisations.schemeAttached",
    silentError: true,
    onSuccess: () => {
      setSchemeId("");
      setTouched(false);
    },
  });
  const detach = useBoMutation({
    mutationFn: (s: OrganisationScheme) => boOrganisationsApi.detachScheme(org.id, s.schemeId),
    invalidate,
    success: "organisations.schemeDetached",
    silentError: true,
    onSuccess: () => setDetaching(null),
  });
  const error = attach.error ?? detach.error;

  return (
    <Card>
      <CardHeader
        title={t("organisations.schemesTitle")}
        description={t("organisations.schemesBody")}
      />
      <CardBody className="space-y-4">
        <form
          noValidate
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (parsed === null || attach.isPending) return;
            attach.mutate(undefined);
          }}
        >
          <div className="w-48">
            <Field
              id="org-scheme"
              label={t("organisations.schemeId")}
              error={touched && parsed === null ? t("organisations.schemeIdInvalid") : undefined}
            >
              <Input
                id="org-scheme"
                dir="ltr"
                inputMode="numeric"
                value={schemeId}
                invalid={touched && parsed === null}
                onChange={(e) => setSchemeId(e.target.value)}
              />
            </Field>
          </div>
          <Button type="submit" loading={attach.isPending}>
            {t("organisations.attach")}
          </Button>
        </form>
        {error ? <InlineAlert tone="danger">{orgError(error, t)}</InlineAlert> : null}
        {org.schemes.length === 0 ? (
          <EmptyState title={t("organisations.schemesEmpty")} />
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {org.schemes.map((s) => (
              <li key={s.schemeId} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                <Link
                  href={`/backoffice/schemes/${s.schemeId}`}
                  className="font-medium text-brand hover:underline"
                  dir="auto"
                >
                  {s.title}
                </Link>
                <span className="text-muted" dir="ltr">
                  {s.jurisdictionCode} · {s.currencyCode}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto"
                  onClick={() => setDetaching(s)}
                >
                  {t("organisations.detach")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <ConfirmDialog
        open={detaching !== null}
        title={t("organisations.detachTitle")}
        body={t("organisations.detachBody")}
        confirmLabel={t("organisations.detach")}
        destructive
        busy={detach.isPending}
        onConfirm={() => {
          if (detaching && !detach.isPending) detach.mutate(detaching);
        }}
        onClose={() => setDetaching(null)}
      />
    </Card>
  );
}
