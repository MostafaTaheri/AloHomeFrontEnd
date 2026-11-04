import type { Metadata } from "next";
import { MembersPage } from "@/features/client/members/members-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("members.title") };
}

export default function Page() {
  return <MembersPage />;
}
