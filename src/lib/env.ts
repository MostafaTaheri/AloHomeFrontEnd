import "server-only";
import { z } from "zod";
import { DEFAULT_COOKIE_NAMES, type Surface } from "@/lib/bff/surface";

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const cookieName = (fallback: string) =>
  z.preprocess(emptyToUndefined, z.string().min(1).default(fallback));

const schema = z.object({
  API_BASE_URL: z.preprocess(emptyToUndefined, z.url().default("http://localhost:5028")),
  API_VERSION: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d+(\.\d+)?$/, "must look like 1 or 1.0")
      .default("1"),
  ),
  // The API's own cookie names. The BFF reads the tokens from these Set-Cookie headers.
  AUTH_ACCESS_COOKIE: cookieName(DEFAULT_COOKIE_NAMES.client.access),
  AUTH_REFRESH_COOKIE: cookieName(DEFAULT_COOKIE_NAMES.client.refresh),
  // Names of the session cookies set on this app's origin for the back office.
  BACKOFFICE_ACCESS_COOKIE: cookieName(DEFAULT_COOKIE_NAMES.backoffice.access),
  BACKOFFICE_REFRESH_COOKIE: cookieName(DEFAULT_COOKIE_NAMES.backoffice.refresh),
  COOKIE_SECURE: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).optional()),
  COOKIE_DOMAIN: z.preprocess(emptyToUndefined, z.string().optional()),
  // Comma separated list of origins allowed to call mutating endpoints. When unset, the
  // request Origin must match the Host (or X-Forwarded-Host) header.
  ALLOWED_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),
  BACKEND_TIMEOUT_MS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(15000),
  ),
  // Imports and report downloads can take longer than ordinary calls.
  UPLOAD_TIMEOUT_MS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(60000),
  ),
  MAX_UPLOAD_BYTES: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int()
      .positive()
      .max(100 * 1024 * 1024)
      .default(20 * 1024 * 1024),
  ),
});

export interface SurfaceCookies {
  access: string;
  refresh: string;
}

export interface AppEnv {
  apiBaseUrl: string;
  apiVersion: string;
  /** Names the API uses for its own token cookies. */
  accessCookie: string;
  refreshCookie: string;
  /** Names of the session cookies this app sets, per surface. */
  sessionCookies: Record<Surface, SurfaceCookies>;
  cookieSecure: boolean;
  cookieDomain: string | undefined;
  allowedOrigins: string[];
  backendTimeoutMs: number;
  uploadTimeoutMs: number;
  maxUploadBytes: number;
}

let cached: AppEnv | undefined;

/** Parsed and validated server environment. Throws a readable error on bad configuration. */
export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  const e = parsed.data;
  cached = {
    apiBaseUrl: e.API_BASE_URL.replace(/\/+$/, ""),
    apiVersion: e.API_VERSION,
    accessCookie: e.AUTH_ACCESS_COOKIE,
    refreshCookie: e.AUTH_REFRESH_COOKIE,
    sessionCookies: {
      client: { access: e.AUTH_ACCESS_COOKIE, refresh: e.AUTH_REFRESH_COOKIE },
      backoffice: { access: e.BACKOFFICE_ACCESS_COOKIE, refresh: e.BACKOFFICE_REFRESH_COOKIE },
    },
    cookieSecure: e.COOKIE_SECURE
      ? e.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production",
    cookieDomain: e.COOKIE_DOMAIN,
    allowedOrigins: (e.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim().replace(/\/+$/, ""))
      .filter(Boolean),
    backendTimeoutMs: e.BACKEND_TIMEOUT_MS,
    uploadTimeoutMs: e.UPLOAD_TIMEOUT_MS,
    maxUploadBytes: e.MAX_UPLOAD_BYTES,
  };
  return cached;
}

/** Test hook: forget the parsed environment. */
export function resetEnvCache(): void {
  cached = undefined;
}
