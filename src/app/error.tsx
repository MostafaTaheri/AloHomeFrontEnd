"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    // Hook point for an error reporter (Sentry, OpenTelemetry). Never log personal data here.
    console.error("[ui] route error", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">{t("pages.errorTitle")}</h1>
      <p className="max-w-md text-sm text-muted">{t("pages.errorBody")}</p>
      {error.digest ? (
        <p className="text-xs text-muted" dir="ltr">
          {t("errors.reference", { id: error.digest })}
        </p>
      ) : null}
      <Button className="mt-2" onClick={reset}>
        {t("common.retry")}
      </Button>
    </main>
  );
}
