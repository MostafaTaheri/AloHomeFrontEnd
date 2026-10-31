import type { Metadata } from "next";
import { OrganisationsPage } from "@/features/backoffice/organisations/organisations-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("organisations.title") };
}

export default function Page() {
  return <OrganisationsPage />;
}
