import { ClientShell } from "@/components/layout/client-shell";
import { requireSession } from "@/lib/auth/session";

// Defence in depth: src/proxy.ts already redirects anonymous visitors, and the API authorises
// every call. This keeps the client app unrenderable without a session if the proxy is bypassed.
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <ClientShell user={{ phoneNumber: session.phoneNumber }}>{children}</ClientShell>;
}
