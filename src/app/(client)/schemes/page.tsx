import type { Metadata } from "next";
import { SchemesList } from "@/features/client/schemes/schemes-list";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("nav.schemes") };
}

export default function SchemesPage() {
  return <SchemesList />;
}
