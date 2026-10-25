import type { Metadata } from "next";
import { FeedbackPage } from "@/features/client/feedback/feedback-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("feedback.pageTitle") };
}

export default function Page() {
  return <FeedbackPage />;
}
