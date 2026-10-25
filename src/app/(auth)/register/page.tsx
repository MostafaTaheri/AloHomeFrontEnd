import type { Metadata } from "next";
import { AuthFlow } from "@/features/auth/auth-flow";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.registerTitle") };
}

export default function RegisterPage() {
  return <AuthFlow mode="register" />;
}
