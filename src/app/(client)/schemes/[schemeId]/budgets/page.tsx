import type { Metadata } from "next";
import { Suspense } from "react";
import { BudgetsPage } from "@/features/client/budgets/budgets-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("budgets.title") };
}

export default function Page() {
  return (
    <Suspense>
      <BudgetsPage />
    </Suspense>
  );
}
