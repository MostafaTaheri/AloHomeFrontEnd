import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditPage } from "@/features/client/audit/audit-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("audit.title") };
}

export default function Page() {
  return (
    <Suspense>
      <AuditPage />
    </Suspense>
  );
}
