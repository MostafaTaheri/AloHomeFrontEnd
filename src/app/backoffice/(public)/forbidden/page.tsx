import Link from "next/link";
import { getI18n } from "@/i18n/server";

export default async function BackofficeForbidden() {
  const { t } = await getI18n();
  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-6 text-center">
      <h1 className="text-xl font-semibold">{t("pages.forbiddenTitle")}</h1>
      <p className="text-sm text-muted">{t("pages.boForbiddenBody")}</p>
      <div className="flex flex-wrap justify-center gap-4 pt-2 text-sm">
        <Link href="/backoffice/login" className="font-medium text-brand hover:underline">
          {t("auth.boTitle")}
        </Link>
        <Link href="/" className="font-medium text-brand hover:underline">
          {t("auth.boClientLinkAction")}
        </Link>
      </div>
    </div>
  );
}
