import type { Metadata } from "next";
import { Suspense } from "react";
import { PilotPage } from "@/features/backoffice/pilot/pilot-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("backoffice.pilotTitle") };
}

export default function Page() {
  return (
    <Suspense>
      <PilotPage />
    </Suspense>
  );
}
