import type { NextRequest } from "next/server";
import { relayRequest, type RelayContext } from "@/lib/bff/relay";

export const dynamic = "force-dynamic";

const relay = (request: NextRequest, context: RelayContext) =>
  relayRequest(request, context, "backoffice");

export { relay as GET, relay as POST, relay as PUT, relay as DELETE };
