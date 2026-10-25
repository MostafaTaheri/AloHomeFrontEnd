/**
 * The app serves two separate surfaces from one deployment:
 *
 *   client      residents, owners, committee members and strata/building managers (`/`)
 *   backoffice  AloHome staff with the Admin role (`/backoffice`)
 *
 * Each surface has its own login page, session cookies, API relay and navigation. A back-office
 * sign-in never creates a client session and the other way round, so an operator can hold both
 * in the same browser and a client token can never reach back-office endpoints.
 *
 * This module is plain (no server-only imports) because the proxy reads it too.
 */
export type Surface = "client" | "backoffice";

export const DEFAULT_COOKIE_NAMES: Record<Surface, { access: string; refresh: string }> = {
  client: { access: "alohomeAccessToken", refresh: "alohomeRefreshToken" },
  backoffice: { access: "alohomeBoAccessToken", refresh: "alohomeBoRefreshToken" },
};

export const BACKOFFICE_PREFIX = "/backoffice";
export const BACKOFFICE_LOGIN = "/backoffice/login";

export function loginPathFor(surface: Surface): string {
  return surface === "backoffice" ? BACKOFFICE_LOGIN : "/login";
}

export function homePathFor(surface: Surface): string {
  return surface === "backoffice" ? BACKOFFICE_PREFIX : "/schemes";
}

/** URL prefix of the BFF routes for a surface. */
export function apiPrefixFor(surface: Surface): string {
  return surface === "backoffice" ? "/api/bo" : "/api";
}

export function surfaceOfPath(pathname: string): Surface {
  return pathname === BACKOFFICE_PREFIX || pathname.startsWith(`${BACKOFFICE_PREFIX}/`)
    ? "backoffice"
    : "client";
}
