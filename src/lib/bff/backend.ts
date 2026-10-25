import "server-only";
import { getEnv } from "@/lib/env";

export class BackendUnavailableError extends Error {
  constructor(
    message: string,
    readonly kind: "timeout" | "network" | "redirect",
  ) {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

export interface BackendCall {
  method: string;
  /** Path below /api/v{version}/, without a leading slash, e.g. "schemes/3/lots". */
  path: string;
  /** Query string including the leading "?", already encoded. */
  search?: string;
  /** JSON text. Sets Content-Type to application/json. */
  body?: string | null;
  /** Binary body (multipart uploads). Requires contentType, including the boundary. */
  rawBody?: ArrayBuffer | null;
  contentType?: string;
  accessToken?: string;
  refreshToken?: string;
  locale?: string;
  correlationId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Calls the AloHome API from the server. The access token is sent as a Bearer token and, because
 * the API issues it as a cookie, also as a Cookie header so either server-side auth style works.
 * The cookie names here are the API's own, not the per-surface session names.
 */
export async function backendFetch(call: BackendCall): Promise<Response> {
  const env = getEnv();
  const url = `${env.apiBaseUrl}/api/v${env.apiVersion}/${call.path}${call.search ?? ""}`;
  const headers = new Headers({
    Accept: "application/json, application/pdf;q=0.9",
    "X-Correlation-Id": call.correlationId ?? crypto.randomUUID(),
  });
  if (call.rawBody != null) {
    if (call.contentType) headers.set("Content-Type", call.contentType);
  } else if (call.body != null) {
    headers.set("Content-Type", "application/json");
  }
  if (call.locale) headers.set("Accept-Language", call.locale);
  if (call.accessToken) headers.set("Authorization", `Bearer ${call.accessToken}`);

  const cookie: string[] = [];
  if (call.accessToken) cookie.push(`${env.accessCookie}=${call.accessToken}`);
  if (call.refreshToken) cookie.push(`${env.refreshCookie}=${call.refreshToken}`);
  if (cookie.length > 0) headers.set("Cookie", cookie.join("; "));

  const timeout = AbortSignal.timeout(call.timeoutMs ?? env.backendTimeoutMs);
  const signal = call.signal ? AbortSignal.any([call.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(url, {
      method: call.method,
      headers,
      body: call.rawBody ?? call.body ?? undefined,
      signal,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (error) {
    if (timeout.aborted) throw new BackendUnavailableError("Upstream timed out", "timeout");
    throw new BackendUnavailableError(
      error instanceof Error ? error.message : "Upstream unreachable",
      "network",
    );
  }

  // The API calls UseHttpsRedirection(). A redirect from the BFF almost always means API_BASE_URL
  // points at the plain-http port of a service that wants https.
  if (response.status >= 300 && response.status < 400 && response.status !== 304) {
    throw new BackendUnavailableError(
      `Upstream redirected (${response.status}). Check API_BASE_URL.`,
      "redirect",
    );
  }
  return response;
}
