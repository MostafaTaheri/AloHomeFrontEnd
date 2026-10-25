import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpensesPage } from "@/features/client/expenses/expenses-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("expenses.title") };
}

export default function Page() {
  return (
    <Suspense>
      <ExpensesPage />
    </Suspense>
  );
}
