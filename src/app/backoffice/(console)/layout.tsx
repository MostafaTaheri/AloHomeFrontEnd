import { BackofficeShell } from "@/components/layout/backoffice-shell";
import { requireBackoffice } from "@/lib/auth/session";

// Defence in depth: src/proxy.ts already gates /backoffice, and the API authorises every call.
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await requireBackoffice();
  return <BackofficeShell user={{ phoneNumber: session.phoneNumber }}>{children}</BackofficeShell>;
}
