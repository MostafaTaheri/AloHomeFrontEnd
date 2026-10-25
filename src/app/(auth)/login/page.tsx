import type { Metadata } from "next";
import { AuthFlow } from "@/features/auth/auth-flow";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.loginTitle") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return (
    <AuthFlow
      mode="login"
      next={single(params.next)}
      expired={single(params.expired) === "1"}
      registered={single(params.registered) === "1"}
    />
  );
}
