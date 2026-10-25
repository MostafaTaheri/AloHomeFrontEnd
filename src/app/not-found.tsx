import Link from "next/link";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">{t("pages.notFoundTitle")}</h1>
      <p className="max-w-md text-sm text-muted">{t("pages.notFoundBody")}</p>
      <Link
        href="/"
        className="mt-2 inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand-hover"
      >
        {t("pages.goHome")}
      </Link>
    </main>
  );
}
