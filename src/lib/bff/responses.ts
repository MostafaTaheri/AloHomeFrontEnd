import "server-only";
import { BackendUnavailableError } from "./backend";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Same envelope the API uses for errors (GeneralResponseDto), so the client parses one shape. */
export function jsonError(
  status: number,
  code: string,
  message: string,
  details: string[] = [],
  extraHeaders?: Record<string, string>,
): Response {
  return Response.json(
    { succeeded: false, data: null, error: { code, message, details } },
    { status, headers: { ...NO_STORE, ...extraHeaders } },
  );
}

export function jsonOk(data: unknown, status = 200): Response {
  return Response.json({ succeeded: true, data, error: null }, { status, headers: NO_STORE });
}

/** Relays status and JSON body from the API without leaking its other headers (e.g. Set-Cookie). */
export function passthrough(upstream: Response): Response {
  const headers = new Headers(NO_STORE);
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  for (const name of ["x-correlation-id", "retry-after", "content-disposition"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  const bodyless = [101, 204, 205, 304].includes(upstream.status);
  return new Response(bodyless ? null : upstream.body, { status: upstream.status, headers });
}

/** Maps upstream connectivity failures to a 502/504 in the shared error envelope. */
export async function withBackendErrors(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      const status = error.kind === "timeout" ? 504 : 502;
      console.error(`[bff] upstream ${error.kind}: ${error.message}`);
      return jsonError(status, "BackendUnavailable", "The service is temporarily unavailable.");
    }
    console.error("[bff] unexpected error", error);
    return jsonError(500, "BffError", "Unexpected error.");
  }
}

/** Reads a JSON body with a size cap. Returns null when absent or invalid. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  const text = await request.text();
  if (text.length === 0 || text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
