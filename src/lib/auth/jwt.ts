/**
 * JWT helpers used for UI decisions only (which menu to show, whether to redirect to login).
 *
 * IMPORTANT: the signature is NOT verified here. The API is the only authority on who the caller
 * is and what they may do; every request is re-authorised there. Never use these values to grant
 * access to data.
 */

export interface JwtClaims {
  sub?: string;
  exp?: number;
  preferred_username?: string;
  phone_number?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] } | undefined>;
  roles?: string[] | string;
  role?: string[] | string;
  [claim: string]: unknown;
}

export interface SessionUser {
  id: string;
  phoneNumber: string | null;
  roles: string[];
  isAdmin: boolean;
  /** Epoch milliseconds, or null when the token carries no expiry. */
  expiresAt: number | null;
}

const MS_ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
const MS_NAME_ID_CLAIM = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";

export function decodeJwtPayload(token: string | undefined | null): JwtClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JwtClaims)
      : null;
  } catch {
    return null;
  }
}

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string") return [v];
  return [];
}

export function extractRoles(claims: JwtClaims): string[] {
  const roles = new Set<string>();
  asList(claims.realm_access?.roles).forEach((r) => roles.add(r));
  asList(claims.roles).forEach((r) => roles.add(r));
  asList(claims.role).forEach((r) => roles.add(r));
  asList(claims[MS_ROLE_CLAIM]).forEach((r) => roles.add(r));
  for (const entry of Object.values(claims.resource_access ?? {})) {
    asList(entry?.roles).forEach((r) => roles.add(r));
  }
  return [...roles];
}

export function sessionFromToken(
  token: string | undefined | null,
  now: number = Date.now(),
): SessionUser | null {
  const claims = decodeJwtPayload(token);
  if (!claims) return null;

  const expiresAt = typeof claims.exp === "number" ? claims.exp * 1000 : null;
  if (expiresAt !== null && expiresAt <= now) return null;

  const id =
    (typeof claims.sub === "string" && claims.sub) ||
    (typeof claims[MS_NAME_ID_CLAIM] === "string" && (claims[MS_NAME_ID_CLAIM] as string)) ||
    "";
  if (!id) return null;

  const phone =
    (typeof claims.phone_number === "string" && claims.phone_number) ||
    (typeof claims.preferred_username === "string" && claims.preferred_username) ||
    null;

  const roles = extractRoles(claims);
  return {
    id,
    phoneNumber: phone,
    roles,
    isAdmin: roles.some((r) => r.toLowerCase() === "admin"),
    expiresAt,
  };
}
