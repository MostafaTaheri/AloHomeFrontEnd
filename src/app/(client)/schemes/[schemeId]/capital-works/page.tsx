import type { Metadata } from "next";
import { Suspense } from "react";
import { CapitalPage } from "@/features/client/capital/capital-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("capital.title") };
}

export default function Page() {
  return (
    <Suspense>
      <CapitalPage />
    </Suspense>
  );
}
