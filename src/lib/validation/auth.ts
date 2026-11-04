import { z } from "zod";
import type { MessageKey } from "@/i18n/translator";
import { REGION_PROFILES, type Region } from "@/lib/region/config";

/** Mirrors PhoneNumber.PhoneRegex in the API: + then a 1-4 digit country code then 10 digits. */
export const PHONE_REGEX = /^\+\d{1,4}\d{10}$/;
/** Mirrors Otp.OtpRegex in the API. */
export const OTP_REGEX = /^\d{6}$/;

/** Converts Persian and Arabic-Indic digits to ASCII and strips spaces, dashes and bidi marks. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s\-().‌‎‏]/g, "");
}

/**
 * Local (trunk-0) formats that belong to exactly one market. They don't overlap: an Iranian mobile
 * is 11 digits starting 09, an Australian number 10 digits starting 02/03/04/07/08.
 */
const LOCAL_FORMATS: ReadonlyArray<{ pattern: RegExp; region: Region }> = [
  { pattern: /^09\d{9}$/, region: "ir" },
  { pattern: /^0[2-478]\d{8}$/, region: "au" },
];

/**
 * Turns what a person typed into the E.164-style number the API expects.
 *
 *   +989121234567   kept
 *   00989121234567  -> +989121234567
 *   09121234567     -> +989121234567   (Iran, local format)
 *   0412 345 678    -> +61412345678    (Australia, local format)
 *   9121234567      -> +989121234567   (national number without the trunk 0)
 *
 * A number that already carries its own country code is never rewritten. A local number in a
 * format only one market uses (09xxxxxxxxx is Iranian, 04xxxxxxxx Australian) is read as that
 * market's whatever the UI region is; the region only decides the remaining, ambiguous input.
 */
export function normalizePhone(input: string, region: Region): string {
  const cleaned = normalizeDigits(input);
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return `+${cleaned.slice(1).replace(/\D/g, "")}`;
  const digits = cleaned.replace(/\D/g, "");
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;

  const local = LOCAL_FORMATS.find((f) => f.pattern.test(digits));
  if (local) return `+${REGION_PROFILES[local.region].phoneCountryCode}${digits.slice(1)}`;

  const dial = REGION_PROFILES[region].phoneCountryCode;
  if (digits.startsWith("0")) return `+${dial}${digits.slice(1)}`;
  // A number that already starts with the country code and has the right length.
  if (digits.startsWith(dial) && digits.length >= dial.length + 9) return `+${digits}`;
  return `+${dial}${digits}`;
}

/** Country codes of the markets the product serves (and the API can send SMS to). */
const SUPPORTED_DIAL_CODES = Object.values(REGION_PROFILES).map((p) => p.phoneCountryCode);

/**
 * Rejects numbers from other countries. Browser autofill can turn an Iranian mobile like
 * 9398387629 into "+1 939-838-7629" (939 is also a North American area code), which is a valid
 * E.164 number but not the one the person meant.
 */
function isSupportedCountry(phone: string): boolean {
  return SUPPORTED_DIAL_CODES.some((code) => phone.startsWith(`+${code}`));
}

// Messages are translation keys; the UI resolves them with t() so errors follow the locale.
const key = (k: MessageKey): MessageKey => k;

/** Phone field for a region: accepts local or international input, outputs the API format. */
export function phoneSchemaFor(region: Region) {
  return z
    .string()
    .transform((value) => normalizePhone(value, region))
    .pipe(
      z
        .string()
        .regex(PHONE_REGEX, key("validation.phone"))
        .refine(isSupportedCountry, key("validation.phone")),
    );
}

export const otpSchema = z
  .string()
  .transform(normalizeDigits)
  .pipe(z.string().regex(OTP_REGEX, key("validation.otp")));

export type PhoneInput = z.input<ReturnType<typeof phoneSchemaFor>>;

/**
 * Server-side phone check for the BFF auth routes. The browser has already normalised what the
 * person typed (see phoneSchemaFor), so here only the API's own format is accepted.
 */
export const phoneSchema = z
  .string()
  .transform(normalizeDigits)
  .pipe(z.string().regex(PHONE_REGEX, key("validation.phone")));

export const requestOtpBody = z.object({ phoneNumber: phoneSchema });
export const otpBody = z.object({ phoneNumber: phoneSchema, otp: otpSchema });

export type RequestOtpBody = z.infer<typeof requestOtpBody>;
export type OtpBody = z.infer<typeof otpBody>;
