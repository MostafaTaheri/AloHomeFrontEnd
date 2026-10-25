export const dynamic = "force-dynamic";

/** Liveness probe: answers as long as the Node process is serving requests. */
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
