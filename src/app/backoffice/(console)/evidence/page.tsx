import type { Metadata } from "next";
import { Suspense } from "react";
import { EvidencePage } from "@/features/backoffice/evidence/evidence-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("evidence.title") };
}

export default function Page() {
  return (
    <Suspense>
      <EvidencePage />
    </Suspense>
  );
}
