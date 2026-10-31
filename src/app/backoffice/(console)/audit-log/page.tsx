import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditLogPage } from "@/features/backoffice/audit-log/audit-log-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("nav.auditLog") };
}

export default function Page() {
  return (
    <Suspense>
      <AuditLogPage />
    </Suspense>
  );
}
