import type { Metadata } from "next";

import { AuditPage } from "@/features/backoffice/audit/audit-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("backoffice.auditTitle") };
}

export default function Page() {
  return <AuditPage />;
}
