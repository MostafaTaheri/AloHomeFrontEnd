import { cookies } from "next/headers";
import { sessionFromToken } from "@/lib/auth/jwt";
import { assertSameOrigin } from "@/lib/bff/guard";
import { jsonError, readJsonBody } from "@/lib/bff/responses";
import { getEnv } from "@/lib/env";
import { telemetryBodySchema } from "@/lib/telemetry/events";

export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const buckets = new Map<string, { start: number; count: number }>();

function allow(key: string, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= WINDOW_MS) {
    buckets.set(key, { start: now, count: 1 });
    if (buckets.size > 5_000) {
      for (const [k, v] of buckets) if (now - v.start >= WINDOW_MS) buckets.delete(k);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= MAX_PER_WINDOW;
}

async function userHash(id: string): Promise<string> {
  const data = new TextEncoder().encode(id);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Receives product events from the browser and writes one structured log line each, which the
 * platform's log pipeline can route to analytics. Requires a session on either surface, accepts
 * only allow-listed events and properties, and logs a short hash of the user id, never the id,
 * the phone number or any value from the page.
 */
export async function POST(request: Request) {
  const blocked = assertSameOrigin(request);
  if (blocked) return blocked;

  const env = getEnv();
  const jar = await cookies();
  const client = sessionFromToken(jar.get(env.sessionCookies.client.access)?.value);
  const staff = sessionFromToken(jar.get(env.sessionCookies.backoffice.access)?.value);
  const session = client ?? staff;
  if (!session) return jsonError(401, "Unauthenticated", "No active session.");

  const parsed = telemetryBodySchema.safeParse(await readJsonBody(request, 2_048));
  if (!parsed.success) return jsonError(400, "ValidationError", "Unsupported event.");

  const hash = await userHash(session.id);
  if (!allow(hash)) return jsonError(429, "TooManyRequests", "Too many events.");

  console.info(
    JSON.stringify({
      type: "telemetry",
      at: new Date().toISOString(),
      user: hash,
      event: parsed.data.event,
      props: parsed.data.props,
    }),
  );
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
