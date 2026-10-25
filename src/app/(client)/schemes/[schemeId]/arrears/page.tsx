import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrearsPage } from "@/features/client/arrears/arrears-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("arrears.title") };
}

export default function Page() {
  return (
    <Suspense>
      <ArrearsPage />
    </Suspense>
  );
}
