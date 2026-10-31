import type { Metadata } from "next";
import { GlossaryPage } from "@/features/client/glossary/glossary-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("glossary.title") };
}

export default function Page() {
  return <GlossaryPage />;
}
