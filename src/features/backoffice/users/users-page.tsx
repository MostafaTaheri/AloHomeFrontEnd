"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { backofficeApi } from "@/lib/api/backoffice";
import { describeError } from "@/lib/api/error";
import { phoneSchemaFor } from "@/lib/validation/auth";
import { profileFor, REGIONS, type Region } from "@/lib/region/config";
import { usePageView } from "@/lib/telemetry/client";
import { parseUserId } from "../schemes/parse";
import { useBoMutation } from "../use-bo-mutation";

/** The create-user response shape is not specified, so look for the usual id field names. */
function extractId(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  for (const key of ["id", "userId", "Id", "UserId"]) {
    const v = data[key];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

export function UsersPage() {
  const { t, region: current } = useI18n();
  usePageView("backoffice", "users");
  return (
    <div className="space-y-6">
      <PageHeader title={t("backoffice.usersTitle")} description={t("backoffice.usersSubtitle")} />
      <CreateUser defaultRegion={current} />
      <ManageUser />
    </div>
  );
}

function CreateUser({ defaultRegion }: { defaultRegion: Region }) {
  const { t } = useI18n();
  const [market, setMarket] = useState<Region>(defaultRegion);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null | undefined>(undefined);

  const create = useBoMutation({
    mutationFn: (normalized: string) => backofficeApi.createUser(normalized),
    success: "backoffice.userCreated",
    silentError: true,
    onSuccess: (data) => {
      setCreatedId(extractId(data));
      setPhone("");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (create.isPending) return;
    const parsed = phoneSchemaFor(market).safeParse(phone);
    if (!parsed.success) {
      setError(t("validation.phone", { example: profileFor(market).phoneExample }));
      return;
    }
    setError(null);
    setCreatedId(undefined);
    create.mutate(parsed.data);
  }

  return (
    <Card>
      <CardHeader title={t("backoffice.createUserTitle")} />
      <CardBody className="space-y-4">
        <form noValidate onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="w-52">
            <Field id="user-market" label={t("backoffice.phoneMarket")}>
              <Select
                id="user-market"
                value={market}
                onChange={(e) => setMarket(e.target.value as Region)}
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`preferences.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="min-w-64 flex-1">
            <Field
              id="user-phone"
              label={t("backoffice.phone")}
              hint={t("backoffice.phoneHint", { example: profileFor(market).phoneExample })}
              error={error ?? undefined}
            >
              <Input
                id="user-phone"
                dir="ltr"
                inputMode="tel"
                autoComplete="off"
                hasHint
                value={phone}
                invalid={Boolean(error)}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </div>
          <Button type="submit" loading={create.isPending}>
            {t("backoffice.createUser")}
          </Button>
        </form>
        {create.isError ? (
          <InlineAlert tone="danger">{describeError(create.error, t)}</InlineAlert>
        ) : null}
        {createdId !== undefined ? (
          <InlineAlert tone="ok">
            {createdId ? (
              <span dir="ltr">{t("backoffice.userCreatedId", { id: createdId })}</span>
            ) : (
              t("backoffice.userCreatedNoId")
            )}
          </InlineAlert>
        ) : null}
      </CardBody>
    </Card>
  );
}

function ManageUser() {
  const { t } = useI18n();
  const [userId, setUserId] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const id = parseUserId(userId);
  const activate = useBoMutation({
    mutationFn: () => backofficeApi.activateUser(id!),
    success: "backoffice.activated",
  });
  const deactivate = useBoMutation({
    mutationFn: () => backofficeApi.deactivateUser(id!),
    success: "backoffice.deactivated",
    silentError: true,
    onSuccess: () => setConfirm(false),
  });

  return (
    <Card>
      <CardHeader title={t("backoffice.manageTitle")} description={t("backoffice.manageBody")} />
      <CardBody className="space-y-4">
        <div className="max-w-xl">
          <Field
            id="manage-user"
            label={t("backoffice.userId")}
            error={touched && !id ? t("backoffice.userIdInvalid") : undefined}
          >
            <Input
              id="manage-user"
              dir="ltr"
              value={userId}
              invalid={touched && !id}
              onChange={(e) => setUserId(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            loading={activate.isPending}
            onClick={() => {
              setTouched(true);
              if (id && !activate.isPending) activate.mutate(undefined);
            }}
          >
            {t("backoffice.activate")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setTouched(true);
              if (id) setConfirm(true);
            }}
          >
            {t("backoffice.deactivate")}
          </Button>
        </div>
        {deactivate.isError ? (
          <InlineAlert tone="danger">{describeError(deactivate.error, t)}</InlineAlert>
        ) : null}
      </CardBody>
      <ConfirmDialog
        open={confirm}
        title={t("backoffice.deactivateTitle")}
        body={t("backoffice.deactivateBody")}
        confirmLabel={t("backoffice.deactivate")}
        destructive
        busy={deactivate.isPending}
        onConfirm={() => {
          if (!deactivate.isPending) deactivate.mutate(undefined);
        }}
        onClose={() => setConfirm(false)}
      />
    </Card>
  );
}
