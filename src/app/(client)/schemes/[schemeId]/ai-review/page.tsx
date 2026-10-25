import type { Metadata } from "next";
import { Suspense } from "react";
import { AiReviewPage } from "@/features/client/ai-review/ai-review-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("aiReview.title") };
}

export default function Page() {
  return (
    <Suspense>
      <AiReviewPage />
    </Suspense>
  );
}
