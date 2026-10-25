import type { Metadata } from "next";
import { SchemesPage } from "@/features/backoffice/schemes/schemes-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("backoffice.schemesTitle") };
}

export default function Page() {
  return <SchemesPage />;
}
