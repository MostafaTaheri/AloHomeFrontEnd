"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/translator";
import { authRequest } from "@/lib/api/client";
import { ApiError, describeError } from "@/lib/api/error";
import { safeNextPath } from "@/lib/auth/redirect";
import type { SessionUser } from "@/lib/auth/jwt";
import { homePathFor, type Surface } from "@/lib/bff/surface";
import { track } from "@/lib/telemetry/client";
import { profileFor } from "@/lib/region/config";
import { normalizeDigits, otpSchema, phoneSchemaFor } from "@/lib/validation/auth";
import { useCountdown } from "./use-countdown";

const RESEND_SECONDS = 60;
const PENDING_PHONE_KEY = "alohome.pendingPhone";

function readPendingPhone(): string {
  try {
    return window.sessionStorage.getItem(PENDING_PHONE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writePendingPhone(value: string | null): void {
  try {
    if (value) window.sessionStorage.setItem(PENDING_PHONE_KEY, value);
    else window.sessionStorage.removeItem(PENDING_PHONE_KEY);
  } catch {
    // sessionStorage can be unavailable (private mode, blocked storage); the flow still works.
  }
}

interface LoginResponse {
  data?: { user?: SessionUser | null } | null;
}

export function AuthFlow({
  mode,
  surface = "client",
  next,
  expired = false,
  registered = false,
}: {
  mode: "login" | "register";
  /** The back office has its own login and no self-registration. */
  surface?: Surface;
  next?: string;
  expired?: boolean;
  registered?: boolean;
}) {
  const { t, region } = useI18n();
  const router = useRouter();
  const profile = profileFor(region);
  const phoneSchema = phoneSchemaFor(region);
  const isStaff = surface === "backoffice";

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneError, setPhoneError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { remaining, restart } = useCountdown(RESEND_SECONDS);
  const codeInput = useRef<HTMLInputElement>(null);

  // After registering, the user lands on sign-in with their number already filled in.
  useEffect(() => {
    if (registered) {
      const saved = readPendingPhone();
      // sessionStorage is only readable after hydration, so this has to happen in an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setPhone(saved);
      writePendingPhone(null);
    }
  }, [registered]);

  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  /** Validates the phone field. Messages are keys; the example number is region specific. */
  function checkPhone(): string | null {
    const parsed = phoneSchema.safeParse(phone);
    if (parsed.success) {
      setPhoneError(undefined);
      return parsed.data;
    }
    const key = (parsed.error.issues[0]?.message ?? "validation.required") as MessageKey;
    setPhoneError(t(key, { example: profile.phoneExample }));
    return null;
  }

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setFormError(undefined);
    setNotice(undefined);

    const phoneNumber = checkPhone();
    if (!phoneNumber) return;

    setBusy(true);
    try {
      await authRequest("request-otp", { method: "POST", body: { phoneNumber }, surface });
      setNotice(t("auth.codeSent", { phone: phoneNumber }));
      setCode("");
      setStep("code");
      restart();
    } catch (error) {
      setFormError(describeError(error, t));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);

    const phoneNumber = checkPhone();
    if (!phoneNumber) {
      setStep("phone");
      return;
    }
    const parsedCode = otpSchema.safeParse(code);
    if (!parsedCode.success) {
      setCodeError(t((parsedCode.error.issues[0]?.message ?? "validation.otp") as MessageKey));
      return;
    }
    setCodeError(undefined);

    setBusy(true);
    try {
      if (mode === "register") {
        await authRequest("register", {
          method: "POST",
          body: { phoneNumber, otp: parsedCode.data },
          surface,
        });
        writePendingPhone(phoneNumber);
        router.replace("/login?registered=1");
        return;
      }

      await authRequest<LoginResponse>("login", {
        method: "POST",
        body: { phoneNumber, otp: parsedCode.data },
        surface,
      });
      if (!isStaff) track("auth_signed_in", { surface });
      router.replace(safeNextPath(next, homePathFor(surface), surface));
      router.refresh();
    } catch (error) {
      if (isStaff && error instanceof ApiError && error.status === 403) {
        setFormError(t("auth.boNotStaff"));
      } else {
        setFormError(describeError(error, t));
      }
      setBusy(false);
    }
  }

  const isLogin = mode === "login";
  const title = isStaff
    ? t("auth.boTitle")
    : isLogin
      ? t("auth.loginTitle")
      : t("auth.registerTitle");
  const subtitle = isStaff
    ? t("auth.boSubtitle")
    : isLogin
      ? t("auth.loginSubtitle")
      : t("auth.registerSubtitle");

  return (
    <Card>
      <CardBody className="space-y-5 py-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>

        {expired && step === "phone" ? (
          <InlineAlert tone="warn">{t("auth.sessionExpired")}</InlineAlert>
        ) : null}
        {registered && step === "phone" ? (
          <InlineAlert tone="ok">{t("auth.registeredNotice")}</InlineAlert>
        ) : null}
        {notice && step === "code" ? <InlineAlert tone="ok">{notice}</InlineAlert> : null}
        {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}

        {step === "phone" ? (
          <form onSubmit={sendCode} noValidate className="space-y-4">
            <Field
              id="phone"
              label={t("auth.phone")}
              hint={t("auth.phoneHint", { example: profile.phoneExample })}
              error={phoneError}
            >
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                className="text-start"
                value={phone}
                invalid={Boolean(phoneError)}
                hasHint
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Button type="submit" className="w-full" loading={busy}>
              {busy ? t("auth.sendingCode") : t("auth.sendCode")}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted underline-offset-2 hover:text-fg hover:underline"
              onClick={() => {
                if (!checkPhone()) return;
                setNotice(undefined);
                setStep("code");
              }}
            >
              {t("auth.haveCode")}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} noValidate className="space-y-4">
            <Field
              id="code"
              label={t("auth.code")}
              hint={t("auth.codeHint", { phone: normalizeDigits(phone) })}
              error={codeError}
            >
              <Input
                id="code"
                name="code"
                ref={codeInput}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={12}
                dir="ltr"
                className="text-center text-lg tracking-[0.5em]"
                value={code}
                invalid={Boolean(codeError)}
                hasHint
                onChange={(e) => setCode(normalizeDigits(e.target.value).slice(0, 6))}
              />
            </Field>
            <Button type="submit" className="w-full" loading={busy}>
              {isLogin
                ? busy
                  ? t("auth.signingIn")
                  : t("auth.signIn")
                : busy
                  ? t("auth.creatingAccount")
                  : t("auth.createAccount")}
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <button
                type="button"
                className="text-muted underline-offset-2 hover:text-fg hover:underline"
                onClick={() => {
                  setStep("phone");
                  setFormError(undefined);
                  setCodeError(undefined);
                }}
              >
                {t("auth.changePhone")}
              </button>
              <button
                type="button"
                disabled={remaining > 0 || busy}
                className="text-brand underline-offset-2 hover:underline disabled:text-muted disabled:no-underline"
                onClick={() => void sendCode()}
              >
                {remaining > 0 ? t("auth.resendIn", { seconds: remaining }) : t("auth.resend")}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2 border-t border-line pt-4 text-center text-sm text-muted">
          {isStaff ? (
            <p>
              {t("auth.boClientLink")}{" "}
              <Link href="/login" className="font-medium text-brand hover:underline">
                {t("auth.boClientLinkAction")}
              </Link>
            </p>
          ) : (
            <>
              <p>
                {isLogin ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
                <Link
                  href={isLogin ? "/register" : "/login"}
                  className="font-medium text-brand hover:underline"
                >
                  {isLogin ? t("auth.registerLink") : t("auth.loginLink")}
                </Link>
              </p>
              <p>
                {t("auth.clientBoLink")}{" "}
                <Link href="/backoffice/login" className="font-medium text-brand hover:underline">
                  {t("auth.clientBoLinkAction")}
                </Link>
              </p>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
