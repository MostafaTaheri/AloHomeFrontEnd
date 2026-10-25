"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { authRequest } from "@/lib/api/client";
import { loginPathFor, type Surface } from "@/lib/bff/surface";

export function SignOutButton({ surface = "client" }: { surface?: Surface }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await authRequest("logout", { method: "POST", surface });
    } catch {
      // The server clears the session cookies even when the upstream call fails; if this request
      // itself failed there is nothing more to do locally than leave.
    } finally {
      // Full navigation so every in-memory query cache is dropped.
      window.location.assign(loginPathFor(surface));
    }
  }

  return (
    <Button variant="ghost" size="sm" loading={busy} onClick={signOut}>
      {t("common.signOut")}
    </Button>
  );
}
