import type { Metadata } from "next";

import { UsersPage } from "@/features/backoffice/users/users-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("backoffice.usersTitle") };
}

export default function Page() {
  return <UsersPage />;
}
