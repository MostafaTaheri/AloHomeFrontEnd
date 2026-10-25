import { ApiError, parseErrorBody } from "./error";
import { apiPrefixFor, loginPathFor, type Surface } from "@/lib/bff/surface";

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** JSON body. Mutually exclusive with `form`. */
  body?: unknown;
  /** Multipart body, used by file uploads. The browser sets the boundary header. */
  form?: FormData;
  query?: Query;
  signal?: AbortSignal;
  /** Which app the call belongs to. Decides the relay, the auth endpoints and the login page. */
  surface?: Surface;
}

export function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

let redirectingToLogin = false;

function redirectToLogin(surface: Surface): void {
  if (typeof window === "undefined" || redirectingToLogin) return;
  redirectingToLogin = true;
  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  // Hard navigation on purpose: it also resets the in-memory query cache.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${loginPathFor(surface)}?next=${next}&expired=1`);
}

async function send(
  url: string,
  options: RequestOptions,
  redirectOn401: boolean,
): Promise<Response> {
  const surface = options.surface ?? "client";
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: options.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "NetworkError", "Network request failed");
  }

  if (!response.ok) {
    if (response.status === 401 && redirectOn401) redirectToLogin(surface);
    const text = await response.text().catch(() => "");
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    throw parseErrorBody(response.status, json, response.headers.get("x-correlation-id"));
  }
  return response;
}

async function execute<T>(
  url: string,
  options: RequestOptions,
  redirectOn401: boolean,
): Promise<T> {
  const response = await send(url, options, redirectOn401);
  if (response.status === 204) return null as T;
  const text = await response.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

/** Authenticated call to the AloHome API through the BFF relay. A 401 sends the user to sign in. */
export function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const prefix = apiPrefixFor(options.surface ?? "client");
  return execute<T>(`${prefix}/backend/${path}${buildQuery(options.query)}`, options, true);
}

/** Calls to the BFF's own auth endpoints. A 401 here is a normal outcome, not a lost session. */
export function authRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const prefix = apiPrefixFor(options.surface ?? "client");
  return execute<T>(`${prefix}/auth/${path}`, options, false);
}

export interface DownloadResult {
  blob: Blob;
  filename: string | null;
}

/** Binary download (PDF export). Returns the blob and the server-suggested file name. */
export async function apiDownload(
  path: string,
  options: RequestOptions = {},
): Promise<DownloadResult> {
  const prefix = apiPrefixFor(options.surface ?? "client");
  const response = await send(
    `${prefix}/backend/${path}${buildQuery(options.query)}`,
    options,
    true,
  );
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  let filename: string | null = null;
  if (match?.[1]) {
    try {
      filename = decodeURIComponent(match[1]);
    } catch {
      filename = match[1];
    }
  }
  return { blob: await response.blob(), filename };
}
