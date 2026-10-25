import "server-only";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { sessionFromToken } from "@/lib/auth/jwt";
import { getSessionFor } from "@/lib/auth/session";
import { findSetCookie } from "@/lib/auth/set-cookie";
import { getEnv } from "@/lib/env";
import { otpBody, requestOtpBody } from "@/lib/validation/auth";
import { clearAuthCookies, setAuthCookies } from "./auth-cookies";
import { backendFetch } from "./backend";
import { assertSameOrigin } from "./guard";
import { jsonError, jsonOk, passthrough, readJsonBody, withBackendErrors } from "./responses";
import type { Surface } from "./surface";

async function localeFromCookie(): Promise<string | undefined> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : undefined;
}

/** Sends a one-time code. Identical for both surfaces; the account decides what it may open. */
export async function handleRequestOtp(request: Request): Promise<Response> {
  const blocked = assertSameOrigin(request);
  if (blocked) return blocked;

  const parsed = requestOtpBody.safeParse(await readJsonBody(request, 2_048));
  if (!parsed.success) return jsonError(400, "ValidationError", "Invalid phone number.");

  const locale = await localeFromCookie();
  return withBackendErrors(async () =>
    passthrough(
      await backendFetch({
        method: "POST",
        path: "authentication/request-otp",
        body: JSON.stringify({ phoneNumber: parsed.data.phoneNumber }),
        locale,
      }),
    ),
  );
}

/** Self-registration. Exists for the client surface only. */
export async function handleRegister(request: Request): Promise<Response> {
  const blocked = assertSameOrigin(request);
  if (blocked) return blocked;

  const parsed = otpBody.safeParse(await readJsonBody(request, 2_048));
  if (!parsed.success) return jsonError(400, "ValidationError", "Invalid phone number or code.");

  const locale = await localeFromCookie();
  return withBackendErrors(async () =>
    passthrough(
      await backendFetch({
        method: "POST",
        path: "authentication/register",
        body: JSON.stringify(parsed.data),
        locale,
      }),
    ),
  );
}

export async function handleLogin(request: Request, surface: Surface): Promise<Response> {
  const blocked = assertSameOrigin(request);
  if (blocked) return blocked;

  const parsed = otpBody.safeParse(await readJsonBody(request, 2_048));
  if (!parsed.success) return jsonError(400, "ValidationError", "Invalid phone number or code.");

  const jar = await cookies();
  const localeCookie = jar.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(localeCookie) ? localeCookie : undefined;

  return withBackendErrors(async () => {
    const upstream = await backendFetch({
      method: "POST",
      path: "authentication/login",
      body: JSON.stringify(parsed.data),
      locale,
    });
    if (!upstream.ok) return passthrough(upstream);

    // The API hands tokens back as Set-Cookie headers scoped to its own origin. Re-issue them on
    // this origin as HttpOnly cookies; the token values never reach client-side JavaScript.
    const env = getEnv();
    const setCookies = upstream.headers.getSetCookie();
    const access = findSetCookie(setCookies, env.accessCookie);
    const refresh = findSetCookie(setCookies, env.refreshCookie);
    if (!access?.value) {
      console.error("[bff] login succeeded upstream but no access-token cookie was returned");
      return jsonError(502, "MissingToken", "The service did not return a session.");
    }

    const user = sessionFromToken(access.value);

    // The back office is for staff only. Check the role before any cookie is set, and revoke the
    // upstream session that was just created so a refused sign-in leaves nothing behind.
    if (surface === "backoffice" && !user?.isAdmin) {
      if (refresh?.value) {
        try {
          await backendFetch({
            method: "POST",
            path: "authentication/logout",
            accessToken: access.value,
            refreshToken: refresh.value,
          });
        } catch (error) {
          console.error("[bff] could not revoke a refused back-office session", error);
        }
      }
      return jsonError(
        403,
        "NotBackOfficeUser",
        "This account does not have access to the back office.",
      );
    }

    setAuthCookies(
      jar,
      {
        accessToken: access.value,
        accessExpires: access.expires,
        refreshToken: refresh?.value,
        refreshExpires: refresh?.expires,
      },
      surface,
    );
    return jsonOk({ user });
  });
}

export async function handleLogout(request: Request, surface: Surface): Promise<Response> {
  const blocked = assertSameOrigin(request);
  if (blocked) return blocked;

  const names = getEnv().sessionCookies[surface];
  const jar = await cookies();
  const accessToken = jar.get(names.access)?.value;
  const refreshToken = jar.get(names.refresh)?.value;

  // Best effort: revoke the session upstream, but always clear the local session.
  if (refreshToken) {
    try {
      await backendFetch({
        method: "POST",
        path: "authentication/logout",
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error("[bff] upstream logout failed", error);
    }
  }

  clearAuthCookies(jar, surface);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export async function handleSession(surface: Surface): Promise<Response> {
  const user = await getSessionFor(surface);
  if (!user) return jsonError(401, "Unauthenticated", "No active session.");
  if (surface === "backoffice" && !user.isAdmin) {
    return jsonError(403, "Forbidden", "Back-office access requires the Admin role.");
  }
  return jsonOk({ user });
}
