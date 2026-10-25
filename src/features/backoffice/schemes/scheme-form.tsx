"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import { describeError } from "@/lib/api/error";
import { backofficeApi, type BoScheme, type SchemeInput } from "@/lib/api/backoffice";
import { useBoMutation } from "../use-bo-mutation";
import { parseLatitude, parseLongitude, parseWhole } from "./parse";

const ZONES = ["Asia/Tehran", "Australia/Sydney"] as const;
const JURISDICTIONS = [
  { code: "IR", label: "backoffice.jurisdictionIR", zone: "Asia/Tehran" },
  { code: "AU-NSW", label: "backoffice.jurisdictionAU", zone: "Australia/Sydney" },
] as const;

/** Create (no `scheme`) or edit a scheme. The market is chosen once, at creation. */
export function SchemeForm({ scheme, onDone }: { scheme?: BoScheme; onDone: () => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(scheme?.title ?? "");
  const [address, setAddress] = useState(scheme?.address ?? "");
  const [jurisdiction, setJurisdiction] = useState<string>(scheme?.jurisdictionCode ?? "AU-NSW");
  const [zone, setZone] = useState<string>(scheme?.timeZoneId ?? "Australia/Sydney");
  const [lat, setLat] = useState(scheme ? String(scheme.latitude) : "");
  const [lng, setLng] = useState(scheme ? String(scheme.longitude) : "");
  const [floor, setFloor] = useState(scheme ? String(scheme.floor) : "");
  const [parking, setParking] = useState(scheme ? String(scheme.guestParkingCount) : "0");
  const [registration, setRegistration] = useState("");
  const [touched, setTouched] = useState(false);

  const latV = parseLatitude(lat);
  const lngV = parseLongitude(lng);
  const floorV = parseWhole(floor, 200);
  const parkingV = parseWhole(parking, 1000);
  const valid =
    title.trim() &&
    address.trim() &&
    latV !== null &&
    lngV !== null &&
    floorV !== null &&
    parkingV !== null;

  const save = useBoMutation({
    mutationFn: async () => {
      const input: SchemeInput = {
        title: title.trim(),
        address: address.trim(),
        latitude: latV!,
        longitude: lngV!,
        floor: floorV!,
        guestParkingCount: parkingV!,
        registrationNumber: registration.trim(),
        timeZoneId: zone,
      };
      return scheme
        ? backofficeApi.updateScheme(scheme.id, input)
        : backofficeApi.createScheme({
            ...input,
            jurisdictionCode: jurisdiction,
            status: "Active",
          });
    },
    invalidate: [["bo"]],
    success: scheme ? "backoffice.schemeUpdated" : "backoffice.schemeCreated",
    silentError: true,
    onSuccess: onDone,
  });

  const bad = (isBad: boolean, message: string) => (touched && isBad ? message : undefined);

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
      <Field
        id="bo-title"
        label={t("backoffice.fieldTitle")}
        error={bad(!title.trim(), t("backoffice.requiredField"))}
      >
        <Input
          id="bo-title"
          maxLength={200}
          value={title}
          invalid={touched && !title.trim()}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field
        id="bo-address"
        label={t("backoffice.fieldAddress")}
        error={bad(!address.trim(), t("backoffice.requiredField"))}
      >
        <Input
          id="bo-address"
          maxLength={300}
          value={address}
          invalid={touched && !address.trim()}
          onChange={(e) => setAddress(e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {!scheme ? (
          <Field
            id="bo-jurisdiction"
            label={t("backoffice.fieldJurisdiction")}
            hint={t("backoffice.fieldJurisdictionHint")}
          >
            <Select
              id="bo-jurisdiction"
              hasHint
              value={jurisdiction}
              onChange={(e) => {
                setJurisdiction(e.target.value);
                const match = JURISDICTIONS.find((j) => j.code === e.target.value);
                if (match) setZone(match.zone);
              }}
            >
              {JURISDICTIONS.map((j) => (
                <option key={j.code} value={j.code}>
                  {t(j.label)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field id="bo-zone" label={t("backoffice.fieldTimeZone")}>
          <Select id="bo-zone" value={zone} onChange={(e) => setZone(e.target.value)}>
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="bo-lat"
          label={t("backoffice.fieldLatitude")}
          error={bad(latV === null, t("backoffice.latitudeInvalid"))}
        >
          <Input
            id="bo-lat"
            dir="ltr"
            inputMode="decimal"
            value={lat}
            invalid={touched && latV === null}
            onChange={(e) => setLat(e.target.value)}
          />
        </Field>
        <Field
          id="bo-lng"
          label={t("backoffice.fieldLongitude")}
          error={bad(lngV === null, t("backoffice.longitudeInvalid"))}
        >
          <Input
            id="bo-lng"
            dir="ltr"
            inputMode="decimal"
            value={lng}
            invalid={touched && lngV === null}
            onChange={(e) => setLng(e.target.value)}
          />
        </Field>
        <Field
          id="bo-floor"
          label={t("backoffice.fieldFloor")}
          error={bad(floorV === null, t("backoffice.wholeInvalid"))}
        >
          <Input
            id="bo-floor"
            dir="ltr"
            inputMode="numeric"
            value={floor}
            invalid={touched && floorV === null}
            onChange={(e) => setFloor(e.target.value)}
          />
        </Field>
        <Field
          id="bo-parking"
          label={t("backoffice.fieldGuestParking")}
          error={bad(parkingV === null, t("backoffice.wholeInvalid"))}
        >
          <Input
            id="bo-parking"
            dir="ltr"
            inputMode="numeric"
            value={parking}
            invalid={touched && parkingV === null}
            onChange={(e) => setParking(e.target.value)}
          />
        </Field>
      </div>
      <Field
        id="bo-registration"
        label={t("backoffice.fieldRegistration")}
        hint={t("backoffice.fieldRegistrationHint")}
        optional={t("common.optional")}
      >
        <Input
          id="bo-registration"
          hasHint
          maxLength={100}
          value={registration}
          onChange={(e) => setRegistration(e.target.value)}
        />
      </Field>
      {save.isError ? (
        <InlineAlert tone="danger">{describeError(save.error, t)}</InlineAlert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t("backoffice.schemeSave")}
        </Button>
      </div>
    </form>
  );
}
