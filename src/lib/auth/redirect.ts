import type { Surface } from "@/lib/bff/surface";

/**
 * Accepts only same-site relative paths for post-login redirects, so a crafted ?next= value can
 * never send a user to another origin. A surface keeps its users inside it: a client sign-in
 * cannot be redirected into /backoffice and a back-office sign-in only returns to /backoffice.
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string,
  surface: Surface = "client",
): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (value.startsWith("/api")) return fallback;

  const inBackoffice = value === "/backoffice" || value.startsWith("/backoffice/");
  if (surface === "backoffice") {
    if (!inBackoffice) return fallback;
    if (value.startsWith("/backoffice/login")) return fallback;
    return value;
  }
  if (inBackoffice) return fallback;
  if (value.startsWith("/login") || value.startsWith("/register")) return fallback;
  return value;
}
