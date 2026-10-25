import "server-only";
import { getEnv } from "@/lib/env";
import { jsonError } from "./responses";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for state-changing requests, on top of SameSite=Lax cookies. Browsers always send
 * Origin on cross-origin and on same-origin non-GET fetches, so a missing or foreign Origin is
 * rejected. Returns an error response, or null when the request may proceed.
 */
export function assertSameOrigin(request: Request): Response | null {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return null;

  const origin = request.headers.get("origin")?.replace(/\/+$/, "");
  if (!origin) return jsonError(403, "CsrfRejected", "Missing Origin header.");

  const { allowedOrigins } = getEnv();
  if (allowedOrigins.length > 0) {
    return allowedOrigins.includes(origin)
      ? null
      : jsonError(403, "CsrfRejected", "Origin not allowed.");
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    if (host && new URL(origin).host === host) return null;
  } catch {
    // fall through
  }
  return jsonError(403, "CsrfRejected", "Origin does not match host.");
}
