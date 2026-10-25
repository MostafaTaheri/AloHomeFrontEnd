import type { Metadata } from "next";
import { ImportsPage } from "@/features/client/imports/imports-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("imports.title") };
}

export default function Page() {
  return <ImportsPage />;
}
