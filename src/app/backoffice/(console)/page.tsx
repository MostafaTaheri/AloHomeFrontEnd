import type { Metadata } from "next";
import { OverviewPage } from "@/features/backoffice/overview/overview-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("backoffice.overviewTitle") };
}

export default function Page() {
  return <OverviewPage />;
}
