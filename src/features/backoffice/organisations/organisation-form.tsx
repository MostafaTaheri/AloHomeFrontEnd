"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { describeError, hasErrorCode } from "@/lib/api/error";
import {
  boOrganisationsApi,
  ORGANISATION_KINDS,
  type Organisation,
  type OrganisationKindName,
} from "@/lib/api/organisations";
import { parseUserId } from "../schemes/parse";
import { useBoMutation } from "../use-bo-mutation";

const KINDS = Object.keys(ORGANISATION_KINDS) as OrganisationKindName[];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Create an organisation, or edit one (the country cannot change after creation). */
export function OrganisationForm({
  existing,
  onDone,
}: {
  existing?: Organisation;
  onDone: (organisation: Organisation) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<OrganisationKindName>(
    (existing?.kind as OrganisationKindName) ?? "ManagementCompany",
  );
  const [country, setCountry] = useState<"AU" | "IR">(
    (existing?.countryCode as "AU" | "IR") ?? "AU",
  );
  const [registration, setRegistration] = useState(existing?.registrationNumber ?? "");
  const [email, setEmail] = useState(existing?.contactEmail ?? "");
  const [owner, setOwner] = useState("");
  const [touched, setTouched] = useState(false);

  const ownerId = owner.trim() ? parseUserId(owner) : undefined;
  const errors = {
    name: touched && !name.trim() ? t("organisations.nameRequired") : undefined,
    email:
      touched && email.trim() && !EMAIL.test(email.trim())
        ? t("organisations.emailInvalid")
        : undefined,
    owner: touched && ownerId === null ? t("backoffice.userIdInvalid") : undefined,
  };

  const save = useBoMutation({
    mutationFn: () => {
      const input = {
        name: name.trim(),
        kind,
        registrationNumber: registration.trim(),
        contactEmail: email.trim(),
      };
      return existing
        ? boOrganisationsApi.update(existing.id, input)
        : boOrganisationsApi.create({
            ...input,
            countryCode: country,
            ownerUserId: ownerId ?? undefined,
          });
    },
    invalidate: [
      ["bo", "organisations"],
      ["bo", "organisation"],
    ],
    success: existing ? "organisations.updated" : "organisations.created",
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
        if (!name.trim() || errors.email || ownerId === null || save.isPending) return;
        save.mutate(undefined);
      }}
    >
      <Field id="org-name" label={t("organisations.name")} error={errors.name}>
        <Input
          id="org-name"
          maxLength={200}
          value={name}
          invalid={Boolean(errors.name)}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="org-kind" label={t("organisations.kind")}>
          <Select
            id="org-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as OrganisationKindName)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`enums.orgKind.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="org-country"
          label={t("organisations.country")}
          hint={existing ? t("organisations.countryFixed") : undefined}
        >
          <Select
            id="org-country"
            value={country}
            disabled={Boolean(existing)}
            onChange={(e) => setCountry(e.target.value as "AU" | "IR")}
          >
            <option value="AU">{t("organisations.countryAU")}</option>
            <option value="IR">{t("organisations.countryIR")}</option>
          </Select>
        </Field>
        <Field id="org-reg" label={t("organisations.registration")} optional={t("common.optional")}>
          <Input
            id="org-reg"
            maxLength={50}
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
          />
        </Field>
        <Field
          id="org-email"
          label={t("organisations.email")}
          optional={t("common.optional")}
          error={errors.email}
        >
          <Input
            id="org-email"
            type="email"
            dir="ltr"
            maxLength={200}
            value={email}
            invalid={Boolean(errors.email)}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
      </div>
      {!existing ? (
        <Field
          id="org-owner"
          label={t("organisations.owner")}
          hint={t("organisations.ownerHint")}
          optional={t("common.optional")}
          error={errors.owner}
        >
          <Input
            id="org-owner"
            dir="ltr"
            value={owner}
            invalid={Boolean(errors.owner)}
            onChange={(e) => setOwner(e.target.value)}
          />
        </Field>
      ) : null}
      {save.isError ? (
        <InlineAlert tone="danger">
          {hasErrorCode(save.error, 400003)
            ? t("organisations.duplicate")
            : describeError(save.error, t)}
        </InlineAlert>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending}>
          {existing ? t("common.save") : t("organisations.create")}
        </Button>
      </div>
    </form>
  );
}
