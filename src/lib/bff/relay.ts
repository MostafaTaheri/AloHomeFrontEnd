import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { sessionFromToken } from "@/lib/auth/jwt";
import { getEnv } from "@/lib/env";
import { clearAuthCookies } from "./auth-cookies";
import { backendFetch } from "./backend";
import { assertSameOrigin } from "./guard";
import { isUploadPath, sanitizeBackendPath } from "./path";
import { jsonError, passthrough, withBackendErrors } from "./responses";
import type { Surface } from "./surface";

const MAX_JSON_BYTES = 64 * 1024;
const MAX_QUERY_LENGTH = 1_024;

export type RelayContext = { params: Promise<{ path: string[] }> };

/**
 * Authenticated relay to the AloHome API for one surface. The browser calls
 * /api/backend/<resource> (client) or /api/bo/backend/<resource> (back office); this handler
 * attaches the access token from that surface's HttpOnly cookie and forwards the request.
 *
 * The API stays the authority for authorisation. This layer keeps the token out of JavaScript,
 * narrows what each surface can reach, caps body sizes, and (for the back office) refuses tokens
 * that do not carry the Admin role.
 */
export async function relayRequest(
  request: NextRequest,
  context: RelayContext,
  surface: Surface,
): Promise<Response> {
  const { path } = await context.params;
  const safePath = sanitizeBackendPath(path, surface);
  if (!safePath) return jsonError(404, "NotFound", "Unknown resource.");

  const blocked = assertSameOrigin(request);
  if (blocked) return blocked;

  const search = request.nextUrl.search;
  if (search.length > MAX_QUERY_LENGTH) return jsonError(414, "QueryTooLong", "Query too long.");

  const env = getEnv();
  const jar = await cookies();
  const accessToken = jar.get(env.sessionCookies[surface].access)?.value;
  const session = sessionFromToken(accessToken);
  if (!accessToken || !session) {
    clearAuthCookies(jar, surface);
    return jsonError(401, "Unauthenticated", "Session expired.");
  }
  if (surface === "backoffice" && !session.isAdmin) {
    return jsonError(403, "Forbidden", "Back-office access requires the Admin role.");
  }

  let body: string | null = null;
  let rawBody: ArrayBuffer | null = null;
  let contentType: string | undefined;
  const isUpload =
    request.method === "POST" &&
    isUploadPath(safePath) &&
    (request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data");

  if (isUpload) {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > env.maxUploadBytes) {
      return jsonError(413, "BodyTooLarge", "The file is too large.");
    }
    rawBody = await request.arrayBuffer();
    if (rawBody.byteLength > env.maxUploadBytes) {
      return jsonError(413, "BodyTooLarge", "The file is too large.");
    }
    contentType = request.headers.get("content-type") ?? undefined;
  } else if (request.method !== "GET" && request.method !== "DELETE") {
    const text = await request.text();
    if (text.length > MAX_JSON_BYTES) return jsonError(413, "BodyTooLarge", "Request too large.");
    body = text.length > 0 ? text : null;
  }

  const localeCookie = jar.get(LOCALE_COOKIE)?.value;
  const isPdf = request.method === "GET" && safePath.endsWith("/pdf");
  return withBackendErrors(async () => {
    const upstream = await backendFetch({
      method: request.method,
      path: safePath,
      search,
      body,
      rawBody,
      contentType,
      accessToken,
      locale: isLocale(localeCookie) ? localeCookie : undefined,
      correlationId: request.headers.get("x-correlation-id") ?? undefined,
      timeoutMs: isUpload || isPdf ? env.uploadTimeoutMs : undefined,
      signal: request.signal,
    });
    if (upstream.status === 401) clearAuthCookies(jar, surface);
    return passthrough(upstream);
  });
}
