import type { Metadata } from "next";
import { ReportsPage } from "@/features/client/reports/reports-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("reports.title") };
}

export default function Page() {
  return <ReportsPage />;
}
