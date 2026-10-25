import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getEnv } from "@/lib/env";
import { BACKOFFICE_LOGIN, type Surface } from "@/lib/bff/surface";
import { sessionFromToken, type SessionUser } from "./jwt";

/**
 * Current user for a surface, derived from that surface's access-token cookie. Memoised per
 * request. The two surfaces never share a cookie, so a client session is never mistaken for a
 * back-office one.
 */
const sessionForSurface = cache(async (surface: Surface): Promise<SessionUser | null> => {
  const jar = await cookies();
  return sessionFromToken(jar.get(getEnv().sessionCookies[surface].access)?.value);
});

export function getSessionFor(surface: Surface): Promise<SessionUser | null> {
  return sessionForSurface(surface);
}

/** Client session (residents, owners, committee members, managers). */
export function getSession(): Promise<SessionUser | null> {
  return sessionForSurface("client");
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Back-office session. Requires the Admin role. */
export async function getBackofficeSession(): Promise<SessionUser | null> {
  const session = await sessionForSurface("backoffice");
  return session?.isAdmin ? session : null;
}

export async function requireBackoffice(): Promise<SessionUser> {
  const session = await sessionForSurface("backoffice");
  if (!session) redirect(BACKOFFICE_LOGIN);
  if (!session.isAdmin) redirect("/backoffice/forbidden");
  return session;
}
