import "server-only";
import type { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { decodeJwtPayload } from "@/lib/auth/jwt";
import type { Surface } from "./surface";

type CookieJar = Awaited<ReturnType<typeof cookies>>;

const REFRESH_FALLBACK_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_FALLBACK_MS = 60 * 60 * 1000;

function baseOptions() {
  const env = getEnv();
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax" as const,
    path: "/",
    ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
  };
}

export interface IssuedTokens {
  accessToken: string;
  accessExpires?: Date;
  refreshToken?: string;
  refreshExpires?: Date;
}

/**
 * Stores the API's tokens as HttpOnly cookies on this app's origin, under the cookie names of the
 * given surface. The browser never sees the token values in JavaScript.
 */
export function setAuthCookies(jar: CookieJar, tokens: IssuedTokens, surface: Surface): void {
  const names = getEnv().sessionCookies[surface];
  const now = Date.now();
  const jwtExp = decodeJwtPayload(tokens.accessToken)?.exp;
  const accessExpires =
    tokens.accessExpires ??
    (typeof jwtExp === "number" ? new Date(jwtExp * 1000) : new Date(now + ACCESS_FALLBACK_MS));

  jar.set({
    ...baseOptions(),
    name: names.access,
    value: tokens.accessToken,
    expires: accessExpires,
  });
  if (tokens.refreshToken) {
    jar.set({
      ...baseOptions(),
      name: names.refresh,
      value: tokens.refreshToken,
      expires: tokens.refreshExpires ?? new Date(now + REFRESH_FALLBACK_MS),
    });
  }
}

export function clearAuthCookies(jar: CookieJar, surface: Surface): void {
  const names = getEnv().sessionCookies[surface];
  for (const name of [names.access, names.refresh]) {
    jar.set({ ...baseOptions(), name, value: "", maxAge: 0 });
  }
}
