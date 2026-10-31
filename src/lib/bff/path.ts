import type { Surface } from "./surface";

/**
 * Allowlists for the generic relays. Each surface can reach only its own resource trees, so the
 * BFF can never be turned into an open proxy to the API's other endpoints (health, OpenAPI,
 * authentication), and a client session can never address back-office routes.
 */
const ALLOWED_ROOTS: Record<Surface, readonly (readonly string[])[]> = {
  client: [["schemes"], ["product"], ["organisations"], ["portfolio"]],
  backoffice: [
    ["backoffice", "schemes"],
    ["backoffice", "users"],
    ["backoffice", "pilot"],
    ["backoffice", "demo"],
    ["backoffice", "organisations"],
    ["backoffice", "audit-logs"],
    ["backoffice", "evidence"],
    ["backoffice", "pilot-agreements"],
  ],
};

const SEGMENT = /^[A-Za-z0-9-]{1,64}$/;

/** Returns the normalised relative path, or null when the request must be refused. */
export function sanitizeBackendPath(
  segments: string[],
  surface: Surface = "client",
): string | null {
  if (segments.length === 0 || segments.length > 10) return null;
  if (!segments.every((s) => SEGMENT.test(s))) return null;
  const lower = segments.map((s) => s.toLowerCase());
  const allowed = ALLOWED_ROOTS[surface].some(
    (root) => lower.length >= root.length && root.every((part, i) => lower[i] === part),
  );
  return allowed ? lower.join("/") : null;
}

const UPLOAD_PATH =
  /^schemes\/\d{1,10}\/(imports(\/[0-9a-f-]{36}\/retry)?|ai\/document-extractions)$/;

/** The only endpoints that accept a multipart file upload: imports and AI invoice extraction. */
export function isUploadPath(path: string): boolean {
  return UPLOAD_PATH.test(path);
}
